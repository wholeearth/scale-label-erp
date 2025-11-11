import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface AgentPlaceOrderDialogProps {
  customerId: string;
  onClose: () => void;
}

interface OrderItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export const AgentPlaceOrderDialog = ({ customerId, onClose }: AgentPlaceOrderDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const { data: availableItems } = useQuery({
    queryKey: ['customer-products', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_products')
        .select('*, items(*)')
        .eq('customer_id', customerId);
      if (error) throw error;
      return data;
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderNumber = `ORD-${Date.now()}`;
      const totalAmount = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          order_number: orderNumber,
          total_amount: totalAmount,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const itemsToInsert = orderItems.map((item) => ({
        order_id: order.id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      toast({
        title: 'Order placed successfully',
        description: 'The order has been created and is pending approval.',
      });
      queryClient.invalidateQueries({ queryKey: ['agent-invoices'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error placing order',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addItem = () => {
    if (!selectedItemId) return;

    const item = availableItems?.find((p) => p.item_id === selectedItemId);
    if (!item) return;

    const existingIndex = orderItems.findIndex((oi) => oi.itemId === selectedItemId);
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += quantity;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, { itemId: selectedItemId, quantity, unitPrice: Number(item.price) }]);
    }

    setSelectedItemId('');
    setQuantity(1);
  };

  const removeItem = (itemId: string) => {
    setOrderItems(orderItems.filter((item) => item.itemId !== itemId));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Place Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Product</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {availableItems?.map((item) => (
                    <SelectItem key={item.id} value={item.item_id}>
                      {item.items?.product_name} - ₹{Number(item.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                <Button onClick={addItem} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {orderItems.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <h4 className="font-semibold">Order Items:</h4>
              {orderItems.map((item) => {
                const product = availableItems?.find((p) => p.item_id === item.itemId);
                return (
                  <div key={item.itemId} className="flex justify-between items-center">
                    <span>
                      {product?.items?.product_name} x {item.quantity} @ ₹{item.unitPrice.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                      <Button size="sm" variant="destructive" onClick={() => removeItem(item.itemId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-bold">
                  <span>Total:</span>
                  <span>
                    ₹
                    {orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => createOrderMutation.mutate()} disabled={orderItems.length === 0}>
              Place Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
