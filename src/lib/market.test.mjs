/**
 * market assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/market.test.mjs
 *
 * Two properties this file exists to hold, and everything else is detail:
 *
 *   THE RULE IS PROPER. Stating what you actually believe maximises your
 *   expected return at every price. The moment that stops being true the
 *   optimal play becomes "always say 100%", which is the cannot-lose shape the
 *   old wagering layer died of.
 *
 *   YOU CANNOT HOLD A PAYING POSITION ON A MARKET YOU RESOLVE. One rule, three
 *   kinds, checked from both directions.
 */
import assert from "node:assert/strict";
import {
    brier, skill, payoutFor, PAYOUT_K, clampP,
    priceOf, priceLabel, priceTone, PRIOR_WEIGHT,
    probFor, sideOf, convictionOf, YES, NO, CONVICTION_MAX,
    clampStake, STAKE_MIN, STAKE_MAX, CRED_WEEKLY_GRANT, CRED_BALANCE_CAP,
    KINDS, blockReason, canTakePosition,
    readMarket, markToMarket, heatOf, sortBoard, isOpen,
    edgePoints, settlementOf, unseenSettlements, markSettlementsSeen,
} from "@/lib/market";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── the scoring rule ───────────────────────────────────────────────────────

check("agreeing with the price pays EXACTLY nothing", () => {
    // The property the whole design rests on. If repeating the price paid
    // anything at all, the optimal strategy would be to repeat it forever on
    // every market on the board — which is farming, with extra steps.
    for (const price of [0.1, 0.35, 0.5, 0.72, 0.9]) {
        assert.equal(payoutFor(100, price, price, true), 0, `yes @ ${price}`);
        assert.equal(payoutFor(100, price, price, false), 0, `no @ ${price}`);
    }
});

check("THE RULE IS PROPER — believing is optimal at every price", () => {
    // For a true probability t, sweep every statable p and assert the expected
    // return peaks at p = t. This is the sweep that caught K=2-with-a-clamp
    // being improper in the tails, and it is the reason there is no clamp.
    const ev = (p, price, t) =>
        t * payoutFor(1000, p, price, true) + (1 - t) * payoutFor(1000, p, price, false);

    for (const price of [0.2, 0.5, 0.8]) {
        for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) {
            let bestP = null, best = -Infinity;
            for (let p = 0; p <= 1.0001; p += 0.01) {
                const v = ev(p, price, t);
                if (v > best + 1e-9) { best = v; bestP = p; }
            }
            assert.ok(Math.abs(bestP - t) < 0.02,
                `at price ${price} with true ${t}, best was ${bestP.toFixed(2)} — rule is not proper`);
        }
    }
});

check("the payout is bounded by the stake, both ways", () => {
    // What makes escrow sufficient: settlement credits stake + payout, which
    // has to land in [0, 2*stake] so the award path stays add-only.
    for (const price of [0, 0.3, 0.5, 0.7, 1]) {
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
            for (const outcome of [true, false]) {
                const x = payoutFor(200, p, price, outcome);
                assert.ok(x >= -200 && x <= 200, `payout ${x} escaped ±stake`);
                assert.ok(200 + x >= 0, "a settlement can never credit a negative");
            }
        }
    }
});

check("K is 1 and there is no clamp", () => {
    // Both halves were learned the hard way in forecast.js: with the loss
    // floored, extra confidence past the floor is free and the rule goes
    // improper in the tails. skill is already in [-1, 1], so K=1 bounds it.
    assert.equal(PAYOUT_K, 1);
    const maximallyWrong = payoutFor(100, 1, 0.5, false);
    assert.equal(maximallyWrong, -75, "a maximally wrong call must lose its full share");
    assert.ok(maximallyWrong > -100.0001, "and no more than the stake");
});

check("being righter than the market pays, being wronger costs", () => {
    assert.ok(payoutFor(100, 0.9, 0.5, true) > 0, "you said 90 and it happened");
    assert.ok(payoutFor(100, 0.9, 0.5, false) < 0, "you said 90 and it did not");
    assert.ok(payoutFor(100, 0.9, 0.95, true) < 0, "the market was righter than you");
});

check("brier and skill behave", () => {
    assert.equal(brier(1, true), 0);
    assert.equal(brier(0, true), 1);
    assert.equal(brier(0.5, true), 0.25);
    assert.equal(skill(0.5, 0.5, true), 0);
    assert.ok(skill(0.8, 0.5, true) > 0);
});

