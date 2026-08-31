/**
 * marking assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizMarking.test.mjs
 *
 * The failure that matters here is not a crash, it is an incoherent mark: a
 * total that contradicts the itemised list printed directly under it. A
 * student reads both at once, and once they catch the marking lying they stop
 * believing any of it.
 */
import assert from "node:assert/strict";
import {
    normaliseMark, isFullMarks, orderedCriteria, marksLost,
} from "@/lib/quizMarking";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const CRITERIA = [
    { text: "Identifies the stronger reductant", got: true, worth: 1, note: "Clean mark." },
    { text: "States oxidation at the anode", got: true, worth: 1 },
    { text: "Names the electron transfer", got: false, worth: 2, note: "VCAA wants it stated." },
];

check("the itemisation wins when the stated total disagrees with it", () => {
    // The model says 4/4 and then lists a criterion it says was missed.
    const m = normaliseMark({ marks: 4, criteria: CRITERIA }, 4);
    assert.equal(m.marks, 2, "recomputed from the criteria, not taken on trust");
    assert.equal(m.reconciled, true, "and the screen can say it was adjusted");
});

check("a total that already agrees is left alone and not flagged", () => {
    const m = normaliseMark({ marks: 2, criteria: CRITERIA }, 4);
    assert.equal(m.marks, 2);
    assert.equal(m.reconciled, false);
});

check("the denominator comes from the question, never from the model", () => {
    // A marker that invents its own out-of can silently rescale the score.
    const m = normaliseMark({ marks: 9, out_of: 100, criteria: [] }, 3);
    assert.equal(m.outOf, 3);
    assert.equal(m.marks, 3, "and the award is clamped to it");
});

check("marks cannot go negative", () => {
    assert.equal(normaliseMark({ marks: -4 }, 5).marks, 0);
});

check("a mark with no itemisation still renders the old way", () => {
    const m = normaliseMark({ marks: 3, what_wrong: "Missed the transfer.", improve: "Name it." }, 5);
    assert.equal(m.marks, 3);
    assert.equal(m.itemised, false);
    assert.equal(m.whatWrong, "Missed the transfer.");
    assert.equal(m.improve, "Name it.");
});

check("a criterion with no text is not a criterion", () => {
    const m = normaliseMark({ marks: 1, criteria: [
        { got: true, worth: 1 }, { text: "   ", got: true }, { text: "Real one", got: true, worth: 1 },
    ]}, 3);
    assert.equal(m.criteria.length, 1);
    assert.equal(m.marks, 1, "and the blanks do not silently earn marks");
});

check("an edit needs both halves, and they have to differ", () => {
    const m = normaliseMark({ marks: 1, edits: [
        { was: "bad" },                                   // no replacement
        { now: "detrimental" },                           // nothing replaced
        { was: "same", now: "same" },                     // not an edit
        { was: "bad", now: "detrimental", why: "names the harm" },
    ]}, 2);
    assert.equal(m.edits.length, 1);
    assert.equal(m.edits[0].now, "detrimental");
    assert.equal(m.edits[0].criterion, "Word choice", "a default label, so the card always has one");
});

check("a criterion with no stated worth is worth one mark", () => {
    const m = normaliseMark({ marks: 0, criteria: [{ text: "A", got: true }, { text: "B", got: true }] }, 4);
    assert.equal(m.marks, 2);
});

check("missed criteria are shown first", () => {
    // A list opening with three ticks buries the line they needed to read.
    const m = normaliseMark({ marks: 2, criteria: CRITERIA }, 4);
    assert.deepEqual(orderedCriteria(m).map((c) => c.got), [false, true, true]);
    assert.equal(marksLost(m), 2);
});

check("full marks is full marks", () => {
    assert.equal(isFullMarks(normaliseMark({ marks: 4, criteria: [] }, 4)), true);
    assert.equal(isFullMarks(normaliseMark({ marks: 3, criteria: [] }, 4)), false);
});

check("anything unreadable marks zero rather than throwing", () => {
    for (const bad of [null, undefined, "nope", 7, { criteria: "nope" }, { edits: 3 }]) {
        assert.doesNotThrow(() => normaliseMark(bad, 4), String(bad));
        const m = normaliseMark(bad, 4);
        assert.equal(m.marks, 0);
        assert.deepEqual(m.criteria, []);
        assert.deepEqual(m.edits, []);
    }
    assert.equal(normaliseMark({}, 0).outOf, 1, "never a zero denominator");
});

console.log(`\n${passed} passed`);
