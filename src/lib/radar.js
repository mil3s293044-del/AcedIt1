/**
 * radar — where a due thing sits on a screen, given when it is due.
 *
 * THE METAPHOR IS NOT DECORATION. Time until due IS a distance, so a radar is
 * not a skin over a list: the geometry carries the fact. The panel was called
 * "On your radar" and drew a stack of rows with pink pills, which is the word
 * doing all the work and none of the picture.
 *
 * THE SCALE IS DELIBERATELY NOT LINEAR. A square root pushes the near term
 * outward, so the difference between today and three days away takes more of
 * the dial than the difference between ten days and fourteen. That matches how
 * much those two differences actually matter to somebody deciding what to do
 * this afternoon, and it stops everything urgent piling into one bright dot at
 * the centre.
 *
 * BEARING IS HASHED FROM THE SUBJECT, and stably, which is the detail that
 * makes the thing worth looking at twice: Chemistry is at the same bearing
 * tomorrow as it is today. Over a term you stop reading the labels and start
 * recognising the shape of your own week. Sorting by due date instead would
 * make the whole dial rearrange itself every time one deck came due.
 */

/** Beyond this, something is not on the radar. Also the outer ring. */
export const HORIZON_DAYS = 14;

/** Overdue and due-now live inside this, in the middle of the dial. */
export const CORE_R = 26;
export const EDGE_R = 96;

const TAU = Math.PI * 2;

/** Same FNV walk cardIdentity uses, so a subject's bearing is as stable as its suit. */
function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

/** Degrees clockwise from twelve o'clock. Stable for the life of the subject. */
export function bearingOf(subject) {
    return hash(String(subject || "?")) % 360;
}

/**
 * Days until due → distance from the centre.
 *
 * Anything overdue or due today sits INSIDE the core ring rather than on it,
 * because "you are late" is a different state from "this is close" and the
 * dial should not make them look like neighbours.
 */
export function radiusOf(days) {
    const d = Number(days);
    if (!Number.isFinite(d) || d <= 0) return CORE_R * 0.62;
    const t = Math.min(1, d / HORIZON_DAYS);
    return CORE_R + (EDGE_R - CORE_R) * Math.sqrt(t);
}

/**
 * A pile's blip size.
 *
 * Square-rooted so a 240-card deck reads as bigger than a 3-card one without
 * being eighty times the area, which would be a blot with a dot next to it.
 */
export function blipSize(count) {
    const n = Math.max(1, Number(count) || 1);
    return Math.round(Math.min(18, 7 + Math.sqrt(n) * 1.1));
}

/**
 * Everything a blip needs, in percentages of the dial box.
 *
 * Percent rather than pixels so the same numbers drive the SVG grid and the
 * HTML links laid over it, at whatever size the panel ends up.
 */
export function plotRadar(items = []) {
    const plotted = items.map((item) => {
        const deg = bearingOf(item.subject || item.title);
        const r = radiusOf(item.days);
        return { item, deg, r };
    });

    /**
     * SEPARATE ANYTHING SITTING ON TOP OF SOMETHING ELSE.
     *
     * Bearing comes from the subject and radius from the due date, so blips
     * collide in two different ways and only one of them is exact. Two decks
     * for the same subject due the same day land on identical coordinates; two
     * DIFFERENT subjects whose hashes happen to fall a few degrees apart land
     * three pixels apart, which is just as unclickable and which grouping by
     * key cannot see at all. The first version of this only fixed the exact
     * case and the dial still had blips hiding behind blips.
     *
     * So it is positional and iterative: measure the real distance between
     * every pair, and push any that are too close apart along their bearings.
     * A handful of passes settles it. Radius is never touched, because radius
     * is the fact being reported — only the bearing gives, and it only has to
     * be stable, not exact.
     *
     * N is the number of things due inside a fortnight, so the pairwise loop
     * is a few dozen comparisons at worst.
     */
    const MIN_GAP = 13;
    const at = (p) => {
        const rad = ((p.deg - 90) * Math.PI) / 180;
        return [Math.cos(rad) * p.r, Math.sin(rad) * p.r];
    };
    for (let pass = 0; pass < 12; pass += 1) {
        let moved = false;
        for (let i = 0; i < plotted.length; i += 1) {
            for (let j = i + 1; j < plotted.length; j += 1) {
                const a = plotted[i];
                const b = plotted[j];
                const [ax, ay] = at(a);
                const [bx, by] = at(b);
                const d = Math.hypot(ax - bx, ay - by);
                if (d >= MIN_GAP) continue;
                // Convert the shortfall into an angle at each blip's own
                // radius, so the same nudge separates a pair at the centre as
                // far as it separates a pair at the rim.
                const need = (MIN_GAP - d) / 2 + 0.5;
                const degA = (need / Math.max(1, a.r)) * (180 / Math.PI);
                const degB = (need / Math.max(1, b.r)) * (180 / Math.PI);
                // Deterministic direction: the one with the lower bearing goes
                // anticlockwise. Identical bearings get split by index, or the
                // pair would push each other by zero forever.
                const sign = a.deg === b.deg ? (i < j ? -1 : 1) : (a.deg < b.deg ? -1 : 1);
                a.deg += sign * degA;
                b.deg -= sign * degB;
                moved = true;
            }
        }
        if (!moved) break;
    }

    return plotted.map(({ item, deg, r }) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return {
            ...item,
            deg,
            r,
            size: blipSize(item.count),
            overdue: Number(item.days) <= 0,
            // 100,100 is the centre of a 200-box; /2 converts to percent.
            left: (100 + Math.cos(rad) * r) / 2,
            top: (100 + Math.sin(rad) * r) / 2,
        };
    });
}

/**
 * When the sweep reaches a given bearing, as a fraction of one revolution.
 *
 * This is what lets every blip flare in time with the sweep WITHOUT a frame
 * loop: the flare is a CSS animation whose period matches the sweep's, delayed
 * by the fraction below. Nothing measures the sweep's position at runtime, so
 * the whole dial costs one compositor-driven rotation and N cheap keyframes,
 * on a page people scroll.
 */
export function flareDelay(deg, sweepMs) {
    return (((deg % 360) + 360) % 360) / 360 * sweepMs;
}

export { TAU };
