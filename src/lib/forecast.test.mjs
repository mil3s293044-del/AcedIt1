/**
 * forecast assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/forecast.test.mjs
 *
 * The ones that matter most are the unfarmability tests. The system this
 * replaces paid 3× for confirming your own prediction on a form pre-filled
 * with it, so every assertion here about "agreeing with the house pays
 * nothing" and "the outcome comes from rows, not from a field" is guarding the
 * exact hole that was open.
 */
import assert from "node:assert/strict";
import {
    brier, skill, payoutFor, calibration, CALIBRATION_MIN, MIN_OBS,
    KINDS, baseRateFor, settleForecast, resolveOne, forecastBoard,
} from "@/lib/forecast";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const near = (a, b, tol, msg) =>
    assert.ok(Math.abs(a - b) <= tol, `${msg || ""} — got ${a}, wanted ${b} ±${tol}`);

const NOW = new Date(2026, 8, 20, 18, 0, 0);          // Sunday 20 Sep 2026
const day = (n) => {
    const d = new Date(2026, 8, 20 - n);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const ev = (dayStr, minutes) => ({ day: dayStr, minutes, subject: "Chemistry" });

// ─── the scoring rule ───────────────────────────────────────────────────────

check("a perfect call scores zero Brier, a perfectly wrong one scores 1", () => {
    assert.equal(brier(1, true), 0);
    assert.equal(brier(0, false), 0);
    assert.equal(brier(1, false), 1);
    assert.equal(brier(0.5, true), 0.25, "the shrug");
});

check("AGREEING WITH THE HOUSE PAYS EXACTLY NOTHING", () => {
    // The property that makes this unfarmable: repeating the base rate back at
    // the app is not a forecast and must never be worth XP, whatever happens.
    assert.equal(skill(0.7, 0.7, true), 0);
    assert.equal(skill(0.7, 0.7, false), 0);
    assert.equal(payoutFor(500, 0.7, 0.7, true), 0);
    assert.equal(payoutFor(500, 0.9, 0.9, false), 0);
});

check("beating the house pays, and being wrong costs", () => {
    // House says 60%, you say 90%, it happens: you knew something.
    assert.ok(payoutFor(100, 0.9, 0.6, true) > 0);
    // Same call, it does not happen: you were confidently wrong.
    assert.ok(payoutFor(100, 0.9, 0.6, false) < 0);
    // And the downside is the LARGER of the two, which is not a quirk: the
    // house already thought it probable, so agreeing harder wins little and
    // being wrong about a likely thing costs a lot. That asymmetry is what
    // makes the rule proper.
    assert.ok(Math.abs(payoutFor(100, 0.9, 0.6, false))
        > payoutFor(100, 0.9, 0.6, true));
});

check("STATING WHAT YOU ACTUALLY BELIEVE IS THE OPTIMAL PLAY", () => {
    // The defining property of a proper scoring rule, and the reason there is
    // no number to farm here: for any true probability, the forecast with the
    // highest EXPECTED score is that probability itself.
    //
    // Asserted on `skill` rather than on `payoutFor`, deliberately. The payout
    // rounds to whole XP, which flattens the curve into plateaus a few
    // hundredths wide around the optimum, and an argmax over a plateau lands
    // wherever it first tied. That is a property of integer XP, not of the
    // rule; the rule is what has to be proper.
    const expected = (p, base, t) =>
        t * skill(p, base, true) + (1 - t) * skill(p, base, false);

    for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
        for (const base of [0, 0.3, 0.5, 0.8, 1]) {
            let best = 0;
            let bestValue = -Infinity;
            for (let i = 0; i <= 1000; i += 1) {
                const v = expected(i / 1000, base, t);
                if (v > bestValue + 1e-12) { bestValue = v; best = i / 1000; }
            }
            near(best, t, 0.002, `true ${t} against a house at ${base}`);
        }
    }
});

check("and overstating your confidence is never worth it in XP either", () => {
    // The practical version, on the rounded payout a student actually sees:
    // whatever you really believe, shouting 100% has a worse expected return.
    const expectedXp = (p, base, t) =>
        t * payoutFor(1000, p, base, true) + (1 - t) * payoutFor(1000, p, base, false);

    for (const t of [0.2, 0.5, 0.7, 0.9]) {
        for (const base of [0.3, 0.5, 0.8]) {
            assert.ok(expectedXp(t, base, t) >= expectedXp(1, base, t),
                `true ${t} vs house ${base}: claiming certainty should not pay better`);
            assert.ok(expectedXp(t, base, t) >= expectedXp(0, base, t),
                `true ${t} vs house ${base}: claiming impossibility should not pay better`);
        }
    }
});

