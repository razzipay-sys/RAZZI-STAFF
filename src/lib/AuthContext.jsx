import React, { createContext, useState, useContext, useEffect } from 'react';
import supabase from './supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setIsLoadingAuth(false);

      // Handle profile creation on login or sign up
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        try {
          const user = session.user;
          // Check if profile exists
          const { data: profiles, error: fetchError } = await supabase
            .from('staff_profiles')
            .select('id, staff_id')
            .eq('email', user.email);

          if (fetchError) throw fetchError;

          if (!profiles || profiles.length === 0) {
            // Get last staff_id to generate next one
            const { data: lastStaff } = await supabase
              .from('staff_profiles')
              .select('staff_id')
              .order('staff_id', { ascending: false })
              .limit(1);

            let nextNum = 1;
            if (lastStaff?.[0]?.staff_id?.startsWith('RP-')) {
              const lastNum = parseInt(lastStaff[0].staff_id.split('-')[1]);
              if (!isNaN(lastNum)) nextNum = lastNum + 1;
            }
            const newStaffId = `RP-${nextNum.toString().padStart(4, '0')}`;

            // Create basic profile
            await supabase.from('staff_profiles').insert({
              user_id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.email.split('@')[0],
              staff_id: newStaffId,
              role: user.user_metadata?.role || 'user',
              employment_status: 'Active'
            });
            console.log('Created new staff profile for:', user.email);
          } else {
            // Update user_id if missing
            const profile = profiles[0];
            if (!profile.user_id) {
              await supabase
                .from('staff_profiles')
                .update({ user_id: user.id })
                .eq('id', profile.id);
            }
          }
        } catch (e) {
          console.error('Error in onAuthStateChange profile handling:', e.message);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError({ type: 'auth_failed', message: error.message });
      setIsLoadingAuth(false);
      return { error };
    }
    setIsLoadingAuth(false);
    return { data };
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: metadata },
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
  };

  const resetPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null); setSession(null); setIsAuthenticated(false);
  };

  const navigateToLogin = () => { window.location.href = '/login'; };

  return (
    <AuthContext.Provider value={{
      user, session, isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
      authError, authChecked: !isLoadingAuth, appPublicSettings: null,
      signIn, signUp, signInWithGoogle, resetPassword, logout, navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
