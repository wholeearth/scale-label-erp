import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface ReturnItem {
  item_id: string;
  quantity: string;
  unit_price: string;
  total_price: string;
}

export function PurchaseReturnForm() {
  const [purchaseId, setPurchaseId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([
    { item_id: '', quantity: '', unit_price: '', total_price: '' }
  ]);
  const queryClient = useQueryClient();

  const { data: purchases } = useQuery({
    queryKey: ["purchases-for-return"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, purchase_number, supplier_name")
        .order("purchase_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["items-for-purchase-return"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, product_code, product_name")
        .order("product_code");

      if (error) throw error;
      return data;
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!purchaseId) throw new Error('Purchase is required');
      if (returnItems.some(item => !item.item_id || !item.quantity || !item.total_price)) {
        throw new Error('All item fields must be filled');
      }

      // Create purchase return entry (you'll need to create this table)
      const totalAmount = returnItems.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
      
      // For now, create journal entry for purchase return
      const { data: entryNumber } = await supabase.rpc("generate_journal_entry_number");
      
      const { error: jeError } = await supabase
        .from("journal_entries")
        .insert({
          entry_number: entryNumber,
          entry_date: returnDate,
          description: `Purchase Return - ${reason}`,
          reference_type: 'purchase_return',
          reference_number: purchaseId,
          total_debit: totalAmount,
          total_credit: totalAmount,
          status: 'draft',
        });

      if (jeError) throw jeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Purchase return created successfully");
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setPurchaseId('');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setNotes('');
    setReturnItems([{ item_id: '', quantity: '', unit_price: '', total_price: '' }]);
  };

  const addReturnItem = () => {
    setReturnItems([...returnItems, { item_id: '', quantity: '', unit_price: '', total_price: '' }]);
  };

  const removeReturnItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: string) => {
    const updated = [...returnItems];
    updated[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = parseFloat(updated[index].quantity || '0');
      const price = parseFloat(updated[index].unit_price || '0');
      updated[index].total_price = (qty * price).toFixed(2);
    }
    
    setReturnItems(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase Return</CardTitle>
        <CardDescription>Create a new purchase return voucher</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="purchase">Purchase Invoice</Label>
            <Select value={purchaseId} onValueChange={setPurchaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select purchase" />
              </SelectTrigger>
              <SelectContent>
                {purchases?.map((purchase) => (
                  <SelectItem key={purchase.id} value={purchase.id}>
                    {purchase.purchase_number} - {purchase.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="returnDate">Return Date</Label>
            <Input
              id="returnDate"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for return"
          />
        </div>

        <div className="space-y-2">
          <Label>Return Items</Label>
          <div className="space-y-2">
            {returnItems.map((item, index) => (
              <div key={index} className="grid grid-cols-5 gap-2">
                <Select
                  value={item.item_id}
                  onValueChange={(value) => updateReturnItem(index, 'item_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((itm) => (
                      <SelectItem key={itm.id} value={itm.id}>
                        {itm.product_code} - {itm.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={item.quantity}
                  onChange={(e) => updateReturnItem(index, 'quantity', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Unit Price"
                  value={item.unit_price}
                  onChange={(e) => updateReturnItem(index, 'unit_price', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Total"
                  value={item.total_price}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeReturnItem(index)}
                  disabled={returnItems.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addReturnItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => createReturnMutation.mutate()}
            disabled={createReturnMutation.isPending}
          >
            {createReturnMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Return
          </Button>
          <Button type="button" variant="outline" onClick={resetForm}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
