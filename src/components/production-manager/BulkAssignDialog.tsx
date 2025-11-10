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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface OrderItem {
  id: string;
  item_id: string;
  quantity: number;
  produced_quantity: number;
  items: {
    product_code: string;
    product_name: string;
    color: string | null;
  };
}

interface Order {
  id: string;
  order_number: string;
  customers: {
    customer_name: string;
  } | null;
  order_items: OrderItem[];
}

interface BulkAssignDialogProps {
  orders: Order[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AggregatedItem {
  item_id: string;
  product_code: string;
  product_name: string;
  color: string | null;
  total_quantity: number;
  total_produced: number;
  remaining_quantity: number;
}

interface OperatorAssignment {
  operator_id: string;
  quantity: number;
}

interface Operator {
  id: string;
  full_name: string;
  employee_code: string | null;
}

export const BulkAssignDialog = ({ orders, open, onOpenChange }: BulkAssignDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [assignments, setAssignments] = useState<OperatorAssignment[]>([]);

  // Aggregate items across selected orders
  const aggregatedItems: AggregatedItem[] = orders.reduce((acc, order) => {
    order.order_items.forEach(item => {
      // Skip if item or items data is missing
      if (!item.item_id || !item.items) {
        console.warn('Skipping item with missing data:', item);
        return;
      }

      const existing = acc.find(a => a.item_id === item.item_id);
      if (existing) {
        existing.total_quantity += item.quantity;
        existing.total_produced += item.produced_quantity;
        existing.remaining_quantity += (item.quantity - item.produced_quantity);
      } else {
        acc.push({
          item_id: item.item_id,
          product_code: item.items.product_code,
          product_name: item.items.product_name,
          color: item.items.color,
          total_quantity: item.quantity,
          total_produced: item.produced_quantity,
          remaining_quantity: item.quantity - item.produced_quantity,
        });
      }
    });
    return acc;
  }, [] as AggregatedItem[]);

  console.log('Aggregated items for bulk assign:', aggregatedItems);

  const selectedItem = aggregatedItems.find(item => item.item_id === selectedItemId);

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
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItemId || assignments.length === 0) return;

      console.log('Selected item ID:', selectedItemId);
      console.log('Aggregated items:', aggregatedItems);
      console.log('Selected item:', selectedItem);

      const assignmentData = assignments.map(assignment => ({
        operator_id: assignment.operator_id,
        item_id: selectedItemId,
        quantity_assigned: assignment.quantity,
        status: 'active',
      }));

      console.log('Assignment data to insert:', assignmentData);

      const { error } = await supabase
        .from('operator_assignments')
        .insert(assignmentData);

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Assignments created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['approved-orders'] });
      queryClient.invalidateQueries({ queryKey: ['active-assignments'] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Assignment error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create assignments',
        variant: 'destructive',
      });
    },
  });

  const addAssignment = () => {
    setAssignments([...assignments, { operator_id: '', quantity: 0 }]);
  };

  const updateAssignment = (index: number, field: 'operator_id' | 'quantity', value: string | number) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], [field]: value };
    setAssignments(updated);
  };

  const removeAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const totalAssigned = assignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
  const canSubmit = selectedItemId && assignments.length > 0 && 
    assignments.every(a => a.operator_id && a.quantity > 0) &&
    totalAssigned <= (selectedItem?.remaining_quantity || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Assign Orders to Operators</DialogTitle>
          <DialogDescription>
            {orders.length} order(s) selected. Assign aggregated items to operators.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Aggregated Items Summary */}
          <div>
            <Label>Aggregated Items Across Selected Orders</Label>
            <div className="mt-2 space-y-2">
              {aggregatedItems.map((item) => (
                <Card key={item.item_id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {item.product_code} - {item.product_name}
                        </div>
                        {item.color && (
                          <div className="text-sm text-muted-foreground">
                            Color: {item.color}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {item.remaining_quantity} remaining
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ({item.total_produced} / {item.total_quantity} produced)
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Item Selection */}
          <div>
            <Label>Select Item to Assign</Label>
            <Select value={selectedItemId} onValueChange={(value) => {
              setSelectedItemId(value);
              setAssignments([]);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an item" />
              </SelectTrigger>
              <SelectContent>
                {aggregatedItems.map((item) => (
                  <SelectItem key={item.item_id} value={item.item_id}>
                    {item.product_code} - {item.product_name} ({item.remaining_quantity} remaining)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operator Assignments */}
          {selectedItemId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Operator Assignments</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAssignment}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Operator
                </Button>
              </div>

              {assignments.map((assignment, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Operator</Label>
                    <Select
                      value={assignment.operator_id}
                      onValueChange={(value) => updateAssignment(index, 'operator_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose operator" />
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
                  </div>
                  <div className="w-32">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={assignment.quantity || ''}
                      onChange={(e) => updateAssignment(index, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAssignment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {selectedItem && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Total Remaining:</span>
                      <span className="font-semibold">{selectedItem.remaining_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Assigned:</span>
                      <span className={totalAssigned > selectedItem.remaining_quantity ? 'text-destructive font-semibold' : 'font-semibold'}>
                        {totalAssigned}
                      </span>
                    </div>
                    {totalAssigned > selectedItem.remaining_quantity && (
                      <div className="text-xs text-destructive mt-2">
                        ⚠ Total assigned exceeds remaining quantity
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!canSubmit || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign to Operators'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
