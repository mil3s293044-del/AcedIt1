/**
 * mistake bank assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/mistakeBank.test.mjs
 */
import assert from "node:assert/strict";
import {
    cardFromAnnotation, cardFromCriterion, isBankCard, bankKey, BANK_TOPIC,
} from "@/lib/mistakeBank";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ANN = {
    quote: "goes into solution",
    fix: "loses two electrons",
    issue: "VCAA wants the transfer stated, not inferred.",
    criterion: "Precision",
};

check("the card asks for the FIX, never rehearsing the mistake", () => {
    const c = cardFromAnnotation(ANN, { subject: "Chemistry", questionTitle: "Q3b" });
    assert.ok(c.answer.startsWith("loses two electrons"), "the back is what scores");
    assert.ok(c.question.includes("goes into solution"), "the front recalls what they wrote");
    assert.ok(c.question.includes("Q3b"));
    assert.equal(c.subject_name, "Chemistry");
    assert.equal(c.topic, BANK_TOPIC);
    assert.equal(c.is_active, true);
});

check("an annotation with no suggested wording makes no card", () => {
    // A card with a blank back is worse than no card.
    assert.equal(cardFromAnnotation({ quote: "x" }), null);
    assert.equal(cardFromAnnotation({ fix: "y" }), null);
    assert.equal(cardFromAnnotation(null), null);
});

check("long quotes are clipped so the front stays readable", () => {
    const c = cardFromAnnotation({ ...ANN, quote: "x".repeat(200) }, {});
    assert.ok(c.question.length < 200, `front was ${c.question.length} chars`);
    assert.ok(c.question.includes("…"));
});

check("only MISSED criteria are worth banking", () => {
    assert.equal(cardFromCriterion({ text: "Names the transfer", got: true }), null);
    const c = cardFromCriterion({ text: "Names the transfer", got: false, note: "Say it explicitly." }, {});
    assert.ok(c.question.startsWith("Names the transfer"));
    assert.equal(c.answer, "Say it explicitly.");
});

check("a criterion with no note falls back to itself rather than a blank back", () => {
    const c = cardFromCriterion({ text: "Names the transfer", got: false }, {});
    assert.equal(c.answer, "Names the transfer");
});

check("bank cards are recognisable, and other cards are not", () => {
    assert.equal(isBankCard({ topic: BANK_TOPIC }), true);
    assert.equal(isBankCard({ topic: "Blurting gaps" }), false);
    assert.equal(isBankCard(null), false);
});

check("the same phrase banks once", () => {
    assert.equal(bankKey(ANN), "goes into solution");
    assert.equal(bankKey({ quote: "  padded " }), "padded");
    assert.equal(bankKey(null), "");
});

console.log(`\n${passed} passed`);
