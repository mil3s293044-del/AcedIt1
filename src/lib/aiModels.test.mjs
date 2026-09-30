/**
 * aiModels assertions — node --import ./src/lib/_aliasLoader.mjs src/lib/aiModels.test.mjs
 *
 * The interesting cases are the two places the obvious design is wrong: the
 * nudge must not fire at the ceiling (switching cannot refund spent dollars),
 * and a `fast: true` flag must not drag a Saver user back up the price list.
 */
import assert from "node:assert/strict";
import {
    TIERS, DEFAULT_TIER, SAVER_EXCLUDES, NUDGE_AT,
    tierOf, modelFor, saverMultiplier, saverNudge,
} from "@/lib/aiModels";
import { PRICES } from "@/lib/aiCost";

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

const CAP = 1_950_000;
const at = (pct) => Math.round(CAP * pct);

console.log("\naiModels\n");

check("an unknown or missing preference falls back to standard", () => {
    assert.equal(tierOf(undefined), "standard");
    assert.equal(tierOf(null), "standard");
    assert.equal(tierOf(""), "standard");
    assert.equal(tierOf("cheapest"), "standard");
    assert.equal(tierOf("saver"), "saver");
    assert.equal(DEFAULT_TIER, "standard");
});

check("saver routes every feature to Haiku while the excludes list is empty", () => {
    assert.deepEqual(SAVER_EXCLUDES, [], "the lever ships empty — see the comment on it");
    for (const f of ["quiz_ai_gen", "quiz_ai_mark", "flashcard_ai_gen", "ai_tool", "blurting"]) {
        assert.equal(modelFor("saver", f), TIERS.saver.model, f);
    }
});

check("an excluded feature stays on the full model even in saver", () => {
    // Simulates populating the lever, without asserting it should be populated.
    const excluded = "quiz_ai_mark";
    const saved = SAVER_EXCLUDES.slice();
    SAVER_EXCLUDES.push(excluded);
    try {
        assert.equal(modelFor("saver", excluded), TIERS.standard.model);
        assert.equal(modelFor("saver", "quiz_ai_gen"), TIERS.saver.model);
    } finally {
        SAVER_EXCLUDES.length = 0;
        SAVER_EXCLUDES.push(...saved);
    }
});

check("fast:true never moves a saver user back UP the price list", () => {
    // The pre-existing per-call `fast` route exists to cut latency in Standard.
    // In Saver the tier is already the cheaper model, so honouring `fast` there
    // would raise the cost of someone actively trying to economise.
    const opts = { fast: true, standardModel: "claude-sonnet-4-6", fastModel: "claude-sonnet-4-6" };
    assert.equal(modelFor("saver", "ai_tool", opts), TIERS.saver.model);
    assert.equal(modelFor("standard", "ai_tool", opts), "claude-sonnet-4-6");
});

check("the standard tier honours an explicitly configured fast model", () => {
    assert.equal(
        modelFor("standard", "ai_tool", { fast: true, fastModel: "claude-haiku-4-5" }),
        "claude-haiku-4-5",
    );
    assert.equal(modelFor("standard", "ai_tool", { fast: false }), TIERS.standard.model);
});

check("the multiplier comes from the price table, not a hardcoded 3", () => {
    // This check used to assert `=== 3`, which is the exact thing its own name
    // says it is guarding against: the 3 came from Sonnet 4.6 at $3/$15 against
    // Haiku at $1/$5, so moving the standard tier to Sonnet 5.5 ($2/$10) made
    // the function right and the assertion wrong. Derived from the same table
    // the function reads, so a rate change moves both together.
    const std = PRICES[TIERS.standard.model];
    const saver = PRICES[TIERS.saver.model];
    assert.ok(std && saver, "a tier points at a model with no price row");
    const expected = Math.round(((std.in + std.out * 3) / (saver.in + saver.out * 3)) * 10) / 10;
    assert.equal(saverMultiplier(), expected);
    assert.ok(saverMultiplier() > 1, "Saver has to be cheaper or the offer is empty");
});

check("BOTH TIER MODELS ARE PRICED, or the offer is computed off a guess", () => {
    // `saverMultiplier` divides two price rows. An unpriced tier model resolves
    // to the dearest known rate, which would quietly compute a multiplier of
    // about 1 and put "switch to save" on screen next to no saving at all.
    for (const tier of Object.values(TIERS)) {
        assert.ok(PRICES[tier.model], `${tier.id} points at unpriced ${tier.model}`);
    }
});

// ── The nudge, which is where the naive design goes wrong ────────────────────

check("no nudge while there is plenty of headroom", () => {
    assert.equal(saverNudge({ preference: "standard", spentMicros: at(0.10), capMicros: CAP }), null);
    assert.equal(saverNudge({ preference: "standard", spentMicros: at(0.69), capMicros: CAP }), null);
});

check("nudge appears at the threshold, while it can still pay out", () => {
    const n = saverNudge({ preference: "standard", spentMicros: at(NUDGE_AT), capMicros: CAP });
    assert.ok(n, "should nudge at the threshold");
    assert.equal(n.usedPct, 70);
    // Derived, for the reason above — the nudge prints whatever the table says.
    assert.equal(n.multiplier, saverMultiplier());
    assert.match(n.body, new RegExp(`${saverMultiplier()}x more`));
});

check("NO nudge at the ceiling — the offer cannot pay out [THE POINT]", () => {
    // The ceiling counts dollars already spent. Switching model does not refund
    // them, it only makes the next call cheaper — and there is no next call.
    // Offering a fix here would be a promise that does nothing.
    assert.equal(saverNudge({ preference: "standard", spentMicros: CAP, capMicros: CAP }), null);
    assert.equal(saverNudge({ preference: "standard", spentMicros: CAP * 2, capMicros: CAP }), null);
});

check("no nudge at someone already in saver", () => {
    assert.equal(saverNudge({ preference: "saver", spentMicros: at(0.85), capMicros: CAP }), null);
});

check("a missing or zero cap does not divide by zero", () => {
    assert.equal(saverNudge({ preference: "standard", spentMicros: 100, capMicros: 0 }), null);
    assert.equal(saverNudge({ preference: "standard", spentMicros: 100, capMicros: null }), null);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
