/**
 * quiz schema assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizSchema.test.mjs
 *
 * The bug this exists to prevent is silent and retroactive: an answer-key
 * change would make every quiz attempt ever saved unreadable, and nothing
 * would throw — old attempts would simply come back scoring zero. So the
 * legacy-compatibility rules get the most coverage here, not the new format.
 */
import assert from "node:assert/strict";
import {
    normaliseQuestion, normaliseQuestions, allParts, quizMarks,
    scoreFromMarks, mcqCorrect, partKey, autoLabel, partTitle,
} from "@/lib/quizSchema";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const LEGACY = { questions: [
    { type: "mcq", question: "Which is the anode?", options: ["Mg", "Cu"], correct_answer: 0 },
    { type: "short", question: "Explain why.", marks: 3, model_answer: "Because…" },
    { type: "short", question: "No marks given." },
]};

const MULTIPART = { questions: [
    { question: "A 5 kg body accelerates at 2 m/s².", parts: [
        { label: "a", type: "short", prompt: "Find the net force.", marks: 2 },
        { type: "short", prompt: "State Newton's second law.", marks: 4 },
        { type: "mcq", prompt: "Units?", options: ["N", "J"], correct_answer: 0 },
    ]},
]};

// ── The rule that protects every saved attempt ──────────────────────────────

check("a single-part question keeps the bare index as its answer key", () => {
    // user_answers[3] is how every attempt ever saved is keyed. Suffixing this
    // would make old attempts read back as unanswered.
    assert.deepEqual(allParts(LEGACY).map((p) => p.key), ["0", "1", "2"]);
    assert.equal(partKey(3, 0, 1), "3");
});

check("only a genuinely multi-part question suffixes its keys", () => {
    assert.deepEqual(allParts(MULTIPART).map((p) => p.key), ["0a", "0b", "0c"]);
    assert.equal(partKey(3, 1, 3), "3b");
});

check("a legacy question is a stem with one unlabelled part", () => {
    const q = normaliseQuestion(LEGACY.questions[1], 1);
    assert.equal(q.multipart, false);
    assert.equal(q.parts.length, 1);
    assert.equal(q.parts[0].label, null, "no (a) on a question that has no parts");
    assert.equal(q.parts[0].prompt, "Explain why.", "the part carries the prompt too");
    assert.equal(q.stem, "Explain why.");
});

// ── Marks ───────────────────────────────────────────────────────────────────

check("an MCQ is one mark whatever it claims", () => {
    const q = normaliseQuestion({ type: "mcq", question: "?", marks: 9 }, 0);
    assert.equal(q.parts[0].marks, 1);
    assert.equal(q.marks, 1);
});

check("a short answer with no allocation gets a sane default", () => {
    assert.equal(normaliseQuestion(LEGACY.questions[2], 2).marks, 5);
    assert.equal(normaliseQuestion({ type: "short", marks: 0 }, 0).marks, 5, "zero is not an allocation");
});

check("a multipart question is worth the sum of its parts", () => {
    assert.equal(normaliseQuestion(MULTIPART.questions[0], 0).marks, 7);
    assert.equal(quizMarks(MULTIPART), 7);
    assert.equal(quizMarks(LEGACY), 1 + 3 + 5);
});

check("marks_allocation is still read — it is what the old generator wrote", () => {
    assert.equal(normaliseQuestion({ type: "short", marks_allocation: 6 }, 0).marks, 6);
});

// ── Scoring ─────────────────────────────────────────────────────────────────

check("score is a percentage of MARKS, not of questions", () => {
    // Four marks out of seven. A question-counting score would call this 66%.
    assert.equal(scoreFromMarks(MULTIPART, { "0a": 2, "0b": 2, "0c": 0 }), 57);
    assert.equal(scoreFromMarks(MULTIPART, { "0a": 2, "0b": 4, "0c": 1 }), 100);
    assert.equal(scoreFromMarks(MULTIPART, {}), 0);
});

check("a part cannot be awarded more than it is worth", () => {
    assert.equal(scoreFromMarks(MULTIPART, { "0a": 99, "0b": 99, "0c": 99 }), 100);
    assert.equal(scoreFromMarks(MULTIPART, { "0a": -5, "0b": 4, "0c": 1 }), 71);
});

check("a junk mark scores nothing rather than poisoning the total", () => {
    for (const junk of [undefined, null, "two", NaN, {}]) {
        assert.equal(scoreFromMarks(MULTIPART, { "0a": junk, "0b": 4, "0c": 1 }), 71, String(junk));
    }
});

check("a quiz with no marks available scores zero rather than dividing by it", () => {
    assert.equal(scoreFromMarks({ questions: [] }, {}), 0);
    assert.equal(scoreFromMarks(null, {}), 0);
});

// ── MCQ comparison ──────────────────────────────────────────────────────────

check("MCQ answers compare as numbers, because JSON hands them back as strings", () => {
    const part = allParts(MULTIPART)[2];
    assert.equal(mcqCorrect(part, "0"), true);
    assert.equal(mcqCorrect(part, 0), true);
    assert.equal(mcqCorrect(part, "1"), false);
});

check("an unanswered MCQ is not correct, and not a crash", () => {
    const part = allParts(MULTIPART)[2];
    for (const v of [undefined, null, ""]) assert.equal(mcqCorrect(part, v), false);
    assert.equal(mcqCorrect(allParts(MULTIPART)[0], "0"), false, "a short answer is never auto-marked");
});

// ── Shapes we did not expect ────────────────────────────────────────────────

check("anything unreadable normalises rather than throwing", () => {
    for (const bad of [null, undefined, "nope", 7, { parts: "nope" }, { parts: [] }, { parts: [null, 3] }]) {
        assert.doesNotThrow(() => normaliseQuestion(bad, 0), String(bad));
        const q = normaliseQuestion(bad, 0);
        assert.equal(q.parts.length, 1, "always at least one part to render");
    }
    assert.deepEqual(normaliseQuestions(null), []);
    assert.deepEqual(normaliseQuestions({ questions: "nope" }), []);
});

// ── Labels ──────────────────────────────────────────────────────────────────

check("parts label themselves a, b, c when the generator did not", () => {
    assert.deepEqual([0, 1, 2, 25, 26].map(autoLabel), ["a", "b", "c", "z", "aa"]);
    const q = normaliseQuestion(MULTIPART.questions[0], 0);
    assert.deepEqual(q.parts.map((p) => p.label), ["a", "b", "c"]);
});

check("a part's own label wins over the generated one", () => {
    const q = normaliseQuestion({ parts: [{ label: "i", prompt: "x" }, { label: "ii", prompt: "y" }] }, 0);
    assert.deepEqual(q.parts.map((p) => p.label), ["i", "ii"]);
});

check("titles read the way a paper reads", () => {
    const multi = normaliseQuestion(MULTIPART.questions[0], 2);
    assert.equal(partTitle(multi, multi.parts[1]), "3b");
    const flat = normaliseQuestion(LEGACY.questions[0], 4);
    assert.equal(partTitle(flat, flat.parts[0]), "5", "no phantom (a) on a one-part question");
});

console.log(`\n${passed} passed`);
