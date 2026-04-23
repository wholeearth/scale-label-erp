import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Factory, UserCheck, ListChecks, Loader2 } from 'lucide-react';

interface Props {
  machineId: string | null;
}

type QueueRow = {
  key: string;
  source: 'operator' | 'machine';
  priority?: number;
  itemName: string;
  itemCode?: string;
  orderNumber?: string;
  customerName?: string;
  produced: number;
  total: number;
  status: string;
};

/**
 * Combined work queue for the operator:
 * - direct operator_assignments assigned to this user
 * - machine_assignments queued on the active machine
 * Each row carries a badge identifying the source.
 */
export const UnifiedWorkQueue = ({ machineId }: Props) => {
  const { user } = useAuth();

  const { data: opAssignments, isLoading: loadingOp } = useQuery({
    queryKey: ['op-assignments-mine', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_assignments')
        .select('id, quantity_assigned, quantity_produced, status, items(product_name, product_code)')
        .eq('operator_id', user!.id)
        .in('status', ['active', 'in_progress'])
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const { data: machineAssignments, isLoading: loadingMachine } = useQuery({
    queryKey: ['machine-queue-unified', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machine_assignments')
        .select(
          'id, priority, planned_quantity, produced_quantity, status, planned_date, items(product_name, product_code), orders(order_number, customers(customer_name))',
        )
        .eq('machine_id', machineId!)
        .in('status', ['planned', 'in_progress'])
        .order('status', { ascending: false }) // in_progress first (alphabetical desc)
        .order('priority', { ascending: true })
        .order('planned_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const rows: QueueRow[] = [
    ...((opAssignments || []) as any[]).map((a) => ({
      key: `op-${a.id}`,
      source: 'operator' as const,
      itemName: a.items?.product_name ?? '—',
      itemCode: a.items?.product_code,
      produced: Number(a.quantity_produced || 0),
      total: Number(a.quantity_assigned || 0),
      status: a.status,
    })),
    ...((machineAssignments || []) as any[]).map((a) => ({
      key: `m-${a.id}`,
      source: 'machine' as const,
      priority: a.priority,
      itemName: a.items?.product_name ?? '—',
      itemCode: a.items?.product_code,
      orderNumber: a.orders?.order_number,
      customerName: a.orders?.customers?.customer_name,
      produced: Number(a.produced_quantity || 0),
      total: Number(a.planned_quantity || 0),
      status: a.status,
    })),
  ];

  // Sort: in_progress first, then by priority asc (machine), then operator items
  rows.sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    if (a.source === 'machine' && b.source === 'machine') {
      return (a.priority ?? 99) - (b.priority ?? 99);
    }
    return 0;
  });

  const loading = loadingOp || loadingMachine;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" /> My Work Queue
            </CardTitle>
            <CardDescription>
              Items assigned to you plus pending work for your machine
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <UserCheck className="h-3 w-3" /> Assigned to me
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Factory className="h-3 w-3" /> Machine queue
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading queue...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
            Nothing queued for you right now. New machine work for this machine will appear here automatically.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const remaining = Math.max(0, r.total - r.produced);
              const pct = r.total > 0 ? Math.min(100, Math.round((r.produced / r.total) * 100)) : 0;
              return (
                <div key={r.key} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.source === 'operator' ? (
                        <Badge variant="secondary" className="gap-1">
                          <UserCheck className="h-3 w-3" /> Assigned to me
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20">
                          <Factory className="h-3 w-3" /> Machine queue
                          {r.priority !== undefined && (
                            <span className="ml-1 opacity-80">P{r.priority}</span>
                          )}
                        </Badge>
                      )}
                      {r.status === 'in_progress' && (
                        <Badge variant="outline" className="border-success/30 text-success">
                          In progress
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium mt-1 truncate">
                      {r.itemName}
                      {r.itemCode && (
                        <span className="text-muted-foreground font-normal ml-1">({r.itemCode})</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.orderNumber && <>Order {r.orderNumber}</>}
                      {r.customerName && <> • {r.customerName}</>}
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {r.produced}/{r.total}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {remaining > 0 ? `${remaining} remaining` : 'Complete'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UnifiedWorkQueue;
