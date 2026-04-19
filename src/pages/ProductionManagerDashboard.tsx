import { useState, useEffect } from 'react';
import {
  ClipboardList, Users, TrendingUp, UserPlus, Calendar, Printer, History, Clock, Factory,
  Truck, Sparkles, BarChart3,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AppHeader } from '@/components/layout/AppHeader';
import { RoleSidebar, NavSection, PageHeader } from '@/components/layout/RoleSidebar';
import { OrdersList } from '@/components/production-manager/OrdersList';
import { ActiveAssignments } from '@/components/production-manager/ActiveAssignments';
import { EfficiencyMetrics } from '@/components/production-manager/EfficiencyMetrics';
import { DirectAssignment } from '@/components/production-manager/DirectAssignment';
import { MachinePlanning } from '@/components/production-manager/MachinePlanning';
import { ProductionCalendar } from '@/components/production-manager/ProductionCalendar';
import { ReprintRequests } from '@/components/production-manager/ReprintRequests';
import { ReprintRequestHistory } from '@/components/production-manager/ReprintRequestHistory';
import { DeliveryManagement } from '@/components/production-manager/DeliveryManagement';
import { SurplusAllocations } from '@/components/production-manager/SurplusAllocations';
import { MachinePerformanceReport } from '@/components/production-manager/MachinePerformanceReport';
import ShiftDataManagement from '@/components/accountant/ShiftDataManagement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TITLES: Record<string, { title: string; description: string }> = {
  orders: { title: 'Orders', description: 'Approved orders awaiting assignment' },
  direct: { title: 'Direct Assignment', description: 'Assign work directly to operators' },
  machines: { title: 'Machine Planning', description: 'Assign orders to machines and monitor load' },
  calendar: { title: 'Production Calendar', description: 'Schedule and view production runs' },
  assignments: { title: 'Active Assignments', description: 'In-progress operator assignments' },
  reprints: { title: 'Reprint Requests', description: 'Pending label reprint requests' },
  history: { title: 'Reprint History', description: 'Processed reprint requests' },
  metrics: { title: 'Efficiency Metrics', description: 'Operator and machine performance' },
  'shift-data': { title: 'Shift Data', description: 'Daily shift data input' },
  deliveries: { title: 'Deliveries', description: 'Create delivery notes; auto-generate draft invoices' },
  surplus: { title: 'Surplus Allocations', description: 'Reuse overproduction across pending orders' },
  'machine-perf': { title: 'Machine Performance', description: 'Machine-wise production analytics' },
};

const ProductionManagerDashboard = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('orders');

  const { data: pendingCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ['reprint-requests-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('reprint_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('reprint-requests-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reprint_requests' }, async (payload) => {
        const { data: operatorData } = await supabase
          .from('profiles').select('full_name, employee_code').eq('id', payload.new.operator_id).single();
        toast({
          title: '🔔 New Reprint Request',
          description: `${operatorData?.full_name || 'An operator'} has requested a label reprint`,
          duration: 5000,
        });
        refetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [toast, refetchCount]);

  const sections: NavSection[] = [
    {
      label: 'Workspace',
      items: [
        { key: 'orders', label: 'Orders', icon: ClipboardList },
        { key: 'machines', label: 'Machine Planning', icon: Factory },
        { key: 'direct', label: 'Direct Assignment', icon: UserPlus },
        { key: 'calendar', label: 'Calendar', icon: Calendar },
        { key: 'assignments', label: 'Assignments', icon: Users },
      ],
    },
    {
      label: 'Reprint Requests',
      items: [
        { key: 'reprints', label: 'Pending', icon: Printer, badge: pendingCount },
        { key: 'history', label: 'History', icon: History },
      ],
    },
    {
      label: 'Fulfillment',
      items: [
        { key: 'deliveries', label: 'Deliveries', icon: Truck },
        { key: 'surplus', label: 'Surplus', icon: Sparkles },
      ],
    },
    {
      label: 'Insights',
      items: [
        { key: 'metrics', label: 'Efficiency Metrics', icon: TrendingUp },
        { key: 'machine-perf', label: 'Machine Performance', icon: BarChart3 },
        { key: 'shift-data', label: 'Shift Data', icon: Clock },
      ],
    },
  ];

  const meta = TITLES[activeTab] ?? { title: 'Production', description: '' };

  return (
    <AppShell
      sidebar={
        <RoleSidebar
          brand="Production ERP"
          roleLabel="Production Manager"
          sections={sections}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      }
      header={<AppHeader title={meta.title} subtitle={meta.description} />}
    >
      <PageHeader title={meta.title} description={meta.description} />
      {activeTab === 'orders' && <OrdersList />}
      {activeTab === 'machines' && <MachinePlanning />}
      {activeTab === 'direct' && <DirectAssignment />}
      {activeTab === 'calendar' && <ProductionCalendar />}
      {activeTab === 'assignments' && <ActiveAssignments />}
      {activeTab === 'reprints' && <ReprintRequests />}
      {activeTab === 'history' && <ReprintRequestHistory />}
      {activeTab === 'metrics' && <EfficiencyMetrics />}
      {activeTab === 'shift-data' && <ShiftDataManagement />}
      {activeTab === 'deliveries' && <DeliveryManagement />}
      {activeTab === 'surplus' && <SurplusAllocations />}
      {activeTab === 'machine-perf' && <MachinePerformanceReport />}
    </AppShell>
  );
};

export default ProductionManagerDashboard;
