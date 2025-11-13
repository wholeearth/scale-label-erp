import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

export const AgentStatement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('commission_transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-transactions'] });
      toast({
        title: 'Success',
        description: 'Transaction deleted successfully',
      });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

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
            <div className="text-2xl font-bold">
              ₹{((summary?.receiptsCollected || 0) - (summary?.receiptsPaid || 0)).toFixed(2)}
            </div>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{format(new Date(txn.transaction_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="capitalize">{txn.transaction_type.replace('_', ' ')}</TableCell>
                  <TableCell>{txn.description}</TableCell>
                  <TableCell>{txn.reference_number || '-'}</TableCell>
                  <TableCell className="text-right">₹{Number(txn.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(txn.transaction_type === 'receipt_collected' || txn.transaction_type === 'receipt_paid') && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              toast({
                                title: 'Edit Feature',
                                description: 'Edit functionality will be implemented in the receipt collection interface',
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(txn.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this transaction. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
