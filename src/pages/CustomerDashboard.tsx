import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Package, FileText, LogOut, TrendingUp } from 'lucide-react';
import { PlaceOrder } from '@/components/customer/PlaceOrder';
import { MyOrders } from '@/components/customer/MyOrders';
import { OrderTracking } from '@/components/customer/OrderTracking';
import { Statements } from '@/components/customer/Statements';

const CustomerDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar border-b border-sidebar-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-sidebar-foreground">Customer Portal</h1>
                <p className="text-sm text-sidebar-foreground/70">
                  {profile?.full_name}
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
              <ShoppingCart className="h-6 w-6" />
              Welcome to Your Dashboard
            </CardTitle>
            <CardDescription>
              Place orders, track production, and manage your account
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="place-order" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="place-order" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              New Order
            </TabsTrigger>
            <TabsTrigger value="my-orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              My Orders
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Track Orders
            </TabsTrigger>
            <TabsTrigger value="statements" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Statements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="place-order" className="space-y-4">
            <PlaceOrder />
          </TabsContent>

          <TabsContent value="my-orders" className="space-y-4">
            <MyOrders />
          </TabsContent>

          <TabsContent value="tracking" className="space-y-4">
            <OrderTracking />
          </TabsContent>

          <TabsContent value="statements" className="space-y-4">
            <Statements />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CustomerDashboard;
