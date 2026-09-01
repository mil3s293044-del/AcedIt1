/**
 * annotation assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/annotate.test.mjs
 *
 * The failure worth preventing is confidently underlining the wrong words. A
 * student told that six words cost them a mark will go and rewrite a sentence
 * that was fine, and will not trust the next annotation.
 */
import assert from "node:assert/strict";
import { segment, landed, dropped, normaliseAnnotation } from "@/lib/annotate";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ANSWER = "Magnesium is the anode because it is more reactive than copper. "
    + "It goes into solution as Mg2+ and the electrode loses mass.";

const flat = (segs) => segs.map((s) => s.text).join("");

check("the segments always reassemble into the original answer", () => {
    // Nothing may be dropped, duplicated or reordered — this is the student's
    // own writing being rendered back to them.
    const segs = segment(ANSWER, [{ quote: "goes into solution", issue: "vague" }]);
    assert.equal(flat(segs), ANSWER);
});

check("only the quoted characters are flagged", () => {
    const segs = segment(ANSWER, [{ quote: "goes into solution", issue: "vague" }]);
    const marked = segs.filter((s) => s.ann);
    assert.equal(marked.length, 1);
    assert.equal(marked[0].text, "goes into solution", "not the sentence around it");
});

check("a quote that is not in the answer is dropped, never approximated", () => {
    const segs = segment(ANSWER, [{ quote: "loses two electrons", issue: "missing" }]);
    assert.equal(landed(segs).length, 0);
    assert.equal(flat(segs), ANSWER, "and the answer still renders whole");
    assert.equal(dropped(ANSWER, [{ quote: "loses two electrons" }]), 1);
});

check("case and punctuation are not close enough", () => {
    for (const quote of ["Goes Into Solution", "goes into solution,", "goes  into solution"]) {
        assert.equal(landed(segment(ANSWER, [{ quote }])).length, 0, quote);
    }
});

check("a quote appearing twice takes the first free occurrence, then the next", () => {
    const text = "it is more reactive, so it is oxidised";
    const segs = segment(text, [{ quote: "it is" }, { quote: "it is" }]);
    const marks = segs.filter((s) => s.ann);
    assert.equal(marks.length, 2, "both annotations placed, on different occurrences");
    assert.equal(flat(segs), text);
});

check("overlapping annotations do not nest — the first keeps the span", () => {
    // Half one colour and half another says nothing a student can act on.
    const segs = segment(ANSWER, [
        { quote: "more reactive than copper", issue: "first" },
        { quote: "reactive than", issue: "second" },
    ]);
    const marks = segs.filter((s) => s.ann);
    assert.equal(marks.length, 1);
    assert.equal(marks[0].ann.issue, "first");
    assert.equal(flat(segs), ANSWER);
});

check("several separate annotations all land, in reading order", () => {
    const segs = segment(ANSWER, [
        { quote: "loses mass", issue: "third" },
        { quote: "more reactive", issue: "first" },
        { quote: "Mg2+", issue: "second" },
    ]);
    assert.deepEqual(landed(segs).map((a) => a.issue), ["first", "second", "third"],
        "sorted by position, not by the order the marker sent them");
    assert.equal(flat(segs), ANSWER);
});

check("an annotation with no quote is not an annotation", () => {
    assert.equal(normaliseAnnotation({ issue: "be clearer" }), null);
    assert.equal(normaliseAnnotation({ quote: "   " }), null);
    assert.equal(normaliseAnnotation(null), null);
});

check("the older edit shape still reads", () => {
    // `was`/`why`/`now` was the first version of this field.
    const a = normaliseAnnotation({ was: "bad", now: "detrimental", why: "names the harm" });
    assert.equal(a.quote, "bad");
    assert.deepEqual(a.fixes, ["detrimental"]);
    assert.equal(a.issue, "names the harm");
});

check("an annotation can offer several rewrites", () => {
    // One suggested wording is the model's first idea; two let the student
    // pick the one that sounds like them.
    const a = normaliseAnnotation({ quote: "x", fixes: ["loses two electrons", "is oxidised to Mg2+"] });
    assert.equal(a.fixes.length, 2);
});

check("duplicate and empty rewrites are dropped", () => {
    const a = normaliseAnnotation({ quote: "x", fixes: ["same", "  same  ", "", null], fix: "same" });
    assert.deepEqual(a.fixes, ["same"]);
    assert.deepEqual(normaliseAnnotation({ quote: "x" }).fixes, []);
});

check("what the assessor wanted is its own field", () => {
    // The issue says what is wrong; `wanted` says what was being looked for.
    // A student needs both, and they are not the same sentence.
    const a = normaliseAnnotation({ quote: "x", issue: "Describes rather than explains.",
        wanted: "The half-equation, or the words 'loses two electrons'." });
    assert.ok(a.wanted.startsWith("The half-equation"));
    assert.equal(normaliseAnnotation({ quote: "x" }).wanted, "");
});

check("severity is one of two things, and defaults to the costly one", () => {
    assert.equal(normaliseAnnotation({ quote: "x" }).severity, "lost");
    assert.equal(normaliseAnnotation({ quote: "x", severity: "risk" }).severity, "risk");
    assert.equal(normaliseAnnotation({ quote: "x", severity: "banana" }).severity, "lost");
});

check("an empty answer segments to nothing rather than crashing", () => {
    assert.deepEqual(segment("", [{ quote: "x" }]), []);
    assert.deepEqual(segment(null, null), []);
    assert.doesNotThrow(() => segment(ANSWER, "nope"));
});

console.log(`\n${passed} passed`);