check("a forecast can never cost more than its stake", () => {
    // And it is bounded by the SCALE, not by a clamp — a clamp here made the
    // rule improper in the tails, which the properness test above catches.
    assert.equal(payoutFor(200, 1, 0, false), -200);
    assert.equal(payoutFor(200, 0, 1, true), -200);
    // A game that can take more than you put into it is a different and much
    // worse thing to put in front of a sixteen-year-old.
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        for (const b of [0, 0.5, 1]) {
            for (const o of [true, false]) {
                assert.ok(payoutFor(300, p, b, o) >= -300, `${p}/${b}/${o}`);
            }
        }
    }
});

check("a zero stake pays nothing either way", () => {
    assert.equal(payoutFor(0, 1, 0, true), 0);
    assert.equal(payoutFor(null, 1, 0, true), 0);
});

// ─── calibration ────────────────────────────────────────────────────────────

const call = (p, base, outcome) => ({ p, base, outcome });

check("calibration reports skill against the house, not a bare Brier", () => {
    // A raw Brier of 0.2 is excellent on coin-flips and poor on near-certainties,
    // so the headline has to be the comparison.
    const good = calibration([
        call(0.9, 0.5, true), call(0.9, 0.5, true), call(0.1, 0.5, false),
        call(0.8, 0.5, true), call(0.2, 0.5, false),
    ]);
    assert.ok(good.skillScore > 0, "beating the house should read positive");
    assert.equal(good.n, 5);
    assert.equal(good.enough, true);

    const bad = calibration([
        call(0.1, 0.5, true), call(0.1, 0.5, true), call(0.9, 0.5, false),
        call(0.2, 0.5, true), call(0.8, 0.5, false),
    ]);
    assert.ok(bad.skillScore < 0);
});

check("under five resolved calls it says so rather than scoring you", () => {
    const c = calibration([call(0.9, 0.5, true)]);
    assert.equal(c.n, 1);
    assert.equal(c.enough, false);
    assert.ok(CALIBRATION_MIN > 1);
});

check("an empty record claims nothing", () => {
    const c = calibration([]);
    assert.equal(c.n, 0);
    assert.equal(c.brier, null, "not zero — a zero Brier is a PERFECT record");
    assert.equal(c.skillScore, null);
    assert.deepEqual(c.buckets, []);
});

check("a band with no calls in it is null, never a 0% hit rate", () => {
    // Drawn as zero, the reliability curve dives to the floor wherever the
    // student simply has not been yet.
    const c = calibration([call(0.9, 0.5, true), call(0.9, 0.5, true)]);
    const low = c.buckets.find((b) => b.lo === 0);
    assert.equal(low.n, 0);
    assert.equal(low.happened, null);
    assert.equal(low.said, null);
    const high = c.buckets.find((b) => b.lo === 0.8);
    assert.equal(high.n, 2);
    assert.equal(high.happened, 1);
});

check("garbage rows are dropped rather than scored", () => {
    const c = calibration([call(0.9, 0.5, true), { p: "x" }, null, { p: 0.5 }]);
    assert.equal(c.n, 1);
});

// ─── base rates ─────────────────────────────────────────────────────────────

check("a base rate off too little history is a PRIOR and says so", () => {
    const events = [ev(day(1), 30), ev(day(2), 30)];
    const b = baseRateFor({ kind: "streak" }, { events });
    assert.equal(b.source, "prior", "two days is not a measurement");
    assert.ok(b.n < MIN_OBS);
});

check("with real history the rate is measured from the student's own days", () => {
    // Seven consecutive days: every day was followed by another.
    const events = [0, 1, 2, 3, 4, 5, 6].map((n) => ev(day(n), 30));
    const b = baseRateFor({ kind: "streak" }, { events });
    assert.equal(b.source, "you");
    assert.equal(b.p, 1);
    assert.ok(b.n >= MIN_OBS);
});

check("gaps in the history pull the rate down, as they should", () => {
    // Studied on days 0,1,2,3 then a gap then 8,9 — five of six followed.
    const events = [0, 1, 2, 3, 8, 9].map((n) => ev(day(n), 30));
    const b = baseRateFor({ kind: "streak" }, { events });
    assert.equal(b.source, "you");
    assert.ok(b.p < 1 && b.p > 0.5);
});

