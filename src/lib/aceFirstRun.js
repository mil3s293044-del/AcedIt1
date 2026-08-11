/**
 * aceFirstRun — what Ace has already said, and whether he's allowed to speak.
 *
 * A first-run introduction is the only moment explaining a page costs the
 * student nothing: they're standing on it, they haven't formed a plan yet, and
 * three sentences land. Miss it and the same three sentences are an
 * interruption.
 *
 * Which is exactly why this file is mostly restraint. The failure mode of
 * every product tour ever built is that it fires everywhere at once, so the
 * student learns within about ninety seconds that the correct response to this
 * app talking to them is to close it. Once they've learned that, nothing you
 * put in front of them again will be read.
 *
 * So: at most one introduction per page ever, at most one per visit to the
 * app, and a gap between them. Dismissing one counts as seeing it. Dismissing
 * three in a row without opening any of them turns the whole thing off, on the
 * grounds that they've told us clearly enough.
 *
 * Kept in localStorage rather than the database on purpose. It needs to be
 * readable synchronously on mount — an introduction that appears half a second
 * after the page has settled is a popup — and being per-device is the right
 * behaviour anyway: a page you've never seen on your phone is a page you've
 * never seen.
 */

const KEY = "acedit_ace_firstrun_v1";
/** Long enough that two introductions can't land in the same sitting. */
export const QUIET_MS = 90_000;
/** Three closed without a single one opened is an answer. */
export const GIVE_UP_AFTER = 3;

const blank = () => ({ seen: {}, lastAt: 0, dismissed: 0, engaged: 0, off: false });

export function readState() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && typeof raw === "object") return { ...blank(), ...raw, seen: { ...raw.seen } };
    } catch { /* first run, or private mode */ }
    return blank();
}

function write(next) {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
}

/**
 * Should Ace introduce this page right now?
 *
 * `now` is a parameter so this is testable without waiting a minute and a half
 * for a real clock.
 */
export function shouldIntroduce(page, { now = Date.now(), state = readState() } = {}) {
    if (!page || state.off) return false;
    if (state.seen[page]) return false;
    // The gap is what stops a student who's exploring from being followed
    // around the app. It also means the very first page they land on gets the
    // introduction, which is the one that matters most.
    if (state.lastAt && now - state.lastAt < QUIET_MS) return false;
    return true;
}

/** Record that the introduction was shown. */
export function markShown(page, { now = Date.now() } = {}) {
    const s = readState();
    return write({ ...s, seen: { ...s.seen, [page]: now }, lastAt: now });
}

/**
 * Record how it went.
 *
 * "Engaged" means they took the action rather than closing it. A student who
 * has ever engaged never gets switched off automatically — they've shown the
 * introductions are worth something to them.
 */
export function markClosed(page, { engaged = false } = {}) {
    const s = readState();
    if (engaged) return write({ ...s, engaged: s.engaged + 1, dismissed: 0 });
    const dismissed = s.dismissed + 1;
    return write({ ...s, dismissed, off: s.engaged === 0 && dismissed >= GIVE_UP_AFTER });
}

/** Switch them back on — the Settings escape hatch, and the test's reset. */
export function resetFirstRun() {
    return write(blank());
}

/** For "you've seen 6 of 14 pages", and for the tests. */
export function seenPages(state = readState()) {
    return Object.keys(state.seen || {});
}
