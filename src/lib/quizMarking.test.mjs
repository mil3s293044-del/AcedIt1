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
    markModules, markLedger, isBankable, criterionIndexFor,
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


// ─── The ledger, and the incoherence it exists to end ───────────────────────
//
// Criteria and annotations used to be two independent verdicts. The criteria
// said which marks were dropped; the annotations, chosen separately by the
// model, put "Cost a mark −1" on a phrase with nothing forcing the two to
// agree. A student could read "3/3, all criteria met" directly above their own
// sentence underlined in red and told it cost them a mark.

const ANN = (over) => ({ quote: "goes into solution", issue: "Inferred, not stated.", fixes: ["loses two electrons"], ...over });

check("an annotation on a criterion they EARNED cannot claim a mark", () => {
    const m = normaliseMark({
        marks: 2,
        criteria: [{ text: "Identifies the stronger reductant", got: true, worth: 2 }],
        annotations: [ANN({ criterion: "Identifies the stronger reductant", severity: "lost", worth: 2 })],
    }, 2);
    assert.equal(m.marks, 2, "they got everything");
    assert.equal(m.annotations[0].severity, "risk", "it survived — it did not cost a mark");
    assert.equal(m.annotations[0].worth, 0);
    assert.equal(markLedger(m).lost, 0, "and nothing on the screen may say otherwise");
});

check("an annotation on a MISSED criterion costs exactly that criterion", () => {
    const m = normaliseMark({
        marks: 0,
        criteria: [{ text: "Names the electron transfer", got: false, worth: 2 }],
        // The model lowballed the cost; the ledger is the authority.
        annotations: [ANN({ criterion: "Names the electron transfer", worth: 1 })],
    }, 2);
    assert.equal(m.annotations[0].severity, "lost");
    assert.equal(m.annotations[0].worth, 2, "the criterion's worth, not the model's guess");
});

check("an annotation attached to nothing may not bill a mark", () => {
    const m = normaliseMark({
        marks: 1,
        criteria: [{ text: "Names the electron transfer", got: false, worth: 1 },
                   { text: "States oxidation at the anode", got: true, worth: 1 }],
        annotations: [ANN({ criterion: "Vibes", severity: "lost", worth: 1 })],
    }, 2);
    assert.equal(m.annotations[0].criterionIndex, null, "refuses rather than guessing");
    assert.equal(m.annotations[0].severity, "risk");
    // Otherwise the page would show 1 lost from the criteria and another 1
    // from the annotation, for a question worth 2 that scored 1.
    assert.equal(markLedger(m).lost, 1);
});

check("marks lost always equals outOf minus marks", () => {
    for (const marks of [[true, true, true], [false, true, false], [false, false, false]]) {
        const m = normaliseMark({
            marks: 99,
            criteria: marks.map((got, i) => ({ text: `Criterion ${i}`, got, worth: 1 })),
        }, 3);
        const l = markLedger(m);
        assert.equal(l.lost, l.outOf - l.earned, `${marks} disagreed`);
    }
});

check("the model can name the criterion by index", () => {
    const criteria = [{ text: "A", got: true, worth: 1 }, { text: "B", got: false, worth: 1 }];
    assert.equal(criterionIndexFor({ criterionIndex: 1 }, criteria), 1);
    assert.equal(criterionIndexFor({ criterionIndex: 7 }, criteria), null, "out of range is refused");
});

check("a criterion named loosely still finds its mark", () => {
    const criteria = [{ text: "Names the electron transfer", got: false, worth: 2 }];
    // The model writes the part label in, or abbreviates.
    assert.equal(criterionIndexFor({ criterion: "names the electron transfer" }, criteria), 0);
    assert.equal(criterionIndexFor({ criterion: "the electron transfer" }, criteria), 0);
    // Too short to be anything but a coincidence.
    assert.equal(criterionIndexFor({ criterion: "the" }, criteria), null);
});

// ─── Modules: every mark is something you can act on ────────────────────────

check("EVERY missed mark gets a module, quotable or not", () => {
    // This is the repair. The mark with nothing to quote is the one whose words
    // are absent from the answer, which is the one most needing explaining.
    const m = normaliseMark({
        marks: 1,
        criteria: [
            { text: "Identifies the stronger reductant", got: true, worth: 1 },
            { text: "Names the electron transfer", got: false, worth: 1, note: "State it explicitly." },
            { text: "States oxidation at the anode", got: false, worth: 1, note: "As a half-equation." },
        ],
        annotations: [ANN({ criterion: "Names the electron transfer" })],
    }, 3);
    const l = markLedger(m);
    assert.equal(l.lostModules.length, 2);
    assert.equal(l.bankable.length, 2, "both, including the one with no quote");
    // The quoted one carries its evidence; the other stands on its note alone.
    const quoted = l.modules.find((x) => x.text.startsWith("Names"));
    assert.equal(quoted.evidence.length, 1);
    assert.deepEqual(quoted.fixes, ["loses two electrons"]);
    const bare = l.modules.find((x) => x.text.startsWith("States"));
    assert.equal(bare.evidence.length, 0);
    // The note is the examiner's remark, NOT a statement of what would have
    // scored, so it is never promoted to `wanted` — a module headed "the
    // assessor wanted" printing a criticism sends the student to copy it.
    assert.equal(bare.wanted, "");
    assert.equal(bare.detail, "As a half-equation.");
    assert.equal(isBankable(bare), true);
});

check("lost marks come before the ones they earned", () => {
    const m = normaliseMark({ marks: 2, criteria: CRITERIA }, 4);
    assert.deepEqual(markModules(m).map((x) => x.status), ["lost", "earned", "earned"]);
});

check("a mark they earned is not bankable", () => {
    const m = normaliseMark({ marks: 4, criteria: CRITERIA.map((c) => ({ ...c, got: true })) }, 4);
    assert.deepEqual(markLedger(m).bankable, []);
});

check("with no criteria at all, annotations are the only verdict there is", () => {
    // A degraded response. Overriding the model here would delete the only
    // marking available rather than reconcile it.
    const m = normaliseMark({ marks: 1, annotations: [ANN({ severity: "lost", worth: 1 })] }, 2);
    const l = markLedger(m);
    assert.equal(l.modules.length, 1);
    assert.equal(l.modules[0].status, "lost");
    assert.equal(l.modules[0].evidence.length, 1);
});

check("several notes about one thing read as one module", () => {
    const m = normaliseMark({
        marks: 0,
        criteria: [{ text: "Names the electron transfer", got: false, worth: 1 }],
        annotations: [
            ANN({ quote: "goes into solution", criterion: "Names the electron transfer" }),
            ANN({ quote: "the metal reacts", criterion: "Names the electron transfer", fixes: ["is oxidised"] }),
        ],
    }, 1);
    const mods = markModules(m);
    assert.equal(mods.length, 1, "one mark, one module");
    assert.equal(mods[0].evidence.length, 2);
    assert.deepEqual(mods[0].fixes, ["loses two electrons", "is oxidised"]);
});

check("modules survive a mark with nothing in it", () => {
    assert.deepEqual(markModules(normaliseMark(null, 2)), []);
    assert.deepEqual(markModules(null), []);
    assert.equal(markLedger(normaliseMark(null, 2)).lost, 0);
});

console.log(`\n${passed} passed`);
