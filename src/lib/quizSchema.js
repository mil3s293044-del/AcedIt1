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

/**
 * Marks a part is worth when it does not say. MCQs are one mark, always.
 *
 * Exported because the generators WRITE this value onto a question they are
 * creating, and a second copy of it is how a question comes out worth 5 here
 * and 4 there. Readers never need it: `normaliseQuestion(q, i).marks` already
 * applies it, and hand-rolling `q.marks || 5` is the expression that reads 5
 * for a multipart question worth nine.
 */
export const DEFAULT_SHORT_MARKS = 5;

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
 * A QUESTION MAY ONLY REFER TO MATERIAL IT CARRIES.
 *
 * VCAA examines from stimulus — an extract, a data table, a case study, a
 * graph — and the generator, reading a textbook, would cheerfully write "Using
 * Source B, explain…" or "Refer to the case study on p.14". Nothing in the
 * saved quiz held Source B. So the question was unanswerable, the student wrote
 * what they could, and THE MARKER THEN MARKED THEM DOWN FOR IT — the app asking
 * about something it never showed them and then docking marks for the gap.
 *
 * `stimulus` is that material, reproduced in full on the question. It belongs
 * to the QUESTION and not to a part, which is what a real paper does: one
 * source, parts (a), (b), (c) about it.
 *
 * A bare string is accepted because a generator will sometimes return one, and
 * a source with no label is still a source — far better than dropping it.
 * Content is what matters; the label is a caption.
 */
export function normaliseStimulus(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
        const content = raw.trim();
        return content ? { label: "", content } : null;
    }
    if (typeof raw !== "object") return null;
    const content = String(raw.content ?? raw.text ?? raw.source ?? "").trim();
    if (!content) return null;
    return { label: String(raw.label ?? raw.title ?? "").trim(), content };
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
    const stimulus = normaliseStimulus(q.stimulus);

    if (rawParts.length > 0) {
        const parts = rawParts.map((p, i) => normalisePart(p, i, rawParts.length, qIndex));
        return {
            index: qIndex,
            stem: q.question || q.stem || "",
            stimulus,
            multipart: true,
            parts,
            marks: parts.reduce((sum, p) => sum + p.marks, 0),
        };
    }

    // Legacy: the question IS the part. A quiz generated before this existed
    // has no stimulus and gets null, which every renderer draws as nothing.
    const only = normalisePart(q, 0, 1, qIndex);
    return {
        index: qIndex,
        stem: q.question || "",
        stimulus,
        multipart: false,
        parts: [{ ...only, prompt: only.prompt || q.question || "" }],
        marks: only.marks,
    };
}

/**
 * The stimulus as the MODEL should see it — inside a generate or a marking
 * prompt. Marking without it is the same failure from the other side: an
 * examiner asked to judge an answer to a question they cannot read.
 */
