import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { useState } from 'react';
import OrderDetailsDialog from './OrderDetailsDialog';

const OrderManagement = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers(customer_name),
          order_items(
            id,
            quantity,
            unit_price,
            items(product_code, product_name)
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: 'Order updated',
        description: 'The order status has been updated successfully.',
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'approved':
        return <Badge variant="default">Approved</Badge>;
      case 'in_production':
        return <Badge>In Production</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>Review and approve customer orders</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.customers?.customer_name}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>${order.total_amount?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{order.order_items?.length || 0} items</TableCell>
                      <TableCell>
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === 'pending' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ 
                                  orderId: order.id, 
                                  status: 'approved' 
                                })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ 
                                  orderId: order.id, 
                                  status: 'rejected' 
                                })}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No orders found.
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailsDialog
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
    </>
  );
};

export default OrderManagement;
