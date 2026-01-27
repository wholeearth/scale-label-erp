import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ShiftConfigSettings = () => {
  const [dayShiftStart, setDayShiftStart] = useState('06:00');
  const [dayShiftEnd, setDayShiftEnd] = useState('18:00');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchShiftConfig();
  }, []);

  const fetchShiftConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        // Convert time format from HH:MM:SS to HH:MM for input
        setDayShiftStart(data.day_shift_start?.slice(0, 5) || '06:00');
        setDayShiftEnd(data.day_shift_end?.slice(0, 5) || '18:00');
      }
    } catch (error) {
      console.error('Error fetching shift config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate that day shift start is before day shift end
      const startHour = parseInt(dayShiftStart.split(':')[0]);
      const endHour = parseInt(dayShiftEnd.split(':')[0]);
      
      if (startHour >= endHour) {
        toast({
          title: 'Invalid Configuration',
          description: 'Day shift start time must be before end time.',
          variant: 'destructive'
        });
        setSaving(false);
        return;
      }

      const { data: existing } = await supabase
        .from('shift_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      const configData = {
        day_shift_start: dayShiftStart + ':00',
        day_shift_end: dayShiftEnd + ':00',
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existing) {
        const result = await supabase
          .from('shift_config')
          .update(configData)
          .eq('id', existing.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('shift_config')
          .insert([configData]);
        error = result.error;
      }

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Shift configuration saved successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shift Configuration
            </CardTitle>
            <CardDescription>
              Configure Day and Night shift hours for production reports
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
              ☀️ Day: {formatTimeDisplay(dayShiftStart)} - {formatTimeDisplay(dayShiftEnd)}
            </Badge>
            <Badge variant="outline" className="bg-info/10 text-info border-info/20">
              🌙 Night: {formatTimeDisplay(dayShiftEnd)} - {formatTimeDisplay(dayShiftStart)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Day Shift Configuration */}
          <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <h4 className="font-medium">Day Shift</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dayShiftStart">Start Time</Label>
                <input
                  id="dayShiftStart"
                  type="time"
                  value={dayShiftStart}
                  onChange={(e) => setDayShiftStart(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dayShiftEnd">End Time</Label>
                <input
                  id="dayShiftEnd"
                  type="time"
                  value={dayShiftEnd}
                  onChange={(e) => setDayShiftEnd(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                />
              </div>
            </div>
          </div>

          {/* Night Shift Display (Calculated) */}
          <div className="p-4 bg-info/5 border border-info/20 rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌙</span>
              <h4 className="font-medium">Night Shift</h4>
              <Badge variant="secondary" className="text-xs">Auto-calculated</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <div className="p-2 border rounded-md bg-muted text-muted-foreground">
                  {formatTimeDisplay(dayShiftEnd)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <div className="p-2 border rounded-md bg-muted text-muted-foreground">
                  {formatTimeDisplay(dayShiftStart)}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Night shift automatically covers the remaining hours outside day shift.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            These settings affect the Performance Report shift-wise analysis.
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Shift Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShiftConfigSettings;
