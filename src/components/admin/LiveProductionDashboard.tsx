import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Package, Users, TrendingUp, Box, AlertCircle, User } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProductionRecord {
  id: string;
  serial_number: string;
  weight_kg: number;
  production_date: string;
  production_time: string;
  created_at: string;
  operator_id: string;
  item_id: string;
  profiles: {
    full_name: string;
    employee_code: string | null;
  };
  items: {
    product_code: string;
    product_name: string;
  };
}

interface OperatorStatus {
  operator_id: string;
  operator_name: string;
  employee_code: string;
  current_item: string;
  item_code: string;
  shift_produced: number;
  last_serial: string;
  last_production_time: string;
  is_online: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const LiveProductionDashboard = () => {
  const [recentRecords, setRecentRecords] = useState<ProductionRecord[]>([]);
  const [todayStats, setTodayStats] = useState({
    totalProduction: 0,
    totalWeight: 0,
    activeOperators: 0,
  });

  // Fetch real-time operator status
  const { data: operatorStatus } = useQuery({
    queryKey: ['operator-status-live'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get active assignments
      const { data: assignments, error: assignError } = await supabase
        .from('operator_assignments')
        .select(`
          operator_id,
          item_id,
          quantity_assigned,
          quantity_produced,
          profiles!operator_assignments_operator_id_fkey (
            full_name,
            employee_code
          ),
          items (
            product_code,
            product_name
          )
        `)
        .eq('status', 'active');

      if (assignError) throw assignError;

      // Get today's production records
      const { data: records, error: recordError } = await supabase
        .from('production_records')
        .select(`
          operator_id,
          serial_number,
          production_time,
          created_at
        `)
        .gte('production_date', today)
        .order('created_at', { ascending: false });

      if (recordError) throw recordError;

      // Group by operator
      const operatorMap = new Map<string, OperatorStatus>();
      
      assignments?.forEach((assignment: any) => {
        const operatorId = assignment.operator_id;
        if (!operatorMap.has(operatorId)) {
          const operatorRecords = records?.filter(r => r.operator_id === operatorId) || [];
          const lastRecord = operatorRecords[0];
          const isOnline = lastRecord ? 
            (new Date().getTime() - new Date(lastRecord.created_at).getTime()) < 600000 : // 10 minutes
            false;

          operatorMap.set(operatorId, {
            operator_id: operatorId,
            operator_name: assignment.profiles.full_name,
            employee_code: assignment.profiles.employee_code || 'N/A',
            current_item: `${assignment.items.product_code} (${assignment.items.product_name})`,
            item_code: assignment.items.product_code,
            shift_produced: operatorRecords.length,
            last_serial: lastRecord?.serial_number || 'N/A',
            last_production_time: lastRecord?.production_time || 'N/A',
            is_online: isOnline
          });
        }
      });

      return Array.from(operatorMap.values());
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch initial production data
  const { data: initialRecords, refetch } = useQuery({
    queryKey: ['production-records-live'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('production_records')
        .select(`
          id,
          serial_number,
          weight_kg,
          production_date,
          production_time,
          created_at,
          operator_id,
          item_id,
          profiles!production_records_operator_id_fkey (
            full_name,
            employee_code
          ),
          items (
            product_code,
            product_name
          )
        `)
        .gte('production_date', today)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ProductionRecord[];
    },
  });

  // Fetch operator performance
  const { data: operatorPerformance } = useQuery({
    queryKey: ['operator-performance'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('production_records')
        .select(`
          operator_id,
          weight_kg,
          profiles!production_records_operator_id_fkey (
            full_name,
            employee_code
          )
        `)
        .gte('production_date', today);

      if (error) throw error;

      const grouped = (data as any[]).reduce((acc, record) => {
        const operatorName = record.profiles.full_name;
        if (!acc[operatorName]) {
          acc[operatorName] = { name: operatorName, count: 0, weight: 0 };
        }
        acc[operatorName].count += 1;
        acc[operatorName].weight += parseFloat(record.weight_kg);
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });

  // Fetch inventory summary
  const { data: inventorySummary } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          transaction_type,
          weight_kg,
          quantity,
          items (
            product_code,
            product_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const summary = (data as any[]).reduce((acc, item) => {
        const productName = item.items.product_name;
        if (!acc[productName]) {
          acc[productName] = { name: productName, quantity: 0, weight: 0 };
        }
        const multiplier = item.transaction_type === 'production' ? 1 : -1;
        acc[productName].quantity += multiplier * item.quantity;
        acc[productName].weight += multiplier * (item.weight_kg || 0);
        return acc;
      }, {});

      return Object.values(summary).slice(0, 5);
    },
  });

  // Real-time subscription for production records
  useEffect(() => {
    const channel = supabase
      .channel('production-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'production_records',
        },
        async (payload) => {
          console.log('New production record:', payload);
          await refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Update recent records and stats
  useEffect(() => {
    if (initialRecords) {
      setRecentRecords(initialRecords);
      
      const uniqueOperators = new Set(initialRecords.map(r => r.operator_id));
      const totalWeight = initialRecords.reduce((sum, r) => sum + parseFloat(String(r.weight_kg)), 0);
      
      setTodayStats({
        totalProduction: initialRecords.length,
        totalWeight: totalWeight,
        activeOperators: uniqueOperators.size,
      });
    }
  }, [initialRecords]);

  // Production timeline data (last 24 hours by hour)
  const productionTimeline = recentRecords.reduce((acc, record) => {
    const hour = new Date(record.created_at).getHours();
    const hourLabel = `${hour}:00`;
    const existing = acc.find(item => item.hour === hourLabel);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ hour: hourLabel, count: 1 });
    }
    return acc;
  }, [] as Array<{ hour: string; count: number }>);

  return (
    <div className="space-y-6">
      {/* Real-time Operator Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>Real-time Production Live View</CardTitle>
          </div>
          <CardDescription>Live operator status and current production</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {operatorStatus?.map((operator) => (
              <Card key={operator.operator_id} className="border-border/50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Operator Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{operator.operator_name}</span>
                        <span className="text-sm text-muted-foreground">o{operator.employee_code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${operator.is_online ? 'bg-green-500' : 'bg-destructive'}`} />
                        <span className="text-xs text-muted-foreground">
                          {operator.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    {/* Production Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current Item</p>
                        <p className="font-medium">{operator.current_item}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Shift Produced</p>
                        <p className="font-medium">{operator.shift_produced} items</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Next Serial No.</p>
                        <p className="font-mono text-xs">{operator.last_serial}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Production</p>
                        <p className="font-medium">{operator.last_production_time}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!operatorStatus || operatorStatus.length === 0) && (
              <div className="col-span-full flex items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="mr-2 h-4 w-4" />
                No active operators found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Production</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats.totalProduction}</div>
            <p className="text-xs text-muted-foreground">units produced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats.totalWeight.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">produced today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Operators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats.activeOperators}</div>
            <p className="text-xs text-muted-foreground">working today</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Production Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Production Timeline (Today)
            </CardTitle>
            <CardDescription>Units produced per hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={productionTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Operator Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Operator Performance
            </CardTitle>
            <CardDescription>Units produced by operator today</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={operatorPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Levels
          </CardTitle>
          <CardDescription>Current stock by product (top 5)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={inventorySummary}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, quantity }) => `${name}: ${quantity}`}
                outerRadius={100}
                fill="hsl(var(--primary))"
                dataKey="quantity"
              >
                {inventorySummary?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Production Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Production Records
            <Badge variant="outline" className="ml-2">
              Live
            </Badge>
          </CardTitle>
          <CardDescription>Latest production entries updated in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentRecords.slice(0, 10).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">{record.serial_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {record.items.product_code} - {record.items.product_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Operator: {record.profiles.full_name}
                    {record.profiles.employee_code && ` (${record.profiles.employee_code})`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{parseFloat(String(record.weight_kg)).toFixed(2)} kg</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(record.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {recentRecords.length === 0 && (
              <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="h-4 w-4" />
                No production records today
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveProductionDashboard;
