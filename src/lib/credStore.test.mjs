/**
 * cred-store assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/credStore.test.mjs
 *
 * TWO CLASSES OF FAILURE, and the second one costs actual money.
 *
 * 1. AN ECONOMY THAT LEAKS. A purchase that grants without deducting, a
 *    cosmetic bought twice, a consumable stockpiled, a refund path that lets an
 *    object become a balance. None of these throw; they render as a student
 *    with more than they earned, and by the time anybody notices, the ledger
 *    has been wrong for weeks.
 *
 * 2. A PURCHASE THAT COSTS REAL MONEY. There was one — a door converting cred
 *    into AI chips, where `chips.js` prices a week's stack at $1.95 of actual
 *    Anthropic spend — and it is gone. What replaces the ceiling it needed is
 *    an ABSENCE: no catalogue entry is per-unit, and nothing in the module
 *    reaches toward `chips.js` at all. That is a stronger guarantee than a cap,
 *    and it is the shape the refund rule below already takes, because the day
 *    somebody adds a door back is the day it should fail rather than the day
 *    it turns up on an invoice.
 *
 * And one rule the whole design rests on: XP SETS THE RATE, NEVER THE BALANCE.
 * market.js's own header says a market where abstaining is optimal is not a
 * market, which is exactly what an XP→cred conversion would create. Nothing
 * here may deduct XP, and the scan at the bottom is what holds that.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    GRANT_BASE, GRANT_TOP, TIERS, MID_GRANT,
    CATALOGUE, grantForTier, itemById, owns, heldCount,
    priceOf, canBuy, purchasePatch, equipped,
    grantForLeague, LEAGUE_BANDS,
    convertibleXP, convertedThisWeek, convertQuote, convertPatch,
    WEEKLY_CONVERT_MAX, XP_PER_CREDIT,
} from "@/lib/credStore";
import { CRED_WEEKLY_GRANT, CRED_BALANCE_CAP } from "@/lib/market";

/** Source with comments removed — a scan must never read its own explanation
 *  as the defect, the false positive `fnResult.test.mjs` had to learn about. */
const withoutComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const WEEK = "2026-09-28";
const who = (over = {}) => ({ cred_balance: 5000, extra: {}, ...over });

/* ── The grant ───────────────────────────────────────────────────────────── */

check("RANK MOVES THE GRANT, and it moves monotonically", () => {
    const grants = Array.from({ length: TIERS }, (_, i) => grantForTier(i + 1));
    assert.equal(grants[0], GRANT_BASE);
    assert.equal(grants[TIERS - 1], GRANT_TOP);
    for (let i = 1; i < grants.length; i++) {
        assert.ok(grants[i] > grants[i - 1],
            `tier ${i + 1} grants ${grants[i]}, no more than tier ${i}'s ${grants[i - 1]}`);
    }
});

check("AN UNKNOWN TIER GETS THE FLOOR, never the ceiling", () => {
    // The same asymmetry compliance.js keeps: guessing generously hands the
    // best rate to somebody who has not earned it, and a student can only ever
    // notice the generous mistake.
    for (const bad of [null, undefined, NaN, "top", {}, -4, 0, Infinity]) {
        assert.equal(grantForTier(bad), GRANT_BASE, `${JSON.stringify(bad)} did not get the floor`);
    }
    // Past the top of the ladder clamps rather than extrapolating.
    assert.equal(grantForTier(99), GRANT_TOP);
    assert.equal(grantForTier(10.9), GRANT_TOP, "a fractional tier floors into its own tier");
});

check("the ladder straddles the flat grant it replaced", () => {
    // Tier 1 gets LESS than the old flat 1000, deliberately: a raise that costs
    // nobody anything is inflation, and a floor equal to the ceiling cannot
    // express a rank at all.
    assert.ok(GRANT_BASE < CRED_WEEKLY_GRANT, "the floor is not below the old flat grant");
    assert.ok(GRANT_TOP > CRED_WEEKLY_GRANT, "the ceiling is not above it");
    // And no tier can out-earn the balance cap in one week, or the cap stops
    // being a cap and the Monday top-up becomes a reset to full.
    assert.ok(GRANT_TOP < CRED_BALANCE_CAP);
});

