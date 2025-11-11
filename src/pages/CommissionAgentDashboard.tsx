import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Users, FileText, Receipt, DollarSign, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AgentInvoicesList } from '@/components/commission-agent/AgentInvoicesList';
import { AgentStatement } from '@/components/commission-agent/AgentStatement';
import { AgentCustomers } from '@/components/commission-agent/AgentCustomers';
import { AgentReceiptCollection } from '@/components/commission-agent/AgentReceiptCollection';
import { AgentReports } from '@/components/commission-agent/AgentReports';

export default function CommissionAgentDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('invoices');

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Commission Agent Dashboard</h1>
              <p className="text-sm opacity-90 mt-1">Welcome, {profile?.full_name}</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="secondary"
              size="lg"
              className="gap-2"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              My Customers
            </TabsTrigger>
            <TabsTrigger value="receipts" className="gap-2">
              <Receipt className="h-4 w-4" />
              Collect Receipt
            </TabsTrigger>
            <TabsTrigger value="statement" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Statement
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <AgentInvoicesList />
          </TabsContent>

          <TabsContent value="customers">
            <AgentCustomers />
          </TabsContent>

          <TabsContent value="receipts">
            <AgentReceiptCollection />
          </TabsContent>

          <TabsContent value="statement">
            <AgentStatement />
          </TabsContent>

          <TabsContent value="reports">
            <AgentReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
