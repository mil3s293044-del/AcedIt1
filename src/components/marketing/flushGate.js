/**
 * One decision, made once, that both the curtain and the hero hand read.
 *
 * The opening flush covers the screen for two seconds. The hero hand deals
 * itself shortly after mount. Left to their own timers those two overlap, and
 * the best moment on the page happens behind an opaque sheet: you lift the
 * curtain on a hand that is already lying there, which is the one thing the
 * animation exists to avoid.
 *
 * They cannot each ask sessionStorage themselves, because ASKING IS ALSO
 * ANSWERING. Whichever component's effect ran first would set the flag, and
 * the second would read "already seen" and skip. So the read and the write
 * happen exactly once, here, in a module body, which runs at import time
 * before any component effect on the page.
 *
 * Reduced motion is deliberately NOT handled here. Both components resolve it
 * from the same hook and reach the same answer, and folding it in would mean
 * this module needed a React context to see it.
 */
const KEY = "acedit:flush-seen";

let seen = true;
try {
    seen = sessionStorage.getItem(KEY) === "1";
    sessionStorage.setItem(KEY, "1");
} catch {
    // Private mode, or storage disabled. Treat it as already seen: a curtain
    // that replays on every navigation is far worse than one nobody sees.
}

/** True when the curtain has already run this session, so it must not again. */
export const FLUSH_SEEN = seen;

/**
 * The event the curtain fires when it is actually gone, whether it ran to the
 * end or was skipped.
 *
 * This replaces a pair of duration constants that DealtHand used to predict
 * when the curtain would lift. Predicting it meant two files had to agree
 * about the length of an animation only one of them owned, and they drifted
 * the moment the storm was made longer: the hand dealt at 3.4s behind a
 * curtain that lifted at 5.1s, so it was already lying on the table when the
 * page appeared. The deal is the best moment on the page and nobody ever saw
 * it happen.
 */
export const STORM_DONE = "acedit:storm-done";

/** Ceiling for waiting on that event, in case the curtain never mounted. */
export const STORM_MAX_MS = 7000;
