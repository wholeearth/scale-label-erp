import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Unit = Tables<'units'>;

const unitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  abbreviation: z.string().min(1, 'Abbreviation is required').max(20),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface UnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: Unit | null;
}

const UnitDialog = ({ open, onOpenChange, unit }: UnitDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      name: '',
      abbreviation: '',
    },
  });

  useEffect(() => {
    if (unit) {
      form.reset({
        name: unit.name,
        abbreviation: unit.abbreviation,
      });
    } else {
      form.reset({
        name: '',
        abbreviation: '',
      });
    }
  }, [unit, form]);

  const mutation = useMutation({
    mutationFn: async (data: UnitFormData) => {
      const unitData = {
        name: data.name,
        abbreviation: data.abbreviation,
      };

      if (unit) {
        const { error } = await supabase
          .from('units')
          .update(unitData)
          .eq('id', unit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('units').insert([unitData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast({
        title: unit ? 'Unit updated' : 'Unit created',
        description: `The unit has been successfully ${unit ? 'updated' : 'created'}.`,
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: UnitFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{unit ? 'Edit Unit' : 'Add New Unit'}</DialogTitle>
          <DialogDescription>
            {unit ? 'Update the unit details below.' : 'Enter the details for the new unit of measure.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Kilogram" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="abbreviation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., kg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : unit ? 'Update Unit' : 'Create Unit'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default UnitDialog;
