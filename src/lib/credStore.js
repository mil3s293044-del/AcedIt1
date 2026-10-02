/**
 * credStore — what cred is worth, and the one place that decides.
 *
 * ─── CRED HAD NO SINK, SO IT STOPPED MEANING ANYTHING ───────────────────────
 * The grant was a flat 1000 a week, the cap 3000, and the only way out was a
 * bet. A student who trades well saturates at the cap in a fortnight and every
 * Monday grant after that is a number going up because a clock ticked — which
 * is the exact failure `PortfolioPanel`'s own header names about the cred
 * figure: "it moves for two unrelated reasons… a number that goes up when you
 * did nothing teaches that the number means nothing."
 *
 * A currency needs somewhere to go. This is that.
 *
 * ─── XP SETS THE RATE, NEVER THE BALANCE ────────────────────────────────────
 * The obvious wiring is XP → cred, and it breaks the one property the whole
 * board rests on. market.js states it: "XP drives level, rank and the ATAR, so
 * staking it makes the rational play 'never bet' — a market where abstaining is
 * optimal is not a market." A conversion makes spending cred cost XP, so it
 * costs rank and it costs the ATAR, and the rational play for anybody who cares
 * about Ranked becomes never to convert. It would also make a sixteen-year-old's
 * flagship study score spendable on bets.
 *
 * So rank moves the GRANT instead. Climb Ranked and more arrives each Monday;
 * nothing is ever deducted, abstaining is still never optimal, and the two
 * systems are visibly connected — which is what the wiring was for.
 *
 * ─── PRICES ARE IN WEEKS, NOT IN NUMBERS ────────────────────────────────────
 * Every price here is written as a multiple of a MID-TIER GRANT rather than as
 * a bare figure, because the only question that matters about a price is "how
 * long does this take to afford". A number typed directly goes stale the moment
 * a grant moves and nobody notices; a multiple cannot.
 *
 * ─── NOTHING HERE COSTS REAL MONEY, AND THAT IS NOW A PROPERTY ─────────────
 * There was one exception and it has been removed: a door converting cred into
 * AI chips. `chips.js` prices a week's stack at $1.95 of actual Anthropic
 * spend, so that door was a path from "won a market" to "the bill goes up" —
 * and a market on your own study log is allowed DELIBERATELY, so there was a
 * farm at the end of it. Bounded by the scoring rule, which pays ~nothing for
 * backing a near-certainty you control, and by a weekly micro-dollar ceiling.
 * Bounded is not zero, and it was the only thing on this shelf that could be
 * wrong in dollars rather than in pixels.
 *
 * With it gone the shelf is cosmetics, one consumable and one action — all
 * free to run, none of them reachable from a balance in either direction. THE
 * INVARIANT IS THAT NO PURCHASE HERE MOVES MONEY, and `credStore.test.mjs`
 * asserts it as an ABSENCE: no catalogue entry is per-unit, and nothing in this
 * module reaches toward `chips.js`. The day somebody adds a door back is the
 * day that stops being true, which is exactly when a test should say so.
 *
 * It leaves `extra.cred_chips_week` behind on any row that ever bought one.
 * Nothing reads it now. It is not cleaned up, for the reason the leaked
 * flashcard rows were not retagged: a migration to delete a key nobody reads
 * is risk with no payoff.
 */

/* ── The grant ───────────────────────────────────────────────────────────── */

/** Tier 1 gets this. Below the old flat 1000 on purpose — see `grantForTier`. */
export const GRANT_BASE = 700;
/** Tier 10 gets this. */
export const GRANT_TOP = 1800;
/** Rank tiers, as `xpSystem.jsx`'s XP_RANKS defines them. */
export const TIERS = 10;

