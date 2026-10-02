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

// RELATIVE AND WITH ITS EXTENSION. `server.mjs` imports this module and node
// resolves neither an `@/` alias nor an extensionless path — the trap that
// crashed two deploys with a green build behind them. `serverBoot.test.mjs`
// walks the graph so it cannot come back.
import { CRED_BALANCE_CAP } from "./market.js";

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

/* ── THE LEAGUE PAYS THE GRANT, and the rank tier is only the fallback ──────
 *
 * The grant used to read the all-time rank tier, which made Monday's credits a
 * STATUS: a number that follows from how much XP you have ever earned, moving a
 * few times a year. `settleLeagueGroup` meanwhile computed a finish position
 * every week and granted NOTHING with it — the league decided a promotion and
 * then had no consequence a student could spend.
 *
 * So the week's finish sets the week's credits. Three things fall out:
 *
 *   - the league is worth playing, because its result is the one input to the
 *     only currency on the floor;
 *   - credits become a RESULT rather than a status, so a bronze student who
 *     wins their group out-earns a diamond student who coasted — which is the
 *     whole argument for a league in the first place;
 *   - rank keeps its own job (the ladder on Ranked) instead of doing two.
 *
 * `tierIndex` is a NUMBER rather than a tier name, deliberately: `server.mjs`
 * owns `LEAGUE_TIERS` and a second copy of that list here is the mirror this
 * codebase keeps deleting. The caller maps the name to its index.
 */

/** How many league tiers the grant spreads across. Mirrors `LEAGUE_TIERS.length`
 *  in server.mjs by COUNT only — the names live there and are not copied, which
 *  is why this function takes an INDEX rather than a tier name. */
export const LEAGUE_BANDS = 6;

/* FINISH OUTWEIGHS TIER, and that is the whole point of moving the grant here.
 *
 * Split the range so that placing well is worth more than sitting high: a
 * bronze student who WINS their group (1400) out-earns a master student who
 * came last (1100). If the tier dominated, the grant would still be a status —
 * it would just be a slower-moving one, and the league would still not be worth
 * playing on any week you were already safe.
 *
 * The two weights SUM to the range, so the floor and the ceiling are exactly
 * GRANT_BASE and GRANT_TOP by construction rather than by a clamp. */
export const TIER_WEIGHT = 400;
export const FINISH_WEIGHT = (GRANT_TOP - GRANT_BASE) - TIER_WEIGHT;

/**
 * What a week in the league pays.
 *
 * An unplaced or unknown finish scores NO finish share — the bottom of its
 * tier's band rather than the middle, the same unknown-denies-everything
 * asymmetry `compliance.js` keeps. A student with no league at all falls
 * through to `grantForTier` at the call site, because granting the floor to
 * somebody the league has not placed yet would make their first week on the
 * floor unplayable.
 */
export function grantForLeague({ tierIndex, position, groupSize = 30, tiered = true } = {}) {
    const size = Math.max(1, Math.floor(Number(groupSize) || 30));
    const pos = Math.floor(Number(position));
    const finishShare = (!Number.isFinite(pos) || pos < 1) ? 0
        : (size === 1 ? 1 : (size - Math.min(size, pos)) / (size - 1));

    // ── WITH NO TIERS, FINISH TAKES THE WHOLE RANGE ───────────────────────
    // The league runs in GLOBAL mode under 100 actives: one group, everybody
    // in it, and `tier` on every membership is the same value. Splitting the
    // range into a tier weight and a finish weight then leaves 400 points
    // permanently unreachable — the top of the board earned 1400 against a
    // documented ceiling of 1800, which is this file's own "a number nobody
    // can reach" failure, shipped by me one release ago.
    //
    // There is only one thing to rank on while there are no tiers, so it is
    // worth the whole band. When the league flips to tiered the split returns
    // and nothing else moves.
    if (!tiered) {
        return Math.round(GRANT_BASE + finishShare * (GRANT_TOP - GRANT_BASE));
    }

    const ti = Number(tierIndex);
    const tier = Number.isFinite(ti) ? Math.max(0, Math.min(LEAGUE_BANDS - 1, Math.floor(ti))) : 0;
    const tierShare = LEAGUE_BANDS === 1 ? 0 : tier / (LEAGUE_BANDS - 1);

    return Math.round(GRANT_BASE + tierShare * TIER_WEIGHT + finishShare * FINISH_WEIGHT);
}

