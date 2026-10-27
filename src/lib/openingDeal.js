/**
 * openingDeal — the arithmetic of the landing's opening: when each beat lands,
 * where every card goes, and the one flight that has to end on a pixel.
 *
 * It is a module of its own because every mistake in it renders perfectly.
 * An ace that lands three pixels beside the logo is still a pretty animation,
 * an iris that stops short of the far corner leaves a navy sliver nobody can
 * click through, and a riffle that drops a card is just six cards. So the
 * component draws and this decides, and `openingDeal.test.mjs` runs it.
 *
 * Plain and relative: nothing here touches the DOM.
 */

/** How many cards are in the deck. Enough to riffle, few enough to read. */
export const DECK = 7;

/**
 * The beats, in ms from mount. About two and a half seconds when the page is
 * ready, which is what was asked for: long enough to be a moment, short
 * enough that nobody is waiting on it.
 *
 *   ARRIVE   the deck rises in, Ace beside it
 *   SPLIT    the deck parts into two halves
 *   RIFFLE   the halves fall back in, one card from each side in turn
 *   FAN      the deck spreads into a hand
 *   TURN     the middle card lifts and turns over: the ace of spades
 *   (hold)   only if the page under it is not ready yet
 *   OPEN     the ace flies into the logo while the ground opens onto the page
 */
export const BEATS = Object.freeze({
    ARRIVE: 350,
    SPLIT: 560,
    RIFFLE: 900,
    FAN: 1300,
    TURN: 1750,
});

/** How long the ground takes to open, and the ace to reach the logo. */
export const OPEN_MS = 750;
export const FLIGHT_MS = 700;

/**
 * The card stock fades only once the ace is small and most of the way there.
 * Faded from the first frame it went grey over the navy and then ghostly over
 * the page opening behind it — the pip is what should be left, not a smear.
 */
export const STOCK_FADE_DELAY_MS = 380;
export const STOCK_FADE_MS = 260;

/** When the real logo glyph takes over: after the ace has landed on it. */
export const LOGO_SWAP_MS = OPEN_MS - 40;

/** When the hero hand is told to deal: early in the opening, so it is moving as the iris reaches it. */
export const ANNOUNCE_MS = 180;

/** A flick of the wrist on the way, upright again before it lands. */
export const FLICK = Object.freeze([0, -9, 0]);

/**
 * The latest the opening waits for the page before opening anyway, from
 * mount. The hero hand will not wait past `OPENING_MAX_MS` for the signal, so
 * this has to come first or the hand deals behind a curtain.
 */
export const HOLD_MAX_MS = 5200;

/** How long a skip takes to clear the screen. */
export const SKIP_MS = 300;

/** The fan's half-angle step, degrees per card from the middle. */
export const FAN_STEP = 8.5;

/** How far the ace lifts out of the fan and how big it gets, as a share of the card. */
export const LIFT_Y = -0.42;
export const LIFT_SCALE = 1.28;

/**
 * The big centred pip on an ace is a third of the card's width — PipFace's
 * `w-[34%] h-[34%]`, inside the card's 1px border. The flight scales the card
 * so THAT box becomes the logo's glyph, which is the whole trick: the pip the
 * visitor watched turn over is the mark they land on.
 */
export const PIP_SHARE = 0.34;
export const CARD_BORDER = 1;

/** The middle card. It is the one that turns over. */
export const ACE_INDEX = Math.floor(DECK / 2);

/**
 * The resting deck: each card a hair up and right of the one under it, with
 * a fixed jitter so it reads as a real stack rather than as a single slab.
 * Percentages of the card, so the deck is the same shape at every size.
 */
export function stackOf(n = DECK) {
    const jitter = [-1.2, 0.8, -0.4, 1.4, -0.9, 0.5, -0.2, 1.0, -1.1];
    return Array.from({ length: n }, (_, i) => ({
        x: (i - (n - 1) / 2) * 0.6,
        y: -i * 1.1,
        rotate: jitter[i % jitter.length],
    }));
}

/**
 * The riffle. The deck is CUT — the top half goes left, the bottom half goes
 * right — and the halves fall back ALTERNATING, one card from each side,
 * which is what a riffle is. `order` is the position each card returns at
 * (0 first), so a card that returns later lands on top, and it is also the
 * card's place in the hand that follows.
 *
 * Cut, not dealt odd/even: interleaving the even cards with the odd ones puts
 * every card straight back where it was, and the shuffle shuffles nothing.
 */
