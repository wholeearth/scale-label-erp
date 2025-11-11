import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export const AgentReceiptCollection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);

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

  const { data: customers } = useQuery({
    queryKey: ['agent-customers', agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('commission_agent_id', agent.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!agent,
  });

  const collectReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error('Agent not found');

      // Create transaction
      const { error: txnError } = await supabase
        .from('commission_transactions')
        .insert({
          agent_id: agent.id,
          transaction_type: 'receipt_collected',
          amount: Number(amount),
          description: description || `Receipt from customer`,
          transaction_date: receiptDate,
          created_by: user?.id,
        });

      if (txnError) throw txnError;

      // Update agent receipt account balance
      const { data: account } = await supabase
        .from('commission_agent_receipts_account')
        .select('*')
        .eq('agent_id', agent.id)
        .single();

      if (account) {
        const { error: updateError } = await supabase
          .from('commission_agent_receipts_account')
          .update({ current_balance: Number(account.current_balance) + Number(amount) })
          .eq('agent_id', agent.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('commission_agent_receipts_account')
          .insert({
            agent_id: agent.id,
            current_balance: Number(amount),
          });
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Receipt collected successfully',
        description: 'The amount has been added to your account.',
      });
      queryClient.invalidateQueries({ queryKey: ['agent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['agent-receipts-account'] });
      setCustomerId('');
      setAmount('');
      setDescription('');
      setReceiptDate(new Date().toISOString().split('T')[0]);
    },
    onError: (error) => {
      toast({
        title: 'Error collecting receipt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!agent) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collect Receipt from Customer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.customer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Receipt Date</Label>
            <Input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          <Button
            onClick={() => collectReceiptMutation.mutate()}
            disabled={!customerId || !amount || collectReceiptMutation.isPending}
          >
            {collectReceiptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Collect Receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
