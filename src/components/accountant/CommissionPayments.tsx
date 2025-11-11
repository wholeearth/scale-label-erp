import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Receipt } from 'lucide-react';
import { format } from 'date-fns';

export const CommissionPayments = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  const { data: agents } = useQuery({
    queryKey: ['commission-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agents')
        .select('*')
        .order('agent_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: agentBalance } = useQuery({
    queryKey: ['agent-balance', agentId],
    queryFn: async () => {
      if (!agentId) return null;
      
      const { data, error } = await supabase
        .from('commission_transactions')
        .select('*')
        .eq('agent_id', agentId);
      
      if (error) throw error;
      
      const balance = data.reduce((acc, txn) => {
        if (txn.transaction_type === 'commission_earned') {
          return acc + Number(txn.amount);
        } else if (txn.transaction_type === 'commission_paid') {
          return acc - Number(txn.amount);
        }
        return acc;
      }, 0);
      
      return balance;
    },
    enabled: !!agentId,
  });

  const { data: recentPayments, isLoading } = useQuery({
    queryKey: ['commission-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_transactions')
        .select('*, commission_agents(agent_name, agent_code)')
        .eq('transaction_type', 'commission_paid')
        .order('transaction_date', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('commission_transactions')
        .insert({
          agent_id: agentId,
          transaction_type: 'commission_paid',
          amount: Number(amount),
          description: `Commission payment - ${paymentMethod}${notes ? ': ' + notes : ''}`,
          transaction_date: paymentDate,
          reference_type: 'commission_payment',
          reference_number: `CP-${Date.now()}`,
          created_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Payment recorded',
        description: 'Commission payment has been successfully recorded.',
      });
      queryClient.invalidateQueries({ queryKey: ['commission-payments'] });
      queryClient.invalidateQueries({ queryKey: ['agent-balance'] });
      queryClient.invalidateQueries({ queryKey: ['agent-transactions'] });
      setAgentId('');
      setAmount('');
      setPaymentMethod('');
      setNotes('');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Record Commission Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <Label>Commission Agent *</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.agent_name} ({agent.agent_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agentBalance !== null && agentBalance !== undefined && (
                <p className="text-sm text-muted-foreground mt-1">
                  Outstanding Balance: ₹{agentBalance.toFixed(2)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment reference, cheque number, etc."
              />
            </div>

            <Button
              onClick={() => paymentMutation.mutate()}
              disabled={!agentId || !amount || !paymentMethod || paymentMutation.isPending}
            >
              {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Receipt className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(new Date(payment.transaction_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {payment.commission_agents?.agent_name} ({payment.commission_agents?.agent_code})
                    </TableCell>
                    <TableCell>{payment.reference_number}</TableCell>
                    <TableCell>{payment.description}</TableCell>
                    <TableCell className="text-right">₹{Number(payment.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
