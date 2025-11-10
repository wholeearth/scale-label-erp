import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UserCheck, Package, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Assignment {
  id: string;
  quantity_assigned: number;
  quantity_produced: number;
  status: string;
  assigned_at: string;
  profiles: {
    full_name: string;
    employee_code: string | null;
  };
  items: {
    product_code: string;
    product_name: string;
    color: string | null;
  };
}

export const ActiveAssignments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('');

  const { data: assignments, isLoading, refetch: refetchAssignments } = useQuery({
    queryKey: ['operator-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_assignments')
        .select(`
          id,
          quantity_assigned,
          quantity_produced,
          status,
          assigned_at,
          profiles!operator_assignments_operator_id_fkey (
            full_name,
            employee_code
          ),
          items (
            product_code,
            product_name,
            color
          )
        `)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data as Assignment[];
    },
    refetchInterval: 3000, // Auto-refresh every 3 seconds for real-time progress updates
  });

  // Set up real-time subscription for assignment updates
  useEffect(() => {
    const channel = supabase
      .channel('assignments-progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'operator_assignments',
        },
        (payload) => {
          console.log('Assignment progress updated:', payload);
          refetchAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchAssignments]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_assignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-assignments'] });
      toast({
        title: 'Assignment deleted',
        description: 'The assignment has been successfully removed.',
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase
        .from('operator_assignments')
        .update({ quantity_assigned: quantity })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-assignments'] });
      toast({
        title: 'Assignment updated',
        description: 'The quantity has been successfully updated.',
      });
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setEditQuantity(assignment.quantity_assigned.toString());
    setEditDialogOpen(true);
  };

  const handleDelete = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedAssignment) {
      deleteMutation.mutate(selectedAssignment.id);
    }
  };

  const confirmEdit = () => {
    if (selectedAssignment && editQuantity) {
      const quantity = parseInt(editQuantity);
      if (quantity > 0 && quantity >= selectedAssignment.quantity_produced) {
        editMutation.mutate({ id: selectedAssignment.id, quantity });
      } else {
        toast({
          title: 'Invalid quantity',
          description: 'Quantity must be greater than units already produced.',
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = (produced: number, assigned: number) => {
    return Math.round((produced / assigned) * 100);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Active Assignments
          </CardTitle>
          <CardDescription>Current production assignments to operators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assignments?.map((assignment) => {
              const progress = progressPercentage(assignment.quantity_produced, assignment.quantity_assigned);
              return (
                <div
                  key={assignment.id}
                  className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {assignment.profiles.full_name}
                          {assignment.profiles.employee_code && 
                            ` (${assignment.profiles.employee_code})`
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-3 w-3" />
                        {assignment.items.product_code} - {assignment.items.product_name}
                        {assignment.items.color && ` (${assignment.items.color})`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(assignment)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(assignment)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">
                        {assignment.quantity_produced} / {assignment.quantity_assigned} units
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between items-center">
                      <Badge 
                        variant={progress === 100 ? "default" : "secondary"}
                      >
                        {progress}% Complete
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {assignment.quantity_assigned - assignment.quantity_produced} remaining
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {assignments?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No active assignments
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Assignment Quantity</DialogTitle>
            <DialogDescription>
              Update the assigned quantity for this production task.
            </DialogDescription>
          </DialogHeader>
          {selectedAssignment && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{selectedAssignment.profiles.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAssignment.items.product_code} - {selectedAssignment.items.product_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {selectedAssignment.quantity_produced} / {selectedAssignment.quantity_assigned} units
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">New Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={selectedAssignment.quantity_produced}
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  placeholder="Enter quantity"
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least {selectedAssignment.quantity_produced} (units already produced)
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmEdit} disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this assignment? This action cannot be undone.
              {selectedAssignment && (
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-foreground">
                    {selectedAssignment.profiles.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAssignment.items.product_code} - {selectedAssignment.items.product_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedAssignment.quantity_produced} / {selectedAssignment.quantity_assigned} units completed
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
