import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';

const AccountingDashboardOverview = () => {
  const { data: accountSummary } = useQuery({
    queryKey: ['account-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('account_type, current_balance')
        .eq('is_active', true);
      
      if (error) throw error;

      const summary = {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        totalRevenue: 0,
        totalExpenses: 0,
      };

      data?.forEach(account => {
        const balance = parseFloat(account.current_balance?.toString() || '0');
        switch (account.account_type) {
          case 'asset':
            summary.totalAssets += balance;
            break;
          case 'liability':
            summary.totalLiabilities += balance;
            break;
          case 'equity':
            summary.totalEquity += balance;
            break;
          case 'revenue':
            summary.totalRevenue += balance;
            break;
          case 'expense':
            summary.totalExpenses += balance;
            break;
        }
      });

      return summary;
    },
  });

  const { data: recentEntries } = useQuery({
    queryKey: ['recent-journal-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const netIncome = (accountSummary?.totalRevenue || 0) - (accountSummary?.totalExpenses || 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Accounting Overview</h2>
        <p className="text-muted-foreground">Current financial position and recent activity</p>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(accountSummary?.totalAssets || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Current asset value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(accountSummary?.totalLiabilities || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Current obligations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owner's Equity</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(accountSummary?.totalEquity || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Capital value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${netIncome.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Journal Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Journal Entries</CardTitle>
          <CardDescription>Latest accounting transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEntries?.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{entry.entry_number}</p>
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${parseFloat(entry.total_debit?.toString() || '0').toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.entry_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {(!recentEntries || recentEntries.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No recent entries</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accounting Equation */}
      <Card>
        <CardHeader>
          <CardTitle>Accounting Equation</CardTitle>
          <CardDescription>Assets = Liabilities + Equity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Assets</p>
              <p className="text-2xl font-bold">${(accountSummary?.totalAssets || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Liabilities</p>
              <p className="text-2xl font-bold">${(accountSummary?.totalLiabilities || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Equity</p>
              <p className="text-2xl font-bold">${(accountSummary?.totalEquity || 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-primary/5 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Balance Check</p>
            <p className={`text-lg font-bold ${
              Math.abs((accountSummary?.totalAssets || 0) - ((accountSummary?.totalLiabilities || 0) + (accountSummary?.totalEquity || 0))) < 0.01
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {Math.abs((accountSummary?.totalAssets || 0) - ((accountSummary?.totalLiabilities || 0) + (accountSummary?.totalEquity || 0))) < 0.01
                ? '✓ Balanced'
                : '⚠ Out of Balance'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountingDashboardOverview;
