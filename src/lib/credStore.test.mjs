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
 * 2. THE CHIPS DOOR. `chips.js` prices a week's stack at $1.95 of real
 *    Anthropic spend, so every chip this module hands out is billable. The
 *    ceiling is written in micro-dollars and the chip count is DERIVED from it,
 *    and the test pins that direction — a cap expressed in chips silently
 *    doubles in cost the day chip pricing moves, which is the failure that
 *    would be found on an invoice rather than in the app.
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
    CHIPS_WEEKLY_MICRO_CAP, CHIPS_WEEKLY_MAX,
    CATALOGUE, grantForTier, itemById, owns, heldCount,
    chipsConvertedThisWeek, priceOf, canBuy, purchasePatch, equipped,
} from "@/lib/credStore";
import { MICROS_PER_CHIP, WEEKLY_CHIPS, WEEKLY_CAP_MICROS } from "@/lib/chips";
import { CRED_WEEKLY_GRANT, CRED_BALANCE_CAP } from "@/lib/market";

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
    const kinds = new Set(["cosmetic", "utility", "chips", "market"]);
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

/* ── The chips door, which is money ──────────────────────────────────────── */

check("THE CHIPS CEILING IS DERIVED FROM DOLLARS, never typed as chips", () => {
    // A cap written as "300 chips" doubles in cost the day chip pricing moves,
    // and the discovery happens on an invoice. Written as micro-dollars, it
    // cannot.
    assert.equal(CHIPS_WEEKLY_MAX, Math.floor(CHIPS_WEEKLY_MICRO_CAP / MICROS_PER_CHIP));
    // And the ceiling is a real fraction of a week rather than a second stack.
    assert.ok(CHIPS_WEEKLY_MICRO_CAP < WEEKLY_CAP_MICROS,
        "a student can convert more than their whole weekly budget");
    assert.ok(CHIPS_WEEKLY_MAX < WEEKLY_CHIPS / 2,
        "the top-up is more than half a stack again");
});

check("THE MAXIMUM CONVERSION COSTS MORE THAN A TOP-TIER WEEK", () => {
    // Nobody reaches the ceiling by accident, and no single week's grant can
    // buy it — so it is only reachable by trading well, which is the point.
    const chips = itemById("chips");
    const full = priceOf(chips, CHIPS_WEEKLY_MAX);
    assert.ok(full > GRANT_TOP,
        `the whole weekly allowance costs ${full}, under one top grant of ${GRANT_TOP}`);
    // And it must stay inside the balance cap, or it is unreachable at any rank.
    assert.ok(full <= CRED_BALANCE_CAP,
        `the maximum costs ${full}, which no student can ever hold`);
});

check("the weekly chips ceiling is enforced, and says WHICH problem you have", () => {
    const rich = who({ cred_balance: CRED_BALANCE_CAP });
    assert.equal(canBuy(rich, "chips", { units: 10, week: WEEK }).ok, true);

    const maxed = who({
        cred_balance: CRED_BALANCE_CAP,
        extra: { cred_chips_week: { week: WEEK, chips: CHIPS_WEEKLY_MAX } },
    });
    const v = canBuy(maxed, "chips", { units: 10, week: WEEK });
    assert.equal(v.ok, false);
    assert.match(v.reason, /this week/i, "a maxed student was told they are short, which is false");
    assert.ok(!/more cred/i.test(v.reason), "the ceiling was reported as a balance problem");

    // Partway through: it names what is left rather than refusing flatly.
    const partly = who({
        cred_balance: CRED_BALANCE_CAP,
        extra: { cred_chips_week: { week: WEEK, chips: CHIPS_WEEKLY_MAX - 5 } },
    });
    assert.match(canBuy(partly, "chips", { units: 20, week: WEEK }).reason, /5 more chips/);
    assert.equal(canBuy(partly, "chips", { units: 5, week: WEEK }).ok, true, "exactly the remainder is allowed");
});

check("LAST WEEK'S CONVERSION DOES NOT COUNT AGAINST THIS WEEK", () => {
    const stale = who({ extra: { cred_chips_week: { week: "2026-09-21", chips: CHIPS_WEEKLY_MAX } } });
    assert.equal(chipsConvertedThisWeek(stale, WEEK), 0);
    assert.equal(canBuy(stale, "chips", { units: 10, week: WEEK }).ok, true);
    // …and a missing or junk log is zero, not a crash and not a free pass.
    assert.equal(chipsConvertedThisWeek(who(), WEEK), 0);
    assert.equal(chipsConvertedThisWeek({ extra: { cred_chips_week: { week: WEEK, chips: "lots" } } }, WEEK), 0);
    assert.equal(chipsConvertedThisWeek(null, WEEK), 0);
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
    assert.deepEqual(first._effect, { type: "streak_freeze" });

    const holding = who({ extra: first.extra });
    assert.equal(canBuy(holding, "streak-freeze", { week: WEEK }).ok, false);
    assert.equal(purchasePatch(holding, "streak-freeze", { week: WEEK }), null);
});

check("the patch NAMES what the caller still has to do", () => {
    // A handler switching on the id is how a second entry of the same kind gets
    // forgotten. The effect is carried, not inferred.
    const chips = purchasePatch(who({ cred_balance: CRED_BALANCE_CAP }), "chips", { units: 20, week: WEEK });
    assert.deepEqual(chips._effect, { type: "grant_chips", chips: 20 });
    assert.equal(chips.extra.cred_chips_week.chips, 20);
    // Derived from the catalogue, never restated — a price written down
    // twice is the drift this codebase keeps having to fix.
    assert.equal(chips.cred_balance, CRED_BALANCE_CAP - priceOf(itemById("chips"), 20));

    const line = purchasePatch(who(), "open-line", { week: WEEK });
    assert.deepEqual(line._effect, { type: "open_market" });
    // A cosmetic has nothing further to do.
    assert.equal(purchasePatch(who(), "back-ink", { week: WEEK })._effect, null);
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
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/credStore.js"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    assert.ok(!/refund|sell|resell|cash.?out/i.test(code),
        "a refund path appeared — every price here assumes cred only moves one way");
});

check("zero and negative unit counts buy nothing", () => {
    const rich = who({ cred_balance: CRED_BALANCE_CAP });
    for (const u of [0, -5, 1.5, NaN, null, "ten"]) {
        const v = canBuy(rich, "chips", { units: u, week: WEEK });
        if (v.ok) assert.ok(priceOf(itemById("chips"), u) > 0, `units=${u} bought something for nothing`);
        else assert.equal(purchasePatch(rich, "chips", { units: u, week: WEEK }), null);
    }
    assert.equal(priceOf(itemById("chips"), 0), null);
    assert.equal(priceOf(null, 1), null);
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

check("XP SETS THE RATE AND IS NEVER SPENT", () => {
    // market.js: "XP drives level, rank and the ATAR, so staking it makes the
    // rational play 'never bet' — a market where abstaining is optimal is not a
    // market." A conversion would make spending cred cost rank and cost the
    // ATAR. This module may READ a rank tier and must never touch XP.
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/credStore.js"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    assert.ok(!/total_xp|xp_awarded|awardXP|deductXP|spend.*xp/i.test(code),
        "credStore reaches for XP — the grant is a RATE, and XP is never spent");
    // The only XP-shaped input is a tier number, which carries no balance.
    assert.equal(typeof grantForTier(7), "number");
});

console.log(`\ncredStore: ${passed} checks passed`);
