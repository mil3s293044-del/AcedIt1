// ════════════════════════════════════════════════════════════════════════════
// Native (Capacitor) auth — Google OAuth deep-link flow.
//
// On the web, Supabase OAuth does a full-page redirect back to acedit.au and
// detectSessionInUrl picks up the ?code=. That can't work in a native shell:
// the app loads from capacitor://localhost, which Google can't redirect to.
//
// Native flow instead:
//   1. signInWithOAuth({ skipBrowserRedirect: true, redirectTo: <deep link> })
//      → returns the Google consent URL without navigating.
//   2. Open that URL in the system browser (@capacitor/browser).
//   3. Google → Supabase → redirects to au.acedit.app://login-callback?code=…
//   4. The OS hands that deep link to the app (@capacitor/app appUrlOpen).
//   5. exchangeCodeForSession(code) completes login; onAuthStateChange in
//      AuthContext then runs the normal post-sign-in side effects.
//
// REQUIRED Supabase dashboard step (one-time): add the redirect URL
//   au.acedit.app://login-callback
// to Authentication → URL Configuration → Redirect URLs. Without it Supabase
// rejects the redirect and login fails.
// ════════════════════════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/api/supabaseClient';

export const isNative = () => Capacitor.isNativePlatform();

// Custom-scheme deep link the OAuth flow redirects back to. The scheme is the
// app id (au.acedit.app), registered in iOS Info.plist + Android manifest.
export const NATIVE_AUTH_REDIRECT = 'au.acedit.app://login-callback';

// Kick off Google sign-in inside the native app.
export async function nativeGoogleSignIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_AUTH_REDIRECT,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (data?.url) {
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  }
}

function extractCode(url) {
  const m = /[?&]code=([^&]+)/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : null;
}

// Register the deep-link listener once at app start. Returns an unsubscribe fn.
// No-op on web.
export function initNativeAuthListener() {
  if (!isNative()) return () => {};

  const handlePromise = App.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.includes('login-callback')) return;
    const code = extractCode(url);
    try {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
    } catch (e) {
      console.error('[nativeAuth] code exchange failed:', e);
    } finally {
      // Close the system browser so the user lands back in the app.
      try { await Browser.close(); } catch { /* already closed */ }
    }
  });

  return () => {
    handlePromise.then((h) => h.remove()).catch(() => {});
  };
}
