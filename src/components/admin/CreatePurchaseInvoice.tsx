import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { X, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { z } from 'zod';
import FiberPackingListEntry, { PackingRow } from './FiberPackingListEntry';
import FiberBagLabels from './FiberBagLabels';

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
  has_packing_list: boolean;
  packing_rows: PackingRow[];
}

const emptyItem = (): PurchaseItem => ({
  item_id: '',
  quantity: '',
  unit_price: '',
  total_price: 0,
  has_packing_list: false,
  packing_rows: [{ bag_serial: 1, pack_type: 'bag', weight_kg: '' }],
});

const CreatePurchaseInvoice = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [labelsForPurchase, setLabelsForPurchase] = useState<string | null>(null);

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
      const validatedData = purchaseSchema.parse({
        supplier_name: supplierName,
        supplier_contact: supplierContact || undefined,
        supplier_address: undefined,
        purchase_date: purchaseDate,
        notes: narration || undefined,
        items: purchaseItems.map(item => ({
          item_id: item.item_id,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
        })),
      });

      const { data: purchaseNumber, error: numberError } = await supabase
        .rpc('generate_purchase_number');
      
      if (numberError) throw numberError;

      const totalAmount = purchaseItems.reduce((sum, item) => sum + item.total_price, 0);

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

      // Insert purchase_items one at a time so we can capture each id for fiber_bags
      let createdAnyBag = false;
      for (let i = 0; i < purchaseItems.length; i++) {
        const item = purchaseItems[i];
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unit_price);

        const { data: pi, error: piErr } = await supabase
          .from('purchase_items')
          .insert({
            purchase_id: purchase.id,
            item_id: item.item_id,
            quantity: qty,
            unit_price: price,
            total_price: qty * price,
          })
          .select()
          .single();
        if (piErr) throw piErr;

        if (item.has_packing_list && item.packing_rows.length > 0) {
          const itemMeta = items?.find((it) => it.id === item.item_id);
          if (!itemMeta) throw new Error('Item meta not found for packing list');

          const bagsToInsert: Array<{
            unique_id: string;
            purchase_id: string;
            purchase_item_id: string;
            item_id: string;
            bag_serial: number;
            pack_type: string;
            original_weight_kg: number;
            supplier_name: string;
            purchase_date: string;
          }> = [];

          for (const row of item.packing_rows) {
            const w = parseFloat(row.weight_kg);
            if (!w || w <= 0) continue;
            const { data: uniqueId, error: idErr } = await supabase
              .rpc('generate_fiber_bag_id', { _product_code: itemMeta.product_code });
            if (idErr) throw idErr;
            bagsToInsert.push({
              unique_id: uniqueId as string,
              purchase_id: purchase.id,
              purchase_item_id: pi.id,
              item_id: item.item_id,
              bag_serial: row.bag_serial,
              pack_type: row.pack_type,
              original_weight_kg: w,
              supplier_name: validatedData.supplier_name,
              purchase_date: validatedData.purchase_date,
            });
          }

          if (bagsToInsert.length > 0) {
            const { error: bagErr } = await supabase.from('fiber_bags').insert(bagsToInsert);
            if (bagErr) throw bagErr;
            createdAnyBag = true;
          }
        }
      }

      return { purchase, createdAnyBag };
    },
    onSuccess: ({ purchase, createdAnyBag }) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['fiber-bags'] });
      toast({
        title: 'Success',
        description: `Purchase invoice ${purchase.purchase_number} created${createdAnyBag ? ' with fiber bags' : ''}`,
      });
      const newPurchaseId = purchase.id;
      const hadBags = createdAnyBag;
      resetForm();
      if (hadBags) setLabelsForPurchase(newPurchaseId);
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
    setReferenceNo('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNarration('');
    setPurchaseItems([emptyItem()]);
  };

  const addPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, emptyItem()]);
  };

  const removePurchaseItem = (index: number) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
    }
  };

  const updatePurchaseItem = (index: number, field: keyof PurchaseItem, value: string | boolean | PackingRow[]) => {
    const newItems = [...purchaseItems];
    // @ts-expect-error dynamic field
    newItems[index][field] = value;

    // Recompute quantity & total when packing list changes or rows update
    const it = newItems[index];
    if (it.has_packing_list) {
      const totalWeight = it.packing_rows.reduce((s, r) => s + (parseFloat(r.weight_kg) || 0), 0);
      it.quantity = totalWeight ? totalWeight.toFixed(3) : '';
      const unitPrice = parseFloat(it.unit_price) || 0;
      it.total_price = totalWeight * unitPrice;
    } else if (field === 'quantity' || field === 'unit_price') {
      const quantity = parseFloat(it.quantity) || 0;
      const unitPrice = parseFloat(it.unit_price) || 0;
      it.total_price = quantity * unitPrice;
    }

    setPurchaseItems(newItems);
  };

  const calculateGrandTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSubmit = () => {
    if (!supplierName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Supplier name is required',
        variant: 'destructive',
      });
      return;
    }

    for (const it of purchaseItems) {
      if (!it.item_id || !it.unit_price) {
        toast({ title: 'Validation Error', description: 'All items need a product and unit price', variant: 'destructive' });
        return;
      }
      if (it.has_packing_list) {
        const validRows = it.packing_rows.filter((r) => parseFloat(r.weight_kg) > 0);
        if (validRows.length === 0) {
          toast({ title: 'Validation Error', description: 'Packing list needs at least one bag with weight', variant: 'destructive' });
          return;
        }
        const serials = validRows.map((r) => r.bag_serial);
        if (new Set(serials).size !== serials.length) {
          toast({ title: 'Validation Error', description: 'Duplicate bag serials in packing list', variant: 'destructive' });
          return;
        }
      } else if (!it.quantity) {
        toast({ title: 'Validation Error', description: 'Enter quantity or enable packing list', variant: 'destructive' });
        return;
      }
    }

    createPurchaseMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      resetForm();
    }
  };

  return (
    <div className="space-y-4" onKeyDown={handleKeyPress}>
      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        {/* Header Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Reference No</Label>
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Enter reference"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Supplier Contact</Label>
            <Input
              value={supplierContact}
              onChange={(e) => setSupplierContact(e.target.value)}
              placeholder="Phone or email"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Supplier Name *</Label>
          <Input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Enter supplier name"
          />
        </div>

        {/* Items Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Items</h3>
          {purchaseItems.map((item, index) => (
            <div key={index} className="rounded-md border bg-background p-3 space-y-3">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 md:col-span-5 space-y-1">
                  <Label className="text-xs">Product</Label>
                  <Select
                    value={item.item_id}
                    onValueChange={(value) => updatePurchaseItem(index, 'item_id', value)}
                  >
                    <SelectTrigger className="h-9">
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
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantity}
                    onChange={(e) => updatePurchaseItem(index, 'quantity', e.target.value)}
                    placeholder="0"
                    className="h-9 text-right"
                    disabled={item.has_packing_list}
                  />
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <Label className="text-xs">Rate</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updatePurchaseItem(index, 'unit_price', e.target.value)}
                    placeholder="0.00"
                    className="h-9 text-right"
                  />
                </div>
                <div className="col-span-3 md:col-span-2 space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    value={item.total_price.toFixed(2)}
                    readOnly
                    className="h-9 text-right bg-muted font-semibold"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {purchaseItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePurchaseItem(index)}
                      className="h-9 w-9 text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`pack-${index}`}
                  checked={item.has_packing_list}
                  onCheckedChange={(checked) => updatePurchaseItem(index, 'has_packing_list', !!checked)}
                />
                <Label htmlFor={`pack-${index}`} className="text-sm cursor-pointer flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> Bag/Bale packing list (auto-generates barcode IDs)
                </Label>
              </div>

              {item.has_packing_list && (
                <FiberPackingListEntry
                  rows={item.packing_rows}
                  onChange={(rows) => updatePurchaseItem(index, 'packing_rows', rows)}
                />
              )}
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addPurchaseItem} size="sm">
            + Add Item
          </Button>
        </div>

        {/* Narration */}
        <div className="space-y-1">
          <Label className="text-xs">Narration</Label>
          <Textarea
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
          />
        </div>

        {/* Total + Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <div className="text-xs text-muted-foreground">Grand Total</div>
            <div className="text-2xl font-bold">₹{calculateGrandTotal().toFixed(2)}</div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>
              <span className="underline">Q</span>uit
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={createPurchaseMutation.isPending}>
              {createPurchaseMutation.isPending ? 'Saving…' : <><span className="underline">A</span>ccept</>}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!labelsForPurchase} onOpenChange={(o) => !o && setLabelsForPurchase(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Print Bag/Bale Labels</DialogTitle>
          </DialogHeader>
          {labelsForPurchase && (
            <FiberBagLabels purchaseId={labelsForPurchase} onClose={() => setLabelsForPurchase(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePurchaseInvoice;
