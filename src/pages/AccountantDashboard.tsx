import { useState } from 'react';
import {
  BookOpen, FileText, Receipt, FileSpreadsheet, Clock, BarChart3,
  ShoppingBag, RotateCcw, Undo2, BookMarked,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AppHeader } from '@/components/layout/AppHeader';
import { RoleSidebar, NavSection, PageHeader } from '@/components/layout/RoleSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const SECTIONS: NavSection[] = [
  {
    label: 'Ledger',
    items: [{ key: 'ledger', label: 'Chart of Accounts', icon: BookOpen }],
  },
  {
    label: 'Vouchers',
    items: [
      { key: 'voucher-purchase', label: 'Purchase', icon: ShoppingBag },
      { key: 'voucher-sales', label: 'Sales', icon: FileSpreadsheet },
      { key: 'voucher-purchase-return', label: 'Purchase Return', icon: Undo2 },
      { key: 'voucher-sales-return', label: 'Sales Return', icon: RotateCcw },
      { key: 'voucher-journal', label: 'Journal', icon: BookMarked },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { key: 'invoices', label: 'Sales Invoices', icon: FileText },
      { key: 'shift-data', label: 'Shift Data', icon: Clock },
    ],
  },
  {
    label: 'Reports',
    items: [{ key: 'reports', label: 'All Reports', icon: BarChart3 }],
  },
];

const TITLES: Record<string, { title: string; description: string }> = {
  ledger: { title: 'Chart of Accounts', description: 'Manage your ledger and account hierarchy' },
  'voucher-purchase': { title: 'Purchase Voucher', description: 'Record a purchase invoice' },
  'voucher-sales': { title: 'Sales Voucher', description: 'Record a sales invoice' },
  'voucher-purchase-return': { title: 'Purchase Return', description: 'Record a purchase return' },
  'voucher-sales-return': { title: 'Sales Return', description: 'Record a customer return' },
  'voucher-journal': { title: 'Journal Voucher', description: 'Manual journal entry' },
  invoices: { title: 'Sales Invoices', description: 'All issued sales invoices' },
  'shift-data': { title: 'Shift Data', description: 'Daily shift entries' },
  reports: { title: 'Reports', description: 'Vouchers, financial and operational reports' },
};

const AccountantDashboard = () => {
  const [activeTab, setActiveTab] = useState('ledger');
  const meta = TITLES[activeTab] ?? { title: 'Accounting', description: '' };

  return (
    <AppShell
      sidebar={
        <RoleSidebar
          brand="Production ERP"
          roleLabel="Accountant"
          sections={SECTIONS}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      }
      header={<AppHeader title={meta.title} subtitle={meta.description} />}
    >
      <PageHeader title={meta.title} description={meta.description} />

      {activeTab === 'ledger' && <ChartOfAccountsManagement />}
      {activeTab === 'voucher-purchase' && <CreatePurchaseInvoice />}
      {activeTab === 'voucher-sales' && <CreateSalesInvoice />}
      {activeTab === 'voucher-purchase-return' && <PurchaseReturnForm />}
      {activeTab === 'voucher-sales-return' && <ProductReturns />}
      {activeTab === 'voucher-journal' && <JournalEntryForm />}
      {activeTab === 'invoices' && <SalesInvoicesList />}
      {activeTab === 'shift-data' && <ShiftDataManagement />}
      {activeTab === 'reports' && (
        <Tabs defaultValue="vouchers" className="space-y-4">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="vouchers">All Vouchers</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
          </TabsList>
          <TabsContent value="vouchers"><AllVouchersReport /></TabsContent>
          <TabsContent value="financial"><FinancialReports /></TabsContent>
          <TabsContent value="sales"><SalesReceivablesReport /></TabsContent>
          <TabsContent value="inventory"><InventoryReports /></TabsContent>
          <TabsContent value="commission"><CommissionReports /></TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
};

export default AccountantDashboard;
