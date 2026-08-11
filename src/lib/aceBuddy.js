/**
 * aceBuddy — the state of Ace tagging along with you.
 *
 * Three things this has to get right, and only one of them is technical.
 *
 * 1. HE ASKS FIRST. The Dashboard used to open a three-choice modal — homework
 *    / cramming / free study — and a modal that interrogates you before you've
 *    seen the page is a modal you learn to close. Ace asking the same question
 *    is the same information, gathered by someone rather than by a form, and
 *    it's the answer that lets him be useful for the rest of the visit rather
 *    than generic.
 *
 * 2. HE TRAVELS. Once he knows the plan, he says one short thing per page. One.
 *    The single fastest way to make a companion hated is to have him narrate,
 *    so there's a hard cap on how often he speaks and a memory of where he's
 *    already spoken.
 *
 * 3. HE LEAVES WHEN TOLD. Two levels, because "not now" and "never" are
 *    different requests and answering the first with the second loses you a
 *    student who'd have liked him tomorrow. Snoozed is until the tab closes.
 *    Off is until they turn him back on. Neither ever nags.
 */

const KEY = "acedit_ace_buddy_v1";
const SESSION_KEY = "acedit_ace_buddy_session_v1";

/**
 * He won't speak twice inside this.
 *
 * 25 seconds, and the number is a real trade. Longer and someone moving
 * through the app at a normal pace never hears from him at all, which makes
 * "he comes with you" a lie. Shorter and he's commenting on every click.
 * This is about the time it takes to land somewhere, look at it, and decide
 * it isn't what you wanted.
 */
export const COOLDOWN_MS = 25_000;
/** Pages he'll comment on in one sitting before going quiet on his own. */
export const MAX_LINES_PER_SESSION = 6;

const blankSession = () => ({ spokeAt: 0, spokenOn: [], lines: 0, snoozed: false, asked: false });

function readSession() {
    try {
        const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        if (raw && typeof raw === "object") return { ...blankSession(), ...raw };
    } catch { /* first load, or private mode */ }
    return blankSession();
}
function writeSession(s) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* private mode */ }
    return s;
}

const blank = () => ({ off: false, plan: null, planAt: 0 });

export function readBuddy() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && typeof raw === "object") return { ...blank(), ...raw };
    } catch { /* first run, or private mode */ }
    return blank();
}
function write(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
    return s;
}

const DAY = 86400000;
const sameDay = (a, b) => a && b && Math.floor(a / DAY) === Math.floor(b / DAY);

/**
 * Should he ask what the plan is?
 *
 * Once a day at most, and never when he's been switched off. Asking again
 * after they've already told you is the thing that makes an assistant feel
 * like it isn't listening.
 */
export function shouldAskPlan({ now = Date.now(), state = readBuddy(), session = readSession() } = {}) {
    if (state.off || session.snoozed || session.asked) return false;
    return !sameDay(state.planAt, now);
}

/** Remember the plan, and stop asking. */
export function setPlan(planId, { now = Date.now() } = {}) {
    writeSession({ ...readSession(), asked: true });
    return write({ ...readBuddy(), plan: planId, planAt: now });
}

/** They closed the question without answering — don't ask again this visit. */
export function skipPlan() {
    return writeSession({ ...readSession(), asked: true });
}

/** Today's plan, or null once it's stale. A plan doesn't survive the night. */
export function currentPlan({ now = Date.now(), state = readBuddy() } = {}) {
    return sameDay(state.planAt, now) ? state.plan : null;
}

/**
 * Should he say something about this page?
 *
 * Every one of these conditions exists because of a specific way companions
 * become annoying: speaking twice about the same page, speaking the instant
 * you arrive somewhere else, and speaking all day.
 */
export function shouldSpeak(page, { now = Date.now(), state = readBuddy(), session = readSession() } = {}) {
    if (!page || state.off || session.snoozed) return false;
    if (session.lines >= MAX_LINES_PER_SESSION) return false;
    if (session.spokenOn.includes(page)) return false;
    if (session.spokeAt && now - session.spokeAt < COOLDOWN_MS) return false;
    return true;
}

export function markSpoke(page, { now = Date.now() } = {}) {
    const s = readSession();
    return writeSession({
        ...s,
        spokeAt: now,
        lines: s.lines + 1,
        spokenOn: [...new Set([...s.spokenOn, page])],
    });
}

/** "Not now." Quiet until the tab closes. */
export function snooze() {
    return writeSession({ ...readSession(), snoozed: true });
}

/** "Never." Quiet until they say otherwise. */
export function turnOff() {
    writeSession({ ...readSession(), snoozed: true });
    return write({ ...readBuddy(), off: true });
}

/** Back on, and he gets his voice back this visit too. */
export function turnOn() {
    writeSession({ ...readSession(), snoozed: false });
    return write({ ...readBuddy(), off: false });
}

export function isOff({ state = readBuddy(), session = readSession() } = {}) {
    return Boolean(state.off || session.snoozed);
}

/** For tests, and for a Settings reset. */
export function resetBuddy() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
    return write(blank());
}

export { readSession };
