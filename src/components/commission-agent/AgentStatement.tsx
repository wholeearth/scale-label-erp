import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export const AgentStatement = () => {
  const { user } = useAuth();

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

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['agent-transactions', agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      
      const { data, error } = await supabase
        .from('commission_transactions')
        .select('*')
        .eq('agent_id', agent.id)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!agent,
  });

  const { data: receiptsAccount } = useQuery({
    queryKey: ['agent-receipts-account', agent?.id],
    queryFn: async () => {
      if (!agent) return null;
      
      const { data, error } = await supabase
        .from('commission_agent_receipts_account')
        .select('*')
        .eq('agent_id', agent.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!agent,
  });

  const summary = transactions?.reduce(
    (acc, txn) => {
      if (txn.transaction_type === 'commission_earned') {
        acc.commissionIncurred += Number(txn.amount);
      } else if (txn.transaction_type === 'commission_paid') {
        acc.commissionPaid += Number(txn.amount);
      } else if (txn.transaction_type === 'receipt_collected') {
        acc.receiptsCollected += Number(txn.amount);
      } else if (txn.transaction_type === 'receipt_paid') {
        acc.receiptsPaid += Number(txn.amount);
      }
      return acc;
    },
    { commissionIncurred: 0, commissionPaid: 0, receiptsCollected: 0, receiptsPaid: 0 }
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Commission Incurred</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{summary?.commissionIncurred.toFixed(2)}</div>
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
            <CardTitle className="text-sm font-medium">Commission Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{((summary?.commissionIncurred || 0) - (summary?.commissionPaid || 0)).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Money Held</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Number(receiptsAccount?.current_balance || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
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
              {transactions?.map((txn) => (
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
    </div>
  );
};
