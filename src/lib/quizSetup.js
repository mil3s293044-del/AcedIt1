/**
 * quizSetup — ONE model for the shape of a generated paper.
 *
 * ─── A PAPER IS A SPREAD OF MARKS, NOT ONE NUMBER ───────────────────────────
 * The generator asked for "Marks per Short Answer" and offered 3, 5 or 8 — one
 * figure for the whole quiz, so every written question on the paper was worth
 * exactly the same. That is the same shape failure this codebase has already
 * fixed three times in the MARKING half (`q.marks || 5` standing in for a
 * question worth nine): a single number pretending to be a paper. Marks are the
 * currency here — a score is a percentage of marks AVAILABLE, so a flat 5 makes
 * a one-line definition count the same as a four-mark explain.
 *
 * `markLo`/`markHi` is a RANGE and the generator is told to vary inside it the
 * way a real paper does. Nothing else had to change downstream: the player, the
 * marker and `questionMark` have read a per-question allocation the whole time.
 *
 * ─── A TOTAL THAT CANNOT BE KNOWN IS NEVER PRINTED AS ONE NUMBER ────────────
 * With a range the paper's total is a range too, and `paperShape` returns both
 * ends. Printing a midpoint as "38 marks" would be the invented figure this
 * codebase refuses on sight — the student would sit a 44-mark paper under a
 * summary that promised 38. When the range collapses (lo === hi) the two ends
 * are equal and the caller prints one number, because then it IS one number.
 *
 * ─── THE TIME IS A RULE, NOT A RANGE ────────────────────────────────────────
 * `MINUTES_PER_MARK` is VCAA's own rough working rate and it is PRINTED beside
 * the estimate, so a student can multiply it out and check us. That is the
 * xpRates lesson: a published figure nobody can verify is decoration.
 *
 * Everything here is pure and has no React in it, because these numbers are
 * shown to the student BEFORE they spend a chip — the megaUpload rule — and a
 * number on a button has to be the number the prompt was built from.
 */

/** An MCQ is worth one mark. The same constant `questionMark` scores against. */
export const MCQ_MARKS = 1;

export const COUNT_MIN = 4;
export const COUNT_MAX = 30;

/** Marks a single written question may be worth. 1 is a "state"; 10 is a part-heavy extended response. */
export const MARK_MIN = 1;
export const MARK_MAX = 10;

/** VCAA papers run at roughly this. Printed on screen so the estimate is checkable. */
export const MINUTES_PER_MARK = 1.5;

/**
 * THE KINDS OF QUESTION A PAPER MAY HOLD, and a paper may hold any of them.
 *
 * "Mixed" used to be a FOURTH TYPE in a one-of-four row, which made it a type
 * that secretly meant "MCQ plus written, at whatever that slider says" — two
 * different questions (which kinds, and how many of each) wearing one control.
 * A real paper is a SET of kinds with a count against each, so that is what is
 * asked for: tap the kinds, then say how many of each.
 *
 * Catalogue ORDER is load-bearing. The last kind a student picks absorbs the
 * remainder, so "last" has to be the same thing on every render — the order
 * they happened to tap in is not, and a stepper whose neighbour moves because
 * of tap order is a control nobody can predict.
 */
export const QUESTION_KINDS = [
    { id: "mcq",       label: "Multiple choice",   short: "MCQ",      sub: "four options",  written: false },
    { id: "short",     label: "Short answer",      short: "Written",  sub: "a few marks",   written: true },
    { id: "multipart", label: "Extended response", short: "Extended", sub: "(a) (b) (c)",   written: true },
];

const KIND_IDS = QUESTION_KINDS.map(k => k.id);

/** More than this many emphasised command terms is no emphasis at all. */
export const TERM_MAX = 4;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** The picked kinds, in CATALOGUE order, with anything unrecognised dropped. */
export const pickedKinds = (kinds = []) => KIND_IDS.filter(id => kinds.includes(id));

/** Round a minute figure to the nearest 5, never below 5. */
export const roundMinutes = (m) => Math.max(5, Math.round(m / 5) * 5);

/**
 * How many of each picked kind a paper of `count` questions holds.
 *
 * THE COUNTS ALWAYS SUM TO THE TOTAL, and the LAST picked kind is what makes
 * that true: it takes whatever is left. Ratios normalised to a total produce a
 * rounding the student did not choose — ask for a third of twelve across three
 * kinds and one of them silently comes back with five — so what is stored and
 * what is shown are counts, and the only derived figure is the remainder.
 *
 * EVERY PICKED KIND KEEPS AT LEAST ONE. A paper that says it holds three kinds
 * and arrives with two is the control saying one thing and the paper another,
 * which is the failure the old "mixed" slider could produce at 95%. Each
 * stepper is therefore clamped so the kinds after it still have one each.
 *
 * A kind with no stored count takes an even share rather than zero — a newly
 * ticked kind that lands on nought looks like the tick did not register.
 */
export function allocate({ kinds = [], counts = {}, count = 10 } = {}) {
    const picked = pickedKinds(kinds);
    const n = clamp(Math.round(Number(count) || 0), 0, COUNT_MAX);
    const out = {};
    if (!picked.length || n <= 0) return out;
    if (picked.length === 1) { out[picked[0]] = n; return out; }

    // Fewer questions than kinds cannot give every kind one. Defensive:
    // COUNT_MIN is above the number of kinds, so the picker cannot reach it.
    if (n <= picked.length) {
        picked.forEach((id, i) => { out[id] = i < n ? 1 : 0; });
        return out;
    }

    let left = n;
    picked.forEach((id, i) => {
        const rest = picked.length - i - 1;
        if (!rest) { out[id] = left; return; }      // the last one takes what is left
        const stored = Number(counts[id]);
        const want = Number.isFinite(stored) && stored > 0
            ? Math.round(stored)
            : Math.max(1, Math.round(n / picked.length));
        out[id] = clamp(want, 1, left - rest);
        left -= out[id];
    });
    return out;
}

