import { useState } from 'react';
import { Users, FileText, Receipt, DollarSign, BarChart3, ShoppingCart } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AppHeader } from '@/components/layout/AppHeader';
import { RoleSidebar, NavSection, PageHeader } from '@/components/layout/RoleSidebar';
import { AgentInvoicesList } from '@/components/commission-agent/AgentInvoicesList';
import { AgentStatement } from '@/components/commission-agent/AgentStatement';
import { AgentCustomers } from '@/components/commission-agent/AgentCustomers';
import { AgentReceiptCollection } from '@/components/commission-agent/AgentReceiptCollection';
import { AgentReports } from '@/components/commission-agent/AgentReports';
import { AgentOrders } from '@/components/commission-agent/AgentOrders';

const SECTIONS: NavSection[] = [
  {
    label: 'Sales',
    items: [
      { key: 'orders', label: 'Orders', icon: ShoppingCart },
      { key: 'invoices', label: 'Invoices', icon: FileText },
      { key: 'customers', label: 'My Customers', icon: Users },
    ],
  },
  {
    label: 'Collections',
    items: [
      { key: 'receipts', label: 'Collect Receipt', icon: Receipt },
      { key: 'statement', label: 'Statement', icon: DollarSign },
    ],
  },
  {
    label: 'Reports',
    items: [{ key: 'reports', label: 'Reports', icon: BarChart3 }],
  },
];

const TITLES: Record<string, { title: string; description: string }> = {
  orders: { title: 'Orders', description: 'Place and view orders for your customers' },
  invoices: { title: 'Invoices', description: 'Customer invoices' },
  customers: { title: 'My Customers', description: 'Customers assigned to you' },
  receipts: { title: 'Collect Receipt', description: 'Record cash collections from customers' },
  statement: { title: 'Statement', description: 'Your commission statement' },
  reports: { title: 'Reports', description: 'Sales and commission reports' },
};

export default function CommissionAgentDashboard() {
  const [activeTab, setActiveTab] = useState('orders');
  const meta = TITLES[activeTab];

  return (
    <AppShell
      sidebar={
        <RoleSidebar
          brand="Commission Agent"
          roleLabel="Sales Agent"
          sections={SECTIONS}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      }
      header={<AppHeader title={meta.title} subtitle={meta.description} />}
    >
      <PageHeader title={meta.title} description={meta.description} />
      {activeTab === 'orders' && <AgentOrders />}
      {activeTab === 'invoices' && <AgentInvoicesList />}
      {activeTab === 'customers' && <AgentCustomers />}
      {activeTab === 'receipts' && <AgentReceiptCollection />}
      {activeTab === 'statement' && <AgentStatement />}
      {activeTab === 'reports' && <AgentReports />}
    </AppShell>
  );
}
