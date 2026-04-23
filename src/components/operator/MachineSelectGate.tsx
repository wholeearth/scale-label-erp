import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Factory, Lock, Play, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DEVICE_MACHINE_KEY = 'op:deviceMachineId';

interface Props {
  onShiftStarted: (shiftId: string, machineId: string) => void;
}

/**
 * Full-screen blocking gate. The operator MUST pick a machine to start their shift.
 * - Two operators cannot pick the same machine in the same shift window (DB-enforced).
 * - Once started on this device, the chosen machine is locked here until shift ends.
 */
export const MachineSelectGate = ({ onShiftStarted }: Props) => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [selectedMachine, setSelectedMachine] = useState<string>('');

  // All machines + open shifts so we can show what's locked right now
  const { data: machines, isLoading: loadingMachines } = useQuery({
    queryKey: ['gate-machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('id, machine_name, machine_code')
        .order('machine_name');
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
  });

  const { data: openShifts } = useQuery({
    queryKey: ['gate-open-shifts'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('shift_records')
        .select('id, machine_id, operator_id, shift_start, shift_date, profiles:operator_id(full_name)')
        .is('shift_end', null)
        .eq('shift_date', today);
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
  });

  const lockedMap = useMemo(() => {
    const map = new Map<string, { name: string; start: string }>();
    (openShifts || []).forEach((s: any) => {
      if (s.machine_id && s.operator_id !== user?.id) {
        map.set(s.machine_id, {
          name: s.profiles?.full_name || 'Another operator',
          start: s.shift_start,
        });
      }
    });
    return map;
  }, [openShifts, user?.id]);

  const startMutation = useMutation({
    mutationFn: async (machineId: string) => {
      if (!user?.id) throw new Error('Not signed in');

      const { data, error } = await supabase
        .from('shift_records')
        .insert({
          operator_id: user.id,
          shift_date: format(new Date(), 'yyyy-MM-dd'),
          machine_id: machineId,
        })
        .select('id, machine_id')
        .single();

      if (error) {
        if (error.message?.includes('MACHINE_LOCKED')) {
          throw new Error('This machine is already in use by another operator for this shift.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem(DEVICE_MACHINE_KEY, data.machine_id!);
      toast.success('Shift started');
      qc.invalidateQueries({ queryKey: ['active-shift'] });
      qc.invalidateQueries({ queryKey: ['operator-active-shift'] });
      qc.invalidateQueries({ queryKey: ['gate-open-shifts'] });
      onShiftStarted(data.id, data.machine_id!);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Restore previous device-locked machine selection if still available
  useEffect(() => {
    const last = localStorage.getItem(DEVICE_MACHINE_KEY);
    if (last && machines?.some((m: any) => m.id === last) && !lockedMap.has(last)) {
      setSelectedMachine(last);
    }
  }, [machines, lockedMap]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Select your machine to start shift</CardTitle>
                <CardDescription>
                  {profile?.full_name ? `Hi ${profile.full_name}, ` : ''}pick the machine you'll operate. This locks the
                  machine to you for this shift.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingMachines ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading machines...
              </div>
            ) : !machines || machines.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                No machines configured. Ask an admin to add machines.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {machines.map((m: any) => {
                  const lock = lockedMap.get(m.id);
                  const isLocked = !!lock;
                  const isSelected = selectedMachine === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isLocked || startMutation.isPending}
                      onClick={() => setSelectedMachine(m.id)}
                      className={`group relative text-left rounded-lg border p-4 transition-all ${
                        isLocked
                          ? 'border-muted bg-muted/30 cursor-not-allowed opacity-70'
                          : isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/50 hover:bg-accent/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{m.machine_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.machine_code}</p>
                        </div>
                        {isLocked ? (
                          <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
                            <Lock className="h-3 w-3" /> In use
                          </Badge>
                        ) : isSelected ? (
                          <Badge className="bg-primary text-primary-foreground">Selected</Badge>
                        ) : (
                          <Badge variant="outline">Available</Badge>
                        )}
                      </div>
                      {isLocked && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {lock!.name} • since {format(new Date(lock!.start), 'p')}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Two operators cannot run the same machine in the same day/night shift.
              </p>
              <Button
                size="lg"
                disabled={!selectedMachine || startMutation.isPending}
                onClick={() => startMutation.mutate(selectedMachine)}
              >
                {startMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" /> Start shift on selected machine
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MachineSelectGate;
export { DEVICE_MACHINE_KEY };
