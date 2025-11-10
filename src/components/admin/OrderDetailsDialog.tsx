import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

const OrderDetailsDialog = ({ open, onOpenChange, orderId }: OrderDetailsDialogProps) => {
  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers(customer_name, contact_email, contact_phone),
          order_items(
            id,
            quantity,
            unit_price,
            produced_quantity,
            items(product_code, product_name, color, length_yards, width_inches)
          )
        `)
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details - {order.order_number}</DialogTitle>
          <DialogDescription>
            Complete order information and production status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Customer Information</h3>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {order.customers?.customer_name}</p>
                <p><span className="text-muted-foreground">Email:</span> {order.customers?.contact_email || '-'}</p>
                <p><span className="text-muted-foreground">Phone:</span> {order.customers?.contact_phone || '-'}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Order Information</h3>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Status:</span> {' '}
                  <Badge variant={order.status === 'approved' ? 'default' : 'secondary'}>
                    {order.status}
                  </Badge>
                </p>
                <p><span className="text-muted-foreground">Total Amount:</span> ${order.total_amount?.toFixed(2) || '0.00'}</p>
                <p><span className="text-muted-foreground">Created:</span> {new Date(order.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Order Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Specifications</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Produced</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.order_items?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.items?.product_code}</TableCell>
                    <TableCell>{item.items?.product_name}</TableCell>
                    <TableCell className="text-sm">
                      {item.items?.color && <div>Color: {item.items.color}</div>}
                      {item.items?.length_yards && <div>Length: {item.items.length_yards} yds</div>}
                      {item.items?.width_inches && <div>Width: {item.items.width_inches} in</div>}
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.produced_quantity || 0}</TableCell>
                    <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                    <TableCell>${(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
