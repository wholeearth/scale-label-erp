import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';

export const ProductionCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: assignments } = useQuery({
    queryKey: ['calendar-assignments', currentMonth],
    queryFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('operator_assignments')
        .select(`
          *,
          operator:profiles!operator_assignments_operator_id_fkey(full_name, employee_code),
          item:items(product_name, product_code)
        `)
        .gte('assigned_at', start.toISOString())
        .lte('assigned_at', end.toISOString())
        .order('assigned_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: productionRecords } = useQuery({
    queryKey: ['calendar-production', currentMonth],
    queryFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('production_records')
        .select(`
          *,
          machine:machines(machine_name, machine_code),
          operator:profiles!production_records_operator_id_fkey(full_name, employee_code)
        `)
        .gte('production_date', format(start, 'yyyy-MM-dd'))
        .lte('production_date', format(end, 'yyyy-MM-dd'))
        .order('production_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_name');

      if (error) throw error;
      return data;
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAssignmentsForDay = (day: Date) => {
    return assignments?.filter(a => {
      const assignedDate = new Date(a.assigned_at);
      return isSameDay(assignedDate, day);
    }) || [];
  };

  const getProductionForDay = (day: Date) => {
    return productionRecords?.filter(p => {
      const prodDate = new Date(p.production_date);
      return isSameDay(prodDate, day);
    }) || [];
  };

  const calculateMachineUtilization = () => {
    if (!machines || !productionRecords) return [];

    return machines.map(machine => {
      const machineRecords = productionRecords.filter(p => p.machine_id === machine.id);
      const totalDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
      const activeDays = new Set(machineRecords.map(r => r.production_date)).size;
      const utilization = (activeDays / totalDays) * 100;

      return {
        machine,
        activeDays,
        totalDays,
        utilization,
        productionCount: machineRecords.length,
      };
    });
  };

  const machineUtilization = calculateMachineUtilization();

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="space-y-6">
      {/* Machine Utilization Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Machine Utilization - {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
          <CardDescription>
            Production activity across all machines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machineUtilization.map(({ machine, activeDays, totalDays, utilization, productionCount }) => (
              <div key={machine.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{machine.machine_name}</h4>
                    <p className="text-sm text-muted-foreground">{machine.machine_code}</p>
                  </div>
                  <Badge variant={utilization > 70 ? 'default' : utilization > 40 ? 'secondary' : 'outline'}>
                    {utilization.toFixed(0)}%
                  </Badge>
                </div>
                <Progress value={utilization} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{activeDays}/{totalDays} days active</span>
                  <span>{productionCount} units</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Production Schedule
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[140px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {calendarDays.map(day => {
              const dayAssignments = getAssignmentsForDay(day);
              const dayProduction = getProductionForDay(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`
                    min-h-[100px] border rounded-lg p-2 space-y-1
                    ${isCurrentMonth ? 'bg-background' : 'bg-muted/30'}
                    ${isToday ? 'ring-2 ring-primary' : ''}
                  `}
                >
                  <div className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>

                  {/* Assignments */}
                  {dayAssignments.map((assignment, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded px-1 py-0.5 truncate"
                      title={`${assignment.operator?.full_name}: ${assignment.item?.product_name} (${assignment.quantity_assigned} units)`}
                    >
                      📋 {assignment.operator?.employee_code}: {assignment.quantity_assigned}
                    </div>
                  ))}

                  {/* Production */}
                  {dayProduction.length > 0 && (
                    <div className="text-xs bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 rounded px-1 py-0.5 truncate">
                      ✓ {dayProduction.length} units
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900/30 rounded" />
              <span>Assignments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 dark:bg-green-900/30 rounded" />
              <span>Production</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 ring-2 ring-primary rounded" />
              <span>Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
