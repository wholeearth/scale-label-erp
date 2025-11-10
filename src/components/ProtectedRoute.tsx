import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  console.log('ProtectedRoute check:', { 
    user: !!user, 
    profile, 
    loading, 
    allowedRoles,
    hasProfile: !!profile,
    profileRoles: profile?.roles 
  });

  if (loading) {
    console.log('ProtectedRoute: Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && profile) {
    const hasAllowedRole = allowedRoles.some(role => profile.roles.includes(role));
    console.log('ProtectedRoute: Role check -', { 
      hasAllowedRole, 
      userRoles: profile.roles, 
      allowedRoles 
    });
    if (!hasAllowedRole) {
      console.log('ProtectedRoute: User does not have required role, redirecting to /');
      return <Navigate to="/" replace />;
    }
  }

  console.log('ProtectedRoute: Access granted');
  return <>{children}</>;
};
