import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory, LogOut, ClipboardList, Users, TrendingUp, UserPlus, Calendar, Printer, History } from 'lucide-react';
import { OrdersList } from '@/components/production-manager/OrdersList';
import { ActiveAssignments } from '@/components/production-manager/ActiveAssignments';
import { EfficiencyMetrics } from '@/components/production-manager/EfficiencyMetrics';
import { DirectAssignment } from '@/components/production-manager/DirectAssignment';
import { ProductionCalendar } from '@/components/production-manager/ProductionCalendar';
import { ReprintRequests } from '@/components/production-manager/ReprintRequests';
import { ReprintRequestHistory } from '@/components/production-manager/ReprintRequestHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

const ProductionManagerDashboard = () => {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();

  // Fetch pending reprint requests count
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

  // Set up real-time subscription for new reprint requests
  useEffect(() => {
    const channel = supabase
      .channel('reprint-requests-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reprint_requests',
        },
        async (payload) => {
          console.log('New reprint request:', payload);
          
          // Fetch operator details for the notification
          const { data: operatorData } = await supabase
            .from('profiles')
            .select('full_name, employee_code')
            .eq('id', payload.new.operator_id)
            .single();

          toast({
            title: '🔔 New Reprint Request',
            description: `${operatorData?.full_name || 'An operator'} has requested a label reprint`,
            duration: 5000,
          });

          // Refresh the count
          refetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, refetchCount]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar border-b border-sidebar-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-sidebar-foreground">Production Manager</h1>
                <p className="text-sm text-sidebar-foreground/70">
                  {profile?.full_name} {profile?.employee_code && `(${profile.employee_code})`}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-6 w-6" />
              Production Management Dashboard
            </CardTitle>
            <CardDescription>
              View approved orders and assign production work to operators
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 max-w-6xl">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Direct
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="reprints" className="flex items-center gap-2 relative">
              <Printer className="h-4 w-4" />
              Reprints
              {pendingCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-1 h-5 min-w-5 rounded-full px-1 text-xs"
                >
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <OrdersList />
          </TabsContent>

          <TabsContent value="direct" className="space-y-4">
            <DirectAssignment />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <ProductionCalendar />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <ActiveAssignments />
          </TabsContent>

          <TabsContent value="reprints" className="space-y-4">
            <ReprintRequests />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ReprintRequestHistory />
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <EfficiencyMetrics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProductionManagerDashboard;
