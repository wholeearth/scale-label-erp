import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { z } from 'zod';

const purchaseItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
});

const purchaseSchema = z.object({
  supplier_name: z.string().trim().min(1).max(200),
  supplier_contact: z.string().trim().max(100).optional(),
  supplier_address: z.string().trim().max(500).optional(),
  purchase_date: z.string(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(purchaseItemSchema).min(1),
});

interface PurchaseItem {
  item_id: string;
  quantity: string;
  unit_price: string;
  total_price: number;
}

const CreatePurchaseInvoice = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([
    { item_id: '', quantity: '', unit_price: '', total_price: 0 }
  ]);

  // Fetch items
  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('product_code');
      if (error) throw error;
      return data;
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: async () => {
      // Validate input
      const validatedData = purchaseSchema.parse({
        supplier_name: supplierName,
        supplier_contact: supplierContact || undefined,
        supplier_address: supplierAddress || undefined,
        purchase_date: purchaseDate,
        notes: notes || undefined,
        items: purchaseItems.map(item => ({
          item_id: item.item_id,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
        })),
      });

      // Generate purchase number
      const { data: purchaseNumber, error: numberError } = await supabase
        .rpc('generate_purchase_number');
      
      if (numberError) throw numberError;

      // Calculate total amount
      const totalAmount = purchaseItems.reduce((sum, item) => sum + item.total_price, 0);

      // Insert purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          purchase_number: purchaseNumber,
          supplier_name: validatedData.supplier_name,
          supplier_contact: validatedData.supplier_contact,
          supplier_address: validatedData.supplier_address,
          purchase_date: validatedData.purchase_date,
          total_amount: totalAmount,
          notes: validatedData.notes,
          status: 'pending',
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Insert purchase items
      const itemsToInsert = validatedData.items.map(item => ({
        purchase_id: purchase.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return purchase;
    },
    onSuccess: (purchase) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast({
        title: 'Success',
        description: `Purchase invoice ${purchase.purchase_number} created successfully`,
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setSupplierName('');
    setSupplierContact('');
    setSupplierAddress('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setPurchaseItems([{ item_id: '', quantity: '', unit_price: '', total_price: 0 }]);
  };

  const addPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, { item_id: '', quantity: '', unit_price: '', total_price: 0 }]);
  };

  const removePurchaseItem = (index: number) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
    }
  };

  const updatePurchaseItem = (index: number, field: keyof PurchaseItem, value: string) => {
    const newItems = [...purchaseItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Calculate total price
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = parseFloat(newItems[index].quantity) || 0;
      const unitPrice = parseFloat(newItems[index].unit_price) || 0;
      newItems[index].total_price = quantity * unitPrice;
    }
    
    setPurchaseItems(newItems);
  };

  const calculateGrandTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!supplierName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Supplier name is required',
        variant: 'destructive',
      });
      return;
    }

    if (purchaseItems.some(item => !item.item_id || !item.quantity || !item.unit_price)) {
      toast({
        title: 'Validation Error',
        description: 'All item fields must be filled',
        variant: 'destructive',
      });
      return;
    }

    createPurchaseMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Purchase Invoice</CardTitle>
        <CardDescription>Add a new purchase order for inventory items</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Supplier Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Supplier Name *</Label>
                <Input
                  id="supplier-name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-contact">Contact</Label>
                <Input
                  id="supplier-contact"
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  placeholder="Phone or email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Textarea
                id="supplier-address"
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                placeholder="Enter supplier address"
                rows={2}
              />
            </div>
          </div>

          {/* Purchase Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Purchase Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase-date">Purchase Date *</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Items</h3>
              <Button type="button" size="sm" onClick={addPurchaseItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {purchaseItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Item</Label>
                    <Select
                      value={item.item_id}
                      onValueChange={(value) => updatePurchaseItem(index, 'item_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items?.map((itm) => (
                          <SelectItem key={itm.id} value={itm.id}>
                            {itm.product_code} - {itm.product_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updatePurchaseItem(index, 'quantity', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="w-32">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updatePurchaseItem(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="w-32">
                    <Label>Total</Label>
                    <Input
                      value={item.total_price.toFixed(2)}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removePurchaseItem(index)}
                    disabled={purchaseItems.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Grand Total</p>
                <p className="text-2xl font-bold">${calculateGrandTotal().toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or remarks"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>
              Clear
            </Button>
            <Button type="submit" disabled={createPurchaseMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {createPurchaseMutation.isPending ? 'Saving...' : 'Save Invoice'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreatePurchaseInvoice;
