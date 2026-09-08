/**
 * liveRefresh — deciding WHEN the app is allowed to pull fresh data under
 * somebody who is in the middle of something.
 *
 * ─── The whole problem in one sentence ──────────────────────────────────────
 * A student wants their standing to be current the moment they look at it, and
 * wants absolutely nothing to move while they are answering question 7 of a
 * timed call-out. Those two are in direct conflict, and the resolution is not
 * to pick one.
 *
 * ─── DEFER, NEVER SKIP ──────────────────────────────────────────────────────
 * This is the rule the whole file exists to keep. A refresh that arrives while
 * the student is busy is REMEMBERED and runs the moment they are free — it is
 * not dropped. Skipping is the version that feels broken: you finish a quiz,
 * look at the leaderboard, and it is showing numbers from before you started,
 * because the one refresh that would have fixed it was thrown away while you
 * were typing.
 *
 * ─── What counts as busy ────────────────────────────────────────────────────
 * Anything where a re-render would cost the student something:
 *
 *   quiz / exam / callout   a question on screen, and in the call-out's case a
 *                           clock somebody's XP depends on
 *   focus / timer           the pomodoro blackout and blurting's focus screen,
 *                           whose entire purpose is that nothing moves
 *   ai                      a stream or a marking call in flight
 *   typing                  ANY text the student has entered and not saved
 *
 * Typing is deliberately not a registry of every form in the app — that is a
 * list that would be wrong within a month. It is measured: an `input` event in
 * the last few seconds, or a focused text field with something in it. Both are
 * facts about the document rather than something each component has to
 * remember to declare.
 *
 * ─── And a refresh is never a remount ───────────────────────────────────────
 * What this schedules is a DATA refetch. Nothing here reloads the page, resets
 * a route, or unmounts a tree. The worst it can do while the student is idle
 * is change a number, which is the entire point.
 */

/** Reasons a refresh must wait. Ordered loosely by how costly interrupting is. */
export const BUSY = {
    QUIZ: "quiz",
    EXAM: "exam",
    CALLOUT: "callout",
    FOCUS: "focus",
    TIMER: "timer",
    AI: "ai",
    TYPING: "typing",
    DIALOG: "dialog",
};

/**
 * How long after the last keystroke the app still counts as "being typed in".
 *
 * Long enough to cover thinking mid-sentence, short enough that a student who
 * wandered off mid-form is not holding the whole app stale. A deferred refresh
 * runs the moment this lapses, so the cost of being generous here is a few
 * seconds of staleness, never a lost update.
 */
export const TYPING_QUIET_MS = 4000;

/** While a contest is live. Rivals study on their own schedule. */
export const LIVE_POLL_MS = 45000;

/** When nothing is live there is no race to track; the tick is a formality. */
export const IDLE_POLL_MS = 300000;

/**
 * A refresh younger than this is not worth doing again. Focus, visibility and
 * route changes all fire together when somebody alt-tabs back into a page, and
 * without this they would be three refetches for one action.
 */
export const MIN_GAP_MS = 4000;

const TEXTY = /^(input|textarea)$/i;
const TEXT_TYPES = new Set([
    "text", "search", "email", "url", "tel", "password", "number", "",
]);

/**
 * Is the focused element something the student is part-way through filling in?
 *
 * EMPTY IS NOT BUSY. Sitting in a blank search box is not work in progress,
 * and treating it as such means a student who clicked a filter once holds the
 * app stale until they click away.
 */
export function focusedFieldHasContent(el) {
    if (!el) return false;
    if (el.isContentEditable) return String(el.textContent || "").trim().length > 0;
    const tag = el.tagName || "";
    if (!TEXTY.test(tag)) return false;
    if (tag.toLowerCase() === "input" && !TEXT_TYPES.has(String(el.type || "").toLowerCase())) return false;
    return String(el.value || "").trim().length > 0;
}

/**
 * The decision, as a pure function of the world.
 *
 * Kept separate from the React that drives it so the rules can be asserted
 * directly — "does a refresh wait for a call-out quiz" is a question with an
 * answer, and it should not require rendering anything to ask it.
 *
 * Returns one of:
 *   { action: "refresh" }               go now
 *   { action: "defer", reason }         remember it; run when `reason` clears
 *   { action: "skip",  reason }         nothing is asking for one
 */
export function decideRefresh({
    now = Date.now(),
    lastRefreshAt = 0,
    lastInputAt = 0,
    busy = [],
    focusedHasContent = false,
    hidden = false,
    requested = false,
    live = false,
    force = false,
} = {}) {
    // A forced refresh (the student pressed something, or a write just landed)
    // still respects busy — that is what makes "defer" trustworthy — but it
    // ignores the poll gap and the visibility check.
    const reasons = [...busy];
    if (!force && now - lastInputAt < TYPING_QUIET_MS) reasons.push(BUSY.TYPING);
    else if (focusedHasContent) reasons.push(BUSY.TYPING);

    if (reasons.length) return { action: "defer", reason: reasons[0], reasons };

    // Nothing to do while the tab is in the background: a poll nobody can see
    // is battery spent on a screen that is not on. The visibility handler
    // requests one the moment they come back, which is the only moment the
    // freshness actually matters.
    if (hidden && !force) return { action: "skip", reason: "hidden" };

    if (force) return { action: "refresh", reason: "forced" };
    if (requested) {
        return now - lastRefreshAt < MIN_GAP_MS
            ? { action: "skip", reason: "too soon" }
            : { action: "refresh", reason: "requested" };
    }

    const gap = live ? LIVE_POLL_MS : IDLE_POLL_MS;
    return now - lastRefreshAt >= gap
        ? { action: "refresh", reason: live ? "poll:live" : "poll:idle" }
        : { action: "skip", reason: "not due" };
}

