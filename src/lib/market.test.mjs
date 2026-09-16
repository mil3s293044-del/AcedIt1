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
    returnMultiple, RETURN_CEILING, bestReturn, returns, multiplierLabel,
    priceHistory, featuredOf,
    ROOMS, inRoom, roomsFor, pickBoard, BOARD_TARGET,
    convictionRange, startingConviction, CONVICTION_MIN,
    markPercent, priorForLine, MARK_MIN_OBS, selfLine, selfRecord,
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

// ─── The multiplier IS the money ────────────────────────────────────────────

check("THE MULTIPLE IS EXACTLY WHAT COMES BACK, at every stake", () => {
    // The bug this replaces: the card printed 1/price, which is a number about
    // the odds and not about the student's cred. If these two ever drift apart
    // the headline on every card is a lie again.
    for (const stake of [10, 37, 100, 500]) {
        for (const price of [0.05, 0.3, 0.5, 0.62, 0.9]) {
            for (const p of [0.03, 0.25, 0.5, 0.75, 0.97]) {
                for (const outcome of [true, false]) {
                    const back = stake + payoutFor(stake, p, price, outcome);
                    const mult = returnMultiple(p, price, outcome);
                    // Cred is whole, so the payout rounds: the multiple can
                    // only ever agree to within half a cred of the stake. On a
                    // 10 stake that is 5%, which is why the smallest stakes
                    // cannot express the difference between 1.00× and 1.04×.
                    const slack = 0.5 / stake + 1e-9;
                    assert.ok(Math.abs(back / stake - mult) <= slack,
                        `stake ${stake} at p=${p} into ${price}: card says ${mult.toFixed(3)}× `
                        + `but ${back} of ${stake} comes back`);
                }
            }
        }
    }
});

check("THE 2× CEILING IS STRUCTURAL and nothing can print past it", () => {
    assert.equal(RETURN_CEILING, 2);
    let top = 0;
    for (let q = 0; q <= 1.0001; q += 0.02) {
        for (let p = 0; p <= 1.0001; p += 0.02) {
            for (const outcome of [true, false]) {
                const m = returnMultiple(p, q, outcome);
                assert.ok(m >= 0, "a stake is escrowed, so nobody can owe");
                assert.ok(m <= RETURN_CEILING + 1e-9, `${m} exceeds the ceiling`);
                top = Math.max(top, m);
            }
        }
    }
    assert.ok(Math.abs(top - RETURN_CEILING) < 1e-6,
        "and the ceiling must be reachable, or it is the wrong number");
});

check("the old 1/price figures were unreachable — the exact numbers that shipped", () => {
    // A longshot card printed 7.24× when the true ceiling on it was ~1.8×.
    assert.ok(bestReturn(0.12, YES).win < 1.85);
    assert.ok(bestReturn(0.05, YES).win < 1.95);
    // 1/0.05 = 20×, which is ten times what the position can ever return.
    assert.ok(1 / 0.05 > bestReturn(0.05, YES).win * 5,
        "kept as the record of how far off the odds reading was");
});

check("the underdog still pays more — the ordering the odds got right", () => {
    for (const price of [0.1, 0.25, 0.4]) {
        const r = returns(price);
        assert.ok(r.yes > r.no,
            `at ${price} the unlikely side must pay more than the likely one`);
    }
    // Even money pays the same both ways, and pays it symmetrically.
    const even = returns(0.5);
    assert.ok(Math.abs(even.yes - even.no) < 1e-9);
});

check("and the risk is the other half of the sentence", () => {
    // A max-conviction call on a heavy favourite wins little and risks plenty.
    const fav = bestReturn(0.85, YES);
    assert.ok(fav.win < 1.05, "backing an 85¢ favourite barely pays");
    assert.ok(fav.risk < 0.85, "and it puts most of the stake up to do it");
    // Backing the longshot is the mirror image.
    const dog = bestReturn(0.85, NO);
    assert.ok(dog.win > 1.5);
    assert.ok(dog.risk < 0.2);
});

