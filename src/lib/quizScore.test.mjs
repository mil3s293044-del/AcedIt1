/**
 * quiz score assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizScore.test.mjs
 *
 * The failure this guards is not a crash and not an off-by-one. It is ONE
 * question printing two different marks on one screen: a header pill reading
 * 3/5 above a panel reading 0/5, on a question whose answer box said "No answer
 * written". Every check here is a pair of readers agreeing.
 *
 * It ends with a SOURCE SCAN, for the same reason `fnResult.test.mjs` has one:
 * the bug class is invisible at runtime. A component that works out a mark from
 * `fb.marks` over `q.marks || 5` renders perfectly, passes every render test,
 * and is simply a different number from the one beside it.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    hasAnswer, questionMark, attemptScore, isCorrect, needsDrill,
    CORRECT_AT, DRILL_UNDER,
} from "@/lib/quizScore";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

/** A legacy five-mark short answer. */
const SHORT = { question: "Explain the transfer.", type: "short_answer", marks: 5 };
const MCQ = { question: "Which one?", type: "mcq", options: ["a", "b"], correct_answer: 1 };
/** A real VCAA-shaped question: a stem worth 9 across three parts. */
const MULTIPART = {
    question: "Consider the cell.",
    parts: [
        { label: "a", question: "Name the anode.", marks: 2, type: "short_answer" },
        { label: "b", question: "Write the half equation.", marks: 4, type: "short_answer" },
        { label: "c", question: "Explain the transfer.", marks: 3, type: "short_answer" },
    ],
};

/** A marked response: raw claim, plus the itemisation it must be reconciled to. */
const fb = (claimed, mark) => ({ marks: claimed, mark });
const itemised = (criteria) => ({
    itemised: true,
    marks: criteria.reduce((s, c) => s + (c.got ? c.worth : 0), 0),
    criteria,
    annotations: [],
});

// ─── The blank answer, which is the screenshot ──────────────────────────────

check("nothing written scores nothing, whatever the marker claimed", () => {
    const m = questionMark(SHORT, 0, fb(3, { itemised: false }), undefined, "");
    assert.equal(m.auto, 0, "3 marks cannot be awarded to text that does not exist");
    assert.equal(m.awarded, 0);
    assert.equal(m.blank, true, "and the panel can say why");
});

check("whitespace is not an answer", () => {
    assert.equal(hasAnswer("   \n\t "), false);
    assert.equal(questionMark(SHORT, 0, fb(4, { itemised: false }), undefined, "  \n ").auto, 0);
});

check("an MCQ is never blank — it is answered by selection, not by text", () => {
    const m = questionMark(MCQ, 0, fb(1, { itemised: false }), undefined, undefined);
    assert.equal(m.blank, false);
    assert.equal(m.auto, 1);
});

check("a multipart question made only of MCQs is never blank", () => {
    // Its parts carry no text, so the joined answer is "" however well it went.
    const allMcq = { question: "Pick each.", parts: [
        { label: "a", question: "Which?", type: "mcq", options: ["x", "y"], correct_answer: 0 },
        { label: "b", question: "And?", type: "mcq", options: ["x", "y"], correct_answer: 1 },
    ] };
    const m = questionMark(allMcq, 0, fb(2, { itemised: false }), undefined, "");
    assert.equal(m.outOf, 2);
    assert.equal(m.blank, false, "answered by clicking, and answered correctly");
    assert.equal(m.auto, 2);
});

check("a multipart question with ONE written part is still blank when empty", () => {
    const m = questionMark(MULTIPART, 0, fb(4, { itemised: false }), undefined, "");
    assert.equal(m.blank, true);
    assert.equal(m.auto, 0);
});

check("undefined answer text skips the blank check rather than zeroing", () => {
    // Callers that genuinely do not have the text (a saved attempt being
    // re-read) must not have every question silently marked to zero.
    const m = questionMark(SHORT, 0, fb(4, { itemised: false }), undefined, undefined);
    assert.equal(m.blank, false);
    assert.equal(m.auto, 4);
});

// ─── THE CRITERIA WIN, and every reader now sees that ───────────────────────

