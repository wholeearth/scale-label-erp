import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export const AgentOrders = () => {
  const { user } = useAuth();

  const { data: agent } = useQuery({
    queryKey: ['commission-agent', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agents')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['agent-orders', agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers!inner(
            customer_name,
            commission_agent_id
          ),
          order_items(
            quantity,
            unit_price,
            items(product_name)
          )
        `)
        .eq('customers.commission_agent_id', agent.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!agent,
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'outline' as const, label: 'Pending' },
      approved: { variant: 'secondary' as const, label: 'Approved' },
      in_production: { variant: 'default' as const, label: 'In Production' },
      completed: { variant: 'default' as const, label: 'Completed' },
      cancelled: { variant: 'destructive' as const, label: 'Cancelled' },
      rejected: { variant: 'destructive' as const, label: 'Rejected' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: 'outline' as const, label: status };
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Orders</CardTitle>
        <p className="text-sm text-muted-foreground">
          Orders placed by your customers and by you on their behalf
        </p>
      </CardHeader>
      <CardContent>
        {!orders || orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No orders found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{order.customers?.customer_name}</TableCell>
                  <TableCell>{format(new Date(order.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    {order.order_items?.length || 0} item(s)
                  </TableCell>
                  <TableCell>₹{Number(order.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {getStatusBadge(order.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
