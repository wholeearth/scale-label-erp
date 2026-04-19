import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Save, Factory, AlertCircle } from 'lucide-react';

const LAST_MACHINE_KEY = 'op:lastMachineId';

export const MachineShiftEntry = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [machineId, setMachineId] = useState<string>(() => localStorage.getItem(LAST_MACHINE_KEY) || '');
  const [assignmentId, setAssignmentId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);

  // Active shift for this operator
  const { data: activeShift } = useQuery({
    queryKey: ['operator-active-shift', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_records')
        .select('id, shift_date, shift_start, shift_end, machine_id')
        .eq('operator_id', user!.id)
        .is('shift_end', null)
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: machines } = useQuery({
    queryKey: ['machines-list-op'],
    queryFn: async () => {
      const { data, error } = await supabase.from('machines').select('id, machine_name, machine_code').order('machine_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments, refetch: refetchAssignments } = useQuery({
    queryKey: ['machine-queue', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machine_assignments')
        .select('*, items(product_name, product_code), orders(order_number, customers(customer_name))')
        .eq('machine_id', machineId)
        .in('status', ['planned', 'in_progress'])
        .order('priority', { ascending: true })
        .order('planned_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Last shift on this machine (continuity hint)
  const { data: lastShiftOnMachine } = useQuery({
    queryKey: ['last-shift-on-machine', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_machine_production')
        .select('id, machine_assignment_id, quantity_produced, created_at, machine_assignments(planned_quantity, produced_quantity, status, items(product_name))')
        .eq('machine_id', machineId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Auto-pick top-priority assignment
  useEffect(() => {
    if (!assignmentId && assignments && assignments.length > 0) {
      setAssignmentId(assignments[0].id);
    }
  }, [assignments, assignmentId]);

  useEffect(() => {
    if (machineId) localStorage.setItem(LAST_MACHINE_KEY, machineId);
  }, [machineId]);

  const selected = useMemo(
    () => (assignments || []).find((a: any) => a.id === assignmentId),
    [assignments, assignmentId],
  );
  const remaining = selected ? Math.max(0, Number(selected.planned_quantity) - Number(selected.produced_quantity)) : 0;

  const recordMutation = useMutation({
    mutationFn: async () => {
      if (!activeShift) throw new Error('Start a shift first');
      if (!machineId) throw new Error('Select a machine');
      if (!assignmentId || !selected) throw new Error('Select an assignment');
      if (quantity <= 0) throw new Error('Enter a quantity');

      // Soft cap: 1.5x planned
      if (quantity > Number(selected.planned_quantity) * 1.5) {
        const ok = window.confirm(`Quantity ${quantity} exceeds 1.5× planned (${selected.planned_quantity}). Continue?`);
        if (!ok) throw new Error('Cancelled');
      }

      // Attach machine_id to shift_record if not yet set
      if (!activeShift.machine_id) {
        await supabase.from('shift_records').update({ machine_id: machineId }).eq('id', activeShift.id);
      }

      const { error } = await supabase.from('shift_machine_production').insert({
        shift_record_id: activeShift.id,
        machine_assignment_id: assignmentId,
        machine_id: machineId,
        order_id: selected.order_id,
        item_id: selected.item_id,
        operator_id: user?.id,
        quantity_produced: quantity,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Production recorded' });
      setQuantity(0);
      qc.invalidateQueries({ queryKey: ['machine-queue', machineId] });
      refetchAssignments();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const continuityBanner =
    lastShiftOnMachine?.machine_assignments &&
    (lastShiftOnMachine.machine_assignments as any).status !== 'completed' ? (
      <div className="flex items-start gap-2 p-3 rounded-md border border-primary/20 bg-primary/5 text-sm">
        <AlertCircle className="h-4 w-4 mt-0.5 text-primary" />
        <div>
          <p className="font-medium">Continuing previous shift on this machine</p>
          <p className="text-muted-foreground">
            Last assignment: {(lastShiftOnMachine.machine_assignments as any).items?.product_name} —{' '}
            {(lastShiftOnMachine.machine_assignments as any).produced_quantity}/
            {(lastShiftOnMachine.machine_assignments as any).planned_quantity} produced.
          </p>
        </div>
      </div>
    ) : null;

  if (!activeShift) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active shift</CardTitle>
          <CardDescription>Start a shift in Shift Management before recording machine production.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Factory className="h-4 w-4" /> Machine Production Entry</CardTitle>
          <CardDescription>Pick the machine you are running, then record produced quantity for the active assignment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {continuityBanner}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Machine</Label>
              <Select value={machineId} onValueChange={(v) => { setMachineId(v); setAssignmentId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                <SelectContent>
                  {machines?.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Assignment (top priority pre-selected)</Label>
              <Select value={assignmentId} onValueChange={setAssignmentId} disabled={!machineId}>
                <SelectTrigger><SelectValue placeholder={machineId ? 'Select assignment' : 'Select machine first'} /></SelectTrigger>
                <SelectContent>
                  {(assignments || []).map((a: any) => {
                    const rem = Math.max(0, Number(a.planned_quantity) - Number(a.produced_quantity));
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        P{a.priority} • {a.orders?.order_number} • {a.items?.product_name} — remaining {rem}/{a.planned_quantity}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selected && (
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{(selected as any).orders?.customers?.customer_name}</p>
                  <p className="font-medium">{(selected as any).items?.product_name}</p>
                </div>
                <Badge variant="outline" className="text-base">Remaining: {remaining}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Quantity Produced</Label>
                  <Input
                    type="number"
                    min="1"
                    autoFocus
                    value={quantity || ''}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && quantity > 0) recordMutation.mutate(); }}
                    placeholder="Enter quantity and press Enter"
                  />
                </div>
                <Button onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending || quantity <= 0}>
                  <Save className="h-4 w-4 mr-2" />
                  {recordMutation.isPending ? 'Saving...' : 'Record'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {assignments && assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Queue on this machine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignments.map((a: any) => {
              const rem = Math.max(0, Number(a.planned_quantity) - Number(a.produced_quantity));
              return (
                <div key={a.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                  <span><Badge variant="outline" className="mr-2">P{a.priority}</Badge>{a.orders?.order_number} — {a.items?.product_name}</span>
                  <span className="text-muted-foreground">{rem}/{a.planned_quantity} remaining</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MachineShiftEntry;
