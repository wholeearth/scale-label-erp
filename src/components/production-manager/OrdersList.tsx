import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Package } from 'lucide-react';
import { useState } from 'react';
import { AssignOrderDialog } from './AssignOrderDialog';

interface OrderItem {
  id: string;
  item_id: string;
  quantity: number;
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
  created_at: string;
  customers: {
    customer_name: string;
  } | null;
  order_items: OrderItem[];
}

export const OrdersList = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['approved-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          created_at,
          customers (
            customer_name
          ),
          order_items (
            id,
            item_id,
            quantity,
            produced_quantity,
            items (
              product_code,
              product_name,
              color
            )
          )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
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
    <>
      <div className="space-y-4">
        {orders?.map((order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    {order.order_number}
                  </CardTitle>
                  <CardDescription>
                    Customer: {order.customers?.customer_name || 'Unknown Customer'}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {order.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Order Date: {new Date(order.created_at).toLocaleDateString()}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" />
                    Order Items:
                  </div>
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
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          <span className="font-semibold">{item.produced_quantity}</span>
                          <span className="text-muted-foreground"> / {item.quantity}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">produced</div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => setSelectedOrder(order)}
                  className="w-full"
                  variant="outline"
                >
                  Assign to Operators
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {orders?.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                No approved orders found
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedOrder && (
        <AssignOrderDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
        />
      )}
    </>
  );
};
