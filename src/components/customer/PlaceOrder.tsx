import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';

const orderItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(10000, 'Quantity too large'),
});

const orderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Add at least one item to your order'),
});

interface OrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface AvailableItem {
  id: string;
  product_code: string;
  product_name: string;
  color: string | null;
  price: number;
}

export const PlaceOrder = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Fetch customer info
  const { data: customer } = useQuery({
    queryKey: ['customer-info', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch available items with pricing
  const { data: availableItems } = useQuery({
    queryKey: ['customer-products', customer?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_products')
        .select(`
          item_id,
          price,
          items (
            id,
            product_code,
            product_name,
            color
          )
        `)
        .eq('customer_id', customer?.id);

      if (error) throw error;

      return data.map(cp => ({
        id: cp.items.id,
        product_code: cp.items.product_code,
        product_name: cp.items.product_name,
        color: cp.items.color,
        price: parseFloat(String(cp.price)),
      })) as AvailableItem[];
    },
    enabled: !!customer?.id,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!customer?.id) throw new Error('Customer information not found');

      // Validate order
      const validation = orderSchema.safeParse({ items: orderItems });
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;
      
      // Calculate total
      const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customer.id,
          order_number: orderNumber,
          status: 'pending',
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(
          orderItems.map(item => ({
            order_id: order.id,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.price,
          }))
        );

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      toast({
        title: 'Order Placed Successfully',
        description: 'Your order has been submitted for approval.',
      });
      setOrderItems([]);
      setSelectedItemId('');
      setQuantity(1);
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Order Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addItem = () => {
    if (!selectedItemId) {
      toast({
        title: 'Selection Required',
        description: 'Please select an item',
        variant: 'destructive',
      });
      return;
    }

    if (quantity < 1) {
      toast({
        title: 'Invalid Quantity',
        description: 'Quantity must be at least 1',
        variant: 'destructive',
      });
      return;
    }

    const selectedItem = availableItems?.find(item => item.id === selectedItemId);
    if (!selectedItem) return;

    const existingItem = orderItems.find(item => item.item_id === selectedItemId);
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.item_id === selectedItemId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        item_id: selectedItemId,
        quantity,
        price: selectedItem.price,
      }]);
    }

    setSelectedItemId('');
    setQuantity(1);
  };

  const removeItem = (itemId: string) => {
    setOrderItems(orderItems.filter(item => item.item_id !== itemId));
  };

  const getItemDetails = (itemId: string) => {
    return availableItems?.find(item => item.id === itemId);
  };

  const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Place New Order
          </CardTitle>
          <CardDescription>Select products and quantities for your order</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <Label>Select Product</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {availableItems?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.product_code} - {item.product_name}
                      {item.color && ` (${item.color})`} - ${item.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
                <Button onClick={addItem} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {orderItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Order Items</h3>
              {orderItems.map((item) => {
                const details = getItemDetails(item.item_id);
                return (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {details?.product_code} - {details?.product_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity} units × ${item.price.toFixed(2)} = ${(item.quantity * item.price).toFixed(2)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.item_id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}

              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                <span className="font-semibold text-lg">Total Amount:</span>
                <span className="font-bold text-2xl">${totalAmount.toFixed(2)}</span>
              </div>

              <Button
                onClick={() => createOrderMutation.mutate()}
                disabled={createOrderMutation.isPending || orderItems.length === 0}
                className="w-full"
                size="lg"
              >
                {createOrderMutation.isPending ? 'Placing Order...' : 'Place Order'}
              </Button>
            </div>
          )}

          {orderItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Add items to your order to continue
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