check("AGREEING WITH THE PRICE RETURNS EXACTLY THE STAKE", () => {
    for (const price of [0.2, 0.5, 0.77]) {
        for (const outcome of [true, false]) {
            assert.ok(Math.abs(returnMultiple(price, price, outcome) - 1) < 1e-9,
                "1.00× is the same statement as 'pays nothing either way'");
        }
    }
});

check("two decimals always, because the whole band is 1.00 to 2.00", () => {
    assert.equal(multiplierLabel(1.1435), "1.14×");
    assert.equal(multiplierLabel(1.4), "1.40×");
    assert.equal(multiplierLabel(2), "2.00×");
    assert.equal(multiplierLabel(0), "0.00×");
    assert.equal(multiplierLabel(NaN), "—");
});

check("MONEY ON A SIDE SHORTENS IT — the whole reason this reads as a market", () => {
    const m = { prior: 0.5 };
    const before = priceOf(m, []);
    const after = priceOf(m, [{ p: 0.9, stake: 400 }]);
    assert.ok(after > before, "yes conviction must raise the price");
    // And the return on yes falls as it gets more likely, which is what a
    // shortening price MEANS — now stated in cred rather than in odds.
    assert.ok(returns(after).yes < returns(before).yes, "yes must shorten");
    assert.ok(returns(after).no > returns(before).no, "no must lengthen");
});

// ─── The tape ───────────────────────────────────────────────────────────────

const tapeMarket = { prior: 0.4, status: "open", opens_at: "2026-09-07T00:00:00Z" };
const tapePositions = (() => {
    const out = [];
    let t = Date.parse("2026-09-08T09:00:00Z");
    for (const [p, stake] of [[0.9, 300], [0.15, 200], [0.8, 100]]) {
        out.push({
            p, stake, price_at_entry: priceOf(tapeMarket, out),
            created_date: new Date(t).toISOString(), user_name: "Someone",
        });
        t += 7200e3;
    }
    return out;
})();

check("THE TAPE REPRODUCES price_at_entry EXACTLY — it is a replay, not a guess", () => {
    const h = priceHistory(tapeMarket, tapePositions, Date.parse("2026-09-11T00:00:00Z"));
    const steps = h.points.filter((x) => x.kind === "trade");
    assert.equal(steps.length, 3);
    tapePositions.forEach((pos, i) => {
        // The price BEFORE step i is the point before it on the tape.
        assert.ok(Math.abs(h.points[i].price - pos.price_at_entry) < 1e-12,
            `frozen entry price ${i} must be reconstructible from the positions alone`);
    });
});

check("the tape opens on the prior and runs to the right edge", () => {
    const now = Date.parse("2026-09-11T00:00:00Z");
    const h = priceHistory(tapeMarket, tapePositions, now);
    assert.equal(h.points[0].kind, "open");
    assert.equal(h.points[0].price, 0.4);
    assert.equal(h.points[h.points.length - 1].kind, "now");
    assert.equal(h.points[h.points.length - 1].t, now,
        "without this a quiet market draws as a stub in the corner");
    assert.equal(h.last, h.points[h.points.length - 1].price);
    assert.equal(h.change, Math.round((h.last - 0.4) * 100));
});

check("a market nobody has touched is a flat line at the prior, not an error", () => {
    const h = priceHistory({ prior: 0.35, status: "open", opens_at: "2026-09-07T00:00:00Z" },
        [], Date.parse("2026-09-09T00:00:00Z"));
    assert.equal(h.trades, 0);
    assert.equal(h.points.length, 2);
    assert.equal(h.low, 0.35);
    assert.equal(h.high, 0.35);
    assert.equal(h.change, 0);
});

check("A CLOCK SKEW NEVER RUNS THE TAPE BACKWARDS", () => {
    const m = { prior: 0.5, status: "open", opens_at: "2026-09-08T00:00:00Z" };
    // Second row stamped BEFORE the first, which a client clock can produce.
    const h = priceHistory(m, [
        { p: 0.9, stake: 100, created_date: "2026-09-08T10:00:00Z" },
        { p: 0.1, stake: 100, created_date: "2026-09-08T09:00:00Z" },
    ], Date.parse("2026-09-09T00:00:00Z"));
    for (let i = 1; i < h.points.length; i += 1) {
        assert.ok(h.points[i].t >= h.points[i - 1].t,
            "a step landing before the one before it draws as a line doubling back");
    }
});

