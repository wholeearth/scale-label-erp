import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Download, Users, Wallet, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const CommissionReports = () => {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [reportTab, setReportTab] = useState('summary');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Fetch commission agents
  const { data: agents = [] } = useQuery({
    queryKey: ['commission-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agents')
        .select('*')
        .order('agent_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch commission transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['commission-transactions', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_transactions')
        .select('*, commission_agents(agent_name, agent_code)')
        .gte('transaction_date', format(dateFrom, 'yyyy-MM-dd'))
        .lte('transaction_date', format(dateTo, 'yyyy-MM-dd'))
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch customers by agent
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-by-agent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*, commission_agents(agent_name, agent_code)')
        .not('commission_agent_id', 'is', null)
        .order('customer_name');
      if (error) throw error;
      return data;
    }
  });

  // Calculate agent summaries
  const agentSummaries = agents.map(agent => {
    const agentTransactions = transactions.filter((t: any) => t.agent_id === agent.id);
    const earned = agentTransactions
      .filter((t: any) => t.transaction_type === 'commission_earned')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const paid = agentTransactions
      .filter((t: any) => t.transaction_type === 'payment')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const receiptsCollected = agentTransactions
      .filter((t: any) => t.transaction_type === 'receipt_collected')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const receiptsPaid = agentTransactions
      .filter((t: any) => t.transaction_type === 'receipt_paid')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    
    const agentCustomers = customers.filter((c: any) => c.commission_agent_id === agent.id);
    
    return {
      ...agent,
      commissionEarned: earned,
      commissionPaid: paid,
      commissionBalance: earned - paid,
      receiptsCollected,
      receiptsPaid,
      receiptsBalance: receiptsCollected - receiptsPaid,
      customerCount: agentCustomers.length,
      transactionCount: agentTransactions.length
    };
  });

  const filteredTransactions = selectedAgent === 'all'
    ? transactions
    : transactions.filter((t: any) => t.agent_id === selectedAgent);

  const totalEarned = agentSummaries.reduce((sum, a) => sum + a.commissionEarned, 0);
  const totalPaid = agentSummaries.reduce((sum, a) => sum + a.commissionPaid, 0);
  const totalBalance = agentSummaries.reduce((sum, a) => sum + a.commissionBalance, 0);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object').join(',');
    const rows = data.map(row =>
      Object.entries(row)
        .filter(([_, v]) => typeof v !== 'object')
        .map(([_, v]) => v)
        .join(',')
    ).join('\n');
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
            <CardTitle>Commission Reports</CardTitle>
            <CardDescription>Agent commission summary and payout history</CardDescription>
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
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Agents</p>
              <p className="text-2xl font-bold">{agents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Commission Earned</p>
              <p className="text-2xl font-bold text-success">
                {totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Commission Paid</p>
              <p className="text-2xl font-bold">
                {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card className={cn(totalBalance > 0 && "border-warning")}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
              <p className={cn("text-2xl font-bold", totalBalance > 0 && "text-warning")}>
                {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={reportTab} onValueChange={setReportTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">
              <Users className="h-4 w-4 mr-2" />
              Agent Summary
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <Wallet className="h-4 w-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="customers">
              <TrendingUp className="h-4 w-4 mr-2" />
              Customer-wise
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            {/* Agent Commission Charts */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Commission by Agent Bar Chart */}
              {agentSummaries.filter(a => a.commissionEarned > 0).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Commission by Agent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        earned: { label: "Earned", color: "hsl(var(--success))" },
                        paid: { label: "Paid", color: "hsl(var(--muted-foreground))" }
                      }}
                      className="h-[220px]"
                    >
                      <BarChart data={agentSummaries
                        .filter(a => a.commissionEarned > 0)
                        .slice(0, 6)
                        .map(a => ({
                          name: a.agent_name.slice(0, 12),
                          earned: a.commissionEarned,
                          paid: a.commissionPaid
                        }))
                      }>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="earned" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="paid" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {/* Customers per Agent Pie Chart */}
              {agentSummaries.filter(a => a.customerCount > 0).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Customers per Agent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={agentSummaries.slice(0, 6).reduce((acc, agent, idx) => ({
                        ...acc,
                        [agent.agent_code]: { 
                          label: agent.agent_name, 
                          color: `hsl(${idx * 50}, 70%, 50%)` 
                        }
                      }), {})}
                      className="h-[220px]"
                    >
                      <PieChart>
                        <Pie
                          data={agentSummaries
                            .filter(a => a.customerCount > 0)
                            .slice(0, 6)
                            .map((a, idx) => ({
                              name: a.agent_name,
                              value: a.customerCount,
                              fill: `hsl(${idx * 50}, 70%, 50%)`
                            }))
                          }
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          label={({ name, value }) => `${name.slice(0, 8)}: ${value}`}
                        >
                          {agentSummaries.slice(0, 6).map((_, idx) => (
                            <Cell key={idx} fill={`hsl(${idx * 50}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  agentSummaries.map(a => ({
                    code: a.agent_code,
                    name: a.agent_name,
                    customers: a.customerCount,
                    earned: a.commissionEarned,
                    paid: a.commissionPaid,
                    balance: a.commissionBalance,
                    receiptsHeld: a.receiptsBalance
                  })),
                  'commission_summary'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Code</TableHead>
                  <TableHead>Agent Name</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Commission Earned</TableHead>
                  <TableHead className="text-right">Commission Paid</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead className="text-right">Receipts Held</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentSummaries.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-mono">{agent.agent_code}</TableCell>
                    <TableCell className="font-medium">{agent.agent_name}</TableCell>
                    <TableCell className="text-right">{agent.customerCount}</TableCell>
                    <TableCell className="text-right font-mono text-success">
                      {agent.commissionEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {agent.commissionPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {agent.commissionBalance > 0 ? (
                        <span className="text-warning">
                          {agent.commissionBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <Badge variant="secondary">Settled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {agent.receiptsBalance > 0 ? (
                        <span className="text-primary">
                          {agent.receiptsBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            <div className="flex justify-between mb-4">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Filter by agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.agent_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  filteredTransactions.map((t: any) => ({
                    date: t.transaction_date,
                    agent: t.commission_agents?.agent_name,
                    type: t.transaction_type,
                    amount: t.amount,
                    reference: t.reference_number,
                    description: t.description
                  })),
                  'commission_transactions'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction: any) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{format(new Date(transaction.transaction_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="font-medium">
                      {transaction.commission_agents?.agent_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        transaction.transaction_type === 'commission_earned' ? 'default' :
                        transaction.transaction_type === 'payment' ? 'secondary' :
                        'outline'
                      }>
                        {transaction.transaction_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      transaction.transaction_type === 'commission_earned' ? "text-success" :
                      transaction.transaction_type === 'payment' ? "text-muted-foreground" :
                      ""
                    )}>
                      {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{transaction.reference_number || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  customers.map((c: any) => ({
                    customer: c.customer_name,
                    email: c.contact_email,
                    phone: c.contact_phone,
                    agent: c.commission_agents?.agent_name,
                    agentCode: c.commission_agents?.agent_code
                  })),
                  'customers_by_agent'
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Commission Agent</TableHead>
                  <TableHead>Agent Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer: any) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.customer_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.contact_email || customer.contact_phone || '-'}
                    </TableCell>
                    <TableCell>{customer.commission_agents?.agent_name}</TableCell>
                    <TableCell className="font-mono">{customer.commission_agents?.agent_code}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CommissionReports;