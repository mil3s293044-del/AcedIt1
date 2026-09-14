/**
 * holdings assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/holdings.test.mjs
 *
 * Two things this file exists to hold:
 *
 *   A LEVEL AND A VOID ARE NOT LOSSES. The whole board rests on "restating the
 *   price pays exactly nothing", so a record that files that under defeats
 *   teaches the opposite of the one property the system has. Checked in the
 *   record, in the hit rate, and in the streak.
 *
 *   IT REFUSES TO SCORE SOMEBODY ON TWO CALLS. A calibration curve drawn from
 *   three settled positions is a personality judgement made off a coin flip.
 */
import assert from "node:assert/strict";
import {
    bookOf, equityCurve, calibration, outcomeOf, streakOf,
    CALIBRATION_MIN, CALIBRATION_MIN_TOTAL,
} from "@/lib/holdings";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

let clock = Date.parse("2026-09-01T00:00:00Z");
const tick = () => { clock += 36e5; return new Date(clock).toISOString(); };

/** A settled position. `p` is P(yes); `won` says what actually happened. */
const done = (p, stake, payout, outcome, status = "resolved") => ({
    id: `h${clock}`, market_id: `m${clock}`, p, stake,
    price_at_entry: 0.5, payout, settled_at: tick(),
    market: { id: `m${clock}`, title: "t", status, outcome, prior: 0.5, price: null },
});
const live = (p, stake, price) => ({
    id: `o${clock}`, market_id: `n${clock}`, p, stake,
    price_at_entry: 0.5, payout: null, settled_at: null, created_date: tick(),
    market: { id: `n${clock}`, title: "t", status: "open", outcome: null, prior: 0.5, price },
});

// ─── The four outcomes ──────────────────────────────────────────────────────

check("FOUR OUTCOMES, matching settlementOf exactly", () => {
    assert.equal(outcomeOf(done(0.9, 100, 30, true)), "won");
    assert.equal(outcomeOf(done(0.9, 100, -30, false)), "lost");
    assert.equal(outcomeOf(done(0.5, 100, 0, true)), "level");
    assert.equal(outcomeOf(done(0.9, 100, 0, null, "void")), "void");
    assert.equal(outcomeOf(live(0.9, 100, 0.6)), null, "an open position has no outcome");
});

check("A LEVEL AND A VOID ARE NOT LOSSES, in the record or the hit rate", () => {
    const book = bookOf([
        done(0.9, 100, 40, true), done(0.8, 100, -25, false),
        done(0.5, 100, 0, true), done(0.9, 100, 0, null, "void"),
    ]);
    assert.deepEqual(book.record, { won: 1, lost: 1, level: 1, void: 1 });
    // Only the two that actually resolved one way count in the denominator.
    assert.equal(book.decided, 2);
    assert.equal(book.hitRate, 0.5,
        "counting the level and the void would print 25% for the same week's work");
});

check("...and neither ends a streak", () => {
    // Newest last in the fixtures; streakOf reads backwards from the newest.
    assert.equal(streakOf([
        done(0.9, 100, 10, true),
        done(0.5, 100, 0, true),               // level: skipped
        done(0.9, 100, 0, null, "void"),       // void: skipped
        done(0.9, 100, 10, true),
    ]), 2, "agreeing with the crowd once must not cost somebody their run");
    assert.equal(streakOf([
        done(0.9, 100, 10, true),
        done(0.8, 100, -20, false),            // a real loss DOES end it
        done(0.9, 100, 10, true),
    ]), 1);
    assert.equal(streakOf([]), 0);
});

// ─── The book ───────────────────────────────────────────────────────────────

check("at stake counts only what is still running", () => {
    const book = bookOf([done(0.9, 100, 40, true), live(0.8, 250, 0.7), live(0.2, 50, 0.3)]);
    assert.equal(book.atStake, 300);
    assert.equal(book.open.length, 2);
    assert.equal(book.realised, 40);
});

