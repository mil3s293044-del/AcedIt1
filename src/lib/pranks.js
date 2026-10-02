/**
 * pranks — a small social action with four bounds on it.
 *
 * ─── THIS IS STUDENT-TO-STUDENT CONTENT, WHICH THIS APP HAS REFUSED BEFORE ──
 * Migration 0034 ruled out free text on Compete in its own words: "16-year-olds
 * competing with each other and sometimes losing in front of the group; a text
 * box on that is a moderation problem this app has no way to staff." A prank is
 * the same category of thing — something one student does TO another — so it
 * only ships because every one of those words can be made false about it.
 *
 * FOUR BOUNDS, and the first two are what actually make it safe:
 *
 *   1. A FIXED VOCABULARY. `KINDS` is the whole language. There is no free
 *      text anywhere in a prank, so nobody can say anything to anybody: the
 *      most hostile thing that can arrive is a screen that wobbles.
 *   2. A RECEIVE CAP. A send cap alone stops one student spamming and does
 *      nothing about twelve arriving at once — the shape that turns a joke into
 *      a pile-on. `WEEKLY_RECEIVE_MAX` is the ceiling that makes a dogpile
 *      structurally impossible rather than discouraged.
 *   3. FRIENDS ONLY, mutual and accepted. The difference between a classmate
 *      you know and a stranger on a public board picking a target.
 *   4. THE SENDER IS NAMED, always, on the thing itself. There is no anonymous
 *      prank here, which is most of the reason this stays playful — and it is
 *      the one rule a student can see being kept.
 *
 * And it is REFUSABLE: `pranks_opt_out` turns the whole thing off, including
 * for somebody who simply does not want it. An opt-out that costs the sender
 * their credits would be a way to find out who has opted out, so the refusal
 * happens BEFORE the charge and says only that the prank could not be sent.
 *
 * ─── NOTHING HERE IS A PUNISHMENT ───────────────────────────────────────────
 * Every kind is brief, visual, reversible and affects NOTHING a student is
 * measured on. A prank cannot touch XP, a streak, the ATAR, a mark, a deck or
 * a position — it is a few seconds of screen, and then it is over. Anything
 * that could cost the recipient something real is not a prank, it is a penalty
 * somebody bought, and this file is the wrong place for it.
 */

/* ── The vocabulary ──────────────────────────────────────────────────────── */

/**
 * Every prank the app can draw. `ms` is how long it lasts and it is SHORT on
 * purpose: the recipient did not ask for this, so the cost to them is measured
 * in seconds and the joke has to land inside that.
 *
 * `reduced` is what plays under `prefers-reduced-motion` — never nothing, or a
 * student with motion sensitivity silently receives an invisible prank and the
 * sender is charged for something that did not happen. Every one degrades to a
 * static card that names the sender and says what was sent.
 */
export const KINDS = {
    shake: {
        id: "shake", label: "Shake", blurb: "Their screen wobbles for a second.",
        ms: 900, price: 150,
    },
    confetti: {
        id: "confetti", label: "Confetti", blurb: "A burst of confetti, for no reason at all.",
        ms: 2200, price: 150,
    },
    upside: {
        id: "upside", label: "Upside down", blurb: "The page turns over. Briefly.",
        ms: 2500, price: 250,
    },
    snow: {
        id: "snow", label: "Snow", blurb: "It starts snowing on them.",
        ms: 4000, price: 250,
    },
    spade: {
        id: "spade", label: "Ace attack", blurb: "Ace runs across their screen.",
        ms: 2600, price: 350,
    },
};

/** The one list, in the order the shelf prints them. */
export const PRANK_LIST = Object.values(KINDS);

/** Is this a prank the app knows how to draw? An unknown kind renders NOTHING
 *  rather than a fallback — a prank nobody designed is not a prank. */
export const prankKind = (id) => KINDS[String(id || "")] || null;

/* ── The caps ────────────────────────────────────────────────────────────── */

/** How many one student may SEND in a week. Stops one person being relentless. */
export const WEEKLY_SEND_MAX = 5;

/**
 * How many one student may RECEIVE in a week, from everybody combined.
 *
 * THIS IS THE ONE THAT MATTERS. A send cap bounds each sender and says nothing
 * about a class of thirty deciding to pick on one person — five each is a
 * hundred and fifty, which is not a joke, it is a campaign. Past this ceiling
 * every further prank is refused no matter who sends it.
 *
 * Lower than the send cap deliberately: it is better to spend a prank you
 * cannot deliver than to receive one you did not want.
 */
export const WEEKLY_RECEIVE_MAX = 3;

/* ── Who may send to whom ────────────────────────────────────────────────── */

/** Has this student turned pranks off entirely? Unknown counts as OPTED IN,
 *  because the field only exists once somebody has chosen — but see
 *  `mayReceive`, which is where the real asymmetry is applied. */
export const optedOut = (profile) => profile?.extra?.pranks_opt_out === true;

/**
 * May this prank be delivered? ONE answer with a reason, and the reasons are
 * deliberately indistinguishable from the sender's side where they are about
 * the recipient: "they can't receive this right now" covers an opt-out AND a
 * full week, because a refusal that says WHICH would turn this into a way of
 * finding out who has opted out — and somebody who has opted out is exactly the
 * person a determined sender would then go and find another way to reach.
 */
export function mayReceive({ target, receivedThisWeek = 0 } = {}) {
    if (!target) return { ok: false, reason: "Pick somebody to send it to." };
    if (optedOut(target) || receivedThisWeek >= WEEKLY_RECEIVE_MAX) {
        return { ok: false, reason: "They can't receive one right now." };
    }
    return { ok: true, reason: null };
}

/** May this student send one? Their own limits, which they are told plainly —
 *  a cap on YOUR OWN behaviour is a thing you can act on, so it names itself. */
export function maySend({ kind, sentThisWeek = 0, isFriend = false } = {}) {
    if (!prankKind(kind)) return { ok: false, reason: "That isn't something you can send." };
    if (!isFriend) return { ok: false, reason: "You can only send one to a friend." };
    if (sentThisWeek >= WEEKLY_SEND_MAX) {
        return { ok: false, reason: `You have sent your ${WEEKLY_SEND_MAX} for this week. It resets Monday.` };
    }
    return { ok: true, reason: null };
}

/**
 * The whole decision, sender and recipient together, in the order a student can
 * act on: your own limits first (which you can fix), then theirs (which you
 * cannot). A sender told "they can't receive one" when they had also run out
 * themselves would fix the wrong thing.
 */
export function canSend({ kind, target, sentThisWeek = 0, receivedThisWeek = 0, isFriend = false } = {}) {
    const mine = maySend({ kind, sentThisWeek, isFriend });
    if (!mine.ok) return mine;
    return mayReceive({ target, receivedThisWeek });
}

export default {
    KINDS, PRANK_LIST, prankKind, optedOut,
    WEEKLY_SEND_MAX, WEEKLY_RECEIVE_MAX, maySend, mayReceive, canSend,
};
