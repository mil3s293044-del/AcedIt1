/**
 * grade — what a marking response is scored on, as pure functions.
 *
 * Split out of the runner deliberately. Everything here is a decision about
 * whether the app was right, and a decision like that cannot be checked once it
 * is inside an async loop that costs money to run — the same reasoning
 * `expiredKeys` and `pageIndices` are pure for. `evalCases.test.mjs` runs every
 * one of these against hand-built fixtures offline, so the grader is verified
 * before a single token is spent on it.
 *
 * ─── WHAT IS PROGRAMMATIC AND WHAT NEEDS A JUDGE ────────────────────────────
 * The marking response is highly structured — a number, a criteria list with
 * worths and verdicts, and annotations carrying verbatim quotes — so most of
 * what matters is checkable exactly. Only the REGISTER genuinely needs
 * judgement, and it gets one judge call rather than a judge over the whole
 * output, because asking a model "is this mark right" would score the eval on a
 * second opinion instead of on the gold.
 *
 * ─── THE HEADLINE IS `mark_exact` AND THE SHAPE IS `mark_mae` ───────────────
 * A pass-rate alone cannot tell "out by one on a four-mark question" from "out
 * by four", and those are different failures: one is a borderline criterion,
 * the other is a marker that did not read the answer. Both are reported.
 * `mark_exact` is first because the report's headline metric is the first
 * binary one.
 */

/* ── Reading a marking response ──────────────────────────────────────────── */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The mark the app would actually persist and pay XP on.
 *
 * THE RECONCILED FIGURE WINS, because that is what `quizScore.js` does: when
 * the model's stated total contradicts its own criteria the criteria are the
 * ledger and the number is recomputed. Grading the raw claim would score a
 * marker on a figure no student ever sees, and would mark the app wrong for a
 * disagreement the app already fixes.
 */
export function awardedMark(fb, outOf) {
    const crit = Array.isArray(fb?.criteria) ? fb.criteria : [];
    const usable = crit.filter((c) => c && typeof c.text === "string" && c.text.trim() && num(c.worth) !== null);
    if (usable.length) {
        const earned = usable.filter((c) => c.got === true).reduce((t, c) => t + num(c.worth), 0);
        return Math.max(0, Math.min(outOf, earned));
    }
    const stated = num(fb?.marks);
    if (stated === null) return null;
    return Math.max(0, Math.min(outOf, stated));
}

/** Criteria worths must add up to the question's allocation. */
export function criteriaSumOk(fb, outOf) {
    const crit = Array.isArray(fb?.criteria) ? fb.criteria : [];
    // A blank answer or an MCQ can legitimately come back with no criteria;
    // there is nothing to itemise. Scored as "not applicable", never as a fail,
    // or the metric would punish the correct behaviour on a third of the set.
    if (!crit.length) return null;
    const sum = crit.reduce((t, c) => t + (num(c?.worth) ?? 0), 0);
    return sum === outOf;
}

/**
 * Every annotation quote must appear in the student's answer CHARACTER FOR
 * CHARACTER.
 *
 * `annotate.js` matches exactly and silently drops anything that does not, so a
 * paraphrased quote is an annotation the student never sees — the feedback is
 * simply missing, with nothing anywhere reporting it. That makes this the
 * highest-value programmatic check in the set: it is invisible in production by
 * construction.
 */
export function quotesVerbatim(fb, studentAnswer) {
    const anns = Array.isArray(fb?.annotations) ? fb.annotations : [];
    if (!anns.length) return null;           // zero annotations is normal, not a fail
    const hay = String(studentAnswer ?? "");
    const quoted = anns.filter((a) => typeof a?.quote === "string" && a.quote.trim());
    if (!quoted.length) return null;
    return quoted.every((a) => hay.includes(a.quote));
}

