/**
 * quizMarking — a mark that shows its working.
 *
 * The marker used to return `{ marks, what_wrong, improve }`: a number and two
 * paragraphs. The landing page, meanwhile, shows the thing students are
 * actually being sold — a criterion list where you can see WHICH mark you
 * dropped, and a word-level edit showing what the better answer said instead.
 * The page was writing a cheque the product did not cash.
 *
 * So a mark is now itemised:
 *
 *   criteria — what the assessor was looking for, each got or missed, each
 *              worth a stated number of marks. This is the part that turns
 *              "you got 2 out of 4" into something a student can act on.
 *   edits    — word or phrase level swaps in their own answer, with what the
 *              swap buys. The landing page's MarkedWord, applied to their work.
 *
 * ─── The rule that keeps it honest ──────────────────────────────────────────
 * THE ITEMISATION IS THE TRUTH. If a model returns "2 marks" and then lists
 * three criteria it says were all met, one of those two statements is wrong,
 * and the student can see both at once. The criteria win — they are the
 * working, the number is the summary — and the number is recomputed from them.
 * A total that visibly contradicts the list under it costs the marking all its
 * credibility, which is the one thing this feature is for.
 *
 * Everything degrades. A response with no criteria falls back to the prose
 * shape and renders as it always did; a mark that arrives as nonsense scores
 * zero rather than poisoning the total.
 */

import { normaliseAnnotation } from "@/lib/annotate";

const str = (v) => (typeof v === "string" ? v.trim() : "");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** A criterion is only worth rendering if it says what was being looked for. */
function normaliseCriterion(raw, fallbackWorth) {
    const text = str(raw?.text || raw?.criterion);
    if (!text) return null;
    const worth = Number(raw?.worth);
    return {
        text,
        got: raw?.got === true,
        note: str(raw?.note),
        worth: Number.isFinite(worth) && worth > 0 ? worth : fallbackWorth,
    };
}

/** An edit needs both halves; "improve your wording" is not an edit. */
function normaliseEdit(raw) {
    const was = str(raw?.was), now = str(raw?.now);
    if (!was || !now || was === now) return null;
    const worth = Number(raw?.worth);
    return {
        was, now,
        why: str(raw?.why),
        criterion: str(raw?.criterion) || "Word choice",
        worth: Number.isFinite(worth) && worth > 0 ? worth : 1,
    };
}

/**
 * One part's mark, itemised and reconciled.
 *
 * `outOf` comes from the part, never from the model — a marker that invents
 * its own denominator can quietly rescale a student's score.
 */
export function normaliseMark(raw, outOf = 1) {
    const max = Math.max(1, Number(outOf) || 1);
    const m = raw && typeof raw === "object" ? raw : {};

    const criteria = (Array.isArray(m.criteria) ? m.criteria : [])
        .map((c) => normaliseCriterion(c, 1))
        .filter(Boolean);
    const edits = (Array.isArray(m.edits) ? m.edits : [])
        .map(normaliseEdit)
        .filter(Boolean);
    // Spans of the student's own answer to underline in place. `edits` was the
    // first shape of this and normaliseAnnotation still reads it, so a marker
    // response written against the old prompt keeps working.
    const annotations = [
        ...(Array.isArray(m.annotations) ? m.annotations : []),
        ...(Array.isArray(m.edits) ? m.edits : []),
    ].map(normaliseAnnotation).filter(Boolean);

    const stated = Number(m.marks);
    let marks = Number.isFinite(stated) ? clamp(stated, 0, max) : 0;
    let reconciled = false;

    if (criteria.length > 0) {
        // The itemisation wins. See the header — a total that contradicts the
        // list printed under it is worse than either one alone.
        const fromCriteria = clamp(
            criteria.reduce((sum, c) => sum + (c.got ? c.worth : 0), 0), 0, max);
        reconciled = fromCriteria !== marks;
        marks = fromCriteria;
    }

    return {
        marks,
        outOf: max,
        criteria,
        edits,
        annotations,
        // Kept so a response with no itemisation renders exactly as it used to.
        whatWrong: str(m.what_wrong || m.whatWrong),
        improve: str(m.improve),
        reconciled,
        itemised: criteria.length > 0 || annotations.length > 0,
    };
}

/** Did they get everything? Used for the "clean mark" state. */
export const isFullMarks = (mark) => mark.outOf > 0 && mark.marks >= mark.outOf;

/**
 * The criteria worth showing first: the ones they missed.
 *
 * A list that opens with three ticks buries the one line the student needed to
 * read. Missed first, then the ones they got, each keeping its own order.
 */
export function orderedCriteria(mark) {
    const missed = mark.criteria.filter((c) => !c.got);
    const got = mark.criteria.filter((c) => c.got);
    return [...missed, ...got];
}

/** Marks lost, per criterion, for the "here is where the marks went" line. */
export const marksLost = (mark) =>
    mark.criteria.filter((c) => !c.got).reduce((sum, c) => sum + c.worth, 0);