// ─── the price ──────────────────────────────────────────────────────────────

check("THE FIRST POSITION IS NOT THE PRICE", () => {
    // Without the prior pseudo-stake, one student putting 10 on 95% would move
    // the market to 95¢ and the next person to look would read one teenager's
    // guess as a consensus — then be scored against it.
    const m = { prior: 0.5 };
    const after = priceOf(m, [{ p: 0.95, stake: 10 }]);
    assert.ok(after > 0.5, "it must move");
    assert.ok(after < 0.55, `one small stake moved the price to ${after} — the prior is too weak`);
});

check("real conviction does move it", () => {
    const m = { prior: 0.5 };
    const heavy = priceOf(m, Array.from({ length: 8 }, () => ({ p: 0.9, stake: 200 })));
    assert.ok(heavy > 0.8, `eight heavy positions only reached ${heavy}`);
});

check("no positions is the prior, exactly", () => {
    assert.equal(priceOf({ prior: 0.3 }, []), 0.3);
    assert.equal(priceOf({ prior: 0.3 }, [{ p: 0.9, stake: 0 }]), 0.3, "a zero stake is not an opinion");
});

check("a missing prior is a coin flip, never a crash", () => {
    assert.equal(priceOf({}, []), 0.5);
    assert.equal(priceOf(null, []), 0.5);
    assert.equal(PRIOR_WEIGHT > 0, true);
});

check("the price label and the tone cannot disagree", () => {
    // The bug ScalingMark exists to prevent: a glyph pointing one way while
    // the colour says the other. Both come off the same comparison.
    assert.equal(priceLabel(0.71), "71¢");
    assert.equal(priceLabel(0), "0¢");
    assert.equal(priceTone(0.7, 0.5), "up");
    assert.equal(priceTone(0.3, 0.5), "down");
    assert.equal(priceTone(0.505, 0.5), "flat", "noise is not a move");
});

// ─── sides ──────────────────────────────────────────────────────────────────

check("a side and a conviction round-trip to a probability", () => {
    assert.equal(probFor(YES, 0.8), 0.8);
    assert.ok(Math.abs(probFor(NO, 0.8) - 0.2) < 1e-9);
    assert.equal(sideOf(0.8), YES);
    assert.equal(sideOf(0.2), NO);
    assert.ok(Math.abs(convictionOf(0.2) - 0.8) < 1e-9);
});

check("CERTAINTY CANNOT BE STATED", () => {
    // A p of exactly 1 is a free loss with no upside and nothing for the rule
    // to score. The slider stops short of it on purpose.
    assert.ok(CONVICTION_MAX < 1);
    assert.equal(probFor(YES, 1), CONVICTION_MAX);
    assert.equal(probFor(YES, 99), CONVICTION_MAX);
    assert.equal(probFor(YES, 0), 0.5, "and it cannot go below a coin flip either");
});

// ─── stakes ─────────────────────────────────────────────────────────────────

check("stakes are bounded and the weekly stack is capped", () => {
    assert.equal(clampStake(5), STAKE_MIN);
    assert.equal(clampStake(99999), STAKE_MAX);
    assert.equal(clampStake("120"), 120);
    assert.equal(clampStake(null), STAKE_MIN);
    assert.ok(CRED_BALANCE_CAP > CRED_WEEKLY_GRANT,
        "the cap has to leave room to carry something, or a good week is punished");
});

// ─── the one rule ───────────────────────────────────────────────────────────

check("YOU CANNOT BACK A SAC MARK YOU REPORT YOURSELF", () => {
    // The exploit the entire wagering layer was deleted for: set a line, type
    // the result, collect. Stated once here as a rule about WHO resolves.
    const m = { kind: "sac", status: "open", subject_email: "me@x.com" };
    assert.ok(blockReason(m, "me@x.com"), "the subject must be blocked");
    assert.equal(canTakePosition(m, "me@x.com"), false);
    assert.equal(canTakePosition(m, "someone@x.com"), true,
        "and everybody else must be able to — that is the whole point");
});

