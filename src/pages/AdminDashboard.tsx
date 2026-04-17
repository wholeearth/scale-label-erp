import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Users, Package, Settings, Ruler, UserCheck, ShoppingCart, Cpu,
  FileText, Banknote, QrCode, BarChart3,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AppHeader } from '@/components/layout/AppHeader';
import { RoleSidebar, NavSection, PageHeader } from '@/components/layout/RoleSidebar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import LiveProductionDashboard from '@/components/admin/LiveProductionDashboard';
import UserManagement from '@/components/admin/UserManagement';
import ItemManagement from '@/components/admin/ItemManagement';
import UnitsManagement from '@/components/admin/UnitsManagement';
import CustomerManagement from '@/components/admin/CustomerManagement';
import OrderManagement from '@/components/admin/OrderManagement';
import SystemSettings from '@/components/admin/SystemSettings';
import MachineManagement from '@/components/admin/MachineManagement';
import InventoryManagement from '@/components/admin/InventoryManagement';
import JumboRollInventory from '@/components/admin/JumboRollInventory';
import ConsumptionHistoryReport from '@/components/admin/ConsumptionHistoryReport';
import PurchaseManagement from '@/components/admin/PurchaseManagement';
import { CommissionAgentManagement } from '@/components/admin/CommissionAgentManagement';
import LabelCustomizationTool from '@/components/admin/LabelCustomizationTool';
import ProductionDetailReport from '@/components/admin/reports/ProductionDetailReport';
import ProductionSummaryReport from '@/components/admin/reports/ProductionSummaryReport';
import PerformanceReport from '@/components/admin/reports/PerformanceReport';
import FinancialReports from '@/components/reports/FinancialReports';
import SalesReceivablesReport from '@/components/reports/SalesReceivablesReport';
import InventoryReports from '@/components/reports/InventoryReports';
import CommissionReports from '@/components/reports/CommissionReports';

const SECTIONS: NavSection[] = [
  {
    label: 'Dashboard',
    items: [{ key: 'live-dashboard', label: 'Live Production', icon: Activity }],
  },
  {
    label: 'Master Data',
    items: [
      { key: 'customers', label: 'Customers', icon: UserCheck },
      { key: 'users', label: 'Users', icon: Users },
      { key: 'items', label: 'Items', icon: Package },
      { key: 'units', label: 'Units', icon: Ruler },
      { key: 'machines', label: 'Machines', icon: Cpu },
      { key: 'commission-agents', label: 'Agents', icon: Banknote },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { key: 'orders', label: 'Orders', icon: ShoppingCart },
      { key: 'purchases', label: 'Purchases', icon: FileText },
    ],
  },
  {
    label: 'Inventory',
    items: [{ key: 'inventory', label: 'Inventory', icon: Package }],
  },
  {
    label: 'Reports',
    items: [{ key: 'reports', label: 'All Reports', icon: BarChart3 }],
  },
  {
    label: 'Settings',
    items: [{ key: 'settings', label: 'System Settings', icon: Settings }],
  },
];

const TITLES: Record<string, { title: string; description: string }> = {
  'live-dashboard': { title: 'Live Production', description: 'Real-time view of running production lines' },
  'orders': { title: 'Orders', description: 'Manage customer orders and statuses' },
  'customers': { title: 'Customers', description: 'Customer master records' },
  'users': { title: 'Users', description: 'System users and roles' },
  'items': { title: 'Items', description: 'Product and material catalog' },
  'inventory': { title: 'Inventory', description: 'Stock levels and consumption history' },
  'purchases': { title: 'Purchases', description: 'Purchase invoices and supplier records' },
  'commission-agents': { title: 'Commission Agents', description: 'Agent profiles and commission structures' },
  'units': { title: 'Units', description: 'Units of measure' },
  'machines': { title: 'Machines', description: 'Production machine registry' },
  'settings': { title: 'System Settings', description: 'Application configuration' },
  'reports': { title: 'Reports', description: 'Production, financial and operational reports' },
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('live-dashboard');
  const meta = TITLES[activeTab] ?? { title: 'Admin', description: '' };

  return (
    <AppShell
      sidebar={
        <RoleSidebar
          brand="Production ERP"
          roleLabel="Administrator"
          sections={SECTIONS}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      }
      header={<AppHeader title={meta.title} subtitle={meta.description} />}
    >
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/traceability')}>
            <QrCode className="h-4 w-4 mr-2" />
            Traceability
          </Button>
        }
      />

      {activeTab === 'live-dashboard' && <LiveProductionDashboard />}
      {activeTab === 'orders' && <OrderManagement />}
      {activeTab === 'customers' && <CustomerManagement />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'items' && <ItemManagement />}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <JumboRollInventory />
          <ConsumptionHistoryReport />
          <InventoryManagement />
        </div>
      )}
      {activeTab === 'purchases' && <PurchaseManagement />}
      {activeTab === 'commission-agents' && <CommissionAgentManagement />}
      {activeTab === 'units' && <UnitsManagement />}
      {activeTab === 'machines' && <MachineManagement />}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <SystemSettings />
          <LabelCustomizationTool />
        </div>
      )}
      {activeTab === 'reports' && (
        <Tabs defaultValue="production" className="space-y-4">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
          </TabsList>
          <TabsContent value="production" className="space-y-6">
            <ProductionDetailReport />
            <ProductionSummaryReport />
            <PerformanceReport />
          </TabsContent>
          <TabsContent value="financial"><FinancialReports /></TabsContent>
          <TabsContent value="sales"><SalesReceivablesReport /></TabsContent>
          <TabsContent value="inventory"><InventoryReports /></TabsContent>
          <TabsContent value="commission"><CommissionReports /></TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
};

export default AdminDashboard;
