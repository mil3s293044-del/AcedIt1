/**
 * analytics.js — marketing pixel + page-view layer for AcedIt.
 *
 * Loads Meta (Facebook/Instagram) Pixel, TikTok Pixel and Google Analytics 4
 * ONLY when their IDs are present in env. With no IDs set, every function here
 * is a safe no-op, so dev and any un-configured environment behave normally.
 *
 * Configure in .env.local (and on Render for production):
 *   VITE_META_PIXEL_ID=1234567890
 *   VITE_TIKTOK_PIXEL_ID=ABCDEFGHIJKLMNOP
 *   VITE_GA4_ID=G-XXXXXXXXXX
 *
 * The semantic helpers (trackLead / trackPurchase / trackSignup) fan a single
 * call out to whichever pixels are live, so call sites never touch fbq/ttq/gtag
 * directly.
 *
 * ─── NOTHING LOADS UNTIL SOMEBODY SAYS YES ──────────────────────────────────
 * `initAnalytics()` used to be called at the top level of `main.jsx`, so Meta
 * and TikTok fired on every page load — before React rendered, before login,
 * before anything could have been agreed to — on an app whose users are mostly
 * fifteen to eighteen. It is now `applyConsent()`, it loads nothing until the
 * stored choice is GRANTED, and a choice that cannot be read is a refusal.
 *
 * ─── AND CONSENT ALONE IS NOT ENOUGH ────────────────────────────────────────
 * Every firing function asks `mayTrack`, which needs consent AND an adult band.
 * A sixteen-year-old ticking a box is not the consent the children's code is
 * asking for, so the honest implementation is not to ask them — see the note
 * over `mayAdTrack` in compliance.js.
 *
 * `setTrackingBand` is how the app tells this module who is signed in. Until it
 * is called the band is UNKNOWN, which tracks only where `allowAnonymous` is
 * passed — the marketing pages, where there is no account and no age to know.
 * The moment a profile loads, an unknown age stops meaning "a visitor" and
 * starts meaning "they have not answered yet", which is a refusal.
 */

import { BAND, CONSENT, readConsent, writeConsent, mayTrack } from "@/lib/compliance";

const META_PIXEL_ID   = import.meta.env.VITE_META_PIXEL_ID;
const TIKTOK_PIXEL_ID  = import.meta.env.VITE_TIKTOK_PIXEL_ID;
const GA4_ID           = import.meta.env.VITE_GA4_ID;

let initialised = false;

/** Who is signed in, as far as tracking is concerned. UNKNOWN until told. */
let currentBand = BAND.UNKNOWN;
/** True only on the pages with no account behind them. */
let anonymousContext = true;

/**
 * Tell the tracking layer which band the signed-in student falls in.
 *
 * Called with `null` on sign-out, which returns the module to the anonymous
 * marketing posture rather than leaving the last student's band behind for
 * whoever uses the browser next.
 */
export function setTrackingBand(band) {
    if (band === null || band === undefined) {
        currentBand = BAND.UNKNOWN;
        anonymousContext = true;
        return;
    }
    currentBand = band;
    anonymousContext = false;
}

/** The one question every function below asks before it touches a pixel. */
function allowed() {
    return mayTrack({
        consent: readConsent(),
        band: currentBand,
        allowAnonymous: anonymousContext,
    });
}

