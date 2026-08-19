/**
 * due — what is genuinely asking for your attention, and what is only claiming to.
 *
 * ─── Why the app always said everything was due ─────────────────────────────
 * Four separate reasons, all of them compounding:
 *
 * 1. A CARD IS BORN DUE. Every card is created with next_review_date set to
 *    today so it "shows up right away". Generate a 60-card deck with the AI
 *    tools and the dashboard immediately reports 60 cards due. Nothing has
 *    fallen behind. Nothing has even been opened.
 *
 * 2. OVERDUE NEVER DECAYED. The test was `next_review_date <= today`, which is
 *    true forever once it is true once. Miss a fortnight in exam block and
 *    every card you have ever made is permanently due, and the number only
 *    climbs. A count that only goes up is not information, it is wallpaper,
 *    and people learn to stop reading it in about a week.
 *
 * 3. THERE WAS NO WAY TO SAY "I KNOW THIS". The only exit from the queue was
 *    is_active: false, which is deletion. So a student who genuinely had the
 *    definition of osmosis down cold had two options: keep being asked, or
 *    destroy the card.
 *
 * 4. THREE DIFFERENT DEFINITIONS. mastery.js counted a card with no date as
 *    due; Analytics.jsx counted it as due; Dashboard, Study, FlashcardPerformance
 *    and UpcomingAssessments all required a date. So the same deck reported
 *    different numbers on different screens, which is its own quiet erosion of
 *    trust in every other number on the page.
 *
 * ─── What this replaces it with ─────────────────────────────────────────────
 * Six states, because "due" was carrying at least four meanings:
 *
 *   known      the student has audited it and said they have it. Out of the
 *              queue until they say otherwise. Reversible, and it keeps the
 *              card — this is not a delete.
 *   snoozed    "not today". An honest way to clear a pile without lying about
 *              knowing it.
 *   new        never reviewed. This is unseen material, not review debt, and
 *              calling it due is the single biggest source of the phantom pile.
 *   due        scheduled, and the date has arrived. The real thing.
 *   overdue    scheduled, and the date went past a while ago.
 *   scheduled  the date is in the future. Nothing to do.
 *
 * The distinction that matters most is new vs due. A student with 240 cards
 * they generated last night and 12 genuinely lapsed ones should be told about
 * the 12.
 */

const DAY = 86400000;

/** Past this many days late, a card is overdue rather than merely due. */
export const OVERDUE_AFTER_DAYS = 3;

/**
 * How many cards a day's queue offers at once.
 *
 * Not a hiding place — the backlog is always reported alongside it. This is
 * the difference between "you have 312 cards due" (which is a reason to close
 * the app) and "here are 40, and there are 272 behind them" (which is a
 * session). Roughly eight minutes at the twelve seconds a card takes.
 */
export const DAILY_CAP = 40;

/** New cards mixed into a day's queue, so a backlog cannot starve fresh material. */
export const NEW_PER_DAY = 15;

export const STATES = ["known", "snoozed", "new", "overdue", "due", "scheduled"];

/** Anything in here is asking to be studied now. */
const ACTIVE = new Set(["due", "overdue"]);

export const todayISO = () => new Date().toISOString().split("T")[0];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Whole days between two ISO dates. Positive means `a` is later than `b`. */
export function daysBetween(a, b) {
    const t1 = Date.parse(`${a}T00:00:00Z`);
    const t2 = Date.parse(`${b}T00:00:00Z`);
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
    return Math.round((t1 - t2) / DAY);
}

/**
 * Has this card ever actually been reviewed?
 *
 * Same question retention.js asks, and for the same reason: a card with no
 * reviews behind it was never learned, so it cannot have been forgotten.
 */
export function isLearned(card) {
    return num(card?.repetitions) > 0 || num(card?.total_reviews) > 0;
}

/**
 * The one state function. Everything else in this file is built on it, and
 * every due count in the app should come through it.
 */
export function cardState(card, today = todayISO()) {
    if (!card) return "scheduled";
    if (card.retired_at) return "known";
    if (card.snoozed_until && card.snoozed_until > today) return "snoozed";

    // Never reviewed is new, whatever date is sitting on the row. Cards are
    // created with next_review_date = today, so without this the state would
    // be decided by a field that means "available from", not "overdue since".
    if (!isLearned(card)) return "new";

    const from = dueFrom(card);
    if (!from) return "due";
    if (from > today) return "scheduled";

    const late = daysBetween(today, from);
    return late > OVERDUE_AFTER_DAYS ? "overdue" : "due";
}

/**
 * The date a card is late FROM, which is not always next_review_date.
 *
 * A snooze is a deliberate deferral, so the days inside it are not days the
 * student let slip. Measuring lateness from the scheduled date alone means a
 * card comes back from a week's snooze already branded overdue, which punishes
 * the student for using the honest button instead of the one that claims they
 * know it — exactly the behaviour this whole change exists to stop.
 */
export function dueFrom(card) {
    const scheduled = card?.next_review_date || null;
    const snoozed = card?.snoozed_until || null;
    if (!scheduled) return snoozed;
    if (!snoozed) return scheduled;
    return snoozed > scheduled ? snoozed : scheduled;
}

/** Is this card genuinely asking to be reviewed today? */
export function isDue(card, today = todayISO()) {
    return ACTIVE.has(cardState(card, today));
}

/** Never reviewed, and not put away. Material waiting to be started. */
export function isNew(card, today = todayISO()) {
    return cardState(card, today) === "new";
}

/** Counts by state, plus the two rollups every caller wants. */
export function tally(cards = [], today = todayISO()) {
    const out = { known: 0, snoozed: 0, new: 0, overdue: 0, due: 0, scheduled: 0 };
    for (const c of cards) out[cardState(c, today)] += 1;
    return {
        ...out,
        total: cards.length,
        /** What the dashboard should print. Not the backlog, not the new pile. */
        active: out.due + out.overdue,
    };
}

