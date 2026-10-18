/**
 * boardKit — the rules every leaderboard in the app draws by.
 *
 * There were three boards and they disagreed about nearly everything that is
 * not a number: Ranked's podium was three tinted cards and its gap scale was
 * the upper median of every gap, ties included; the League's podium was three
 * coloured blocks and its scale was the true median of the gaps that were not
 * ties, floored at one; the study-group week had no podium and no gap at all.
 * Three answers to "how far apart are these people", on three screens a
 * student moves between in one sitting.
 *
 * So one kit, and this is its arithmetic. The drawing is
 * `src/components/boards/`; everything here is pure so a test can hold it.
 *
 * ─── A CARD TOURNAMENT ──────────────────────────────────────────────────────
 * The top three are dealt onto a felt table and turned over: the Ace of spades
 * for first, the King for second, the Queen for third. That is the app's own
 * vocabulary — rank is how strong a thing is, and an Ace is always earned,
 * never given — so first place is the one card in the deck that means it.
 *
 * ─── PREMIUM BUT CALM ───────────────────────────────────────────────────────
 * Things move when they ARRIVE and when they CHANGE, and then they hold still.
 * The only thing that keeps moving is a slow sheen across the Ace, because the
 * leader is the one fact on the board worth a glance every few seconds. Under
 * reduced motion nothing moves at all and every figure is printed whole.
 */

/** The card each podium place holds. Nobody below third holds one. */
export const PODIUM_RANKS = { 1: "A", 2: "K", 3: "Q" };

/** How many places the table seats. */
export const PODIUM_SIZE = 3;

/**
 * The podium, left to right: second, first, third. `items-end` on the grid is
 * what makes three columns read as a podium, and the winner stands in the
 * middle. A place nobody holds is still a seat — `entry: null` draws an
 * unclaimed card face down rather than collapsing the staircase.
 */
export function podiumSeats(entries = []) {
    return [2, 1, 3].map((place) => ({ place, entry: entries[place - 1] || null }));
}

/**
 * THE DEAL, in seconds. Third is dealt first and first is turned over last,
 * because the reveal is a countdown — the whole point is that the Ace lands
 * after everybody has seen what the other two places went for.
 *
 *   rise   the plinths come up out of the table edge together
 *   deal   each card lands face down on its plinth
 *   turn   each card turns over, a beat after it lands
 *   seat   the person's medallion and figure arrive once their card is up
 *   sheen  the light starts across the Ace once it is face up
 */
export const DEAL = {
    rise: 0.45,
    dealAt: { 3: 0.2, 2: 0.36, 1: 0.52 },
    turnAt: { 3: 0.7, 2: 0.92, 1: 1.18 },
    turn: 0.55,
};

export const dealAt = (place) => DEAL.dealAt[place] ?? DEAL.dealAt[3];
export const turnAt = (place) => DEAL.turnAt[place] ?? DEAL.turnAt[3];
/** When a seat's medallion, name and figure arrive: as its card finishes turning. */
export const seatAt = (place) => +(turnAt(place) + DEAL.turn * 0.7).toFixed(2);
/** When the Ace's sheen starts, in seconds — once the Ace is face up. */
export const SHEEN_AT = +(turnAt(1) + DEAL.turn).toFixed(2);
/** The whole reveal, in milliseconds. After it the podium is "arrived". */
export const REVEAL_MS = Math.round((seatAt(1) + 0.9) * 1000);

/**
 * Rows arrive together with the podium rather than after it — a student
 * waiting two seconds for the list under a card trick is being made to watch
 * an animation instead of reading a board. A short stagger, capped, so the
 * thirtieth row is not still arriving half a second after the first.
 */
export const ROW_STAGGER = 0.035;
export const ROW_STAGGER_MAX = 0.42;
export function rowDelay(index) {
    const i = Math.max(0, Number(index) || 0);
    return Math.min(ROW_STAGGER_MAX, +(i * ROW_STAGGER).toFixed(3));
}

/* ── The gaps ─────────────────────────────────────────────────────────────── */

/**
 * Each row's gap to the row above it; null for the first, which has nobody
 * above, and null beside a missing figure. A gap is never negative — a list arriving unsorted must not draw a
 * row as being AHEAD of the one above it.
 */
