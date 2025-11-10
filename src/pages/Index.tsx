import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Factory, Users, BarChart3, Package } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Index - Auth state:', { user: !!user, profile, loading, roles: profile?.roles });
    
    if (!loading && user && profile) {
      // Redirect based on role
      console.log('Redirecting based on roles:', profile.roles);
      if (profile.roles.includes('admin')) {
        console.log('Redirecting to /admin');
        navigate('/admin');
      } else if (profile.roles.includes('operator')) {
        console.log('Redirecting to /operator');
        navigate('/operator');
      } else if (profile.roles.includes('production_manager')) {
        console.log('Redirecting to /production-manager');
        navigate('/production-manager');
      }
    } else if (!loading && !user) {
      console.log('No user, staying on landing page');
    }
  }, [user, profile, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-accent">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-lg">
              <Factory className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 text-foreground">Production ERP System</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real-time production tracking with CAS CN1 scale integration, automatic inventory management, and comprehensive business operations
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-card rounded-lg p-6 shadow-md border border-border">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Real-Time Tracking</h3>
            </div>
            <p className="text-muted-foreground">
              Monitor production in real-time with live dashboards and automatic weight data collection from CAS CN1 scale
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-md border border-border">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mr-4">
                <Package className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold">Automated Labels</h3>
            </div>
            <p className="text-muted-foreground">
              Generate barcode labels automatically with product details, weight, serial numbers, and timestamps
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-md border border-border">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mr-4">
                <Users className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-lg font-semibold">Role-Based Access</h3>
            </div>
            <p className="text-muted-foreground">
              Secure access control for admins, operators, production managers, sales team, and customers
            </p>
          </div>
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            className="shadow-lg"
            onClick={() => navigate('/auth')}
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