check("the reconciled total beats the model's raw claim", () => {
    const mark = itemised([
        { text: "Names the anode", got: false, worth: 2 },
        { text: "States the transfer", got: false, worth: 3 },
    ]);
    const m = questionMark(SHORT, 0, fb(3, mark), undefined, "some words");
    assert.equal(m.auto, 0, "the model said 3; its own criteria say 0");
    assert.equal(m.overridden, true, "and that is reportable rather than silent");
});

check("a claim that agrees with the criteria is not flagged as overridden", () => {
    const mark = itemised([
        { text: "Names the anode", got: true, worth: 2 },
        { text: "States the transfer", got: false, worth: 3 },
    ]);
    const m = questionMark(SHORT, 0, fb(2, mark), undefined, "some words");
    assert.equal(m.auto, 2);
    assert.equal(m.overridden, false);
});

check("with no itemisation the raw claim is still used", () => {
    // Half the marker's answers come back without criteria. Reconciliation
    // must not turn those into zeroes.
    const m = questionMark(SHORT, 0, fb(4, { itemised: false }), undefined, "some words");
    assert.equal(m.auto, 4);
});

// ─── The denominator comes from the question, through the adapter ───────────

check("a multipart question is worth the sum of its parts, not 5", () => {
    assert.equal(questionMark(MULTIPART, 2, fb(0, { itemised: false }), undefined, "x").outOf, 9,
        "`q.marks || 5` read 5 here, in four separate places");
});

check("a legacy question keeps exactly the allocation it always had", () => {
    assert.equal(questionMark(SHORT, 0, undefined, undefined, "x").outOf, 5);
    assert.equal(questionMark(MCQ, 0, undefined, undefined, undefined).outOf, 1);
});

check("a mark is clamped to the allocation in both directions", () => {
    assert.equal(questionMark(SHORT, 0, fb(99, { itemised: false }), undefined, "x").auto, 5);
    assert.equal(questionMark(SHORT, 0, fb(-4, { itemised: false }), undefined, "x").auto, 0);
});

check("a non-numeric mark is zero rather than NaN", () => {
    const m = questionMark(SHORT, 0, fb("three", { itemised: false }), undefined, "x");
    assert.equal(m.auto, 0);
    assert.equal(Number.isFinite(m.awarded), true);
});

// ─── XP is paid on the auto mark, never on the self mark ────────────────────

check("a self-mark moves what the student sees and not what pays out", () => {
    const m = questionMark(SHORT, 0, fb(0, { itemised: false }), 4, "");
    assert.equal(m.auto, 0, "XP reads this");
    assert.equal(m.awarded, 4, "the screen reads this");
    assert.equal(m.selfMarked, true, "and the panel says which is which");
});

check("a self-mark cannot push a question past what it is worth", () => {
    assert.equal(questionMark(SHORT, 0, fb(4, { itemised: false }), 99, "words").awarded, 5);
});

check("the attempt total splits the same way", () => {
    const qs = [SHORT, SHORT];
    const marked = [fb(5, { itemised: false }), fb(0, { itemised: false })];
    const t = attemptScore(qs, marked, { 1: 3 }, () => "words");
    assert.equal(t.max, 10);
    assert.equal(t.auto, 5);
    assert.equal(t.awarded, 8);
    assert.equal(t.autoPct, 50, "the persisted score");
    assert.equal(t.awardedPct, 80, "the adjusted total on screen");
    assert.equal(t.hasSelfMarked, true);
});

check("an attempt with a multipart question is a percentage of MARKS", () => {
    // 2 of 9 on the multipart, 5 of 5 on the short: 7/14, not 1.5/2 questions.
    const t = attemptScore([MULTIPART, SHORT],
        [fb(2, { itemised: false }), fb(5, { itemised: false })], {}, () => "words");
    assert.equal(t.max, 14);
    assert.equal(t.autoPct, 50);
});

check("an empty attempt divides by nothing rather than producing NaN", () => {
    const t = attemptScore([], [], {}, () => "");
    assert.equal(t.autoPct, 0);
    assert.equal(t.awardedPct, 0);
});

// ─── The two thresholds, which used to be written out five times ───────────

