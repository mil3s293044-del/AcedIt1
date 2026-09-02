/**
 * drill ladder assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/drill.test.mjs
 *
 * Two failures these exist to keep out. A rung asked too early — producing a
 * wording nobody has shown you yet is a test, not a drill. And a cloze built
 * out of stopwords, which turns a subject question into a grammar puzzle and
 * teaches the student that the exercise is noise.
 */
import assert from "node:assert/strict";
import {
    drillStage, keyTerms, buildCloze, gradeCloze, suggestRating, drillFor, sameTerm,
} from "@/lib/drill";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const CARD = (over = {}) => ({
    id: "c1",
    question: "Discuss the importance of remedies — what did the assessor want?",
    answer: "Remedies uphold the principle of fairness by ensuring accountability, "
        + "the principle of equality by restoring wronged parties, and the principle "
        + "of access by providing a mechanism to enforce rights",
    repetitions: 0,
    extra: { mistake: { criterion: "Explicit reference to fairness, equality and access to justice" } },
    ...over,
});

// ─── the rungs ──────────────────────────────────────────────────────────────

check("a mistake nobody has been shown the answer to starts on recognise", () => {
    // Asking somebody to produce a wording they have never seen is a test.
    assert.equal(drillStage(CARD()), "recognise");
});

check("the rung climbs with the scheduler's own counter", () => {
    assert.equal(drillStage(CARD({ repetitions: 1 })), "cloze");
    assert.equal(drillStage(CARD({ repetitions: 2 })), "cloze");
    assert.equal(drillStage(CARD({ repetitions: 3 })), "produce");
    assert.equal(drillStage(CARD({ repetitions: 9 })), "produce");
});

check("a lapse drops the rung, because SM-2 resets repetitions", () => {
    // Staying on `produce` while the interval collapses is the worst of both.
    assert.equal(drillStage(CARD({ repetitions: 0 })), "recognise");
    assert.equal(drillStage(null), "recognise");
});

// ─── the gaps ───────────────────────────────────────────────────────────────

check("the criterion decides which words are blanked", () => {
    const terms = keyTerms(CARD().answer, CARD().extra.mistake.criterion);
    // These are what the mark turns on, and they are in both.
    assert.ok(terms.includes("fairness"));
    assert.ok(terms.includes("equality"));
    assert.ok(terms.includes("access"));
});

check("a stopword is never a blank", () => {
    const terms = keyTerms("the principle of the thing is that it was and it were", "");
    assert.ok(!terms.some((t) => ["the", "of", "that", "and", "was", "were", "principle"].includes(t) && t.length < 4));
    for (const t of terms) assert.ok(t.length >= 4, `blanked "${t}"`);
});

check("a cloze reads as text with holes in it, not a string with markers", () => {
    const c = buildCloze(CARD());
    assert.ok(c.segments.length > 2);
    const blanks = c.segments.filter((s) => s.blank != null);
    assert.equal(blanks.length, c.answers.length);
    // Reassembling the segments with their answers gives the original wording
    // back, which is the only proof the blanking did not eat any text.
    const rebuilt = c.segments.map((s) => (s.blank != null ? s.answer : s.text)).join("");
    assert.equal(rebuilt, CARD().answer);
});

check("the word bank is exactly the missing words, shuffled and stable", () => {
    const a = buildCloze(CARD());
    const b = buildCloze(CARD());
    assert.deepEqual([...a.bank].sort(), [...a.answers].sort(), "no invented distractors");
    assert.deepEqual(a.bank, b.bank, "the same card must not reshuffle between renders");
});

check("the opening word is never a gap", () => {
    // A passage that starts with a hole has no context before it, which is the
    // one thing a cloze exists to give you.
    const c = buildCloze(CARD());
    assert.ok(!c.answers.some((a) => a.toLowerCase() === "remedies"),
        `blanked the first word: ${c.answers.join(", ")}`);
    assert.deepEqual(c.answers.map((a) => a.toLowerCase()), ["fairness", "equality", "access"]);
});

check("three gaps at most", () => {
    // Four holes in one sentence is a word-order puzzle, not recall.
    assert.ok(buildCloze(CARD()).answers.length <= 3);
});

check("only the first occurrence of a term is blanked", () => {
    // Removing every "fairness" from a paragraph leaves a sentence nobody can
    // read, let alone complete.
    const c = buildCloze(CARD({
        answer: "Justice: fairness matters and fairness recurs and equality matters too",
    }));
    const rebuilt = c.segments.map((s) => (s.blank != null ? s.answer : s.text)).join("");
    assert.match(rebuilt, /fairness matters and fairness recurs/);
    assert.equal(c.answers.filter((w) => w.toLowerCase() === "fairness").length, 1);
});

check("a wording with nothing worth blanking makes no cloze", () => {
    // Better to fall back a rung than to ask somebody to guess "the".
    assert.equal(buildCloze(CARD({ answer: "It is not the same as it was" })), null);
    assert.equal(buildCloze(CARD({ answer: "" })), null);
    assert.equal(buildCloze({}), null);
});

check("only the first of two alternative wordings is used", () => {
    const c = buildCloze(CARD({
        answer: `Remedies uphold fairness and equality\n\nor\n\nRemedies promote accountability and balance`,
    }));
    const rebuilt = c.segments.map((s) => (s.blank != null ? s.answer : s.text)).join("");
    assert.ok(!rebuilt.includes("accountability"), "blanking both asks the same question twice");
});

// ─── marking the gaps ───────────────────────────────────────────────────────

check("a gap is marked on the word, not the punctuation or the case", () => {
    assert.ok(sameTerm("Fairness", "fairness "));
    assert.ok(sameTerm("access,", "access"));
    assert.ok(!sameTerm("access", "equality"));
});

check("the verdict says WHICH gap, not just how many", () => {
    const c = buildCloze(CARD());
    const wrong = c.answers.map((a, i) => (i === 0 ? "nonsense" : a));
    const g = gradeCloze(c, wrong);
    assert.equal(g.each[0], false);
    assert.equal(g.right, c.answers.length - 1);
    assert.equal(g.allRight, false);
    assert.ok(gradeCloze(c, c.answers).allRight);
});

check("the rating is a SUGGESTION scaled to how much they got", () => {
    // The student still presses the button; an app that schedules on its own
    // verdict takes away the one judgement only they can make.
    assert.equal(suggestRating({ right: 3, total: 3 }), 4);
    assert.equal(suggestRating({ right: 2, total: 3 }), 3);
    assert.equal(suggestRating({ right: 1, total: 3 }), 2);
    assert.equal(suggestRating({ right: 0, total: 3 }), 1);
    assert.equal(suggestRating({ right: 0, total: 0 }), null);
});

// ─── what the runner is handed ──────────────────────────────────────────────

check("a stage that cannot be built falls back rather than rendering broken", () => {
    // Cloze rung, but the wording has no blankable terms.
    assert.equal(drillFor(CARD({ repetitions: 1, answer: "It is not the same" })).stage, "recognise");
    // Produce rung, but no criterion to mark against — the prompt would be
    // "write the answer to the card you cannot see".
    assert.equal(drillFor(CARD({ repetitions: 5, extra: {} })).stage, "recognise");
});

check("a buildable stage comes with everything the screen needs", () => {
    const cloze = drillFor(CARD({ repetitions: 1 }));
    assert.equal(cloze.stage, "cloze");
    assert.ok(cloze.cloze.segments.length);
    const produce = drillFor(CARD({ repetitions: 4 }));
    assert.equal(produce.stage, "produce");
    assert.match(produce.criterion, /fairness/);
});

console.log(`\n${passed} passed`);
