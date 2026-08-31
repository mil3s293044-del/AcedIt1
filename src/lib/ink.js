/**
 * ink — the geometry behind the handwriting pad.
 *
 * Kept apart from the component because all of it is arithmetic, and the two
 * pieces that are easy to get wrong are exactly the ones a component test
 * cannot reach: what counts as a blank pad, and what rectangle to crop to
 * before handing the image to a model.
 *
 * ─── Why the pad is one line at a time ──────────────────────────────────────
 * The obvious build is one big canvas you fill with working. It is also the
 * one that fails: handwriting sprawls, students write over their own lines,
 * and by the fourth step of a derivation the pad is a mess that neither they
 * nor a model can read. So a line is written, recognised, and LIFTED off the
 * pad into a typeset stack above it, and the pad clears for the next one. The
 * page stays readable because nothing accumulates on the writing surface.
 */

/** Below this many points a stroke is a tap, not a mark. */
const MIN_STROKE_POINTS = 2;
/** Below this total ink length (px) the pad is a smudge, not an answer. */
const MIN_INK_LENGTH = 24;

/** A point, rounded — sub-pixel precision is noise in a saved answer. */
const pt = (x, y) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10];

export const newStroke = (x, y) => [pt(x, y)];

/**
 * Add a point, dropping ones too close to the last to matter. A pointer
 * emitting 240 events a second otherwise stores several thousand points for a
 * single digit, and every one of them is written to the database.
 */
export function addPoint(stroke, x, y, minGap = 1.6) {
    if (!Array.isArray(stroke) || stroke.length === 0) return newStroke(x, y);
    const [lx, ly] = stroke[stroke.length - 1];
    if (Math.hypot(x - lx, y - ly) < minGap) return stroke;
    return [...stroke, pt(x, y)];
}

/** Total length of ink laid down, in px. */
export function inkLength(strokes) {
    let total = 0;
    for (const s of strokes || []) {
        if (!Array.isArray(s)) continue;
        for (let i = 1; i < s.length; i += 1) {
            total += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        }
    }
    return total;
}

/**
 * Is there anything here worth sending?
 *
 * A stray tap while scrolling should never cost a model call, and an empty pad
 * recognised as an empty string would clear itself and look broken.
 */
export function isBlank(strokes) {
    const real = (strokes || []).filter((s) => Array.isArray(s) && s.length >= MIN_STROKE_POINTS);
    if (real.length === 0) return true;
    return inkLength(real) < MIN_INK_LENGTH;
}

/**
 * The box the writing actually occupies, padded.
 *
 * Cropping to this before rasterising matters more than it looks: a 900x200
 * pad holding one small "x = 4" hands the model an image that is mostly empty
 * white, and recognition gets worse the smaller the writing is within the
 * frame. Returns null when there is nothing to crop to.
 */
export function inkBounds(strokes, pad = 16) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes || []) {
        if (!Array.isArray(s)) continue;
        for (const p of s) {
            if (!Array.isArray(p)) continue;
            const [x, y] = p;
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (!Number.isFinite(minX)) return null;
    return {
        x: minX - pad,
        y: minY - pad,
        width: (maxX - minX) + pad * 2,
        height: (maxY - minY) + pad * 2,
    };
}

/**
 * A stroke as a smooth SVG path.
 *
 * Quadratic segments through the midpoints of consecutive samples, which is
 * the cheapest smoothing that stops a fast stroke rendering as visible
 * straight-line facets. A single point becomes a dot, so a full stop is
 * something you can actually write.
 */
export function strokePath(stroke) {
    const s = (stroke || []).filter((p) => Array.isArray(p) && p.length === 2);
    if (s.length === 0) return "";
    if (s.length === 1) return `M ${s[0][0]} ${s[0][1]} l 0.1 0`;
    let d = `M ${s[0][0]} ${s[0][1]}`;
    for (let i = 1; i < s.length - 1; i += 1) {
        const [x, y] = s[i];
        const [nx, ny] = s[i + 1];
        d += ` Q ${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
    }
    const last = s[s.length - 1];
    d += ` L ${last[0]} ${last[1]}`;
    return d;
}

/** Points dropped for storage — a saved answer does not need 1.6px fidelity. */
export function compact(strokes, precision = 0) {
    const f = 10 ** precision;
    return (strokes || [])
        .filter((s) => Array.isArray(s) && s.length >= MIN_STROKE_POINTS)
        .map((s) => s.map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f]));
}

export const INK_LIMITS = { MIN_STROKE_POINTS, MIN_INK_LENGTH };
