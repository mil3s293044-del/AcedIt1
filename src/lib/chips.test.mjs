/**
 * chips assertions — node --import ./src/lib/_aliasLoader.mjs src/lib/chips.test.mjs
 *
 * The load-bearing one is the first: every published price must cost us less
 * than it charges. A price set below its real cost would mean a student who
 * spends a full stack has cost more than the ceiling the business signed off
 * on, which is the one failure this whole scheme cannot have.
 */
import assert from "node:assert/strict";
import { estimateCostMicros } from "@/lib/aiCost";
import {
    PRICE, DEFAULT_PRICE, WEEKLY_CHIPS, WEEKLY_CAP_MICROS, MICROS_PER_CHIP,
    priceOf, priceLabel, chipsSpent, stackOf, canAfford, affordable,
    saverDivisor, stackWarning, SAVER_AT, LOW_AT, ALREADY_CHEAP,
    ACE_RESERVE, spendableFor,
} from "@/lib/chips";

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

/** The token shapes the prices were derived from. */
const SHAPES = {
    study_coach:      ["claude-haiku-4-5",  1500,  250],
    active_recall:    ["claude-sonnet-4-6", 1000,  600],
    blurting:         ["claude-sonnet-4-6", 1200,  700],
    ai_chat:          ["claude-sonnet-4-6", 1800,  600],
    quiz_ai_mark:     ["claude-sonnet-4-6", 1500,  800],
    mindmap_gaps:     ["claude-sonnet-4-6", 2000, 1200],
    ai_tool:          ["claude-sonnet-4-6", 2000, 1200],
    goal_ai_gen:      ["claude-sonnet-4-6", 1500, 1500],
    roadmap_ai_gen:   ["claude-sonnet-4-6", 1500, 1500],
    flashcard_ai_gen: ["claude-sonnet-4-6", 2000, 2500],
    quiz_ai_gen:      ["claude-sonnet-4-6", 2500, 3000],
};

const premium = (spent) => ({ subscription_tier: "premium", weekly_chips_spent: spent });

console.log("\nchips\n");

check("every price covers its own cost [THE POINT]", () => {
    let worst = { name: null, margin: Infinity };
    for (const [feature, [model, i, o]] of Object.entries(SHAPES)) {
        const realMicros = estimateCostMicros({ input_tokens: i, output_tokens: o }, model);
        const chargedMicros = priceOf(feature) * MICROS_PER_CHIP;
        assert.ok(chargedMicros >= realMicros,
            `${feature} charges ${priceOf(feature)} chips (${chargedMicros}µ) for something costing ${realMicros}µ`);
        const margin = chargedMicros / realMicros - 1;
        if (margin < worst.margin) worst = { name: feature, margin };
    }
    console.log(`      (thinnest margin: ${worst.name} at ${(worst.margin * 100).toFixed(0)}%)`);
    assert.ok(worst.margin > 0.05, "every action should keep at least a few percent");
});

check("a full stack cannot exceed the weekly ceiling [THE POINT]", () => {
    // Whatever they spend it on, the dearest possible basket must still land
    // under the dollar ceiling. Spending it all on the thinnest-margin action
    // is the worst case.
    for (const [feature, [model, i, o]] of Object.entries(SHAPES)) {
        const realMicros = estimateCostMicros({ input_tokens: i, output_tokens: o }, model);
        const n = Math.floor(WEEKLY_CHIPS / priceOf(feature));
        assert.ok(n * realMicros <= WEEKLY_CAP_MICROS,
            `${n} x ${feature} = ${n * realMicros}µ, over the ${WEEKLY_CAP_MICROS}µ ceiling`);
    }
});

