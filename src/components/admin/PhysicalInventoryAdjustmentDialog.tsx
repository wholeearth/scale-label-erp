import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface PhysicalInventoryAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    item_id: string;
    product_code: string;
    product_name: string;
    total_quantity: number;
    total_weight: number;
  } | null;
}

export function PhysicalInventoryAdjustmentDialog({
  open,
  onOpenChange,
  item,
}: PhysicalInventoryAdjustmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [physicalCount, setPhysicalCount] = useState('');
  const [physicalWeight, setPhysicalWeight] = useState('');
  const [reason, setReason] = useState('');

  const adjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!item) return;

      const newQuantity = parseFloat(physicalCount);
      const newWeight = parseFloat(physicalWeight);
      const quantityDiff = newQuantity - item.total_quantity;
      const weightDiff = newWeight - item.total_weight;

      if (quantityDiff === 0 && weightDiff === 0) {
        throw new Error('No adjustment needed - quantities match');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create inventory adjustment transaction
      const { error: inventoryError } = await supabase
        .from('inventory')
        .insert({
          item_id: item.item_id,
          transaction_type: 'adjustment',
          quantity: quantityDiff,
          weight_kg: weightDiff,
          reference_id: null,
        });

      if (inventoryError) throw inventoryError;

      // Get chart of accounts for journal entry
      const { data: inventoryAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('account_code', '1400')
        .single();

      const { data: adjustmentAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('account_code', '5300')
        .single();

      if (!inventoryAccount || !adjustmentAccount) {
        throw new Error('Required accounts not found');
      }

      // Create journal entry
      const entryDescription = `Physical inventory adjustment - ${item.product_name} (${item.product_code}). Reason: ${reason}`;
      const adjustmentValue = Math.abs(quantityDiff * 50); // Assuming average cost of 50 per unit

      // Generate entry number
      const { data: entryData } = await supabase.rpc('generate_journal_entry_number');
      const entryNumber = entryData || `JE-${Date.now()}`;

      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          description: entryDescription,
          reference_type: 'inventory_adjustment',
          reference_number: item.product_code,
          created_by: user.id,
          status: 'posted',
          total_debit: quantityDiff > 0 ? adjustmentValue : 0,
          total_credit: quantityDiff > 0 ? 0 : adjustmentValue,
        })
        .select()
        .single();

      if (journalError) throw journalError;

      // Create journal entry lines
      const lines = quantityDiff > 0 ? [
        // Increase inventory (debit)
        {
          journal_entry_id: journalEntry.id,
          account_id: inventoryAccount.id,
          debit_amount: adjustmentValue,
          credit_amount: 0,
          description: 'Inventory increase',
        },
        // Credit inventory adjustment account
        {
          journal_entry_id: journalEntry.id,
          account_id: adjustmentAccount.id,
          debit_amount: 0,
          credit_amount: adjustmentValue,
          description: 'Adjustment gain',
        },
      ] : [
        // Decrease inventory (credit)
        {
          journal_entry_id: journalEntry.id,
          account_id: inventoryAccount.id,
          debit_amount: 0,
          credit_amount: adjustmentValue,
          description: 'Inventory decrease',
        },
        // Debit inventory adjustment account
        {
          journal_entry_id: journalEntry.id,
          account_id: adjustmentAccount.id,
          debit_amount: adjustmentValue,
          credit_amount: 0,
          description: 'Adjustment loss',
        },
      ];

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return { quantityDiff, weightDiff };
    },
    onSuccess: (data) => {
      if (!data) return;
      
      toast({
        title: 'Adjustment Recorded',
        description: `Inventory adjusted by ${data.quantityDiff > 0 ? '+' : ''}${data.quantityDiff} units`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      
      onOpenChange(false);
      setPhysicalCount('');
      setPhysicalWeight('');
      setReason('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!physicalCount || !physicalWeight || !reason) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    adjustmentMutation.mutate();
  };

  if (!item) return null;

  const quantityDiff = physicalCount ? parseFloat(physicalCount) - item.total_quantity : 0;
  const weightDiff = physicalWeight ? parseFloat(physicalWeight) - item.total_weight : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Physical Inventory Adjustment</DialogTitle>
          <DialogDescription>
            Record physical count differences for {item.product_name} ({item.product_code})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Current System Quantity</Label>
              <div className="text-2xl font-bold">{item.total_quantity}</div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Current System Weight</Label>
              <div className="text-2xl font-bold">{item.total_weight.toFixed(2)} kg</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="physical-count">Physical Count</Label>
            <Input
              id="physical-count"
              type="number"
              step="0.001"
              value={physicalCount}
              onChange={(e) => setPhysicalCount(e.target.value)}
              placeholder="Enter actual counted quantity"
              required
            />
            {quantityDiff !== 0 && (
              <p className={`text-sm ${quantityDiff > 0 ? 'text-green-600' : 'text-destructive'}`}>
                Difference: {quantityDiff > 0 ? '+' : ''}{quantityDiff.toFixed(3)} units
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="physical-weight">Physical Weight (kg)</Label>
            <Input
              id="physical-weight"
              type="number"
              step="0.001"
              value={physicalWeight}
              onChange={(e) => setPhysicalWeight(e.target.value)}
              placeholder="Enter actual weight"
              required
            />
            {weightDiff !== 0 && (
              <p className={`text-sm ${weightDiff > 0 ? 'text-green-600' : 'text-destructive'}`}>
                Difference: {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(3)} kg
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Adjustment</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Physical count variance, damaged goods, shrinkage..."
              rows={3}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adjustmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustmentMutation.isPending || quantityDiff === 0}
            >
              {adjustmentMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Record Adjustment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
