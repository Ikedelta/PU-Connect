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

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Optimistic check: Load from LocalStorage first to speed up UI
        const cachedProfile = localStorage.getItem('pentvars_profile');
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            setProfile(parsed);
            // If we have a cached profile, we can arguably turn off loading immediately
            // but we still need the session to confirm validity.
          } catch (e) {
            localStorage.removeItem('pentvars_profile');
          }
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          // Fetch fresh data in background/foreground
          const profileData = await fetchProfile(session.user.id, session.user);

          if (mounted) {
            setProfile(profileData);
            if (profileData) {
              localStorage.setItem('pentvars_profile', JSON.stringify(profileData));
            }
            updateOnlineStatus(session.user.id, true);
          }
        } else {
          // No session, clear cache
          localStorage.removeItem('pentvars_profile');
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setError('Failed to initialize authentication');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        // Pass session.user to fetchProfile to avoid extra network call
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

  const signOut = async () => {
    setError(null);
    try {
      localStorage.removeItem('pentvars_profile');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
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
