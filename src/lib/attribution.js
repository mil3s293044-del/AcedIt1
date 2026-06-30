/**
 * attribution.js — first-touch UTM + campaign-pillar capture.
 *
 * On the visitor's first landing with UTM/pillar params in the URL, we stash
 * them in localStorage so they survive the journey through onboarding and into
 * signup. This is how we answer "which campaign pillar drove this paying user".
 *
 * First-touch wins: we only write once, so the original source that brought
 * them in is the one credited, not whatever page they happened to sign up from.
 */

const STORAGE_KEY = "acedit_attribution_v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/** Read UTM + `pillar` from the current URL and persist first-touch. Idempotent. */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  try {
    // Already captured? First-touch wins — leave it alone.
    if (localStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const utm = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) utm[k] = v;
    }
    const pillar = params.get("pillar") || null;

    // Nothing to record (direct/organic visit with no tags) — don't write an
    // empty object, so a later tagged visit can still be captured as first-touch.
    if (Object.keys(utm).length === 0 && !pillar) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ utm, pillar, landing_path: window.location.pathname, ts: new Date().toISOString() })
    );
  } catch (e) {
    /* localStorage blocked (private mode) — attribution just won't persist. */
  }
}

/** Return the stored first-touch attribution, or a safe empty shape. */
export function getAttribution() {
  if (typeof window === "undefined") return { utm: {}, pillar: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { utm: {}, pillar: null };
    const parsed = JSON.parse(raw);
    return { utm: parsed.utm || {}, pillar: parsed.pillar || null, landing_path: parsed.landing_path, ts: parsed.ts };
  } catch {
    return { utm: {}, pillar: null };
  }
}