check("nor a call-out you are in, either side of it", () => {
    const m = {
        kind: "callout", status: "open",
        caller_email: "priya@x.com", subject_email: "tom@x.com",
    };
    assert.equal(canTakePosition(m, "priya@x.com"), false, "the caller picked the target");
    assert.equal(canTakePosition(m, "tom@x.com"), false, "the target decides how hard to try");
    assert.equal(canTakePosition(m, "jess@x.com"), true);
});

check("nor a contest you are competing in", () => {
    const m = {
        kind: "battle", status: "open",
        competitor_emails: ["a@x.com", "b@x.com"],
    };
    assert.equal(canTakePosition(m, "a@x.com"), false);
    assert.equal(canTakePosition(m, "c@x.com"), true);
});

check("BUT A MARKET ON YOUR OWN STUDY LOG IS ALLOWED", () => {
    // Deliberately different: the app measures this itself under the service
    // role with the integrity caps on top. Betting you will study five days
    // and then studying five days is the product working, not an exploit.
    const m = { kind: "streak", status: "open", subject_email: "me@x.com" };
    assert.equal(canTakePosition(m, "me@x.com"), true);
    assert.equal(canTakePosition({ ...m, kind: "hours" }, "me@x.com"), true);
    assert.equal(canTakePosition({ ...m, kind: "quiz" }, "me@x.com"), true);
});

check("only sac is flagged self-resolving, and the flag is what drives it", () => {
    assert.equal(KINDS.sac.selfResolving, true);
    ["streak", "hours", "quiz", "callout", "battle"].forEach((k) => {
        assert.notEqual(KINDS[k].selfResolving, true, `${k} must not be self-resolving`);
    });
    assert.ok(Object.values(KINDS).every((k) => k.resolves),
        "every kind states where its answer comes from, or the question is not judgeable");
});

check("a decided market takes no more positions, and neither does a stranger", () => {
    const m = { kind: "streak", status: "resolved", subject_email: "x@x.com" };
    assert.ok(blockReason(m, "y@x.com"));
    assert.ok(blockReason({ kind: "streak", status: "open" }, null), "signed out is blocked");
});

// ─── reading one ────────────────────────────────────────────────────────────

check("readMarket derives the whole card and finds your own side", () => {
    const m = { id: "m1", kind: "streak", status: "open", prior: 0.5, subject_email: "p@x.com" };
    const positions = [
        { user_email: "a@x.com", p: 0.8, stake: 100 },
        { user_email: "b@x.com", p: 0.2, stake: 50 },
        { user_email: "ME@x.com", p: 0.9, stake: 200 },
    ];
    const r = readMarket(m, positions, "me@x.com");
    assert.equal(r.traders, 3);
    assert.equal(r.volume, 350);
    assert.equal(r.yesCount, 2);
    assert.equal(r.noCount, 1);
    assert.ok(r.mine, "an email differing only in case is still you");
    assert.equal(r.mine.stake, 200);
    assert.match(r.priceLabel, /^\d+¢$/);
    assert.equal(r.blocked, null);
});

check("no positions reads as a real empty market, not a crash", () => {
    const r = readMarket({ kind: "hours", status: "open", prior: 0.4 }, [], "a@x.com");
    assert.equal(r.traders, 0);
    assert.equal(r.volume, 0);
    assert.equal(r.mine, null);
    assert.equal(r.price, 0.4);
});

check("mark-to-market says what it is worth both ways", () => {
    const pos = { stake: 100, p: 0.9, price_at_entry: 0.5 };
    const mtm = markToMarket(pos, 0.7);
    assert.ok(mtm.ifYes > 0, "right about it happening");
    assert.ok(mtm.ifNo < 0, "wrong about it happening");
    assert.equal(markToMarket(null, 0.5), null);
});

// ─── the board ──────────────────────────────────────────────────────────────

check("A MARKET ABOUT YOU ALWAYS SORTS FIRST", () => {
    // Twelve people taking a position on whether you fold this week is the most
    // motivating thing on the page. Burying it under a livelier question about
    // somebody else throws that away.
    const mine = { id: "mine", subject_email: "me@x.com", volume: 0, traders: 0 };
    const hot = { id: "hot", subject_email: "other@x.com", volume: 5000, traders: 20 };
    assert.equal(sortBoard([hot, mine], "me@x.com")[0].id, "mine");
});

