import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Package, Users, TrendingUp } from 'lucide-react';

interface ProductionData {
  operator_name: string;
  employee_code: string;
  current_item: string;
  items_produced: number;
  latest_serial: string;
}

const LiveProductionDashboard = () => {
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [stats, setStats] = useState({
    totalProduced: 0,
    activeOperators: 0,
    totalWeight: 0
  });

  useEffect(() => {
    fetchProductionData();

    // Set up real-time subscription
    const channel = supabase
      .channel('production-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'production_records'
        },
        () => {
          fetchProductionData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProductionData = async () => {
    try {
      // Get today's production records
      const today = new Date().toISOString().split('T')[0];
      
      const { data: records, error } = await supabase
        .from('production_records')
        .select(`
          *,
          operator:profiles!production_records_operator_id_fkey(full_name, employee_code),
          item:items(product_name, product_code)
        `)
        .gte('production_date', today)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by operator
      const grouped = records?.reduce((acc: any, record: any) => {
        const operatorId = record.operator_id;
        if (!acc[operatorId]) {
          acc[operatorId] = {
            operator_name: record.operator?.full_name || 'Unknown',
            employee_code: record.operator?.employee_code || '',
            current_item: record.item?.product_name || '',
            items_produced: 0,
            latest_serial: ''
          };
        }
        acc[operatorId].items_produced++;
        acc[operatorId].latest_serial = record.serial_number;
        return acc;
      }, {});

      setProductionData(Object.values(grouped || {}));

      // Calculate stats
      const totalProduced = records?.length || 0;
      const activeOperators = Object.keys(grouped || {}).length;
      const totalWeight = records?.reduce((sum, r) => sum + parseFloat(String(r.weight_kg || 0)), 0) || 0;

      setStats({
        totalProduced,
        activeOperators,
        totalWeight
      });
    } catch (error) {
      console.error('Error fetching production data:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produced Today</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProduced}</div>
            <p className="text-xs text-muted-foreground">items completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Operators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeOperators}</div>
            <p className="text-xs text-muted-foreground">currently producing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWeight.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">produced today</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Production Monitor</CardTitle>
          <CardDescription>Real-time operator production status</CardDescription>
        </CardHeader>
        <CardContent>
          {productionData.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active production today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {productionData.map((data, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-semibold">{data.operator_name}</p>
                      <p className="text-sm text-muted-foreground">Code: {data.employee_code}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{data.current_item}</p>
                    <p className="text-sm text-muted-foreground">Current Item</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{data.items_produced}</p>
                    <p className="text-sm text-muted-foreground">Items Produced</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{data.latest_serial}</p>
                    <p className="text-xs text-muted-foreground">Latest Serial</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveProductionDashboard;
