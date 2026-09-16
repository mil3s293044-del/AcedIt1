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
import fs from "node:fs";
import path from "node:path";
import {
    bookOf, equityCurve, calibration, outcomeOf, streakOf,
    CALIBRATION_MIN, CALIBRATION_MIN_TOTAL,
    exposureOf, sinceWeek, standingOf, RANK_MIN_CALLS, EXPOSURE_SLICES,
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

// ─── WHERE THE CRED IS ──────────────────────────────────────────────────────

const held = (kind, stake) => ({ stake, market: { kind, status: "open" } });

check("exposure is a share of the open stake, biggest first", () => {
    const e = exposureOf([held("streak", 300), held("sac", 100), held("streak", 200), held("cohort", 400)]);
    assert.equal(e.total, 1000);
    assert.deepEqual(e.slices.map((s) => s.kind), ["streak", "cohort", "sac"]);
    assert.equal(e.slices[0].stake, 500);
    assert.equal(e.slices[0].share, 0.5);
    assert.equal(e.top.kind, "streak");
    // The shares are a partition of the whole, or the bar lies about what is left.
    assert.equal(Math.round(e.slices.reduce((s, x) => s + x.share, 0) * 1000), 1000);
});

check("a tie in exposure breaks on the kind rather than on render order", () => {
    // Two equal slices swapping places between renders is the same bug the
    // subject shelf records about its colour wheel.
    const a = exposureOf([held("streak", 100), held("cohort", 100)]);
    const b = exposureOf([held("cohort", 100), held("streak", 100)]);
    assert.deepEqual(a.slices.map((s) => s.kind), b.slices.map((s) => s.kind));
});

check("nothing open is not a bar of nothing", () => {
    for (const bad of [[], null, [{ stake: 0, market: { kind: "streak" } }]]) {
        const e = exposureOf(bad);
        assert.equal(e.total, 0);
        assert.deepEqual(e.slices, []);
        assert.equal(e.top, null);
    }
});

// ─── THIS WEEK ──────────────────────────────────────────────────────────────

const settledAt = (iso, payout) => ({
    payout, settled_at: iso, stake: 100, p: 0.7, price_at_entry: 0.5,
    market: { status: "resolved", outcome: true },
});

check("the week is Monday-anchored and counts only what landed in it", () => {
    // Wednesday 16 Sep 2026; that week's Monday is the 14th.
    const now = new Date(2026, 8, 16, 10, 0, 0);
    const w = sinceWeek([
        settledAt(new Date(2026, 8, 15, 9).toISOString(), 40),
        settledAt(new Date(2026, 8, 16, 9).toISOString(), -12),
        settledAt(new Date(2026, 8, 13, 9).toISOString(), 500),   // Sunday: last week
    ], now);
    assert.equal(w.settled, 2);
    assert.equal(w.cred, 28, "the 500 belongs to last week");
    assert.equal(w.record.won, 1);
    assert.equal(w.record.lost, 1);
});

check("a quiet week is NULL, not a row of zeroes", () => {
    // "0 calls, +0 cred" printed every Monday morning is a strip that says
    // nothing three days out of seven.
    assert.equal(sinceWeek([], new Date(2026, 8, 16)), null);
    assert.equal(sinceWeek([settledAt(new Date(2026, 8, 1).toISOString(), 40)],
        new Date(2026, 8, 16)), null);
});

// ─── STANDING: A BAND, NEVER A POSITION ─────────────────────────────────────

check("it REFUSES to rank somebody on too few calls", () => {
    const thin = standingOf(120, [10, 20, 30, 40], { decided: 2 });
    assert.equal(thin.ready, false);
    assert.equal(thin.reason, "calls");
    assert.equal(thin.needs, RANK_MIN_CALLS - 2);
    assert.equal(thin.pct, undefined, "no band is printed at all");
});

check("and refuses when there is nobody to rank against", () => {
    const alone = standingOf(120, [50], { decided: 20 });
    assert.equal(alone.ready, false);
    assert.equal(alone.reason, "peers");
});

check("past both floors it is a percentile of the room", () => {
    const s = standingOf(75, [10, 20, 30, 90, 100, 200, 5, 60, 70, 80], { decided: 9 });
    assert.equal(s.ready, true);
    assert.equal(s.peers, 10);
    assert.equal(s.pct, 60, "six of ten peers sit below 75");
});

check("A TIE IS HALF, or a flat book is ahead of every other flat book", () => {
    const flat = standingOf(0, [0, 0, 0, 0], { decided: 9 });
    assert.equal(flat.pct, 50);
    // And the extremes still read as extremes.
    assert.equal(standingOf(999, [1, 2, 3, 4], { decided: 9 }).pct, 100);
    assert.equal(standingOf(-999, [1, 2, 3, 4], { decided: 9 }).pct, 0);
});

check("it names nobody, because that is the whole reason it is a band", () => {
    // The server sends figures with no addresses attached; a shape that could
    // carry one is a leaderboard waiting to be rendered on a private page.
    const s = standingOf(75, [10, 20, 30, 40, 50], { decided: 9 });
    assert.deepEqual(Object.keys(s).sort(), ["pct", "peers", "ready", "value"]);
    assert.equal(/email|name|user/i.test(JSON.stringify(s)), false);
});

check("junk peers are dropped rather than counted as zero", () => {
    const s = standingOf(50, [10, null, "x", undefined, 90, NaN], { decided: 9 });
    assert.equal(s.peers, 2, "only 10 and 90 are real figures");
});

// ─── BEST AND WORST ─────────────────────────────────────────────────────────

check("the book names both extremes, and a void is neither", () => {
    const rows = [
        settledAt(new Date(2026, 8, 10).toISOString(), 140),
        settledAt(new Date(2026, 8, 11).toISOString(), -90),
        { ...settledAt(new Date(2026, 8, 12).toISOString(), 0),
            market: { status: "void", outcome: null } },
    ];
    const b = bookOf(rows);
    assert.equal(Math.round(b.best.payout), 140);
    assert.equal(Math.round(b.worst.payout), -90);
});

check("a book with nothing settled names neither", () => {
    const b = bookOf([{ stake: 50, p: 0.7, price_at_entry: 0.5, market: { status: "open", price: 0.5 } }]);
    assert.equal(b.best, null);
    assert.equal(b.worst, null);
    assert.equal(b.week, null);
});

check("the SERVER's copy of the rank floor matches this one", () => {
    // holdings.js resolves `@/lib/...`, which only the client's bundler and the
    // test alias loader understand, so the server restates the number instead of
    // importing it. Two copies of one threshold is how the peer set the server
    // builds starts disagreeing with the sentence the client prints under it —
    // the same guard uploadPrep.test.mjs keeps over the upload caps.
    const server = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    const m = server.match(/const RANK_MIN_CALLS = (\d+);/);
    assert.ok(m, "server.mjs no longer declares RANK_MIN_CALLS");
    assert.equal(Number(m[1]), RANK_MIN_CALLS,
        "server.mjs and holdings.js disagree about the rank floor");
});

check("exposure FOLDS its tail, because the floor has four hues", () => {
    // Seven kinds mint on this board and an uncapped bar needs seven
    // distinguishable colours; past four it is reaching for greys that read as
    // the same slice twice, and a legend nobody can map back is not a legend.
    const many = ["streak", "hours", "versus", "cohort", "sac", "longshot", "prep"]
        .map((k, i) => held(k, 100 - i));
    const e = exposureOf(many);
    assert.equal(e.slices.length, EXPOSURE_SLICES + 1);
    assert.equal(e.slices.at(-1).kind, "other");
    assert.equal(e.slices.at(-1).folded, 3);
    // Folded or not, the shares still partition the whole.
    assert.equal(Math.round(e.slices.reduce((s, x) => s + x.share, 0) * 1000), 1000);
    assert.equal(e.slices.at(-1).stake, 94 + 95 + 96);
    // `top` still names the real biggest slice, never the fold.
    assert.equal(e.top.kind, "streak");
});

check("but it never folds a SINGLE slice, which would just rename it", () => {
    const five = ["streak", "hours", "versus", "cohort", "sac"].map((k, i) => held(k, 100 - i));
    const e = exposureOf(five);
    assert.equal(e.slices.length, 5);
    assert.equal(e.slices.some((s) => s.kind === "other"), false);
});

console.log(`\n${passed} passed`);
