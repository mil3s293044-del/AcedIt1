// ════════════════════════════════════════════════════════════════════════════
// Phase 3b-3 — Dual-run dispatcher wrapping the Base44 SDK.
//
// `base44` looks identical to the original Base44 client (entities, auth,
// functions, asServiceRole, integrations) but every property access is routed
// through a Proxy that consults the dual-run flag (runtimeConfig.shouldUseSupabase).
//
// Why this matters: 95+ files import { base44 } from '@/api/base44Client'
// and call base44.entities.X.method(...) directly. Without this wrapper they
// would always hit Base44, even when the dual-run flag is on. With it, those
// calls route to Supabase when the flag is set — no per-file refactor needed.
//
// Surface mapping:
//   .entities.X.method()    → flag-on: supabase44.entities.X.method()
//                              flag-off: realBase44.entities.X.method()
//   .auth.method()          → flag-on: supabase44.auth.method()
//                              flag-off: realBase44.auth.method()
//   .functions.invoke(name) → flag-on + ported: supabase44.functions.invoke()
//                              everything else: realBase44.functions.invoke()
//                              (smart fallback — see PORTED_FUNCTIONS in supabaseClient.js)
//   .asServiceRole.X.Y()    → flag-on: throws (privileged ops belong server-side)
//                              flag-off: realBase44.asServiceRole.X.Y()
//   .integrations.X         → always realBase44 (intercepted at Vite middleware
//                              layer — see vite.config.js → interceptBase44AI)
//
// `realBase44` is exported for the rare case server-side helper code needs
// to bypass the wrapper (e.g. supabaseClient.js's function fallback).
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { shouldUseSupabase } from './runtimeConfig.js';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// The "real" Base44 client. Exported for fallback paths only — most code
// should keep importing { base44 } and let dispatch happen automatically.
export const realBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

// Lazy-import the Supabase client to avoid an unconditional cost in the bundle
// when the flag is off. Cached after first access.
let _supabase44 = null;
async function getSupabase44() {
  if (!_supabase44) _supabase44 = (await import('./supabaseClient.js')).supabase44;
  return _supabase44;
}

// ─── entities proxy ────────────────────────────────────────────────────────
// base44.entities.<EntityName>.<method>(...args)
// Each method is async and dispatches at call time so the flag can be flipped
// per-tab via window.__forceSupabase(true) without rebuilding anything.
const entitiesProxy = new Proxy({}, {
  get(_, entityName) {
    if (typeof entityName !== 'string') return undefined;
    return new Proxy({}, {
      get(__, methodName) {
        if (typeof methodName !== 'string') return undefined;

        // ─── subscribe is SYNC ──────────────────────────────────────────────
        // Base44 returns the unsubscribe function synchronously. Call sites
        // do `const unsub = Entity.subscribe(cb); ... unsub();` without await.
        // If we wrap in async, `unsub` becomes a Promise → "unsub is not a
        // function" crash. So special-case it.
        if (methodName === 'subscribe') {
          return (...args) => {
            if (shouldUseSupabase()) {
              // Realtime not wired yet — no-op unsubscribe so components don't crash.
              return () => {};
            }
            return realBase44.entities[entityName].subscribe(...args);
          };
        }

        // ─── all other methods: async network calls ─────────────────────────
        return async (...args) => {
          if (shouldUseSupabase()) {
            const sb = await getSupabase44();
            const fn = sb.entities?.[entityName]?.[methodName];
            if (typeof fn !== 'function') {
              throw new Error(
                `[base44] Entity '${entityName}' has no method '${methodName}' on Supabase client. ` +
                `Add it to TABLES in supabaseClient.js or define the method.`
              );
            }
            return fn(...args);
          }
          return realBase44.entities[entityName][methodName](...args);
        };
      },
    });
  },
});

// ─── auth proxy ────────────────────────────────────────────────────────────
const authProxy = new Proxy({}, {
  get(_, methodName) {
    if (typeof methodName !== 'string') return undefined;
    return async (...args) => {
      if (shouldUseSupabase()) {
        const sb = await getSupabase44();
        const fn = sb.auth?.[methodName];
        if (typeof fn !== 'function') {
          throw new Error(`[base44] auth.${methodName} not implemented on Supabase client.`);
        }
        return fn(...args);
      }
      return realBase44.auth[methodName](...args);
    };
  },
});

