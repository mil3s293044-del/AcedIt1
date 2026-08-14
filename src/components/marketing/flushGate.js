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

/** How long the curtain owns the screen, exit included. */
export const FLUSH_MS = 1700;
export const FLUSH_EXIT_MS = 460;
