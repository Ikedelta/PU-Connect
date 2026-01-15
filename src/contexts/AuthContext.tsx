import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, type Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string, studentId: string, department: string, faculty: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, userObject?: User | null): Promise<Profile | null> => {
    // CRITICAL FIX: explicit check for system admin bypass ID
    if (userId === 'sys_admin_001') {
      return {
        id: 'sys_admin_001',
        email: 'system.admin@gmail.com',
        full_name: 'System Administrator',
        role: 'super_admin',
        student_id: 'SYS-001',
        department: 'IT',
        faculty: 'Systems',
        phone: '0000000000',
        avatar_url: '',
        is_active: true,
        is_online: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch error:', error.message);

        // Get user object if not provided
        let currentUser = userObject;
        if (!currentUser) {
          const { data: { user } } = await supabase.auth.getUser();
          currentUser = user;
        }

        if (error.code === 'PGRST116' && currentUser) {
          const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
            id: currentUser.id,
            email: currentUser.email || '',
            full_name: currentUser.user_metadata?.full_name || '',
            student_id: currentUser.user_metadata?.student_id || '',
            department: currentUser.user_metadata?.department || '',
            faculty: currentUser.user_metadata?.faculty || '',
            phone: currentUser.user_metadata?.phone || '',
            role: 'buyer',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select().single();

          if (!insertError && newProfile) {
            return newProfile as Profile;
          }
        }

        if (currentUser) {
          return {
            id: currentUser.id,
            email: currentUser.email || '',
            full_name: currentUser.user_metadata?.full_name || 'User',
            student_id: currentUser.user_metadata?.student_id || '',
            department: currentUser.user_metadata?.department || '',
            faculty: currentUser.user_metadata?.faculty || '',
            role: 'buyer',
            is_active: true,
            last_seen: new Date().toISOString(),
            is_online: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Profile;
        }

        return null;
      }

      return data as Profile;
    } catch (err) {
      console.error('Failed to fetch profile:', err);

      let currentUser = userObject;
      if (!currentUser) {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
      }

      if (currentUser) {
        return {
          id: currentUser.id,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || 'User',
          student_id: currentUser.user_metadata?.student_id || '',
          department: currentUser.user_metadata?.department || '',
          faculty: currentUser.user_metadata?.faculty || '',
          role: 'buyer',
          is_active: true,
          last_seen: new Date().toISOString(),
          is_online: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Profile;
      }

      return null;
    }
  }, []);

  const updateOnlineStatus = useCallback(async (userId: string, isOnline: boolean) => {
    try {
      await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId);
    } catch (err) {
      console.warn('Failed to update online status:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      setError(null);
      try {
        const profileData = await fetchProfile(user.id, user);
        setProfile(profileData);
      } catch (err) {
        console.error('Error refreshing profile:', err);
        setError('Failed to refresh profile');
      }
    }
  }, [user, fetchProfile]);

  const signOut = async () => {
    setError(null);
    try {
      localStorage.removeItem('pentvars_profile');
      localStorage.removeItem('sys_admin_bypass'); // Clear system bypass
      const { error } = await supabase.auth.signOut();
      // Even if supabase errors (e.g. no session), we want to clear local state
      if (error) console.warn('Supabase signout warning:', error);

      if (user) {
        import('../lib/logger').then(({ logActivity }) => {
          logActivity(user.id, 'logout', {});
        });
      }
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
      // Force clear anyway
      setUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 0. Check for System Admin Bypass
        const sysBypass = localStorage.getItem('sys_admin_bypass');
        if (sysBypass === 'true') {
          if (mounted) {
            const mockUser = {
              id: 'sys_admin_001',
              app_metadata: {},
              user_metadata: { full_name: 'System Administrator' },
              aud: 'authenticated',
              created_at: new Date().toISOString()
            } as any; /* casting to any to satisfy User type constraints safely */

            const mockProfile: Profile = {
              id: 'sys_admin_001',
              email: 'system.admin@gmail.com',
              full_name: 'System Administrator',
              role: 'super_admin',
              student_id: 'SYS-001',
              department: 'IT',
              faculty: 'Systems',
              phone: '0000000000',
              avatar_url: '', // Ensure property exists
              is_active: true,
              is_online: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            setUser(mockUser);
            setProfile(mockProfile);
            localStorage.setItem('pentvars_profile', JSON.stringify(mockProfile)); // Persist for Navbar
            setLoading(false);
            return; // Stop further auth checks
          }
        }

        // Optimistic check: Load from LocalStorage first to speed up UI
        const cachedProfile = localStorage.getItem('pentvars_profile');
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            setProfile(parsed);
          } catch (e) {
            localStorage.removeItem('pentvars_profile');
          }
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id, session.user);

          if (mounted) {
            setProfile(profileData);
            if (profileData) {
              localStorage.setItem('pentvars_profile', JSON.stringify(profileData));
            }
            updateOnlineStatus(session.user.id, true);
          }
        } else {
          localStorage.removeItem('pentvars_profile');
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) setError('Failed to initialize authentication');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // 1. Critical Priority: Check System Bypass First
      // If this is set, we ignore Supabase session entirely
      const sysBypass = localStorage.getItem('sys_admin_bypass');
      if (sysBypass === 'true') {
        // Force mock admin state
        const mockUser = {
          id: 'sys_admin_001',
          app_metadata: {},
          user_metadata: { full_name: 'System Administrator' },
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as any;

        const mockProfile: Profile = {
          id: 'sys_admin_001',
          email: 'system.admin@gmail.com',
          full_name: 'System Administrator',
          role: 'super_admin',
          student_id: 'SYS-001',
          department: 'IT',
          faculty: 'Systems',
          phone: '0000000000',
          avatar_url: '',
          is_active: true,
          is_online: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (mounted) {
          setUser(mockUser);
          setProfile(mockProfile);
          // Ensure it stays in storage
          localStorage.setItem('pentvars_profile', JSON.stringify(mockProfile));
          setLoading(false);
        }
        return; // STOP execution here. Do not let Supabase logic run.
      }

      if (!mounted) return;
      if (sysBypass === 'true') {
        // Ensure state is set for bypass user if not already (redundancy)
        if (!user || user.id !== 'sys_admin_001') {
          const mockUser = {
            id: 'sys_admin_001',
            app_metadata: {},
            user_metadata: { full_name: 'System Administrator' },
            aud: 'authenticated',
            created_at: new Date().toISOString()
          } as any;

          const mockProfile: Profile = {
            id: 'sys_admin_001',
            email: 'system.admin@gmail.com',
            full_name: 'System Administrator',
            role: 'super_admin',
            student_id: 'SYS-001',
            department: 'IT',
            faculty: 'Systems',
            phone: '0000000000',
            avatar_url: '',
            is_active: true,
            is_online: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setUser(mockUser);
          setProfile(mockProfile);
          localStorage.setItem('pentvars_profile', JSON.stringify(mockProfile));
        }
        return;
      }

      if (session?.user) {
        setUser(session.user);
        const profileData = await fetchProfile(session.user.id, session.user);
        if (mounted) {
          setProfile(profileData);
          if (profileData) {
            localStorage.setItem('pentvars_profile', JSON.stringify(profileData));
          }
          updateOnlineStatus(session.user.id, true);
        }
      } else {
        if (mounted) {
          setUser(null);
          setProfile(null);
          localStorage.removeItem('pentvars_profile');
        }
      }
    });


    // Update online status every 10 minutes (reduced from 5)
    const interval = setInterval(() => {
      if (user && mounted) {
        updateOnlineStatus(user.id, true);
      }
    }, 600000);

    const handleBeforeUnload = () => {
      if (user) {
        updateOnlineStatus(user.id, false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (user) {
        updateOnlineStatus(user.id, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProfile, updateOnlineStatus]);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        import('../lib/logger').then(({ logActivity }) => {
          logActivity(data.user.id, 'login', { method: 'password', email });
        });
      }
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      throw err;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    studentId: string,
    department: string,
    faculty: string,
    phone: string
  ) => {
    setError(null);
    try {
      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            student_id: studentId,
            department,
            faculty,
            phone,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Registration failed: No user returned');

      // 2. Create Profile (Client-side)
      // Only attempt if we have a session (user is logged in)
      // If email confirmation is enabled, session might be null. In that case, we rely on metadata
      // stored in auth.users and the fetchProfile self-healing or a database trigger.
      if (authData.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            student_id: studentId,
            department,
            faculty,
            phone,
            role: 'buyer', // Default role
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          // If profile already exists (e.g. created by trigger), ignore the error
          if (profileError.code === '23505') { // unique_violation
            console.log('Profile already exists, skipping creation.');
          } else {
            console.error('Profile creation failed:', profileError);
            // We don't throw here to avoid blocking the user if the auth account is valid.
            // The fetchProfile function has self-healing logic that might fix this later.
          }
        }
      } else {
        console.log('No session returned from signUp (email confirmation may be enabled). Profile creation deferred.');
      }

      // Send Welcome SMS (Non-blocking)
      import('../lib/arkesel').then(({ sendSMS }) => {
        sendSMS([phone], `Welcome to PU Connect, ${fullName}! Your account has been successfully created. Browse the marketplace and connect with fellow students.`)
          .catch(err => console.error('Failed to send welcome SMS:', err));
      });

      if (authData.session) {
        setUser(authData.user);
        await refreshProfile();
      } else {
        // If no session, try signing in manually (auto-login behavior)
        // This might fail if email confirmation is strictly enforced
        try {
          await signIn(email, password);
        } catch (loginError) {
          console.log('Auto-login failed (expected if email confirmation is on):', loginError);
          // Do not throw, just existing success flow (navigate to login or home)
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
      throw err;
    }
  };



  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