check("zero-stake rows are not steps", () => {
    const h = priceHistory(tapeMarket,
        [...tapePositions, { p: 0.9, stake: 0, created_date: "2026-09-09T00:00:00Z" }],
        Date.parse("2026-09-11T00:00:00Z"));
    assert.equal(h.trades, 3);
});

// ─── The special lines ──────────────────────────────────────────────────────

check("every new kind is a variant and not a feature", () => {
    for (const id of ["versus", "cohort", "longshot", "prep"]) {
        assert.ok(KINDS[id], `${id} must exist`);
        assert.ok(KINDS[id].label && KINDS[id].icon && KINDS[id].resolves,
            `${id} needs a glyph and a sentence — that is all a kind may carry`);
        assert.equal(KINDS[id].selfResolving, false);
    }
    // Two kinds must never print the same kicker, or the board cannot be read.
    const labels = Object.values(KINDS).map((k) => k.label);
    assert.equal(new Set(labels).size, labels.length, "kind labels must be distinct");
});

check("NEITHER SIDE OF A HEAD-TO-HEAD MAY HOLD A POSITION ON IT", () => {
    const m = { kind: "versus", status: "open", in_contest: true };
    assert.ok(blockReason(m, "a@x.com"), "a competitor must be blocked");
    assert.equal(blockReason({ ...m, in_contest: false }, "c@x.com"), null,
        "everybody else trades it");
});

check("a cohort or longshot line is open to EVERYONE, deliberately", () => {
    // Measured by the app out of the study tables; the only way a student can
    // push one is by studying, which is the outcome the app exists to cause.
    for (const kind of ["cohort", "longshot", "prep"]) {
        assert.equal(blockReason({ kind, status: "open", subject_email: "me@x.com" },
            "me@x.com"), null, `${kind} must not block its own subject`);
    }
});

const featureRow = (id, kind, extra = {}) => ({
    id, kind, status: "open", subject_email: "@board", volume: 10, traders: 2, ...extra });

check("featured is the room's questions, never your own, and never a closed one", () => {
    const rows = [
        featureRow("a", "cohort"),
        featureRow("a2", "longshot"),
        // About you: already sorts first on the floor, so featuring it too
        // would print the same card twice on one screen.
        featureRow("b", "versus", { subject_email: "me@x.com", subject_is_me: true,
            volume: 99, traders: 9 }),
        featureRow("c", "streak", { subject_email: "z@x.com", volume: 50, traders: 5 }),
        featureRow("d", "longshot", { status: "resolved" }),
    ];
    const got = featuredOf(rows, "me@x.com", 4).map((m) => m.id).sort();
    assert.deepEqual(got, ["a", "a2"],
        "b is yours, c is not a featured kind, d is shut");
});

check("A FEATURED STRIP IS EVEN, or the two-column grid ends in a hole", () => {
    const three = [featureRow("x", "cohort"), featureRow("y", "longshot"),
        featureRow("z", "versus")];
    assert.equal(featuredOf(three, "me@x.com", 4).length, 2,
        "the trimmed one is not lost — it falls through to the floor below");
    assert.equal(featuredOf(three.slice(0, 1), "me@x.com", 4).length, 0,
        "one card under its own heading is more furniture than content");
    const five = [...three, featureRow("p", "prep"), featureRow("q", "cohort")];
    assert.equal(featuredOf(five, "me@x.com", 4).length, 4);
});

check("FRIENDS SORT, THEY DO NOT FILTER", () => {
    const rows = [
        { id: "hot", kind: "streak", status: "open", volume: 900, traders: 9 },
        { id: "pal", kind: "streak", status: "open", subject_is_friend: true, volume: 5, traders: 1 },
        { id: "mine", kind: "streak", status: "open", subject_is_me: true, volume: 1, traders: 1 },
    ];
    const got = sortBoard(rows, "me@x.com").map((m) => m.id);
    assert.deepEqual(got, ["mine", "pal", "hot"]);
    assert.equal(sortBoard(rows, "me@x.com").length, 3,
        "a friends-only board would give each question five possible traders and kill the price");
});


