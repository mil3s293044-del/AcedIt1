/**
 * workpieceSources — the student's own work, offered as things to work on.
 *
 * ─── THE BENCH OPENS ON WHAT THEY ALREADY HAVE ──────────────────────────────
 * A blank bench asks the student to supply context the app already holds, which
 * is the complaint about the chat restated one screen along. Every candidate
 * here is DERIVED from rows the page already loads — a question they got wrong,
 * a criterion they keep dropping, a SAC on the planner, a deck going stale —
 * so nothing is stored, nothing can go stale, and a candidate disappears
 * because the fact behind it stopped being true. The rule `studyQueue`,
 * `redoQueue` and `toolBrief` already keep.
 *
 * ─── EVERY ONE CARRIES A WAY BACK ───────────────────────────────────────────
 * A workpiece pulled out of the app has somewhere it came FROM, and the header
 * links to it. Typed and uploaded work does not and says nothing, because
 * `makeWorkpiece` drops a ref with no page rather than drawing a dead link.
 *
 * ─── AND A CANDIDATE WITH NO BODY IS NOT OFFERED ────────────────────────────
 * `makeWorkpiece` returns null for an empty body, and every builder here
 * filters those out rather than putting a card on screen that opens a bench
 * with nothing on it. A quiz question whose text never saved, a mistake banked
 * before `extra.mistake.question` existed — both are real and both are
 * skipped, which is the "no builder returns a zero row" rule.
 */

import { makeWorkpiece } from "./workpiece.js";
import { redoQueue } from "./quizInsight.js";
import { bankSummary, mistakeMeta, isBankCard } from "./mistakeBank.js";
import { retentionOutlook } from "./retention.js";
import { daysUntil, SOON_DAYS } from "./studyQueue.js";

/** How many of each kind the picker offers before it is a list rather than a pick. */
export const PER_SOURCE = 3;

/**
 * Questions you got wrong.
 *
 * `redoQueue` already answers "what needs sitting again" and carries the whole
 * question text, so this is a re-labelling rather than a second computation of
 * the same fact — which is what would drift.
 */
export function missedQuestions(quizzes = [], attempts = [], bankCards = []) {
    const out = [];
    for (const row of redoQueue(quizzes, attempts, bankCards, { limit: 12 })) {
        const text = row?.question?.question;
        if (!text) continue;
        const w = makeWorkpiece({
            // A QUESTION, not a problem, whatever the subject. The kind is what
            // the thing IS. Nothing ROUTES on it any more — `diagnostic.js`
            // reads the work itself and the subject gates which faults may be
            // reported — but a candidate still says what it is, and the intake
            // prints it.
            kind: "question",
            body: String(text),
            title: row.title ? `${row.title}` : "",
            subject: row.subject || null,
            source: "missed",
            ref: { page: "Quizzes", label: "On your shelf" },
        });
        if (w) out.push(w);
        if (out.length >= PER_SOURCE) break;
    }
    return out;
}

/**
 * Criteria you keep dropping.
 *
 * The WHOLE QUESTION is the workpiece and the criterion rides in the title,
 * because what the student has to get right next time is the question, not the
 * sentence fragment. `extra.mistake.question` holds it verbatim; a card banked
 * before that field existed has only a clipped label and is skipped rather than
 * opening a bench on sixty characters cut off mid-expression.
 */