/**
 * Every annotation is bound to a criterion that exists.
 *
 * `criterionIndexFor` REFUSES rather than guesses, so an unlinked annotation is
 * safe — but it also cannot claim a mark, which means the evidence for a
 * dropped mark silently stops pointing at it. And watch `Number(null) === 0`:
 * the index is checked for being a real number before it is compared, because
 * coercing attaches every unlinked annotation to the first criterion on the
 * page, plausibly and wrongly. That trap has reached five modules in this repo.
 */
export function annotationsLinked(fb) {
    const anns = Array.isArray(fb?.annotations) ? fb.annotations : [];
    if (!anns.length) return null;
    const crit = Array.isArray(fb?.criteria) ? fb.criteria : [];
    return anns.every((a) => {
        const i = num(a?.criterion_index);
        return i !== null && Number.isInteger(i) && i >= 0 && i < crit.length;
    });
}

/**
 * A full-mark answer gets NO comment and NO annotations.
 *
 * The rubric's own words: "For a question that scored full marks, leave
 * what_wrong and improve as empty strings — do not write praise", and "never
 * annotate an answer that scored full marks". Only applicable where the gold is
 * full marks, so it returns null elsewhere rather than passing vacuously on
 * two-thirds of the set and inflating itself.
 */
export function cleanIsSilent(fb, goldMarks, outOf) {
    if (goldMarks !== outOf) return null;
    const said = (v) => typeof v === "string" && v.trim().length > 0;
    const anns = Array.isArray(fb?.annotations) ? fb.annotations : [];
    return !said(fb?.what_wrong) && !said(fb?.improve) && anns.length === 0;
}

/**
 * A missed criterion carries a note that stands on its own.
 *
 * "A missed criterion with an empty note is a mark the student cannot act on" —
 * and it is the ONLY thing shown for a mark with nothing quotable, which is
 * exactly the case that most needs explaining. 40 characters is a floor on
 * "says something", not a quality judgement; the judge covers quality.
 */
export function missedHaveNotes(fb) {
    const crit = Array.isArray(fb?.criteria) ? fb.criteria : [];
    const missed = crit.filter((c) => c && c.got === false);
    if (!missed.length) return null;
    return missed.every((c) => typeof c.note === "string" && c.note.trim().length >= 40);
}

/* ── The whole programmatic grade for one case ───────────────────────────── */

/**
 * `null` from any check above means NOT APPLICABLE and is dropped rather than
 * scored. A metric that quietly counts its inapplicable cases as passes reports
 * a number that rises when the set grows, which is worse than no number.
 */
export function programmaticGrade(caseRow, fb) {
    const outOf = caseRow.marks;
    const gold = caseRow.gold_marks;
    const got = awardedMark(fb, outOf);
    const studentText = caseRow.parts
        ? caseRow.parts.map((p) => p.student_answer ?? "").join("\n")
        : (caseRow.student_answer ?? "");

    const out = {
        mark_exact: got !== null && got === gold ? 1 : 0,
        mark_mae: got === null ? outOf : Math.abs(got - gold),
    };
    const maybe = {
        crit_sum: criteriaSumOk(fb, outOf),
        quote_ok: quotesVerbatim(fb, studentText),
        link_ok: annotationsLinked(fb),
        clean_silent: cleanIsSilent(fb, gold, outOf),
        note_ok: missedHaveNotes(fb),
    };
    for (const [k, v] of Object.entries(maybe)) if (v !== null) out[k] = v ? 1 : 0;
    return out;
}

/* ── The judge, for the one thing a check cannot see ─────────────────────── */

/**
 * The register rubric.
 *
 * CONCRETE CHECKABLE CLAIMS, never a 1–5 helpfulness scale — the guidance this
 * was built from is explicit about that, and a vague scale is also what makes
 * two judges disagree. Each line is something a reader can point at in the text.
 *
 * It judges the WRITING and is told the mark is graded elsewhere, because a
 * judge asked to form its own view of the mark would quietly become a second,
 * unlabelled gold — and a worse one.
 */
