/**
 * studyQueue — everything the app knows you owe it, in one ranked list.
 *
 * ─── The claim the page was already making ──────────────────────────────────
 * /Review's own subtitle reads "Everything the app is keeping track of, and
 * what it is actually asking of you." It showed FLASHCARDS. Six other things
 * the app genuinely tracks, already computes, and already has a real action
 * for were scattered across other screens or surfaced nowhere at all — and one
 * of them, the mistake bank, is EXCLUDED from that page by `deckCards`, so the
 * screen claiming to show everything was the one screen hiding it.
 *
 * ─── NOTHING HERE IS STORED ─────────────────────────────────────────────────
 * Every item is derived from rows the page has already loaded, which is the
 * rule `redoQueue` and `subjectHub` already follow: derived, so it cannot go
 * stale, double up, or disagree with the screen it came from. There is no
 * queue table, no "dismissed" flag and no backfill. An item disappears because
 * the fact behind it stopped being true.
 *
 * ─── THE ORDER IS WHAT IT COSTS YOU, AND IT IS FOUR TIERS ───────────────────
 * Seven kinds of thing need one order, and a table of invented weights is
 * exactly the "numbers for the sake of numbers" this rebuild is against — a
 * student cannot check it and neither can we. So the order is a rule that can
 * be stated in one sentence and argued with:
 *
 *   DEADLINE   something with a date on it. A SAC on Friday cannot be moved,
 *              so anything that can wait, waits. Closest first.
 *   DROPPED    marks you have ALREADY lost — a question missed twice, a
 *              criterion the assessor wanted, an answer nobody ever marked.
 *              These are the only items on the list where the damage is done
 *              and the only question is whether it happens again.
 *   DECAYING   marks about to be lost. Cards whose predicted recall has fallen
 *              through the floor: still yours today, not next week.
 *   ROUTINE    the ordinary pile. Due cards, new material. This is the work,
 *              and it is last because everything above it is more expensive to
 *              skip, not because it matters least.
 *
 * Within a tier the sort is that tier's own natural one — days remaining for a
 * deadline, size for the rest. `tierRank` is the whole ordering.
 *
 * ─── AND AN ITEM WITH NO REAL NUMBER IS NOT DRAWN ───────────────────────────
 * Every builder returns null rather than a zero row, the rule Today's Play
 * keeps about its rail: a queue that pads itself to a respectable length with
 * "0 cards due" teaches a student that the numbers here are decoration, after
 * which the real ones do not land either. An empty queue is a real answer and
 * it is the one the page wants to print.
 */

import { tally } from "@/lib/due";
import { retentionOutlook } from "@/lib/retention";
import { bankSummary } from "@/lib/mistakeBank";
import { redoQueue } from "@/lib/quizInsight";

/** How close a deadline has to be before it is this week's problem. */
export const SOON_DAYS = 14;

/**
 * How long a subject can go untouched before an upcoming assessment counts as
 * "no prep started". Shorter than SOON_DAYS on purpose: a student who did an
 * hour of Chemistry nine days ago has started, whatever the calendar says.
 */
export const PREP_STALE_DAYS = 7;

/** Tiers, worst-first. The index IS the rank; see the header. */
export const TIERS = ["deadline", "dropped", "decaying", "routine"];
const tierRank = (t) => {
    const i = TIERS.indexOf(t);
    // An unknown tier sorts LAST rather than first. A new kind added without a
    // tier should fall to the bottom of the queue, never to the top of it.
    return i < 0 ? TIERS.length : i;
};

