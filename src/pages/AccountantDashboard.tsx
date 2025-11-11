import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  BookOpen, 
  FileText,
  BarChart3,
  LogOut,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import ChartOfAccountsManagement from '@/components/accountant/ChartOfAccountsManagement';
import JournalEntryForm from '@/components/accountant/JournalEntryForm';
import GeneralLedger from '@/components/accountant/GeneralLedger';
import AccountingDashboardOverview from '@/components/accountant/AccountingDashboardOverview';

const AccountantDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar border-b border-sidebar-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-sidebar-foreground">Accounting System</h1>
                <p className="text-sm text-sidebar-foreground/70">Accountant Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
                <p className="text-xs text-sidebar-foreground/70">Accountant</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="chart-of-accounts">
              <BookOpen className="h-4 w-4 mr-2" />
              Chart of Accounts
            </TabsTrigger>
            <TabsTrigger value="journal-entry">
              <FileText className="h-4 w-4 mr-2" />
              Journal Entry
            </TabsTrigger>
            <TabsTrigger value="general-ledger">
              <DollarSign className="h-4 w-4 mr-2" />
              General Ledger
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AccountingDashboardOverview />
          </TabsContent>

          <TabsContent value="chart-of-accounts" className="space-y-6">
            <ChartOfAccountsManagement />
          </TabsContent>

          <TabsContent value="journal-entry" className="space-y-6">
            <JournalEntryForm />
          </TabsContent>

          <TabsContent value="general-ledger" className="space-y-6">
            <GeneralLedger />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AccountantDashboard;
