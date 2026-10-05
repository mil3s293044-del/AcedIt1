/**
 * mindmapXp — what a mind-map session is worth, and why a tab left open is
 * worth nothing.
 *
 * ─── WALL-CLOCK TIME ON A CANVAS IS NOT STUDY ───────────────────────────────
 * Mind maps started paying XP with the session timed from when the map was
 * OPENED, clamped at four hours. That is the shape of every other technique
 * here and it is wrong for this one, because the other six have a definite
 * start: a student presses a timer, or begins a recall session, or submits a
 * blurt. A canvas is simply open. So the honest reading of a tab left up
 * overnight was 240 minutes, and the only thing bounding it was that `mind_map`
 * had no `DAILY_CAPS` entry and silently inherited the 500 default — higher
 * than quizzes, active recall and blurting, by accident rather than by anyone
 * deciding it.
 *
 * ─── IT DISCOUNTS THE CLAIM; IT DOES NOT ACCUSE ANYBODY ─────────────────────
 * `integrity.js`'s rule, and the only version of this that can be wrong
 * occasionally without doing harm. A student who maps for twenty minutes
 * notices nothing here. A student who leaves the tab open finds that the time
 * was not worth anything — which is a different thing from being told they
 * cheated, and it is the only one of the two this app is entitled to say.
 *
 * ─── TWO RULES, AND THEY CLOSE DIFFERENT HOLES ──────────────────────────────
 *   ACTIVE MINUTES  a minute counts only if an edit landed in it. `edit()` in
 *                   MindMaps.jsx is the SINGLE mutation path — every node,
 *                   rename, link and note goes through it — so this is one
 *                   stamp and it cannot be routed around.
 *   A GROWTH FLOOR  and the session pays nothing unless the map actually grew.
 *                   Active minutes alone still pay somebody nudging a node once
 *                   a minute; this is what makes the minutes have to be spent
 *                   ON something.
 *
 * Neither is a new currency. The payout is still `calcStudySessionXP` at the
 * published 4 XP a minute — these decide how many of the minutes were real,
 * which is the same thing `calcFocusTimerXP`'s idle discount does for the
 * pomodoro, reached from the other direction.
 */

/** A minute, as a bucket index. Two edits in one minute are one minute. */
export const minuteBucket = (ts = Date.now()) => Math.floor(ts / 60000);

/**
 * A map has to BE a map before a session on it pays.
 *
 * The same floor the gap check already applies — three nodes is not a map —
 * so this adds no rule a student has to learn.
 */
export const MIN_NODES = 3;

/** How much the map must have grown for the session to count. */
export const MIN_GROWTH = 1;

/**
 * What a map is WORTH, as a count of the things a student had to think of.
 *
 * Deliberately broader than the node count, because a session spent adding
 * notes, labelling connections and marking what is shaky is real mapping work
 * and would otherwise score a flat zero. Only MOVING and DELETING fail to move
 * this, which is the one case the floor genuinely refuses — and reorganising a
 * map for twenty minutes while adding nothing is the case it is meant to
 * refuse.
 */
export function contentWeight(map) {
    const nodes = map?.nodes || [];
    let w = nodes.length;
    for (const n of nodes) {
        if (n?.note && String(n.note).trim()) w += 1;
        if (n?.link && String(n.link).trim()) w += 1;
    }
    return w + (map?.crossLinks?.length || 0);
}

/**
 * The session, decided.
 *
 * PURE, because it DECIDES WHETHER A STUDENT IS PAID — the same reasoning
 * `expiredKeys` and `pageIndices` record: a payout decision taken inside a
 * handler cannot be checked until it has already paid the wrong number. It
 * returns a reason on every refusal so the caller can say why rather than
 * silently writing nothing.
 */
export function sessionPayout({
    activeMinutes = 0,
    growth = 0,
    nodes = 0,
    maxMinutes = 240,
} = {}) {
    const mins = Math.max(0, Math.floor(Number(activeMinutes) || 0));
    // `Number(null)` is 0, so every one of these is written as a floor rather
    // than a truthiness test — the trap this codebase has now met in nine
    // modules, and here it would pay a session that had nothing in it.
    if (!mins) return { minutes: 0, ok: false, reason: "idle" };
    if ((Number(nodes) || 0) < MIN_NODES) return { minutes: 0, ok: false, reason: "too_small" };
    if ((Number(growth) || 0) < MIN_GROWTH) return { minutes: 0, ok: false, reason: "no_growth" };
    return { minutes: Math.min(mins, Math.max(1, Number(maxMinutes) || 240)), ok: true, reason: null };
}

/**
 * The live tally for one sitting on one map.
 *
 * Kept as a factory rather than a hook so the rules are testable without
 * React, and so the component holds ONE of these in a ref — a sitting is not
 * render state and re-creating it on a re-render would lose the minutes.
 */
export function newSession(map) {
    return {
        /** Minute buckets in which an edit landed. A Set, so a burst is one. */
        minutes: new Set(),
        /** What the map was worth when this sitting began. */
        startWeight: contentWeight(map),
    };
}

/** Called from the one mutation path. */
export function noteEdit(session, ts = Date.now()) {
    if (session) session.minutes.add(minuteBucket(ts));
    return session;
}

/**
 * Close a sitting and say what it earned.
 *
 * It RESETS as it reads, which is what lets the gap check and leaving the map
 * both be boundaries without either double-paying: whatever the first one
 * banks, the second one starts from nothing. The old code restarted a wall
 * clock for the same reason and could still pay a minute for a second check
 * landing in the same breath, because its floor was `Math.max(1, …)`.
 */
export function closeSession(session, map, { maxMinutes = 240 } = {}) {
    if (!session) return { minutes: 0, ok: false, reason: "idle", growth: 0 };
    const weight = contentWeight(map);
    const growth = weight - session.startWeight;
    const out = sessionPayout({
        activeMinutes: session.minutes.size,
        growth,
        nodes: map?.nodes?.length || 0,
        maxMinutes,
    });
    session.minutes.clear();
    session.startWeight = weight;
    return { ...out, growth };
}

export default {
    minuteBucket, contentWeight, sessionPayout, newSession, noteEdit, closeSession,
    MIN_NODES, MIN_GROWTH,
};
