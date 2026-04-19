import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3 } from 'lucide-react';

export const MachinePerformanceReport = () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['machine-performance', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_machine_performance', { _from: from, _to: to });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Machine Performance</CardTitle>
        <CardDescription>Aggregated production per machine for the selected period.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Machine</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Total Produced</TableHead>
              <TableHead className="text-right">Shifts</TableHead>
              <TableHead className="text-right">Assignments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6">Loading...</TableCell></TableRow>}
            {(data || []).map((row: any) => (
              <TableRow key={row.machine_id}>
                <TableCell>{row.machine_name}</TableCell>
                <TableCell className="font-mono text-xs">{row.machine_code}</TableCell>
                <TableCell className="text-right font-medium">{Number(row.total_produced).toFixed(0)}</TableCell>
                <TableCell className="text-right">{row.shifts_count}</TableCell>
                <TableCell className="text-right">{row.assignments_count}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (!data || data.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data in this period</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MachinePerformanceReport;