/* ── XP CONVERTS, AND `total_xp` IS NEVER DEBITED ───────────────────────────
 *
 * "XP should be able to be transferred into credits, but it shouldn't affect
 * the ATAR at all." It cannot, and the reason is structural rather than
 * careful: `computeAcedItATAR` is computed from the `xp_events` LOG — which
 * events happened, on which days, in which subjects — and never from the
 * `total_xp` column. `total_xp` drives level and rank tier and nothing else.
 *
 * So there are two ways to build this and only one of them is safe:
 *
 *   DEBIT total_xp   the ATAR still would not move, but LEVEL and RANK would
 *                    fall — a student who converts drops down the Ranked
 *                    ladder, which makes never-converting the rational play and
 *                    is the exact failure `market.js` refuses about staking XP.
 *                    server.mjs:2971 already guards against it in its own
 *                    words: "total_xp is STRICTLY ADDITIVE".
 *
 *   NEVER DEBIT      a separate ledger records what has been converted, and
 *                    what remains convertible is earned minus converted. The
 *                    ATAR cannot see it, level cannot see it, rank cannot see
 *                    it. The cost is a BUDGET rather than a loss: each point of
 *                    XP you earn can be converted once, ever.
 *
 * The second one. Nothing a student does on the floor can cost them a mark, a
 * level or a place on the ladder, which is the property the whole board rests
 * on, extended to the one place it had not reached.
 *
 * ─── THE WEEKLY CAP IS WHAT STOPS THIS EATING THE LEAGUE ────────────────────
 * Without it a student with a term of XP banked arrives on Monday with more
 * credits than winning their group could ever pay, and `grantForLeague` above
 * stops mattering the day this ships. The cap is deliberately well under the
 * league's own spread (GRANT_TOP − GRANT_BASE), so converting SUPPLEMENTS a
 * week's finish and can never replace it.
 */

/** XP per credit. Earned XP is plentiful and credits are weekly, so the rate is
 *  coarse on purpose — a fine rate would print a figure nobody can hold. */
export const XP_PER_CREDIT = 4;

/** The most credits one week of converting may produce. UNDER the league's own
 *  spread, so a good week on the board always beats a stockpile of XP. */
export const WEEKLY_CONVERT_MAX = 500;

/** Lifetime XP already converted. Week-agnostic: this one is a BUDGET, not a
 *  rate, so it accumulates forever and is never reset. */