/**
 * The Monday stack for a rank tier.
 *
 * Linear between base and top. Linear rather than exponential because the XP
 * curve is ALREADY exponential — tier 10 is 400,000 XP against tier 1's zero —
 * so compounding a curve on a curve would make the floor unplayable for
 * everyone below about tier 6, and the board needs its thirty traders far more
 * than it needs a steep reward.
 *
 * TIER 1 GETS LESS THAN THE OLD FLAT GRANT, and that is deliberate rather than
 * a punishment: a raise that costs nobody anything is not a reward, it is
 * inflation, and a currency whose floor and ceiling are the same number cannot
 * express a rank at all. 700 is still most of a week's trading.
 *
 * An unknown or junk tier gets the BASE, never the top — the same
 * unknown-denies-everything asymmetry `compliance.js` keeps, for the same
 * reason: guessing generously here hands the best rate to somebody who has not
 * earned it, and a student can only ever notice the generous mistake.
 */
export function grantForTier(tier) {
    const t = Number(tier);
    if (!Number.isFinite(t)) return GRANT_BASE;
    const clamped = Math.max(1, Math.min(TIERS, Math.floor(t)));
    const step = (GRANT_TOP - GRANT_BASE) / (TIERS - 1);
    return Math.round(GRANT_BASE + (clamped - 1) * step);
}

/** The middle of the ladder, which every price below is expressed against. */
export const MID_GRANT = grantForTier(5);

/**
 * Prices are ROUNDED TO 50, and that is not cosmetic.
 *
 * Expressed as a multiple of a computed grant, the first draft priced things at
 * 713, 951, 1427 and 2378 — arithmetic showing its working on a shelf. A price
 * is a thing somebody holds in their head while deciding, and nobody holds 713.
 * Rounding keeps the multiple readable as "about half a week" AND the number
 * readable as a number, and it means a grant change moves prices in steps
 * rather than to a new set of odd figures.
 */
const shelfPrice = (weeks) => Math.round((MID_GRANT * weeks) / 50) * 50;

/* ── What cred buys ──────────────────────────────────────────────────────── */

/**
 * The catalogue.
 *
 * `kind` decides what BUYING means, and nothing else branches on the id:
 *   cosmetic  — owned forever, bought once, `extra.cred_owned` remembers it
 *   utility   — a consumable the app spends on the student's behalf
 *   market    — buys an action rather than an object
 *
 * Prices are multiples of `MID_GRANT`, so they are readable as "about half a
 * week" rather than as a number nobody can calibrate.
 */
export const CATALOGUE = [
    // ── Cosmetics. Free to run, impossible to farm into anything, and the
    //    best kind of flex: visible to the room and provably won.
    {
        id: "back-felt", kind: "cosmetic", slot: "back",
        name: "Felt back", blurb: "The green table, on the back of every card you deal.",
        price: shelfPrice(0.6),
    },
    {
        id: "back-ink", kind: "cosmetic", slot: "back",
        name: "Ink back", blurb: "Near-black with a hairline rule. Quiet, and it reads at 55px.",
        price: shelfPrice(0.6),
    },
    {
        id: "back-gilt", kind: "cosmetic", slot: "back",
        name: "Gilt back", blurb: "Warm gold. Costs a fortnight and looks like it.",
        price: shelfPrice(2),
    },
    {
        id: "crest-ring", kind: "cosmetic", slot: "crest",
        name: "Crest ring", blurb: "A ring around your name wherever the tape prints it.",
        price: shelfPrice(1.2),
    },

    // ── Utility. No dollar cost, and it reaches OUT of Compete into the
    //    systems a student actually cares about, which is the entwining.
    {
        id: "streak-freeze", kind: "utility", effect: "streak_freeze",
        name: "Streak freeze", blurb: "Holds your streak through one missed day. Spent automatically.",
        price: shelfPrice(0.8),
        // HELD ONE AT A TIME. A stockpile turns a streak into a subscription
        // and the streak stops measuring anything — the same reason the daily
        // XP cap exists. One is insurance; five is an exemption.
        stackMax: 1,
    },

    // ── Agency rather than an object.
    {
        id: "open-line", kind: "market", effect: "open_market",
        name: "Open a line", blurb: "Put a question of your own on the board for the week.",
        price: shelfPrice(1.5),
    },
];

/** One catalogue entry by id, or null. Never throws on an unknown id. */
export function itemById(id) {
    return CATALOGUE.find((i) => i.id === String(id || "")) || null;
}

