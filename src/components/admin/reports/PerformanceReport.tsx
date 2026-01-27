import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isSameDay, isSameWeek, isSameMonth, getHours } from 'date-fns';
import { TrendingUp, Download, Loader2, Calendar, Clock, Target, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface ProductionRecord {
  id: string;
  production_date: string;
  production_time: string;
  weight_kg: number;
  operator_id: string;
  operator: {
    full_name: string;
    employee_code: string | null;
  };
}

type ViewType = 'daily' | 'weekly' | 'monthly' | 'yearly';
type ShiftType = 'all' | 'day' | 'night';

interface ShiftConfig {
  day_shift_start: string;
  day_shift_end: string;
}

const PerformanceReport = () => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [viewType, setViewType] = useState<ViewType>('daily');
  const [shiftFilter, setShiftFilter] = useState<ShiftType>('all');

  // Fetch shift configuration
  const { data: shiftConfig } = useQuery({
    queryKey: ['shift-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_config')
        .select('day_shift_start, day_shift_end')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as ShiftConfig | null;
    },
  });

  // Default shift times if not configured
  const dayShiftStart = shiftConfig?.day_shift_start ? parseInt(shiftConfig.day_shift_start.split(':')[0]) : 6;
  const dayShiftEnd = shiftConfig?.day_shift_end ? parseInt(shiftConfig.day_shift_end.split(':')[0]) : 18;

  // Fetch operators for filter
  const { data: operators } = useQuery({
    queryKey: ['operators-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, full_name, employee_code)')
        .eq('role', 'operator');
      if (error) throw error;
      return data;
    },
  });

  // Fetch production records
  const { data: productionRecords, isLoading } = useQuery({
    queryKey: ['performance-report', startDate, endDate, selectedOperator, shiftFilter],
    queryFn: async () => {
      let query = supabase
        .from('production_records')
        .select(`
          id,
          production_date,
          production_time,
          weight_kg,
          operator_id,
          operator:profiles!production_records_operator_id_fkey(full_name, employee_code)
        `)
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .order('production_date')
        .order('production_time');

      if (selectedOperator !== 'all') {
        query = query.eq('operator_id', selectedOperator);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by shift if needed using configured shift times
      let filtered = data as ProductionRecord[];
      if (shiftFilter !== 'all') {
        filtered = filtered.filter(record => {
          const hour = parseInt(record.production_time.split(':')[0]);
          switch (shiftFilter) {
            case 'day': return hour >= dayShiftStart && hour < dayShiftEnd;
            case 'night': return hour >= dayShiftEnd || hour < dayShiftStart;
            default: return true;
          }
        });
      }
      
      return filtered;
    },
  });

  // Calculate performance metrics
  const performanceData = useMemo(() => {
    if (!productionRecords) return { byOperator: [], chartData: [], shifts: { day: 0, night: 0 } };

    // Group by operator
    const operatorMap = new Map<string, {
      operatorId: string;
      operatorName: string;
      employeeCode: string | null;
      totalUnits: number;
      totalWeight: number;
      workingDays: Set<string>;
      byDate: Map<string, number>;
      byShift: { day: number; night: number };
    }>();

    productionRecords.forEach(record => {
      const opId = record.operator_id;
      
      if (!operatorMap.has(opId)) {
        operatorMap.set(opId, {
          operatorId: opId,
          operatorName: record.operator.full_name,
          employeeCode: record.operator.employee_code,
          totalUnits: 0,
          totalWeight: 0,
          workingDays: new Set(),
          byDate: new Map(),
          byShift: { day: 0, night: 0 },
        });
      }

      const op = operatorMap.get(opId)!;
      op.totalUnits += 1;
      op.totalWeight += record.weight_kg;
      op.workingDays.add(record.production_date);
      
      // By date
      const dateCount = op.byDate.get(record.production_date) || 0;
      op.byDate.set(record.production_date, dateCount + 1);
      
      // By shift using configured times
      const hour = parseInt(record.production_time.split(':')[0]);
      if (hour >= dayShiftStart && hour < dayShiftEnd) op.byShift.day += 1;
      else op.byShift.night += 1;
    });

    // Calculate averages and build result
    const byOperator = Array.from(operatorMap.values()).map(op => ({
      ...op,
      workingDaysCount: op.workingDays.size,
      avgUnitsPerDay: op.workingDays.size > 0 ? op.totalUnits / op.workingDays.size : 0,
      avgWeightPerDay: op.workingDays.size > 0 ? op.totalWeight / op.workingDays.size : 0,
    })).sort((a, b) => b.totalUnits - a.totalUnits);

    // Build chart data based on view type
    const chartData: { date: string; [key: string]: string | number }[] = [];
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (viewType === 'daily') {
      const days = eachDayOfInterval({ start, end });
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const displayDate = format(day, 'dd/MM');
        const entry: { date: string; [key: string]: string | number } = { date: displayDate };
        
        byOperator.forEach(op => {
          entry[op.operatorName] = op.byDate.get(dateStr) || 0;
        });
        
        chartData.push(entry);
      });
    } else if (viewType === 'weekly') {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      weeks.forEach(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const displayDate = `W${format(weekStart, 'w')}`;
        const entry: { date: string; [key: string]: string | number } = { date: displayDate };
        
        byOperator.forEach(op => {
          let weekTotal = 0;
          productionRecords.filter(r => r.operator_id === op.operatorId).forEach(r => {
            const recordDate = parseISO(r.production_date);
            if (recordDate >= weekStart && recordDate <= weekEnd) {
              weekTotal += 1;
            }
          });
          entry[op.operatorName] = weekTotal;
        });
        
        chartData.push(entry);
      });
    } else if (viewType === 'monthly') {
      const months = eachMonthOfInterval({ start, end });
      months.forEach(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const displayDate = format(monthStart, 'MMM yyyy');
        const entry: { date: string; [key: string]: string | number } = { date: displayDate };
        
        byOperator.forEach(op => {
          let monthTotal = 0;
          productionRecords.filter(r => r.operator_id === op.operatorId).forEach(r => {
            const recordDate = parseISO(r.production_date);
            if (recordDate >= monthStart && recordDate <= monthEnd) {
              monthTotal += 1;
            }
          });
          entry[op.operatorName] = monthTotal;
        });
        
        chartData.push(entry);
      });
    }

    // Shift summary
    const shifts = { day: 0, night: 0 };
    byOperator.forEach(op => {
      shifts.day += op.byShift.day;
      shifts.night += op.byShift.night;
    });

    return { byOperator, chartData, shifts };
  }, [productionRecords, viewType, startDate, endDate, dayShiftStart, dayShiftEnd]);

  // Format shift time for display
  const formatShiftTime = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${ampm}`;
  };

  const exportToCSV = () => {
    const headers = ['Operator', 'Employee Code', 'Total Units', 'Total Weight (kg)', 'Working Days', 'Avg Units/Day', 'Day Shift', 'Night Shift'];
    const rows = performanceData.byOperator.map(op => [
      op.operatorName,
      op.employeeCode || 'N/A',
      op.totalUnits.toString(),
      op.totalWeight.toFixed(2),
      op.workingDaysCount.toString(),
      op.avgUnitsPerDay.toFixed(2),
      op.byShift.day.toString(),
      op.byShift.night.toString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#0088FE'];
  const totalUnits = performanceData.byOperator.reduce((sum, op) => sum + op.totalUnits, 0);
  const topPerformer = performanceData.byOperator[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Report
            </CardTitle>
            <CardDescription>Operator performance analysis with shift-wise and period breakdowns</CardDescription>
          </div>
          <Button onClick={exportToCSV} disabled={!performanceData.byOperator.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Operator</Label>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger>
                <SelectValue placeholder="All Operators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operators</SelectItem>
                {operators?.map((op: any) => (
                  <SelectItem key={op.profiles.id} value={op.profiles.id}>
                    {op.profiles.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>View</Label>
            <Select value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select value={shiftFilter} onValueChange={(v) => setShiftFilter(v as ShiftType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="day">Day ({formatShiftTime(dayShiftStart)}-{formatShiftTime(dayShiftEnd)})</SelectItem>
                <SelectItem value="night">Night ({formatShiftTime(dayShiftEnd)}-{formatShiftTime(dayShiftStart)})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <Target className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-primary">{totalUnits}</p>
                <p className="text-sm text-muted-foreground">Total Units</p>
              </div>
              <div className="p-4 bg-success/10 rounded-lg text-center">
                <Award className="h-5 w-5 mx-auto mb-2 text-success" />
                <p className="text-lg font-bold text-success">{topPerformer?.operatorName || '-'}</p>
                <p className="text-sm text-muted-foreground">Top Performer</p>
              </div>
              <div className="p-4 bg-warning/10 rounded-lg text-center">
                <Clock className="h-5 w-5 mx-auto mb-2 text-warning" />
                <p className="text-2xl font-bold text-warning">{performanceData.shifts.day}</p>
                <p className="text-sm text-muted-foreground">Day Shift</p>
              </div>
              <div className="p-4 bg-info/10 rounded-lg text-center">
                <Clock className="h-5 w-5 mx-auto mb-2 text-info" />
                <p className="text-2xl font-bold text-info">{performanceData.shifts.night}</p>
                <p className="text-sm text-muted-foreground">Night Shift</p>
              </div>
            </div>

            {/* Tabs for different views */}
            <Tabs defaultValue="table" className="w-full">
              <TabsList>
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="chart">Chart View</TabsTrigger>
                <TabsTrigger value="shifts">Shift Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="table" className="mt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Operator</TableHead>
                        <TableHead className="text-right">Total Units</TableHead>
                        <TableHead className="text-right">Total Weight (kg)</TableHead>
                        <TableHead className="text-right">Working Days</TableHead>
                        <TableHead className="text-right">Avg Units/Day</TableHead>
                        <TableHead className="text-right">Day</TableHead>
                        <TableHead className="text-right">Night</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performanceData.byOperator.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No production records found for the selected criteria
                          </TableCell>
                        </TableRow>
                      ) : (
                        performanceData.byOperator.map((op, index) => (
                          <TableRow key={op.operatorId}>
                            <TableCell>
                              {index === 0 ? (
                                <Badge className="bg-yellow-500">🏆 1</Badge>
                              ) : index === 1 ? (
                                <Badge className="bg-gray-400">🥈 2</Badge>
                              ) : index === 2 ? (
                                <Badge className="bg-orange-400">🥉 3</Badge>
                              ) : (
                                <Badge variant="outline">{index + 1}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{op.operatorName}</p>
                                <p className="text-xs text-muted-foreground">{op.employeeCode || 'N/A'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{op.totalUnits}</TableCell>
                            <TableCell className="text-right">{op.totalWeight.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{op.workingDaysCount}</TableCell>
                            <TableCell className="text-right">{op.avgUnitsPerDay.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{op.byShift.day}</TableCell>
                            <TableCell className="text-right">{op.byShift.night}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="chart" className="mt-4">
                {performanceData.chartData.length > 0 ? (
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {performanceData.byOperator.slice(0, 8).map((op, index) => (
                          <Line
                            key={op.operatorId}
                            type="monotone"
                            dataKey={op.operatorName}
                            stroke={colors[index]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No data available for chart
                  </div>
                )}
              </TabsContent>

              <TabsContent value="shifts" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Shift Distribution Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Shift Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={performanceData.byOperator.slice(0, 5).map(op => ({
                            name: op.operatorName.split(' ')[0],
                            Day: op.byShift.day,
                            Night: op.byShift.night,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Day" fill="#ffc658" />
                            <Bar dataKey="Night" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shift-wise Performance Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Shift-wise Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operator</TableHead>
                            <TableHead className="text-center">☀️ Day</TableHead>
                            <TableHead className="text-center">🌙 Night</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {performanceData.byOperator.map(op => (
                            <TableRow key={op.operatorId}>
                              <TableCell className="font-medium">{op.operatorName.split(' ')[0]}</TableCell>
                              <TableCell className="text-center">{op.byShift.day}</TableCell>
                              <TableCell className="text-center">{op.byShift.night}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceReport;
