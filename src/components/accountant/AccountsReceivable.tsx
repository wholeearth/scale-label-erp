import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, Users } from 'lucide-react';

type CustomerBalance = {
  customer_id: string;
  customer_name: string;
  total_sales: number;
  order_count: number;
};

const AccountsReceivable = () => {
  const { data: arAccount } = useQuery({
    queryKey: ['ar-account'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('account_code', '1200')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: customerBalances } = useQuery({
    queryKey: ['customer-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          customer_id,
          total_amount,
          customers(customer_name)
        `)
        .eq('status', 'completed');

      if (error) throw error;

      // Aggregate by customer
      const balanceMap = new Map<string, CustomerBalance>();
      
      data.forEach((order: any) => {
        const customerId = order.customer_id;
        const customerName = order.customers?.customer_name || 'Unknown';
        const amount = order.total_amount || 0;

        if (balanceMap.has(customerId)) {
          const existing = balanceMap.get(customerId)!;
          existing.total_sales += amount;
          existing.order_count += 1;
        } else {
          balanceMap.set(customerId, {
            customer_id: customerId,
            customer_name: customerName,
            total_sales: amount,
            order_count: 1,
          });
        }
      });

      return Array.from(balanceMap.values()).sort((a, b) => b.total_sales - a.total_sales);
    },
  });

  const totalAR = customerBalances?.reduce((sum, customer) => sum + customer.total_sales, 0) || 0;
  const totalCustomers = customerBalances?.length || 0;
  const avgBalance = totalCustomers > 0 ? totalAR / totalCustomers : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total A/R Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAR.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Current balance: ${arAccount?.current_balance?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers with Balances</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Active customer accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per customer</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Balances</CardTitle>
          <CardDescription>
            Outstanding balances for completed orders by customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Balance</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerBalances?.map((customer) => (
                <TableRow key={customer.customer_id}>
                  <TableCell className="font-medium">{customer.customer_name}</TableCell>
                  <TableCell className="text-right">{customer.order_count}</TableCell>
                  <TableCell className="text-right">${customer.total_sales.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {((customer.total_sales / totalAR) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {customerBalances?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No customer balances found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsReceivable;
