import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Users, Package } from 'lucide-react';

interface AssignOrderDialogProps {
  order: {
    id: string;
    order_number: string;
    order_items: Array<{
      id: string;
      item_id: string;
      quantity: number;
      produced_quantity: number;
      items: {
        product_code: string;
        product_name: string;
        color: string | null;
      };
    }>;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Operator {
  id: string;
  full_name: string;
  employee_code: string | null;
}

export const AssignOrderDialog = ({ order, open, onOpenChange }: AssignOrderDialogProps) => {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: operators } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          employee_code,
          user_roles!inner(role)
        `)
        .eq('user_roles.role', 'operator');

      if (error) throw error;
      return data as Operator[];
    },
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItemId || !selectedOperatorId || !quantity) {
        throw new Error('Please fill all fields');
      }

      const { error } = await supabase
        .from('operator_assignments')
        .insert({
          operator_id: selectedOperatorId,
          item_id: selectedItemId,
          quantity_assigned: quantity,
          status: 'active',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Assignment Created',
        description: 'The order has been assigned to the operator successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['approved-orders'] });
      queryClient.invalidateQueries({ queryKey: ['operator-assignments'] });
      setSelectedItemId('');
      setSelectedOperatorId('');
      setQuantity(1);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Assignment Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const selectedItem = order.order_items.find(item => item.id === selectedItemId);
  const remainingQuantity = selectedItem 
    ? selectedItem.quantity - selectedItem.produced_quantity 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Order to Operator</DialogTitle>
          <DialogDescription>
            Order: {order.order_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item">
              <Package className="inline h-4 w-4 mr-2" />
              Select Item
            </Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger id="item">
                <SelectValue placeholder="Choose an item from the order" />
              </SelectTrigger>
              <SelectContent>
                {order.order_items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.items.product_code} - {item.items.product_name}
                    {item.items.color && ` (${item.items.color})`}
                    {' - '}
                    {item.quantity - item.produced_quantity} remaining
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedItem && (
              <div className="text-sm text-muted-foreground">
                Remaining to produce: {remainingQuantity} units
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator">
              <Users className="inline h-4 w-4 mr-2" />
              Select Operator
            </Label>
            <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
              <SelectTrigger id="operator">
                <SelectValue placeholder="Choose an operator" />
              </SelectTrigger>
              <SelectContent>
                {operators?.map((operator) => (
                  <SelectItem key={operator.id} value={operator.id}>
                    {operator.full_name}
                    {operator.employee_code && ` (${operator.employee_code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity to Assign</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={remainingQuantity}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              disabled={!selectedItemId}
            />
            {selectedItemId && quantity > remainingQuantity && (
              <div className="text-sm text-destructive">
                Quantity exceeds remaining units
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={
              !selectedItemId || 
              !selectedOperatorId || 
              !quantity || 
              quantity > remainingQuantity ||
              assignMutation.isPending
            }
            className="flex-1"
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign to Operator'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
