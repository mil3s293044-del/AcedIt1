import React, { createContext, useState, useContext, useEffect } from 'react';
import { shouldUseSupabase } from '@/api/runtimeConfig';

// Base44 imports — only exercised when the dual-run toggle is OFF.
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

// Supabase imports
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

const makeUserShape = (u) => ({
  id: u.id,
  email: u.email,
  full_name:
    u.user_metadata?.full_name ||
    u.user_metadata?.name ||
    u.email?.split('@')[0] ||
    '',
  _raw: u,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const useSupabase = shouldUseSupabase();

  useEffect(() => {
    let unsub = null;

    if (useSupabase) {
      // ─── Supabase path ───────────────────────────────────────────────
      // No app-public-settings concept in Supabase — set a stub so the
      // existing isLoadingPublicSettings gate flips false immediately.
      setAppPublicSettings({});
      setIsLoadingPublicSettings(false);

      (async () => {
        // detectSessionInUrl on the client picks up the OAuth code from the
        // hash on the redirect-back, so getSession() returns the new session
        // on first paint after login.
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(makeUserShape(session.user));
          setIsAuthenticated(true);
        }
        setIsLoadingAuth(false);
      })();

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser(makeUserShape(session.user));
          setIsAuthenticated(true);
          setAuthError(null);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      });
      unsub = data?.subscription;
    } else {
      // ─── Base44 path (preserved for safe rollback) ────────────────────
      checkAppState();
    }

    return () => {
      unsub?.unsubscribe?.();
    };
  }, [useSupabase]);

  // ─── Base44 app-state check (legacy path) ───────────────────────────────
  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true,
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);

        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          } else if (reason === 'user_not_registered') {
            setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
          } else {
            setAuthError({ type: reason, message: appError.message });
          }
        } else {
          setAuthError({ type: 'unknown', message: appError.message || 'Failed to load app' });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);

      if (error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }
  };

  // ─── Logout / login (dispatch to whichever auth backend is active) ──────
  const logout = async (shouldRedirect = true) => {
    if (useSupabase) {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      if (shouldRedirect) window.location.href = '/';
      return;
    }
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) base44.auth.logout(window.location.href);
    else base44.auth.logout();
  };

  const navigateToLogin = async () => {
    if (useSupabase) {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // prompt=select_account forces Google to show its account picker
          // instead of silently re-auth-ing with the most-recently-used account.
          // Important after a sign-out so the user can switch / confirm.
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) {
        console.error('Supabase OAuth init failed:', error);
        setAuthError({ type: 'unknown', message: error.message });
      }
      return;
    }
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
