import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Check, X } from 'lucide-react';

export const SurplusAllocations = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allocations } = useQuery({
    queryKey: ['surplus-allocations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surplus_allocations')
        .select('*, items(product_name, product_code)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      // Enrich with order numbers
      const orderIds = Array.from(
        new Set(
          (data || [])
            .flatMap((a: any) => [a.source_order_id, a.target_order_id])
            .filter(Boolean),
        ),
      );
      const { data: orders } = orderIds.length
        ? await supabase.from('orders').select('id, order_number').in('id', orderIds)
        : { data: [] };
      const orderMap = new Map((orders || []).map((o: any) => [o.id, o.order_number]));
      return (data || []).map((a: any) => ({
        ...a,
        source_order_number: orderMap.get(a.source_order_id),
        target_order_number: orderMap.get(a.target_order_id),
      }));
    },
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'applied' | 'cancelled' }) => {
      const { error } = await supabase.from('surplus_allocations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.status === 'applied' ? 'Allocation applied' : 'Allocation cancelled' });
      qc.invalidateQueries({ queryKey: ['surplus-allocations'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Surplus Allocation Suggestions</CardTitle>
        <CardDescription>System auto-suggests reusing overproduction to fulfill other pending orders for the same item.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>From Order</TableHead>
              <TableHead>To Order</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(allocations || []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.items?.product_name}</TableCell>
                <TableCell className="font-mono text-xs">{a.source_order_number || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{a.target_order_number || '—'}</TableCell>
                <TableCell className="text-right">{Number(a.quantity)}</TableCell>
                <TableCell>
                  <Badge variant={a.status === 'applied' ? 'default' : a.status === 'cancelled' ? 'destructive' : 'outline'}>
                    {a.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {a.status === 'suggested' && (
                    <>
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: a.id, status: 'applied' })}>
                        <Check className="h-3 w-3 mr-1" /> Apply
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: a.id, status: 'cancelled' })}>
                        <X className="h-3 w-3 mr-1" /> Skip
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!allocations || allocations.length === 0) && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No surplus suggestions</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SurplusAllocations;
