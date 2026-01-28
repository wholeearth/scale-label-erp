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
import { Input } from '@/components/ui/input';
import { CalendarIcon, Download, Package, AlertTriangle, ArrowUpDown, Search } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const InventoryReports = () => {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [reportTab, setReportTab] = useState('valuation');
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  // Fetch items with inventory
  const { data: items = [] } = useQuery({
    queryKey: ['items-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('product_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch inventory transactions
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory-transactions', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, items(product_name, product_code)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch inventory movements for the period
  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, items(product_name, product_code)')
        .gte('created_at', format(dateFrom, 'yyyy-MM-dd'))
        .lte('created_at', format(dateTo, 'yyyy-MM-dd') + 'T23:59:59')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Calculate stock levels per item
  const stockLevels = items.map(item => {
    const itemInventory = inventory.filter((inv: any) => inv.item_id === item.id);
    const totalQty = itemInventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0);
    const totalWeight = itemInventory.reduce((sum: number, inv: any) => sum + (inv.weight_kg || 0), 0);
    
    // Estimate value (using expected weight * unit cost placeholder)
    const unitValue = 100; // Placeholder unit value
    const estimatedValue = totalQty * unitValue;
    
    return {
      ...item,
      stockQty: totalQty,
      stockWeight: totalWeight,
      estimatedValue,
      isLowStock: totalQty <= lowStockThreshold && totalQty > 0,
      isOutOfStock: totalQty <= 0
    };
  });

  const filteredStockLevels = stockLevels.filter(item =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = stockLevels.filter(item => item.isLowStock);
  const outOfStockItems = stockLevels.filter(item => item.isOutOfStock);
  const totalInventoryValue = stockLevels.reduce((sum, item) => sum + item.estimatedValue, 0);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object').join(',');
    const rows = data.map(row => 
      Object.entries(row)
        .filter(([_, v]) => typeof v !== 'object')
        .map(([_, v]) => v)
        .join(',')
    ).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inventory Reports</CardTitle>
            <CardDescription>Stock valuation, low stock alerts, and movement history</CardDescription>
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
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Inventory Value</p>
              <p className="text-2xl font-bold">{totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className={cn(lowStockItems.length > 0 && "border-warning")}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
              <p className={cn("text-2xl font-bold", lowStockItems.length > 0 && "text-warning")}>
                {lowStockItems.length}
              </p>
            </CardContent>
          </Card>
          <Card className={cn(outOfStockItems.length > 0 && "border-destructive")}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className={cn("text-2xl font-bold", outOfStockItems.length > 0 && "text-destructive")}>
                {outOfStockItems.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={reportTab} onValueChange={setReportTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="valuation">
              <Package className="h-4 w-4 mr-2" />
              Stock Valuation
            </TabsTrigger>
            <TabsTrigger value="low-stock">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Low Stock Alert
            </TabsTrigger>
            <TabsTrigger value="movements">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Movement History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="valuation" className="mt-4">
            {/* Stock Distribution Charts */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Top Items by Value Bar Chart */}
              {filteredStockLevels.filter(i => i.estimatedValue > 0).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Top Items by Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{ value: { label: "Value", color: "hsl(var(--primary))" } }}
                      className="h-[200px]"
                    >
                      <BarChart data={filteredStockLevels
                        .filter(i => i.estimatedValue > 0)
                        .sort((a, b) => b.estimatedValue - a.estimatedValue)
                        .slice(0, 6)
                        .map(i => ({ name: i.product_name.slice(0, 12), value: i.estimatedValue }))
                      }>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {/* Stock Status Pie Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Stock Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      inStock: { label: "In Stock", color: "hsl(var(--success))" },
                      lowStock: { label: "Low Stock", color: "hsl(var(--warning))" },
                      outOfStock: { label: "Out of Stock", color: "hsl(var(--destructive))" }
                    }}
                    className="h-[200px]"
                  >
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'In Stock', value: stockLevels.filter(i => !i.isLowStock && !i.isOutOfStock).length, fill: 'hsl(var(--success))' },
                          { name: 'Low Stock', value: lowStockItems.length, fill: 'hsl(var(--warning))' },
                          { name: 'Out of Stock', value: outOfStockItems.length, fill: 'hsl(var(--destructive))' }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        <Cell fill="hsl(var(--success))" />
                        <Cell fill="hsl(var(--warning))" />
                        <Cell fill="hsl(var(--destructive))" />
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between mb-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  filteredStockLevels.map(item => ({
                    code: item.product_code,
                    name: item.product_name,
                    type: item.item_type,
                    stockQty: item.stockQty,
                    stockWeight: item.stockWeight,
                    estimatedValue: item.estimatedValue
                  })),
                  'stock_valuation'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Stock Qty</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Est. Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStockLevels.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.product_code}</TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.item_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.stockQty.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.stockWeight.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.estimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {item.isOutOfStock ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : item.isLowStock ? (
                        <Badge variant="secondary" className="bg-warning/20 text-warning">Low Stock</Badge>
                      ) : (
                        <Badge variant="outline" className="text-success">In Stock</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="low-stock" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Threshold:</span>
                <Input
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">units</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  [...lowStockItems, ...outOfStockItems].map(item => ({
                    code: item.product_code,
                    name: item.product_name,
                    type: item.item_type,
                    currentStock: item.stockQty,
                    status: item.isOutOfStock ? 'Out of Stock' : 'Low Stock'
                  })),
                  'low_stock_alert'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            {outOfStockItems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-destructive mb-3">Out of Stock ({outOfStockItems.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outOfStockItems.map((item) => (
                      <TableRow key={item.id} className="bg-destructive/5">
                        <TableCell className="font-mono">{item.product_code}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell><Badge variant="outline">{item.item_type}</Badge></TableCell>
                        <TableCell className="text-right font-bold text-destructive">0</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {lowStockItems.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-warning mb-3">Low Stock ({lowStockItems.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockItems.map((item) => (
                      <TableRow key={item.id} className="bg-warning/5">
                        <TableCell className="font-mono">{item.product_code}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell><Badge variant="outline">{item.item_type}</Badge></TableCell>
                        <TableCell className="text-right font-bold text-warning">{item.stockQty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {lowStockItems.length === 0 && outOfStockItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>All items are well stocked!</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  movements.map((m: any) => ({
                    date: format(new Date(m.created_at), 'yyyy-MM-dd HH:mm'),
                    product: m.items?.product_name,
                    type: m.transaction_type,
                    quantity: m.quantity,
                    weight: m.weight_kg
                  })),
                  'inventory_movements'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.slice(0, 100).map((movement: any) => (
                  <TableRow key={movement.id}>
                    <TableCell>{format(new Date(movement.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                    <TableCell className="font-medium">{movement.items?.product_name}</TableCell>
                    <TableCell>
                      <Badge variant={movement.quantity > 0 ? 'default' : 'secondary'}>
                        {movement.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      movement.quantity > 0 ? "text-success" : "text-destructive"
                    )}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {movement.weight_kg?.toFixed(2) || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InventoryReports;