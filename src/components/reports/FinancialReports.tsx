import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const FinancialReports = () => {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [reportTab, setReportTab] = useState('trial-balance');

  // Fetch chart of accounts with balances
  const { data: accounts = [] } = useQuery({
    queryKey: ['chart-of-accounts-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');
      if (error) throw error;
      return data;
    }
  });

  // Fetch journal entries for the period
  const { data: journalEntries = [] } = useQuery({
    queryKey: ['journal-entries-report', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*, journal_entry_lines(*)')
        .eq('status', 'posted')
        .gte('entry_date', format(dateFrom, 'yyyy-MM-dd'))
        .lte('entry_date', format(dateTo, 'yyyy-MM-dd'))
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Calculate account type totals for financial statements
  const getAccountsByType = (type: string) => accounts.filter(a => a.account_type === type);
  
  const getTotalByType = (type: string) => {
    return accounts
      .filter(a => a.account_type === type)
      .reduce((sum, a) => sum + (a.current_balance || 0), 0);
  };

  const assetTotal = getTotalByType('asset');
  const liabilityTotal = getTotalByType('liability');
  const equityTotal = getTotalByType('equity');
  const revenueTotal = getTotalByType('revenue');
  const expenseTotal = getTotalByType('expense');
  const netIncome = revenueTotal - expenseTotal;

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Financial Reports</CardTitle>
            <CardDescription>Trial Balance, Profit & Loss, and Balance Sheet</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(dateFrom, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(date) => date && setDateFrom(date)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(dateTo, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(date) => date && setDateTo(date)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={reportTab} onValueChange={setReportTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          </TabsList>

          <TabsContent value="trial-balance" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  accounts.map(a => ({
                    code: a.account_code,
                    name: a.account_name,
                    type: a.account_type,
                    debit: ['asset', 'expense'].includes(a.account_type) ? a.current_balance : 0,
                    credit: ['liability', 'equity', 'revenue'].includes(a.account_type) ? a.current_balance : 0
                  })),
                  'trial_balance'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">{account.account_code}</TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell className="capitalize">{account.account_type}</TableCell>
                    <TableCell className="text-right">
                      {['asset', 'expense'].includes(account.account_type) 
                        ? (account.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {['liability', 'equity', 'revenue'].includes(account.account_type)
                        ? (account.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">
                    {(assetTotal + expenseTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {(liabilityTotal + equityTotal + revenueTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="profit-loss" className="mt-4">
            {/* Revenue vs Expenses Bar Chart */}
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Revenue vs Expenses Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    revenue: { label: "Revenue", color: "hsl(var(--success))" },
                    expenses: { label: "Expenses", color: "hsl(var(--destructive))" }
                  }}
                  className="h-[200px]"
                >
                  <BarChart data={[{ name: 'Total', revenue: revenueTotal, expenses: expenseTotal }]}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                    Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getAccountsByType('revenue').length > 0 && (
                    <ChartContainer
                      config={getAccountsByType('revenue').reduce((acc, account, idx) => ({
                        ...acc,
                        [account.account_code]: { 
                          label: account.account_name, 
                          color: `hsl(${120 + idx * 30}, 70%, 50%)` 
                        }
                      }), {})}
                      className="h-[180px] mb-4"
                    >
                      <PieChart>
                        <Pie
                          data={getAccountsByType('revenue').map((a, idx) => ({
                            name: a.account_name,
                            value: a.current_balance || 0,
                            fill: `hsl(${120 + idx * 30}, 70%, 50%)`
                          }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                        >
                          {getAccountsByType('revenue').map((_, idx) => (
                            <Cell key={idx} fill={`hsl(${120 + idx * 30}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  )}
                  <Table>
                    <TableBody>
                      {getAccountsByType('revenue').map(account => (
                        <TableRow key={account.id}>
                          <TableCell>{account.account_name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {(account.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-success/10">
                        <TableCell>Total Revenue</TableCell>
                        <TableCell className="text-right font-mono">
                          {revenueTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getAccountsByType('expense').length > 0 && (
                    <ChartContainer
                      config={getAccountsByType('expense').reduce((acc, account, idx) => ({
                        ...acc,
                        [account.account_code]: { 
                          label: account.account_name, 
                          color: `hsl(${0 + idx * 20}, 70%, 50%)` 
                        }
                      }), {})}
                      className="h-[180px] mb-4"
                    >
                      <PieChart>
                        <Pie
                          data={getAccountsByType('expense').map((a, idx) => ({
                            name: a.account_name,
                            value: a.current_balance || 0,
                            fill: `hsl(${0 + idx * 20}, 70%, 50%)`
                          }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                        >
                          {getAccountsByType('expense').map((_, idx) => (
                            <Cell key={idx} fill={`hsl(${0 + idx * 20}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  )}
                  <Table>
                    <TableBody>
                      {getAccountsByType('expense').map(account => (
                        <TableRow key={account.id}>
                          <TableCell>{account.account_name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {(account.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-destructive/10">
                        <TableCell>Total Expenses</TableCell>
                        <TableCell className="text-right font-mono">
                          {expenseTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className={cn(
                  "text-center p-6 rounded-lg",
                  netIncome >= 0 ? "bg-success/10" : "bg-destructive/10"
                )}>
                  <p className="text-sm text-muted-foreground mb-1">Net Income</p>
                  <p className={cn(
                    "text-3xl font-bold",
                    netIncome >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {netIncome >= 0 ? '+' : ''}{netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance-sheet" className="mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {getAccountsByType('asset').map(account => (
                          <TableRow key={account.id}>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {(account.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-primary/10">
                          <TableCell>Total Assets</TableCell>
                          <TableCell className="text-right font-mono">
                            {assetTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Liabilities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {getAccountsByType('liability').map(account => (
                          <TableRow key={account.id}>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {(account.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold">
                          <TableCell>Total Liabilities</TableCell>
                          <TableCell className="text-right font-mono">
                            {liabilityTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Equity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {getAccountsByType('equity').map(account => (
                          <TableRow key={account.id}>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {(account.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell>Retained Earnings</TableCell>
                          <TableCell className="text-right font-mono">
                            {netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                        <TableRow className="font-bold bg-primary/10">
                          <TableCell>Total Equity</TableCell>
                          <TableCell className="text-right font-mono">
                            {(equityTotal + netIncome).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="bg-muted">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Total Liabilities + Equity</span>
                      <span className="font-bold font-mono">
                        {(liabilityTotal + equityTotal + netIncome).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FinancialReports;