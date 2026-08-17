/**
 * aceGuide routing assertions.
 *
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/aceGuide.test.mjs
 *
 * The guide gets first refusal on every message a student sends, and returning
 * a value means the model is never called. That makes it the single place where
 * Ace can stop being a chat and become a vending machine — which is exactly
 * what happened: "I have an English SAC for Ransom in a week and a day but idk
 * what I need to know like idk the book at all" came back as a card advertising
 * the English marking tool, because "english" is one of that feature's keywords
 * and one keyword was enough.
 *
 * So both directions are asserted here. Lookups must still be answered without
 * a model call (that was the whole point of the guide), and anything that reads
 * like a person talking must reach the model.
 */
import assert from "node:assert/strict";
import { answer } from "@/lib/aceGuide";

let passed = 0;
const check = (name, fn) => {
    try {
        fn();
        passed += 1;
        console.log(`  ok  ${name}`);
    } catch (err) {
        console.error(`FAIL  ${name}\n      ${err.message}`);
        process.exitCode = 1;
    }
};

const opts = { ready: null, premium: true };
/** null is the handover signal — the caller streams from the model instead. */
const goesToModel = (q) => answer(q, opts) === null;
const kindOf = (q) => answer(q, opts)?.kind ?? null;

console.log("\naceGuide — who answers, the rules or the model\n");

// ── The regression, verbatim from the bug report ─────────────────────────────

check("the English SAC message reaches the model [REGRESSION]", () => {
    const q = "hi idk where to start. I have an English SAC for Ransom in a week "
            + "and a day but idk what I need to know like idk the book at all";
    assert.ok(goesToModel(q), "a student describing their week must not get a feature card");
});

check("a subject name in a sentence about school is not a lookup [REGRESSION]", () => {
    assert.ok(goesToModel("my english teacher said my essays are too descriptive and I don't know how to fix that"));
    assert.ok(goesToModel("I've got a chemistry test on Thursday and I haven't started revising for it yet"));
    assert.ok(goesToModel("do you think I should drop methods next year or push through it"));
});

check("asking for help with the actual subject reaches the model", () => {
    assert.ok(goesToModel("can you explain what osmosis actually is because the textbook makes no sense"));
    assert.ok(goesToModel("what were the main causes of world war one for my history sac"));
});

// ── The guide must still do its job ──────────────────────────────────────────

check("a direct feature lookup is still answered without a model call", () => {
    assert.equal(kindOf("where is english mentor"), "feature");
    assert.equal(kindOf("mind maps"), "feature");
    assert.equal(kindOf("what is blurting"), "feature");
});

check("short how-do-I questions about a feature still hit the guide", () => {
    assert.equal(kindOf("how do I use spaced repetition"), "feature");
    assert.equal(kindOf("mark my essay"), "feature");
});

check("the what-should-I-do intent still returns the hand", () => {
    assert.equal(kindOf("what should I do right now"), "hand");
    assert.equal(kindOf("i'm stuck"), "hand");
});

check("'what should I do' inside a real message reaches the model [REGRESSION]", () => {
    // The hand renders the whole first-open screen — cards plus the opener
    // buttons. Returned mid-conversation it reads as Ace ignoring the question
    // and starting over, which is what this student got.
    const q = "okay I have an English essay about ransom in like a week and a day "
            + "but idk anything about ransom what should I do";
    assert.ok(goesToModel(q), "a paragraph ending in 'what should I do' is a question, not a menu");
});

check("longer stuck-sounding messages still reach the model [REGRESSION]", () => {
    assert.ok(goesToModel(
        "i'm stuck on this practice exam question about projectile motion and the "
        + "worked solution skips three steps so I cannot follow it at all",
    ));
    assert.ok(goesToModel(
        "there is nothing to do in my planner but I still feel behind on everything "
        + "and I do not know which subject to start with tonight",
    ));
});

check("an empty or whitespace message returns null", () => {
    assert.equal(answer("", opts), null);
    assert.equal(answer("   ", opts), null);
    assert.equal(answer(null, opts), null);
});

check("a question about nothing in the app reaches the model", () => {
    assert.ok(goesToModel("what's the capital of France"));
    assert.ok(goesToModel("are you a real person"));
});

// ── The boundary itself ──────────────────────────────────────────────────────

check("coverage, not keyword presence, decides", () => {
    // Same keyword, opposite verdicts — the short one IS the question, the long
    // one merely contains it.
    assert.equal(kindOf("english mentor"), "feature");
    assert.ok(goesToModel(
        "so for english we have to write a comparative piece on two texts I have not read "
        + "and it is due next week and I have no idea how to even begin planning it",
    ));
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
