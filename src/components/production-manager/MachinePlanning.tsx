import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Factory } from 'lucide-react';

interface PlanRow {
  id: string;
  orderItemId: string;
  machineId: string;
  plannedQuantity: number;
  priority: number;
  plannedDate: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export const MachinePlanning = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [rows, setRows] = useState<PlanRow[]>([
    { id: crypto.randomUUID(), orderItemId: '', machineId: '', plannedQuantity: 0, priority: 3, plannedDate: todayISO() },
  ]);

  const { data: orders } = useQuery({
    queryKey: ['plannable-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, customer_id, customers(customer_name)')
        .in('status', ['approved', 'in_production'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ['order-items-for-plan', selectedOrderId],
    enabled: !!selectedOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('id, item_id, quantity, produced_quantity, items(product_name, product_code)')
        .eq('order_id', selectedOrderId);
      if (error) throw error;
      return data;
    },
  });

  const { data: machines } = useQuery({
    queryKey: ['machines-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('machines').select('id, machine_name, machine_code').order('machine_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments, refetch: refetchAssignments } = useQuery({
    queryKey: ['machine-assignments-board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machine_assignments')
        .select('*, machines(machine_name, machine_code), items(product_name, product_code), orders(order_number)')
        .in('status', ['planned', 'in_progress'])
        .order('priority', { ascending: true })
        .order('planned_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const itemMap = useMemo(() => {
    const m = new Map<string, { item_id: string; quantity: number; produced_quantity: number | null; product_name: string }>();
    (orderItems || []).forEach((oi: any) => {
      m.set(oi.id, {
        item_id: oi.item_id,
        quantity: oi.quantity,
        produced_quantity: oi.produced_quantity,
        product_name: oi.items?.product_name || '',
      });
    });
    return m;
  }, [orderItems]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId) throw new Error('Select an order');
      const valid = rows.filter((r) => r.orderItemId && r.machineId && r.plannedQuantity > 0);
      if (valid.length === 0) throw new Error('Add at least one valid plan row');

      const { data: { user } } = await supabase.auth.getUser();
      const inserts = valid.map((r) => {
        const oi = itemMap.get(r.orderItemId);
        if (!oi) throw new Error('Invalid order item');
        return {
          order_id: selectedOrderId,
          order_item_id: r.orderItemId,
          machine_id: r.machineId,
          item_id: oi.item_id,
          planned_quantity: r.plannedQuantity,
          priority: r.priority,
          planned_date: r.plannedDate,
          created_by: user?.id,
        };
      });
      const { error } = await supabase.from('machine_assignments').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Machine assignments created' });
      setRows([{ id: crypto.randomUUID(), orderItemId: '', machineId: '', plannedQuantity: 0, priority: 3, plannedDate: todayISO() }]);
      qc.invalidateQueries({ queryKey: ['machine-assignments-board'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const cancelAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('machine_assignments').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Assignment cancelled' });
      refetchAssignments();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateRow = (id: string, patch: Partial<PlanRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const machineLoad = useMemo(() => {
    const map = new Map<string, { name: string; planned: number; produced: number; count: number }>();
    (assignments || []).forEach((a: any) => {
      const key = a.machine_id;
      const cur = map.get(key) || { name: a.machines?.machine_name || '—', planned: 0, produced: 0, count: 0 };
      cur.planned += Number(a.planned_quantity);
      cur.produced += Number(a.produced_quantity);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [assignments]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Plan Assignment</TabsTrigger>
          <TabsTrigger value="board">Machine Load Board</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Order to Machines</CardTitle>
              <CardDescription>Split an order across one or more machines with priority and planned date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-md">
                <Label>Order</Label>
                <Select value={selectedOrderId} onValueChange={(v) => { setSelectedOrderId(v); setRows([{ id: crypto.randomUUID(), orderItemId: '', machineId: '', plannedQuantity: 0, priority: 3, plannedDate: todayISO() }]); }}>
                  <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
                  <SelectContent>
                    {orders?.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_number} — {o.customers?.customer_name} ({o.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrderId && (
                <div className="space-y-3">
                  {rows.map((row, idx) => {
                    const oi = itemMap.get(row.orderItemId);
                    const remaining = oi ? Math.max(0, oi.quantity - (oi.produced_quantity || 0)) : 0;
                    return (
                      <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end p-4 border rounded-lg">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Item</Label>
                          <Select value={row.orderItemId} onValueChange={(v) => updateRow(row.id, { orderItemId: v })}>
                            <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                            <SelectContent>
                              {orderItems?.map((oi: any) => {
                                const rem = Math.max(0, oi.quantity - (oi.produced_quantity || 0));
                                return (
                                  <SelectItem key={oi.id} value={oi.id}>
                                    {oi.items?.product_name} — remaining {rem}/{oi.quantity}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {oi && <p className="text-xs text-muted-foreground">Remaining to plan: {remaining}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Machine</Label>
                          <Select value={row.machineId} onValueChange={(v) => updateRow(row.id, { machineId: v })}>
                            <SelectTrigger><SelectValue placeholder="Machine" /></SelectTrigger>
                            <SelectContent>
                              {machines?.map((m: any) => (
                                <SelectItem key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Qty</Label>
                          <Input type="number" min="1" value={row.plannedQuantity || ''} onChange={(e) => updateRow(row.id, { plannedQuantity: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={String(row.priority)} onValueChange={(v) => updateRow(row.id, { priority: parseInt(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 — Urgent</SelectItem>
                              <SelectItem value="2">2 — High</SelectItem>
                              <SelectItem value="3">3 — Normal</SelectItem>
                              <SelectItem value="4">4 — Low</SelectItem>
                              <SelectItem value="5">5 — Backlog</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Date</Label>
                          <Input type="date" value={row.plannedDate} onChange={(e) => updateRow(row.id, { plannedDate: e.target.value })} />
                        </div>
                        <div className="flex gap-2 md:col-span-6 justify-end">
                          {idx === rows.length - 1 && (
                            <Button type="button" variant="outline" size="icon" onClick={() => setRows((rs) => [...rs, { id: crypto.randomUUID(), orderItemId: '', machineId: '', plannedQuantity: 0, priority: 3, plannedDate: todayISO() }])}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                          {rows.length > 1 && (
                            <Button type="button" variant="outline" size="icon" onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-end pt-2">
                    <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {createMutation.isPending ? 'Saving...' : 'Save Assignments'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machineLoad.length === 0 && <p className="text-sm text-muted-foreground">No active assignments.</p>}
            {machineLoad.map((m) => {
              const pct = m.planned ? Math.min(100, Math.round((m.produced / m.planned) * 100)) : 0;
              return (
                <Card key={m.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Factory className="h-4 w-4" /> {m.name}</CardTitle>
                    <CardDescription>{m.count} active assignment(s)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-2 w-full rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{m.produced} / {m.planned} produced ({pct}%)</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
              <CardDescription>Sorted by priority, then planned date.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Machine</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Planned Date</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Produced</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(assignments || []).map((a: any) => {
                    const remaining = Math.max(0, Number(a.planned_quantity) - Number(a.produced_quantity));
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{a.orders?.order_number}</TableCell>
                        <TableCell>{a.items?.product_name}</TableCell>
                        <TableCell>{a.machines?.machine_name}</TableCell>
                        <TableCell><Badge variant="outline">P{a.priority}</Badge></TableCell>
                        <TableCell>{a.planned_date}</TableCell>
                        <TableCell className="text-right">{a.planned_quantity}</TableCell>
                        <TableCell className="text-right">{a.produced_quantity}</TableCell>
                        <TableCell className="text-right font-semibold">{remaining}</TableCell>
                        <TableCell><Badge>{a.status}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => cancelAssignment.mutate(a.id)}>Cancel</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MachinePlanning;
