import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Eye, Trash2, CheckCircle, XCircle, Package } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

interface Purchase {
  id: string;
  purchase_number: string;
  supplier_name: string;
  supplier_contact: string | null;
  supplier_address: string | null;
  purchase_date: string;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface PurchaseItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  items: {
    product_code: string;
    product_name: string;
  };
}

const PurchaseInvoiceList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [viewDialog, setViewDialog] = useState(false);

  // Fetch purchases
  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Purchase[];
    },
  });

  // Fetch purchase items for selected purchase
  const { data: purchaseItems } = useQuery({
    queryKey: ['purchase-items', selectedPurchase?.id],
    queryFn: async () => {
      if (!selectedPurchase) return [];
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          *,
          items (
            product_code,
            product_name
          )
        `)
        .eq('purchase_id', selectedPurchase.id);
      if (error) throw error;
      return data as PurchaseItem[];
    },
    enabled: !!selectedPurchase,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ purchaseId, status }: { purchaseId: string; status: string }) => {
      const { error } = await supabase
        .from('purchases')
        .update({ status })
        .eq('id', purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast({
        title: 'Success',
        description: 'Purchase status updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast({
        title: 'Success',
        description: 'Purchase deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredPurchases = purchases?.filter(
    (purchase) =>
      purchase.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: 'secondary',
      approved: 'default',
      received: 'outline',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const handleView = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setViewDialog(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Purchase Invoices</CardTitle>
              <CardDescription>View and manage all purchase orders</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
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
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
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
              ) : filteredPurchases?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No purchase invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPurchases?.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.purchase_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{purchase.supplier_name}</p>
                        {purchase.supplier_contact && (
                          <p className="text-sm text-muted-foreground">{purchase.supplier_contact}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(purchase.purchase_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${parseFloat(purchase.total_amount.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(purchase)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {purchase.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ purchaseId: purchase.id, status: 'approved' })}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ purchaseId: purchase.id, status: 'cancelled' })}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {purchase.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ purchaseId: purchase.id, status: 'received' })}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this purchase?')) {
                              deletePurchaseMutation.mutate(purchase.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* View Purchase Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Invoice Details</DialogTitle>
            <DialogDescription>
              Invoice #{selectedPurchase?.purchase_number}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPurchase && (
            <div className="space-y-6">
              {/* Supplier Information */}
              <div className="space-y-2">
                <h3 className="font-semibold">Supplier Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedPurchase.supplier_name}</p>
                  </div>
                  {selectedPurchase.supplier_contact && (
                    <div>
                      <p className="text-muted-foreground">Contact</p>
                      <p className="font-medium">{selectedPurchase.supplier_contact}</p>
                    </div>
                  )}
                  {selectedPurchase.supplier_address && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Address</p>
                      <p className="font-medium">{selectedPurchase.supplier_address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Purchase Details */}
              <div className="space-y-2">
                <h3 className="font-semibold">Purchase Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">{format(new Date(selectedPurchase.purchase_date), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedPurchase.status)}</div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <h3 className="font-semibold">Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItems?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.items.product_code} - {item.items.product_name}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${parseFloat(item.unit_price.toString()).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${parseFloat(item.total_price.toString()).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">Grand Total:</TableCell>
                      <TableCell className="text-right font-bold">
                        ${parseFloat(selectedPurchase.total_amount.toString()).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Notes */}
              {selectedPurchase.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Notes</h3>
                  <p className="text-sm text-muted-foreground">{selectedPurchase.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PurchaseInvoiceList;
