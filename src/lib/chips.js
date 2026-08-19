/**
 * chips — one weekly stack, spent however the student likes.
 *
 * ─── What this replaces ─────────────────────────────────────────────────────
 * Two limits that were sized separately and contradicted each other. Per
 * feature daily counters (3 quizzes a day, 3 flashcard decks, 6 tools, 30 Ace
 * messages) and a weekly dollar ceiling. Priced against the real cost table,
 * maxing every daily cap for a week came to $7.11 against a $1.95 ceiling —
 * the counters permitted 3.6x what the money allowed. So:
 *
 *   A heavy student hit the money wall on day two and was locked out until
 *   Monday, having been told all week they had three quizzes a day. Nothing
 *   warned them, because the thing counting down was never the thing that
 *   stopped them.
 *
 *   A light student could not do a big Saturday session. Three flashcard decks
 *   and done, on maybe 15% of the week's budget, with five days of unusable
 *   allowance behind them.
 *
 * Neither limit was countable in a unit anybody could plan with. One was
 * invisible; the other measured the wrong thing.
 *
 * ─── The unit ───────────────────────────────────────────────────────────────
 * A thousand chips a week, which is the same money in a number a seventeen
 * year old can hold in their head. The app is a card table and chips are
 * literally the object you push around one, so the vocabulary was already
 * here and already right.
 *
 * ─── Why prices are fixed rather than metered ───────────────────────────────
 * Charging the exact measured cost of each call would mean nobody could know
 * what anything costs until after they had spent it, which is the same
 * invisibility this exists to end. So every action has a published price,
 * derived from its measured cost and then ROUNDED UP to a friendly tier.
 *
 * That rounding is deliberately in our favour: every action carries between 8%
 * and 40% headroom, so a student who spends their whole stack has cost us less
 * than the ceiling, never more. It also means the model behind a feature can be
 * retuned without the price visibly moving.
 *
 * The micro-dollar ledger in aiCost.js does not go away. It keeps recording
 * what things actually cost, and the server keeps the dollar ceiling as a hard
 * backstop behind the chip gate — belt and braces, so a mis-set price here can
 * never uncap real spend.
 */

import { PRICES, MICROS_PER_DOLLAR } from "./aiCost.js";

/** One week's allowance. Chosen so the cheapest action is 2 and the dearest 30. */
export const WEEKLY_CHIPS = 1000;

/**
 * The dollar ceiling a full stack corresponds to.
 *
 * Mirrors TIER_WEEKLY_CAP_MICROS on the server. $1.95 USD, budgeted at a
 * pessimistic 0.65 AUD/USD, is about $3.00 AUD — the top of the range the
 * business signed off on. If the server's ceiling moves, this moves with it or
 * the stack stops meaning what it says.
 */
export const WEEKLY_CAP_MICROS = 1_950_000;

/** What one chip is worth, for reconciling against the real ledger. */
export const MICROS_PER_CHIP = WEEKLY_CAP_MICROS / WEEKLY_CHIPS;

/**
 * Published prices.
 *
 * Derived from measured token shapes against the live price table, then
 * rounded up to the nearest tier. The comment on each line is what it actually
 * costs us, so the margin is visible to whoever edits this next rather than
 * being a number they have to go and rediscover.
 */
export const PRICE = {
    study_coach:      2,    // $0.0027 on Haiku  — 42% margin
    active_recall:    8,    // $0.0120           — 30%
    blurting:         8,    // $0.0141           — 11%
    ai_chat:          8,    // $0.0144           —  8%
    quiz_ai_mark:    10,    // $0.0165           — 18%
    mindmap_gaps:    15,    // $0.0240           — 22%
    ai_tool:         15,    // $0.0240           — 22%
    goal_ai_gen:     15,    // $0.0270           —  8%
    roadmap_ai_gen:  15,    // $0.0270           —  8%
    flashcard_ai_gen:25,    // $0.0435           — 12%
    quiz_ai_gen:     30,    // $0.0525           — 11%
};

/**
 * Anything not in the table.
 *
 * The dearest price rather than zero or a guess. A feature added without a
 * price should cost the student the most it plausibly could, not silently
 * cost them nothing — the same reasoning that makes an unpriced MODEL bill at
 * the dearest rate in aiCost.js.
 */
export const DEFAULT_PRICE = Math.max(...Object.values(PRICE));

/**
 * How much further a chip goes on Saver.
 *
 * Computed from the price table rather than typed, so it cannot drift if a
 * rate changes. Haiku against Sonnet measures at exactly 3x on both input and
 * output, which is why one number describes the whole saving.
 */
export function saverDivisor() {
    const std = PRICES["claude-sonnet-4-6"];
    const sav = PRICES["claude-haiku-4-5"];
    if (!std || !sav || !sav.out) return 1;
    return Math.max(1, Math.round(std.out / sav.out));
}

/**
 * What an action costs, for this student, right now.
 *
 * Saver divides and rounds UP, never below one chip: an action that is free is
 * an action somebody can run in a loop, and the floor is what keeps the burst
 * limiter meaningful. Ace is already on the cheap model, so Saver does not
 * discount him again — he would otherwise be billed a third of a price that
 * was already computed from Haiku.
 */
