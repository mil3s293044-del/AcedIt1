/**
 * studyScore — where a target study score actually sits in the state.
 *
 * ─── The one number a VCE student cares about, and never sees drawn ─────────
 * `user_subjects.goal_study_score` has existed since migration 0002. Analytics
 * reads it and the AI performance analyser reads it — and NOTHING in the app
 * has ever set it, so it is null for every student on the site. Two consumers,
 * no input. This file is the maths behind giving it one.
 *
 * ─── What is actually known, and what is not ────────────────────────────────
 * VCAA constructs the RAW study score for every study to a mean of 30 and a
 * standard deviation of 7, on a 0–50 scale. That is a construction, not a
 * measurement, which is exactly why it can be drawn: it is the same curve for
 * every subject in the state and it is not an estimate of anything.
 *
 * What is NOT known is a per-subject spread, and the catalogue's
 * `mean_study_score` (26.4 to 41.5 across the 33 subjects that carry it) is
 * NOT the raw mean — it is the SCALED mean, the number VTAC turns the raw one
 * into for the ATAR. The catalogue says as much in its own words: "A raw 30
 * scales to 35." Plotting 34.4 on a raw-score curve would put Methods' average
 * student at the 73rd percentile of their own cohort, which is not a rounding
 * error, it is a different claim. So the curve is the raw distribution and the
 * per-subject fact is reported beside it as scaling, which is what it is.
 *
 * The normal is an approximation at the ends — real scores are capped at 0 and
 * 50, so the true distribution is truncated and slightly lumpy up near 50.
 * Everything here clamps rather than pretending otherwise.
 */

export const SCORE_MIN = 0;
export const SCORE_MAX = 50;

/** VCAA's construction. Same for every study in the state. */
export const STATE_MEAN = 30;
export const STATE_SD = 7;

export const clampScore = (n) =>
    Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(Number(n) || 0)));

/**
 * Abramowitz & Stegun 7.1.26. Max error 1.5e-7, which is six digits more than
 * a percentile printed to one decimal place needs — and it is a dozen lines
 * against a dependency, on a page that already ships 1.4MB.
 */
function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * z);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
        - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return sign * y;
}

/** Relative height of the curve at `x`. Unnormalised — this only ever draws. */
export const density = (x) =>
    Math.exp(-((x - STATE_MEAN) ** 2) / (2 * STATE_SD * STATE_SD));

/** Share of the state at or below `score`, 0–1. */
export const cdf = (score) =>
    0.5 * (1 + erf((score - STATE_MEAN) / (STATE_SD * Math.SQRT2)));

/** Percentage of the state you would be ahead of at this score. */
export const percentileFor = (score) => cdf(clampScore(score)) * 100;

/** Percentage of the state at or above this score — the "top X%" figure. */
export const topPercentFor = (score) => 100 - percentileFor(score);

/**
 * "top 2%" / "top 14%".
 *
 * One decimal below 10, whole numbers above it. A student aiming at 45 is not
 * helped by "top 1.604%" — the normal is an approximation up there anyway, and
 * four significant figures on an approximation is a lie about precision.
 *
 * There is no lower guard because the scale cannot reach one: 50 is 2.86
 * standard deviations out, which is 0.2%, so nothing on this scale rounds to
 * zero.
 */
export function topPercentLabel(score) {
    const p = topPercentFor(score);
    return p < 10 ? `top ${p.toFixed(1)}%` : `top ${Math.round(p)}%`;
}

/**
 * Points along the curve, as `{ score, height }` with height 0–1.
 *
 * Returned as data rather than as an SVG path so the shape can be tested
 * without a renderer, and so the component owns its own geometry.
 */
export function curvePoints(samples = 60) {
    const n = Math.max(2, Math.round(samples));
    const out = [];
    for (let i = 0; i < n; i += 1) {
        const score = SCORE_MIN + ((SCORE_MAX - SCORE_MIN) * i) / (n - 1);
        out.push({ score, height: density(score) });
    }
    return out;
}

// ─── Scaling: the per-subject half ──────────────────────────────────────────

/** "+5" → 5, "-3" → -3. "+N" is a placeholder in the catalogue and is not one. */
export function scalingOffset(fullSubject) {
    const raw = fullSubject?.scaling_info?.scaling_factor;
    const m = /^([+-])(\d+)$/.exec(String(raw || "").trim());
    if (!m) return null;
    return (m[1] === "-" ? -1 : 1) * Number(m[2]);
}

/**
 * What a raw score is worth after VTAC scaling — approximately, and it says so.
 *
 * The catalogue gives ONE point on the scaling curve ("a raw 30 scales to 35"),
 * and real scaling is not a flat offset: it has to compress toward the top,
 * because 50 is the ceiling on both sides and a raw 50 cannot scale to 55. So
 * the offset is tapered by how far the score sits from that ceiling — exact at
 * 30, where the catalogue's number actually applies, and closing to nothing at
 * 50. Downward scaling tapers the same way so a raw 50 is not pulled under the
 * cap by a subject that scales down.
 *
 * This is an ESTIMATE off one anchor point and every caller labels it as one.
 * The alternative is applying the offset flat, which would have a raw 48 in
 * Further Maths scaling to 53.
 */
export function scaledScore(raw, fullSubject) {
    const offset = scalingOffset(fullSubject);
    if (offset == null) return null;
    const score = clampScore(raw);
    const taper = (SCORE_MAX - score) / (SCORE_MAX - STATE_MEAN);
    return clampScore(score + offset * Math.max(0, taper));
}

// ─── Colour order ───────────────────────────────────────────────────────────

/**
 * A hex colour's position on the colour wheel, 0–360, for sorting a shelf into
 * a spectrum.
 *
 * Greys sort LAST and together. A subject with no colour set carries the
 * default `#6B7280`, whose hue is a meaningless artefact of a near-neutral
 * mix — sorting it into the blues would scatter every uncoloured subject
 * through the spectrum at a position nothing chose. Saturation under the
 * threshold is treated as "no colour" and parked at the end.
 */
export function hueOf(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return 400;
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    // Saturation on the HSL definition, so a dark colour is not called grey
    // just for being dark.
    const l = (max + min) / 2;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (sat < 0.15) return 400;

    let h;
    if (d === 0) h = 0;
    else if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    return (h + 360) % 360;
}
