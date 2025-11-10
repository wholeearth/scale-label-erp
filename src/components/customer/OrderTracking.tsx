import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Package, CheckCircle, Clock } from 'lucide-react';

export const OrderTracking = () => {
  const { user } = useAuth();

  const { data: activeOrders, isLoading } = useQuery({
    queryKey: ['customer-active-orders', user?.id],
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
          created_at,
          order_items (
            id,
            quantity,
            produced_quantity,
            items (
              product_code,
              product_name,
              color
            )
          )
        `)
        .eq('customer_id', customer.id)
        .in('status', ['approved', 'in_production'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
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
      {activeOrders?.map((order) => {
        const totalItems = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
        const producedItems = order.order_items.reduce((sum, item) => sum + item.produced_quantity, 0);
        const progress = totalItems > 0 ? (producedItems / totalItems) * 100 : 0;

        return (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {order.order_number}
                  </CardTitle>
                  <CardDescription>
                    Order Date: {new Date(order.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant={order.status === 'in_production' ? 'default' : 'outline'}>
                  {order.status === 'approved' ? (
                    <>
                      <Clock className="h-3 w-3 mr-1" />
                      Awaiting Production
                    </>
                  ) : (
                    <>
                      <Package className="h-3 w-3 mr-1" />
                      In Production
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-semibold">
                    {producedItems} / {totalItems} units ({Math.round(progress)}%)
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Item Details</h4>
                {order.order_items.map((item) => {
                  const itemProgress = item.quantity > 0 
                    ? (item.produced_quantity / item.quantity) * 100 
                    : 0;

                  return (
                    <div key={item.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {item.items.product_code} - {item.items.product_name}
                          </div>
                          {item.items.color && (
                            <div className="text-xs text-muted-foreground">
                              Color: {item.items.color}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {item.produced_quantity} / {item.quantity}
                          </div>
                          {item.produced_quantity === item.quantity && (
                            <CheckCircle className="h-4 w-4 text-green-600 ml-auto mt-1" />
                          )}
                        </div>
                      </div>
                      <Progress value={itemProgress} className="h-1" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {activeOrders?.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No active orders to track
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
