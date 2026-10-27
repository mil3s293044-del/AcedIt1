/**
 * studyFocus — which SAC the study on this tab is for, today.
 *
 * Set from the Study page's "Studying for" chip, or by arriving from a SAC's
 * folder (`/Study?for=sac:<id>`). Read at the moment a session is SAVED, by
 * every writer on the Study page — the shared `handleSessionComplete` and the
 * flashcard review, which writes its own row — so a stamp cannot depend on
 * which technique happened to be open.
 *
 * ─── TODAY, AND THIS TAB ────────────────────────────────────────────────────
 * sessionStorage, not the profile: a stamp chosen on Monday for a Chemistry
 * SAC must not quietly claim Thursday's Methods session, and a choice made in
 * one tab is not a statement about another. It expires at local midnight.
 * Blocked storage reads as "nothing set", which stamps nothing — the one
 * direction this can fail without attributing time to the wrong SAC.
 */
import { dayKey } from "./studyLog.js";

const KEY = "acedit.studyFor.v1";

export function readFocus(now = new Date(), store = typeof sessionStorage !== "undefined" ? sessionStorage : null) {
    try {
        const v = JSON.parse(store?.getItem(KEY) || "null");
        if (v && v.day === dayKey(now) && /^sac:[A-Za-z0-9_-]+$/.test(String(v.key || ""))) return v.key;
    } catch { /* blocked or corrupt: nothing set */ }
    return null;
}

export function writeFocus(key, now = new Date(), store = typeof sessionStorage !== "undefined" ? sessionStorage : null) {
    try {
        if (!key) store?.removeItem(KEY);
        else store?.setItem(KEY, JSON.stringify({ key, day: dayKey(now) }));
    } catch { /* not remembered; the chip still shows it for this visit */ }
}