check("otherwise it is heat, and a closing clock is heat", () => {
    const now = Date.now();
    const quiet = { id: "quiet", volume: 100, traders: 2 };
    const closing = { id: "closing", volume: 100, traders: 2, closes_at: new Date(now + 6e5).toISOString() };
    assert.ok(heatOf(closing, now) > heatOf(quiet, now));
    assert.equal(sortBoard([quiet, closing], "n@x.com")[0].id, "closing");
});

check("heat survives missing and malformed clocks", () => {
    // `new Date(undefined)` is Invalid Date and every comparison against it is
    // false — which would silently make one market's heat NaN and scramble the
    // whole sort rather than failing loudly.
    assert.ok(Number.isFinite(heatOf({ volume: 10, traders: 1 })));
    assert.ok(Number.isFinite(heatOf({ closes_at: "not a date", volume: 10, traders: 1 })));
    assert.ok(Number.isFinite(heatOf({})));
});

check("a market past its close is not open, whatever its status says", () => {
    const now = Date.now();
    assert.equal(isOpen({ status: "open", closes_at: new Date(now + 1e5).toISOString() }, now), true);
    assert.equal(isOpen({ status: "open", closes_at: new Date(now - 1e5).toISOString() }, now), false);
    assert.equal(isOpen({ status: "resolved" }, now), false);
    assert.equal(isOpen({ status: "open" }, now), true, "no clock is fine");
    assert.equal(isOpen(null, now), false);
});

// ─── settlement ─────────────────────────────────────────────────────────────

const settled = (over, mine) => ({
    id: "m1", title: "Will Priya study 5+ days this week?",
    status: "resolved", outcome: over, prior: 0.5,
    positions: [{ ...mine, user_email: "me@x.com", settled_at: "2026-09-08T00:00:00Z" }],
});

check("THE EDGE AND THE PAYOUT CAN NEVER DISAGREE IN SIGN", () => {
    // The reveal prints "you read that 23 points better than the room" beside
    // a cred figure. The edge is an ABSOLUTE error difference so a student can
    // check it by subtracting two numbers they can both see; the payout is
    // squared. |a| < |b| exactly when a² < b², so the signs always agree — and
    // if they ever did not, the screen would praise a call that lost cred.
    for (const price of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        for (let p = 0; p <= 1.0001; p += 0.05) {
            for (const o of [true, false]) {
                const e = edgePoints(p, price, o);
                const x = payoutFor(100, p, price, o);
                if (e > 0) assert.ok(x >= 0, `edge +${e} but payout ${x}`);
                if (e < 0) assert.ok(x <= 0, `edge ${e} but payout ${x}`);
            }
        }
    }
});

check("the edge is what a student can check by subtracting", () => {
    // Said 85, room said 62, it happened: you were 15 off, they were 38 off.
    assert.equal(edgePoints(0.85, 0.62, true), 23);
    assert.equal(edgePoints(0.62, 0.62, true), 0, "agreeing with the room is a zero edge");
});

check("a win reads as a win, with both numbers on it", () => {
    const s = settlementOf(settled(true, { p: 0.85, stake: 100, price_at_entry: 0.62, payout: 41 }), "me@x.com");
    assert.equal(s.kind, "won");
    assert.equal(s.said, 85);
    assert.equal(s.room, 62);
    assert.equal(s.edge, 23);
    assert.equal(s.payout, 41);
    assert.equal(s.returned, 141, "stake plus payout comes back");
});

check("a loss never returns a negative", () => {
    const s = settlementOf(settled(false, { p: 0.85, stake: 100, price_at_entry: 0.62, payout: -41 }), "me@x.com");
    assert.equal(s.kind, "lost");
    assert.ok(s.edge < 0);
    assert.equal(s.returned, 59, "the stake was escrowed, so what comes back is stake + payout");
    const wipeout = settlementOf(settled(false, { p: 0.97, stake: 100, price_at_entry: 0.5, payout: -100 }), "me@x.com");
    assert.equal(wipeout.returned, 0, "a maximally wrong call returns nothing, never less");
});

check("AGREEING WITH THE ROOM IS ITS OWN CASE, NOT A LOSS", () => {
    // The rule pays exactly zero for restating the price, by design. Drawing
    // that as a defeat would teach the wrong lesson about the one property the
    // whole system rests on.
    const s = settlementOf(settled(true, { p: 0.62, stake: 100, price_at_entry: 0.62, payout: 0 }), "me@x.com");
    assert.equal(s.kind, "level");
    assert.equal(s.returned, 100, "the stake comes back whole");
});

