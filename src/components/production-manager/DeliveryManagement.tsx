import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Truck, Plus, CheckCircle2 } from 'lucide-react';

type Line = {
  order_item_id: string;
  item_id: string;
  product_name: string;
  ordered: number;
  produced: number;
  unit_price: number;
  deliver_qty: number;
};

export const DeliveryManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [lines, setLines] = useState<Line[]>([]);

  const { data: deliveries } = useQuery({
    queryKey: ['deliveries-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, customers(customer_name), orders(order_number)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverableOrders } = useQuery({
    queryKey: ['deliverable-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, customer_id, customers(customer_name), order_items(id, item_id, quantity, produced_quantity, unit_price, items(product_name))')
        .in('status', ['approved', 'in_production', 'completed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((o: any) =>
        (o.order_items || []).some((oi: any) => Number(oi.produced_quantity || 0) > 0),
      );
    },
  });

  const selectedOrder = useMemo(
    () => (deliverableOrders || []).find((o: any) => o.id === orderId),
    [deliverableOrders, orderId],
  );

  const handleOrderChange = (val: string) => {
    setOrderId(val);
    const o = (deliverableOrders || []).find((x: any) => x.id === val);
    if (!o) {
      setLines([]);
      return;
    }
    setLines(
      (o.order_items || []).map((oi: any) => ({
        order_item_id: oi.id,
        item_id: oi.item_id,
        product_name: oi.items?.product_name || '',
        ordered: Number(oi.quantity),
        produced: Number(oi.produced_quantity || 0),
        unit_price: Number(oi.unit_price),
        deliver_qty: Number(oi.produced_quantity || 0),
      })),
    );
  };

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + l.deliver_qty * l.unit_price, 0),
    [lines],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('Select an order');
      const valid = lines.filter((l) => l.deliver_qty > 0);
      if (valid.length === 0) throw new Error('Add at least one delivery quantity');
      for (const l of valid) {
        if (l.deliver_qty > l.produced) throw new Error(`${l.product_name}: deliver qty exceeds produced`);
      }

      const { data: del, error } = await supabase
        .from('deliveries')
        .insert({
          customer_id: selectedOrder.customer_id,
          order_id: selectedOrder.id,
          status: 'draft',
          total_amount: totalAmount,
          created_by: user?.id,
          delivery_number: '',
        })
        .select()
        .single();
      if (error) throw error;

      const { error: liErr } = await supabase.from('delivery_items').insert(
        valid.map((l) => ({
          delivery_id: del.id,
          item_id: l.item_id,
          order_item_id: l.order_item_id,
          quantity: l.deliver_qty,
          unit_price: l.unit_price,
          total_price: l.deliver_qty * l.unit_price,
        })),
      );
      if (liErr) throw liErr;
      return del;
    },
    onSuccess: () => {
      toast({ title: 'Delivery created', description: 'Mark as delivered to auto-generate invoice.' });
      setOpen(false);
      setOrderId('');
      setLines([]);
      qc.invalidateQueries({ queryKey: ['deliveries-list'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deliverMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deliveries').update({ status: 'delivered' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Delivered', description: 'Draft invoice auto-created for the accountant.' });
      qc.invalidateQueries({ queryKey: ['deliveries-list'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" /> Deliveries</CardTitle>
            <CardDescription>Create delivery notes from produced stock; marking delivered auto-creates a draft invoice.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Delivery</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Create Delivery Note</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Select value={orderId} onValueChange={handleOrderChange}>
                    <SelectTrigger><SelectValue placeholder="Select an order with produced stock" /></SelectTrigger>
                    <SelectContent>
                      {(deliverableOrders || []).map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_number} — {o.customers?.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {lines.length > 0 && (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Produced</TableHead>
                          <TableHead className="text-right">Deliver</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((l, i) => (
                          <TableRow key={l.order_item_id}>
                            <TableCell>{l.product_name}</TableCell>
                            <TableCell className="text-right">{l.ordered}</TableCell>
                            <TableCell className="text-right">{l.produced}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max={l.produced}
                                className="w-24 ml-auto text-right"
                                value={l.deliver_qty}
                                onChange={(e) => {
                                  const next = [...lines];
                                  next[i] = { ...l, deliver_qty: Math.max(0, parseFloat(e.target.value) || 0) };
                                  setLines(next);
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right">{(l.deliver_qty * l.unit_price).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-end p-3 border-t font-medium">
                      Total: {totalAmount.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !orderId}>
                  {createMutation.isPending ? 'Creating...' : 'Create Delivery'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DN #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(deliveries || []).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.delivery_number}</TableCell>
                  <TableCell>{d.delivery_date}</TableCell>
                  <TableCell>{d.customers?.customer_name}</TableCell>
                  <TableCell>{d.orders?.order_number}</TableCell>
                  <TableCell className="text-right">{Number(d.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === 'delivered' ? 'default' : d.status === 'cancelled' ? 'destructive' : 'outline'}>
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => deliverMutation.mutate(d.id)} disabled={deliverMutation.isPending}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Delivered
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!deliveries || deliveries.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No deliveries yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryManagement;
