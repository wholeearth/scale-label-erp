import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Package, UserCheck, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import CustomerDialog from './CustomerDialog';
import CustomerProductsDialog from './CustomerProductsDialog';
import type { Tables } from '@/integrations/supabase/types';

type Customer = Tables<'customers'>;

const CustomerManagement = () => {
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [productsCustomerId, setProductsCustomerId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Customer deleted',
        description: 'The customer has been successfully deleted.',
      });
      setDeletingCustomerId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Customer Management
            </CardTitle>
            <CardDescription>
              Manage customer product assignments and details. Create new customers in the Users tab.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading customers...</div>
          ) : customers && customers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Contact Email</TableHead>
                    <TableHead>Contact Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.customer_name}</TableCell>
                      <TableCell>{customer.contact_email || '-'}</TableCell>
                      <TableCell>{customer.contact_phone || '-'}</TableCell>
                      <TableCell>{customer.address || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductsCustomerId(customer.id)}
                            title="Manage Products"
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingCustomer(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeletingCustomerId(customer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-medium">No customers found</p>
                <p className="text-sm">Create customers with the "customer" role in the Users tab</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDialog
        open={!!editingCustomer}
        onOpenChange={(open) => !open && setEditingCustomer(null)}
        customer={editingCustomer}
      />

      <CustomerProductsDialog
        open={!!productsCustomerId}
        onOpenChange={(open) => !open && setProductsCustomerId(null)}
        customerId={productsCustomerId}
      />

      <AlertDialog open={!!deletingCustomerId} onOpenChange={(open) => !open && setDeletingCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingCustomerId && deleteMutation.mutate(deletingCustomerId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CustomerManagement;