/* ── The catalogue ───────────────────────────────────────────────────────── */

check("every item is buyable, priced, and of a kind something handles", () => {
    const kinds = new Set(["cosmetic", "utility", "market"]);
    const ids = new Set();
    for (const item of CATALOGUE) {
        assert.ok(item.id && !ids.has(item.id), `duplicate or missing id: ${item.id}`);
        ids.add(item.id);
        assert.ok(kinds.has(item.kind), `${item.id} has unhandled kind "${item.kind}"`);
        assert.ok(Number.isFinite(item.price) && item.price > 0, `${item.id} has no usable price`);
        assert.ok(item.name && item.blurb, `${item.id} has nothing to print`);
        if (item.kind === "cosmetic") assert.ok(item.slot, `${item.id} is a cosmetic with no slot`);
        if (item.kind === "utility") assert.ok(item.effect, `${item.id} does nothing`);
    }
    assert.equal(itemById("nope"), null);
    assert.equal(itemById(null), null);
});

check("A PRICE IS A NUMBER SOMEBODY CAN HOLD IN THEIR HEAD", () => {
    // The first draft priced things at 713, 951, 1427 and 2378 — a computed
    // multiple of a grant, showing its arithmetic on a shelf. Nobody weighs 713
    // against 951. Every fixed price is a multiple of 50.
    for (const item of CATALOGUE.filter((i) => !i.perUnit)) {
        assert.equal(item.price % 50, 0, `${item.id} costs ${item.price}, which nobody can hold`);
    }
});

check("PRICES ARE READABLE AS WEEKS, not as bare numbers", () => {
    // A price nobody can calibrate is a price nobody weighs. Everything
    // non-per-unit sits between about half a week and two weeks of a mid grant.
    for (const item of CATALOGUE.filter((i) => !i.perUnit)) {
        const weeks = item.price / MID_GRANT;
        assert.ok(weeks >= 0.4 && weeks <= 2.5,
            `${item.id} costs ${weeks.toFixed(1)} mid-tier weeks, which nobody can judge`);
    }
});

/* ── The money door, which is now an absence ─────────────────────────────── */

check("NO PURCHASE HERE COSTS REAL MONEY", () => {
    // Cred could briefly be converted into AI chips, and `chips.js` prices a
    // week's stack at $1.95 of actual Anthropic spend — so that one shelf row
    // was the only thing in Compete that could be wrong in DOLLARS. It is gone,
    // and the guarantee is an absence rather than a ceiling: nothing in this
    // module may reach toward the chip economy in either direction.
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/credStore.js"), "utf8");
    const code = withoutComments(src);
    assert.ok(!/chips/i.test(code),
        "credStore reaches for chips again — a cred→AI door is money, and it was removed on purpose");
    assert.ok(!/MICROS_PER_CHIP|WEEKLY_CHIPS|WEEKLY_CAP_MICROS/.test(code),
        "a chip price crossed back into the cred economy");
});

check("EVERY PRICE IS FIXED, so nothing is bought by the unit", () => {
    // A per-unit row is what the money door needed and the only thing that
    // needed it. With none, `priceOf` takes no multiplier, the store draws no
    // quantity control, and the server has no `units` to validate — three
    // places that cannot disagree about a quantity that does not exist.
    for (const item of CATALOGUE) {
        assert.equal(item.perUnit, undefined, `${item.id} is per-unit — see the header`);
    }
    assert.equal(priceOf.length, 1, "priceOf grew a second argument — a quantity is back");
});

/* ── Spending ────────────────────────────────────────────────────────────── */

check("A PURCHASE ALWAYS DEDUCTS, and never below zero", () => {
    const p = who({ cred_balance: MID_GRANT * 3 });
    const patch = purchasePatch(p, "back-felt", { week: WEEK });
    assert.ok(patch);
    assert.equal(patch.cred_balance, p.cred_balance - itemById("back-felt").price);
    assert.ok(patch.cred_balance >= 0);
    assert.ok(patch.extra.cred_owned.includes("back-felt"));
});

