/**
 * appVersion — noticing that a new build shipped, and deciding when it is
 * fair to say so.
 *
 * ─── Why this exists at all ─────────────────────────────────────────────────
 * `lazyPage.js` already records the failure: the 24 pages are code-split, so a
 * student holding an open tab has an `index.html` naming `Dashboard-a1b2c3.js`,
 * a deploy replaces it and DELETES the old file, and their next navigation asks
 * for a chunk that no longer exists. On a site that ships often, every open tab
 * is one navigation from a white screen.
 *
 * `lazyPage` is the SAFETY NET — it retries, then reloads once. This is the
 * other half: telling the student before they walk into it, so the reload is
 * something they chose at a moment that suits them rather than something that
 * happens to them halfway into a quiz.
 *
 * ─── THE VERSION IS WHATEVER THE SERVER IS SERVING ──────────────────────────
 * There is no version constant to bump and nothing stamped at build time. The
 * server hashes the built `index.html` — the file naming every chunk — and this
 * compares the first answer it ever got against the latest one. Two things fall
 * out, and both matter:
 *
 *   A tab that loads AFTER a deploy has the new id as its baseline, so it is
 *   never told to reload something it already has.
 *
 *   A server restart with no deploy re-reads the same file, so a crash loop
 *   cannot turn into a prompt every thirty seconds.
 *
 * A null version (dev, or an unreadable build) means "no opinion", and no
 * opinion must never read as a change — hence `stale` requires both sides to
 * be real strings.
 *
 * ─── AND IT NEVER INTERRUPTS REAL WORK ──────────────────────────────────────
 * A reload is a far larger interruption than the data refetch `liveRefresh.js`
 * was written to schedule: it destroys typed answers, an in-flight marking
 * call, and a running focus block. So the hold list is not a second opinion —
 * `holdReasons` is imported from that file, which is where QuizPlayer,
 * ExamMode, the pomodoro, blurting, the floating timer and every AI stream
 * already declare themselves. A surface that holds the refresh holds the
 * reload, automatically and without being told twice.
 *
 * DEFER, NEVER DROP, which is the same rule that file keeps: the update does
 * not go away because somebody was mid-quiz. It waits, and it is still waiting
 * when they finish.
 */

import { holdReasons } from "@/lib/liveRefresh";

/** Where the server publishes the build it is actually serving. */
export const VERSION_URL = "/local-ai/version";

/**
 * How often to ask.
 *
 * Deliberately slow. The cost of being late is that a student browses an old
 * bundle for a few more minutes — which works perfectly well until they hit a
 * missing chunk, and `lazyPage` covers that case anyway. The cost of being
 * fast is a request every few seconds from every open tab, forever, to answer
 * a question whose answer changes a handful of times a week.
 */
export const VERSION_POLL_MS = 180000;

/**
 * The quietest moment to check is the one a student just created.
 *
 * Coming back to the tab is when a deploy is most likely to have landed since
 * they last looked, and is also the one moment we KNOW they are not mid-
 * sentence. A check then is worth many polls.
 */
export const VERSION_FOCUS_GAP_MS = 30000;

/**
 * Is `latest` a different build from the one this tab booted with?
 *
 * Both have to be real strings. `null !== "abc"` is true and would announce an
 * update on the first successful poll of any dev session, which is both wrong
 * and the kind of wrong that gets the whole feature switched off.
 */
export function stale(booted, latest) {
    if (!booted || !latest) return false;
    return String(booted) !== String(latest);
}

/**
 * May we put a full-screen prompt in front of this student right now?
 *
 * Separate from `stale` because they answer different questions and change for
 * different reasons: whether a new build EXISTS is a fact about the server, and
 * whether we may say so is a fact about what the student is in the middle of.
 * Collapsing them into one boolean is how "there is an update" quietly becomes
 * "reload now", which is the whole thing this is built to avoid.
 *
 * Returns `{ ok, reason }` rather than a bare boolean so a caller can say what
 * it is waiting for — and so the test can assert WHICH hold applied rather than
 * only that something did.
 */
export function mayPrompt({
    now = Date.now(),
    lastInputAt = 0,
    busy = [],
    focusedHasContent = false,
    hidden = false,
} = {}) {
    // A prompt nobody can see is not a prompt — it is a page that will have
    // changed under them when they come back. The focus handler asks again the
    // moment they return, which is the only moment this matters.
    if (hidden) return { ok: false, reason: "hidden" };

    const reasons = holdReasons({ now, lastInputAt, busy, focusedHasContent });
    if (reasons.length) return { ok: false, reason: reasons[0], reasons };

    return { ok: true, reason: null };
}

/**
 * Ask the server what it is serving.
 *
 * Every failure answers `null` — offline, a proxy swallowing it, a 500 during
 * a deploy, a body that is not JSON. A failed check must never look like a new
 * version, because the one thing worse than missing an update is a prompt to
 * reload that appears because the network blipped.
 *
 * `cache: "no-store"` on the client as well as the header on the server: a
 * service worker or a back/forward cache can answer this without the request
 * ever reaching the network.
 */
export async function fetchVersion(signal) {
    try {
        const res = await fetch(VERSION_URL, { cache: "no-store", signal });
        if (!res.ok) return null;
        const body = await res.json();
        return typeof body?.version === "string" ? body.version : null;
    } catch {
        return null;
    }
}
