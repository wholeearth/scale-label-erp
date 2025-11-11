import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export const AgentReports = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: agent } = useQuery({
    queryKey: ['commission-agent', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agents')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['agent-report', agent?.id, startDate, endDate],
    queryFn: async () => {
      if (!agent || !startDate || !endDate) return null;
      
      const { data, error } = await supabase
        .from('commission_transactions')
        .select('*')
        .eq('agent_id', agent.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: false,
  });

  const summary = report?.reduce(
    (acc, txn) => {
      if (txn.transaction_type === 'commission_earned') {
        acc.commissionEarned += Number(txn.amount);
      } else if (txn.transaction_type === 'commission_paid') {
        acc.commissionPaid += Number(txn.amount);
      } else if (txn.transaction_type === 'receipt_collected') {
        acc.receiptsCollected += Number(txn.amount);
      }
      return acc;
    },
    { commissionEarned: 0, commissionPaid: 0, receiptsCollected: 0 }
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom Date Range Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} disabled={!startDate || !endDate}>
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Commission Earned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary?.commissionEarned.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Commission Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary?.commissionPaid.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Receipts Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary?.receiptsCollected.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{format(new Date(txn.transaction_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="capitalize">{txn.transaction_type.replace('_', ' ')}</TableCell>
                      <TableCell>{txn.description}</TableCell>
                      <TableCell>{txn.reference_number}</TableCell>
                      <TableCell className="text-right">₹{Number(txn.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
