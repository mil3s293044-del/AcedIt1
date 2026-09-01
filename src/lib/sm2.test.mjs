/**
 * scheduler assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/sm2.test.mjs
 *
 * This file moved out of SpacedRepetition.jsx so the mistake bank could grade
 * the same rows. These exist to prove it moved WITHOUT CHANGING — a card
 * answered in the bank has to come back on the day the deck would have chosen,
 * or the two screens are quietly scheduling the same card differently.
 */
import assert from "node:assert/strict";
import { calculateNextReview, reviewPatch, formatIntervalShort, RATINGS } from "@/lib/sm2";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const fresh = (over = {}) => ({
    review_count_again: 0, review_count_hard: 0, review_count_good: 0, review_count_easy: 0,
    consecutive_good: 0, consecutive_easy: 0, easiness_factor: 2.5, interval_days: 1,
    repetitions: 0, is_weak_spot: false, ...over,
});

check("Again resets the card to tomorrow and drops the ease", () => {
    const u = calculateNextReview(1, fresh({ interval_days: 40, repetitions: 5 }));
    assert.equal(u.interval_days, 1);
    assert.equal(u.repetitions, 0);
    assert.equal(u.review_count_again, 1);
    assert.ok(u.easiness_factor < 2.5);
});

check("the streak counters are exclusive", () => {
    // Good clears the easy streak and vice versa — fixState reads the max of
    // the two, so a card alternating Good/Easy must never look like a run.
    const g = calculateNextReview(3, fresh({ consecutive_easy: 3 }));
    assert.equal(g.consecutive_good, 1);
    assert.equal(g.consecutive_easy, 0);
    const e = calculateNextReview(4, fresh({ consecutive_good: 3 }));
    assert.equal(e.consecutive_easy, 1);
    assert.equal(e.consecutive_good, 0);
});

check("the early intervals are the fixed ladder, not the ease factor", () => {
    assert.equal(calculateNextReview(3, fresh()).interval_days, 1);
    assert.equal(calculateNextReview(3, fresh({ repetitions: 1, interval_days: 1 })).interval_days, 3);
    assert.equal(calculateNextReview(4, fresh()).interval_days, 2);
    assert.equal(calculateNextReview(4, fresh({ repetitions: 1, interval_days: 2 })).interval_days, 5);
});

check("the ease factor stays inside its bounds", () => {
    let card = fresh({ easiness_factor: 1.35 });
    for (let i = 0; i < 5; i++) card = { ...card, ...calculateNextReview(1, card) };
    assert.ok(card.easiness_factor >= 1.3, `fell to ${card.easiness_factor}`);
    card = fresh({ easiness_factor: 2.95 });
    for (let i = 0; i < 5; i++) card = { ...card, ...calculateNextReview(4, card) };
    assert.ok(card.easiness_factor <= 3.0, `rose to ${card.easiness_factor}`);
});

check("intervals are capped at half a year", () => {
    const u = calculateNextReview(4, fresh({ interval_days: 175, repetitions: 9, easiness_factor: 3 }));
    assert.equal(u.interval_days, 180);
});

check("a weak spot leaves only after a real run", () => {
    const weak = fresh({ is_weak_spot: true, review_count_again: 3, consecutive_good: 2 });
    assert.equal(calculateNextReview(3, weak).is_weak_spot, false, "third consecutive good clears it");
    assert.equal(calculateNextReview(3, { ...weak, consecutive_good: 0 }).is_weak_spot, true);
});

check("next_review_date lands interval_days from today", () => {
    const u = calculateNextReview(3, fresh({ repetitions: 1, interval_days: 1 }));
    const expect = new Date();
    expect.setDate(expect.getDate() + u.interval_days);
    assert.equal(u.next_review_date, expect.toISOString().split("T")[0]);
});

check("the patch never carries a column the table does not have", () => {
    // _mastery_score is derived. PostgREST rejects the whole row if it slips
    // through, which loses the rating the student just gave.
    const u = calculateNextReview(3, fresh());
    assert.ok("_mastery_score" in u, "still returned for the caller");
    const patch = reviewPatch(u, 3);
    assert.ok(!Object.keys(patch).some((k) => k.startsWith("_")), Object.keys(patch).join());
    assert.equal(patch.last_quality, 3);
    assert.ok(patch.last_reviewed_date);
});

check("the four buttons are the four qualities", () => {
    assert.deepEqual(RATINGS.map((r) => r.quality), [1, 2, 3, 4]);
    // Built from one list so the bank and the deck cannot offer different
    // grades for the same card.
    assert.ok(RATINGS.every((r) => r.label && r.color));
});

check("intervals read the way a student reads them", () => {
    assert.equal(formatIntervalShort(1), "1d");
    assert.equal(formatIntervalShort(14), "2w");
    assert.equal(formatIntervalShort(90), "3mo");
});

console.log(`\n${passed} passed`);
