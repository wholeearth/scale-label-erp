import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory, LogOut, ClipboardList, Users } from 'lucide-react';
import { OrdersList } from '@/components/production-manager/OrdersList';
import { ActiveAssignments } from '@/components/production-manager/ActiveAssignments';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ProductionManagerDashboard = () => {
  const { profile, signOut } = useAuth();

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
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Approved Orders
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <OrdersList />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <ActiveAssignments />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProductionManagerDashboard;