// ─── ROOMS: a view of one floor, never a floor of its own ──────────────────

const mk = (over = {}) => ({ kind: "versus", prior: 0.5, subject_email: "a@x.com", ...over });

check("a room NARROWS a view and never splits a price", () => {
    // The whole point: every room shows markets from the same pool, so a
    // question in the friends room is the same row, at the same price, that
    // everybody else is trading in `all`.
    const board = [mk({ subject_is_friend: true }), mk({ kind: "cohort" }), mk({})];
    const all = board.filter((m) => inRoom(m, "all"));
    assert.equal(all.length, board.length, "`all` takes everything");
    for (const room of ["friends", "cohort"]) {
        for (const m of board.filter((x) => inRoom(x, room))) {
            assert.ok(board.includes(m), "a room may only ever show rows from the one floor");
        }
    }
});

check("the friends room holds friends AND yourself", () => {
    // The most motivating market on the board is the one about you, so it
    // belongs in the room called "people I have a reason to care about".
    const me = "me@x.com";
    assert.equal(inRoom(mk({ subject_is_friend: true }), "friends", me), true);
    assert.equal(inRoom(mk({ subject_email: me }), "friends", me), true);
    assert.equal(inRoom(mk({ subject_is_me: true }), "friends", me), true);
    assert.equal(inRoom(mk({}), "friends", me), false, "a stranger is not");
});

check("the cohort room is about NOBODY in particular", () => {
    assert.equal(inRoom(mk({ kind: "cohort" }), "cohort"), true);
    assert.equal(inRoom(mk({ kind: "longshot" }), "cohort"), true);
    // A named student's question is not a cohort question however popular.
    assert.equal(inRoom(mk({ kind: "versus", subject_is_friend: true }), "cohort"), false);
    assert.equal(inRoom(mk({ kind: "hours" }), "cohort"), false);
});

check("A ROOM WITH NOTHING IN IT IS NOT OFFERED", () => {
    // A tab that is always empty teaches that the feature is broken, and a
    // student with no friends yet would meet one on their first visit.
    const strangers = [mk({}), mk({ kind: "hours" })];
    const { rooms } = roomsFor(strangers, "me@x.com");
    assert.deepEqual(rooms.map((r) => r.id), ["all"], "only the floor");

    const withFriend = [...strangers, mk({ subject_is_friend: true })];
    assert.ok(roomsFor(withFriend, "me@x.com").rooms.some((r) => r.id === "friends"));
});

check("`all` is offered even when the board is empty", () => {
    assert.deepEqual(roomsFor([], null).rooms.map((r) => r.id), ["all"]);
});

// ─── THE CAP: who makes the board when too many were minted ────────────────

const person = (email, prior) => ({ kind: "versus", subject_email: email, prior });

check("THE TARGET IS TRADERS, so it does not move when the roster does", () => {
    const small = Array.from({ length: 18 }, (_, i) => person(`s${i}@x.com`, 0.5));
    const huge = Array.from({ length: 68 }, (_, i) => person(`h${i}@x.com`, 0.5));
    assert.equal(pickBoard(small, { weekKey: "2026-W01" }).length, 18, "under target, all of it");
    assert.equal(pickBoard(huge, { weekKey: "2026-W01" }).length, BOARD_TARGET,
        "130 actives mints ~68 and the board still carries 20");
});

check("the special lines always make it", () => {
    // One market the whole room can hold a view on is the best value per row;
    // capping it to make space for a head-to-head is backwards.
    const crowd = Array.from({ length: 60 }, (_, i) => person(`p${i}@x.com`, 0.5));
    const picked = pickBoard([...crowd,
        { kind: "cohort", prior: 0.4 }, { kind: "longshot", prior: 0.08 },
        { kind: "prep", prior: 0.7, subject_email: "z@x.com" }], { weekKey: "W" });
    assert.equal(picked.filter((m) => m.kind === "cohort").length, 1);
    assert.equal(picked.filter((m) => m.kind === "longshot").length, 1);
    assert.equal(picked.filter((m) => m.kind === "prep").length, 1);
    assert.equal(picked.length, BOARD_TARGET);
});

