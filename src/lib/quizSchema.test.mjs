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
import fs from "node:fs";
import path from "node:path";
import {
    normaliseQuestion, normaliseQuestions, allParts, quizMarks,
    scoreFromMarks, mcqCorrect, partKey, autoLabel, partTitle, formatGeneratedParts,
    normaliseStimulus, stimulusText, referencesMissingSource,
    STIMULUS_RULE, STIMULUS_RULE_INLINE, STIMULUS_SCHEMA,
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

check("a generated question is coerced into the stored part shape", () => {
    const parts = formatGeneratedParts({ parts: [
        { prompt: "Find the net force.", marks: 2 },
        { label: "ii", type: "mcq", prompt: "Units?", options: ["N", "J"], correct_answer: 1 },
        { question: "Explain.", marks: 0 },
    ]}, 5);
    assert.equal(parts.length, 3);
    assert.deepEqual(parts.map((p) => p.label), ["a", "ii", "c"], "own label wins, others generated");
    assert.equal(parts[1].marks, 1, "an MCQ part is one mark");
    assert.equal(parts[1].correct_answer, 1);
    assert.equal(parts[2].prompt, "Explain.", "`question` is read as `prompt`");
    assert.equal(parts[2].marks, 5, "a zero allocation falls back to the setting");
});

check("a part that cannot be answered is dropped", () => {
    assert.deepEqual(formatGeneratedParts({ parts: [null, {}, { marks: 3 }] }), []);
    assert.deepEqual(formatGeneratedParts({}), []);
    assert.deepEqual(formatGeneratedParts(null), []);
});

check("an mcq part with no real options degrades to a short answer", () => {
    // Rendering a one-option multiple choice is worse than asking for prose.
    const [p] = formatGeneratedParts({ parts: [{ type: "mcq", prompt: "Pick", options: ["only"] }] }, 4);
    assert.equal(p.type, "short");
    assert.equal(p.marks, 4);
});

/* ── SOURCE MATERIAL ──────────────────────────────────────────────────────
 *
 * "If a question ever cites an external example from the source material, make
 * sure the example is also extracted and given to the student so they can
 * actually answer the question." A question that says "Using Source B" with no
 * Source B is unanswerable, renders perfectly, and is then MARKED — so the
 * student loses marks for a gap the app created.
 */

check("a stimulus rides on the question and survives normalising", () => {
    const q = normaliseQuestion({
        question: "Using Source A, explain two causes of the crisis.",
        stimulus: { label: "Source A", content: "In October 1962..." },
        marks: 6,
    }, 3);
    assert.deepEqual(q.stimulus, { label: "Source A", content: "In October 1962..." });
    assert.equal(q.marks, 6);
    // THE ANSWER KEY IS UNTOUCHED. A single-part question keeps the bare index
    // or every attempt ever saved reads back as unanswered.
    assert.equal(q.parts[0].key, "3");
});

check("it belongs to the QUESTION, and every part is asked about it", () => {
    const q = normaliseQuestion({
        question: "Refer to the table below.",
        stimulus: { label: "Table 2", content: "| Year | Yield |\n|---|---|\n| 2020 | 4.2 |" },
        parts: [
            { prompt: "State the 2020 yield.", marks: 1 },
            { prompt: "Account for the trend.", marks: 4 },
        ],
    }, 0);
    assert.ok(q.multipart);
    assert.equal(q.stimulus.label, "Table 2");
    assert.equal(q.marks, 5);
    assert.deepEqual(q.parts.map((p) => p.key), ["0a", "0b"]);
});

check("a quiz written before this existed has no stimulus and does not break", () => {
    assert.equal(normaliseQuestion({ question: "What is osmosis?" }, 0).stimulus, null);
    assert.equal(normaliseQuestion({}, 0).stimulus, null);
    assert.equal(normaliseQuestion(null, 0).stimulus, null);
});

check("a bare string is a source with no caption, not a dropped source", () => {
    // A generator will sometimes return one. Losing the material because the
    // label is missing is the exact failure this whole change is about.
    assert.deepEqual(normaliseStimulus("In October 1962..."), { label: "", content: "In October 1962..." });
    assert.deepEqual(normaliseStimulus({ text: "body" }), { label: "", content: "body" });
    assert.equal(normaliseStimulus({ label: "Source A", content: "   " }), null, "a label with no body is nothing");
    assert.equal(normaliseStimulus(""), null);
    assert.equal(normaliseStimulus(null), null);
    assert.equal(normaliseStimulus(42), null);
});

check("the marker is handed the source, captioned", () => {
    const withSource = stimulusText({ stimulus: { label: "Source A", content: "In 1962..." } });
    assert.match(withSource, /Source A/);
    assert.match(withSource, /In 1962/);
    assert.match(stimulusText({ stimulus: "bare" }), /Source material/);
    assert.equal(stimulusText({ question: "no source here" }), "", "nothing to add to the prompt");
});

check("a dangling reference is detected, and a carried one is not", () => {
    const dangling = [
        { question: "Refer to the case study and explain two impacts." },
        { question: "According to the extract, what changed?" },
        { question: "Using Source B, justify the decision." },
        { question: "Interpret the data in Figure 3." },
        { question: "See page 214 and summarise the argument." },
        { question: "Explain the result.", parts: [{ prompt: "Using the passage, name the technique.", marks: 2 }] },
    ];
    for (const q of dangling) {
        assert.equal(referencesMissingSource(q), true, `missed: ${q.question}`);
    }
    // Carried — the question may say whatever it likes.
    assert.equal(referencesMissingSource({ question: "Using Source B, justify the decision.", stimulus: "Source B text" }), false);
});

check("it refuses to flag a question that is simply self-contained", () => {
    // Guessing wide throws away good questions, which is the worse error:
    // "the following", "below" and "above" refer to the question's own text,
    // and a question may describe a graph in words without citing one.
    const fine = [
        { question: "Explain osmosis in your own words." },
        { question: "Which of the following is a noble gas?" },
        { question: "Sketch the graph of $y = x^2$ and state its range." },
        { question: "Consider the reaction below. Balance it." },
        { question: "A student measures the pH as 3.2. Account for this." },
        {},
        null,
    ];
    for (const q of fine) {
        assert.equal(referencesMissingSource(q), false, `false positive: ${JSON.stringify(q)}`);
    }
});

/* ── The scan: one rule, four generators, never mirrored ──────────────────
 *
 * The rule is a long prompt string. Pasted into four files it is the copy that
 * rots — three get a fix and the fourth quietly keeps shipping unanswerable
 * questions. Same guard megaUpload.test.mjs keeps over the page price.
 */
const ROOT = process.cwd();
const GENERATORS = [
    "src/pages/Quizzes.jsx",                     // make a quiz from notes, and reshuffle
    "src/components/study/ActiveRecall.jsx",     // make questions from my notes
];
/** Assembles questions from quizzes the student already has rather than writing them. */
const CARRIERS = ["src/components/study/ExamMode.jsx"];

check("every question generator imports the rule rather than restating it", () => {
    for (const f of GENERATORS) {
        const src = fs.readFileSync(path.join(ROOT, f), "utf8");
        assert.match(src, /STIMULUS_RULE(_INLINE)?/,
            `${f} generates questions and never states the source-material rule`);
        assert.match(src, /from "@\/lib\/quizSchema"/, `${f} must import it, not restate it`);
        assert.ok(!src.includes("A QUESTION MAY ONLY REFER TO MATERIAL IT CARRIES"),
            `${f} has its own copy of the rule — import STIMULUS_RULE instead`);
    }
});

check("a surface that replays saved questions carries the source with them", () => {
    for (const f of CARRIERS) {
        const src = fs.readFileSync(path.join(ROOT, f), "utf8");
        assert.match(src, /normaliseStimulus/, `${f} rebuilds questions and would drop the source`);
        assert.match(src, /SourcePanel/, `${f} must draw the source it carries`);
    }
});

check("the schema the generators declare is the one shape normalise reads", () => {
    const keys = Object.keys(STIMULUS_SCHEMA.properties).sort();
    assert.deepEqual(keys, ["content", "label"]);
    // Round-trip: what the schema permits is exactly what normalise keeps.
    const fromModel = { label: "Source A", content: "body" };
    assert.deepEqual(normaliseStimulus(fromModel), fromModel);
});

check("both rules say the one thing they exist to say", () => {
    for (const rule of [STIMULUS_RULE, STIMULUS_RULE_INLINE]) {
        assert.match(rule, /MAY ONLY REFER TO MATERIAL IT CARRIES/);
        assert.match(rule, /VERBATIM/);
        // Or a generator invents a source for every question it writes.
        assert.match(rule, /do not invent one|Do not invent one/i);
    }
});

console.log(`\n${passed} passed`);