check("YOU CANNOT SPEND WHAT YOU DO NOT HAVE, and the refusal says how short", () => {
    const broke = who({ cred_balance: 10 });
    const v = canBuy(broke, "back-gilt", { week: WEEK });
    assert.equal(v.ok, false);
    assert.match(v.reason, /more cred/);
    // And the pure patch refuses too — a caller that skips canBuy still cannot
    // spend, which is the whole reason the check lives inside it.
    assert.equal(purchasePatch(broke, "back-gilt", { week: WEEK }), null);
});

check("a cosmetic is bought ONCE", () => {
    const owner = who({ extra: { cred_owned: ["back-felt"] } });
    assert.equal(owns(owner, "back-felt"), true);
    assert.equal(canBuy(owner, "back-felt", { week: WEEK }).ok, false);
    assert.equal(purchasePatch(owner, "back-felt", { week: WEEK }), null,
        "buying an owned cosmetic twice would charge for nothing");
});

check("A CONSUMABLE CANNOT BE STOCKPILED", () => {
    // One freeze is insurance; five is an exemption, and a streak that can be
    // bought out of stops measuring anything.
    const p = who();
    const first = purchasePatch(p, "streak-freeze", { week: WEEK });
    assert.ok(first);
    assert.equal(first.extra.cred_held["streak-freeze"], 1);
    assert.deepEqual(first._effect, { type: "streak_shield" });

    const holding = who({ extra: first.extra });
    assert.equal(canBuy(holding, "streak-freeze", { week: WEEK }).ok, false);
    assert.equal(purchasePatch(holding, "streak-freeze", { week: WEEK }), null);
});

check("the patch NAMES what the caller still has to do", () => {
    // Named rather than inferred from the id: a handler switching on a string
    // is how a second catalogue entry of the same kind gets forgotten.
    const freeze = purchasePatch(who({ cred_balance: CRED_BALANCE_CAP }), "streak-freeze");
    assert.deepEqual(freeze._effect, { type: "streak_shield" });

    const cosmetic = purchasePatch(who({ cred_balance: CRED_BALANCE_CAP }), "back-ink");
    assert.equal(cosmetic._effect, null, "a cosmetic is complete once the patch lands");
    assert.ok(cosmetic.extra.cred_owned.includes("back-ink"));

    // EVERY EFFECT IS RECORDED BY THE PATCH ITSELF, which is what lets the
    // server charge and grant in ONE write. The money door was the only thing
    // that needed a second act afterwards, and it had no refund path to unwind
    // a charge that landed with a failed grant.
    for (const item of CATALOGUE) {
        const patch = purchasePatch(who({ cred_balance: CRED_BALANCE_CAP }), item.id);
        assert.ok(patch, `${item.id} could not be bought at the cap`);
        assert.ok(patch.extra || patch._effect,
            `${item.id} charges and records nothing`);
    }
});

check("a purchase never disturbs its neighbours in `extra`", () => {
    const p = who({ extra: { daily_intent: "cramming", date_of_birth: "2008-01-01" } });
    const patch = purchasePatch(p, "back-felt", { week: WEEK });
    assert.equal(patch.extra.daily_intent, "cramming");
    assert.equal(patch.extra.date_of_birth, "2008-01-01");
});

check("NOTHING IS REFUNDABLE, which is what closes the arbitrage", () => {
    // With no sell-back there is no path from an owned object to a balance, so
    // a cosmetic cannot be laundered into chips. Asserted as an absence,
    // because the day somebody adds a refund is the day this stops being true.
    const code = withoutComments(
        fs.readFileSync(path.join(process.cwd(), "src/lib/credStore.js"), "utf8"));
    assert.ok(!/refund|sell|resell|cash.?out/i.test(code),
        "a refund path appeared — every price here assumes cred only moves one way");
});