/** The ceiling a stepper may be dragged to, given what the kinds after it need. */
export function maxFor(id, { kinds = [], counts = {}, count = 10 } = {}) {
    const picked = pickedKinds(kinds);
    const i = picked.indexOf(id);
    if (i < 0 || i === picked.length - 1) return 0;   // the remainder is not set by hand
    const alloc = allocate({ kinds, counts, count });
    const after = picked.slice(i + 1).length;
    const others = picked.slice(0, i).reduce((t, k) => t + (alloc[k] || 0), 0);
    return Math.max(1, clamp(Math.round(Number(count) || 0), 0, COUNT_MAX) - others - after);
}

/**
 * The whole shape, as the summary strip prints it.
 *
 * `marksLo`/`marksHi` bound the paper: every written question lands inside
 * [markLo, markHi], so the total cannot fall outside these. `varied` is what
 * the caller reads to decide between "38 marks" and "32–48 marks".
 */
export function paperShape({
    kinds = ["mcq", "short"], counts = {}, count = 10,
    markLo = 2, markHi = 6,
} = {}) {
    const alloc = allocate({ kinds, counts, count });
    const mcq = alloc.mcq || 0;
    // SHORT AND MULTIPART ARE BOTH WRITTEN, and both carry an allocation out of
    // the mark range — an extended question's range is the sum of its parts.
    // Only an MCQ is fixed at one mark, which is what `questionMark` scores.
    const short = (alloc.short || 0) + (alloc.multipart || 0);
    // A reversed pair is the handles crossed, not an empty paper.
    const lo = clamp(Math.round(Number(markLo) || MARK_MIN), MARK_MIN, MARK_MAX);
    const hi = clamp(Math.round(Number(markHi) || MARK_MIN), MARK_MIN, MARK_MAX);
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];

    const base = mcq * MCQ_MARKS;
    const marksLo = base + short * a;
    const marksHi = base + short * b;

    return {
        alloc, kinds: pickedKinds(kinds),
        mcq, short,
        total: mcq + short,
        markLo: a, markHi: b,
        marksLo, marksHi,
        varied: marksLo !== marksHi,
        minutesLo: roundMinutes(marksLo * MINUTES_PER_MARK),
        minutesHi: roundMinutes(marksHi * MINUTES_PER_MARK),
    };
}

/**
 * The mark-allocation instruction.
 *
 * It asks for a SPREAD rather than a mean, and names both ends, because a model
 * told "average 4 marks" writes twelve four-mark questions. The weighting line
 * is what makes it read as a paper: real papers carry more short questions than
 * long ones, so without it the spread comes back uniform.
 */
export function markRule({ markLo, markHi, short }) {
    if (!short) return "";
    const { markLo: lo, markHi: hi } = paperShape({ types: "short_only", count: short, markLo, markHi });
    if (lo === hi) {
        return `=== MARK ALLOCATION ===
- Every written question is worth exactly ${lo} mark${lo === 1 ? "" : "s"}.
- Set "marks" to ${lo} on each one, and write a model answer with ${lo} distinct creditable point${lo === 1 ? "" : "s"}.`;
    }
    return `=== MARK ALLOCATION ===
- Written questions are worth between ${lo} and ${hi} marks and MUST VARY across that range, the way a real paper does. Do not give every question the same allocation.
- Weight it like a paper: more questions at the low end than the high end, with one or two of the heaviest.
- The "marks" field on each question is its allocation, and the model answer must contain exactly that many distinct creditable points — a ${hi}-mark answer is not a ${lo}-mark answer written at greater length.
- The command term has to match the allocation: a ${lo}-mark question asks for recall or a single step; a ${hi}-mark question asks for reasoning that can be marked in ${hi} parts.`;
}

/**
 * Asking for stimulus is an ENCOURAGEMENT and never a licence.
 *
 * `STIMULUS_RULE` is sent on every generate whatever this returns, because that
 * rule exists to stop a question referring to material it does not carry — the
 * failure where the app asked about Source B, never showed it, and then marked
 * the student down for the gap. Turning the rule OFF would reopen exactly that.
 * So the toggle only ever ADDS a request for source-based questions, and it
 * repeats the refusal rather than relaxing it.
 */
export function stimulusAsk(on) {
    if (!on) return "";
    return `=== BUILD SOME QUESTIONS FROM SOURCE MATERIAL ===
Where the study material genuinely supports it, build 2-3 questions around a reproduced source — an extract, a data table, a short case study — carried IN FULL in that question's "stimulus" field, with the parts asked about it.
Still never invent a source, and still omit "stimulus" on every question that does not need one. A fabricated extract is worse than a plain question.`;
}

export default {
    MCQ_MARKS, COUNT_MIN, COUNT_MAX, MARK_MIN, MARK_MAX, MINUTES_PER_MARK,
    QUESTION_KINDS, TERM_MAX,
    roundMinutes, pickedKinds, allocate, maxFor, paperShape, markRule, stimulusAsk,
};
