import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save } from 'lucide-react';

interface AssignmentRow {
  id: string;
  operatorId: string;
  itemId: string;
  quantity: number;
}

export const DirectAssignment = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([
    { id: crypto.randomUUID(), operatorId: '', itemId: '', quantity: 0 }
  ]);

  const { data: operators } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, employee_code')
        .in('id', 
          (await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'operator'))
            .data?.map(r => r.user_id) || []
        );
      
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('product_name');
      
      if (error) throw error;
      return data;
    },
  });

  const createAssignmentsMutation = useMutation({
    mutationFn: async (assignmentData: AssignmentRow[]) => {
      const validAssignments = assignmentData.filter(
        a => a.operatorId && a.itemId && a.quantity > 0
      );

      if (validAssignments.length === 0) {
        throw new Error('Please add at least one valid assignment');
      }

      const insertData = validAssignments.map(a => ({
        operator_id: a.operatorId,
        item_id: a.itemId,
        quantity_assigned: a.quantity,
        quantity_produced: 0,
        status: 'active'
      }));

      const { error } = await supabase
        .from('operator_assignments')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Assignments created successfully' });
      setAssignments([{ id: crypto.randomUUID(), operatorId: '', itemId: '', quantity: 0 }]);
      queryClient.invalidateQueries({ queryKey: ['active-assignments'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error creating assignments', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const addRow = () => {
    setAssignments([...assignments, { id: crypto.randomUUID(), operatorId: '', itemId: '', quantity: 0 }]);
  };

  const removeRow = (id: string) => {
    if (assignments.length === 1) return;
    setAssignments(assignments.filter(a => a.id !== id));
  };

  const updateAssignment = (id: string, field: keyof AssignmentRow, value: string | number) => {
    setAssignments(assignments.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    ));
  };

  const handleSubmit = () => {
    createAssignmentsMutation.mutate(assignments);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Direct Operator Assignment</CardTitle>
        <CardDescription>
          Assign production work directly to operators to keep machines productive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {assignments.map((assignment, index) => (
            <div key={assignment.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={assignment.operatorId}
                  onValueChange={(value) => updateAssignment(assignment.id, 'operatorId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators?.map((operator) => (
                      <SelectItem key={operator.id} value={operator.id}>
                        {operator.full_name} {operator.employee_code && `(${operator.employee_code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Item</Label>
                <Select
                  value={assignment.itemId}
                  onValueChange={(value) => updateAssignment(assignment.id, 'itemId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.product_name} ({item.product_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={assignment.quantity || ''}
                  onChange={(e) => updateAssignment(assignment.id, 'quantity', parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity"
                />
              </div>

              <div className="flex gap-2">
                {index === assignments.length - 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addRow}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                {assignments.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeRow(assignment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSubmit}
            disabled={createAssignmentsMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {createAssignmentsMutation.isPending ? 'Creating...' : 'Create Assignments'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