check("the minutes rate counts the weeks that actually cleared the bar", () => {
    const events = [
        ev(day(7), 200), ev(day(14), 200), ev(day(21), 50), ev(day(28), 300),
    ];
    const b = baseRateFor({ kind: "minutes", threshold: 150 }, { events });
    assert.equal(b.source, "you");
    assert.equal(b.n, 4);
    assert.equal(b.p, 0.75, "three of four weeks cleared 150");
});

check("the quiz rate is over past SITS, and a retry is not one", () => {
    const attempts = [
        { quiz_id: "q1", score: 80, created_date: "2026-09-01T09:00:00Z" },
        { quiz_id: "q1", score: 60, created_date: "2026-09-05T09:00:00Z" },
        { quiz_id: "q1", score: 90, created_date: "2026-09-08T09:00:00Z" },
        { quiz_id: "q1", score: 70, created_date: "2026-09-09T09:00:00Z" },
        // A wrong-only retry is on a different scale by construction.
        { quiz_id: "q1", score: 0, created_date: "2026-09-10T09:00:00Z",
          extra: { is_retry: true } },
        { quiz_id: "q2", score: 10, created_date: "2026-09-10T09:00:00Z" },
    ];
    const b = baseRateFor({ kind: "quiz", quiz_id: "q1", threshold: 65 },
        { events: [], attempts });
    assert.equal(b.n, 4, "the retry and the other quiz are not sits of this one");
    assert.equal(b.p, 0.75);
});

// ─── settlement, which is the whole point ───────────────────────────────────

const streakF = {
    kind: "streak", p: 0.8, stake: 100,
    created_at: day(4), deadline: day(1),
};

check("a streak call settles from the DAYS STUDIED, not from a form", () => {
    const kept = [4, 3, 2, 1].map((n) => ev(day(n), 30));
    assert.equal(settleForecast(streakF, { events: kept, now: NOW }), true);

    const missed = [4, 3, 1].map((n) => ev(day(n), 30));       // day 2 skipped
    assert.equal(settleForecast(streakF, { events: missed, now: NOW }), false);
});

check("a forecast before its deadline is OPEN, not lost", () => {
    const future = { ...streakF, deadline: day(-3) };
    assert.equal(settleForecast(future, { events: [ev(day(0), 30)], now: NOW }), null);
});

check("the minutes call sums BOTH study tables", () => {
    // The trap the ATAR's planning component and the dashboard's week panel
    // each fell into separately: study is written to two tables.
    const f = { kind: "minutes", threshold: 150, p: 0.7, stake: 100,
        created_at: day(6), deadline: day(1) };
    const ctx = {
        sessions: [{ id: "s", subject: "X", duration_minutes: 60, date: day(3) }],
        techniques: [{ id: "t", subject: "X", session_duration: 100, date: day(2) }],
        now: NOW,
    };
    assert.equal(settleForecast(f, ctx), true, "60 + 100 clears 150");
    assert.equal(settleForecast(f, { sessions: ctx.sessions, techniques: [], now: NOW }), false,
        "reading one table alone would settle this the wrong way");
});

check("a quiz call settles on the FIRST sit after it, never the best", () => {
    // Waiting for a good sit and calling that the result is the old exploit in
    // a different costume.
    const f = { kind: "quiz", quiz_id: "q1", threshold: 70, p: 0.8, stake: 100,
        created_at: "2026-09-10T00:00:00Z", deadline: "2026-09-30T00:00:00Z" };
    const attempts = [
        { quiz_id: "q1", score: 55, created_date: "2026-09-12T09:00:00Z" },
        { quiz_id: "q1", score: 95, created_date: "2026-09-14T09:00:00Z" },
    ];
    assert.equal(settleForecast(f, { events: [], attempts, now: NOW }), false,
        "the first sit was 55 and that is the one that counts");
});

check("a quiz never sat is open until the deadline, then it did not happen", () => {
    const f = { kind: "quiz", quiz_id: "q1", threshold: 70, p: 0.8, stake: 100,
        created_at: "2026-09-10T00:00:00Z", deadline: "2026-09-30T00:00:00Z" };
    assert.equal(settleForecast(f, { events: [], attempts: [], now: NOW }), null);
    assert.equal(
        settleForecast(f, { events: [], attempts: [], now: new Date(2026, 9, 5) }), false,
        "otherwise a forecast could be left open forever and never be wrong");
});