export function convertedTotal(profile) {
    const n = Number(profile?.extra?.xp_converted);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Credits converted THIS week, keyed on the same week string the grant uses. */
export function convertedThisWeek(profile, week) {
    const rec = profile?.extra?.xp_converted_week;
    if (!rec || rec.week !== week) return 0;
    const n = Number(rec.credits);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** XP this student has earned and not yet spent on credits. Never negative, and
 *  never reads a balance that could have been reduced — see the header. */
export function convertibleXP(profile) {
    const earned = Number(profile?.total_xp);
    if (!Number.isFinite(earned) || earned <= 0) return 0;
    return Math.max(0, Math.floor(earned) - convertedTotal(profile));
}

/** What converting `xp` would yield, and what is left in this week's ceiling. */
export function convertQuote(profile, xp, week) {
    const want = Math.floor(Number(xp));
    const budget = convertibleXP(profile);
    const roomThisWeek = Math.max(0, WEEKLY_CONVERT_MAX - convertedThisWeek(profile, week));

    if (!Number.isFinite(want) || want <= 0) {
        return { ok: false, reason: "Pick how much XP to convert.", xp: 0, credits: 0, roomThisWeek };
    }
    if (want > budget) {
        return { ok: false, reason: `You have ${budget.toLocaleString()} XP left to convert.`,
            xp: 0, credits: 0, roomThisWeek };
    }
    // ── TWO CEILINGS, AND THE ANSWER IS THE TIGHTER ONE ───────────────────
    // There is a weekly conversion cap and a balance cap, and checking them in
    // sequence reports whichever happens to be tested first rather than
    // whichever actually binds. A student with 10 credits of room was told
    // "you can convert 500 more this week" — so they drag the slider to 500,
    // try again, and are refused by a limit nobody had mentioned.
    //
    // ONE ceiling, and the message NAMES the half that is binding, because
    // "wait until Monday" and "spend something" are different fixes and a
    // student handed the wrong one cannot act on it.
    const held = Math.max(0, Number(profile?.cred_balance) || 0);
    const roomInBalance = Math.max(0, CRED_BALANCE_CAP - held);
    const ceiling = Math.min(roomThisWeek, roomInBalance);

    if (roomInBalance <= 0) {
        return { ok: false, reason: "Your balance is full. Spend some before converting more.",
            xp: 0, credits: 0, roomThisWeek };
    }
    if (roomThisWeek <= 0) {
        return { ok: false, reason: "You have converted all you can this week. It resets Monday.",
            xp: 0, credits: 0, roomThisWeek };
    }

    const credits = Math.floor(want / XP_PER_CREDIT);
    if (credits <= 0) {
        return { ok: false, reason: `${XP_PER_CREDIT} XP makes 1 credit.`, xp: 0, credits: 0, roomThisWeek };
    }
    // AN OVERFLOW IS REFUSED, never clamped. Clamping would spend XP out of a
    // budget that only ever spends once and hand back credits the cap threw
    // away — destroying the one thing this is meant to be careful with,
    // silently, at the moment the student has the most of it.
    if (credits > ceiling) {
        return {
            ok: false,
            reason: roomInBalance < roomThisWeek
                ? `You have room for ${ceiling.toLocaleString()} more credits.`
                : `You can convert ${ceiling.toLocaleString()} more credits this week.`,
            xp: 0, credits: 0, roomThisWeek,
        };
    }
    // Only the XP that actually BOUGHT a credit is spent from the budget. The
    // remainder of an uneven amount is left behind rather than quietly burnt.
    return { ok: true, reason: null, xp: credits * XP_PER_CREDIT, credits, roomThisWeek };
}

/**
 * The profile patch a conversion makes. PURE, and it does not write.
 *
 * `total_xp` IS ABSENT FROM THE RETURN, and that is the whole guarantee. The
 * test asserts the key never appears, because a patch that carried it would
 * move a student's level and rank without anything on screen saying so.
 */
export function convertPatch(profile, xp, week) {
    const quote = convertQuote(profile, xp, week);
    if (!quote.ok) return null;
    const extra = { ...(profile?.extra || {}) };
    extra.xp_converted = convertedTotal(profile) + quote.xp;
    extra.xp_converted_week = { week, credits: convertedThisWeek(profile, week) + quote.credits };
    return {
        // `convertQuote` has already refused anything that would not fit, so
        // this is addition rather than a clamp — and the test holds that.
        cred_balance: Math.max(0, Number(profile?.cred_balance) || 0) + quote.credits,
        extra,
        _converted: quote,
    };
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
    {
        id: "crest-bolt", kind: "cosmetic", slot: "crest",
        name: "Bolt crest", blurb: "A mark beside your name on every board you appear on.",
        price: shelfPrice(1.2),
    },
    {
        id: "crest-laurel", kind: "cosmetic", slot: "crest",
        name: "Laurel crest", blurb: "For somebody who has won something. Costs like it.",
        price: shelfPrice(2.4),
    },

    // ── Utility. No dollar cost, and it reaches OUT of Compete into the
    //    systems a student actually cares about, which is the entwining.
    {
        // THE FREEZE GRANTS THE COLUMN THAT ALREADY EXISTS. `user_profiles`
        // has carried `streak_shields` since migration 0020, `updateStreak`
        // already spends one to cover a slipped day, and the Dashboard already
        // draws how many you hold. So this was a SECOND freeze sitting beside a
        // working one, stored in `extra.cred_held` where nothing would ever
        // look. It increments the real column now — one mechanism, which is
        // this codebase's rule everywhere else.
        id: "streak-freeze", kind: "utility", effect: "streak_shield",
        name: "Streak shield", blurb: "Covers one missed day. Spent for you the moment it saves a streak.",
        price: shelfPrice(0.8),
        // HELD ONE AT A TIME. A stockpile turns a streak into a subscription
        // and the streak stops measuring anything — the same reason the daily
        // XP cap exists. One is insurance; five is an exemption.
        stackMax: 1,
        column: "streak_shields",
    },

    // ── PRANKS ARE NOT IN THIS CATALOGUE, deliberately. Everything here is
    //    bought through `purchasePatch`, which charges and records ownership
    //    in one write — and a prank is not OWNED, it is SENT, so it needs a
    //    recipient before it means anything. Listed here it would be buyable
    //    through the generic path: charged, written into `cred_owned`, and
    //    delivered to nobody. That is precisely the bug the rest of this
    //    release exists to fix, re-introduced one file over.
    //
    //    They live in `pranks.js` with their own prices and their own gesture,
    //    and `sendPrank` is the only thing that can charge for one.

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
