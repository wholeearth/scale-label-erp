import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export type UserRole = 'admin' | 'operator' | 'production_manager' | 'sales' | 'customer' | 'accountant' | 'commission_agent';

interface UserProfile {
  id: string;
  full_name: string;
  employee_code: string | null;
  roles: UserRole[];
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'User ID:', session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile and roles
          setTimeout(async () => {
            try {
              console.log('Fetching profile for user:', session.user.id);
              let { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              if (profileError) {
                console.error('Profile error:', profileError);
                // continue; we'll try to ensure profile
              }

              // Profile will be created by admin via create-user function
              // Fallback to user_metadata if no profile exists
              console.log('Profile data:', profileData);

              const { data: rolesData, error: rolesError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id);

              if (rolesError) {
                console.error('Roles error:', rolesError);
                throw rolesError;
              }
              console.log('Roles data:', rolesData);

              const fallbackName = (session.user.user_metadata as any)?.full_name || session.user.email || 'User';
              const fallbackCode = (session.user.user_metadata as any)?.employee_code || null;

              setProfile({
                id: session.user.id,
                full_name: profileData?.full_name ?? fallbackName,
                employee_code: profileData?.employee_code ?? fallbackCode,
                roles: (rolesData || []).map(r => r.role as UserRole)
              });
              console.log('Profile set with roles:', (rolesData || []).map(r => r.role));
            } catch (error) {
              console.error('Error fetching profile:', error);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, employeeCode?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          employee_code: employeeCode
        }
      }
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigate('/auth');
    }
    return { error };
  };

  const hasRole = (role: UserRole): boolean => {
    return profile?.roles.includes(role) ?? false;
  };

  return {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    hasRole,
  };
};
