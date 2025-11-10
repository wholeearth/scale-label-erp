import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardList, Package, Calendar, TrendingUp } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { addDays, format, subDays } from 'date-fns';
import { AssignOrderDialog } from './AssignOrderDialog';
import { BulkAssignDialog } from './BulkAssignDialog';

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
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const { data: orders, isLoading, refetch: refetchOrders } = useQuery({
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
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Set up real-time subscriptions for assignment and production updates
  useEffect(() => {
    const assignmentChannel = supabase
      .channel('assignment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operator_assignments',
        },
        (payload) => {
          console.log('Assignment changed:', payload);
          refetchOrders();
        }
      )
      .subscribe();

    const productionChannel = supabase
      .channel('production-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'production_records',
        },
        (payload) => {
          console.log('Production record added:', payload);
          refetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(productionChannel);
    };
  }, [refetchOrders]);

  // Fetch production rates for the last 7 days
  const { data: productionRates } = useQuery({
    queryKey: ['production-rates'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('production_records')
        .select('item_id, production_date')
        .gte('production_date', sevenDaysAgo);

      if (error) throw error;

      // Calculate production rate per item (items per day)
      const rateMap = new Map<string, { count: number; days: Set<string> }>();
      
      data.forEach((record) => {
        const existing = rateMap.get(record.item_id) || { count: 0, days: new Set<string>() };
        existing.count += 1;
        existing.days.add(record.production_date);
        rateMap.set(record.item_id, existing);
      });

      // Convert to items per day
      const rates = new Map<string, number>();
      rateMap.forEach((value, itemId) => {
        const daysActive = value.days.size;
        rates.set(itemId, daysActive > 0 ? value.count / daysActive : 0);
      });

      return rates;
    },
  });

  // Fetch active assignments to factor in current capacity
  const { data: activeAssignments } = useQuery({
    queryKey: ['active-assignments-for-estimates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_assignments')
        .select('item_id, quantity_assigned, quantity_produced')
        .eq('status', 'active');

      if (error) throw error;
      return data;
    },
  });

  // Calculate estimated completion date for an order item
  const calculateEstimatedCompletion = (itemId: string, remainingQuantity: number): Date | null => {
    if (remainingQuantity <= 0) return new Date(); // Already complete
    
    const rate = productionRates?.get(itemId) || 0;
    
    if (rate === 0) {
      // No production history, estimate based on average or return null
      return null;
    }

    // Check active assignments for this item
    const assignedQuantity = activeAssignments
      ?.filter(a => a.item_id === itemId)
      .reduce((sum, a) => sum + (a.quantity_assigned - a.quantity_produced), 0) || 0;

    // If there are active assignments, factor them into the calculation
    const effectiveRate = assignedQuantity > 0 ? rate * 1.5 : rate; // Boost rate if actively assigned
    
    const daysToComplete = Math.ceil(remainingQuantity / effectiveRate);
    return addDays(new Date(), daysToComplete);
  };

  // Calculate overall order completion estimate
  const orderCompletionEstimates = useMemo(() => {
    if (!orders || !productionRates) return new Map<string, Date | null>();
    
    const estimates = new Map<string, Date | null>();
    
    orders.forEach(order => {
      let latestDate: Date | null = null;
      
      order.order_items.forEach(item => {
        const remaining = item.quantity - item.produced_quantity;
        const itemEstimate = calculateEstimatedCompletion(item.item_id, remaining);
        
        if (itemEstimate && (!latestDate || itemEstimate > latestDate)) {
          latestDate = itemEstimate;
        }
      });
      
      estimates.set(order.id, latestDate);
    });
    
    return estimates;
  }, [orders, productionRates, activeAssignments]);

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
        {selectedOrderIds.length > 0 && (
          <Card className="bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold">{selectedOrderIds.length}</span> order(s) selected
                </div>
                <Button onClick={() => setShowBulkAssign(true)}>
                  Assign Selected Orders
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {orders?.map((order) => {
          const estimatedCompletion = orderCompletionEstimates.get(order.id);
          const totalQuantity = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
          const totalProduced = order.order_items.reduce((sum, item) => sum + item.produced_quantity, 0);
          const overallProgress = Math.round((totalProduced / totalQuantity) * 100);
          
          return (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedOrderIds.includes(order.id)}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                    />
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5" />
                        {order.order_number}
                      </CardTitle>
                      <CardDescription>
                        Customer: {order.customers?.customer_name || 'Unknown Customer'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {order.status}
                    </Badge>
                    {estimatedCompletion && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Est: {format(estimatedCompletion, 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Order-level Progress */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-semibold">{totalProduced} / {totalQuantity} units</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium min-w-[40px] text-right">{overallProgress}%</span>
                  </div>
                  {estimatedCompletion && (
                    <div className="flex items-center gap-1 mt-2 text-xs">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">
                        {overallProgress === 100 
                          ? 'Completed' 
                          : `Expected completion: ${format(estimatedCompletion, 'EEEE, MMMM dd, yyyy')}`
                        }
                      </span>
                    </div>
                  )}
                  {!estimatedCompletion && overallProgress < 100 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>No production history available for estimation</span>
                    </div>
                  )}
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
                  {order.order_items.map((item) => {
                    const progress = Math.round((item.produced_quantity / item.quantity) * 100);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {item.items.product_code} - {item.items.product_name}
                          </div>
                          {item.items.color && (
                            <div className="text-sm text-muted-foreground">
                              Color: {item.items.color}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              {item.produced_quantity} / {item.quantity}
                            </div>
                            <div className="text-xs text-muted-foreground">units</div>
                          </div>
                          <Badge 
                            variant={progress === 100 ? "default" : progress > 0 ? "secondary" : "outline"}
                            className="min-w-[60px] justify-center"
                          >
                            {progress}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
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
          );
        })}

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

      {showBulkAssign && (
        <BulkAssignDialog
          orders={orders?.filter(o => selectedOrderIds.includes(o.id)) || []}
          open={showBulkAssign}
          onOpenChange={(open) => {
            setShowBulkAssign(open);
            if (!open) setSelectedOrderIds([]);
          }}
        />
      )}
    </>
  );
};
