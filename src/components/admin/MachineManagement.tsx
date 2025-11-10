import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { MachineDialog } from './MachineDialog';
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

interface Machine {
  id: string;
  machine_code: string;
  machine_name: string;
  created_at: string;
}

const MachineManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: machines, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_code', { ascending: true });

      if (error) throw error;
      return data as Machine[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Machine Deleted',
        description: 'The machine has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      setDeleteDialogOpen(false);
      setMachineToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (machine: Machine) => {
    setSelectedMachine(machine);
    setDialogOpen(true);
  };

  const handleDelete = (machine: Machine) => {
    setMachineToDelete(machine);
    setDeleteDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedMachine(undefined);
    setDialogOpen(true);
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Machine Management
              </CardTitle>
              <CardDescription>
                Manage production machines and their codes for tracking
              </CardDescription>
            </div>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Machine
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {machines?.map((machine) => (
              <div
                key={machine.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div>
                  <div className="font-semibold text-lg">{machine.machine_code}</div>
                  <div className="text-sm text-muted-foreground">{machine.machine_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Added: {new Date(machine.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(machine)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(machine)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}

            {machines?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8" />
                <p className="text-lg font-medium">No machines found</p>
                <p className="text-sm">Add your first machine to start tracking production</p>
                <Button onClick={handleAddNew} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Machine
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <MachineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        machine={selectedMachine}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the machine "{machineToDelete?.machine_name}" ({machineToDelete?.machine_code}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => machineToDelete && deleteMutation.mutate(machineToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MachineManagement;
