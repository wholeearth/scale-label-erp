import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TraceabilityLookup } from '@/components/traceability/TraceabilityLookup';

const TraceabilityPage = () => {
  const { profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const getBackRoute = () => {
    if (hasRole('admin')) return '/admin';
    if (hasRole('operator')) return '/operator';
    if (hasRole('production_manager')) return '/production-manager';
    if (hasRole('accountant')) return '/accountant';
    return '/';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(getBackRoute())}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Product Traceability</h1>
                  <p className="text-sm text-muted-foreground">Track production lineage from raw materials to finished goods</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {profile && (
                <span className="text-sm text-muted-foreground">
                  {profile.full_name}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <TraceabilityLookup />
      </main>
    </div>
  );
};

export default TraceabilityPage;
