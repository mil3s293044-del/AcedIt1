/**
 * mistake bank assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/mistakeBank.test.mjs
 *
 * The bug these exist to keep out: a mistake the student can SEE but cannot
 * SAVE. There were two card builders, one for a quoted phrase and one for a
 * missed criterion, and only the phrase one was ever wired up — so exactly the
 * marks with nothing to quote, which are the ones whose words are missing from
 * the answer, were the ones with no button.
 */
import assert from "node:assert/strict";
import { cardFromModule, isBankCard, bankKey, BANK_TOPIC } from "@/lib/mistakeBank";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const QUOTED = {
    id: "c0",
    kind: "criterion",
    status: "lost",
    text: "Names the electron transfer",
    detail: "VCAA wants the transfer stated, not inferred.",
    wanted: "The number of electrons, explicitly.",
    worth: 2, cost: 2,
    evidence: [{ id: "a0", quote: "goes into solution" }],
    fixes: ["loses two electrons"],
};

// The one that used to have no button at all: a mark lost because words are
// ABSENT, so there is nothing in the answer to underline.
const UNQUOTED = {
    id: "c1", kind: "criterion", status: "lost",
    text: "States oxidation at the anode",
    detail: "", wanted: "The half-equation, named as oxidation.",
    worth: 1, cost: 1, evidence: [], fixes: [],
};

check("the card asks for the FIX, never rehearsing the mistake", () => {
    const c = cardFromModule(QUOTED, { subject: "Chemistry", questionTitle: "Q3b" });
    assert.ok(c.answer.startsWith("loses two electrons"), "the back is what scores");
    assert.ok(c.question.includes("goes into solution"), "the front recalls what they wrote");
    assert.ok(c.question.includes("Q3b"));
    assert.equal(c.subject_name, "Chemistry");
    assert.equal(c.topic, BANK_TOPIC);
    assert.equal(c.is_active, true);
    assert.equal(c.is_weak_spot, true, "a dropped mark is a demonstrated weak spot");
});

check("a lost mark with NOTHING to quote still makes a card", () => {
    const c = cardFromModule(UNQUOTED, { questionTitle: "Q3b" });
    assert.ok(c, "this is the whole repair — it used to return nothing");
    assert.ok(c.question.includes("States oxidation at the anode"));
    assert.ok(c.answer.includes("half-equation"), "the back is what the assessor wanted");
});

check("a lost mark with no wording at all still has a usable back", () => {
    const c = cardFromModule({ ...UNQUOTED, wanted: "", detail: "" });
    // The criterion text is already phrased as what the assessor was looking
    // for, so it is a legitimate back — never a blank one.
    assert.equal(c.answer, "States oxidation at the anode");
});

check("an imprecision that survived needs a fix to be worth a card", () => {
    // Nothing was lost, so with no wording to rehearse the card has no back.
    assert.equal(cardFromModule({ ...UNQUOTED, status: "risk", wanted: "", fixes: [] }), null);
    const c = cardFromModule({ ...UNQUOTED, status: "risk", fixes: ["say it as a half-equation"] });
    assert.ok(c);
    assert.equal(c.is_weak_spot, false, "it did not cost a mark, so it is not a weak spot");
    assert.equal(c.unit, "Imprecise wording");
});

check("two fixes both reach the back", () => {
    const c = cardFromModule({ ...QUOTED, fixes: ["loses two electrons", "is oxidised, losing 2e-"] });
    assert.ok(c.answer.includes("loses two electrons"));
    assert.ok(c.answer.includes("is oxidised, losing 2e-"));
});

check("long quotes are clipped so the front stays readable", () => {
    const c = cardFromModule({ ...QUOTED, evidence: [{ id: "a0", quote: "x".repeat(200) }] }, {});
    assert.ok(c.question.length < 200, `front was ${c.question.length} chars`);
    assert.ok(c.question.includes("…"));
});

check("nothing at all makes no card", () => {
    assert.equal(cardFromModule(null), null);
    assert.equal(cardFromModule({ status: "lost", text: "", fixes: [] }), null);
});

check("bank cards are recognisable, and other cards are not", () => {
    assert.equal(isBankCard({ topic: BANK_TOPIC }), true);
    assert.equal(isBankCard({ topic: "Blurting gaps" }), false);
    assert.equal(isBankCard(null), false);
});

check("the same mark banks once, but the same criterion on another question does not collide", () => {
    // Keyed per question: two questions can genuinely drop the same criterion
    // and both are worth rehearsing. Under the old bare-quote key the second
    // one rendered as already saved.
    assert.equal(bankKey(QUOTED, 0), bankKey({ ...QUOTED, id: "c9" }, 0), "identity is the mark, not its position");
    assert.notEqual(bankKey(QUOTED, 0), bankKey(QUOTED, 3));
    assert.equal(bankKey({ text: "  Padded " }, 1), "q1:padded");
    assert.equal(bankKey(null), "");
});

console.log(`\n${passed} passed`);