export const REGISTER_RUBRIC = `You are checking whether a piece of marking feedback is written the way a VCAA
examiner's report is written. You are NOT judging whether the mark is correct;
that is scored separately against a gold mark and is none of your concern here.

Score each claim 1 if it holds of the feedback, 0 if it does not, and null if
the feedback contains nothing the claim could apply to.

  addresses_response — Comments are about what the RESPONSE did, not about what
    the student is or feels. "This response describes the change without naming
    the transfer" holds; "you didn't understand this" and "great effort" do not.

  no_praise — There is no praise, encouragement or exclamation. A question that
    scored full marks should carry no comment at all.

  names_command_term — WHERE THE RESPONSE MISREAD THE COMMAND TERM, the feedback
    says so. If the question said EVALUATE and the answer described, the
    feedback names that. Null when the command term was not misread.

  says_what_would_score — For each dropped mark, the feedback states what a
    full-mark response would have contained, rather than only what was wrong.

  no_invented_criticism — Nothing is criticised that the question did not ask
    for: not length, not spelling, not notation, not handwriting, and not
    material outside the question's scope.`;

/** JSON schema for the judge, so the parse is deterministic rather than hopeful. */
export const REGISTER_SCHEMA = {
    type: "object",
    properties: {
        addresses_response: { type: ["integer", "null"], enum: [0, 1, null] },
        no_praise: { type: ["integer", "null"], enum: [0, 1, null] },
        names_command_term: { type: ["integer", "null"], enum: [0, 1, null] },
        says_what_would_score: { type: ["integer", "null"], enum: [0, 1, null] },
        no_invented_criticism: { type: ["integer", "null"], enum: [0, 1, null] },
        reasoning: { type: "string" },
    },
    required: [
        "addresses_response", "no_praise", "names_command_term",
        "says_what_would_score", "no_invented_criticism", "reasoning",
    ],
    additionalProperties: false,
};

/**
 * The judge's five claims folded into one 0–1 figure.
 *
 * Nulls are DROPPED from the denominator, not counted as passes: a feedback
 * block with four applicable claims all held should read 1.0, and one with four
 * held out of five should not read the same. Returns null when nothing applied,
 * which the runner leaves off the row rather than recording as zero.
 */
export function registerScore(verdict) {
    const keys = ["addresses_response", "no_praise", "names_command_term",
        "says_what_would_score", "no_invented_criticism"];
    const seen = keys.map((k) => verdict?.[k]).filter((v) => v === 0 || v === 1);
    if (!seen.length) return null;
    return seen.reduce((a, b) => a + b, 0) / seen.length;
}

/** What the student would actually read, which is what the judge is shown. */
export function feedbackText(fb) {
    const lines = [];
    if (typeof fb?.what_wrong === "string" && fb.what_wrong.trim()) lines.push(`What went wrong: ${fb.what_wrong.trim()}`);
    if (typeof fb?.improve === "string" && fb.improve.trim()) lines.push(`To improve: ${fb.improve.trim()}`);
    for (const c of (Array.isArray(fb?.criteria) ? fb.criteria : [])) {
        if (!c?.text) continue;
        lines.push(`[${c.got ? "earned" : "missed"} · ${c.worth} mark${c.worth === 1 ? "" : "s"}] ${c.text}`
            + (c.got || !c.note ? "" : `\n    ${c.note}`));
    }
    for (const a of (Array.isArray(fb?.annotations) ? fb.annotations : [])) {
        if (!a?.quote) continue;
        lines.push(`Annotation on "${a.quote}" — ${a.issue || ""}`
            + (a.wanted ? ` | wanted: ${a.wanted}` : "")
            + (Array.isArray(a.fixes) && a.fixes.length ? ` | fixes: ${a.fixes.join(" / ")}` : ""));
    }
    return lines.join("\n") || "(the marker returned no feedback at all)";
}

export default {
    awardedMark, criteriaSumOk, quotesVerbatim, annotationsLinked,
    cleanIsSilent, missedHaveNotes, programmaticGrade,
    registerScore, feedbackText, REGISTER_RUBRIC, REGISTER_SCHEMA,
};
