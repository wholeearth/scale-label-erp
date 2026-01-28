import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, Users, Package, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const SalesReceivablesReport = () => {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [reportTab, setReportTab] = useState('by-customer');

  // Fetch sales invoices with customer info
  const { data: invoices = [] } = useQuery({
    queryKey: ['sales-invoices-report', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          customers!inner(id, customer_name, contact_email, contact_phone),
          orders!inner(order_number, order_items(quantity, unit_price, items(product_name)))
        `)
        .gte('invoice_date', format(dateFrom, 'yyyy-MM-dd'))
        .lte('invoice_date', format(dateTo, 'yyyy-MM-dd'))
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch cash receipts
  const { data: receipts = [] } = useQuery({
    queryKey: ['cash-receipts-report', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_receipts')
        .select('*, customers(customer_name)')
        .gte('receipt_date', format(dateFrom, 'yyyy-MM-dd'))
        .lte('receipt_date', format(dateTo, 'yyyy-MM-dd'))
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Calculate sales by customer
  const salesByCustomer = invoices.reduce((acc: any, inv: any) => {
    const customerId = inv.customers.id;
    if (!acc[customerId]) {
      acc[customerId] = {
        customer: inv.customers,
        totalSales: 0,
        invoiceCount: 0,
        paidAmount: 0
      };
    }
    acc[customerId].totalSales += inv.total_amount;
    acc[customerId].invoiceCount += 1;
    return acc;
  }, {});

  // Add paid amounts from receipts
  receipts.forEach((receipt: any) => {
    if (salesByCustomer[receipt.customer_id]) {
      salesByCustomer[receipt.customer_id].paidAmount += receipt.amount;
    }
  });

  const customerSalesArray = Object.values(salesByCustomer) as any[];

  // Calculate sales by product
  const salesByProduct: Record<string, { productName: string; totalQty: number; totalValue: number }> = {};
  invoices.forEach((inv: any) => {
    inv.orders?.order_items?.forEach((item: any) => {
      const productName = item.items?.product_name || 'Unknown';
      if (!salesByProduct[productName]) {
        salesByProduct[productName] = { productName, totalQty: 0, totalValue: 0 };
      }
      salesByProduct[productName].totalQty += item.quantity;
      salesByProduct[productName].totalValue += item.quantity * item.unit_price;
    });
  });
  const productSalesArray = Object.values(salesByProduct).sort((a, b) => b.totalValue - a.totalValue);

  // Calculate aging report
  const today = new Date();
  const agingBuckets = {
    current: { label: '0-30 Days', amount: 0, count: 0 },
    thirtyDays: { label: '31-60 Days', amount: 0, count: 0 },
    sixtyDays: { label: '61-90 Days', amount: 0, count: 0 },
    overNinety: { label: '90+ Days', amount: 0, count: 0 }
  };

  invoices.filter((inv: any) => inv.status !== 'paid').forEach((inv: any) => {
    const daysPast = differenceInDays(today, new Date(inv.invoice_date));
    const outstanding = inv.total_amount; // Simplified - would need to subtract payments
    
    if (daysPast <= 30) {
      agingBuckets.current.amount += outstanding;
      agingBuckets.current.count += 1;
    } else if (daysPast <= 60) {
      agingBuckets.thirtyDays.amount += outstanding;
      agingBuckets.thirtyDays.count += 1;
    } else if (daysPast <= 90) {
      agingBuckets.sixtyDays.amount += outstanding;
      agingBuckets.sixtyDays.count += 1;
    } else {
      agingBuckets.overNinety.amount += outstanding;
      agingBuckets.overNinety.count += 1;
    }
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => 
      typeof v === 'object' ? JSON.stringify(v) : v
    ).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const totalSales = invoices.reduce((sum: number, inv: any) => sum + inv.total_amount, 0);
  const totalReceived = receipts.reduce((sum: number, r: any) => sum + r.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sales & Receivables Reports</CardTitle>
            <CardDescription>Customer sales analysis and aging reports</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(dateFrom, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(date) => date && setDateFrom(date)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(dateTo, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(date) => date && setDateTo(date)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-bold">{totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Received</p>
              <p className="text-2xl font-bold text-success">{totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-warning">{(totalSales - totalReceived).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Invoices</p>
              <p className="text-2xl font-bold">{invoices.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={reportTab} onValueChange={setReportTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="by-customer">
              <Users className="h-4 w-4 mr-2" />
              By Customer
            </TabsTrigger>
            <TabsTrigger value="by-product">
              <Package className="h-4 w-4 mr-2" />
              By Product
            </TabsTrigger>
            <TabsTrigger value="aging">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Aging Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="by-customer" className="mt-4">
            {/* Top Customers Bar Chart */}
            {customerSalesArray.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Top Customers by Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      sales: { label: "Sales", color: "hsl(var(--primary))" },
                      paid: { label: "Paid", color: "hsl(var(--success))" }
                    }}
                    className="h-[250px]"
                  >
                    <BarChart data={customerSalesArray.slice(0, 8).map((c: any) => ({
                      name: c.customer.customer_name.slice(0, 15),
                      sales: c.totalSales,
                      paid: c.paidAmount
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" fontSize={12} angle={-20} textAnchor="end" height={60} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paid" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  customerSalesArray.map(c => ({
                    customer: c.customer.customer_name,
                    email: c.customer.contact_email,
                    totalSales: c.totalSales,
                    invoiceCount: c.invoiceCount,
                    paidAmount: c.paidAmount,
                    outstanding: c.totalSales - c.paidAmount
                  })),
                  'sales_by_customer'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerSalesArray.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.customer.customer_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.customer.contact_email || item.customer.contact_phone}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">{item.invoiceCount}</TableCell>
                    <TableCell className="text-right font-mono text-success">
                      {item.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(item.totalSales - item.paidAmount) > 0 ? (
                        <span className="text-warning">
                          {(item.totalSales - item.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <Badge variant="secondary">Paid</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="by-product" className="mt-4">
            {/* Product Sales Pie Chart */}
            {productSalesArray.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Sales Distribution by Product</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={productSalesArray.slice(0, 6).reduce((acc, product, idx) => ({
                      ...acc,
                      [product.productName]: { 
                        label: product.productName, 
                        color: `hsl(${idx * 60}, 70%, 50%)` 
                      }
                    }), {})}
                    className="h-[250px]"
                  >
                    <PieChart>
                      <Pie
                        data={productSalesArray.slice(0, 6).map((p, idx) => ({
                          name: p.productName,
                          value: p.totalValue,
                          fill: `hsl(${idx * 60}, 70%, 50%)`
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name.slice(0, 10)} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {productSalesArray.slice(0, 6).map((_, idx) => (
                          <Cell key={idx} fill={`hsl(${idx * 60}, 70%, 50%)`} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(productSalesArray, 'sales_by_product')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity Sold</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">% of Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productSalesArray.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right">{item.totalQty.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      {totalSales > 0 ? ((item.totalValue / totalSales) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="aging" className="mt-4">
            {/* Aging Bar Chart */}
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Aging Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    amount: { label: "Amount", color: "hsl(var(--primary))" }
                  }}
                  className="h-[200px]"
                >
                  <BarChart data={Object.values(agingBuckets).map((bucket, idx) => ({
                    name: bucket.label,
                    amount: bucket.amount,
                    fill: idx === 3 ? 'hsl(var(--destructive))' : idx === 2 ? 'hsl(var(--warning))' : 'hsl(var(--primary))'
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {Object.values(agingBuckets).map((_, idx) => (
                        <Cell key={idx} fill={idx === 3 ? 'hsl(var(--destructive))' : idx === 2 ? 'hsl(var(--warning))' : 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-4 mb-6">
              {Object.values(agingBuckets).map((bucket, idx) => (
                <Card key={idx} className={cn(
                  idx === 3 && bucket.amount > 0 && "border-destructive"
                )}>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{bucket.label}</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      idx === 3 && bucket.amount > 0 && "text-destructive"
                    )}>
                      {bucket.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{bucket.count} invoices</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Days Outstanding</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices
                  .filter((inv: any) => inv.status !== 'paid')
                  .sort((a: any, b: any) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime())
                  .map((inv: any) => {
                    const daysPast = differenceInDays(today, new Date(inv.invoice_date));
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.customers.customer_name}</TableCell>
                        <TableCell>{format(new Date(inv.invoice_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant={daysPast > 90 ? "destructive" : daysPast > 60 ? "secondary" : "outline"}>
                            {daysPast} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {inv.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SalesReceivablesReport;