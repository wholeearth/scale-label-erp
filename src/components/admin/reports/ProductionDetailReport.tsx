import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { FileText, Download, Search, Filter, Loader2 } from 'lucide-react';

interface ProductionRecord {
  id: string;
  serial_number: string;
  production_date: string;
  production_time: string;
  weight_kg: number;
  length_yards: number | null;
  created_at: string;
  item: {
    product_name: string;
    product_code: string;
  };
  operator: {
    full_name: string;
    employee_code: string | null;
  };
  machine: {
    machine_name: string;
    machine_code: string;
  } | null;
}

const ProductionDetailReport = () => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [searchSerial, setSearchSerial] = useState('');

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

  // Fetch machines for filter
  const { data: machines } = useQuery({
    queryKey: ['machines-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('machines').select('*').order('machine_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch items for filter
  const { data: items } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('id, product_name, product_code').order('product_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch production records
  const { data: productionRecords, isLoading, refetch } = useQuery({
    queryKey: ['production-detail-report', startDate, endDate, selectedOperator, selectedMachine, selectedItem, searchSerial],
    queryFn: async () => {
      let query = supabase
        .from('production_records')
        .select(`
          id,
          serial_number,
          production_date,
          production_time,
          weight_kg,
          length_yards,
          created_at,
          item:items(product_name, product_code),
          operator:profiles!production_records_operator_id_fkey(full_name, employee_code),
          machine:machines(machine_name, machine_code)
        `)
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .order('production_date', { ascending: false })
        .order('production_time', { ascending: false });

      if (selectedOperator !== 'all') {
        query = query.eq('operator_id', selectedOperator);
      }
      if (selectedMachine !== 'all') {
        query = query.eq('machine_id', selectedMachine);
      }
      if (selectedItem !== 'all') {
        query = query.eq('item_id', selectedItem);
      }
      if (searchSerial) {
        query = query.ilike('serial_number', `%${searchSerial}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductionRecord[];
    },
  });

  // Calculate production time (time between consecutive records for same operator)
  const getProductionTimeMinutes = (record: ProductionRecord, index: number) => {
    if (!productionRecords || index === productionRecords.length - 1) return null;
    
    const currentDateTime = parseISO(`${record.production_date}T${record.production_time}`);
    const nextRecord = productionRecords[index + 1];
    
    if (nextRecord.operator.full_name !== record.operator.full_name) return null;
    
    const nextDateTime = parseISO(`${nextRecord.production_date}T${nextRecord.production_time}`);
    const diff = differenceInMinutes(currentDateTime, nextDateTime);
    
    return diff > 0 && diff < 480 ? diff : null; // Only show if less than 8 hours
  };

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const exportToCSV = () => {
    if (!productionRecords) return;
    
    const headers = ['Serial Number', 'Date', 'Time', 'Item', 'Operator', 'Machine', 'Weight (kg)', 'Length (yards)', 'Production Time'];
    const rows = productionRecords.map((record, index) => [
      record.serial_number,
      format(parseISO(record.production_date), 'dd/MM/yyyy'),
      record.production_time,
      `${record.item.product_code} - ${record.item.product_name}`,
      `${record.operator.full_name} (${record.operator.employee_code || 'N/A'})`,
      record.machine ? record.machine.machine_name : 'N/A',
      record.weight_kg.toFixed(2),
      record.length_yards?.toFixed(2) || 'N/A',
      formatTime(getProductionTimeMinutes(record, index)),
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-detail-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const totalWeight = productionRecords?.reduce((sum, r) => sum + r.weight_kg, 0) || 0;
  const totalLength = productionRecords?.reduce((sum, r) => sum + (r.length_yards || 0), 0) || 0;
  const totalCount = productionRecords?.length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Production Detail Report
            </CardTitle>
            <CardDescription>Serial-by-serial production records with timing and machine details</CardDescription>
          </div>
          <Button onClick={exportToCSV} disabled={!productionRecords?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg">
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
            <Label>Machine</Label>
            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
              <SelectTrigger>
                <SelectValue placeholder="All Machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Machines</SelectItem>
                {machines?.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.machine_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="All Items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.product_code} - {item.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Search Serial</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Serial..."
                value={searchSerial}
                onChange={(e) => setSearchSerial(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-primary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">{totalCount}</p>
            <p className="text-sm text-muted-foreground">Total Units</p>
          </div>
          <div className="p-4 bg-success/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-success">{totalWeight.toFixed(2)} kg</p>
            <p className="text-sm text-muted-foreground">Total Weight</p>
          </div>
          <div className="p-4 bg-info/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-info">{totalLength.toFixed(2)} yds</p>
            <p className="text-sm text-muted-foreground">Total Length</p>
          </div>
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-md border max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Length (yds)</TableHead>
                  <TableHead className="text-right">Prod. Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionRecords?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No production records found for the selected criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  productionRecords?.map((record, index) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-sm">{record.serial_number}</TableCell>
                      <TableCell>{format(parseISO(record.production_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{record.production_time}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.item.product_code}</p>
                          <p className="text-xs text-muted-foreground">{record.item.product_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.operator.full_name}</p>
                          <p className="text-xs text-muted-foreground">{record.operator.employee_code || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.machine ? (
                          <Badge variant="outline">{record.machine.machine_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{record.weight_kg.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{record.length_yards?.toFixed(2) || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatTime(getProductionTimeMinutes(record, index))}
                      </TableCell>
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

export default ProductionDetailReport;
