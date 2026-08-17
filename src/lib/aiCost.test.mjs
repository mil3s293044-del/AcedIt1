/**
 * aiCost assertions — run with `node src/lib/aiCost.test.mjs`.
 *
 * The weekly spend ceiling is only as good as this arithmetic, and the two bugs
 * these tests pin down were both invisible in the UI: they made calls bill zero,
 * which looks exactly like a user who has not used the app. Every case marked
 * "REGRESSION" returned 0 under the previous integer-cent estimator.
 */
import assert from "node:assert/strict";
import {
    estimateCostMicros,
    priceFor,
    isUnpricedModel,
    formatMicros,
    MICROS_PER_DOLLAR,
    PRICES,
} from "./aiCost.js";

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

// The ceiling the server enforces, restated here so a change to one without the
// other trips a test rather than shipping.
const WEEKLY_CAP_MICROS = 1_950_000;

console.log("\naiCost\n");

check("a typical Ace turn bills a non-zero amount [REGRESSION]", () => {
    // 1,500 prompt tokens, 250 completion, no cache. Under integer cents this
    // is $0.00275 → round(0.275) → 0, which is why Ace was effectively free.
    const micros = estimateCostMicros(
        { input_tokens: 1500, output_tokens: 250 },
        "claude-haiku-4-5",
    );
    assert.equal(micros, 2750);
    assert.ok(micros > 0, "an Ace turn must cost something");
});

check("a cached Claude call bills a non-zero amount [REGRESSION]", () => {
    // input_tokens is the UNCACHED remainder. The old estimator subtracted the
    // cache fields from it a second time: (200 - 5000 - 0) × $3 drove the total
    // negative and Math.max(0, …) billed the call as free.
    const micros = estimateCostMicros(
        {
            input_tokens: 200,
            cache_read_input_tokens: 5000,
            cache_creation_input_tokens: 0,
            output_tokens: 300,
        },
        "claude-sonnet-4-6",
    );
    assert.equal(micros, 6600);
});

check("cache reads are cheaper than fresh input but not free", () => {
    const cached = estimateCostMicros(
        { input_tokens: 0, cache_read_input_tokens: 10_000, output_tokens: 0 },
        "claude-haiku-4-5",
    );
    const fresh = estimateCostMicros(
        { input_tokens: 10_000, output_tokens: 0 },
        "claude-haiku-4-5",
    );
    assert.equal(cached, 1000);        // 10k × $0.10/M
    assert.equal(fresh, 10_000);       // 10k × $1.00/M
    assert.equal(fresh, cached * 10);  // the documented 0.1x read rate
});

check("cache writes bill at 1.25x the input rate", () => {
    const micros = estimateCostMicros(
        {
            input_tokens: 100,
            cache_creation_input_tokens: 4000,
            output_tokens: 200,
        },
        "claude-haiku-4-5",
    );
    // 100×$1/M + 4000×$1.25/M + 200×$5/M = $0.0061
    assert.equal(micros, 6100);
});

check("an unknown model bills at the dearest known rate, never zero", () => {
    // A typo in ANTHROPIC_MODEL must not silently uncap spend.
    const micros = estimateCostMicros(
        { input_tokens: 1000, output_tokens: 1000 },
        "claude-typo-does-not-exist",
    );
    assert.equal(micros, 30_000);      // priced as Opus: $5/M in, $25/M out
    assert.ok(isUnpricedModel("claude-typo-does-not-exist"));
});

check("dated snapshot ids resolve to their family price", () => {
    assert.deepEqual(priceFor("claude-haiku-4-5-20251001"), PRICES["claude-haiku-4-5"]);
    assert.equal(isUnpricedModel("claude-haiku-4-5-20251001"), false);
    assert.equal(
        estimateCostMicros({ input_tokens: 1000, output_tokens: 1000 }, "claude-haiku-4-5-20251001"),
        6000,
    );
});

check("longest prefix wins so opus-5 never resolves to opus-4-8", () => {
    assert.deepEqual(priceFor("claude-opus-5"), PRICES["claude-opus-5"]);
    assert.deepEqual(priceFor("claude-sonnet-5"), PRICES["claude-sonnet-5"]);
});

check("missing usage and missing fields are zero, not NaN", () => {
    assert.equal(estimateCostMicros(null, "claude-haiku-4-5"), 0);
    assert.equal(estimateCostMicros(undefined, "claude-haiku-4-5"), 0);
    assert.equal(estimateCostMicros({}, "claude-haiku-4-5"), 0);
    assert.equal(
        estimateCostMicros({ input_tokens: "not a number" }, "claude-haiku-4-5"),
        0,
    );
});

check("a negative token count cannot credit the ceiling back", () => {
    // Defensive: a malformed usage payload must never reduce recorded spend.
    const micros = estimateCostMicros(
        { input_tokens: -5000, output_tokens: 100 },
        "claude-haiku-4-5",
    );
    assert.equal(micros, 500);
    assert.ok(micros >= 0);
});

check("the weekly ceiling buys a sane number of Ace turns", () => {
    const perTurn = estimateCostMicros(
        { input_tokens: 1500, output_tokens: 250 },
        "claude-haiku-4-5",
    );
    const turns = Math.floor(WEEKLY_CAP_MICROS / perTurn);
    // Sized so a heavy week of chat is comfortable but a scripted abuser is not.
    assert.ok(turns > 400, `only ${turns} turns fit the ceiling — too mean`);
    assert.ok(turns < 2000, `${turns} turns fit the ceiling — too loose`);
    console.log(`      (${turns} Ace turns fit inside ${formatMicros(WEEKLY_CAP_MICROS)})`);
});

check("formatMicros renders the ceiling as dollars", () => {
    assert.equal(formatMicros(WEEKLY_CAP_MICROS), "$1.95");
    assert.equal(formatMicros(1_000_000), "$1.00");
    assert.equal(formatMicros(0), "$0.00");
    assert.equal(MICROS_PER_DOLLAR, 1_000_000);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
