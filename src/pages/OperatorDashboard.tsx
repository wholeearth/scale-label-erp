import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory, LogOut } from 'lucide-react';
import ProductionInterface from '@/components/operator/ProductionInterface';
import ShiftManagement from '@/components/operator/ShiftManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const OperatorDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar border-b border-sidebar-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-gradient-success flex items-center justify-center">
                <Factory className="h-5 w-5 text-success-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-sidebar-foreground">Production System</h1>
                <p className="text-sm text-sidebar-foreground/70">Operator Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
                <p className="text-xs text-sidebar-foreground/70">Operator {profile?.employee_code}</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="production" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="shift">Shift Management</TabsTrigger>
          </TabsList>

          <TabsContent value="production">
            <ProductionInterface />
          </TabsContent>

          <TabsContent value="shift">
            <ShiftManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default OperatorDashboard;