export const ALREADY_CHEAP = new Set(["study_coach"]);

export function priceOf(feature, tier = "standard") {
    const base = PRICE[feature] ?? DEFAULT_PRICE;
    if (tier !== "saver" || ALREADY_CHEAP.has(feature)) return base;
    return Math.max(1, Math.ceil(base / saverDivisor()));
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Chips spent this week, tolerating a profile written before 0033. */
export function chipsSpent(profile) {
    const direct = num(profile?.weekly_chips_spent);
    if (direct > 0) return direct;
    // Pre-migration rows only have the micro ledger. Converting it keeps the
    // meter honest on the first deploy rather than showing everyone a full
    // stack they have already partly spent.
    return Math.round(num(profile?.weekly_ai_cost_micros) / MICROS_PER_CHIP);
}

/** The whole picture, which is what every caller actually wants. */
export function stackOf(profile) {
    const spent = Math.max(0, chipsSpent(profile));
    const remaining = Math.max(0, WEEKLY_CHIPS - spent);
    return {
        spent,
        remaining,
        total: WEEKLY_CHIPS,
        pct: Math.min(100, Math.round((spent / WEEKLY_CHIPS) * 100)),
        empty: remaining <= 0,
    };
}

/**
 * The bottom of the stack, which only Ace may spend.
 *
 * A study app that goes completely silent on the Wednesday of exam week is a
 * study app that gets cancelled on the Thursday. Ace costs 2 chips and runs on
 * the cheap model, so thirty more conversations after everything else has
 * stopped costs about eight cents — comfortably inside the margin the rounded
 * prices already carry, and the dollar ceiling still sits behind it either way.
 *
 * It is a floor inside the one pool rather than a separate allowance, so the
 * student still has ONE number to think about. What changes at the floor is
 * which doors are open, not how many pools there are.
 */
export const ACE_RESERVE = 60;

/** What this particular feature may draw on. */
export function spendableFor(profile, feature) {
    const { remaining } = stackOf(profile);
    if (ALREADY_CHEAP.has(feature)) return remaining;
    return Math.max(0, remaining - ACE_RESERVE);
}

/** Can they afford this, and if not, what would help? */
export function canAfford(profile, feature, tier = "standard") {
    const remaining = spendableFor(profile, feature);
    const price = priceOf(feature, tier);
    if (remaining >= price) return { ok: true, price, remaining };

    // The useful part of a refusal is what to do about it. Saver is a real
    // answer here and a wall is not.
    const saverPrice = priceOf(feature, "saver");
    return {
        ok: false,
        price,
        remaining,
        saverWouldWork: tier !== "saver" && !ALREADY_CHEAP.has(feature) && remaining >= saverPrice,
        saverPrice,
    };
}

/** How many of one thing a stack buys. For the price list. */
export function affordable(feature, tier = "standard") {
    return Math.floor(WEEKLY_CHIPS / priceOf(feature, tier));
}

// ─── Warnings ───────────────────────────────────────────────────────────────

/** Offer Saver here. Early enough that switching still saves a useful amount. */
export const SAVER_AT = 0.70;
/** Say the stack is nearly gone. */
export const LOW_AT = 0.90;

/**
 * What to tell them, if anything.
 *
 * Returns null for most of the week, because a meter that talks constantly is
 * a meter people stop reading — which is exactly what went wrong with the due
 * count. Three states, each with something to actually do.
 */
export function stackWarning(profile, tier = "standard") {
    const { spent, remaining, pct, empty } = stackOf(profile);
    const used = spent / WEEKLY_CHIPS;

    if (empty) {
        return {
            level: "empty",
            title: "That is the week's stack",
            body: "It refills Monday. Everything that does not use AI carries on as normal.",
        };
    }
    // Inside the reserve: the generators have stopped but Ace has not, and
    // saying so is the difference between an app that looks broken and one
    // that looks like it is looking after you.
    if (remaining <= ACE_RESERVE) {
        return {
            level: "reserve",
            title: `${remaining} chips left, saved for Ace`,
            body: `That is about ${Math.floor(remaining / PRICE.study_coach)} more questions. The generators are done until Monday.`,
        };
    }
    if (used >= LOW_AT) {
        return {
            level: "low",
            title: `${remaining} chips left`,
            body: tier === "saver"
                ? "Enough for a few more. Refills Monday."
                : `Switching to Saver would make those go ${saverDivisor()}x further.`,
        };
    }
    if (used >= SAVER_AT && tier !== "saver") {
        return {
            level: "nudge",
            title: `${pct}% of this week's stack used`,
            body: `Saver makes what is left go ${saverDivisor()}x further, with shorter answers.`,
        };
    }
    return null;
}

/** Plain English for a price, used on buttons and hints. */
export function priceLabel(feature, tier = "standard") {
    const n = priceOf(feature, tier);
    return `${n} chip${n === 1 ? "" : "s"}`;
}