const MS_DAY = 86400000;
const dayStart = (v) => {
    const d = v instanceof Date ? new Date(v) : new Date(String(v));
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Whole days from `now` until `when`, or null.
 *
 * Both ends are flattened to local midnight, so "due tomorrow" is 1 whatever
 * time of day it is read at — the trap `dayKey` exists for one file over.
 */
export function daysUntil(when, now = new Date()) {
    const a = dayStart(now), b = dayStart(when);
    if (!a || !b) return null;
    return Math.round((b - a) / MS_DAY);
}

/** "in 3 days" / "tomorrow" / "today". Never "in -1 days". */
export function whenLabel(days) {
    if (days == null) return null;
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
}

// ─── The builders. Each returns an item or null, and never a zero row. ──────

/**
 * An assessment inside the window that nothing has been studied for.
 *
 * "Nothing studied" is the subject going untouched for `PREP_STALE_DAYS`, not
 * the absence of a session tagged to the assessment — there is no such tag,
 * and inventing one would mean a student who revised all week still being told
 * they had not started. The honest signal the app actually has is whether the
 * subject has been opened at all.
 *
 * NEVER SCORE A STUDENT ON A SIGNAL THEY CANNOT REACH: an assessment with no
 * subject name cannot be matched against the study log, so it is skipped
 * rather than reported as unprepared.
 */
export function assessmentItems(assessments = [], events = [], now = new Date()) {
    const lastBySubject = new Map();
    for (const e of events) {
        const subj = e?.subject;
        if (!subj || !e.day) continue;
        const prev = lastBySubject.get(subj);
        if (!prev || String(e.day) > String(prev)) lastBySubject.set(subj, e.day);
    }

    const out = [];
    for (const a of assessments) {
        if (!a || a.is_completed) continue;
        const subject = a.subject_name;
        if (!subject) continue;
        const days = daysUntil(a.due_date, now);
        if (days == null || days < 0 || days > SOON_DAYS) continue;

        const last = lastBySubject.get(subject);
        const since = last ? daysUntil(now, last) : null;   // negative = days ago
        const quiet = since == null ? null : Math.abs(since);
        // Touched recently enough to count as started. `quiet === null` means
        // the subject has never been studied at all, which is the strongest
        // version of this and must not read as "recently".
        if (quiet != null && quiet < PREP_STALE_DAYS) continue;

        out.push({
            key: `assessment:${a.id}`,
            kind: "assessment",
            tier: "deadline",
            subject,
            title: a.title || `${subject} assessment`,
            detail: `${subject} · ${whenLabel(days)}`,
            why: quiet == null
                ? "You have not studied this subject yet."
                : `Nothing studied for it in ${quiet} days.`,
            count: days,
            cta: "Start on it",
            page: "Study",
            query: `?subject=${encodeURIComponent(subject)}`,
            urgency: days,
        });
    }
    return out.sort((a, b) => a.urgency - b.urgency);
}

/**
 * Written answers that were never marked.
 *
 * A `question_results` entry carries `marks: null` when the marking call did
 * not come back — `saveMcqOnlyAttempt`'s own comment says why: "an unmarked
 * question is not a question you got wrong". That is right, and it has a
 * consequence nobody was told about: the attempt's score is computed over the
 * questions that WERE marked, so a paper with four unmarked written answers is
 * being reported on a fraction of itself, quietly and permanently, until the
 * student self-marks them.
 *
 * `self_marked_marks` is the student's own answer to that, so a question with
 * one recorded is not outstanding.
 */
export function unmarkedItem(attempts = []) {
    let questions = 0;
    const papers = new Set();
    let latest = null;

    for (const a of attempts) {
        if (!a || a?.extra?.is_retry) continue;
        const results = Array.isArray(a?.extra?.question_results) ? a.extra.question_results : [];
        if (!results.length) continue;
        const self = a.self_marked_marks && typeof a.self_marked_marks === "object"
            ? a.self_marked_marks : {};
        let n = 0;
        for (const r of results) {
            // NOT `!r.marks`: zero is a real mark and a legitimately earned
            // one. Only an absent figure is unmarked, which is the same
            // `Number(null)` family this codebase keeps meeting.
            if (!r || r.marks != null) continue;
            if (self[r.q_index] != null || self[String(r.q_index)] != null) continue;
            n += 1;
        }
        if (!n) continue;
        questions += n;
        papers.add(a.quiz_id || a.id);
        if (!latest || String(a.created_date || "") > String(latest.created_date || "")) latest = a;
    }

    if (!questions) return null;
    return {
        key: "unmarked",
        kind: "unmarked",
        tier: "dropped",
        subject: null,
        title: `${questions} answer${questions === 1 ? "" : "s"} nobody marked`,
        detail: `across ${papers.size} paper${papers.size === 1 ? "" : "s"}`,
        why: "Your score on those papers is being worked out without them.",
        count: questions,
        cta: "Mark them",
        page: "Quizzes",
        query: latest?.quiz_id ? `?play=${encodeURIComponent(latest.quiz_id)}` : "",
        urgency: questions,
    };
}

/** Questions missed more than once, or carrying a mistake never re-sat clean. */
export function resitItem(quizzes = [], attempts = [], bankCards = []) {
    const rows = redoQueue(quizzes, attempts, bankCards);
    if (!rows.length) return null;
    const subjects = new Set(rows.map((r) => r.subject).filter(Boolean));
    return {
        key: "resit",
        kind: "resit",
        tier: "dropped",
        subject: subjects.size === 1 ? [...subjects][0] : null,
        title: `${rows.length} question${rows.length === 1 ? "" : "s"} to sit again`,
        detail: subjects.size ? [...subjects].slice(0, 2).join(" · ") : "from your attempts",
        why: "You have missed these more than once, or drilled them and never re-sat them.",
        count: rows.length,
        cta: "Sit them",
        page: "MistakeBank",
        query: "?tab=resit",
        urgency: rows.length,
    };
}

/**
 * Banked mistakes ready to drill.
 *
 * READY, not total. "Review 6" that turns out to be one card due and five
 * scheduled next week is the small lie that costs a screen its credibility —
 * /MistakeBank's own rule, applied to the entrance rather than the shelf.
 */
export function mistakeItem(bankCards = [], isReady = () => false, attempts = []) {
    const s = bankSummary(bankCards, isReady, attempts);
    if (!s.ready) return null;
    const subjects = s.subjects.filter((x) => x.ready > 0);
    return {
        key: "mistakes",
        kind: "mistakes",
        tier: "dropped",
        subject: subjects.length === 1 ? subjects[0].subject : null,
        title: `${s.ready} mistake${s.ready === 1 ? "" : "s"} ready to drill`,
        detail: s.outstanding > s.ready
            ? `${s.outstanding} still costing you marks`
            : "marks you have already dropped",
        why: s.repeats?.length
            ? `${s.repeats.length} of these you have dropped more than once.`
            : "Each one is a criterion an assessor was looking for.",
        count: s.ready,
        cta: "Drill them",
        page: "MistakeBank",
        query: "",
        urgency: s.ready,
    };
}

/** Cards whose predicted recall has fallen through the floor. */
export function decayItem(cards = [], now = Date.now()) {
    const o = retentionOutlook(cards, { now });
    const slipping = o.subjects.reduce((n, s) => n + s.slipping, 0);
    if (!slipping) return null;
    const worst = o.subjects.find((s) => s.slipping > 0) || null;
    return {
        key: "decay",
        kind: "decay",
        tier: "decaying",
        subject: worst?.subject || null,
        title: `${slipping} card${slipping === 1 ? "" : "s"} slipping`,
        detail: worst ? `worst in ${worst.subject}` : "past reliable recall",
        why: "These are below the recall floor — still yours today, not next week.",
        count: slipping,
        cta: "Shore them up",
        page: "Study",
        query: `?tab=spaced${worst?.subject ? `&subject=${encodeURIComponent(worst.subject)}` : ""}`,
        urgency: slipping,
    };
}

/**
 * The ordinary pile.
 *
 * READY rather than due, which is `due.js`'s whole point: a deck of fifty
 * cards a student has just made printed "All caught up" when this counted
 * `isDue` alone.
 */
export function cardsItem(cards = [], today, piles = []) {
    const t = tally(cards, today);
    if (!t.ready) return null;
    const subjects = piles.filter((p) => (p.active + p.fresh) > 0);
    return {
        key: "cards",
        kind: "cards",
        tier: "routine",
        subject: subjects.length === 1 ? subjects[0].subject : null,
        title: `${t.ready} card${t.ready === 1 ? "" : "s"} ready`,
        detail: subjects.length > 1
            ? `across ${subjects.length} subjects`
            : subjects[0]?.subject || "in your decks",
        // The honest split, which is the thing /Review was built to say: most
        // students discover here that the terrifying number was unopened
        // material rather than a backlog.
        why: t.active && t.new
            ? `${t.active} came up for review · ${t.new} you have never opened.`
            : t.active
                ? `${t.active} came up for review.`
                : `${t.new} you have never opened.`,
        count: t.ready,
        cta: "Review them",
        page: "Study",
        query: "?tab=spaced",
        urgency: t.active || t.ready,
    };
}

/**
 * The whole queue, ranked.
 *
 * Everything is passed in because every row is already loaded by the page that
 * draws this — nothing here queries, which is what keeps it pure and keeps the
 * test able to exercise the ordering against fixtures rather than a database.
 */
export function studyQueue({
    cards = [],
    bankCards = [],
    quizzes = [],
    attempts = [],
    assessments = [],
    events = [],
    piles = [],
    isReady = () => false,
    today,
    now = new Date(),
} = {}) {
    const items = [
        ...assessmentItems(assessments, events, now),
        unmarkedItem(attempts),
        resitItem(quizzes, attempts, bankCards),
        mistakeItem(bankCards, isReady, attempts),
        decayItem(cards, now instanceof Date ? now.getTime() : now),
        cardsItem(cards, today, piles),
    ].filter(Boolean);

    return items.sort((a, b) => {
        const t = tierRank(a.tier) - tierRank(b.tier);
        if (t) return t;
        // Inside a tier, the deadline tier counts DOWN (fewer days is worse)
        // and every other tier counts UP (more of them is worse). Sorting both
        // the same way would put a SAC a fortnight out above one tomorrow.
        if (a.tier === "deadline") return a.urgency - b.urgency;
        return b.urgency - a.urgency;
    });
}

/**
 * One sentence for the top of the page.
 *
 * It names the FIRST item rather than summing the queue, because "you have 6
 * things outstanding" is a number and "your Chemistry SAC is on Friday and you
 * have not started" is a reason to do something. Null on an empty queue — the
 * page says caught up in its own words rather than being handed a sentence
 * about nothing.
 */
export function queueLead(items = []) {
    const first = items[0];
    if (!first) return null;
    const rest = items.length - 1;
    return {
        item: first,
        rest,
        line: rest > 0
            ? `${first.title} — and ${rest} other thing${rest === 1 ? "" : "s"} waiting.`
            : `${first.title}.`,
    };
}

/** Minutes of work on the queue, where an item can honestly say. */
export function queueMinutes(items = [], minutesFor = () => null) {
    let total = 0, known = 0;
    for (const it of items) {
        const m = minutesFor(it);
        if (typeof m === "number" && Number.isFinite(m) && m > 0) { total += m; known += 1; }
    }
    // NULL rather than 0 when nothing could be estimated. A "0 min" badge over
    // six real tasks is worse than no badge.
    return known ? { minutes: total, from: known, of: items.length } : null;
}
