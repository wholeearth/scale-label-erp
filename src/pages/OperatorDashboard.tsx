import { useState } from 'react';
import { Activity, Clock } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AppHeader } from '@/components/layout/AppHeader';
import { RoleSidebar, NavSection, PageHeader } from '@/components/layout/RoleSidebar';
import ProductionInterface from '@/components/operator/ProductionInterface';
import ShiftManagement from '@/components/operator/ShiftManagement';

const SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { key: 'production', label: 'Production', icon: Activity },
      { key: 'shift', label: 'Shift Management', icon: Clock },
    ],
  },
];

const TITLES: Record<string, { title: string; description: string }> = {
  production: { title: 'Production', description: 'Run production, scan items, and print labels' },
  shift: { title: 'Shift Management', description: 'Start and end your shift' },
};

const OperatorDashboard = () => {
  const [activeTab, setActiveTab] = useState('production');
  const meta = TITLES[activeTab];

  return (
    <AppShell
      sidebar={
        <RoleSidebar
          brand="Production ERP"
          roleLabel="Operator"
          sections={SECTIONS}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      }
      header={<AppHeader title={meta.title} subtitle={meta.description} />}
    >
      <PageHeader title={meta.title} description={meta.description} />
      {activeTab === 'production' && <ProductionInterface />}
      {activeTab === 'shift' && <ShiftManagement />}
    </AppShell>
  );
};

export default OperatorDashboard;
