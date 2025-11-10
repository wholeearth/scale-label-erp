import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EditOrderDialog } from './EditOrderDialog';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  produced_quantity: number;
  items: {
    product_code: string;
    product_name: string;
    color: string | null;
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

const statusConfig = {
  pending: { icon: Clock, color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Pending Approval' },
  approved: { icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200', label: 'Approved' },
  in_production: { icon: Package, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'In Production' },
  completed: { icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200', label: 'Completed' },
  rejected: { icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200', label: 'Rejected' },
};

export const MyOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['customer-orders', user?.id],
    queryFn: async () => {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!customer) throw new Error('Customer not found');

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          order_items (
            id,
            quantity,
            unit_price,
            produced_quantity,
            items (
              product_code,
              product_name,
              color
            )
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      toast({
        title: 'Order deleted',
        description: 'Your order has been successfully deleted.',
      });
      setDeletingOrderId(null);
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders?.map((order) => {
        const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
        const StatusIcon = statusInfo.icon;

        return (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{order.order_number}</CardTitle>
                  <CardDescription>
                    Placed on {new Date(order.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={statusInfo.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {item.items.product_code} - {item.items.product_name}
                      </div>
                      {item.items.color && (
                        <div className="text-sm text-muted-foreground">
                          Color: {item.items.color}
                        </div>
                      )}
                      {order.status === 'in_production' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Progress: {item.produced_quantity} / {item.quantity} units
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {item.quantity} units
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${parseFloat(String(item.unit_price)).toFixed(2)} each
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="text-xl font-bold">
                    ${parseFloat(String(order.total_amount)).toFixed(2)}
                  </span>
                </div>
                {order.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingOrderId(order.id)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeletingOrderId(order.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <EditOrderDialog
        open={!!editingOrderId}
        onOpenChange={(open) => !open && setEditingOrderId(null)}
        orderId={editingOrderId}
      />

      <AlertDialog open={!!deletingOrderId} onOpenChange={(open) => !open && setDeletingOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingOrderId && deleteMutation.mutate(deletingOrderId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {orders?.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" />
              No orders found. Place your first order!
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
