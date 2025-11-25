import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileEdit } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import ShiftDataEntryForm from '../operator/ShiftDataEntryForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const ShiftDataManagement = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [showEntryDialog, setShowEntryDialog] = useState(false);

  // Fetch operators
  const { data: operators } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          employee_code,
          user_roles!inner(role)
        `)
        .eq('user_roles.role', 'operator')
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch shifts for selected date and operator
  const { data: shifts, refetch: refetchShifts } = useQuery({
    queryKey: ['shift-records', selectedDate, selectedOperator],
    queryFn: async () => {
      if (!selectedOperator) return [];
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('shift_records')
        .select(`
          *,
          profiles(full_name, employee_code)
        `)
        .eq('operator_id', selectedOperator)
        .eq('shift_date', dateStr)
        .order('shift_start_time', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOperator,
  });

  const handleEditShiftData = (shift: any) => {
    setSelectedShift(shift);
    setShowEntryDialog(true);
  };

  const handleDataEntryComplete = async () => {
    // Update shift status to completed
    if (selectedShift) {
      await supabase
        .from('shift_records')
        .update({ data_entry_status: 'completed' })
        .eq('id', selectedShift.id);
      
      refetchShifts();
    }
    setShowEntryDialog(false);
    setSelectedShift(null);
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Shift Data Management</CardTitle>
          <CardDescription>
            Enter or update raw materials and intermediate products for operator shifts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Operator</label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose operator" />
                </SelectTrigger>
                <SelectContent>
                  {operators?.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.employee_code} - {operator.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedOperator && shifts && shifts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Shifts for {format(selectedDate, 'PPP')}</h3>
              <div className="space-y-2">
                {shifts.map((shift) => (
                  <Card key={shift.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {formatTime(shift.shift_start_time)} - {formatTime(shift.shift_end_time)}
                            </span>
                            <Badge variant={shift.data_entry_status === 'completed' ? 'default' : 'secondary'}>
                              {shift.data_entry_status === 'completed' ? 'Data Entered' : 'Pending'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {shift.profiles?.full_name} ({shift.profiles?.employee_code})
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditShiftData(shift)}
                        >
                          <FileEdit className="mr-2 h-4 w-4" />
                          {shift.data_entry_status === 'completed' ? 'Edit Data' : 'Enter Data'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {selectedOperator && shifts && shifts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No shifts found for selected date and operator
            </div>
          )}

          {!selectedOperator && (
            <div className="text-center py-8 text-muted-foreground">
              Select an operator to view their shifts
            </div>
          )}
        </CardContent>
      </Card>

      {selectedShift && (
        <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Shift Data</DialogTitle>
              <DialogDescription>
                Update raw materials consumed and intermediate products produced for this shift
              </DialogDescription>
            </DialogHeader>
            <ShiftDataEntryForm
              shiftId={selectedShift.id}
              operatorId={selectedShift.operator_id}
              onComplete={handleDataEntryComplete}
              onCancel={() => {
                setShowEntryDialog(false);
                setSelectedShift(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ShiftDataManagement;
