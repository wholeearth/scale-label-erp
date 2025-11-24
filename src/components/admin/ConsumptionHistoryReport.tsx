import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Search, 
  Download, 
  Filter,
  ArrowRight,
  Calendar,
  Weight,
  Ruler,
  User
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ConsumptionRecord {
  id: string;
  consumption_date: string;
  source_serial: string;
  source_product_name: string;
  source_product_code: string;
  source_operator: string;
  final_serial: string;
  final_product_name: string;
  final_product_code: string;
  final_operator: string;
  consumed_weight_kg: number | null;
  consumed_length_yards: number | null;
}

const ConsumptionHistoryReport = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'source' | 'final'>('all');

  const { data: consumptions, isLoading } = useQuery({
    queryKey: ['consumption-history'],
    queryFn: async () => {
      // Get all raw material consumption records with related data
      const { data, error } = await supabase
        .from('raw_material_consumption')
        .select(`
          id,
          consumed_serial_number,
          consumed_weight_kg,
          consumed_length_yards,
          created_at,
          production_record_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with source and final product details
      const enrichedData = await Promise.all(
        (data || []).map(async (consumption) => {
          // Get source production record (jumbo roll that was consumed)
          const { data: sourceRecord } = await supabase
            .from('production_records')
            .select(`
              serial_number,
              item_id,
              items!inner (
                product_name,
                product_code
              ),
              profiles!production_records_operator_id_fkey (
                full_name
              )
            `)
            .eq('serial_number', consumption.consumed_serial_number)
            .single();

          // Get final production record (product that consumed the jumbo roll)
          const { data: finalRecord } = await supabase
            .from('production_records')
            .select(`
              serial_number,
              production_date,
              item_id,
              items!inner (
                product_name,
                product_code
              ),
              profiles!production_records_operator_id_fkey (
                full_name
              )
            `)
            .eq('id', consumption.production_record_id)
            .single();

          return {
            id: consumption.id,
            consumption_date: finalRecord?.production_date || consumption.created_at,
            source_serial: consumption.consumed_serial_number,
            source_product_name: sourceRecord?.items?.product_name || 'Unknown',
            source_product_code: sourceRecord?.items?.product_code || 'N/A',
            source_operator: sourceRecord?.profiles?.full_name || 'Unknown',
            final_serial: finalRecord?.serial_number || 'N/A',
            final_product_name: finalRecord?.items?.product_name || 'Unknown',
            final_product_code: finalRecord?.items?.product_code || 'N/A',
            final_operator: finalRecord?.profiles?.full_name || 'Unknown',
            consumed_weight_kg: consumption.consumed_weight_kg,
            consumed_length_yards: consumption.consumed_length_yards,
          } as ConsumptionRecord;
        })
      );

      return enrichedData;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const filteredConsumptions = consumptions?.filter((record) => {
    const matchesSearch = 
      record.source_serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.final_serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.source_product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.final_product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.source_product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.final_product_code.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    // Can extend filtering logic if needed
    return matchesSearch;
  });

  const exportToCSV = () => {
    if (!filteredConsumptions || filteredConsumptions.length === 0) return;

    const headers = [
      'Consumption Date',
      'Source Serial',
      'Source Product',
      'Source Code',
      'Source Operator',
      'Final Serial',
      'Final Product',
      'Final Code',
      'Final Operator',
      'Weight Consumed (kg)',
      'Length Consumed (yards)',
    ];

    const rows = filteredConsumptions.map((record) => [
      new Date(record.consumption_date).toLocaleDateString(),
      record.source_serial,
      record.source_product_name,
      record.source_product_code,
      record.source_operator,
      record.final_serial,
      record.final_product_name,
      record.final_product_code,
      record.final_operator,
      record.consumed_weight_kg?.toFixed(2) || '-',
      record.consumed_length_yards?.toFixed(2) || '-',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumption-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Consumption History Report
          </CardTitle>
          <CardDescription>Loading consumption records...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Consumption History Report
        </CardTitle>
        <CardDescription>
          Full traceability of raw material consumption from jumbo rolls to final products
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by serial number, product name, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={exportToCSV} variant="outline" disabled={!filteredConsumptions?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {filteredConsumptions?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Total Consumption Records</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {filteredConsumptions
                    ?.reduce((sum, r) => sum + (r.consumed_weight_kg || 0), 0)
                    .toFixed(2) || 0}
                </p>
                <p className="text-sm text-muted-foreground">Total Weight Consumed (kg)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {new Set(filteredConsumptions?.map((r) => r.source_serial)).size || 0}
                </p>
                <p className="text-sm text-muted-foreground">Unique Jumbo Rolls Used</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Consumption Table */}
        {!filteredConsumptions || filteredConsumptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No consumption records found</p>
            <p className="text-sm mt-2">
              {searchTerm ? 'Try adjusting your search criteria' : 'Records will appear as materials are consumed in production'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Source (Consumed)</Badge>
                      </div>
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-semibold" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Final Product</Badge>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">Consumption</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Production Date
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground">Serial No.</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Product</TableHead>
                    <TableHead className="text-xs text-muted-foreground">
                      <User className="h-3 w-3 inline mr-1" />
                      Operator
                    </TableHead>
                    <TableHead></TableHead>
                    <TableHead className="text-xs text-muted-foreground">Serial No.</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Product</TableHead>
                    <TableHead className="text-xs text-muted-foreground">
                      <User className="h-3 w-3 inline mr-1" />
                      Operator
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConsumptions.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm">
                        {new Date(record.consumption_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{record.source_serial}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{record.source_product_name}</p>
                          <p className="text-xs text-muted-foreground">{record.source_product_code}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{record.source_operator}</TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{record.final_serial}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{record.final_product_name}</p>
                          <p className="text-xs text-muted-foreground">{record.final_product_code}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{record.final_operator}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {record.consumed_weight_kg && (
                            <div className="flex items-center gap-1 text-sm">
                              <Weight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{record.consumed_weight_kg.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">kg</span>
                            </div>
                          )}
                          {record.consumed_length_yards && (
                            <div className="flex items-center gap-1 text-sm">
                              <Ruler className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{record.consumed_length_yards.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">yds</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConsumptionHistoryReport;