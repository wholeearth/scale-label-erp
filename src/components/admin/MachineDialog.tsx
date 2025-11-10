import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const machineSchema = z.object({
  machine_code: z
    .string()
    .trim()
    .min(1, 'Machine code is required')
    .max(20, 'Machine code must be less than 20 characters')
    .regex(/^[A-Z0-9-]+$/, 'Machine code must contain only uppercase letters, numbers, and hyphens'),
  machine_name: z
    .string()
    .trim()
    .min(1, 'Machine name is required')
    .max(100, 'Machine name must be less than 100 characters'),
});

type MachineFormData = z.infer<typeof machineSchema>;

interface MachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine?: {
    id: string;
    machine_code: string;
    machine_name: string;
  };
}

export const MachineDialog = ({ open, onOpenChange, machine }: MachineDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MachineFormData>({
    resolver: zodResolver(machineSchema),
  });

  useEffect(() => {
    if (machine) {
      reset({
        machine_code: machine.machine_code,
        machine_name: machine.machine_name,
      });
    } else {
      reset({
        machine_code: '',
        machine_name: '',
      });
    }
  }, [machine, reset, open]);

  const createMutation = useMutation({
    mutationFn: async (data: MachineFormData) => {
      const { error } = await supabase
        .from('machines')
        .insert({
          machine_code: data.machine_code,
          machine_name: data.machine_name,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Machine Created',
        description: 'The machine has been successfully created.',
      });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MachineFormData) => {
      if (!machine?.id) throw new Error('Machine ID is required');

      const { error } = await supabase
        .from('machines')
        .update({
          machine_code: data.machine_code,
          machine_name: data.machine_name,
        })
        .eq('id', machine.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Machine Updated',
        description: 'The machine has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: MachineFormData) => {
    if (machine) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{machine ? 'Edit Machine' : 'Add New Machine'}</DialogTitle>
          <DialogDescription>
            {machine
              ? 'Update the machine details below'
              : 'Enter machine details for production tracking'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="machine_code">
              Machine Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="machine_code"
              placeholder="e.g., M1, M2, MC-001"
              {...register('machine_code')}
              className={errors.machine_code ? 'border-destructive' : ''}
            />
            {errors.machine_code && (
              <p className="text-sm text-destructive">{errors.machine_code.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Uppercase letters, numbers, and hyphens only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="machine_name">
              Machine Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="machine_name"
              placeholder="e.g., Weaving Machine 1, Dyeing Unit 2"
              {...register('machine_name')}
              className={errors.machine_name ? 'border-destructive' : ''}
            />
            {errors.machine_name && (
              <p className="text-sm text-destructive">{errors.machine_name.message}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : machine
                ? 'Update Machine'
                : 'Add Machine'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
