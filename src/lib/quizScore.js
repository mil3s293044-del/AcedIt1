/**
 * quizScore — ONE mark for a question, read by every surface that prints one.
 *
 * ═══ The bug this exists to end ═════════════════════════════════════════════
 * A student saw a header pill reading **3/5** and, eight inches below it on the
 * same card, a red **0/5** — on a question whose answer box said "No answer
 * written". Five different places computed a question's mark and they disagreed
 * about both the numerator and the denominator:
 *
 *   header pill          fb.marks                    ← the model's RAW claim
 *   MarkPanel            fb.mark.marks               ← reconciled from criteria
 *   calcAdjustedScore    fb.marks + self, out of `q.marks || 5`
 *   buildQuestionResults fb.marks, but mark.criteria for the evidence
 *   totalMarksAwarded    fb.marks                    ← and XP was paid on it
 *
 * ═══ THE CRITERIA WIN. That was already decided; nothing read it ════════════
 * `normaliseMark` has always recomputed the total from the itemised criteria
 * when the model's stated figure contradicts them — quizMarking's header says
 * why at length, and it is the rule the whole marking panel rests on. What was
 * missing is that the reconciled number lived on `fb.mark.marks` and every
 * OTHER reader took `fb.marks`, the unreconciled claim. So the one place that
 * had it right was the small panel, and the big number, the score, the saved
 * attempt and the XP payout all had it wrong.
 *
 * ═══ A BLANK ANSWER SCORES ZERO, whatever the marker says ═══════════════════
 * The 3/5 in that screenshot was awarded to text that does not exist. A marker
 * handed an empty string can still return a plausible-looking total, and no
 * amount of reconciliation catches it when the criteria come back equally
 * invented. Nothing written means nothing to mark — and the student can still
 * award themselves marks through the "did you answer this on paper?" box,
 * which is the ONLY legitimate way a blank answer scores.
 *
 * ═══ XP IS PAID ON THE AUTO MARK, NEVER ON THE SELF MARK ════════════════════
 * The self-mark box promises "XP isn't affected — this just updates your
 * displayed total", and that promise is the only thing stopping the box being a
 * free XP dial. So this returns BOTH: `auto` for anything that pays out or is
 * persisted as the real score, and `awarded` for what the student sees.
 */
import { normaliseQuestion } from "@/lib/quizSchema";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Did the student actually write anything? Whitespace is not an answer. */
export function hasAnswer(text) {
    return typeof text === "string" && text.trim().length > 0;
}

/**
 * One question's mark, from every input that can affect it.
 *
 * `answerText` is what the student wrote — for a multipart question that is all
 * of its parts joined, because the bare index holds nothing. Pass undefined to
 * skip the blank check (an MCQ has no written answer and is marked on its
 * selection).
 */
export function questionMark(question, index, feedback, selfMark, answerText) {
    const shape = normaliseQuestion(question, index);
    const outOf = shape.marks;
    const mcq = question?.type === "mcq";

    // The itemisation wins whenever there is one. `fb.marks` is what the model
    // claimed; `fb.mark.marks` is what its own criteria add up to.
    const claimed = num(feedback?.marks);
    const reconciled = feedback?.mark?.itemised ? num(feedback.mark.marks) : claimed;

    // Nothing written, nothing to mark. Anything answered by SELECTION is
    // exempt, because it carries no text at all and an empty string is what it
    // correctly looks like: a legacy MCQ, and a multipart question whose parts
    // are all MCQs — miss the second and a question answered perfectly by
    // clicking the right options scores zero.
    const writable = shape.parts.some((p) => p.type !== "mcq");
    const blank = !mcq && writable && answerText !== undefined && !hasAnswer(answerText);
    const auto = blank ? 0 : Math.max(0, Math.min(outOf, reconciled));

    const self = Math.max(0, Math.min(outOf, num(selfMark)));
    return {
        outOf,
        auto,
        self,
        // What the student sees. Capped at the allocation so a self-mark cannot
        // push a question past what it is worth.
        awarded: Math.max(0, Math.min(outOf, auto + self)),
        blank,
        // True when the criteria overrode the model's stated total — surfaced
        // so a future screen can say so rather than silently differing.
        overridden: !!feedback?.mark?.itemised && reconciled !== claimed,
        selfMarked: self > 0,
    };
}

/**
 * The whole attempt. `auto` is the real score — persisted, and what XP is paid
 * on. `awarded` is the adjusted total including anything self-marked.
 */
export function attemptScore(questions = [], feedback = [], selfMarks = {}, answerTextFor) {
    let auto = 0;
    let awarded = 0;
    let max = 0;
    let selfMarked = 0;

    questions.forEach((q, i) => {
        const text = typeof answerTextFor === "function" ? answerTextFor(i) : undefined;
        const m = questionMark(q, i, feedback?.[i], selfMarks?.[i], text);
        max += m.outOf;
        auto += m.auto;
        awarded += m.awarded;
        selfMarked += m.self;
    });

    const pct = (n) => (max > 0 ? Math.round((n / max) * 100) : 0);
    return {
        max,
        auto,
        awarded,
        selfMarked,
        autoPct: pct(auto),
        awardedPct: pct(awarded),
        hasSelfMarked: selfMarked > 0,
    };
}

/**
 * Whether a question counts as "got right" for the questions-correct tally.
 *
 * 80% of the allocation, which is the threshold this has always used — stated
 * once here so the three places that had it written out cannot drift.
 */
export const CORRECT_AT = 0.8;
export function isCorrect(question, mark) {
    if (!mark || mark.outOf <= 0) return false;
    return question?.type === "mcq"
        ? mark.auto >= 1
        : mark.auto >= mark.outOf * CORRECT_AT;
}

/**
 * Whether the adaptive drill should re-ask this one.
 *
 * A LOWER BAR THAN `isCorrect` ON PURPOSE: the verdict counts a short answer as
 * missed below 80%, the drill re-asks below 60%. That gap is deliberate — a
 * four-out-of-five is worth noting and is not worth sitting again — and it is
 * stated here because the count printed on the button and the filter behind it
 * were two copies of the same threshold, one of which could drift.
 */
export const DRILL_UNDER = 0.6;
export function needsDrill(question, mark) {
    if (!mark || mark.outOf <= 0) return false;
    return question?.type === "mcq"
        ? mark.auto < 1
        : mark.auto < mark.outOf * DRILL_UNDER;
}
