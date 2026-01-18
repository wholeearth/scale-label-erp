import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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
  ShoppingCart,
  Cpu,
  FileText,
  Banknote,
  QrCode
} from 'lucide-react';
import LiveProductionDashboard from '@/components/admin/LiveProductionDashboard';
import UserManagement from '@/components/admin/UserManagement';
import ItemManagement from '@/components/admin/ItemManagement';
import UnitsManagement from '@/components/admin/UnitsManagement';
import CustomerManagement from '@/components/admin/CustomerManagement';
import OrderManagement from '@/components/admin/OrderManagement';
import SystemSettings from '@/components/admin/SystemSettings';
import MachineManagement from '@/components/admin/MachineManagement';
import InventoryManagement from '@/components/admin/InventoryManagement';
import JumboRollInventory from '@/components/admin/JumboRollInventory';
import ConsumptionHistoryReport from '@/components/admin/ConsumptionHistoryReport';
import PurchaseManagement from '@/components/admin/PurchaseManagement';
import { CommissionAgentManagement } from '@/components/admin/CommissionAgentManagement';
import LabelConfiguration from '@/components/admin/LabelConfiguration';
import LabelCustomizationTool from '@/components/admin/LabelCustomizationTool';
import ProductionDetailReport from '@/components/admin/reports/ProductionDetailReport';
import ProductionSummaryReport from '@/components/admin/reports/ProductionSummaryReport';
import PerformanceReport from '@/components/admin/reports/PerformanceReport';

const AdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
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

      {/* Auth Status Banner */}
      <div className="bg-primary/5 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-medium">Logged in as</span>
                <span className="text-sm font-semibold text-primary">{profile?.full_name}</span>
                {profile?.employee_code && (
                  <span className="text-xs text-muted-foreground">({profile.employee_code})</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-2">Quick Access:</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveTab('users')}
                className="h-8"
              >
                <Users className="h-3 w-3 mr-1" />
                Manage Users
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveTab('orders')}
                className="h-8"
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                View Orders
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveTab('items')}
                className="h-8"
              >
                <Package className="h-3 w-3 mr-1" />
                Manage Items
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveTab('inventory')}
                className="h-8"
              >
                <Package className="h-3 w-3 mr-1" />
                View Inventory
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/traceability')}
                className="h-8"
              >
                <QrCode className="h-3 w-3 mr-1" />
                Traceability
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-12">
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
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="purchases">
              <FileText className="h-4 w-4 mr-2" />
              Purchases
            </TabsTrigger>
            <TabsTrigger value="commission-agents">
              <Banknote className="h-4 w-4 mr-2" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="units">
              <Ruler className="h-4 w-4 mr-2" />
              Units
            </TabsTrigger>
            <TabsTrigger value="machines">
              <Cpu className="h-4 w-4 mr-2" />
              Machines
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

          <TabsContent value="inventory" className="space-y-6">
            <JumboRollInventory />
            <ConsumptionHistoryReport />
            <InventoryManagement />
          </TabsContent>

          <TabsContent value="purchases" className="space-y-6">
            <PurchaseManagement />
          </TabsContent>

          <TabsContent value="commission-agents" className="space-y-6">
            <CommissionAgentManagement />
          </TabsContent>

          <TabsContent value="units" className="space-y-6">
            <UnitsManagement />
          </TabsContent>

          <TabsContent value="machines" className="space-y-6">
            <MachineManagement />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SystemSettings />
            <LabelCustomizationTool />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ProductionDetailReport />
            <ProductionSummaryReport />
            <PerformanceReport />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
