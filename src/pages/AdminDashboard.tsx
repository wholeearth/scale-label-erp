import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Factory, 
  Users, 
  Package, 
  Settings, 
  Activity,
  LogOut,
  Ruler,
  UserCheck,
  ShoppingCart
} from 'lucide-react';
import LiveProductionDashboard from '@/components/admin/LiveProductionDashboard';
import UserManagement from '@/components/admin/UserManagement';
import ItemManagement from '@/components/admin/ItemManagement';
import UnitsManagement from '@/components/admin/UnitsManagement';
import CustomerManagement from '@/components/admin/CustomerManagement';
import OrderManagement from '@/components/admin/OrderManagement';
import SystemSettings from '@/components/admin/SystemSettings';

const AdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('live-dashboard');

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
                <h1 className="text-xl font-bold text-sidebar-foreground">Production ERP</h1>
                <p className="text-sm text-sidebar-foreground/70">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
                <p className="text-xs text-sidebar-foreground/70">Administrator</p>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="live-dashboard">
              <Activity className="h-4 w-4 mr-2" />
              Live
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="customers">
              <UserCheck className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="items">
              <Package className="h-4 w-4 mr-2" />
              Items
            </TabsTrigger>
            <TabsTrigger value="units">
              <Ruler className="h-4 w-4 mr-2" />
              Units
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="reports">
              <Activity className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live-dashboard" className="space-y-6">
            <LiveProductionDashboard />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <OrderManagement />
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <CustomerManagement />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="items" className="space-y-6">
            <ItemManagement />
          </TabsContent>

          <TabsContent value="units" className="space-y-6">
            <UnitsManagement />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SystemSettings />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reports</CardTitle>
                <CardDescription>Production, sales, and inventory reports</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Reports module coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
