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
    assert.deepEqual(first._effect, { type: "streak_freeze" });

    const holding = who({ extra: first.extra });
    assert.equal(canBuy(holding, "streak-freeze", { week: WEEK }).ok, false);
    assert.equal(purchasePatch(holding, "streak-freeze", { week: WEEK }), null);
});

check("the patch NAMES what the caller still has to do", () => {
    // Named rather than inferred from the id: a handler switching on a string
    // is how a second catalogue entry of the same kind gets forgotten.
    const freeze = purchasePatch(who({ cred_balance: CRED_BALANCE_CAP }), "streak-freeze");
    assert.deepEqual(freeze._effect, { type: "streak_freeze" });

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

check("XP SETS THE RATE AND IS NEVER SPENT", () => {
    // market.js: "XP drives level, rank and the ATAR, so staking it makes the
    // rational play 'never bet' — a market where abstaining is optimal is not a
    // market." A conversion would make spending cred cost rank and cost the
    // ATAR. This module may READ a rank tier and must never touch XP.
    const code = withoutComments(
        fs.readFileSync(path.join(process.cwd(), "src/lib/credStore.js"), "utf8"));
    assert.ok(!/total_xp|xp_awarded|awardXP|deductXP|spend.*xp/i.test(code),
        "credStore reaches for XP — the grant is a RATE, and XP is never spent");
    // The only XP-shaped input is a tier number, which carries no balance.
    assert.equal(typeof grantForTier(7), "number");
});

console.log(`\ncredStore: ${passed} checks passed`);
