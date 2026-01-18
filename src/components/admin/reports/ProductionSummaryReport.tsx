import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { BarChart3, Download, Loader2, Users } from 'lucide-react';

interface ProductionRecord {
  id: string;
  production_date: string;
  production_time: string;
  weight_kg: number;
  length_yards: number | null;
  created_at: string;
  operator_id: string;
  item_id: string;
  item: {
    product_name: string;
    product_code: string;
  };
  operator: {
    full_name: string;
    employee_code: string | null;
  };
}

interface OperatorSummary {
  operatorId: string;
  operatorName: string;
  employeeCode: string | null;
  items: {
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    totalWeight: number;
    totalLength: number;
  }[];
  totalQuantity: number;
  totalWeight: number;
  totalLength: number;
  avgTimePerUnit: number | null;
}

const ProductionSummaryReport = () => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'operator' | 'item'>('operator');

  // Fetch operators for filter
  const { data: operators } = useQuery({
    queryKey: ['operators-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, full_name, employee_code)')
        .eq('role', 'operator');
      if (error) throw error;
      return data;
    },
  });

  // Fetch production records
  const { data: productionRecords, isLoading } = useQuery({
    queryKey: ['production-summary-report', startDate, endDate, selectedOperator],
    queryFn: async () => {
      let query = supabase
        .from('production_records')
        .select(`
          id,
          production_date,
          production_time,
          weight_kg,
          length_yards,
          created_at,
          operator_id,
          item_id,
          item:items(product_name, product_code),
          operator:profiles!production_records_operator_id_fkey(full_name, employee_code)
        `)
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .order('operator_id')
        .order('production_date')
        .order('production_time');

      if (selectedOperator !== 'all') {
        query = query.eq('operator_id', selectedOperator);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductionRecord[];
    },
  });

  // Calculate operator summaries
  const operatorSummaries = useMemo(() => {
    if (!productionRecords) return [];

    const summaryMap = new Map<string, OperatorSummary>();

    productionRecords.forEach((record, index) => {
      const opId = record.operator_id;
      
      if (!summaryMap.has(opId)) {
        summaryMap.set(opId, {
          operatorId: opId,
          operatorName: record.operator.full_name,
          employeeCode: record.operator.employee_code,
          items: [],
          totalQuantity: 0,
          totalWeight: 0,
          totalLength: 0,
          avgTimePerUnit: null,
        });
      }

      const summary = summaryMap.get(opId)!;
      
      // Update items
      let itemSummary = summary.items.find(i => i.itemId === record.item_id);
      if (!itemSummary) {
        itemSummary = {
          itemId: record.item_id,
          itemCode: record.item.product_code,
          itemName: record.item.product_name,
          quantity: 0,
          totalWeight: 0,
          totalLength: 0,
        };
        summary.items.push(itemSummary);
      }

      itemSummary.quantity += 1;
      itemSummary.totalWeight += record.weight_kg;
      itemSummary.totalLength += record.length_yards || 0;

      summary.totalQuantity += 1;
      summary.totalWeight += record.weight_kg;
      summary.totalLength += record.length_yards || 0;
    });

    // Calculate average time per unit for each operator
    summaryMap.forEach((summary, opId) => {
      const operatorRecords = productionRecords.filter(r => r.operator_id === opId);
      if (operatorRecords.length > 1) {
        let totalTime = 0;
        let validPairs = 0;
        
        for (let i = 0; i < operatorRecords.length - 1; i++) {
          const current = parseISO(`${operatorRecords[i].production_date}T${operatorRecords[i].production_time}`);
          const next = parseISO(`${operatorRecords[i + 1].production_date}T${operatorRecords[i + 1].production_time}`);
          const diff = differenceInMinutes(next, current);
          
          if (diff > 0 && diff < 480) { // Only count if less than 8 hours
            totalTime += diff;
            validPairs++;
          }
        }
        
        if (validPairs > 0) {
          summary.avgTimePerUnit = totalTime / validPairs;
        }
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [productionRecords]);

  // Calculate item summaries for the alternate view
  const itemSummaries = useMemo(() => {
    if (!productionRecords) return [];

    const itemMap = new Map<string, {
      itemId: string;
      itemCode: string;
      itemName: string;
      quantity: number;
      totalWeight: number;
      totalLength: number;
      operators: Set<string>;
    }>();

    productionRecords.forEach(record => {
      const key = record.item_id;
      
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemId: record.item_id,
          itemCode: record.item.product_code,
          itemName: record.item.product_name,
          quantity: 0,
          totalWeight: 0,
          totalLength: 0,
          operators: new Set(),
        });
      }

      const summary = itemMap.get(key)!;
      summary.quantity += 1;
      summary.totalWeight += record.weight_kg;
      summary.totalLength += record.length_yards || 0;
      summary.operators.add(record.operator.full_name);
    });

    return Array.from(itemMap.values())
      .map(item => ({ ...item, operatorCount: item.operators.size }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [productionRecords]);

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  };

  const exportToCSV = () => {
    if (groupBy === 'operator') {
      const rows: string[][] = [];
      operatorSummaries.forEach(summary => {
        summary.items.forEach(item => {
          rows.push([
            summary.operatorName,
            summary.employeeCode || 'N/A',
            item.itemCode,
            item.itemName,
            item.quantity.toString(),
            item.totalWeight.toFixed(2),
            item.totalLength.toFixed(2),
          ]);
        });
      });
      
      const headers = ['Operator', 'Employee Code', 'Item Code', 'Item Name', 'Quantity', 'Weight (kg)', 'Length (yds)'];
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production-summary-operator-${startDate}-to-${endDate}.csv`;
      a.click();
    } else {
      const headers = ['Item Code', 'Item Name', 'Quantity', 'Weight (kg)', 'Length (yds)', 'Operators'];
      const rows = itemSummaries.map(item => [
        item.itemCode,
        item.itemName,
        item.quantity.toString(),
        item.totalWeight.toFixed(2),
        item.totalLength.toFixed(2),
        item.operatorCount.toString(),
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production-summary-item-${startDate}-to-${endDate}.csv`;
      a.click();
    }
  };

  const grandTotalQuantity = operatorSummaries.reduce((sum, s) => sum + s.totalQuantity, 0);
  const grandTotalWeight = operatorSummaries.reduce((sum, s) => sum + s.totalWeight, 0);
  const grandTotalLength = operatorSummaries.reduce((sum, s) => sum + s.totalLength, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Production Summary Report
            </CardTitle>
            <CardDescription>Operator-wise and item-wise production summary</CardDescription>
          </div>
          <Button onClick={exportToCSV} disabled={!productionRecords?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Operator</Label>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger>
                <SelectValue placeholder="All Operators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operators</SelectItem>
                {operators?.map((op: any) => (
                  <SelectItem key={op.profiles.id} value={op.profiles.id}>
                    {op.profiles.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Group By</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'operator' | 'item')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="item">Item</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-primary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">{operatorSummaries.length}</p>
            <p className="text-sm text-muted-foreground">Operators</p>
          </div>
          <div className="p-4 bg-secondary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-secondary-foreground">{grandTotalQuantity}</p>
            <p className="text-sm text-muted-foreground">Total Units</p>
          </div>
          <div className="p-4 bg-success/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-success">{grandTotalWeight.toFixed(2)} kg</p>
            <p className="text-sm text-muted-foreground">Total Weight</p>
          </div>
          <div className="p-4 bg-info/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-info">{grandTotalLength.toFixed(2)} yds</p>
            <p className="text-sm text-muted-foreground">Total Length</p>
          </div>
        </div>

        {/* Data Tables */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groupBy === 'operator' ? (
          <div className="space-y-4">
            {operatorSummaries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No production records found for the selected criteria
              </div>
            ) : (
              operatorSummaries.map(summary => (
                <Card key={summary.operatorId} className="border-l-4 border-l-primary">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{summary.operatorName}</span>
                        <span className="text-xs text-muted-foreground">({summary.employeeCode || 'N/A'})</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span><strong>{summary.totalQuantity}</strong> units</span>
                        <span><strong>{summary.totalWeight.toFixed(2)}</strong> kg</span>
                        <span>Avg: <strong>{formatTime(summary.avgTimePerUnit)}</strong>/unit</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Weight (kg)</TableHead>
                          <TableHead className="text-right">Length (yds)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.items.map(item => (
                          <TableRow key={item.itemId}>
                            <TableCell className="font-mono">{item.itemCode}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{item.totalWeight.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.totalLength.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Length (yds)</TableHead>
                  <TableHead className="text-right">Operators</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No production records found for the selected criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  itemSummaries.map(item => (
                    <TableRow key={item.itemId}>
                      <TableCell className="font-mono">{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.totalWeight.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.totalLength.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.operatorCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionSummaryReport;
