import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, List } from 'lucide-react';
import CreatePurchaseInvoice from './CreatePurchaseInvoice';
import PurchaseInvoiceList from './PurchaseInvoiceList';

const PurchaseManagement = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Purchase Management</h2>
        <p className="text-muted-foreground">Create and manage purchase invoices</p>
      </div>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList>
          <TabsTrigger value="create">
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </TabsTrigger>
          <TabsTrigger value="list">
            <List className="h-4 w-4 mr-2" />
            Invoice List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <CreatePurchaseInvoice />
        </TabsContent>

        <TabsContent value="list">
          <PurchaseInvoiceList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PurchaseManagement;
