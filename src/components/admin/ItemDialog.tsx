import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Item = Tables<'items'>;
type Unit = Tables<'units'>;

const itemSchema = z.object({
  product_code: z.string().min(1, 'Product code is required').max(50),
  product_name: z.string().min(1, 'Product name is required').max(200),
  item_type: z.enum(['finished_good', 'raw_material']),
  color: z.string().max(50).optional(),
  length_yards: z.string().optional(),
  width_inches: z.string().optional(),
  unit_id: z.string().optional(),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  units: Unit[];
}

const ItemDialog = ({ open, onOpenChange, item, units }: ItemDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      product_code: '',
      product_name: '',
      item_type: 'finished_good',
      color: '',
      length_yards: '',
      width_inches: '',
      unit_id: '',
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        product_code: item.product_code,
        product_name: item.product_name,
        item_type: item.item_type as 'finished_good' | 'raw_material',
        color: item.color || '',
        length_yards: item.length_yards?.toString() || '',
        width_inches: item.width_inches?.toString() || '',
        unit_id: item.unit_id || '',
      });
    } else {
      form.reset({
        product_code: '',
        product_name: '',
        item_type: 'finished_good',
        color: '',
        length_yards: '',
        width_inches: '',
        unit_id: '',
      });
    }
  }, [item, form]);

  const mutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      const itemData = {
        product_code: data.product_code,
        product_name: data.product_name,
        item_type: data.item_type,
        color: data.color || null,
        length_yards: data.length_yards ? parseFloat(data.length_yards) : null,
        width_inches: data.width_inches ? parseFloat(data.width_inches) : null,
        unit_id: data.unit_id || null,
      };

      if (item) {
        const { error } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('items').insert(itemData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: item ? 'Item updated' : 'Item created',
        description: `The item has been successfully ${item ? 'updated' : 'created'}.`,
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

  const onSubmit = (data: ItemFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the item details below.' : 'Enter the details for the new item.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="product_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2770" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="item_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="finished_good">Finished Good</SelectItem>
                        <SelectItem value="raw_material">Raw Material</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Cotton Fabric Roll" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Blue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.abbreviation})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="length_yards"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Length (yards)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="width_inches"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Width (inches)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 60" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ItemDialog;