export function stimulusText(question) {
    const st = normaliseStimulus(question?.stimulus);
    if (!st) return "";
    return `[${st.label || "Source material"}]\n${st.content}`;
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

/**
 * A generated question, coerced into the stored shape.
 *
 * Both quiz generators — the one that builds from notes and the one that
 * reshuffles from the source file — have to do this, and doing it twice is how
 * one of them ends up accepting a part shape the other rejects. `marksValue`
 * is the fallback allocation the caller's settings chose.
 */
export function formatGeneratedParts(raw, marksValue = DEFAULT_SHORT_MARKS) {
    const parts = (Array.isArray(raw?.parts) ? raw.parts : [])
        .filter((p) => p && (p.prompt || p.question))
        .map((p, i) => {
            const mcq = p.type === "mcq" && Array.isArray(p.options) && p.options.length >= 2;
            return {
                label: p.label || autoLabel(i),
                type: mcq ? "mcq" : "short",
                prompt: p.prompt || p.question,
                marks: mcq ? 1 : Math.max(1, Number(p.marks) || marksValue),
                model_answer: mcq ? undefined : (p.model_answer || ""),
                options: mcq ? p.options.slice(0, 4) : undefined,
                correct_answer: mcq ? (p.correct_answer ?? 0) : undefined,
            };
        });
    // A question whose parts all failed the filter is a stem with nothing under
    // it — the caller drops it rather than rendering an empty shell.
    return parts;
}

/**
 * Does this question's text refer to material it does not carry?
 *
 * A REFERENCE WITHOUT A SOURCE IS AN UNANSWERABLE QUESTION, and the failure is
 * silent: it renders perfectly and the student simply cannot do it. Every
 * generator runs this over what came back so the problem is caught where it was
 * produced rather than in front of somebody sitting the paper.
 *
 * Deliberately narrow. It matches the phrasings that POINT AT A NAMED ARTEFACT
 * the model was reading and did not reproduce — a source, an extract, a figure,
 * a page. It does NOT match "the following", "below" or "above", which refer to
 * the question's own text, or a bare "the graph" with no locator, because a
 * question can legitimately describe one in words. Guessing wide here would
 * throw away good questions, which is the worse error of the two.
 */
const DANGLING = [
    /\b(?:refer(?:ring)? to|according to|using|from|in|see)\s+(?:the\s+)?(?:source|extract|passage|stimulus|case\s*study|document|text)\b/i,
    /\bsource\s+[A-Z0-9]\b/,
    /\b(?:figure|fig\.?|table|diagram|graph|image|exhibit|appendix)\s*\d/i,
    /\b(?:on|from|see)\s+page\s*\d/i,
    /\bthe\s+(?:above|attached|provided|accompanying)\s+(?:source|extract|passage|text|document|case\s*study)\b/i,
];

export function referencesMissingSource(raw) {
    if (normaliseStimulus(raw?.stimulus)) return false;
    const text = [
        raw?.question, raw?.stem,
        ...(Array.isArray(raw?.parts) ? raw.parts.map((p) => p?.prompt || p?.question) : []),
    ].filter(Boolean).join("\n");
    if (!text) return false;
    return DANGLING.some((re) => re.test(text));
}

/**
 * THE RULE, WRITTEN ONCE. Four generators produce questions — the main quiz
 * builder, reshuffle, the exam simulator and Active Recall — and a prompt rule
 * pasted into four files is the copy that rots: three of them get a fix and the
 * fourth quietly keeps shipping unanswerable questions. Imported, never
 * mirrored, the same way `market.js` and `megaUpload.js` are.
 */
export const STIMULUS_RULE = `=== SOURCE MATERIAL (CRITICAL) ===
A QUESTION MAY ONLY REFER TO MATERIAL IT CARRIES. If a question mentions a source, extract, passage, case study, data table, figure, graph or page — anything the student has to READ in order to answer it — you MUST reproduce that material IN FULL in that question's "stimulus" field.
- "stimulus" is { "label": "Source A" / "Table 2" / "Case study: Bhopal", "content": "the material itself" }.
- It belongs to the QUESTION, not to a part: one source, then parts (a), (b), (c) about it, the way a real paper sets it.
- Reproduce text VERBATIM. A paraphrase changes what the question is testing.
- For a table or a figure, write it out as a markdown table, or state every value and label in it. The student cannot see the original file — only what you put here.
- Refer to it by the SAME label you gave it. Write "Using Source A" only when the stimulus label is "Source A".
- NEVER write "refer to the case study on page 14", "see Figure 2", "according to the passage above" or "using the data provided" unless that exact material is in "stimulus". A student cannot answer it, and it will be marked as though they failed to.
- Most questions need no source. Omit "stimulus" entirely for those — do not invent one.`;

/**
 * The same rule for a generator that stores a question as a PLAIN STRING.
 *
 * Active Recall keeps `session.questions` as a string array and the exam
 * simulator reads it back that way, so there is no field to put a source in.
 * Inlining it is the correct answer there rather than a compromise: the
 * question renders as one block of text, so a quoted preamble reads exactly
 * like a paper. The rule itself is unchanged — a question may only refer to
 * material it carries.
 */
export const STIMULUS_RULE_INLINE = `=== SOURCE MATERIAL (CRITICAL) ===
A QUESTION MAY ONLY REFER TO MATERIAL IT CARRIES. If a question needs a source, extract, passage, case study, data table or figure to be answerable, write that material INTO the question text itself, as a quoted preamble before the task:

  Source A: "<the material, verbatim>"
  Using Source A, explain ...

- Reproduce text VERBATIM; a paraphrase changes what is being tested.
- Write a table out as a markdown table, or state every value and label in it. The student cannot see the original file — only what you put in the question.
- NEVER write "refer to the case study on page 14", "see Figure 2" or "using the data provided" without the material being right there in the question. A student cannot answer it, and it will be marked as though they failed to.
- Most questions need no source. Do not invent one.`;

/** The `stimulus` property, for a generator's response_json_schema. */
export const STIMULUS_SCHEMA = {
    type: "object",
    properties: {
        label: { type: "string" },
        content: { type: "string" },
    },
};

/** A human label for a part: "3" or "3b". Used in feedback and headings. */
export const partTitle = (q, p) =>
    p.label ? `${q.index + 1}${p.label}` : String(q.index + 1);
