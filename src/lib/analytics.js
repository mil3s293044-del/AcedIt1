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
 */

const META_PIXEL_ID   = import.meta.env.VITE_META_PIXEL_ID;
const TIKTOK_PIXEL_ID  = import.meta.env.VITE_TIKTOK_PIXEL_ID;
const GA4_ID           = import.meta.env.VITE_GA4_ID;

let initialised = false;

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

/** Inject whichever pixels are configured. Safe to call once at app start. */
export function initAnalytics() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  try { if (META_PIXEL_ID)   loadMetaPixel(META_PIXEL_ID); }   catch (e) { /* never break the app on a pixel error */ }
  try { if (TIKTOK_PIXEL_ID) loadTikTokPixel(TIKTOK_PIXEL_ID); } catch (e) { /* */ }
  try { if (GA4_ID)          loadGA4(GA4_ID); }                catch (e) { /* */ }
}

/** Fire a virtual page view across all live pixels (for SPA route changes). */
export function trackPageView(path) {
  if (typeof window === "undefined") return;
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
  if (typeof window === "undefined") return;
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
