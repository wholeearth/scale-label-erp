import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';

export const Statements = () => {
  const { user } = useAuth();

  const { data: orderSummary, isLoading } = useQuery({
    queryKey: ['customer-statements', user?.id],
    queryFn: async () => {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, customer_name')
        .eq('user_id', user?.id)
        .single();

      if (!customer) throw new Error('Customer not found');

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalSpent = orders.reduce(
        (sum, order) => sum + parseFloat(String(order.total_amount)), 
        0
      );
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const completedOrders = orders.filter(o => o.status === 'completed').length;

      return {
        customerName: customer.customer_name,
        totalOrders: orders.length,
        totalSpent,
        pendingOrders,
        completedOrders,
        orders,
      };
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderSummary?.totalOrders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${orderSummary?.totalSpent.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderSummary?.pendingOrders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderSummary?.completedOrders || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Order History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Order History
          </CardTitle>
          <CardDescription>Complete list of all your orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orderSummary?.orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div>
                  <div className="font-medium">{order.order_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()} • {order.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    ${parseFloat(String(order.total_amount)).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}

            {orderSummary?.orders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No orders yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
