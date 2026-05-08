// Phase 3 dual-run flag. Single source of truth so the dispatch shims
// (which can't read import.meta.env directly in some contexts) can ask
// "Supabase or Base44?" without each call site needing the env var.

export const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true';

// ─── Runtime override ───────────────────────────────────────────────────────
// Lets us flip per-tab via window.__forceSupabase(true) without restarting
// Vite. Persisted to localStorage so it survives page reloads — important
// for navigating the app in Supabase mode (every refresh would otherwise
// reset to whatever .env says).
//
// Usage:
//   window.__forceSupabase(true)   // → use Supabase, persist across reloads
//   window.__forceSupabase(false)  // → use Base44, persist across reloads
//   window.__forceSupabase(null)   // → clear override, fall back to .env
const STORAGE_KEY = '__acedit_force_supabase';

let runtimeOverride = null;
if (typeof window !== 'undefined') {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') runtimeOverride = true;
    else if (stored === 'false') runtimeOverride = false;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back to .env
  }
}

export function shouldUseSupabase() {
  return runtimeOverride ?? USE_SUPABASE;
}

if (typeof window !== 'undefined') {
  window.__forceSupabase = (v) => {
    if (v === null || v === undefined) {
      runtimeOverride = null;
      try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
      console.info(`[acedit] dual-run override CLEARED — using .env (${USE_SUPABASE ? 'Supabase' : 'Base44'})`);
    } else {
      runtimeOverride = !!v;
      try { window.localStorage.setItem(STORAGE_KEY, String(runtimeOverride)); } catch {}
      console.info(`[acedit] dual-run flag → ${runtimeOverride ? 'Supabase' : 'Base44'} (persists across reloads in this browser)`);
    }
  };
}