check("an EVEN question beats a lopsided one", () => {
    // A market priced at 95c pays nobody and teaches that the board is
    // decoration — the same reason pairUpRoom matches on the base rate.
    const picked = pickBoard([
        person("even@x.com", 0.5), person("tilted@x.com", 0.95), person("near@x.com", 0.55),
    ], { target: 2, weekKey: "W" });
    assert.equal(picked.length, 2);
    assert.ok(!picked.some((m) => m.subject_email === "tilted@x.com"), "the 95c one waits");
});

check("A LOPSIDED QUESTION IS KEPT RATHER THAN THE BOARD LEFT SHORT", () => {
    // Evenness ranks; it does not exclude. A quiet week must still fill.
    const picked = pickBoard([person("a@x.com", 0.97), person("b@x.com", 0.99)],
        { target: 5, weekKey: "W" });
    assert.equal(picked.length, 2);
});

check("THE BOARD ROTATES, or the same students own it every week", () => {
    // Ranking on evenness alone means a student whose prior sits at 0.85 never
    // once sees a question about themselves, which is the single most
    // motivating thing this board does.
    const crowd = Array.from({ length: 40 }, (_, i) => person(`p${i}@x.com`, 0.5));
    const seen = new Set();
    for (const wk of ["2026-W01", "2026-W02", "2026-W03", "2026-W04", "2026-W05"]) {
        pickBoard(crowd, { target: 10, weekKey: wk }).forEach((m) => seen.add(m.subject_email));
    }
    assert.ok(seen.size > 10,
        `only ${seen.size} students ever appeared across five weeks — the board does not rotate`);
});

check("but ONE week always picks the same board", () => {
    // A floor that reshuffles between two page loads is one nobody can come
    // back to. The rotation is a stable hash of the week, not a random.
    const crowd = Array.from({ length: 40 }, (_, i) => person(`p${i}@x.com`, 0.5));
    const a = pickBoard(crowd, { target: 10, weekKey: "2026-W07" }).map((m) => m.subject_email);
    const b = pickBoard(crowd, { target: 10, weekKey: "2026-W07" }).map((m) => m.subject_email);
    assert.deepEqual(a, b);
});

check("what is ALREADY open counts against the target", () => {
    // The cap is on the BOARD, not on one minting run — otherwise a second
    // visit in the same week mints another twenty.
    const crowd = Array.from({ length: 40 }, (_, i) => person(`p${i}@x.com`, 0.5));
    assert.equal(pickBoard(crowd, { weekKey: "W", existing: 18 }).length, 2);
    assert.equal(pickBoard(crowd, { weekKey: "W", existing: BOARD_TARGET }).length, 0,
        "a full board mints nothing");
    assert.equal(pickBoard(crowd, { weekKey: "W", existing: 999 }).length, 0, "never negative");
});

check("nothing to pick is not an error", () => {
    for (const bad of [[], null, undefined, [null, undefined]]) {
        assert.deepEqual(pickBoard(bad, { weekKey: "W" }), [], JSON.stringify(bad));
    }
});

check("a market with no prior is treated as even rather than dropped", () => {
    const picked = pickBoard([{ kind: "versus", subject_email: "a@x.com" }], { target: 5, weekKey: "W" });
    assert.equal(picked.length, 1);
});

// ─── THE SLIDER CANNOT EXPRESS A POSITION ON THE OTHER SIDE ─────────────────
//
// The whole point of anchoring the track at the room's price. These are the
// assertions that make the deleted warning paragraph unnecessary rather than
// merely hidden: if any conviction the slider can reach pays on the OPPOSITE
// outcome, the inversion is back and nothing on screen says so any more.

const cents = (v) => Math.round(v * 100);

check("every reachable conviction is a real position on the side you picked", () => {
    for (let c = 2; c <= 98; c += 1) {
        const price = c / 100;
        for (const side of [YES, NO]) {
            const r = convictionRange(side, price);
            if (!r.tradeable) continue;
            // Walk the whole track, including both ends.
            for (let v = r.floor; v <= r.ceiling + 1e-9; v += 0.005) {
                const conviction = Math.min(r.ceiling, v);
                const p = probFor(side, conviction);
                const win = payoutFor(100, p, price, side === YES);
                assert.ok(win >= -0.5,
                    `${side} at ${cents(conviction)}% into ${c}¢ pays ${win} when its OWN `
                    + "side lands — the track still reaches the other position");
            }
        }
    }
});

