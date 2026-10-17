/**
 * aceSpot — Ace placed on a page, and what makes him part of it.
 *
 * AceBody already breathes, blinks and follows the pointer. What made him
 * read as a sticker everywhere he was PLACED (the planner's countdown, an
 * empty friends list, a break screen) was three other things:
 *
 *   1. HE WAS THERE ON THE FIRST FRAME. A character who is simply present
 *      when the page paints is a picture of one. He ARRIVES now, a beat after
 *      the content, the way somebody walks up to a table.
 *   2. HE HELD ONE POSE FOREVER. Pointing at a button for ten minutes is not
 *      pointing, it is a drawing of a point. And AceBody's fidgets only fire
 *      from a RESTING pose, so every placement handed "point", "think" or
 *      "wave" never moved again. The pose a placement asks for is now the
 *      thing he DOES on arrival, and then he settles (`settleFor`) into the
 *      resting pose nearest it, where the fidgets can reach him.
 *   3. NOTHING HE COULD SEE CHANGED HIM. A SAC tracked beside him, a session
 *      ticked off, a link copied: he watched it happen and did nothing. The
 *      page now tells him (`REACTIONS`), and he reacts for a moment and
 *      settles again.
 *
 * CALM, ON PURPOSE. A fidget every 8–12 seconds rather than AceBody's 3–7,
 * because these are on screens somebody is working on rather than his own
 * corner. Nothing fires while the student is typing anywhere on the page, and
 * under reduced motion he is exactly what he was before: the pose asked for,
 * still. A mascot that moves while you write is one you switch off.
 *
 * Every decision here is a pure function so the test can hold it.
 */

/** The poses AceBody fidgets from. Mirrors its RESTING set (the test pins it). */
export const RESTING = ["stand", "happy", "peek", "offer"];

/** A fidget every 8–12 seconds, in milliseconds. */
export const CALM_IDLE = { min: 8000, spread: 4000 };

/** How long the arrival gesture is held before he settles. */
export const INTRO_MS = 1700;

/** How long a reaction lasts unless it is held (a hover). */
export const REACT_MS = 1400;

/** Seconds after the content he arrives — the page first, then him. */
export const ARRIVE_DELAY = 0.2;

/**
 * The resting pose nearest each gesture. Celebrations settle into pleased,
 * everything else into standing; sleep stays asleep, because waking him for a
 * fidget would undo the one thing the break screen is saying.
 */
const SETTLE = {
    cheer: "happy", proud: "happy", wave: "happy", wink: "happy", flex: "happy", bounce: "happy",
    point: "stand", think: "stand", ponder: "stand", alert: "stand", nod: "stand",
    toss: "stand", walk: "stand", yawn: "sleep", sleep: "sleep",
};

export function settleFor(pose) {
    if (RESTING.includes(pose)) return pose;
    return SETTLE[pose] || "stand";
}

/**
 * Things a page can tell him happened, and what he does about each. Named for
 * the EVENT, so a placement says what happened rather than choosing a pose,
 * and one event always gets the same reaction across the app.
 */
export const REACTIONS = {
    added: { pose: "cheer", ms: 1600 },    // something new: a SAC tracked, a request sent
    done: { pose: "nod", ms: 900 },        // a thing ticked off
    copied: { pose: "wink", ms: 1300 },    // a link or code copied to share
    eager: { pose: "bounce", ms: null },   // hovering the thing he is asking you to do
    point: { pose: "point", ms: null },    // hovering a thing to his right
};

/**
 * The next cue for an event (or a bare pose). `n` changes every time, so the
 * same reaction twice in a row still plays twice. `ms: null` is HELD until
 * released, which is what a hover is.
 */
export function cueFor(event, prev = null) {
    const r = REACTIONS[event] || (event ? { pose: event, ms: REACT_MS } : null);
    const n = (prev?.n || 0) + 1;
    if (!r) return { pose: null, ms: null, n };
    return { pose: r.pose, ms: r.ms === undefined ? REACT_MS : r.ms, n };
}

/**
 * The pose actually drawn. Under reduced motion it is the pose asked for, as
 * it always was — no arrival, no settling, no reactions. Otherwise a held or
 * live reaction wins, then the arrival gesture (`intro`, or the pose itself),
 * then the resting pose nearest it. `intro` is for an arrival that is not the
 * pose: a yawn before he falls asleep on the break screen, where reduced
 * motion must still show him asleep rather than mid-yawn. `hold` keeps the
 * asked-for pose for good (he is mid-task, thinking while something loads).
 */
export function shownPose({ pose = "stand", intro = null, reduce = false, introDone = false, cue = null, hold = false } = {}) {
    if (reduce) return pose;
    if (cue?.pose) return cue.pose;
    if (hold) return pose;
    if (!introDone) return intro || pose;
    return settleFor(pose);
}

/** Is the student typing into this element? Then he holds still. */
export function isTextEntry(el) {
    if (!el || typeof el !== "object") return false;
    if (el.isContentEditable) return true;
    const tag = String(el.tagName || "").toUpperCase();
    if (tag === "TEXTAREA") return true;
    if (tag !== "INPUT") return false;
    const type = String(el.type || "text").toLowerCase();
    return ["text", "search", "email", "number", "password", "url", "tel", ""].includes(type);
}

/**
 * How he arrives. Plain framer props, with tween/spring easings only — a CSS
 * easing string such as `steps(1, end)` throws inside framer and aborts the
 * whole animation batch, which is how the prank name plate once went missing.
 * Under reduced motion there is no entrance at all: he is simply there.
 */
export const ENTRANCES = {
    // Up from below, overshooting a touch, like stepping up to the table.
    rise: {
        initial: { opacity: 0, y: 22, scale: 0.92 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { type: "spring", stiffness: 260, damping: 15 },
    },
    // Dropped in from above and landing on his feet: a squash, then up.
    hop: {
        initial: { opacity: 0, y: -28 },
        animate: { opacity: [0, 1, 1, 1], y: [-28, 0, -8, 0], scaleY: [1.06, 0.86, 1.04, 1] },
        transition: { duration: 0.75, times: [0, 0.45, 0.72, 1], ease: "easeOut" },
    },
    // In from the side he stands on, leaning into it and straightening up.
    slide: {
        initial: { opacity: 0, x: 30, rotate: 10 },
        animate: { opacity: 1, x: 0, rotate: 0 },
        transition: { type: "spring", stiffness: 220, damping: 16 },
    },
};

export function entranceFor(kind, { reduce = false, delay = ARRIVE_DELAY } = {}) {
    const e = ENTRANCES[kind];
    if (reduce || !e) return {};
    return {
        initial: e.initial,
        animate: e.animate,
        transition: { ...e.transition, delay },
    };
}

export default {
    RESTING, CALM_IDLE, INTRO_MS, REACT_MS, ARRIVE_DELAY, REACTIONS,
    settleFor, cueFor, shownPose, isTextEntry, ENTRANCES, entranceFor,
};
