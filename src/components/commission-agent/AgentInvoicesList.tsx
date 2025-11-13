import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export const AgentInvoicesList = () => {
  const { user } = useAuth();

  const { data: agent } = useQuery({
    queryKey: ['commission-agent', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agents')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['agent-invoices', agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      
      // Get completed orders (invoiced orders) where commission agent is associated
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
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!agent,
  });

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
        <CardTitle>Invoices Arranged by Me</CardTitle>
        <p className="text-sm text-muted-foreground">
          Completed orders that have been invoiced by the accountant
        </p>
      </CardHeader>
      <CardContent>
        {!invoices || invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No invoices found. Invoices appear here when orders are completed and invoiced by the accountant.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.order_number}</TableCell>
                  <TableCell>{invoice.customers?.customer_name}</TableCell>
                  <TableCell>{format(new Date(invoice.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>₹{Number(invoice.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="default">
                      Invoiced
                    </Badge>
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