export function gapsOf(values = []) {
    return values.map((v, i) => {
        if (i === 0) return null;
        // `Number(null)` is 0, which would draw a missing figure as a row
        // sitting a whole score behind the one above it.
        if (v == null || values[i - 1] == null) return null;
        const above = Number(values[i - 1]);
        const mine = Number(v);
        if (!Number.isFinite(above) || !Number.isFinite(mine)) return null;
        return Math.max(0, above - mine);
    });
}

/**
 * THE SCALE IS TWICE THE MEDIAN GAP, OF THE GAPS THAT ARE GAPS.
 *
 * Twice the median rather than the largest, because one student sitting a
 * long way clear would otherwise set the scale for everybody and every gap
 * people could actually close would draw as two invisible pixels. Past twice
 * the median a bar simply fills and the row is "far"; the number beside it
 * says how far.
 *
 * TIES ARE LEFT OUT OF THE MEDIAN. A tie is not a measure of how the board is
 * spaced, and on a board with a lot of them (the ATAR, where the curve steps
 * in 0.05s) counting them dragged the median toward nothing and drew every
 * real gap as full — which is a board saying everybody is far from everybody.
 * Ranked counted them and the League did not; this is the League's answer.
 *
 * With no real gap at all — everybody level — there is no scale, and that is
 * reported as 0 rather than invented.
 */
export function gapScale(gaps = []) {
    const real = gaps.filter((g) => typeof g === "number" && Number.isFinite(g) && g > 0)
        .sort((a, b) => a - b);
    if (!real.length) return 0;
    const mid = Math.floor(real.length / 2);
    const median = real.length % 2 ? real[mid] : (real[mid - 1] + real[mid]) / 2;
    return median * 2;
}

/** The floor a bar is drawn at, so a tie reads as "level with them". */
export const GAP_FLOOR = 4;

/**
 * A gap as a bar length, in percent. Null when there is no gap to draw (the
 * first row). A tie draws at the floor rather than as nothing — "level" and
 * "nothing to compare" are different facts. `Number(null)` is 0, which would
 * draw a missing gap as a tie, so null is checked before anything is coerced.
 */
export function gapPct(gap, scale) {
    if (gap == null) return null;
    const g = Number(gap);
    if (!Number.isFinite(g)) return null;
    if (!(scale > 0) || g <= 0) return GAP_FLOOR;
    return Math.max(GAP_FLOOR, Math.min(100, (g / scale) * 100));
}

/* ── Live numbers ─────────────────────────────────────────────────────────── */

/**
 * The value a counting figure shows mid-count. An integer target counts in
 * integers, so "18,439 XP" never passes through "18,438.62"; anything else is
 * left to the caller's formatter, which is what prints the ATAR to two places.
 * The LAST frame is always the target itself, never a rounded neighbour.
 */
export function countFrame(shown, target) {
    if (target == null) return target;
    const t = Number(target);
    const s = Number(shown);
    if (!Number.isFinite(t)) return target;
    if (!Number.isFinite(s)) return t;
    return Number.isInteger(t) ? Math.round(s) : s;
}

/**
 * Which way a figure moved, for the moment after it changes. An increase is
 * worth a flash of the brand green; a decrease is printed and left alone — a
 * board that turns a number red when somebody else studied is editorialising.
 */
export function figureChange(prev, next) {
    const a = Number(prev);
    const b = Number(next);
    if (prev == null || next == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (b > a) return "up";
    if (b < a) return "down";
    return null;
}

/* ── Your row follows you ─────────────────────────────────────────────────── */

/**
 * Where your docked row goes when your real row leaves the screen: the edge
 * it left by. Scroll down past yourself and your row holds on at the TOP of
 * the screen; open a long board from the podium and it waits at the BOTTOM.
 * One rule, and it is the one every league table with a pinned row keeps.
 *
 * Null while the row is on screen, because a docked copy of a row already in
 * front of somebody is a second, smaller answer to the same question.
 */
export function dockSide({ visible, rowTop, viewTop = 0 } = {}) {
    if (visible) return null;
    const top = Number(rowTop);
    if (!Number.isFinite(top)) return null;
    return top < Number(viewTop || 0) ? "top" : "bottom";
}

export default {
    PODIUM_RANKS, PODIUM_SIZE, podiumSeats, DEAL, dealAt, turnAt, seatAt, SHEEN_AT, REVEAL_MS,
    ROW_STAGGER, ROW_STAGGER_MAX, rowDelay, gapsOf, gapScale, GAP_FLOOR, gapPct,
    countFrame, figureChange, dockSide,
};
