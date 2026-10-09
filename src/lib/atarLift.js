/**
 * atarLift — what moving a component is actually worth, in ATAR points.
 *
 * CLIENT MIRROR of the composite in computeAcedItATAR() in server.mjs. The
 * server owns the score; this only answers the follow-up question the score
 * has never been able to answer: "so what do I do about it, and what is it
 * worth?" Until now the Dashboard could name the weakest slice but had no way
 * to say whether fixing it moved the number by 0.1 or by 4.
 *
 * KEEP THE WEIGHTS AND THE CURVE IN SYNC WITH server.mjs.
 *
 * One deliberate detail: every figure here is a DIFFERENCE between two runs of
 * the model, never the model's absolute output. Components are persisted as
 * rounded integers, so re-deriving the current ATAR from them lands a little
 * off the stored value. Differencing cancels that — a gain of +0.62 is honest
 * even though the modelled baseline isn't exactly the stored score.
 */

export const ATAR_WEIGHTS = {
    mastery: 0.28,
    consistency: 0.27,
    effort: 0.22,
    breadth: 0.13,
    planning: 0.10,
};

export const COMPONENT_KEYS = Object.keys(ATAR_WEIGHTS);

/**
 * What full marks on a component takes, for the rows that print "N of M".
 *
 * The server SENDS these on `atar_components` (`consistency_target`,
 * `effort_target`, `technique_target`) and that is what a panel should read.
 * This is the fallback for a components blob computed before it did — the shape
 * breadth already used (`c.technique_target ?? 5`), extended to the two that
 * had their denominators typed straight into the copy instead: "of 20 days" and
 * "of ~20h", in AtarPanel.jsx AND Ranked.jsx, four hard figures about the one
 * number the whole app is standardised around. `mirrors.test.mjs` pins all
 * three against the server's own constants, so the fallback cannot go stale
 * quietly — which is the difference between a copy and a mirror.
 */
export const ATAR_TARGETS = {
    consistency_days: 20,
    effort_minutes: 1200,
    technique_families: 5,
};

const FLOOR = 30, SPAN = 69.95, CURVE = 0.8, CAP = 99.95;

// THE SCORE MOVES IN STEPS OF 0.05, and this file said "the server's curve,
// exactly" while leaving that out. The server quantises (`Math.round(raw /
// 0.05) * 0.05`, then two decimal places) because that is the increment the
// real scale uses; the client returned the raw curve. So every "+0.0x ATAR"
// the app publishes — Today's Play's payoff rail, StandingRail's bestLever,
// Ranked's five component doors — was differenced off a continuous curve while
// the stored number it claims to predict is a stepped one. A student told ten
// points of consistency is worth +0.03 did the work and watched the score move
// 0.05 or not at all, which is the whole argument for using this differenced
// model over XP in the first place: it is meant to be CHECKABLE.
//
// Quantising both ends also makes `liftFor`'s own rule true rather than
// aspirational — a gain that cannot move the stored score now returns 0.00 and
// the row is dropped, instead of printing a figure nothing can confirm.
const STEP = 0.05;

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** The server's curve, exactly — `mirrors.test.mjs` runs both and compares. */
export function atarFromComposite(composite) {
    const raw = FLOOR + SPAN * Math.pow(clamp01(composite), CURVE);
    return Number(Math.min(CAP, Math.round(raw / STEP) * STEP).toFixed(2));
}

/**
 * Composite from the persisted components, which are 0–100 integers.
 * Returns null when nothing usable is present — a missing component set must
 * not quietly read as a set of zeroes.
 */
export function compositeOf(components) {
    if (!components) return null;
    let sum = 0, seen = 0;
    for (const k of COMPONENT_KEYS) {
        const v = Number(components[k]);
        if (!Number.isFinite(v)) continue;
        sum += ATAR_WEIGHTS[k] * clamp01(v / 100);
        seen++;
    }
    return seen ? sum : null;
}

/**
 * ATAR gain from raising one component by `delta` points (0–100 scale).
 * Capped at the component's real headroom, so a component sitting at 96 does
 * not get credited with a ten-point rise it cannot have.
 */
export function liftFor(components, key, delta = 10) {
    const base = compositeOf(components);
    if (base == null || !ATAR_WEIGHTS[key]) return null;
    const now = Number(components[key]);
    if (!Number.isFinite(now)) return null;
    const applied = Math.min(delta, 100 - clamp01(now / 100) * 100);
    if (applied <= 0) return { key, delta: 0, gain: 0, headroom: 0 };
    const lifted = base + ATAR_WEIGHTS[key] * (applied / 100);
    return {
        key,
        delta: Math.round(applied),
        gain: Math.max(0, atarFromComposite(lifted) - atarFromComposite(base)),
        headroom: Math.round(100 - now),
    };
}

/**
 * Which component has the most ATAR actually sitting on it — weight times
 * headroom, not simply the lowest number. A planning score of 20 looks worse
 * than a mastery score of 55, but mastery carries nearly three times the
 * weight, so that is where the points are.
 */
export function bestLever(components) {
    const base = compositeOf(components);
    if (base == null) return null;
    let best = null;
    for (const k of COMPONENT_KEYS) {
        const v = Number(components[k]);
        if (!Number.isFinite(v)) continue;
        const headroom = Math.max(0, 100 - v);
        const available = ATAR_WEIGHTS[k] * (headroom / 100);
        if (!best || available > best.available) {
            best = { key: k, value: Math.round(v), headroom: Math.round(headroom), available };
        }
    }
    if (!best) return null;
    return {
        ...best,
        // What closing the whole gap on this one component would be worth, and
        // what a realistic ten-point nudge is worth.
        maxGain: Math.max(0, atarFromComposite(base + best.available) - atarFromComposite(base)),
        stepGain: liftFor(components, best.key, 10)?.gain ?? 0,
    };
}

/** Every component, ordered by how much ATAR is available on it. */
export function leverboard(components) {
    const base = compositeOf(components);
    if (base == null) return [];
    return COMPONENT_KEYS
        .filter(k => Number.isFinite(Number(components[k])))
        .map(k => {
            const v = Number(components[k]);
            const available = ATAR_WEIGHTS[k] * ((100 - v) / 100);
            return {
                key: k,
                value: Math.round(v),
                weight: ATAR_WEIGHTS[k],
                available,
                gain: Math.max(0, atarFromComposite(base + available) - atarFromComposite(base)),
            };
        })
        .sort((a, b) => b.available - a.available);
}
