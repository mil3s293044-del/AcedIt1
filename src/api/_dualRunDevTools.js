// Phase 3 dev-only diagnostics. Loaded from main.jsx (dev mode only).
// Exposes window.__dualRun.* helpers so we can verify the dispatch shim from
// the browser console without writing throwaway test components.

import { shouldUseSupabase } from './runtimeConfig';

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__dualRun = {
    // Which client is currently active?
    status() {
      const using = shouldUseSupabase() ? 'Supabase' : 'Base44';
      console.info(`[dual-run] ACTIVE: ${using}`);
      return using;
    },

    // Read current Supabase auth session (no auto-redirect, just inspect).
    async whoami() {
      const { supabase } = await import('./supabaseClient.js');
      const { data: { user } } = await supabase.auth.getUser();
      console.info('[dual-run] supabase user:', user);
      return user;
    },

    // Hit a Supabase entity through the shim — proves end-to-end routing works.
    async testRead(entityName = 'UserProfile') {
      const all = await import('@/entities/all');
      const Entity = all[entityName];
      if (!Entity) throw new Error(`No entity named ${entityName} on shim`);
      const before = shouldUseSupabase();
      console.info(`[dual-run] reading ${entityName} via ${before ? 'Supabase' : 'Base44'}…`);
      const rows = await Entity.list('-created_date', 5);
      console.info(`[dual-run] got ${rows.length} rows`, rows);
      return rows;
    },

    // Trigger Google OAuth flow.
    async loginGoogle() {
      const { supabase } = await import('./supabaseClient.js');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    },

    // Sign out of Supabase.
    async logout() {
      const { supabase } = await import('./supabaseClient.js');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.info('[dual-run] signed out');
    },
  };
  console.info('[dual-run] dev tools ready: window.__dualRun.{status,whoami,testRead,loginGoogle,logout,__forceSupabase}');
}