/**
 * A registry of things that are currently busy.
 *
 * Token-based rather than a boolean, because two surfaces can be busy at once
 * (a call-out quiz with a timer running inside it) and a component unmounting
 * must only clear ITS OWN claim. A boolean would let the first one to finish
 * declare the app free.
 */
export function createBusyRegistry() {
    const held = new Map();          // token -> reason
    const listeners = new Set();
    let seq = 0;

    const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* a bad listener must not wedge the app */ } });

    return {
        acquire(reason) {
            const token = `b${(seq += 1)}`;
            held.set(token, reason);
            notify();
            return token;
        },
        release(token) {
            if (held.delete(token)) notify();
        },
        reasons() {
            return [...new Set(held.values())];
        },
        onChange(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        /** Test seam. */
        _size: () => held.size,
    };
}

/**
 * What CHANGED between two snapshots of a standing — the input to every
 * "something moved" animation on the page.
 *
 * Returns null on the first snapshot rather than a set of deltas from zero. A
 * student opening the app must not be shown "+400 XP" for XP they earned last
 * week, and a page that animates everything on first paint teaches them to
 * ignore the animation that matters.
 */
export function diffStandings(before, after) {
    if (!before || !after) return null;
    const out = { changed: [], overtaken: [], caught: [] };

    const byEmail = new Map((before.rows || []).map((r) => [r.email, r]));
    (after.rows || []).forEach((row, i) => {
        const was = byEmail.get(row.email);
        if (!was) return;
        const d = Math.round((row.score || 0) - (was.score || 0));
        if (d !== 0) out.changed.push({ email: row.email, name: row.name, delta: d, to: row.score });

        const wasRank = (before.rows || []).findIndex((r) => r.email === row.email);
        // A rank that improved, on somebody's row. Reported for both people so
        // the leaderboard can flash the pair rather than one half of a swap.
        if (wasRank >= 0 && i < wasRank) {
            out.overtaken.push({ email: row.email, name: row.name, from: wasRank + 1, to: i + 1 });
        }
    });

    // Somebody closing on ME. Loss aversion is the strongest pull this app has
    // and it is also the easiest to overuse, so it fires only on a gap that
    // NARROWED and is now inside the threshold — not on every poll where a
    // rival happens to be nearby.
    const meNow = (after.rows || []).find((r) => r.isMe);
    const meWas = (before.rows || []).find((r) => r.isMe);
    if (meNow && meWas) {
        const gapNow = gapBelow(after.rows, meNow);
        const gapWas = gapBelow(before.rows, meWas);
        if (gapNow != null && gapWas != null && gapNow < gapWas && gapNow <= CAUGHT_WITHIN) {
            const chaser = chaserOf(after.rows, meNow);
            if (chaser) out.caught.push({ email: chaser.email, name: chaser.name, gap: gapNow });
        }
    }

    return out;
}

/** How close the person directly behind you has got. */
export const CAUGHT_WITHIN = 25;

function chaserOf(rows = [], me) {
    const i = rows.findIndex((r) => r.email === me.email);
    return i >= 0 && i + 1 < rows.length ? rows[i + 1] : null;
}

function gapBelow(rows = [], me) {
    const c = chaserOf(rows, me);
    return c ? Math.round((me.score || 0) - (c.score || 0)) : null;
}

/**
 * Is anything actually racing?
 *
 * The poll rate, the nav dot and every "live" affordance key off this one
 * answer, so it lives here rather than being re-derived per surface with
 * slightly different rules three times.
 */
export function anythingLive({ battles = [], callouts = [] } = {}) {
    const liveBattles = battles.filter((b) => b?.status === "active").length;
    const liveCallouts = callouts.filter((c) => ["pending", "active"].includes(c?.status)).length;
    return { live: liveBattles + liveCallouts > 0, battles: liveBattles, callouts: liveCallouts };
}

/**
 * THE app's busy registry.
 *
 * A singleton because not everything that must hold the app still is a React
 * component: an AI stream is a promise inside `aiClient`, and asking every
 * caller of it to render a component that claims busy would be a rule
 * everybody forgets. Non-React code takes a token here directly; `useBusy`
 * wraps the same object.
 *
 * `LiveProvider` deliberately does NOT create its own — two registries would
 * mean the provider free-running while the AI half still had work in flight.
 */
export const globalBusy = createBusyRegistry();

/**
 * Hold the app still for as long as `fn` is running.
 *
 * Released in a finally, so a rejected call cannot leave the app frozen — the
 * failure mode of a leaked claim is an app that never refreshes again, which
 * is much worse than the refresh it was protecting.
 */
export async function whileBusy(reason, fn) {
    const token = globalBusy.acquire(reason);
    try {
        return await fn();
    } finally {
        globalBusy.release(token);
    }
}