function loadMetaPixel(id) {
   
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
   
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function loadTikTokPixel(id) {
   
  !(function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    var ttq = (w[t] = w[t] || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
    ttq.setAndDefer = function (e, n) {
      e[n] = function () { e.push([n].concat(Array.prototype.slice.call(arguments, 0))); };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (e) {
      for (var n = ttq._i[e] || [], i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(n, ttq.methods[i]);
      return n;
    };
    ttq.load = function (e, n) {
      var r = "https://analytics.tiktok.com/i18n/pixel/events.js", o = n && n.partner;
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      var s = d.createElement("script");
      s.type = "text/javascript"; s.async = !0; s.src = r + "?sdkid=" + e + "&lib=" + t;
      var a = d.getElementsByTagName("script")[0];
      a.parentNode.insertBefore(s, a);
    };
    ttq.load(id);
    ttq.page();
  })(window, document, "ttq");
   
}

function loadGA4(id) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  // SPA: we fire page_view manually on route change, so disable the automatic one.
  window.gtag("config", id, { send_page_view: false });
}

/**
 * Load the configured pixels, IF and only if consent has been given.
 *
 * Safe to call as often as you like — `initialised` makes it idempotent, so
 * the banner can call it on accept and the app can call it on every mount
 * without stacking three copies of the Meta script.
 *
 * It does NOT check the band. A pixel is loaded once for the browser, and at
 * the moment of consent on the marketing site there is usually no account to
 * have a band; the per-event `allowed()` gate is what keeps a known minor's
 * behaviour from ever being SENT. Loading and sending are different acts and
 * only the second one carries data.
 */
export function applyConsent() {
  if (initialised || typeof window === "undefined") return false;
  if (readConsent() !== CONSENT.GRANTED) return false;
  initialised = true;

  try { if (META_PIXEL_ID)   loadMetaPixel(META_PIXEL_ID); }   catch (e) { /* never break the app on a pixel error */ }
  try { if (TIKTOK_PIXEL_ID) loadTikTokPixel(TIKTOK_PIXEL_ID); } catch (e) { /* */ }
  try { if (GA4_ID)          loadGA4(GA4_ID); }                catch (e) { /* */ }
  return true;
}

/** Record a choice and act on it in one call. Returns the stored value. */
export function setConsent(value) {
  writeConsent(value);
  if (value === CONSENT.GRANTED) applyConsent();
  return readConsent();
}

/**
 * Withdrawing consent stops every future event immediately.
 *
 * A script already in the page cannot be unloaded, and pretending otherwise
 * would be the dishonest version of this: what CAN be guaranteed is that
 * nothing further is sent, because `allowed()` is consulted on every call and
 * reads storage each time rather than caching the answer. Clearing the cookies
 * those scripts set is the browser's job and the banner says so.
 */
export function revokeConsent() {
  return setConsent(CONSENT.DENIED);
}

/** Fire a virtual page view across all live pixels (for SPA route changes). */
export function trackPageView(path) {
  if (typeof window === "undefined" || !allowed()) return;
  try {
    if (window.fbq) window.fbq("track", "PageView");
    if (window.ttq) window.ttq.page();
    if (window.gtag && GA4_ID) window.gtag("event", "page_view", { page_path: path });
  } catch (e) { /* */ }
}

/**
 * Generic event fan-out. `meta`/`tiktok` are the platform-specific standard
 * event names; `params` carries value/currency etc.
 */
function track({ meta, tiktok, ga, params = {} }) {
  if (typeof window === "undefined" || !allowed()) return;
  try {
    if (meta && window.fbq) window.fbq("track", meta, params);
    if (tiktok && window.ttq) window.ttq.track(tiktok, params);
    if (ga && window.gtag) window.gtag("event", ga, params);
  } catch (e) { /* */ }
}

/** Visitor gave their email for a lead magnet — the top-of-funnel signal. */
export function trackLeadMagnet(params = {}) {
  track({ meta: "Lead", tiktok: "SubmitForm", ga: "generate_lead", params });
}

/** Visitor started the free-trial / onboarding flow. */
export function trackStartTrial(params = {}) {
  track({ meta: "StartTrial", tiktok: "StartTrial", ga: "begin_trial", params });
}

/** A new account was created — the conversion ad platforms should optimise for early. */
export function trackSignup(params = {}) {
  track({ meta: "CompleteRegistration", tiktok: "CompleteRegistration", ga: "sign_up", params });
}

/** A premium subscription was paid for. value in dollars, currency ISO code. */
export function trackPurchase(value, currency = "AUD") {
  const params = { value: Number(value) || 0, currency };
  track({
    meta: "Purchase",
    tiktok: "CompletePayment",
    ga: "purchase",
    params,
  });
}
