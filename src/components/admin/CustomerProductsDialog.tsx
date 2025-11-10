import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CustomerProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
}

const CustomerProductsDialog = ({ open, onOpenChange, customerId }: CustomerProductsDialogProps) => {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [price, setPrice] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('product_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: customerProducts } = useQuery({
    queryKey: ['customer-products', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_products')
        .select('*, items(product_code, product_name)')
        .eq('customer_id', customerId);
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!customerId || !selectedItemId || !price) {
        throw new Error('Please select an item and enter a price');
      }

      const { error } = await supabase.from('customer_products').insert([{
        customer_id: customerId,
        item_id: selectedItemId,
        price: parseFloat(price),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-products', customerId] });
      toast({
        title: 'Product assigned',
        description: 'The product has been successfully assigned to the customer.',
      });
      setSelectedItemId('');
      setPrice('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-products', customerId] });
      toast({
        title: 'Product removed',
        description: 'The product has been removed from the customer.',
      });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Products - {customer?.customer_name}</DialogTitle>
          <DialogDescription>
            Assign products with custom prices to this customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Assign New Product</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.product_code} - {item.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Assigned Products</h3>
            {customerProducts && customerProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerProducts.map((cp: any) => (
                    <TableRow key={cp.id}>
                      <TableCell className="font-medium">{cp.items?.product_code}</TableCell>
                      <TableCell>{cp.items?.product_name}</TableCell>
                      <TableCell>${cp.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(cp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No products assigned to this customer yet.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerProductsDialog;
