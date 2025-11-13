import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  const commissionTransactions = transactions?.filter(
    (txn) => txn.transaction_type === 'commission_earned' || txn.transaction_type === 'commission_paid'
  );

  const receiptTransactions = transactions?.filter(
    (txn) => txn.transaction_type === 'receipt_collected' || txn.transaction_type === 'receipt_paid'
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
      <Tabs defaultValue="commission" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="commission">Commission Statement</TabsTrigger>
          <TabsTrigger value="money">Money Collected</TabsTrigger>
        </TabsList>

        <TabsContent value="commission" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Commission Accrued</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ₹{summary?.commissionIncurred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Commission Received</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ₹{summary?.commissionPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Commission Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ₹{((summary?.commissionIncurred || 0) - (summary?.commissionPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Commission Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Order/Invoice No</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionTransactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No commission transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissionTransactions?.map((txn, index) => (
                      <TableRow key={txn.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{format(new Date(txn.transaction_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="capitalize">
                          {txn.transaction_type === 'commission_earned' ? 'Accrued' : 'Received'}
                        </TableCell>
                        <TableCell>{txn.reference_number || '-'}</TableCell>
                        <TableCell>{txn.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          ₹{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="money" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Received Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ₹{summary?.receiptsCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Deposited Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ₹{summary?.receiptsPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ₹{((summary?.receiptsCollected || 0) - (summary?.receiptsPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Money Collection History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptTransactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No receipt transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    receiptTransactions?.map((txn, index) => (
                      <TableRow key={txn.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{format(new Date(txn.transaction_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="capitalize">
                          {txn.transaction_type === 'receipt_collected' ? 'Received' : 'Deposited'}
                        </TableCell>
                        <TableCell>{txn.reference_number || '-'}</TableCell>
                        <TableCell className="text-right">
                          ₹{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                toast({
                                  title: 'Edit Transaction',
                                  description: 'Edit functionality to be implemented in the receipt collection interface',
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
