import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, StopCircle, Factory, Info } from 'lucide-react';
import { toast } from 'sonner';
import ShiftEndDialog from './ShiftEndDialog';
import { format } from 'date-fns';
import { DEVICE_MACHINE_KEY } from './MachineSelectGate';

const ShiftManagement = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);

  const { data: activeShift, isLoading } = useQuery({
    queryKey: ['active-shift', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from('shift_records')
        .select('*, machines:machine_id(machine_name, machine_code)')
        .eq('operator_id', profile.id)
        .is('shift_end', null)
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const handleEndShift = () => {
    if (activeShift) {
      setCurrentShiftId(activeShift.id);
      setShowEndDialog(true);
    }
  };

  const handleEndShiftComplete = async (skipDataInput: boolean) => {
    if (!currentShiftId) return;

    const { error } = await supabase
      .from('shift_records')
      .update({
        shift_end: new Date().toISOString(),
        data_input_completed: !skipDataInput,
      })
      .eq('id', currentShiftId);

    if (error) {
      toast.error('Failed to end shift: ' + error.message);
      return;
    }

    localStorage.removeItem(DEVICE_MACHINE_KEY);
    toast.success(skipDataInput ? 'Shift ended. Data can be entered later.' : 'Shift ended successfully');
    setShowEndDialog(false);
    setCurrentShiftId(null);
    queryClient.invalidateQueries({ queryKey: ['active-shift'] });
    queryClient.invalidateQueries({ queryKey: ['operator-active-shift'] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading shift status...</div>
        </CardContent>
      </Card>
    );
  }

  const machine = (activeShift as any)?.machines;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Management
          </CardTitle>
          <CardDescription>
            Your shift starts when you pick a machine on login. End it here when you finish.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeShift ? (
            <>
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-success">Active Shift</p>
                    <p className="text-sm text-muted-foreground">
                      Started: {format(new Date(activeShift.shift_start), 'PPp')}
                    </p>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
                </div>
                {machine && (
                  <div className="flex items-center gap-2 pt-2 border-t border-success/10">
                    <Factory className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Machine:</span>
                    <Badge variant="outline">
                      {machine.machine_name} ({machine.machine_code})
                    </Badge>
                  </div>
                )}
                <p className="text-xs text-muted-foreground flex items-start gap-1 pt-1">
                  <Info className="h-3 w-3 mt-0.5" />
                  Machine cannot be changed on this device until you end the shift.
                </p>
              </div>
              <Button
                onClick={handleEndShift}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <StopCircle className="h-5 w-5 mr-2" />
                End Shift
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              No active shift. Refresh the page to pick a machine and start your shift.
            </div>
          )}
        </CardContent>
      </Card>

      {currentShiftId && (
        <ShiftEndDialog
          open={showEndDialog}
          onOpenChange={setShowEndDialog}
          shiftId={currentShiftId}
          onComplete={handleEndShiftComplete}
        />
      )}
    </>
  );
};

export default ShiftManagement;