check("a void is its own case too, and returns the stake", () => {
    const m = settled(true, { p: 0.9, stake: 80, price_at_entry: 0.5, payout: 0 });
    m.status = "void"; m.outcome = null;
    const s = settlementOf(m, "me@x.com");
    assert.equal(s.kind, "void");
    assert.equal(s.outcome, null, "nothing was tested, so there is no verdict to print");
    assert.equal(s.returned, 80);
});

check("nothing to reveal without a settled position of your own", () => {
    assert.equal(settlementOf({ status: "open", positions: [] }, "me@x.com"), null);
    assert.equal(settlementOf(settled(true, { p: 0.8, stake: 10, price_at_entry: 0.5, payout: 3 }), "other@x.com"), null,
        "watching somebody else's resolve is a feed row, not a takeover");
    const unsettled = settled(true, { p: 0.8, stake: 10, price_at_entry: 0.5, payout: 3 });
    unsettled.positions[0].settled_at = null;
    assert.equal(settlementOf(unsettled, "me@x.com"), null);
});

/** A working localStorage, since node has none and "no storage" means "seen". */
function withStorage(fn) {
    const store = new Map();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
    };
    try { return fn(); }
    finally { if (real === undefined) delete globalThis.localStorage; else globalThis.localStorage = real; }
}

check("NO STORAGE AT ALL IS ALSO 'ALREADY SEEN'", () => {
    // node has no localStorage, and neither does a server render. The read
    // throws, which is caught, and nothing is revealed — the safe direction.
    assert.deepEqual(unseenSettlements([{
        id: "x", title: "t", status: "resolved", outcome: true, prior: 0.5,
        positions: [{ is_me: true, p: 0.8, stake: 10, price_at_entry: 0.5, payout: 3,
            settled_at: "2026-09-08T00:00:00Z" }],
    }], "me@x.com"), []);
});

check("a batch plays QUIETEST FIRST", () => withStorage(() => {
    // A run that opens on its biggest number and trails off is an anticlimax —
    // the ordering AchievementUnlock arrived at, for the same reason.
    const mk = (id, payout) => ({
        id, title: id, status: "resolved", outcome: true, prior: 0.5,
        positions: [{ is_me: true, p: 0.8, stake: 100, price_at_entry: 0.5,
            payout, settled_at: "2026-09-08T00:00:00Z" }],
    });
    const order = unseenSettlements([mk("big", 60), mk("nil", 0), mk("mid", -20)], "me@x.com")
        .map((r) => r.id);
    assert.deepEqual(order, ["nil", "mid", "big"]);
}));

check("BLOCKED STORAGE COUNTS AS ALREADY-SEEN", () => {
    // Replaying somebody's loss at them on every page load is far worse than
    // never showing it. Asserted against a localStorage that throws.
    const real = globalThis.localStorage;
    globalThis.localStorage = { getItem() { throw new Error("blocked"); },
        setItem() { throw new Error("blocked"); } };
    try {
        const m = { id: "x", title: "t", status: "resolved", outcome: true, prior: 0.5,
            positions: [{ is_me: true, p: 0.8, stake: 10, price_at_entry: 0.5, payout: 3,
                settled_at: "2026-09-08T00:00:00Z" }] };
        assert.deepEqual(unseenSettlements([m], "me@x.com"), []);
        markSettlementsSeen(["x"]);   // must not throw
    } finally {
        if (real === undefined) delete globalThis.localStorage; else globalThis.localStorage = real;
    }
});

check("and it fires ONCE — a seen result never comes back", () => withStorage(() => {
    {
        const m = { id: "one", title: "t", status: "resolved", outcome: true, prior: 0.5,
            positions: [{ is_me: true, p: 0.8, stake: 10, price_at_entry: 0.5, payout: 3,
                settled_at: "2026-09-08T00:00:00Z" }] };
        assert.equal(unseenSettlements([m], "me@x.com").length, 1);
        markSettlementsSeen(["one"]);
        assert.deepEqual(unseenSettlements([m], "me@x.com"), [],
            "the server self-heals and re-reports resolved markets forever");
    }
}));

console.log(`\n${passed} passed`);