export function droppedCriteria(bankCards = [], isReady = () => false, attempts = []) {
    const s = bankSummary((bankCards || []).filter(isBankCard), isReady, attempts);
    const repeats = (s.repeats || []).filter((r) => (r.count || 0) >= 2);
    const wanted = new Set(repeats.map((r) => String(r.criterion || "").toLowerCase()));

    const out = [];
    const seen = new Set();
    for (const card of (bankCards || []).filter(isBankCard)) {
        const m = mistakeMeta(card);
        const crit = String(m.criterion || "").trim();
        if (!crit || !wanted.has(crit.toLowerCase())) continue;
        if (seen.has(crit.toLowerCase())) continue;
        // The real question, never the clipped label. `mistakeMeta.question`
        // falls back to `question_title`, which is the sixty-character pill —
        // so the two are compared and a fallback-only card is skipped.
        const body = String(m.question || "").trim();
        if (!body || body === String(m.questionTitle || "").trim()) continue;
        seen.add(crit.toLowerCase());
        const w = makeWorkpiece({
            kind: "question",
            body,
            title: crit,
            subject: card.subject_name || null,
            source: "mistake",
            ref: { page: "MistakeBank", label: "In your bank" },
        });
        if (w) out.push(w);
        if (out.length >= PER_SOURCE) break;
    }
    return out;
}

/**
 * What is on the calendar.
 *
 * An assessment is a TOPIC rather than a question: there is no question text
 * yet, which is the point — the student is preparing for one. So the tools it
 * offers are explain, question me, condense and teach back, and none of them is
 * "mark it", because there is nothing written.
 */
export function upcomingAssessments(assessments = [], now = new Date()) {
    const rows = [];
    for (const a of assessments || []) {
        if (!a || a.is_completed) continue;
        const subject = a.subject_name;
        if (!subject) continue;
        const days = daysUntil(a.due_date, now);
        if (days == null || days < 0 || days > SOON_DAYS) continue;
        rows.push({ a, days, subject });
    }
    rows.sort((x, y) => x.days - y.days);

    const out = [];
    for (const { a, days, subject } of rows) {
        const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
        const w = makeWorkpiece({
            kind: "topic",
            body: `${a.title || "An assessment"} in ${subject}, ${when}.${
                a.topics ? ` It covers: ${a.topics}.` : ""}`,
            title: a.title || `${subject} assessment`,
            subject,
            source: "assessment",
            ref: { page: "Goals", label: "On your planner" },
        });
        if (w) out.push(w);
        if (out.length >= PER_SOURCE) break;
    }
    return out;
}

/**
 * A subject going stale.
 *
 * MATERIAL rather than a topic, because the student HAS this — it is cards they
 * have already made — so condensing and teaching it back are the operations
 * that fit, and "explain it from the start" is not what is needed when recall
 * is the thing that failed.
 */
export function slippingSubjects(cards = [], now = Date.now()) {
    const o = retentionOutlook(cards, { now });
    const out = [];
    for (const s of (o.subjects || []).filter((x) => x.slipping > 0)
        .slice().sort((a, b) => b.slipping - a.slipping)) {
        const w = makeWorkpiece({
            kind: "material",
            body: `${s.slipping} of my ${s.subject} cards are past reliable recall. I need to get this back.`,
            title: `${s.subject} — slipping`,
            subject: s.subject,
            source: "slipping",
            ref: { page: "Review", label: "Your queue" },
        });
        if (w) out.push(w);
        if (out.length >= PER_SOURCE) break;
    }
    return out;
}

/**
 * Everything the app can offer, in the order it costs to skip.
 *
 * Same ordering argument `studyQueue`'s four tiers make and for the same
 * reason: a date cannot be moved, marks already lost come before marks about to
 * be lost, and the ordinary pile is last. Capped overall, because a picker with
 * twelve cards is a list and the student is choosing ONE thing to work on.
 */
export const CANDIDATE_MAX = 6;

export function candidates({
    quizzes = [],
    attempts = [],
    bankCards = [],
    cards = [],
    assessments = [],
    isReady = () => false,
    now = new Date(),
} = {}) {
    const at = now instanceof Date ? now : new Date(now);
    return [
        ...upcomingAssessments(assessments, at),
        ...droppedCriteria(bankCards, isReady, attempts),
        ...missedQuestions(quizzes, attempts, bankCards),
        ...slippingSubjects(cards, at.getTime()),
    ].slice(0, CANDIDATE_MAX);
}

export default {
    candidates, missedQuestions, droppedCriteria,
    upcomingAssessments, slippingSubjects, PER_SOURCE, CANDIDATE_MAX,
};
