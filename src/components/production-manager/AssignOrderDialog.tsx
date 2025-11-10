import { useState, useEffect } from 'react';
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
import { Users, Package, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';

const assignmentSchema = z.object({
  itemId: z.string().min(1, 'Please select an item'),
  operatorId: z.string().min(1, 'Please select an operator'),
  quantity: z.number()
    .min(1, 'Quantity must be at least 1')
    .int('Quantity must be a whole number'),
});

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

interface PendingAssignment {
  id: string;
  itemId: string;
  operatorId: string;
  quantity: number;
}

export const AssignOrderDialog = ({ order, open, onOpenChange }: AssignOrderDialogProps) => {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [errors, setErrors] = useState<{ itemId?: string; operatorId?: string; quantity?: string }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPendingAssignments([]);
      setSelectedItemId('');
      setSelectedOperatorId('');
      setQuantity(1);
      setErrors({});
    }
  }, [open]);

  const { data: operators } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data: roleRows, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'operator');

      if (rolesError) throw rolesError;
      const ids = roleRows?.map(r => r.user_id) || [];
      if (ids.length === 0) return [] as Operator[];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, employee_code')
        .in('id', ids);

      if (error) throw error;
      return data as Operator[];
    },
    enabled: open,
  });

  // Calculate remaining quantities for each item considering pending assignments
  const getItemRemaining = (itemId: string) => {
    const orderItem = order.order_items.find(item => item.item_id === itemId);
    if (!orderItem) return 0;
    
    const pendingTotal = pendingAssignments
      .filter(a => a.itemId === itemId)
      .reduce((sum, a) => sum + a.quantity, 0);
    
    return orderItem.quantity - orderItem.produced_quantity - pendingTotal;
  };

  // Check if all items are fully assigned
  const allItemsAssigned = order.order_items.every(item => {
    const remaining = getItemRemaining(item.item_id);
    return remaining === 0;
  });

  const addAssignment = () => {
    setErrors({});

    const validation = assignmentSchema.safeParse({
      itemId: selectedItemId,
      operatorId: selectedOperatorId,
      quantity: quantity,
    });

    if (!validation.success) {
      const fieldErrors: { itemId?: string; operatorId?: string; quantity?: string } = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as 'itemId' | 'operatorId' | 'quantity';
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const remaining = getItemRemaining(selectedItemId);
    if (quantity > remaining) {
      setErrors({ quantity: `Quantity exceeds remaining units (${remaining})` });
      return;
    }

    setPendingAssignments(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        itemId: selectedItemId,
        operatorId: selectedOperatorId,
        quantity,
      }
    ]);

    setSelectedItemId('');
    setSelectedOperatorId('');
    setQuantity(1);
    setErrors({});
  };

  const removeAssignment = (id: string) => {
    setPendingAssignments(prev => prev.filter(a => a.id !== id));
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (pendingAssignments.length === 0) {
        throw new Error('No assignments to submit');
      }

      if (!allItemsAssigned) {
        throw new Error('All items must be fully assigned');
      }

      const assignments = pendingAssignments.map(a => ({
        operator_id: a.operatorId,
        item_id: a.itemId,
        quantity_assigned: a.quantity,
        status: 'active' as const,
      }));

      const { error } = await supabase
        .from('operator_assignments')
        .insert(assignments);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Assignments Created',
        description: 'All items have been assigned to operators successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['approved-orders'] });
      queryClient.invalidateQueries({ queryKey: ['operator-assignments'] });
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

  const selectedItem = order.order_items.find(item => item.item_id === selectedItemId);
  const remainingForSelected = selectedItem ? getItemRemaining(selectedItem.item_id) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Order to Operators</DialogTitle>
          <DialogDescription>
            Order: {order.order_number}
          </DialogDescription>
        </DialogHeader>

        {/* Order Items Summary */}
        <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Order Items Status
          </h3>
          <div className="space-y-1">
            {order.order_items.map((item) => {
              const remaining = getItemRemaining(item.item_id);
              const isComplete = remaining === 0;
              return (
                <div key={item.id} className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">
                    {item.items.product_code} - {item.items.product_name}
                    {item.items.color && ` (${item.items.color})`}
                  </span>
                  <Badge variant={isComplete ? "default" : "outline"} className="gap-1">
                    {isComplete ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {remaining} / {item.quantity - item.produced_quantity} remaining
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Assignments */}
        {pendingAssignments.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3 bg-primary/5">
            <h3 className="font-semibold text-sm">Pending Assignments ({pendingAssignments.length})</h3>
            <div className="space-y-2">
              {pendingAssignments.map((assignment) => {
                const item = order.order_items.find(i => i.item_id === assignment.itemId);
                const operator = operators?.find(o => o.id === assignment.operatorId);
                return (
                  <div key={assignment.id} className="flex items-center justify-between text-sm p-2 bg-background rounded border">
                    <div className="flex-1">
                      <span className="font-medium">{item?.items.product_code}</span>
                      {' → '}
                      <span className="text-muted-foreground">{operator?.full_name}</span>
                      {' × '}
                      <span className="font-semibold">{assignment.quantity} units</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeAssignment(assignment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="item">
              <Package className="inline h-4 w-4 mr-2" />
              Select Item
            </Label>
            <Select 
              value={selectedItemId} 
              onValueChange={(value) => {
                setSelectedItemId(value);
                setErrors(prev => ({ ...prev, itemId: undefined }));
              }}
            >
              <SelectTrigger id="item" className={errors.itemId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Choose an item from the order" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {order.order_items.map((item) => (
                  <SelectItem key={item.id} value={item.item_id}>
                    {item.items.product_code} - {item.items.product_name}
                    {item.items.color && ` (${item.items.color})`}
                    {' - '}
                    {item.quantity - item.produced_quantity} remaining
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.itemId && (
              <p className="text-sm text-destructive">{errors.itemId}</p>
            )}
            {selectedItem && (
              <div className="text-sm font-medium text-foreground">
                Available to assign: {remainingForSelected} units
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator">
              <Users className="inline h-4 w-4 mr-2" />
              Select Operator
            </Label>
            <Select 
              value={selectedOperatorId} 
              onValueChange={(value) => {
                setSelectedOperatorId(value);
                setErrors(prev => ({ ...prev, operatorId: undefined }));
              }}
            >
              <SelectTrigger id="operator" className={errors.operatorId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Choose an operator" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {operators?.map((operator) => (
                  <SelectItem key={operator.id} value={operator.id}>
                    {operator.full_name}
                    {operator.employee_code && ` (${operator.employee_code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.operatorId && (
              <p className="text-sm text-destructive">{errors.operatorId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity to Assign</Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                min={1}
                max={remainingForSelected}
                value={quantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setQuantity(value);
                  setErrors(prev => ({ ...prev, quantity: undefined }));
                }}
                disabled={!selectedItemId}
                className={errors.quantity ? 'border-destructive' : ''}
              />
              <Button
                onClick={addAssignment}
                disabled={!selectedItemId || !selectedOperatorId || quantity < 1}
                size="icon"
                type="button"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 border-t">
          {!allItemsAssigned && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>All items must be fully assigned before submitting</span>
            </div>
          )}
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
              disabled={assignMutation.isPending || !allItemsAssigned || pendingAssignments.length === 0}
              className="flex-1"
            >
              {assignMutation.isPending ? 'Submitting...' : `Complete Assignment (${pendingAssignments.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