check("the floor is the room's line, or the coin flip when that is higher", () => {
    const high = convictionRange(YES, 0.8);
    assert.equal(cents(high.floor), 80);
    assert.equal(high.atRoom, true);

    // Yes at 30¢: any belief above even money already beats the price, so the
    // coin flip is the real anchor and the label must not claim otherwise.
    const low = convictionRange(YES, 0.3);
    assert.equal(low.floor, CONVICTION_MIN);
    assert.equal(low.atRoom, false);

    // NO reads the MIRROR price, which is the whole reason this is a function
    // rather than `price` written out twice.
    assert.equal(cents(convictionRange(NO, 0.3).floor), 70);
    assert.equal(convictionRange(NO, 0.8).floor, CONVICTION_MIN);
});

check("a side the room has already run past has NO call left, and says so", () => {
    const r = convictionRange(YES, 0.99);
    assert.equal(r.tradeable, false, "99¢ yes leaves nothing to win");
    assert.ok(r.headroom < 0.01);
    // Reported rather than clamped into a one-pixel track that pays nothing.
    assert.equal(r.floor, CONVICTION_MAX);
    assert.equal(convictionRange(YES, 0.9).tradeable, true, "90¢ still has room");
});

check("switching sides moves the handle rather than carrying it under the floor", () => {
    // The inversion coming back in through the other door: a conviction picked
    // for one side is meaningless once the floor moves.
    const carried = startingConviction(NO, 0.2, 0.55);
    assert.ok(carried > convictionRange(NO, 0.2).floor,
        "0.55 is below no's 80¢ floor and must not survive the switch");
    // One that IS still above the new floor is kept — re-picking a side should
    // not throw away a drag that is still a valid call.
    assert.equal(startingConviction(YES, 0.6, 0.85), 0.85);
});

check("the panel never opens on a call worth exactly nothing", () => {
    for (const price of [0.1, 0.35, 0.5, 0.62, 0.88]) {
        for (const side of [YES, NO]) {
            const r = convictionRange(side, price);
            const start = startingConviction(side, price);
            assert.ok(start > r.floor && start <= r.ceiling,
                `${side} at ${price} opens at ${start}, floor ${r.floor}`);
        }
    }
});

// ─── A MARK, AND THE LINE SOMEBODY CALLS ON IT ──────────────────────────────

check("a mark is a percentage of its OWN denominator", () => {
    assert.equal(markPercent(48, 60), 80);
    assert.equal(markPercent(25, 25), 100);
    assert.equal(markPercent(0, 40), 0);
    // Rounds to whole points, because that is the scale the line is stated on.
    assert.equal(markPercent(17, 30), 57);
});

check("a mark nobody has entered is NULL and never a zero", () => {
    // `Number(null) === 0` would settle the market as a fail for a student who
    // simply has not typed their result in yet. The trap this file keeps
    // meeting, here with somebody's SAC on the other end of it.
    for (const bad of [[null, 60], [undefined, 60], ["", 60], [48, null], [48, 0], [48, ""]]) {
        assert.equal(markPercent(bad[0], bad[1]), null, JSON.stringify(bad));
    }
    assert.equal(markPercent("48", "60"), 80, "a numeric string is still a mark");
});

check("a line REFUSES to price itself off too few marks", () => {
    const thin = priorForLine([90, 88], 80);
    assert.equal(thin.prior, 0.5);
    assert.equal(thin.thin, true);
    assert.equal(thin.seen, 2);
    assert.equal(thin.average, 89, "it still reports what it saw");
    assert.equal(priorForLine([], 80).prior, 0.5);
});

