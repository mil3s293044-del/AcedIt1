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

const FLOOR = 30, SPAN = 69.95, CURVE = 0.8, CAP = 99.95;

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** The server's curve, exactly. */
export function atarFromComposite(composite) {
    return Math.min(CAP, FLOOR + SPAN * Math.pow(clamp01(composite), CURVE));
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
