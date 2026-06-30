// ════════════════════════════════════════════════════════════════════════════
// API base URL — resolves backend (/local-ai/*) calls for web vs native.
//
// On the web (dev AND production) the app is served from the same origin that
// handles /local-ai/* — Vite proxies to localhost:3001 in dev, and acedit.au
// serves it in production — so relative paths just work and API_BASE is ''.
//
// In a native Capacitor build the app loads from capacitor://localhost (iOS)
// or http://localhost (Android), which has NO backend. So every backend call
// must be sent to the production origin instead. Capacitor.isNativePlatform()
// is false on the web, so this is a no-op there.
// ════════════════════════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';

// The production origin that serves /local-ai/* for packaged mobile apps.
// Override at build time with VITE_NATIVE_API_ORIGIN if the API ever moves.
const NATIVE_API_ORIGIN = import.meta.env.VITE_NATIVE_API_ORIGIN || 'https://acedit.au';

export const API_BASE = Capacitor.isNativePlatform() ? NATIVE_API_ORIGIN : '';

// Prefix a backend path with the right origin. Absolute URLs pass through
// unchanged so callers can mix relative and absolute freely.
export function apiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return API_BASE + path;
}
