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

// ─── Onboarding wizard post-signup hook ──────────────────────────────────
// When a brand-new user finishes Google OAuth, pull the answers they gave
// in /onboarding (stored in localStorage before the redirect) and apply
// them to their fresh user_profile + create matching user_subjects rows.
// Then redirect Premium-intent users to /Subscription, Free-intent users
// stay where they are (Dashboard).
const ONBOARDING_STORAGE_KEY = 'acedit_onboarding_v1';

// How long onboarding answers are considered fresh after completion. Beyond
// this, treat the localStorage as stale (probably belongs to a different
// user who never finished OAuth) and clear it without applying.
const ONBOARDING_STALENESS_MS = 30 * 60 * 1000; // 30 minutes

async function applyOnboardingFromStorage(userEmail) {
  let answers = null;
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    answers = JSON.parse(raw);
  } catch { return null; }
  if (!answers?.completedAt) return null; // wizard not finished

  // Staleness guard — if completedAt is older than 30 min, the localStorage
  // probably belongs to a different visitor who never finished OAuth.
  // Clear and bail rather than inheriting someone else's data.
  const ageMs = Date.now() - new Date(answers.completedAt).getTime();
  if (Number.isFinite(ageMs) && ageMs > ONBOARDING_STALENESS_MS) {
    try { localStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch {}
    return null;
  }

  // Wait for the handle_new_auth_user trigger to create the profile row.
  // Up to ~1.5s of polling — usually completes in <200ms.
  let profile = null;
  for (let i = 0; i < 8; i++) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, onboarding_tasks')
      .eq('created_by', userEmail)
      .maybeSingle();
    if (data) { profile = data; break; }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!profile) {
    console.warn('[onboarding] no user_profile row yet — skipping apply');
    return null;
  }

  // Build updates from wizard answers.
  const updates = {};
  if (answers.goalAtar)        updates.goal_atar          = answers.goalAtar;
  if (answers.goalCourseName)  updates.goal_course_name   = answers.goalCourseName;
  if (answers.goalUniversity)  updates.goal_university    = answers.goalUniversity;

  const onboardingTasks = {
    ...(profile.onboarding_tasks || {}),
    subjects_selected: (answers.subjects?.length ?? 0) > 0,
    goals_set: !!(answers.goalAtar || answers.goalCourseName),
  };
  updates.onboarding_tasks = onboardingTasks;

  // Store year level inside `extra` jsonb so we don't need a migration.
  if (answers.yearLevel) {
    updates.extra = { year_level: answers.yearLevel };
  }

  try {
    await supabase.from('user_profiles').update(updates).eq('id', profile.id);
  } catch (e) {
    console.error('[onboarding] profile update failed:', e);
  }

  // Create user_subjects rows. For custom subjects (is_custom: true) we first
  // create a private vce_subjects row, then point user_subjects at it via
  // vce_subject_id. Canonical VCE subjects don't need a vce_subjects row
  // because the catalog is hardcoded in src/data/vceSubjects.js.
  if (Array.isArray(answers.subjects) && answers.subjects.length > 0) {
    const userSubjectRows = [];

    for (const s of answers.subjects) {
      let vceSubjectId = null;

      if (s.is_custom) {
        try {
          const { data: created, error: createErr } = await supabase
            .from('vce_subjects')
            .insert({
              name:       s.name,
              code:       s.code,
              overview:   s.name,
              is_private: true,
              created_by: userEmail,
            })
            .select('id')
            .single();
          if (createErr) {
            console.error('[onboarding] custom vce_subjects insert failed:', createErr);
          } else {
            vceSubjectId = created?.id || null;
          }
        } catch (e) {
          console.error('[onboarding] custom subject create error:', e);
        }
      } else {
        vceSubjectId = s.id || null;
      }

      userSubjectRows.push({
        created_by:     userEmail,
        subject_name:   s.name,
        subject_code:   s.code,
        vce_subject_id: vceSubjectId,
        year_level:     answers.yearLevel || null,
        is_active:      true,
      });
    }

    if (userSubjectRows.length > 0) {
      try {
        await supabase.from('user_subjects').insert(userSubjectRows);
      } catch (e) {
        console.error('[onboarding] user_subjects insert failed:', e);
      }
    }
  }

  // Clear the wizard state — it's been applied.
  try { localStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch {}

  return answers.intent || null;
}

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

      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(makeUserShape(session.user));
          setIsAuthenticated(true);
          setAuthError(null);

          // On a SIGNED_IN event (initial OAuth landing or fresh login),
          // check if there are unapplied onboarding answers and apply them.
          if (event === 'SIGNED_IN') {
            try {
              const intent = await applyOnboardingFromStorage(session.user.email);
              // Premium-intent users land on Subscription page (hard sell).
              // Free-intent users stay where they are (typically Dashboard).
              if (intent === 'premium' && window.location.pathname !== '/Subscription') {
                window.location.assign('/Subscription');
              }
            } catch (e) {
              console.error('[onboarding] post-signup apply failed:', e);
            }
          }
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
