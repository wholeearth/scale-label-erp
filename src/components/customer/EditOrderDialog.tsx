import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const orderItemSchema = z.object({
  item_id: z.string().min(1, 'Product is required'),
  quantity: z.string().min(1, 'Quantity is required'),
  unit_price: z.string().min(1, 'Price is required'),
});

type OrderItemFormData = z.infer<typeof orderItemSchema>;

interface OrderItem {
  id?: string;
  item_id: string;
  quantity: number;
  unit_price: number;
}

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export const EditOrderDialog = ({ open, onOpenChange, orderId }: EditOrderDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const { data: customerProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['customer-products-for-order', user?.id],
    queryFn: async () => {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!customer) throw new Error('Customer not found');

      const { data, error } = await supabase
        .from('customer_products')
        .select('*, items(id, product_code, product_name, color)')
        .eq('customer_id', customer.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  const { data: existingOrder } = useQuery({
    queryKey: ['order-details', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_items (
            id,
            item_id,
            quantity,
            unit_price
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId && open,
  });

  useEffect(() => {
    if (existingOrder?.order_items) {
      setOrderItems(existingOrder.order_items as OrderItem[]);
    }
  }, [existingOrder]);

  const form = useForm<OrderItemFormData>({
    resolver: zodResolver(orderItemSchema),
    defaultValues: {
      item_id: '',
      quantity: '',
      unit_price: '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('No order ID');

      // Get existing order items
      const { data: existing } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId);

      const existingIds = existing?.map(item => item.id) || [];
      const currentIds = orderItems.filter(item => item.id).map(item => item.id);

      // Delete removed items
      const toDelete = existingIds.filter(id => !currentIds.includes(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('order_items')
          .delete()
          .in('id', toDelete);
        if (error) throw error;
      }

      // Update existing items and insert new ones
      for (const item of orderItems) {
        if (item.id) {
          const { error } = await supabase
            .from('order_items')
            .update({
              item_id: item.item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
            })
            .eq('id', item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('order_items')
            .insert({
              order_id: orderId,
              item_id: item.item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
            });
          if (error) throw error;
        }
      }

      // Update order total and reset status to pending
      const total = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const { error } = await supabase
        .from('orders')
        .update({ 
          total_amount: total,
          status: 'pending'
        })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      toast({
        title: 'Order updated',
        description: 'Your order has been successfully updated.',
      });
      onOpenChange(false);
      setOrderItems([]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addItem = (data: OrderItemFormData) => {
    setOrderItems([...orderItems, {
      item_id: data.item_id,
      quantity: parseFloat(data.quantity),
      unit_price: parseFloat(data.unit_price),
    }]);
    form.reset();
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const getProductById = (id: string) => {
    return customerProducts?.find(cp => cp.item_id === id);
  };

  const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
          <DialogDescription>
            Modify order items and quantities. Edited orders will require admin approval again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Order Items */}
          {orderItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Order Items</h3>
              {orderItems.map((item, index) => {
                const product = getProductById(item.item_id);
                return (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {product?.items?.product_code} - {product?.items?.product_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Quantity: {item.quantity} × ${item.unit_price.toFixed(2)} = ${(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">Total:</span>
                <span className="text-xl font-bold">${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Add Item Form */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Add Item</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(addItem)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="item_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const selectedProduct = customerProducts?.find(p => p.item_id === value);
                          if (selectedProduct) {
                            form.setValue('unit_price', selectedProduct.price.toString());
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a product" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customerProducts?.map((product) => (
                            <SelectItem key={product.item_id} value={product.item_id}>
                              {product.items.product_code} - {product.items.product_name}
                              {product.items.color && ` (${product.items.color})`} - ${parseFloat(String(product.price)).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" min="1" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Select product first"
                            {...field}
                            disabled
                            className="bg-muted"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </form>
            </Form>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || orderItems.length === 0}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};