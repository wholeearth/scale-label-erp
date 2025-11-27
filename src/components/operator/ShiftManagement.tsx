import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Play, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import ShiftEndDialog from './ShiftEndDialog';
import { format } from 'date-fns';

const ShiftManagement = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);

  // Get current active shift
  const { data: activeShift, isLoading } = useQuery({
    queryKey: ['active-shift', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from('shift_records')
        .select('*')
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

  const startShiftMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('No profile');

      const { data, error } = await supabase
        .from('shift_records')
        .insert({
          operator_id: profile.id,
          shift_date: format(new Date(), 'yyyy-MM-dd'),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Shift started successfully');
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
    },
    onError: (error) => {
      toast.error('Failed to start shift: ' + error.message);
    },
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

    toast.success(skipDataInput ? 'Shift ended. Data can be entered later.' : 'Shift ended successfully');
    setShowEndDialog(false);
    setCurrentShiftId(null);
    queryClient.invalidateQueries({ queryKey: ['active-shift'] });
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Management
          </CardTitle>
          <CardDescription>
            Start and end your work shift
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeShift ? (
            <>
              <div className="rounded-lg border border-success/20 bg-success/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-success">Active Shift</p>
                    <p className="text-sm text-muted-foreground">
                      Started: {format(new Date(activeShift.shift_start), 'PPp')}
                    </p>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
                </div>
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
            <>
              <div className="rounded-lg border border-muted p-4 text-center text-muted-foreground">
                No active shift
              </div>
              <Button
                onClick={() => startShiftMutation.mutate()}
                disabled={startShiftMutation.isPending}
                className="w-full"
                size="lg"
              >
                <Play className="h-5 w-5 mr-2" />
                {startShiftMutation.isPending ? 'Starting...' : 'Start Shift'}
              </Button>
            </>
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