check("and past that it prices off what they have actually scored", () => {
    // The hole the flat 0.5 left: a 95 line from a student averaging 58 opened
    // at even money and paid whoever took no, on a fact anybody could see.
    const stretch = priorForLine([55, 61, 58, 60], 95);
    assert.ok(stretch.prior < 0.35, `95 off a 58 average opened at ${stretch.prior}`);
    const gimme = priorForLine([84, 88, 91, 86], 70);
    assert.ok(gimme.prior > 0.65, `70 off an 87 average opened at ${gimme.prior}`);
});

check("but it never opens somewhere nobody can disagree with", () => {
    // Four from four is not certainty, and a market at 100¢ has nothing to
    // trade. Smoothed and then clamped, the same reasoning as PRIOR_WEIGHT.
    const perfect = priorForLine([90, 92, 95, 91, 99], 60);
    assert.ok(perfect.prior <= 0.88 && perfect.prior > 0.5, `${perfect.prior}`);
    const hopeless = priorForLine([40, 44, 38, 41, 35], 99);
    assert.ok(hopeless.prior >= 0.12 && hopeless.prior < 0.5, `${hopeless.prior}`);
});

const sacMarket = (over = {}) => ({
    id: "m1", kind: "sac", status: "resolved", prior: 0.5,
    title: "Will Sam score 80+ on their Chemistry SAC?",
    subject_is_me: true,
    meta: { target: 80, subject: "Chemistry", reported: 84 },
    positions: [
        { p: 0.7, stake: 100, price_at_entry: 0.5 },
        { p: 0.65, stake: 50, price_at_entry: 0.55 },
        { p: 0.25, stake: 100, price_at_entry: 0.6 },
    ],
    ...over,
});

check("the subject gets the room's read, and no cred anywhere in it", () => {
    const line = selfLine(sacMarket());
    assert.equal(line.called, 80);
    assert.equal(line.actual, 84);
    assert.equal(line.cleared, true);
    assert.equal(line.backed, 2);
    assert.equal(line.faded, 1);
    assert.equal(line.roomBacked, true);
    assert.ok(line.room > 0 && line.room < 100);
    // Nothing in the payload is a payout. The subject cannot hold a position,
    // so there is no branch here that moves cred toward them.
    assert.equal(JSON.stringify(line).includes("payout"), false);
});

check("a line with no mark yet reports NO mark, not a fail", () => {
    const open = selfLine(sacMarket({ status: "open", meta: { target: 80, subject: "Chemistry" } }));
    assert.equal(open.actual, null);
    assert.equal(open.cleared, null, "unreported must never read as missed");
    // And with nobody trading it, the room has not said anything either.
    const quiet = selfLine(sacMarket({ positions: [] }));
    assert.equal(quiet.traders, 0);
    assert.equal(quiet.roomBacked, null);
});

check("selfLine only speaks about mark markets", () => {
    assert.equal(selfLine({ kind: "streak", meta: { target: 5 } }), null);
    assert.equal(selfLine(sacMarket({ meta: {} })), null, "no line, nothing to report");
    assert.equal(selfLine(null), null);
});

check("the self record refuses to grade somebody on two SACs", () => {
    const two = selfRecord([sacMarket(), sacMarket({ id: "m2" })], "sam@x.com");
    assert.equal(two.closed, 2);
    assert.equal(two.enough, false, `${MARK_MIN_OBS} closed lines is the floor`);

    const runs = [84, 71, 90, 66].map((reported, i) => sacMarket({
        id: `s${i}`, meta: { target: 80, subject: "Chemistry", reported },
    }));
    const rec = selfRecord(runs, "sam@x.com");
    assert.equal(rec.enough, true);
    assert.equal(rec.cleared, 2, "84 and 90 cleared 80; 71 and 66 did not");
    assert.equal(rec.rate, 0.5);
    // Signed drift: positive means they beat their own call on average.
    assert.equal(rec.drift, Math.round((4 + -9 + 10 + -14) / 4));
});

check("an OPEN line is not part of the record", () => {
    // Nothing has been tested, so counting it would report a miss for a SAC
    // that has not happened yet.
    const rec = selfRecord([sacMarket({ status: "open", meta: { target: 80 } })], "sam@x.com");
    assert.equal(rec.closed, 0);
    assert.equal(rec.rate, null);
});

console.log(`\n${passed} passed`);