// ─── functions proxy ───────────────────────────────────────────────────────
// supabaseClient.js's functions.invoke handles the smart Base44 fallback for
// not-yet-ported functions, so we can route everything through it when the
// flag is on. When the flag is off we go straight to Base44.
const functionsProxy = new Proxy({}, {
  get(_, prop) {
    if (typeof prop !== 'string') return undefined;
    // Standard call: base44.functions.invoke('fnName', payload)
    if (prop === 'invoke') {
      return async (name, ...args) => {
        if (shouldUseSupabase()) {
          const sb = await getSupabase44();
          return sb.functions.invoke(name, ...args);
        }
        return realBase44.functions.invoke(name, ...args);
      };
    }
    // Some legacy code does base44.functions.fnName(payload) directly
    return async (...args) => {
      if (shouldUseSupabase()) {
        const sb = await getSupabase44();
        return sb.functions.invoke(prop, ...args);
      }
      return realBase44.functions.invoke(prop, ...args);
    };
  },
});

// ─── asServiceRole proxy ───────────────────────────────────────────────────
// In Supabase mode, refuse to hand out a service-role client — the service
// role key never leaves the server, so any client-side asServiceRole call is
// a bug. In Base44 mode, pass through to realBase44 (legacy behavior).
const asServiceRoleProxy = new Proxy({}, {
  get(_, topProp) {
    if (shouldUseSupabase()) {
      // Return a deeply-nested proxy that throws on any final call — this
      // matches the call shape `base44.asServiceRole.entities.X.method()`.
      return new Proxy({}, {
        get: () => new Proxy({}, {
          get: () => () => {
            throw new Error(
              '[base44] asServiceRole.* is not available in Supabase mode. ' +
              'Privileged operations must move to a server endpoint that uses the service_role key.'
            );
          },
        }),
      });
    }
    return realBase44.asServiceRole[topProp];
  },
});

// ─── integrations proxy ────────────────────────────────────────────────────
// We override `integrations.Core.InvokeLLM` so it goes through our authenticated
// AI client (src/lib/aiClient.js) which auto-attaches the Supabase JWT and the
// `feature` tag for tier-limit enforcement on the server.
//
// All other integrations (UploadFile, etc.) pass through unchanged — the Vite
// middleware (vite.config.js → interceptBase44AI) handles routing those.
const integrationsProxy = new Proxy(realBase44.integrations, {
  get(target, prop) {
    if (prop === 'Core') {
      const realCore = target.Core;
      return new Proxy(realCore, {
        get(coreTarget, coreProp) {
          if (coreProp === 'InvokeLLM') {
            // Lazy-load to avoid a circular import at module init time.
            return async (params) => {
              const { invokeLLM } = await import('@/lib/aiClient');
              return invokeLLM(params || {});
            };
          }
          if (coreProp === 'UploadFile') {
            // Route uploads to our own /local-ai/uploadFile endpoint instead
            // of Base44's. Server stores in memory + returns local-file://<id>,
            // which invokeAI already understands as a file_url. Required for
            // AI tools (Quizzes, etc.) to keep working without Base44.
            return async ({ file }) => {
              const fd = new FormData();
              fd.append('file', file);
              const r = await fetch('/local-ai/uploadFile', { method: 'POST', body: fd });
              if (!r.ok) {
                const text = await r.text().catch(() => '');
                throw new Error(`Upload failed (${r.status}): ${text}`);
              }
              return r.json(); // { file_url: 'local-file://...' }
            };
          }
          return coreTarget[coreProp];
        },
      });
    }
    return target[prop];
  },
});

// ─── Top-level base44 export ───────────────────────────────────────────────
// Proxies the real client so any property NOT explicitly handled passes
// through unchanged. The five critical surfaces (entities, auth, functions,
// asServiceRole, integrations) are intercepted.
export const base44 = new Proxy(realBase44, {
  get(target, prop) {
    if (prop === 'entities')        return entitiesProxy;
    if (prop === 'auth')            return authProxy;
    if (prop === 'functions')       return functionsProxy;
    if (prop === 'asServiceRole')   return asServiceRoleProxy;
    if (prop === 'integrations')    return integrationsProxy;
    return target[prop];
  },
});

// Note: AI calls (base44.integrations.Core.InvokeLLM, UploadFile, etc.) are
// intercepted at the Vite middleware layer — see vite.config.js →
// interceptBase44AI plugin. They go to our local Node server (server.mjs)
// regardless of which client we're "using", so no special handling needed here.
