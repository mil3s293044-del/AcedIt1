/**
 * quizSchema — one shape for a question, whatever shape it was stored in.
 *
 * VCAA questions come in parts: a stem that sets up the situation, then (a),
 * (b), (c) worth two, four and three marks, each marked separately. A quiz
 * that can only hold one prompt and one answer per question cannot imitate the
 * thing students are actually sitting.
 *
 * ─── Why this is an adapter and not a migration ─────────────────────────────
 * `questions` is jsonb, so a new shape costs no migration — but 76 places
 * across thirteen files read `.questions`, and QuizPlayer alone branches on
 * `type === 'mcq'` forty-one times. Teaching all of them about a second format
 * is how you end up with a screen that works for new quizzes and quietly
 * breaks for every quiz the ~130 existing users already have.
 *
 * So nothing branches. `normalise` turns BOTH shapes into the same thing: a
 * stem plus one or more parts. A legacy short-answer question becomes a stem
 * with a single, unlabelled part, and the code downstream never learns there
 * was ever another format. Same rule onboardingTasks follows — derive the
 * truth from the data rather than storing a flag that says which kind it is.
 *
 * ─── The one thing that must not change ─────────────────────────────────────
 * ANSWER KEYS. Every attempt ever saved keys its answers by question index:
 * `user_answers[3]`. A single-part question therefore keeps the bare index as
 * its key — "3", not "3a" — so every existing attempt still reads back, and
 * `quizDeck`'s "retry the ones you got wrong" keeps working on old rows. Only
 * genuinely multi-part questions use the suffixed form.
 */

/** Marks a part is worth when it does not say. MCQs are one mark, always. */
const DEFAULT_SHORT_MARKS = 5;

const isPart = (p) => p && typeof p === "object" && (p.prompt || p.question || p.type);

/** "a", "b", … "z", then "aa". Only used when a part has no label of its own. */
export function autoLabel(i) {
    let n = i, out = "";
    do { out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return out;
}

/**
 * The key an answer is stored under.
 *
 * Bare index for a single-part question — that is the legacy format and every
 * saved attempt depends on it. Suffixed only when the question really has
 * parts.
 */
export const partKey = (qIndex, partIndex, total) =>
    total > 1 ? `${qIndex}${autoLabel(partIndex)}` : String(qIndex);

function normalisePart(raw, i, total, qIndex) {
    const type = raw?.type === "mcq" ? "mcq" : "short";
    const marks = type === "mcq"
        ? 1
        : Math.max(1, Number(raw?.marks) || Number(raw?.marks_allocation) || DEFAULT_SHORT_MARKS);
    return {
        key: partKey(qIndex, i, total),
        label: total > 1 ? (raw?.label || autoLabel(i)) : null,
        type,
        prompt: raw?.prompt || raw?.question || "",
        marks,
        options: Array.isArray(raw?.options) ? raw.options : undefined,
        correct_answer: raw?.correct_answer,
        model_answer: raw?.model_answer || "",
        // Criterion-level marking, when the generator supplied it. Absent is
        // normal and the marker falls back to the model answer.
        criteria: Array.isArray(raw?.criteria) ? raw.criteria : [],
        explanation: raw?.explanation || "",
    };
}

/**
 * One question, in the shape everything downstream uses.
 *
 * `stem` is the shared setup. On a legacy question the stem IS the prompt and
 * the single part carries it too, so a renderer can print the stem and the
 * parts without special-casing either.
 */
export function normaliseQuestion(raw, qIndex = 0) {
    const q = raw && typeof raw === "object" ? raw : {};
    const rawParts = Array.isArray(q.parts) ? q.parts.filter(isPart) : [];

    if (rawParts.length > 0) {
        const parts = rawParts.map((p, i) => normalisePart(p, i, rawParts.length, qIndex));
        return {
            index: qIndex,
            stem: q.question || q.stem || "",
            multipart: true,
            parts,
            marks: parts.reduce((sum, p) => sum + p.marks, 0),
        };
    }

    // Legacy: the question IS the part.
    const only = normalisePart(q, 0, 1, qIndex);
    return {
        index: qIndex,
        stem: q.question || "",
        multipart: false,
        parts: [{ ...only, prompt: only.prompt || q.question || "" }],
        marks: only.marks,
    };
}

/** Every question in a quiz, normalised. Returns [] for anything unreadable. */
export function normaliseQuestions(quiz) {
    const list = Array.isArray(quiz?.questions) ? quiz.questions : [];
    return list.map((q, i) => normaliseQuestion(q, i));
}

/** Every markable part in the quiz, flattened, in order. */
export function allParts(quiz) {
    return normaliseQuestions(quiz).flatMap((q) => q.parts.map((p) => ({ ...p, question: q })));
}

/** Total marks available. The currency for scoring — not the question count. */
export function quizMarks(quiz) {
    return normaliseQuestions(quiz).reduce((sum, q) => sum + q.marks, 0);
}

/**
 * Is this MCQ part answered correctly? Answers arrive off JSON with their
 * indices as strings, so this compares as numbers.
 */
export function mcqCorrect(part, given) {
    if (part?.type !== "mcq") return false;
    if (given === undefined || given === null || given === "") return false;
    return parseInt(given, 10) === part.correct_answer;
}

/**
 * Score as a percentage of marks available.
 *
 * `earned` is a map of part key → marks. Percentage of MARKS, not of questions
 * answered, so a four-mark part b counts for twice a two-mark part a — which
 * is the entire reason for having parts.
 */
export function scoreFromMarks(quiz, earned = {}) {
    const total = quizMarks(quiz);
    if (total <= 0) return 0;
    const got = allParts(quiz).reduce((sum, p) => {
        const m = Number(earned[p.key]);
        return sum + (Number.isFinite(m) ? Math.max(0, Math.min(p.marks, m)) : 0);
    }, 0);
    return Math.round((got / total) * 100);
}

/** A human label for a part: "3" or "3b". Used in feedback and headings. */
export const partTitle = (q, p) =>
    p.label ? `${q.index + 1}${p.label}` : String(q.index + 1);
