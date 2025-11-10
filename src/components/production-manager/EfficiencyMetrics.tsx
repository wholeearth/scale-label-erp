import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Users, Package, Clock, Award } from 'lucide-react';
import { useMemo } from 'react';
import { subDays, differenceInHours, format } from 'date-fns';

interface ProductionRecord {
  id: string;
  operator_id: string;
  item_id: string;
  created_at: string;
  profiles: {
    full_name: string;
    employee_code: string | null;
  };
  items: {
    product_code: string;
    product_name: string;
  };
}

interface OperatorMetrics {
  operatorId: string;
  operatorName: string;
  employeeCode: string | null;
  totalProduced: number;
  averagePerDay: number;
  averagePerHour: number;
  activeHours: number;
  efficiency: number; // items per hour
}

interface ItemMetrics {
  itemId: string;
  productCode: string;
  productName: string;
  totalProduced: number;
  averagePerDay: number;
  operatorCount: number;
  averageTimePerUnit: number; // hours per unit
}

export const EfficiencyMetrics = () => {
  const daysToAnalyze = 30;
  const startDate = subDays(new Date(), daysToAnalyze).toISOString();

  const { data: productionRecords, isLoading } = useQuery({
    queryKey: ['production-metrics', daysToAnalyze],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_records')
        .select(`
          id,
          operator_id,
          item_id,
          created_at,
          profiles!production_records_operator_id_fkey (
            full_name,
            employee_code
          ),
          items (
            product_code,
            product_name
          )
        `)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ProductionRecord[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const operatorMetrics = useMemo((): OperatorMetrics[] => {
    if (!productionRecords) return [];

    const metricsMap = new Map<string, {
      operatorName: string;
      employeeCode: string | null;
      records: ProductionRecord[];
    }>();

    productionRecords.forEach(record => {
      if (!metricsMap.has(record.operator_id)) {
        metricsMap.set(record.operator_id, {
          operatorName: record.profiles.full_name,
          employeeCode: record.profiles.employee_code,
          records: [],
        });
      }
      metricsMap.get(record.operator_id)!.records.push(record);
    });

    return Array.from(metricsMap.entries()).map(([operatorId, data]) => {
      const records = data.records;
      const totalProduced = records.length;
      
      // Calculate time span
      const firstRecord = new Date(records[0].created_at);
      const lastRecord = new Date(records[records.length - 1].created_at);
      const hoursActive = Math.max(1, differenceInHours(lastRecord, firstRecord));
      const daysActive = Math.max(1, hoursActive / 24);

      return {
        operatorId,
        operatorName: data.operatorName,
        employeeCode: data.employeeCode,
        totalProduced,
        averagePerDay: totalProduced / daysActive,
        averagePerHour: totalProduced / hoursActive,
        activeHours: hoursActive,
        efficiency: totalProduced / hoursActive,
      };
    }).sort((a, b) => b.efficiency - a.efficiency);
  }, [productionRecords]);

  const itemMetrics = useMemo((): ItemMetrics[] => {
    if (!productionRecords) return [];

    const metricsMap = new Map<string, {
      productCode: string;
      productName: string;
      records: ProductionRecord[];
      operators: Set<string>;
    }>();

    productionRecords.forEach(record => {
      if (!metricsMap.has(record.item_id)) {
        metricsMap.set(record.item_id, {
          productCode: record.items.product_code,
          productName: record.items.product_name,
          records: [],
          operators: new Set(),
        });
      }
      const itemData = metricsMap.get(record.item_id)!;
      itemData.records.push(record);
      itemData.operators.add(record.operator_id);
    });

    return Array.from(metricsMap.entries()).map(([itemId, data]) => {
      const records = data.records;
      const totalProduced = records.length;
      
      // Calculate time span
      const firstRecord = new Date(records[0].created_at);
      const lastRecord = new Date(records[records.length - 1].created_at);
      const hoursSpan = Math.max(1, differenceInHours(lastRecord, firstRecord));
      const daysActive = Math.max(1, hoursSpan / 24);

      return {
        itemId,
        productCode: data.productCode,
        productName: data.productName,
        totalProduced,
        averagePerDay: totalProduced / daysActive,
        operatorCount: data.operators.size,
        averageTimePerUnit: hoursSpan / totalProduced,
      };
    }).sort((a, b) => b.averagePerDay - a.averagePerDay);
  }, [productionRecords]);

  const overallStats = useMemo(() => {
    if (!productionRecords || productionRecords.length === 0) {
      return {
        totalProduced: 0,
        averagePerDay: 0,
        activeOperators: 0,
        uniqueItems: 0,
      };
    }

    const operators = new Set(productionRecords.map(r => r.operator_id));
    const items = new Set(productionRecords.map(r => r.item_id));
    const totalProduced = productionRecords.length;

    return {
      totalProduced,
      averagePerDay: totalProduced / daysToAnalyze,
      activeOperators: operators.size,
      uniqueItems: items.size,
    };
  }, [productionRecords, daysToAnalyze]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Produced</p>
                <p className="text-2xl font-bold">{overallStats.totalProduced}</p>
                <p className="text-xs text-muted-foreground">Last {daysToAnalyze} days</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Per Day</p>
                <p className="text-2xl font-bold">{overallStats.averagePerDay.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">units/day</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Operators</p>
                <p className="text-2xl font-bold">{overallStats.activeOperators}</p>
                <p className="text-xs text-muted-foreground">producing items</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Item Types</p>
                <p className="text-2xl font-bold">{overallStats.uniqueItems}</p>
                <p className="text-xs text-muted-foreground">in production</p>
              </div>
              <Award className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Production Efficiency Metrics
          </CardTitle>
          <CardDescription>
            Performance analysis for the last {daysToAnalyze} days - used for order completion forecasting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="operators" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="operators">
                <Users className="h-4 w-4 mr-2" />
                By Operator
              </TabsTrigger>
              <TabsTrigger value="items">
                <Package className="h-4 w-4 mr-2" />
                By Item Type
              </TabsTrigger>
            </TabsList>

            <TabsContent value="operators" className="space-y-4">
              <div className="space-y-3">
                {operatorMetrics.map((metric, index) => (
                  <div
                    key={metric.operatorId}
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={index === 0 ? "default" : "outline"} className="h-8 w-8 rounded-full flex items-center justify-center">
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-semibold">{metric.operatorName}</p>
                          {metric.employeeCode && (
                            <p className="text-sm text-muted-foreground">Code: {metric.employeeCode}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <Award className="h-3 w-3" />
                        {metric.efficiency.toFixed(2)} items/hour
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Produced</p>
                        <p className="font-semibold text-lg">{metric.totalProduced} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Daily Average</p>
                        <p className="font-semibold text-lg">{metric.averagePerDay.toFixed(1)} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hourly Rate</p>
                        <p className="font-semibold text-lg">{metric.averagePerHour.toFixed(2)} units</p>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Active for {metric.activeHours.toFixed(0)} hours in the analysis period
                    </div>
                  </div>
                ))}

                {operatorMetrics.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No production data available for the selected period
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="items" className="space-y-4">
              <div className="space-y-3">
                {itemMetrics.map((metric, index) => (
                  <div
                    key={metric.itemId}
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={index === 0 ? "default" : "outline"} className="h-8 w-8 rounded-full flex items-center justify-center">
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-semibold">{metric.productCode} - {metric.productName}</p>
                          <p className="text-sm text-muted-foreground">{metric.operatorCount} operator(s) producing</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {metric.averageTimePerUnit.toFixed(2)} hrs/unit
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Produced</p>
                        <p className="font-semibold text-lg">{metric.totalProduced} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Daily Average</p>
                        <p className="font-semibold text-lg">{metric.averagePerDay.toFixed(1)} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Est. Completion</p>
                        <p className="font-semibold text-lg">
                          {(24 / metric.averageTimePerUnit).toFixed(1)} units/day
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 p-2 bg-primary/5 rounded text-xs">
                      <p className="text-muted-foreground">
                        <strong>Forecast:</strong> For every 100 units of this item, expect completion in approximately{' '}
                        <strong className="text-foreground">{(100 * metric.averageTimePerUnit / 24).toFixed(1)} days</strong>
                        {' '}with {metric.operatorCount} operator(s)
                      </p>
                    </div>
                  </div>
                ))}

                {itemMetrics.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No production data available for the selected period
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};