/**
 * Sort key for the working queue.
 *
 * Overdue first, and within that the most overdue, because a card three weeks
 * late is closer to being lost than one that slipped yesterday. Weak spots
 * come before ordinary cards at the same lateness: the scheduler already knows
 * they are the ones failing.
 */
function priority(card, today) {
    const state = cardState(card, today);
    const from = dueFrom(card);
    const late = from ? daysBetween(today, from) : 0;
    const rank = state === "overdue" ? 0 : 1;
    return [rank, -late, card.is_weak_spot ? 0 : 1];
}

/**
 * A day's work, and an honest account of what is behind it.
 *
 * Returns the capped queue plus the counts, so a caller can show "40 to do,
 * 272 behind" rather than either number on its own. Showing only the cap hides
 * a real backlog; showing only the backlog is the wallpaper problem above.
 */
export function dueQueue(cards = [], { cap = DAILY_CAP, newCap = NEW_PER_DAY, today = todayISO() } = {}) {
    const due = [];
    const fresh = [];
    for (const c of cards) {
        const s = cardState(c, today);
        if (ACTIVE.has(s)) due.push(c);
        else if (s === "new") fresh.push(c);
    }

    due.sort((a, b) => {
        const pa = priority(a, today);
        const pb = priority(b, today);
        return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
    });

    const queue = due.slice(0, cap);
    const starters = fresh.slice(0, Math.max(0, Math.min(newCap, cap - queue.length)));

    return {
        queue,
        starters,
        /** Due cards the cap left out. The honest backlog number. */
        backlog: Math.max(0, due.length - queue.length),
        totalDue: due.length,
        totalNew: fresh.length,
    };
}

/**
 * Why a pile is on the student's screen, in the words they would use.
 *
 * The audit screen's whole job is answering "why am I being told this", so the
 * reason is computed here next to the rule that produced it rather than
 * written as copy next to a number somewhere in a component.
 */
export function reasonFor(pile) {
    const { overdue = 0, due = 0, fresh = 0, oldestLate = 0 } = pile;
    if (overdue > 0 && oldestLate >= 30) {
        return `${overdue} card${overdue === 1 ? "" : "s"} slipped over a month ago. If you still know them, mark them off.`;
    }
    if (overdue > 0) {
        return `${overdue} card${overdue === 1 ? "" : "s"} went past ${oldestLate} day${oldestLate === 1 ? "" : "s"} ago.`;
    }
    if (due > 0) return `${due} came up for review today.`;
    if (fresh > 0) return `${fresh} you have never opened. New, not overdue.`;
    return "Nothing outstanding.";
}

/**
 * Everything claiming attention, grouped the way a student thinks about it:
 * by subject, then by topic inside it.
 *
 * This is the audit screen's data. It includes the new pile and the known pile
 * deliberately — the point of an audit is to see what the app is doing with
 * your cards, including the ones it has stopped asking about.
 */
export function auditPiles(cards = [], today = todayISO()) {
    const bySubject = new Map();

    for (const card of cards) {
        const state = cardState(card, today);
        const subject = card.subject_name || "Unsorted";
        const topic = card.topic || "General";

        if (!bySubject.has(subject)) {
            bySubject.set(subject, {
                subject, overdue: 0, due: 0, fresh: 0, known: 0, snoozed: 0, scheduled: 0,
                oldestLate: 0, cards: [], topics: new Map(),
            });
        }
        const s = bySubject.get(subject);

        if (!s.topics.has(topic)) {
            s.topics.set(topic, {
                topic, subject, overdue: 0, due: 0, fresh: 0, known: 0, snoozed: 0, scheduled: 0,
                oldestLate: 0, cards: [],
            });
        }
        const t = s.topics.get(topic);

        const key = state === "new" ? "fresh" : state;
        s[key] += 1;
        t[key] += 1;
        s.cards.push(card);
        t.cards.push(card);

        const from = ACTIVE.has(state) ? dueFrom(card) : null;
        if (from) {
            const late = daysBetween(today, from);
            if (late > s.oldestLate) s.oldestLate = late;
            if (late > t.oldestLate) t.oldestLate = late;
        }
    }

    const piles = [...bySubject.values()].map((s) => ({
        ...s,
        active: s.overdue + s.due,
        topics: [...s.topics.values()]
            .map((t) => ({ ...t, active: t.overdue + t.due, reason: reasonFor(t) }))
            // Loudest topic first, so the drill-down opens on what is actually
            // making the noise rather than on whatever was created first.
            .sort((a, b) => b.active - a.active || b.fresh - a.fresh || a.topic.localeCompare(b.topic)),
        reason: reasonFor(s),
    }));

    // Subjects with real debt first; a subject whose only claim is new material
    // sits below one that has genuinely lapsed.
    piles.sort((a, b) => b.active - a.active || b.fresh - a.fresh || a.subject.localeCompare(b.subject));
    return piles;
}

/**
 * The fields to write when a student marks a pile off.
 *
 * Returned rather than written so the caller owns the round trip and this file
 * stays testable. `known` clears any snooze, because saying you know something
 * is a stronger statement than saying not today.
 */
export function markKnown(now = new Date().toISOString()) {
    return { retired_at: now, snoozed_until: null };
}

/** Undo. Puts the card back where the scheduler left it. */
export function markUnknown() {
    return { retired_at: null };
}

/** Push a card out by n days without claiming to know it. */
export function snoozeFor(days, today = todayISO()) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Math.max(1, Math.round(days)));
    return { snoozed_until: d.toISOString().split("T")[0] };
}
