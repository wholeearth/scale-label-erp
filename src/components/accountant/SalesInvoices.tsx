import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';

type Order = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  customers: {
    customer_name: string;
  } | null;
  journal_entries: Array<{
    entry_number: string;
    status: string;
  }>;
};

const SalesInvoices = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          customers(customer_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch journal entries separately
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('entry_number, status, reference_number')
        .eq('reference_type', 'sales_order');

      // Map journal entries to orders
      const ordersWithJournals = ordersData.map(order => ({
        ...order,
        journal_entries: journalEntries?.filter(je => je.reference_number === order.order_number) || []
      }));

      return ordersWithJournals as Order[];
    },
  });

  const { data: orderDetails } = useQuery({
    queryKey: ['order-details', selectedOrder?.id],
    enabled: !!selectedOrder,
    queryFn: async () => {
      if (!selectedOrder) return null;

      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          unit_price,
          items(product_name, product_code)
        `)
        .eq('order_id', selectedOrder.id);

      if (itemsError) throw itemsError;

      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .select(`
          *,
          journal_entry_lines(
            *,
            chart_of_accounts(account_code, account_name)
          )
        `)
        .eq('reference_number', selectedOrder.order_number)
        .eq('reference_type', 'sales_order')
        .maybeSingle();

      if (jeError) throw jeError;

      return { items, journalEntry };
    },
  });

  const filteredOrders = orders?.filter(
    (order) =>
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customers?.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'secondary',
      in_production: 'default',
      completed: 'default',
      cancelled: 'destructive',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sales Invoices</CardTitle>
          <CardDescription>
            View sales orders and their accounting impact. Journal entries are automatically created when orders are completed.
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sales orders...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Journal Entry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.customers?.customer_name || 'N/A'}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      ${order.total_amount?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell>{format(new Date(order.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {order.journal_entries?.[0] ? (
                        <Badge variant="default">{order.journal_entries[0].entry_number}</Badge>
                      ) : order.status === 'completed' ? (
                        <Badge variant="outline">Pending</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No sales orders found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>
              Complete order information and accounting entries
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Customer Information</h4>
                  <p className="text-sm">{selectedOrder.customers?.customer_name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Order Status</h4>
                  {getStatusBadge(selectedOrder.status)}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Order Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails?.items?.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{item.items?.product_name}</TableCell>
                        <TableCell>{item.items?.product_code}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unit_price?.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          ${(item.quantity * item.unit_price)?.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {orderDetails?.journalEntry && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Accounting Entry</h4>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Entry Number:</span>
                      <Badge variant="secondary">{orderDetails.journalEntry.entry_number}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Status:</span>
                      <Badge>{orderDetails.journalEntry.status}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Description:</span>
                      <span>{orderDetails.journalEntry.description}</span>
                    </div>
                  </div>

                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetails.journalEntry.journal_entry_lines?.map((line: any) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            {line.chart_of_accounts?.account_code} - {line.chart_of_accounts?.account_name}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.debit_amount > 0 ? `$${line.debit_amount.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.credit_amount > 0 ? `$${line.credit_amount.toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SalesInvoices;
