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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Item = Tables<'items'>;
type Unit = Tables<'units'>;

const itemSchema = z.object({
  product_code: z.string().min(1, 'Product code is required').max(50),
  product_name: z.string().min(1, 'Product name is required').max(200),
  item_type: z.enum(['finished_good', 'raw_material', 'intermediate_type_1', 'intermediate_type_2']),
  color: z.string().max(50).optional(),
  length_yards: z.string().optional(),
  width_inches: z.string().optional(),
  unit_id: z.string().optional(),
  predefined_weight_kg: z.string().optional(),
  use_predefined_weight: z.boolean().default(false),
  manual_weight_entry: z.boolean().default(false),
  manual_length_entry: z.boolean().default(false),
  is_intermediate_product: z.boolean().default(false),
  expected_weight_kg: z.string().optional(),
  weight_tolerance_percentage: z.string().optional(),
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
      predefined_weight_kg: '',
      use_predefined_weight: false,
      manual_weight_entry: false,
      manual_length_entry: false,
      is_intermediate_product: false,
      expected_weight_kg: '',
      weight_tolerance_percentage: '10',
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        product_code: item.product_code,
        product_name: item.product_name,
        item_type: item.item_type as 'finished_good' | 'raw_material' | 'intermediate_type_1' | 'intermediate_type_2',
        color: item.color || '',
        length_yards: item.length_yards?.toString() || '',
        width_inches: item.width_inches?.toString() || '',
        unit_id: item.unit_id || '',
        predefined_weight_kg: item.predefined_weight_kg?.toString() || '',
        use_predefined_weight: item.use_predefined_weight || false,
        manual_weight_entry: (item as any).manual_weight_entry || false,
        manual_length_entry: (item as any).manual_length_entry || false,
        is_intermediate_product: (item as any).is_intermediate_product || false,
        expected_weight_kg: (item as any).expected_weight_kg?.toString() || '',
        weight_tolerance_percentage: (item as any).weight_tolerance_percentage?.toString() || '10',
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
        predefined_weight_kg: '',
        use_predefined_weight: false,
        manual_weight_entry: false,
        manual_length_entry: false,
        is_intermediate_product: false,
        expected_weight_kg: '',
        weight_tolerance_percentage: '10',
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
        predefined_weight_kg: data.predefined_weight_kg ? parseFloat(data.predefined_weight_kg) : null,
        use_predefined_weight: data.use_predefined_weight,
        manual_weight_entry: data.manual_weight_entry,
        manual_length_entry: data.manual_length_entry,
        is_intermediate_product: data.is_intermediate_product,
        expected_weight_kg: data.expected_weight_kg ? parseFloat(data.expected_weight_kg) : null,
        weight_tolerance_percentage: data.weight_tolerance_percentage ? parseFloat(data.weight_tolerance_percentage) : 10,
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
                        <SelectItem value="intermediate_type_1">Intermediate Type 1 (Non-Fused Interlining)</SelectItem>
                        <SelectItem value="intermediate_type_2">Intermediate Type 2 (Fusible Interlining)</SelectItem>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="predefined_weight_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Predefined Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 25.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="use_predefined_weight"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-start gap-3 space-y-0 pt-8">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Use predefined weight for printing
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-4">Production Entry Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="manual_weight_entry"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Manual weight entry
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="manual_length_entry"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Manual length entry
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_intermediate_product"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Intermediate product (jumbo roll)
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-4">Quality Control Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expected_weight_kg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Weight (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 40.0" {...field} />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Used for quality control weight variance checks
                      </p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight_tolerance_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight Tolerance (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" min="0" max="100" placeholder="e.g., 10" {...field} />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Acceptable deviation from expected weight (default: 10%)
                      </p>
                    </FormItem>
                  )}
                />
              </div>
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