/* ── Owning and spending ─────────────────────────────────────────────────── */

const ownedList = (profile) => {
    const v = profile?.extra?.cred_owned;
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
};

/** Does this student already own that cosmetic? */
export function owns(profile, id) {
    return ownedList(profile).includes(String(id || ""));
}

/** How many of a consumable they hold. */
export function heldCount(profile, id) {
    const n = Number(profile?.extra?.cred_held?.[String(id || "")]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * What one purchase costs, in cred.
 *
 * Returns null for anything unbuyable rather than 0 — a zero price would read
 * as free at every call site that checks affordability with a comparison.
 *
 * It took a `units` multiplier for the chips door and lost it with the door.
 * A generic mechanism with no user is the half-wired shape this file's own
 * neighbours keep recording, and re-adding one multiplication is cheaper than
 * carrying a branch nothing exercises.
 */
export function priceOf(item) {
    if (!item) return null;
    const n = Number(item.price);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * May this student buy this, right now? One answer, with a REASON.
 *
 * The reason is not decoration: a disabled button that does not say why is the
 * paper-cut this codebase already records about Active Recall's generate, and
 * every refusal here has a different fix — earn more, you already own it, wait
 * until Monday. Returns `{ ok, reason, cost }`.
 */
export function canBuy(profile, id) {
    const item = itemById(id);
    if (!item) return { ok: false, reason: "That is not something you can buy.", cost: null };

    const balance = Math.max(0, Number(profile?.cred_balance) || 0);

    if (item.kind === "cosmetic" && owns(profile, item.id)) {
        return { ok: false, reason: "You already own this.", cost: null };
    }
    if (item.kind === "utility" && heldCount(profile, item.id) >= (item.stackMax ?? 1)) {
        return { ok: false, reason: "You are already holding one. Use it before buying another.", cost: null };
    }

    const cost = priceOf(item);
    if (cost === null) return { ok: false, reason: "That is not something you can buy.", cost: null };
    if (balance < cost) {
        return { ok: false, reason: `You need ${cost - balance} more cred.`, cost };
    }
    return { ok: true, reason: null, cost };
}

/**
 * The profile patch a successful purchase makes. PURE, and it does not write.
 *
 * Split from the handler for the reason `expiredKeys` and `pageIndices` are
 * pure: this spends somebody's balance and grants them a thing, and a decision
 * like that inside an async handler cannot be checked until it has already
 * taken the cred. Returns null when the purchase is not allowed, so a caller
 * that skips `canBuy` still cannot spend.
 *
 * NOTHING HERE IS REFUNDABLE, and that is what keeps it safe: with no sell-back
 * there is no arbitrage, no laundering a cosmetic into chips, and no path from
 * an owned object to a balance.
 */
export function purchasePatch(profile, id) {
    const verdict = canBuy(profile, id);
    if (!verdict.ok) return null;
    const item = itemById(id);
    const extra = { ...(profile?.extra || {}) };

    if (item.kind === "cosmetic") {
        extra.cred_owned = [...ownedList(profile), item.id];
    } else if (item.kind === "utility") {
        extra.cred_held = { ...(extra.cred_held || {}), [item.id]: heldCount(profile, item.id) + 1 };
    }

    return {
        cred_balance: Math.max(0, (Number(profile?.cred_balance) || 0) - verdict.cost),
        extra,
        // What the caller still has to do, named rather than inferred from the
        // id — a handler switching on a string is how a second catalogue entry
        // of the same kind gets forgotten.
        _effect: item.effect ? { type: item.effect } : null,
    };
}

/** The cosmetic currently equipped in a slot, or null. Only ever one per slot. */
export function equipped(profile, slot) {
    const v = profile?.extra?.cred_equipped?.[String(slot || "")];
    return typeof v === "string" && owns(profile, v) ? v : null;
}

export default {
    GRANT_BASE, GRANT_TOP, TIERS, MID_GRANT,
    CATALOGUE, grantForTier, itemById, owns, heldCount,
    priceOf, canBuy, purchasePatch, equipped,
};
