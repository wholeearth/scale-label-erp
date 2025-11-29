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

  // Fetch inventory stock levels for items in this order
  const { data: inventoryStock } = useQuery({
    queryKey: ['inventory-stock', order.order_items.map(i => i.item_id)],
    queryFn: async () => {
      const itemIds = order.order_items.map(i => i.item_id);
      
      const { data, error } = await supabase
        .from('inventory')
        .select('item_id, quantity, transaction_type')
        .in('item_id', itemIds);

      if (error) throw error;

      // Calculate net stock per item
      const stockMap = new Map<string, number>();
      data?.forEach(inv => {
        const current = stockMap.get(inv.item_id) || 0;
        if (inv.transaction_type === 'production' || inv.transaction_type === 'purchase') {
          stockMap.set(inv.item_id, current + inv.quantity);
        } else if (inv.transaction_type === 'sales' || inv.transaction_type === 'consumption') {
          stockMap.set(inv.item_id, current - inv.quantity);
        }
      });

      return stockMap;
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

  // Get available stock for an item
  const getAvailableStock = (itemId: string) => {
    return inventoryStock?.get(itemId) || 0;
  };

  // Auto-fill quantity suggestion based on stock
  const getSuggestedQuantity = (itemId: string) => {
    const remaining = getItemRemaining(itemId);
    const stock = getAvailableStock(itemId);
    return Math.min(remaining, stock);
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

        {/* Order Items Summary with Stock Info */}
        <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Order Items & Stock Status
          </h3>
          <div className="space-y-2">
            {order.order_items.map((item) => {
              const remaining = getItemRemaining(item.item_id);
              const stock = getAvailableStock(item.item_id);
              const isComplete = remaining === 0;
              const hasStock = stock > 0;
              
              return (
                <div key={item.id} className="flex items-center justify-between p-2 rounded bg-background/50 border">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {item.items.product_code} - {item.items.product_name}
                      {item.items.color && <span className="text-muted-foreground"> ({item.items.color})</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Ordered: {item.quantity}</span>
                      <span>•</span>
                      <span>Remaining: {remaining}</span>
                      {hasStock && (
                        <>
                          <span>•</span>
                          <span className="text-green-600 dark:text-green-500 font-medium">
                            Stock: {stock} available
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant={isComplete ? "default" : hasStock ? "secondary" : "outline"} className="gap-1 ml-2">
                    {isComplete ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Complete
                      </>
                    ) : hasStock ? (
                      <>
                        <Package className="h-3 w-3" />
                        {Math.min(remaining, stock)} from stock
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        Need {remaining}
                      </>
                    )}
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

        <div className="space-y-4 py-2 border rounded-lg p-4 bg-background">
          <h3 className="font-semibold text-sm">Add Assignment</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item" className="text-xs font-medium">
                <Package className="inline h-3 w-3 mr-1" />
                Item *
              </Label>
              <Select 
                value={selectedItemId} 
                onValueChange={(value) => {
                  setSelectedItemId(value);
                  const suggested = getSuggestedQuantity(value);
                  if (suggested > 0) {
                    setQuantity(suggested);
                  }
                  setErrors(prev => ({ ...prev, itemId: undefined }));
                }}
              >
                <SelectTrigger id="item" className={errors.itemId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select item..." />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {order.order_items.map((item) => {
                    const remaining = getItemRemaining(item.item_id);
                    const stock = getAvailableStock(item.item_id);
                    return (
                      <SelectItem key={item.id} value={item.item_id} disabled={remaining === 0}>
                        <div className="flex items-center justify-between w-full">
                          <span>
                            {item.items.product_code}
                            {item.items.color && ` (${item.items.color})`}
                          </span>
                          {stock > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {stock} in stock
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.itemId && (
                <p className="text-xs text-destructive">{errors.itemId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator" className="text-xs font-medium">
                <Users className="inline h-3 w-3 mr-1" />
                Operator *
              </Label>
              <Select 
                value={selectedOperatorId} 
                onValueChange={(value) => {
                  setSelectedOperatorId(value);
                  setErrors(prev => ({ ...prev, operatorId: undefined }));
                }}
              >
                <SelectTrigger id="operator" className={errors.operatorId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select operator..." />
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
                <p className="text-xs text-destructive">{errors.operatorId}</p>
              )}
            </div>
          </div>

          {selectedItem && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Needed:</span>
                  <span className="ml-1 font-semibold">{remainingForSelected}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">In Stock:</span>
                  <span className="ml-1 font-semibold text-green-600 dark:text-green-500">
                    {getAvailableStock(selectedItem.item_id)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">To Produce:</span>
                  <span className="ml-1 font-semibold text-orange-600 dark:text-orange-500">
                    {Math.max(0, remainingForSelected - getAvailableStock(selectedItem.item_id))}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-xs font-medium">
              Quantity to Assign *
            </Label>
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
                placeholder="Enter quantity..."
              />
              <Button
                onClick={addAssignment}
                disabled={!selectedItemId || !selectedOperatorId || quantity < 1}
                type="button"
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity}</p>
            )}
            {selectedItem && getSuggestedQuantity(selectedItem.item_id) > 0 && (
              <p className="text-xs text-muted-foreground">
                Suggested: {getSuggestedQuantity(selectedItem.item_id)} units (from stock)
              </p>
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
