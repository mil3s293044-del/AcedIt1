/**
 * zoom — turning a wheel event into a zoom factor.
 *
 * ─── Why the old one felt uncontrollable ────────────────────────────────────
 * It read only the SIGN of deltaY and applied a fixed 12% step:
 *
 *     zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, …)
 *
 * A mouse wheel fires a few events per gesture with large deltas, so one notch
 * meant one 12% step and that felt right. A trackpad fires twenty or thirty
 * events per flick, each carrying a couple of pixels — and every one of them
 * was also worth 12%. A single two-finger swipe came to 1.12^25, which is over
 * seventeen times, so the map leapt from readable to a single node or to a
 * speck, with nothing usable in between.
 *
 * ─── What it does now ───────────────────────────────────────────────────────
 * The factor comes from HOW FAR the wheel moved, normalised across the three
 * deltaMode units browsers report in. Exponential rather than linear, which
 * gives two properties worth having: zoom feels the same at every scale, and
 * scrolling back by the same distance lands exactly where you started, because
 * exp(-d) * exp(d) is 1 rather than approximately 1.
 *
 * Trackpad and mouse now agree — the same physical distance produces the same
 * zoom whichever device reported it.
 */

/** deltaMode 1 is lines, 2 is pages. Browsers pick, callers shouldn't care. */
export const PIXELS_PER_LINE = 16;
export const PIXELS_PER_PAGE = 400;

/** A 100px mouse notch lands near 1.16, close to the old fixed 1.12 step. */
export const ZOOM_PER_PIXEL = 0.0015;

/**
 * Pinch is reported as ctrl+wheel, with much smaller deltas than a scroll for
 * the same finger movement, so it needs its own gain or a pinch does nothing.
 */
export const PINCH_PER_PIXEL = 0.006;

/** No single event may zoom more than this, whatever a device claims to send. */
export const MAX_STEP = 1.35;

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/** Wheel movement in pixels, whichever unit the browser reported it in. */
export function wheelPixels(e) {
    const delta = Number(e?.deltaY) || 0;
    const mode = e?.deltaMode ?? 0;
    if (mode === 1) return delta * PIXELS_PER_LINE;
    if (mode === 2) return delta * PIXELS_PER_PAGE;
    return delta;
}

/**
 * Zoom factor for one wheel event. Above 1 zooms in, below 1 zooms out.
 *
 * Scrolling up (negative deltaY) zooms in, matching every map and every
 * document viewer.
 */
export function wheelZoomFactor(e) {
    const px = wheelPixels(e);
    if (px === 0) return 1;   // some browsers emit empty wheel events
    const gain = e?.ctrlKey ? PINCH_PER_PIXEL : ZOOM_PER_PIXEL;
    return clamp(Math.exp(-px * gain), 1 / MAX_STEP, MAX_STEP);
}
