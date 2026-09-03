import React, { createContext, useState, useContext, useEffect } from 'react';
import { shouldUseSupabase } from '@/api/runtimeConfig';

// Base44 imports — only exercised when the dual-run toggle is OFF.
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

// Supabase imports
import { supabase } from '@/api/supabaseClient';
import { getAttribution } from '@/lib/attribution';
import { trackSignup } from '@/lib/analytics';
import { colorFor } from '@/components/cards/cardIdentity';

// Native (Capacitor) OAuth deep-link helpers — no-ops on web.
import { isNative, nativeGoogleSignIn, initNativeAuthListener } from '@/lib/nativeAuth';

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
//
// 7 days because email-confirmation signups may not click the verify link
// straight away. The email-match guard below means we don't risk applying
// answers to the wrong user even with this longer window.
const ONBOARDING_STALENESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Module-level guard. The post-signup apply can be triggered from several
// places (getSession on first paint, plus SIGNED_IN / INITIAL_SESSION events)
// because Supabase doesn't reliably fire SIGNED_IN after a full-page OAuth
// redirect. We call it from all of them, but only the first call with real
// answers does the work — the rest bail here so subjects aren't inserted twice.
let onboardingApplyStarted = false;

async function applyOnboardingFromStorage(userEmail) {
  if (onboardingApplyStarted) return null;
  let answers = null;
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    answers = JSON.parse(raw);
  } catch { return null; }
  if (!answers?.completedAt) return null; // wizard not finished

  // We have real answers to apply — claim the run so concurrent callers bail.
  onboardingApplyStarted = true;

  // Staleness guard — if completedAt is too old, the localStorage probably
  // belongs to an abandoned session. Clear and bail.
  const ageMs = Date.now() - new Date(answers.completedAt).getTime();
  if (Number.isFinite(ageMs) && ageMs > ONBOARDING_STALENESS_MS) {
    try { localStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch {}
    return null;
  }

  // Email-match guard. The Step 8 email+password path stores the typed email
  // in the payload — if the user who just signed in doesn't match, this is
  // somebody else's wizard state (shared browser, abandoned session, etc.).
  // OAuth signups don't write `answers.email`, so they bypass this check.
  if (answers.email && answers.email.toLowerCase() !== (userEmail || '').toLowerCase()) {
    return null;
  }

  // Wait for the handle_new_auth_user trigger to create the profile row.
  // Brand-new signups can lag a little, so poll up to ~6s before giving up.
  let profile = null;
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, onboarding_tasks')
      .eq('created_by', userEmail)
      .maybeSingle();
    if (data) { profile = data; break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!profile) {
    console.warn('[onboarding] no user_profile row yet — will retry on next load');
    // Release the guard so a later auth signal (or a reload, where localStorage
    // still holds the answers) can try again instead of being blocked forever.
    onboardingApplyStarted = false;
    return null;
  }

  // Build updates from wizard answers.
  const updates = {};
  if (answers.goalAtar)        updates.goal_atar          = answers.goalAtar;
  if (answers.goalCourseName)  updates.goal_course_name   = answers.goalCourseName;
  if (answers.goalUniversity)  updates.goal_university    = answers.goalUniversity;

  // `username_set` used to be written only by the Settings page, so a student
  // who came through this wizard — with a name already on the account from
  // signup — was nagged on the dashboard forever to go and set one. The
  // dashboard now derives all three from the profile rather than trusting these
  // flags, but recording the truth here keeps the two in agreement.
  const hasName = !!(profile.username || profile.display_name || profile.full_name || answers.displayName);
  const onboardingTasks = {
    ...(profile.onboarding_tasks || {}),
    username_set: !!(profile.onboarding_tasks?.username_set || hasName),
    subjects_selected: (answers.subjects?.length ?? 0) > 0,
    goals_set: !!(answers.goalAtar || answers.goalCourseName),
  };
  updates.onboarding_tasks = onboardingTasks;

  // Store year level + first-touch marketing attribution inside `extra` jsonb
  // so we know which campaign pillar drove this signup (no migration needed).
  const attribution = getAttribution();
  const hasAttribution = !!attribution.pillar || Object.keys(attribution.utm || {}).length > 0;
  if (answers.yearLevel || hasAttribution) {
    updates.extra = {
      ...(answers.yearLevel ? { year_level: answers.yearLevel } : {}),
      ...(hasAttribution
        ? { attribution: { pillar: attribution.pillar, utm: attribution.utm, landing_path: attribution.landing_path } }
        : {}),
    };
  }

  try {
    await supabase.from('user_profiles').update(updates).eq('id', profile.id);
  } catch (e) {
    console.error('[onboarding] profile update failed:', e);
  }

  // Reaching here means a brand-new profile was found and onboarding applied —
  // i.e. a genuine new signup. Fire the conversion to the marketing pixels.
  try { trackSignup({ pillar: attribution.pillar || undefined }); } catch (_) {}

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
        // Nothing wrote this before, so every reader fell back to the same
        // blue and a student with five subjects had five identical decks.
        // Derived from the name, so it matches the colour they were already
        // shown on their card during onboarding, and matches on any device.
        color:          colorFor(s.name),
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

// ─── Onboarding wizard, retaken by an existing user ──────────────────────
// Same wizard, reached deliberately from Settings by someone who already has
// an account (see the "Study setup" section) rather than by a brand-new
// signup. Unlike applyOnboardingFromStorage above, this:
//   - updates a profile that already exists, instead of waiting for the
//     signup trigger to create one
//   - merges into `extra` rather than overwriting it — an existing user can
//     already have daily_intent / intent_log / attribution sitting in there
//   - reconciles user_subjects against what's currently saved (add what's
//     new, remove what was dropped) instead of only ever inserting, which
//     would duplicate every subject the wizard was pre-filled with
//   - never fires the signup conversion pixel
export async function applyOnboardingUpdateForCurrentUser(userEmail, answers) {
  const { data: profile, error: profileFetchErr } = await supabase
    .from('user_profiles')
    .select('id, extra, onboarding_tasks')
    .eq('created_by', userEmail)
    .maybeSingle();
  if (profileFetchErr || !profile) {
    return { ok: false, error: profileFetchErr?.message || 'No profile found for this account.' };
  }

  const updates = {};
  if (answers.goalAtar)       updates.goal_atar        = answers.goalAtar;
  if (answers.goalCourseName) updates.goal_course_name = answers.goalCourseName;
  if (answers.goalUniversity) updates.goal_university  = answers.goalUniversity;

  updates.onboarding_tasks = {
    ...(profile.onboarding_tasks || {}),
    subjects_selected: (answers.subjects?.length ?? 0) > 0 || !!profile.onboarding_tasks?.subjects_selected,
    goals_set: !!(answers.goalAtar || answers.goalCourseName) || !!profile.onboarding_tasks?.goals_set,
  };

  updates.extra = {
    ...(profile.extra || {}),
    ...(answers.yearLevel ? { year_level: answers.yearLevel } : {}),
  };

  const { error: updateErr } = await supabase.from('user_profiles').update(updates).eq('id', profile.id);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Reconcile user_subjects against the wizard's final list, matched by
  // subject_code — the same key Step2Subjects itself de-dupes on.
  const { data: existingRows } = await supabase
    .from('user_subjects')
    .select('id, subject_code')
    .eq('created_by', userEmail);
  const existing = existingRows || [];
  const wanted = Array.isArray(answers.subjects) ? answers.subjects : [];

  const wantedCodes = new Set(wanted.map((s) => s.code));
  const toRemove = existing.filter((row) => !wantedCodes.has(row.subject_code));
  const existingCodes = new Set(existing.map((row) => row.subject_code));
  const toAdd = wanted.filter((s) => !existingCodes.has(s.code));

  if (toRemove.length > 0) {
    try {
      await supabase.from('user_subjects').delete().in('id', toRemove.map((r) => r.id));
    } catch (e) {
      console.error('[onboarding:redo] user_subjects delete failed:', e);
    }
  }

  if (toAdd.length > 0) {
    const rows = [];
    for (const s of toAdd) {
      let vceSubjectId = s.is_custom ? null : (s.id || null);
      if (s.is_custom) {
        try {
          const { data: created, error: createErr } = await supabase
            .from('vce_subjects')
            .insert({ name: s.name, code: s.code, overview: s.name, is_private: true, created_by: userEmail })
            .select('id')
            .single();
          if (createErr) console.error('[onboarding:redo] custom vce_subjects insert failed:', createErr);
          else vceSubjectId = created?.id || null;
        } catch (e) {
          console.error('[onboarding:redo] custom subject create error:', e);
        }
      }
      rows.push({
        created_by: userEmail,
        subject_name: s.name,
        subject_code: s.code,
        vce_subject_id: vceSubjectId,
        year_level: answers.yearLevel || null,
        is_active: true,
        color: colorFor(s.name),
      });
    }
    try {
      await supabase.from('user_subjects').insert(rows);
    } catch (e) {
      console.error('[onboarding:redo] user_subjects insert failed:', e);
    }
  }

  return { ok: true };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  // Set to true when Supabase fires PASSWORD_RECOVERY (i.e. the user clicked
  // the reset-password link in their email and supabase-js exchanged the
  // recovery token in the URL for a session). /reset-password reads this as
  // the ONLY trusted signal that the visitor is in a real recovery flow —
  // checking supabase.auth.getSession() directly can return a stale prior
  // session before the token exchange completes.
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);

  const useSupabase = shouldUseSupabase();

  // Native only: listen for the OAuth deep-link callback and exchange the code
  // for a session. No-op on web. onAuthStateChange (below) handles the rest.
  useEffect(() => {
    const teardown = initNativeAuthListener();
    return teardown;
  }, []);

  useEffect(() => {
    let unsub = null;

    if (useSupabase) {
      // ─── Supabase path ───────────────────────────────────────────────
      // No app-public-settings concept in Supabase — set a stub so the
      // existing isLoadingPublicSettings gate flips false immediately.
      setAppPublicSettings({});
      setIsLoadingPublicSettings(false);

      // Apply onboarding answers (if any) then route premium-intent users to
      // the subscription page. Safe to call from multiple auth signals — the
      // module guard inside applyOnboardingFromStorage ensures it runs once.
      const runPostSignup = async (email) => {
        try {
          const intent = await applyOnboardingFromStorage(email);
          if (intent === 'premium' && window.location.pathname !== '/Subscription') {
            window.location.assign('/Subscription');
          }
        } catch (e) {
          console.error('[onboarding] post-signup apply failed:', e);
        }
      };

      (async () => {
        // detectSessionInUrl on the client picks up the OAuth code from the
        // URL on the redirect-back, so getSession() returns the new session
        // on first paint after login.
        const oauthInUrl = typeof window !== 'undefined' &&
          (window.location.search.includes('code=') || window.location.hash.includes('access_token'));

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(makeUserShape(session.user));
          setIsAuthenticated(true);
          runPostSignup(session.user.email);
          setIsLoadingAuth(false);
        } else if (oauthInUrl) {
          // OAuth redirect is still being exchanged — keep the loading spinner
          // up so the public Landing page doesn't flash for a frame. The
          // onAuthStateChange handler below finishes once the session lands.
          // Fallback timeout so we never hang if the exchange fails.
          setTimeout(() => setIsLoadingAuth(false), 5000);
        } else {
          setIsLoadingAuth(false);
        }
      })();

      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Temp diagnostic — remove once /reset-password is verified end-to-end.
        // Helps prove PASSWORD_RECOVERY actually fires (and when) on a real
        // reset-link click.
        console.log('[auth] event =', event, 'user =', session?.user?.email || '(none)');

        // PASSWORD_RECOVERY: user clicked the reset link in their email and
        // Supabase exchanged the recovery token for a session. Mark recovery
        // mode and DO NOT run the normal SIGNED_IN side effects (onboarding
        // apply, premium redirect) — recovery is a special flow that ends
        // when the user submits a new password.
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryInProgress(true);
          if (session?.user) {
            setUser(makeUserShape(session.user));
            setIsAuthenticated(true);
            setAuthError(null);
          }
          return;
        }

        if (session?.user) {
          setUser(makeUserShape(session.user));
          setIsAuthenticated(true);
          setAuthError(null);
          setIsLoadingAuth(false);

          // Apply unapplied onboarding answers. We listen for SIGNED_IN *and*
          // INITIAL_SESSION because a full-page OAuth redirect doesn't reliably
          // fire SIGNED_IN — it can arrive as INITIAL_SESSION, which previously
          // meant a brand-new user's subjects were never saved. The module
          // guard makes this idempotent vs the getSession call above.
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !recoveryInProgress) {
            runPostSignup(session.user.email);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
          // Signing out also clears recovery mode — recovery sessions end
          // when the password reset completes and we sign out.
          setRecoveryInProgress(false);
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
      // Native app: OAuth can't full-page-redirect to capacitor://localhost.
      // Open Google in the system browser and catch the deep-link callback.
      if (isNative()) {
        try {
          await nativeGoogleSignIn();
        } catch (error) {
          console.error('Native OAuth init failed:', error);
          setAuthError({ type: 'unknown', message: error.message });
        }
        return;
      }
      // Always return to the app root after OAuth, never the current path.
      // Logging in from /login or /onboarding used to redirect back to that
      // same path — but those have no authenticated route, so the user hit a
      // 404 ("login page does not exist"). Root resolves to the app for
      // authenticated users.
      const redirectTo = `${window.location.origin}/`;
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

  // ─── Email + password helpers (Supabase-only) ───────────────────────────
  // These power the /login, /onboarding (sign-in step, email path), /forgot-password
  // and /reset-password pages. They never touch the Base44 fallback path.

  /**
   * Sign up, with the verification email sent by US.
   *
   * ─── Why not just supabase.auth.signUp ──────────────────────────────────
   * Because that asks Supabase to send the confirmation over its built-in
   * SMTP, which is capped at three emails an hour for the whole project and
   * drops mail. Students were hitting the cap on a normal Tuesday. The server
   * creates the account and generates the same confirmation link WITHOUT
   * sending anything, then delivers it through Resend — see
   * /local-ai/fn/sendSignupEmail.
   *
   * ─── It falls back rather than failing ──────────────────────────────────
   * If the server has no Resend key it creates nothing and says so, and we go
   * back to the Supabase path. Slow mail beats no signup, and the one outcome
   * neither path may produce is an account whose verification email was never
   * sent — nobody can get into that, and nobody can re-register it either.
   */
  const signUpWithPassword = async ({ email, password, fullName }) => {
    const redirectTo = `${window.location.origin}/`;

    try {
      const r = await fetch('/local-ai/fn/sendSignupEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, redirect_to: redirectTo }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.ok) return { ok: true, session: null, user: null, viaResend: true };
      // A real, reportable answer — the email is taken, or they have tried too
      // many times. Not something to paper over by trying the other path.
      if (r.status === 409 || r.status === 429 || j?.created) {
        return { ok: false, error: { message: j?.error || 'Sign-up failed.' } };
      }
      if (!j?.fallback) {
        // A 400 from our own validation is still a real answer.
        if (r.status === 400 && j?.error) return { ok: false, error: { message: j.error } };
      }
    } catch {
      // Server unreachable — fall through to Supabase rather than stranding
      // somebody on a dead form.
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    if (error) return { ok: false, error };
    // With "Confirm email" ON, `data.session` is null and the user receives
    // a verification email. The caller should show a "check your inbox" UI.
    // With it off, `data.session` is populated and onAuthStateChange handles
    // the SIGNED_IN apply path.
    return { ok: true, session: data?.session ?? null, user: data?.user ?? null };
  };

  const signInWithPassword = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error };
    return { ok: true, session: data?.session ?? null, user: data?.user ?? null };
  };

  const requestPasswordReset = async (email) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { ok: false, error };
    return { ok: true };
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
      signUpWithPassword,
      signInWithPassword,
      requestPasswordReset,
      recoveryInProgress,
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
