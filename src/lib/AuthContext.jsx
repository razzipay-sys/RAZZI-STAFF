import React, { createContext, useState, useContext, useEffect } from 'react';
import supabase from './supabase';

const AuthContext = createContext();
const profileSyncInFlight = new Set();

const withTimeout = (promise, timeoutMs = 6000) => (
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile sync timed out')), timeoutMs);
    }),
  ])
);

async function syncStaffProfileForUser(user) {
  if (!user?.email || profileSyncInFlight.has(user.id)) return;
  profileSyncInFlight.add(user.id);

  try {
    await withTimeout((async () => {
      const { error: linkError } = await supabase.rpc(
        'link_or_create_staff_profile',
        { p_full_name: user.user_metadata?.full_name || null }
      );
      if (linkError) throw linkError;
    })());
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[AuthContext] Staff profile sync skipped:', error.message);
    }
  } finally {
    profileSyncInFlight.delete(user.id);
  }
}

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
      if (session?.user) {
        syncStaffProfileForUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setIsLoadingAuth(false);

      if (['SIGNED_IN', 'INITIAL_SESSION', 'USER_UPDATED'].includes(event) && session?.user) {
        syncStaffProfileForUser(session.user);
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
