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
      } else if (profile.roles.includes('customer')) {
        console.log('Redirecting to /customer');
        navigate('/customer');
      } else if (profile.roles.includes('accountant')) {
        console.log('Redirecting to /accountant');
        navigate('/accountant');
      } else if (profile.roles.includes('commission_agent')) {
        console.log('Redirecting to /commission-agent');
        navigate('/commission-agent');
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
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elevated">
              <Factory className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4 text-foreground text-balance">
            Production ERP System
          </h1>
          <p className="text-lg text-muted-foreground text-balance">
            Real-time production tracking with CAS CN1 scale integration, automatic inventory management, and comprehensive business operations.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
          {[
            { icon: BarChart3, color: 'primary', title: 'Real-Time Tracking', desc: 'Live dashboards and automatic weight data from CAS CN1 scale.' },
            { icon: Package, color: 'success', title: 'Automated Labels', desc: 'Barcode labels with product details, weight, serial numbers, and timestamps.' },
            { icon: Users, color: 'warning', title: 'Role-Based Access', desc: 'Secure access for admins, operators, managers, sales, and customers.' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="bg-card rounded-xl p-6 shadow-card border border-border/60 hover:shadow-md transition-shadow">
              <div className={`h-11 w-11 rounded-lg bg-${color}/10 flex items-center justify-center mb-4`}>
                <Icon className={`h-5 w-5 text-${color}`} />
              </div>
              <h3 className="text-base font-semibold mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" className="shadow-elevated h-11 px-8" onClick={() => navigate('/auth')}>
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
