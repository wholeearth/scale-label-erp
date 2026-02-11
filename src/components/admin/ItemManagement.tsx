import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ItemDialog from './ItemDialog';
import type { Tables } from '@/integrations/supabase/types';

type Item = Tables<'items'>;
type Unit = Tables<'units'>;

const ItemManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*, units(name, abbreviation)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: 'Item deleted',
        description: 'The item has been successfully deleted.',
      });
      setDeletingItemId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Item Master Management</CardTitle>
              <CardDescription>Manage products, raw materials, and item specifications</CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading items...</div>
          ) : items && items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Length (yards)</TableHead>
                    <TableHead>Width (inches)</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_code}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          item.item_type === 'finished_good' ? 'default' : 
                          item.item_type === 'raw_material' ? 'secondary' : 'outline'
                        }>
                          {item.item_type === 'raw_material' ? 'Raw Material' : 
                           item.item_type === 'intermediate_type_1' ? 'Intermediate 1' : 
                           item.item_type === 'intermediate_type_2' ? 'Intermediate 2' : 
                           'Finished Goods'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.color || '-'}</TableCell>
                      <TableCell>{item.length_yards || '-'}</TableCell>
                      <TableCell>{item.width_inches || '-'}</TableCell>
                      <TableCell>{item.units?.abbreviation || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingItem(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeletingItemId(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No items found. Click "Add Item" to create your first item.
            </div>
          )}
        </CardContent>
      </Card>

      <ItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        units={units || []}
      />

      <ItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        units={units || []}
      />

      <AlertDialog open={!!deletingItemId} onOpenChange={(open) => !open && setDeletingItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingItemId && deleteMutation.mutate(deletingItemId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ItemManagement;
