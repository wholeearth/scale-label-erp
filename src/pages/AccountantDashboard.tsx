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
  DollarSign,
  Receipt,
  Users,
  Warehouse,
  ShoppingCart,
  PackageX
} from 'lucide-react';
import ChartOfAccountsManagement from '@/components/accountant/ChartOfAccountsManagement';
import JournalEntryForm from '@/components/accountant/JournalEntryForm';
import GeneralLedger from '@/components/accountant/GeneralLedger';
import AccountingDashboardOverview from '@/components/accountant/AccountingDashboardOverview';
import SalesInvoices from '@/components/accountant/SalesInvoices';
import AccountsReceivable from '@/components/accountant/AccountsReceivable';
import { InventoryValuation } from '@/components/accountant/InventoryValuation';
import { StockConsumption } from '@/components/accountant/StockConsumption';
import { ProductReturns } from '@/components/accountant/ProductReturns';

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
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="chart-of-accounts">
              <BookOpen className="h-4 w-4 mr-2" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="journal-entry">
              <FileText className="h-4 w-4 mr-2" />
              Journal
            </TabsTrigger>
            <TabsTrigger value="general-ledger">
              <DollarSign className="h-4 w-4 mr-2" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="sales-invoices">
              <Receipt className="h-4 w-4 mr-2" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="accounts-receivable">
              <Users className="h-4 w-4 mr-2" />
              A/R
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Warehouse className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="consumption">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Consumption
            </TabsTrigger>
            <TabsTrigger value="returns">
              <PackageX className="h-4 w-4 mr-2" />
              Returns
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

          <TabsContent value="sales-invoices" className="space-y-6">
            <SalesInvoices />
          </TabsContent>

          <TabsContent value="accounts-receivable" className="space-y-6">
            <AccountsReceivable />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <InventoryValuation />
          </TabsContent>

          <TabsContent value="consumption" className="space-y-6">
            <StockConsumption />
          </TabsContent>

          <TabsContent value="returns" className="space-y-6">
            <ProductReturns />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AccountantDashboard;
