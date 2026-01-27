import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  BookOpen, 
  FileText,
  LogOut,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import ChartOfAccountsManagement from '@/components/accountant/ChartOfAccountsManagement';
import CreateSalesInvoice from '@/components/accountant/CreateSalesInvoice';
import SalesInvoicesList from '@/components/accountant/SalesInvoicesList';
import JournalEntryForm from '@/components/accountant/JournalEntryForm';
import { ProductReturns } from '@/components/accountant/ProductReturns';
import { PurchaseReturnForm } from '@/components/accountant/PurchaseReturnForm';
import { AllVouchersReport } from '@/components/accountant/AllVouchersReport';
import CreatePurchaseInvoice from '@/components/admin/CreatePurchaseInvoice';
import ShiftDataManagement from '@/components/accountant/ShiftDataManagement';
import FinancialReports from '@/components/reports/FinancialReports';
import SalesReceivablesReport from '@/components/reports/SalesReceivablesReport';
import InventoryReports from '@/components/reports/InventoryReports';
import CommissionReports from '@/components/reports/CommissionReports';
import { Clock } from 'lucide-react';

const AccountantDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('ledger');
  const [voucherTab, setVoucherTab] = useState('purchase');

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
          <TabsList className="grid w-full grid-cols-5 gap-2">
            <TabsTrigger value="ledger">
              <BookOpen className="h-4 w-4 mr-2" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="voucher">
              <FileText className="h-4 w-4 mr-2" />
              Voucher
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="reports">
              <Receipt className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="shift-data">
              <Clock className="h-4 w-4 mr-2" />
              Shift Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-6">
            <ChartOfAccountsManagement />
          </TabsContent>

          <TabsContent value="voucher" className="space-y-6">
            <Tabs value={voucherTab} onValueChange={setVoucherTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="purchase">Purchase</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="purchase-return">Purchase Return</TabsTrigger>
                <TabsTrigger value="sales-return">Sales Return</TabsTrigger>
                <TabsTrigger value="journal">Journal</TabsTrigger>
              </TabsList>

              <TabsContent value="purchase" className="mt-6">
                <CreatePurchaseInvoice />
              </TabsContent>

              <TabsContent value="sales" className="mt-6">
                <CreateSalesInvoice />
              </TabsContent>

              <TabsContent value="purchase-return" className="mt-6">
                <PurchaseReturnForm />
              </TabsContent>

              <TabsContent value="sales-return" className="mt-6">
                <ProductReturns />
              </TabsContent>

              <TabsContent value="journal" className="mt-6">
                <JournalEntryForm />
              </TabsContent>
          </Tabs>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <SalesInvoicesList />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Tabs defaultValue="vouchers" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="vouchers">All Vouchers</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="sales">Sales & Receivables</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="commission">Commission</TabsTrigger>
              </TabsList>
              <TabsContent value="vouchers">
                <AllVouchersReport />
              </TabsContent>
              <TabsContent value="financial">
                <FinancialReports />
              </TabsContent>
              <TabsContent value="sales">
                <SalesReceivablesReport />
              </TabsContent>
              <TabsContent value="inventory">
                <InventoryReports />
              </TabsContent>
              <TabsContent value="commission">
                <CommissionReports />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="shift-data" className="space-y-6">
            <ShiftDataManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AccountantDashboard;
