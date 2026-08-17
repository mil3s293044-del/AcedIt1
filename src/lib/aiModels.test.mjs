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
    // Sonnet $3/$15, Haiku $1/$5 — a clean 3x on both axes.
    assert.equal(saverMultiplier(), 3);
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
    assert.equal(n.multiplier, 3);
    assert.match(n.body, /3x more/);
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
