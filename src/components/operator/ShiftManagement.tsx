import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, PlayCircle, StopCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ShiftEndDialog from './ShiftEndDialog';

const ShiftManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEndDialog, setShowEndDialog] = useState(false);

  // Check for active shift
  const { data: activeShift, refetch: refetchShift } = useQuery({
    queryKey: ['active-shift', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      const { data, error } = await supabase
        .from('shift_records')
        .select('*')
        .eq('operator_id', profile.id)
        .is('shift_end_time', null)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const startShiftMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('No profile found');
      
      const now = new Date();
      const { data, error } = await supabase
        .from('shift_records')
        .insert({
          operator_id: profile.id,
          shift_date: now.toISOString().split('T')[0],
          shift_start_time: now.toISOString(),
          data_entry_status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Shift started',
        description: 'Your shift has been started successfully.',
      });
      refetchShift();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEndShift = () => {
    setShowEndDialog(true);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getShiftDuration = () => {
    if (!activeShift?.shift_start_time) return '0h 0m';
    const start = new Date(activeShift.shift_start_time);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Shift Management
              </CardTitle>
              <CardDescription>Start and end your production shift</CardDescription>
            </div>
            {activeShift && (
              <Badge variant="default" className="text-lg px-4 py-2">
                Active Shift
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activeShift ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Started at</p>
                  <p className="text-lg font-semibold">{formatTime(activeShift.shift_start_time)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-lg font-semibold">{getShiftDuration()}</p>
                </div>
              </div>
              <Button 
                onClick={handleEndShift}
                className="w-full"
                variant="destructive"
                size="lg"
              >
                <StopCircle className="mr-2 h-5 w-5" />
                End Shift
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => startShiftMutation.mutate()}
              className="w-full"
              size="lg"
              disabled={startShiftMutation.isPending}
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              {startShiftMutation.isPending ? 'Starting...' : 'Start Shift'}
            </Button>
          )}
        </CardContent>
      </Card>

      {activeShift && (
        <ShiftEndDialog
          open={showEndDialog}
          onOpenChange={setShowEndDialog}
          shiftRecord={activeShift}
          onShiftEnded={() => {
            refetchShift();
            queryClient.invalidateQueries({ queryKey: ['active-shift'] });
          }}
        />
      )}
    </>
  );
};

export default ShiftManagement;
