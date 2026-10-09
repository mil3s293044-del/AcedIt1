/**
 * spark — the two decisions behind the Progress sparkline, as pure functions.
 *
 * ─── THEY ARE HERE BECAUSE A SCAN CANNOT CHECK THEM ─────────────────────────
 * Both of these lived inside `Spark.jsx` and were guarded by grepping that
 * file, and the injection sweep proved what that is worth: `if (false) { …
 * MIN_SPAN … }` still contains the name, and `runs.push(run)` survives after
 * the loop with the gap-break deleted. Both bugs passed a source scan and
 * both draw a chart that is quietly wrong.
 *
 * ─── AND IN A `.js`, NOT THE COMPONENT ──────────────────────────────────────
 * The test loader will not resolve a `.jsx` — which is the trap `xpRanks.js`
 * was extracted out of `xpSystem.jsx` for, met again. The same move `sm2.js`
 * and `mastery.js` each already made: the judgement lives where it can be
 * run, the component renders what it returns.
 */

/** Under this many real points there is no trajectory, only a comparison. */
export const MIN_POINTS = 3;

/** The narrowest y-window a line may be drawn in. */
export const MIN_SPAN = 10;

/**
 * The y-window.
 *
 * Auto-scaling to the data's own min draws a wander between 70% and 72% as a
 * mountain range — the lesson `PriceChart`'s own `MIN_SPAN` records. A COUNT
 * always includes its zero, because zero is a real reading there; a
 * PERCENTAGE is padded around the data, because a quiz average of 70 plotted
 * against a floor of 0 is a flat line four fifths of the way up the box.
 */
export function spanOf(values = [], percent = false) {
    const vals = (Array.isArray(values) ? values : []).filter((v) => Number.isFinite(v));
    if (!vals.length) return { lo: 0, hi: MIN_SPAN };
    let lo = percent ? Math.min(...vals) : 0;
    let hi = Math.max(...vals);
    if (hi - lo < MIN_SPAN) {
        const mid = (hi + lo) / 2;
        lo = percent ? Math.max(0, mid - MIN_SPAN / 2) : 0;
        hi = lo + MIN_SPAN;
    }
    return { lo, hi };
}

/**
 * The unbroken runs of real values, as `[index, value]` pairs.
 *
 * A null BREAKS the line. Joined across, the two days either side of a gap are
 * connected by a segment describing days that have no data — the chart form of
 * `Number(null) === 0`, and invisible in any render where the gap is short.
 */
export function runsOf(points = []) {
    const runs = [];
    let run = [];
    (Array.isArray(points) ? points : []).forEach((p, i) => {
        if (Number.isFinite(p?.value)) run.push([i, p.value]);
        else if (run.length) { runs.push(run); run = []; }
    });
    if (run.length) runs.push(run);
    return runs;
}
