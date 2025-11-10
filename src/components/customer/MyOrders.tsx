import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
                <span className="font-semibold">Total Amount:</span>
                <span className="text-xl font-bold">
                  ${parseFloat(String(order.total_amount)).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

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
