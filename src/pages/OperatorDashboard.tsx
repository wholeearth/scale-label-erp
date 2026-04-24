import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock, Factory } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { AppHeader } from '@/components/layout/AppHeader';
import { RoleSidebar, NavSection, PageHeader } from '@/components/layout/RoleSidebar';
import ProductionInterface from '@/components/operator/ProductionInterface';
import ShiftManagement from '@/components/operator/ShiftManagement';
import MachineShiftEntry from '@/components/operator/MachineShiftEntry';
import MachineSelectGate, { DEVICE_MACHINE_KEY } from '@/components/operator/MachineSelectGate';

const SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { key: 'production', label: 'Production', icon: Activity },
      { key: 'machine', label: 'Machine Entry', icon: Factory },
      { key: 'shift', label: 'Shift Management', icon: Clock },
    ],
  },
];

const TITLES: Record<string, { title: string; description: string }> = {
  production: { title: 'Production', description: 'Run production, scan items, and print labels' },
  machine: { title: 'Machine Entry', description: 'Record produced quantity against machine assignments' },
  shift: { title: 'Shift Management', description: 'Manage your active shift' },
};

const OperatorDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('production');
  const meta = TITLES[activeTab];

  // Active shift drives the gate visibility
  const { data: activeShift, isLoading: shiftLoading } = useQuery({
    queryKey: ['active-shift', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_records')
        .select('id, machine_id, shift_start, shift_end')
        .eq('operator_id', user!.id)
        .is('shift_end', null)
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  // Device-locked machine: once shift starts on this device, the machine cannot be changed here
  const deviceMachineId = useMemo(() => {
    if (activeShift?.machine_id) return activeShift.machine_id as string;
    return localStorage.getItem(DEVICE_MACHINE_KEY);
  }, [activeShift?.machine_id]);

  // If shift ended, clear the device lock
  useEffect(() => {
    if (!shiftLoading && !activeShift) {
      localStorage.removeItem(DEVICE_MACHINE_KEY);
    }
  }, [activeShift, shiftLoading]);

  const showGate = !authLoading && !shiftLoading && !activeShift;

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
      {activeTab === 'machine' && <MachineShiftEntry />}
      {activeTab === 'shift' && <ShiftManagement />}

      {showGate && <MachineSelectGate onShiftStarted={() => setActiveTab('production')} />}
    </AppShell>
  );
};

export default OperatorDashboard;