export function riffleOf(n = DECK) {
    const cut = Math.ceil(n / 2);
    const left = [], right = [];
    for (let i = 0; i < n; i++) (i < cut ? left : right).push(i);
    const seq = [];
    for (let k = 0; k < Math.max(left.length, right.length); k++) {
        if (k < left.length) seq.push(left[k]);
        if (k < right.length) seq.push(right[k]);
    }
    const order = new Array(n);
    seq.forEach((card, pos) => { order[card] = pos; });
    return Array.from({ length: n }, (_, i) => ({
        side: i < cut ? -1 : 1,
        order: order[i],
    }));
}

/** The return stagger, in seconds per card. */
export const RIFFLE_STAGGER = 0.04;

/** A card's angle in the fan, degrees. The middle card is upright. */
export function fanAngle(i, n = DECK, step = FAN_STEP) {
    return (i - (n - 1) / 2) * step;
}

/**
 * Where the cards that are NOT the ace go when it lifts: they fold away from
 * the outside in, so the hand closes toward the card that was chosen.
 */
export function foldDelay(i, n = DECK) {
    const mid = (n - 1) / 2;
    return (mid - Math.abs(i - mid)) * 0.04;
}

/**
 * The flight from the turned ace to the logo.
 *
 * The ace is nested: the card carries its own lift (a translate and
 * `LIFT_SCALE`), and the flight is a WRAPPER around it that scales about
 * `origin`, the centre of the deck's box. So the wrapper's transform maps a
 * point p to `origin + t + s·(p − origin)`, and this solves for the t and s
 * that put the card's centre on the logo glyph's centre with the pip exactly
 * the glyph's width.
 *
 * `card` is the card's on-screen rect, lift included. `target` is the glyph's
 * rect. Null when there is nothing to land on, and the ace simply goes out
 * where it is.
 */
export function flightTo(card, origin, target, scale = LIFT_SCALE) {
    if (!card || !origin || !target) return null;
    if (!(card.width > 0) || !(target.width > 0) || !(scale > 0)) return null;
    const layoutW = card.width / scale;
    const pip = PIP_SHARE * (layoutW - 2 * CARD_BORDER);
    if (!(pip > 0)) return null;
    const s = target.width / pip / scale;
    const cx = card.left + card.width / 2, cy = card.top + card.height / 2;
    const gx = target.left + target.width / 2, gy = target.top + target.height / 2;
    return {
        x: gx - origin.x - s * (cx - origin.x),
        y: gy - origin.y - s * (cy - origin.y),
        scale: s,
    };
}

/**
 * How far the opening has to grow to clear the screen from a point: the
 * farthest corner, plus the soft edge, or a sliver of navy is left in it.
 */
export const IRIS_EDGE = 12;
export function irisRadius(x, y, w, h) {
    const far = Math.max(
        Math.hypot(x, y), Math.hypot(w - x, y),
        Math.hypot(x, h - y), Math.hypot(w - x, h - y),
    );
    return Math.ceil(far + IRIS_EDGE + 2);
}

/**
 * Whether a logo glyph is somewhere the ace can land: on screen and drawn.
 * A rect of `{ width, height, top, left, right, bottom }`.
 */
export function landable(rect, vw, vh) {
    if (!rect) return false;
    if (!(rect.width > 0 && rect.height > 0)) return false;
    return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
}

/**
 * What the hold does on each check: open, keep waiting, or stop because the
 * opening has been skipped. "turn" counts as holding — the first check runs
 * in the same tick that sets the phase to "hold", while the state still reads
 * "turn", and treating that as "stop" held on the ace forever.
 */
export function holdStep({ phase, ready, elapsed }) {
    if (phase !== "hold" && phase !== "turn") return "stop";
    if (ready || elapsed >= HOLD_MAX_MS) return "open";
    return "wait";
}

/**
 * Whether the opening plays at all. The marketing entry only, once a session,
 * never under reduced motion — the same three tests the boot layer in
 * index.html makes, so the two can never disagree about whether a curtain is
 * up.
 */
export function opensOn({ pathname, seen, reduce }) {
    return !reduce && !seen && pathname === "/";
}