check("EXPECTED is an expectation and moves with the price", () => {
    // Same position, two different rooms. The one the crowd has come around to
    // must be worth more than the one it has moved against.
    const withMe = bookOf([live(0.85, 100, 0.8)]).expected;
    const againstMe = bookOf([live(0.85, 100, 0.2)]).expected;
    assert.ok(withMe > againstMe,
        "a market moving toward your side has to read as better than one moving away");
});

check("the equity curve is cumulative and starts at nothing", () => {
    const curve = equityCurve([
        done(0.9, 100, 40, true), done(0.8, 100, -25, false), done(0.95, 200, 60, true),
    ]);
    assert.equal(curve.points[0].value, 0, "a curve of RESULTS begins at zero, not at a balance");
    assert.deepEqual(curve.points.map((p) => p.value), [0, 40, 15, 75]);
    assert.equal(curve.last, 75);
    assert.equal(curve.high, 75);
    assert.equal(curve.best, 60);
    assert.equal(curve.worst, -25);
});

check("nothing settled is an empty curve rather than a flat line at zero", () => {
    const curve = equityCurve([live(0.9, 100, 0.6)]);
    assert.deepEqual(curve.points, []);
    assert.equal(curve.last, 0);
});

// ─── Calibration ────────────────────────────────────────────────────────────

/** n calls at one conviction, `hits` of which went the way they were called. */
const band = (conviction, n, hits) => Array.from({ length: n }, (_, i) =>
    done(conviction, 100, i < hits ? 10 : -10, i < hits));

check("IT REFUSES TO SCORE SOMEBODY ON TWO CALLS", () => {
    const cal = calibration(band(0.9, 2, 1));
    assert.equal(cal.ready, false);
    assert.equal(cal.bias, null, "a bias printed off two calls is a coin flip with a name on it");
    assert.equal(cal.needs, CALIBRATION_MIN_TOTAL - 2);
    assert.ok(cal.bands.every((b) => b.actual === null),
        "and no band may be drawn as a point either");
});

check("a band under CALIBRATION_MIN reports its count and not a rate", () => {
    const rows = [...band(0.9, 6, 5), ...band(0.65, CALIBRATION_MIN - 1, 0)];
    const cal = calibration(rows);
    const thin = cal.bands.find((b) => b.lo === 0.6);
    assert.equal(thin.n, CALIBRATION_MIN - 1);
    assert.equal(thin.enough, false);
    assert.equal(thin.actual, null);
    const fat = cal.bands.find((b) => b.lo === 0.9);
    assert.equal(fat.enough, true);
    assert.ok(Math.abs(fat.actual - 5 / 6) < 1e-9);
});

check("overconfidence is POSITIVE, and the sign cannot be backwards", () => {
    // Said 90%, right half the time.
    const over = calibration(band(0.9, 10, 5));
    assert.ok(over.ready);
    assert.ok(over.bias > 0.3, "claimed far more than delivered");
    // Said 60%, right nearly always.
    const under = calibration(band(0.6, 10, 10));
    assert.ok(under.bias < -0.3, "delivered far more than claimed");
});

check("a VOID is never graded — nothing was tested", () => {
    const rows = [...band(0.9, 8, 4), ...Array.from({ length: 20 },
        () => done(0.9, 100, 0, null, "void"))];
    const cal = calibration(rows);
    assert.equal(cal.graded, 8, "twenty voids must not dilute eight real calls");
});

check("CONVICTION, not P(yes) — backing no at 80% is the same claim", () => {
    // Half the calls are yes at 80%, half are no at 80% (p = 0.2). One skill,
    // one band: bucketing on P(yes) would split it across two ends of the axis
    // and report neither.
    const rows = [
        ...Array.from({ length: 5 }, (_, i) => done(0.8, 100, i < 4 ? 10 : -10, i < 4)),
        ...Array.from({ length: 5 }, (_, i) => done(0.2, 100, i < 4 ? 10 : -10, !(i < 4))),
    ];
    const cal = calibration(rows);
    const b = cal.bands.find((x) => x.lo === 0.8);
    assert.equal(b.n, 10);
    assert.ok(Math.abs(b.actual - 0.8) < 1e-9, "eight of ten called right, both directions");
});

console.log(`\n${passed} passed`);