check("correct is 80% of the allocation, on the auto mark", () => {
    const at = (n) => isCorrect(SHORT, { outOf: 5, auto: n, awarded: n });
    assert.equal(at(5 * CORRECT_AT), true, "exactly on the line counts");
    assert.equal(at(3), false);
    assert.equal(isCorrect(MCQ, { outOf: 1, auto: 1 }), true);
    assert.equal(isCorrect(MCQ, { outOf: 1, auto: 0 }), false);
});

check("the drill re-asks below 60%, which is a LOWER bar than the verdict", () => {
    assert.ok(DRILL_UNDER < CORRECT_AT, "a 4/5 is worth noting and not worth sitting again");
    assert.equal(needsDrill(SHORT, { outOf: 5, auto: 2 }), true);
    assert.equal(needsDrill(SHORT, { outOf: 5, auto: 3 }), false, "exactly on the line is not re-asked");
    assert.equal(needsDrill(MCQ, { outOf: 1, auto: 0 }), true);
});

check("neither threshold divides by a zero allocation", () => {
    assert.equal(isCorrect(SHORT, { outOf: 0, auto: 0 }), false);
    assert.equal(needsDrill(SHORT, { outOf: 0, auto: 0 }), false);
    assert.equal(isCorrect(SHORT, null), false);
    assert.equal(needsDrill(SHORT, undefined), false);
});

check("a self-marked question is still counted as missed, deliberately", () => {
    // The app has seen no work on it. Excluding it would let the self-mark box
    // quietly opt a student out of their own remediation pile.
    const m = questionMark(SHORT, 0, fb(0, { itemised: false }), 5, "");
    assert.equal(m.awarded, 5);
    assert.equal(isCorrect(SHORT, m), false);
});

check("nothing here throws on the shapes a bad response can actually take", () => {
    for (const bad of [null, undefined, {}, { marks: null }, { mark: null }, { mark: {} }]) {
        assert.doesNotThrow(() => questionMark(SHORT, 0, bad, undefined, "x"), String(bad));
    }
    assert.doesNotThrow(() => questionMark(null, 0, null, null, null));
    assert.doesNotThrow(() => attemptScore(undefined, undefined, undefined, undefined));
});

// ─── The scan: nobody computes an allocation by hand any more ───────────────

const SRC = path.resolve("src");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.jsx?$/.test(e.name) && !e.name.endsWith(".test.mjs") ? [full] : [];
});

check("no surface works out a question's allocation by hand", () => {
    // `q.marks || 5` is the expression that reads 5 for a multipart question
    // worth nine. `normaliseQuestion(q, i).marks` returns exactly the old value
    // for a legacy question, so there is never a reason to write it out.
    // A NONZERO default only. `item.marks || 0` and `mark?.marks ?? 0` are
    // null-guards on a number that was already computed; `q.marks || 5` is an
    // allocation invented on the spot.
    const ALLOC = /\.marks\s*(\|\||\?\?)\s*[1-9]/;
    const offenders = walk(SRC).filter((f) => {
        const src = fs.readFileSync(f, "utf8");
        // quizSchema is the adapter; it is where the fallback belongs.
        if (f.endsWith("quizSchema.js")) return false;
        return src.split("\n").some((line) =>
            ALLOC.test(line) && !line.trim().startsWith("*") && !line.trim().startsWith("//"));
    });
    assert.deepEqual(offenders.map((f) => path.relative(SRC, f)), [],
        "compute it with normaliseQuestion(q, i).marks");
});

check("the quiz player reads the shared model rather than the raw claim", () => {
    // `fb.marks` is the model's unreconciled claim. Every reader in the player
    // goes through `markFor`, which is `questionMark`, which reconciles it.
    const src = fs.readFileSync(path.join(SRC, "components/quizzes/QuizPlayer.jsx"), "utf8");
    const raw = src.split("\n")
        .map((line, i) => [i + 1, line])
        .filter(([, line]) => /\bfb\.marks\b|\bfeedback\[\w+\]\.marks\b/.test(line))
        .filter(([, line]) => !line.trim().startsWith("*") && !line.trim().startsWith("//"));
    assert.deepEqual(raw, [], "read markFor(i) instead");
});

console.log(`\n${passed} checks passed`);