// ─── the honour-system kind pays nothing, ever ──────────────────────────────

check("A SELF-REPORTED SAC CALL CAN NEVER PAY XP", () => {
    // This is the whole hole that was open: a number the student types must
    // not move the XP economy, however it resolves.
    assert.equal(KINDS.sac.pays, false);
    const f = { kind: "sac", threshold: 70, reported: 95, p: 0.9, stake: 500,
        created_at: day(5), deadline: day(1), subject: "Chemistry" };
    const r = resolveOne(f, { events: [], attempts: [], now: NOW });
    assert.equal(r.outcome, true, "it still resolves — bragging rights are the point");
    assert.equal(r.xp, 0, "and it pays nothing");
});

check("every paying kind settles from app data, and only those pay", () => {
    Object.values(KINDS).forEach((k) => {
        if (k.key === "sac") assert.equal(k.pays, false);
        else assert.equal(k.pays, true, `${k.key} should pay`);
    });
});

// ─── the board ──────────────────────────────────────────────────────────────

check("the board splits open from settled and totals only what resolved", () => {
    const events = [4, 3, 2, 1].map((n) => ev(day(n), 30));
    const board = forecastBoard([
        { ...streakF, created_at: day(4), deadline: day(1) },       // settles true
        { ...streakF, created_at: day(1), deadline: day(-5) },      // still open
    ], { events, attempts: [], now: NOW });

    assert.equal(board.open.length, 1);
    assert.equal(board.settled.length, 1);
    assert.equal(board.open[0].xp, 0, "an open forecast has paid nothing yet");
    assert.equal(board.calibration.n, 1);
});

// ─── backing a call-out ─────────────────────────────────────────────────────

check("a call-out settles on the row's own status, never on a claim", () => {
    const f = { kind: "callout", p: 0.7, stake: 50, created_at: day(3), deadline: day(-1) };
    assert.equal(settleForecast(f, { calloutStatus: "passed", now: NOW }), true);
    assert.equal(settleForecast(f, { calloutStatus: "failed", now: NOW }), false);
    assert.equal(settleForecast(f, { calloutStatus: "expired", now: NOW }), false,
        "ignoring a call-out is a forfeit, and the people who backed a pass were wrong");
});

check("a VOIDED call-out settles nothing — there was no test", () => {
    const f = { kind: "callout", p: 0.7, stake: 50, created_at: day(3), deadline: day(-1) };
    assert.equal(settleForecast(f, { calloutStatus: "voided", now: NOW }), null);
});

check("a call-out still being sat is open, and one past its clock is a fail", () => {
    const open = { kind: "callout", p: 0.7, stake: 50, created_at: day(3), deadline: day(-5) };
    assert.equal(settleForecast(open, { calloutStatus: "active", now: NOW }), null);
    const done = { kind: "callout", p: 0.7, stake: 50, created_at: day(3), deadline: day(1) };
    assert.equal(settleForecast(done, { calloutStatus: "pending", now: NOW }), false);
});

check("the base rate is THE TARGET'S record, not the spectator's", () => {
    const hist = [
        { status: "passed" }, { status: "passed" }, { status: "failed" },
        { status: "passed" }, { status: "pending" },
    ];
    const b = baseRateFor({ kind: "callout" }, { targetHistory: hist });
    assert.equal(b.n, 4, "the one still pending is not evidence of anything");
    assert.ok(Math.abs(b.p - 0.75) < 1e-9);
});

check("with no history the call-out base rate is a labelled PRIOR", () => {
    const b = baseRateFor({ kind: "callout" }, { targetHistory: [] });
    assert.equal(b.source, "prior");
    assert.equal(b.n, 0);
    assert.ok(b.p > 0.5, "somebody who did the study can answer for it; a coin-flip says half are bluffing");
});

check("backing a call-out pays on skill, so restating the base rate pays zero", () => {
    // The property that makes every kind unfarmable applies here too.
    const b = baseRateFor({ kind: "callout" }, { targetHistory: [] }).p;
    for (const outcome of [true, false]) {
        assert.equal(payoutFor(100, b, b, outcome), 0);
    }
});

check("an unknown kind is dropped rather than guessed at", () => {
    assert.equal(resolveOne({ kind: "roulette", p: 1, stake: 999 }, {}), null);
    assert.equal(forecastBoard([{ kind: "roulette" }], {}).open.length, 0);
});

console.log(`\n${passed} passed`);
