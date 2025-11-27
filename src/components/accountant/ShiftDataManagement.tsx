import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, Edit } from 'lucide-react';
import { format } from 'date-fns';
import ShiftDataEntryForm from './ShiftDataEntryForm';

const ShiftDataManagement = () => {
  const [selectedShift, setSelectedShift] = useState<string | null>(null);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shift-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_records')
        .select(`
          *,
          operator:profiles!shift_records_operator_id_fkey(full_name, employee_code),
          data_entry_by:profiles!shift_records_data_input_by_fkey(full_name)
        `)
        .not('shift_end', 'is', null)
        .order('shift_date', { ascending: false })
        .order('shift_start', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading shift data...</div>
        </CardContent>
      </Card>
    );
  }

  if (selectedShift) {
    return (
      <ShiftDataEntryForm
        shiftId={selectedShift}
        onBack={() => setSelectedShift(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Shift Data Management
        </CardTitle>
        <CardDescription>
          View and manage raw material and intermediate product data for completed shifts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Shift Start</TableHead>
                <TableHead>Shift End</TableHead>
                <TableHead>Data Status</TableHead>
                <TableHead>Data Input By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts && shifts.length > 0 ? (
                shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{shift.operator?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {shift.operator?.employee_code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(shift.shift_date), 'PPP')}</TableCell>
                    <TableCell>{format(new Date(shift.shift_start), 'p')}</TableCell>
                    <TableCell>
                      {shift.shift_end ? format(new Date(shift.shift_end), 'p') : '-'}
                    </TableCell>
                    <TableCell>
                      {shift.data_input_completed ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {shift.data_input_by ? (
                        <span className="text-sm">{shift.data_entry_by?.full_name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedShift(shift.id)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {shift.data_input_completed ? 'View/Edit' : 'Enter Data'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No shift records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShiftDataManagement;