check("AN UNKNOWN ITEM BUYS NOTHING, and never for free", () => {
    const rich = who({ cred_balance: CRED_BALANCE_CAP });
    for (const id of ["chips", "", null, undefined, "not-a-thing", 0]) {
        assert.equal(canBuy(rich, id).ok, false, `${id} was buyable`);
        assert.equal(purchasePatch(rich, id), null, `${id} produced a patch`);
    }
    // A zero or negative price would read as FREE at every call site that
    // checks affordability with a comparison, so it is null instead.
    assert.equal(priceOf(null), null);
    assert.equal(priceOf({ price: 0 }), null);
    assert.equal(priceOf({ price: -10 }), null);
});

/* ── Equipping ───────────────────────────────────────────────────────────── */

check("YOU CANNOT EQUIP WHAT YOU DO NOT OWN", () => {
    const faker = who({ extra: { cred_equipped: { back: "back-gilt" }, cred_owned: [] } });
    assert.equal(equipped(faker, "back"), null, "an unowned cosmetic rendered as equipped");
    const real = who({ extra: { cred_equipped: { back: "back-gilt" }, cred_owned: ["back-gilt"] } });
    assert.equal(equipped(real, "back"), "back-gilt");
    assert.equal(equipped(who(), "back"), null);
    assert.equal(equipped(null, "back"), null);
});

/* ── The invariant the whole board rests on ──────────────────────────────── */

check("XP IS READ AND NEVER WRITTEN — no patch may carry `total_xp`", () => {
    // This assertion used to be "credStore never mentions XP at all", which was
    // right while nothing converted and is too blunt now: the module legitimately
    // READS `total_xp` to work out how much is left to convert. What must stay
    // true is narrower and is the whole guarantee the design rests on — nothing
    // here ever WRITES that column.
    //
    // A debit would leave the ATAR alone (it is computed from `xp_events`) and
    // would still drop the student's LEVEL and RANK, which is the failure
    // `market.js` refuses about staking XP. server.mjs guards the column in its
    // own words — "total_xp is STRICTLY ADDITIVE" — and this is the client half.
    const code = withoutComments(
        fs.readFileSync(path.join(process.cwd(), "src/lib/credStore.js"), "utf8"));
    assert.ok(!/total_xp\s*[:=][^=]/.test(code),
        "credStore assigns total_xp — XP is a budget to read, never a balance to write");
    assert.ok(!/awardXP|deductXP|xp_awarded/i.test(code),
        "credStore reaches into the XP economy");

    // And the patch itself, which is what actually reaches the database.
    const rich = who({ total_xp: 40000, cred_balance: 0 });
    const patch = convertPatch(rich, 2000, WEEK);
    assert.ok(patch, "a legitimate conversion was refused");
    assert.ok(!("total_xp" in patch), "convertPatch would write total_xp");
    assert.equal(typeof grantForTier(7), "number");
});

/* ── XP → credits ────────────────────────────────────────────────────────── */

check("CONVERSION SPENDS A BUDGET, NEVER A BALANCE", () => {
    const rich = who({ total_xp: 40000, cred_balance: 0 });
    assert.equal(convertibleXP(rich), 40000);

    const patch = convertPatch(rich, 400, WEEK);
    assert.equal(patch.cred_balance, 100, "400 XP is 100 credits at 4:1");
    assert.equal(patch.extra.xp_converted, 400, "the budget records what was spent");

    // Converting again spends from what is LEFT, not from the whole total.
    const after = { ...rich, ...patch, extra: patch.extra };
    assert.equal(convertibleXP(after), 39600);
});

check("THE WEEKLY CEILING STOPS THIS EATING THE LEAGUE", () => {
    // If a term of banked XP could out-earn winning a league group, the grant
    // this release just moved to the league would stop mattering immediately.
    assert.ok(WEEKLY_CONVERT_MAX < GRANT_TOP - GRANT_BASE,
        "a week of converting beats the league's whole spread");

    const rich = who({ total_xp: 999999, cred_balance: 0 });
    const maxed = who({
        total_xp: 999999, cred_balance: 0,
        extra: { xp_converted_week: { week: WEEK, credits: WEEKLY_CONVERT_MAX } },
    });
    assert.equal(convertQuote(rich, WEEKLY_CONVERT_MAX * XP_PER_CREDIT, WEEK).ok, true);
    assert.match(convertQuote(maxed, 100, WEEK).reason, /this week/i);
    // Last week's conversion does not count against this one.
    const stale = who({ total_xp: 999999, extra: { xp_converted_week: { week: "2026-09-21", credits: WEEKLY_CONVERT_MAX } } });
    assert.equal(convertedThisWeek(stale, WEEK), 0);
});

