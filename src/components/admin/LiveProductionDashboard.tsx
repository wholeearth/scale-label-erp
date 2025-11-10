import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Package, Users, TrendingUp, Box, AlertCircle } from 'lucide-react';
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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const LiveProductionDashboard = () => {
  const [recentRecords, setRecentRecords] = useState<ProductionRecord[]>([]);
  const [todayStats, setTodayStats] = useState({
    totalProduction: 0,
    totalWeight: 0,
    activeOperators: 0,
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
