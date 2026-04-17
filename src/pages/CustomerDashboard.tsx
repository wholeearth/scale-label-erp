import { useState } from 'react';
import { ShoppingCart, Package, FileText, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AppHeader } from '@/components/layout/AppHeader';
import { RoleSidebar, NavSection, PageHeader } from '@/components/layout/RoleSidebar';
import { PlaceOrder } from '@/components/customer/PlaceOrder';
import { MyOrders } from '@/components/customer/MyOrders';
import { OrderTracking } from '@/components/customer/OrderTracking';
import { Statements } from '@/components/customer/Statements';

const SECTIONS: NavSection[] = [
  {
    label: 'Orders',
    items: [
      { key: 'place-order', label: 'New Order', icon: ShoppingCart },
      { key: 'my-orders', label: 'My Orders', icon: Package },
      { key: 'tracking', label: 'Track Orders', icon: TrendingUp },
    ],
  },
  {
    label: 'Account',
    items: [{ key: 'statements', label: 'Statements', icon: FileText }],
  },
];

const TITLES: Record<string, { title: string; description: string }> = {
  'place-order': { title: 'New Order', description: 'Place a new production order' },
  'my-orders': { title: 'My Orders', description: 'View and manage your orders' },
  'tracking': { title: 'Order Tracking', description: 'Real-time production status' },
  'statements': { title: 'Statements', description: 'Account statements and history' },
};

const CustomerDashboard = () => {
  const [activeTab, setActiveTab] = useState('place-order');
  const meta = TITLES[activeTab];

  return (
    <AppShell
      sidebar={
        <RoleSidebar
          brand="Customer Portal"
          roleLabel="Customer"
          sections={SECTIONS}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      }
      header={<AppHeader title={meta.title} subtitle={meta.description} />}
    >
      <PageHeader title={meta.title} description={meta.description} />
      {activeTab === 'place-order' && <PlaceOrder />}
      {activeTab === 'my-orders' && <MyOrders />}
      {activeTab === 'tracking' && <OrderTracking />}
      {activeTab === 'statements' && <Statements />}
    </AppShell>
  );
};

export default CustomerDashboard;