check("the old daily caps allowed far more than the ceiling [REGRESSION]", () => {
    // The contradiction this replaces, stated as a number.
    const OLD_CAPS = {
        quiz_ai_gen: 3, quiz_ai_mark: 10, flashcard_ai_gen: 3, ai_tool: 6,
        ai_chat: 8, goal_ai_gen: 1, roadmap_ai_gen: 5, blurting: 5,
        active_recall: 8, study_coach: 30, mindmap_gaps: 6,
    };
    let weekMicros = 0;
    for (const [f, cap] of Object.entries(OLD_CAPS)) {
        const [model, i, o] = SHAPES[f];
        weekMicros += estimateCostMicros({ input_tokens: i, output_tokens: o }, model) * cap * 7;
    }
    assert.ok(weekMicros > WEEKLY_CAP_MICROS * 3,
        `the old caps should have been wildly over; got ${(weekMicros / WEEKLY_CAP_MICROS).toFixed(1)}x`);
    console.log(`      (old daily caps permitted ${(weekMicros / WEEKLY_CAP_MICROS).toFixed(1)}x the weekly ceiling)`);
});

check("saver is exactly three times further, computed not typed", () => {
    assert.equal(saverDivisor(), 3);
    assert.equal(priceOf("quiz_ai_gen", "saver"), 10);
    assert.equal(priceOf("flashcard_ai_gen", "saver"), 9, "25/3 rounds up, never down");
    assert.equal(affordable("quiz_ai_gen"), 33);
    assert.equal(affordable("quiz_ai_gen", "saver"), 100);
});

check("saver never makes anything free", () => {
    for (const f of Object.keys(PRICE)) {
        assert.ok(priceOf(f, "saver") >= 1, `${f} went free on saver`);
    }
});

check("Ace is not discounted twice", () => {
    // His price was already computed from Haiku, so a saver discount on top
    // would charge a third of the cheap model's real cost.
    assert.ok(ALREADY_CHEAP.has("study_coach"));
    assert.equal(priceOf("study_coach", "saver"), priceOf("study_coach", "standard"));
});

check("an unpriced feature costs the most, not the least", () => {
    assert.equal(priceOf("some_feature_added_next_year"), DEFAULT_PRICE);
    assert.equal(DEFAULT_PRICE, Math.max(...Object.values(PRICE)));
});

check("the stack reads correctly, including nonsense", () => {
    assert.deepEqual(stackOf(premium(0)), { spent: 0, remaining: 1000, total: 1000, pct: 0, empty: false });
    assert.equal(stackOf(premium(250)).remaining, 750);
    assert.equal(stackOf(premium(250)).pct, 25);
    assert.equal(stackOf(premium(1000)).empty, true);
    assert.equal(stackOf(premium(9999)).remaining, 0, "overspend never goes negative");
    assert.equal(stackOf(premium(9999)).pct, 100, "nor over 100%");
    assert.equal(stackOf(null).remaining, 1000);
    assert.equal(stackOf({}).spent, 0);
});

check("a profile written before the migration still reads honestly", () => {
    // Only the micro ledger exists on those rows. Showing them a full stack
    // they have already half spent would be the meter lying on day one.
    const old = { weekly_ai_cost_micros: 975_000 };   // half the ceiling
    assert.equal(chipsSpent(old), 500);
    assert.equal(stackOf(old).remaining, 500);
});

check("the bottom of the stack is kept for Ace [THE POINT]", () => {
    // A study app that goes completely silent on the Wednesday of exam week
    // is one that gets cancelled on the Thursday.
    const nearlyOut = premium(WEEKLY_CHIPS - 40);       // 40 left, inside the reserve
    assert.equal(canAfford(nearlyOut, "quiz_ai_gen").ok, false, "the generators stop");
    assert.equal(canAfford(nearlyOut, "study_coach").ok, true, "Ace does not");
    assert.equal(spendableFor(nearlyOut, "quiz_ai_gen"), 0);
    assert.equal(spendableFor(nearlyOut, "study_coach"), 40);

    // And the reserve really does run out eventually.
    assert.equal(canAfford(premium(WEEKLY_CHIPS), "study_coach").ok, false);

    // Just above the reserve, everything still works.
    const fine = premium(WEEKLY_CHIPS - ACE_RESERVE - PRICE.quiz_ai_gen);
    assert.equal(canAfford(fine, "quiz_ai_gen").ok, true);
});