check("A CONVERSION THAT WOULD OVERFLOW THE CAP REFUSES, never clamps", () => {
    // Clamping would spend XP out of a budget that only spends once and hand
    // back credits the cap discarded — destroying the thing it is meant to be
    // careful with, silently, when the student has the most of it.
    const full = who({ total_xp: 40000, cred_balance: CRED_BALANCE_CAP });
    const v = convertQuote(full, 4000, WEEK);
    assert.equal(v.ok, false);
    assert.match(v.reason, /full/i);
    assert.equal(convertPatch(full, 4000, WEEK), null);

    const nearly = who({ total_xp: 40000, cred_balance: CRED_BALANCE_CAP - 10 });
    assert.match(convertQuote(nearly, 4000, WEEK).reason, /10 more/);
    const fits = convertPatch(nearly, 40, WEEK);
    assert.equal(fits.cred_balance, CRED_BALANCE_CAP, "exactly the remainder is allowed");
});

check("NOTHING IS CONVERTED FOR NOTHING", () => {
    const rich = who({ total_xp: 40000, cred_balance: 0 });
    for (const bad of [0, -100, NaN, null, "lots", 1.5]) {
        assert.equal(convertQuote(rich, bad, WEEK).ok, false, `${bad} converted`);
        assert.equal(convertPatch(rich, bad, WEEK), null);
    }
    // Under one credit's worth is a refusal, not a free credit and not a
    // silent burn of the XP that did not reach the rate.
    assert.equal(convertQuote(rich, XP_PER_CREDIT - 1, WEEK).ok, false);
    assert.equal(convertQuote(who({ total_xp: 0 }), 100, WEEK).ok, false);
});

/* ── The league pays the grant ───────────────────────────────────────────── */

check("FINISH OUTWEIGHS TIER, which is the point of moving the grant", () => {
    const bronzeWinner = grantForLeague({ tierIndex: 0, position: 1 });
    const masterLast = grantForLeague({ tierIndex: LEAGUE_BANDS - 1, position: 30 });
    assert.ok(bronzeWinner > masterLast,
        `winning bronze (${bronzeWinner}) must beat coasting in master (${masterLast})`);
});

check("THE GRANT IS BOUNDED BY CONSTRUCTION, never by a clamp", () => {
    let lo = Infinity, hi = -Infinity;
    for (let t = -2; t <= LEAGUE_BANDS + 2; t += 1) {
        for (const pos of [null, undefined, NaN, -5, 0, 1, 2, 15, 29, 30, 99]) {
            const g = grantForLeague({ tierIndex: t, position: pos, groupSize: 30 });
            assert.ok(Number.isFinite(g), `tier ${t} pos ${pos} produced ${g}`);
            lo = Math.min(lo, g); hi = Math.max(hi, g);
        }
    }
    assert.equal(lo, GRANT_BASE, "something paid under the floor");
    assert.equal(hi, GRANT_TOP, "something paid over the ceiling");
});

check("AN UNPLACED FINISH TAKES THE FLOOR OF ITS BAND, never the middle", () => {
    // The same unknown-denies-everything asymmetry compliance.js keeps.
    for (let t = 0; t < LEAGUE_BANDS; t += 1) {
        assert.equal(grantForLeague({ tierIndex: t, position: null }),
            grantForLeague({ tierIndex: t, position: 30 }),
            "an unplaced student out-earned the last place in their tier");
    }
    // A group of one is a win, not an unplaced row.
    assert.equal(grantForLeague({ tierIndex: 0, position: 1, groupSize: 1 }),
        grantForLeague({ tierIndex: 0, position: 1, groupSize: 30 }));
});

console.log(`\ncredStore: ${passed} checks passed`);
