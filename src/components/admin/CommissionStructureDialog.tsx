import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface CommissionStructureDialogProps {
  agentId: string;
  onClose: () => void;
}

export const CommissionStructureDialog = ({ agentId, onClose }: CommissionStructureDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [itemId, setItemId] = useState('none');
  const [commissionType, setCommissionType] = useState('');
  const [commissionRate, setCommissionRate] = useState('');

  const { data: structures, isLoading } = useQuery({
    queryKey: ['commission-structures', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_structures')
        .select('*, items(product_name, product_code)')
        .eq('agent_id', agentId);
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('commission_structures')
        .insert({
          agent_id: agentId,
          item_id: itemId === 'none' ? null : itemId || null,
          commission_type: commissionType,
          commission_rate: Number(commissionRate),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Commission structure added' });
      queryClient.invalidateQueries({ queryKey: ['commission-structures', agentId] });
      setItemId('none');
      setCommissionType('');
      setCommissionRate('');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('commission_structures')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Commission structure deleted' });
      queryClient.invalidateQueries({ queryKey: ['commission-structures', agentId] });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Commission Structure</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Item (Optional)</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="All items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All items</SelectItem>
                  {items?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Type</Label>
              <Select value={commissionType} onValueChange={setCommissionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="per_kg">Per KG</SelectItem>
                  <SelectItem value="per_yard">Per Yard</SelectItem>
                  <SelectItem value="per_meter">Per Meter</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rate</Label>
              <Input
                type="number"
                step="0.01"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!commissionType || !commissionRate}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures?.map((structure) => (
                  <TableRow key={structure.id}>
                    <TableCell>
                      {structure.items?.product_name || 'All Items (Default)'}
                    </TableCell>
                    <TableCell className="capitalize">
                      {structure.commission_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      {structure.commission_type === 'percentage' 
                        ? `${structure.commission_rate}%`
                        : `₹${structure.commission_rate}`}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(structure.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