check("the meter says the generators have stopped, not that the app has", () => {
    const w = stackWarning(premium(WEEKLY_CHIPS - 40));
    assert.equal(w.level, "reserve");
    assert.match(w.title, /saved for Ace/);
    assert.match(w.body, /20 more questions/);
    // And at genuinely zero it does not promise something it cannot deliver.
    const empty = stackWarning(premium(WEEKLY_CHIPS));
    assert.doesNotMatch(empty.body, /Ace still works/,
        "do not promise Ace when even his reserve is gone");
});

check("affording something, and what to do when you cannot", () => {
    const rich = canAfford(premium(0), "quiz_ai_gen");
    assert.equal(rich.ok, true);
    assert.equal(rich.price, 30);

    // 925 spent leaves 75, of which 60 is Ace's reserve — 15 spendable. Not
    // enough for a 30-chip quiz, but enough for the 10-chip saver version.
    // A refusal that names the way through.
    const tight = canAfford(premium(925), "quiz_ai_gen");
    assert.equal(tight.ok, false);
    assert.equal(tight.remaining, 15);
    assert.equal(tight.saverWouldWork, true);
    assert.equal(tight.saverPrice, 10);

    // Truly empty: saver does not rescue it either.
    const broke = canAfford(premium(1000), "quiz_ai_gen");
    assert.equal(broke.ok, false);
    assert.equal(broke.saverWouldWork, false);

    // Already on saver — no point offering it again.
    assert.equal(canAfford(premium(999), "quiz_ai_gen", "saver").saverWouldWork, false);
});

check("the meter stays quiet until it has something to say", () => {
    assert.equal(stackWarning(premium(0)), null);
    assert.equal(stackWarning(premium(500)), null, "half a stack is not news");
    assert.equal(stackWarning(premium(WEEKLY_CHIPS * SAVER_AT - 1)), null, "just under the nudge");

    const nudge = stackWarning(premium(WEEKLY_CHIPS * SAVER_AT));
    assert.equal(nudge.level, "nudge");
    assert.match(nudge.body, /3x further/);

    const low = stackWarning(premium(WEEKLY_CHIPS * LOW_AT));
    assert.equal(low.level, "low");
    assert.match(low.title, /100 chips left/);

    // The reserve state sits between "low" and "empty" now, so the ladder is
    // nudge -> low -> reserve -> empty. Checked in its own case above.
    const empty = stackWarning(premium(WEEKLY_CHIPS));
    assert.equal(empty.level, "empty");
    assert.match(empty.body, /carries on as normal/,
        "even at zero it must say what still works, not just what does not");
});

check("a saver user is not nudged to switch to saver", () => {
    const n = stackWarning(premium(750), "saver");
    assert.equal(n, null, "there is nothing to offer them");
    const e = stackWarning(premium(1000), "saver");
    assert.doesNotMatch(e.body, /Saver would/, "do not tell them to do what they did");
});

check("prices read as English", () => {
    assert.equal(priceLabel("quiz_ai_gen"), "30 chips");
    assert.equal(priceLabel("study_coach"), "2 chips");
    assert.equal(priceLabel("quiz_ai_gen", "saver"), "10 chips");
    // Singular, for whenever a price lands on one.
    assert.equal(priceLabel("__unpriced_but_one__").endsWith("chips"), true);
});

check("a week of ordinary use fits comfortably", () => {
    // A realistic heavy week: daily Ace, a couple of decks, some marking.
    const week = (7 * 10 * PRICE.study_coach)      // 10 Ace messages a day
        + (3 * PRICE.flashcard_ai_gen)             // three decks
        + (2 * PRICE.quiz_ai_gen)                  // two quizzes
        + (8 * PRICE.quiz_ai_mark)                 // marking
        + (5 * PRICE.ai_tool);                     // five tool runs
    assert.ok(week < WEEKLY_CHIPS, `a heavy but plausible week came to ${week}`);
    console.log(`      (a heavy realistic week: ${week} of ${WEEKLY_CHIPS} chips)`);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
