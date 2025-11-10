import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, Search, Plus, Minus, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InventoryItem {
  item_id: string;
  product_code: string;
  product_name: string;
  total_quantity: number;
  total_weight: number;
  last_transaction: string;
}

interface InventoryTransaction {
  id: string;
  transaction_type: string;
  quantity: number;
  weight_kg: number;
  created_at: string;
  items: {
    product_code: string;
    product_name: string;
  };
}

const InventoryManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentWeight, setAdjustmentWeight] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Fetch inventory summary by item
  const { data: inventoryItems, isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          item_id,
          quantity,
          weight_kg,
          created_at,
          items (
            product_code,
            product_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Aggregate by item
      const aggregated = data.reduce((acc: Record<string, InventoryItem>, curr) => {
        const itemId = curr.item_id;
        const item = curr.items as any;
        
        if (!acc[itemId]) {
          acc[itemId] = {
            item_id: itemId,
            product_code: item.product_code,
            product_name: item.product_name,
            total_quantity: 0,
            total_weight: 0,
            last_transaction: curr.created_at,
          };
        }

        acc[itemId].total_quantity += curr.quantity;
        acc[itemId].total_weight += parseFloat(curr.weight_kg?.toString() || '0');
        
        if (new Date(curr.created_at) > new Date(acc[itemId].last_transaction)) {
          acc[itemId].last_transaction = curr.created_at;
        }

        return acc;
      }, {});

      return Object.values(aggregated);
    },
  });

  // Fetch transaction history
  const { data: transactions } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          transaction_type,
          quantity,
          weight_kg,
          created_at,
          items (
            product_code,
            product_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as InventoryTransaction[];
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error('No item selected');

      const quantity = adjustmentType === 'add' 
        ? parseInt(adjustmentQuantity) 
        : -parseInt(adjustmentQuantity);
      
      const weight = adjustmentType === 'add'
        ? parseFloat(adjustmentWeight)
        : -parseFloat(adjustmentWeight);

      const { error } = await supabase
        .from('inventory')
        .insert({
          item_id: selectedItem.item_id,
          transaction_type: adjustmentType === 'add' ? 'adjustment_in' : 'adjustment_out',
          quantity: quantity,
          weight_kg: weight,
          reference_id: null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast({
        title: 'Success',
        description: 'Inventory adjusted successfully',
      });
      setAdjustmentDialog(false);
      resetAdjustmentForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetAdjustmentForm = () => {
    setSelectedItem(null);
    setAdjustmentQuantity('');
    setAdjustmentWeight('');
    setAdjustmentReason('');
    setAdjustmentType('add');
  };

  const openAdjustmentDialog = (item: InventoryItem, type: 'add' | 'remove') => {
    setSelectedItem(item);
    setAdjustmentType(type);
    setAdjustmentDialog(true);
  };

  const filteredItems = inventoryItems?.filter(item =>
    item.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = inventoryItems?.filter(item => item.total_quantity < 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Inventory Management</h2>
          <p className="text-muted-foreground">Monitor and manage stock levels</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryItems?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Unique products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inventoryItems?.reduce((sum, item) => sum + item.total_quantity, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total units</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inventoryItems?.reduce((sum, item) => sum + item.total_weight, 0).toFixed(2) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Kilograms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Items below threshold</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="alerts">Low Stock Alerts</TabsTrigger>
        </TabsList>

        {/* Current Stock Tab */}
        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stock Levels</CardTitle>
                  <CardDescription>Current inventory by product</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Total Weight (kg)</TableHead>
                    <TableHead className="text-right">Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredItems?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No inventory items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems?.map((item) => (
                      <TableRow key={item.item_id}>
                        <TableCell className="font-medium">{item.product_code}</TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.total_quantity < 10 ? 'destructive' : 'default'}>
                            {item.total_quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.total_weight.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Date(item.last_transaction).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAdjustmentDialog(item, 'add')}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAdjustmentDialog(item, 'remove')}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 100 inventory movements</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions?.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.transaction_type === 'production'
                              ? 'default'
                              : transaction.transaction_type === 'adjustment_in'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {transaction.quantity > 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {transaction.transaction_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transaction.items?.product_code} - {transaction.items?.product_name}
                      </TableCell>
                      <TableCell className="text-right">{transaction.quantity}</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(transaction.weight_kg?.toString() || '0').toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Stock Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Low Stock Alerts
              </CardTitle>
              <CardDescription>Items with quantity below 10 units</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Current Quantity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        No low stock items
                      </TableCell>
                    </TableRow>
                  ) : (
                    lowStockItems?.map((item) => (
                      <TableRow key={item.item_id}>
                        <TableCell className="font-medium">{item.product_code}</TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{item.total_quantity}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAdjustmentDialog(item, 'add')}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Restock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialog} onOpenChange={setAdjustmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === 'add' ? 'Add Stock' : 'Remove Stock'}
            </DialogTitle>
            <DialogDescription>
              Adjust inventory for {selectedItem?.product_code} - {selectedItem?.product_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Stock: {selectedItem?.total_quantity} units</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.01"
                value={adjustmentWeight}
                onChange={(e) => setAdjustmentWeight(e.target.value)}
                placeholder="Enter weight"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="e.g., Damaged goods, Manual count correction"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => adjustmentMutation.mutate()}
              disabled={!adjustmentQuantity || !adjustmentWeight}
            >
              {adjustmentType === 'add' ? 'Add Stock' : 'Remove Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryManagement;
