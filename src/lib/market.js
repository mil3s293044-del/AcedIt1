/**
 * market — ONE OBJECT, and everything competitive in AcedIt is an instance of it.
 *
 * ═══ Why the rebuild ════════════════════════════════════════════════════════
 * Compete had SEVEN nouns that all meant "a thing you can win": battles
 * (goal_competitions), duels (study_duels), call-outs, forecasts, progress
 * bets, back-yourself bets, and the weekly league. Seven mental models, seven
 * card shapes, 6,700 lines across 24 components and a 1,087-line page. A
 * student had to learn all seven before they could do anything, which is why
 * the page read as confusing no matter how it was styled. Restyling seven
 * objects gives you seven prettier objects.
 *
 * Polymarket's real lesson is not the look. It is that there is exactly ONE
 * object. A market: a question, a price, a side, a resolution. You learn it
 * once and every other thing on the site is a variant of it.
 *
 * So: a battle is a market on who wins it. A duel is a market with two
 * outcomes. A call-out is a market with a clock. A SAC is a market on a
 * number. Hours and streaks are markets on a study log. Same card, same
 * gesture, same settlement, everywhere.
 *
 * ═══ THE PRICE IS THE CROWD, AND BEATING IT IS THE GAME ═════════════════════
 * `forecast.js` scored you against the HOUSE's base rate with a proper scoring
 * rule. That was right and the maths is kept exactly — but a house number is
 * not a market. Here the base rate is only the PRIOR, and the thing you are
 * scored against is the price the crowd had reached when you took your side.
 *
 * That single change is what turns a forecast into a market:
 *   · the price now means something — it is what everyone else believes
 *   · beating it is the entire game, so early information is what pays
 *   · agreeing with it pays EXACTLY ZERO, so nothing is farmable by repetition
 *   · and no counterparty or liquidity is needed, which matters enormously at
 *     thirty active students: a real order book on this site would be empty.
 *
 * The rule stays proper — stating what you actually believe maximises your
 * expected return at every price — and `market.test.mjs` sweeps it to prove
 * that, exactly as the forecast tests did.
 *
 * ═══ K IS 1 AND THERE IS NO CLAMP ═══════════════════════════════════════════
 * Carried over from forecast.js, where it was learned the hard way: with the
 * loss floored, extra confidence past the floor is free and the rule becomes
 * improper in the tails. `skill` is already in [-1, 1], so at K = 1 the payout
 * is bounded by the stake without one.
 */

// ─── Scoring, carried over from forecast.js unchanged ───────────────────────

export const clampP = (p) => Math.min(1, Math.max(0, Number(p) || 0));

/** Squared error of a probability against what happened. */
export const brier = (p, outcome) => (clampP(p) - (outcome ? 1 : 0)) ** 2;

/**
 * How much better your call was than the price you took it at.
 *
 * Positive when you were closer to what happened than the market was.
 * EXACTLY ZERO when you simply agreed with the price — which is the property
 * that makes this unfarmable and the reason the price is worth reading.
 */
export const skill = (p, price, outcome) => brier(price, outcome) - brier(p, outcome);

export const PAYOUT_K = 1;

/** Signed return on a position. Bounded by ±stake, so escrow covers it. */
export function payoutFor(stake, p, price, outcome) {
    const s = Math.max(0, Math.round(Number(stake) || 0));
    if (!s) return 0;
    return Math.round(s * PAYOUT_K * skill(p, price, outcome));
}

// ─── The price ──────────────────────────────────────────────────────────────

/**
 * How heavily the house prior counts, in units of stake.
 *
 * WITHOUT THIS THE FIRST POSITION IS THE PRICE. One student putting 10 on YES
 * at 95% would move a market from the prior straight to 95¢, and the second
 * person to look would be reading one teenager's guess as though it were a
 * consensus — then being scored against it. The pseudo-stake means the prior
 * holds until real conviction accumulates, which is the honest reading of a
 * board this size.
 */
export const PRIOR_WEIGHT = 120;

/**
 * The market price: the prior, moved by what people have actually staked.
 *
 * A stake-weighted blend rather than an order book, because an order book
 * needs two-sided liquidity and this site has thirty active students — a real
 * book would sit empty and every market would read as broken. This always has
 * a price, always moves in the direction of conviction, and never needs
 * somebody on the other side for you to take a position.
 */
export function priceOf(market, positions = []) {
    const prior = clampP(market?.prior ?? market?.base_price ?? 0.5);
    let num = prior * PRIOR_WEIGHT;
    let den = PRIOR_WEIGHT;
    for (const pos of positions) {
        const stake = Math.max(0, Number(pos?.stake) || 0);
        if (!stake) continue;
        num += clampP(pos.p) * stake;
        den += stake;
    }
    return den > 0 ? clampP(num / den) : prior;
}

/** "71¢" — the price as a market prints it. */
export const priceLabel = (p) => `${Math.round(clampP(p) * 100)}¢`;

/** Which way the crowd is leaning, for a glyph that must agree with its colour. */
export function priceTone(price, prior) {
    const d = clampP(price) - clampP(prior);
    if (Math.abs(d) < 0.02) return "flat";
    return d > 0 ? "up" : "down";
}

// ─── Sides ──────────────────────────────────────────────────────────────────

export const YES = "yes";
export const NO = "no";

/**
 * A side plus a conviction is just a probability.
 *
 * The UI asks for a side and a strength because "how sure are you that YES"
 * is a question a sixteen-year-old can answer, and "state your probability" is
 * not. Underneath it is one number, which is what the scoring rule needs.
 * Conviction runs 0.5 (coin flip) to 0.97 — never 1, because a certainty
 * cannot be paid: it would be a free loss with no upside and the rule would
 * have nothing to score.
 */
export const CONVICTION_MIN = 0.5;
export const CONVICTION_MAX = 0.97;

export function probFor(side, conviction) {
    const c = Math.min(CONVICTION_MAX, Math.max(CONVICTION_MIN, Number(conviction) || CONVICTION_MIN));
    return side === NO ? 1 - c : c;
}

/**
 * WHERE THE SLIDER STARTS, AND WHY IT STARTS THERE.
 *
 * ─── The gesture used to be able to contradict itself ───────────────────────
 * A side and a strength are two controls over one number, so the two could
 * disagree: pick YES at 55% into a market already pricing yes at 80¢ and you
 * are FURTHER from yes than the price is — the rule pays you when NO lands.
 * That is correct arithmetic and it printed as a contradiction, so the panel
 * grew a paragraph explaining that the side you had just chosen was not the
 * side you were on, and where the line was, and what to do about it.
 *
 * A warning that explains a control is a control that needs replacing. The
 * range is what was wrong: conviction ran from the coin flip whatever the
 * price was, so half the track was, for that side, a position on the other
 * one.
 *
 * ─── So the track BEGINS at the room's price ────────────────────────────────
 * Pick a side and the slider's floor is what the room already pays for it.
 * Everything to the right of that floor is a genuine position on the side you
 * picked, and there is nowhere left to stand that is not. The inversion is not
 * warned about — IT CANNOT BE EXPRESSED. And the travel becomes the reading a
 * student actually needs: how far past the room you have dragged IS the gap
 * you get paid on, drawn as distance rather than printed as a subtraction.
 *
 * `floor` is the room's line or the coin flip, whichever is HIGHER. Under a
 * price of 50¢ a side is already better than even money, so the coin flip is
 * the real floor there and `atRoom` says which of the two it is — the label
 * under the track has to name the thing it is actually anchored to.
 *
 * `headroom` is what is left to win. A side the room has already priced past
 * `CONVICTION_MAX` has none: there is no call left to place on it, which is a
 * fact about the market and not an error, so it is REPORTED rather than
 * clamped into a one-pixel track that pays nothing.
 */
export function convictionRange(side, price) {
    const room = side === NO ? 1 - clampP(price) : clampP(price);
    const floor = Math.max(CONVICTION_MIN, Math.min(CONVICTION_MAX, room));
    return {
        floor,
        ceiling: CONVICTION_MAX,
        // Whether that floor IS the room's line, or merely the coin flip.
        atRoom: room > CONVICTION_MIN,
        room,
        headroom: Math.max(0, CONVICTION_MAX - floor),
        // Under about a point of travel there is no call to place: dragging
        // the whole track would move the price by less than it rounds to.
        tradeable: CONVICTION_MAX - floor >= 0.01,
    };
}

/**
 * Where the handle should sit when a side is picked, and where it must move to
 * when the side CHANGES.
 *
 * Switching sides moves the floor, so a conviction carried across unchanged
 * can land underneath the new one — which is the inversion coming back in
 * through the other door. Everything that sets conviction goes through here.
 *
 * The opening position is a third of the way up rather than at the floor: the
 * floor pays exactly nothing, and a panel that opens on a call worth zero has
 * to be dragged before it means anything at all.
 */
export function startingConviction(side, price, previous = null) {
    const { floor, ceiling, headroom } = convictionRange(side, price);
    if (previous !== null && Number.isFinite(previous) && previous > floor) {
        return Math.min(ceiling, previous);
    }
    return Math.min(ceiling, floor + headroom * 0.34);
}

/** The inverse, for drawing a position somebody already holds. */
export function sideOf(p) {
    return clampP(p) >= 0.5 ? YES : NO;
}
export function convictionOf(p) {
    const v = clampP(p);
    return v >= 0.5 ? v : 1 - v;
}

// ─── The multiplier ─────────────────────────────────────────────────────────

/**
 * THE MULTIPLIER IS WHAT COMES BACK. It used to be 1/price, and that was WRONG
 * BY UP TO TEN TIMES.
 *
 * The reasoning that shipped it: a multiplier is how a market prints what it
 * believes, "1.61× yes" says *the favourite* to somebody who has never met a
 * probability, and the payout tiles beside it carried the real cred. All true,
 * and all beside the point — the largest number on the card was a figure with
 * no relationship to money, sitting on a screen where every other number is
 * money. A longshot card printed **7.24×** when the most that position could
 * ever return was about **1.8×**.
 *
 * The honest multiple exists and it is simple. A position returns
 * `stake + payout`, and `payout = stake · K · skill`, so:
 *
 *     back / staked  =  1 + K · skill(p, price, outcome)
 *
 * The stake cancels. There IS a stake-free multiple; it just is not the odds.
 *
 * ─── THE 2× CEILING IS STRUCTURAL, not a setting ────────────────────────────
 * `skill` is bounded in [-1, 1], so at K = 1 the return is bounded in [0, 2].
 * Raising `PAYOUT_K` does not lift it: the escrow has to cover K · stake, so
 * the ratio against what you actually put up is unchanged. A proper scoring
 * rule whose downside is bounded by the stake CANNOT pay more than double.
 * Anything on this board printing more than 2.00× is unreachable by
 * construction, and `market.test.mjs` asserts that nothing can.
 *
 * The ordering survives, which is what made the old number plausible: the
 * underdog still pays more than the favourite, because the crowd being further
 * from the truth is exactly what the rule pays for. Only the magnitudes were
 * fiction. Returns genuinely live in a narrow 1.0–2.0× band, and printing that
 * narrowly is the price of printing something true.
 */

/** What comes back per cred staked. Stake-free, because the payout is linear. */
export function returnMultiple(p, price, outcome) {
    // Never negative: the stake is escrowed and the payout is bounded by it,
    // so the worst case is that nothing comes back, not that you owe.
    return Math.max(0, 1 + PAYOUT_K * skill(clampP(p), clampP(price), outcome));
}

/** The most any position can ever return. Bounded by the rule, not by choice. */
export const RETURN_CEILING = 1 + PAYOUT_K;

/**
 * The best a side can do at the strongest conviction the slider allows — and
 * what that same call risks, which is the other half of the sentence.
 *
 * `CONVICTION_MAX` rather than an average, because this is the CEILING the
 * card advertises and a ceiling has to be reachable: every figure here is a
 * call a student can actually place by dragging the slider to the end.
 */
export function bestReturn(price, side = YES) {
    const p = probFor(side, CONVICTION_MAX);
    const wins = side === YES;
    return {
        win: returnMultiple(p, price, wins),
        risk: returnMultiple(p, price, !wins),
    };
}

/** Both sides at once, which is how a board prints a price. */
export function returns(price) {
    const yes = bestReturn(price, YES);
    const no = bestReturn(price, NO);
    return {
        yes: yes.win, no: no.win,
        yesRisk: yes.risk, noRisk: no.risk,
        yesLabel: multiplierLabel(yes.win), noLabel: multiplierLabel(no.win),
    };
}

/**
 * Two decimals, always.
 *
 * The old ramp coarsened past 10× and rounded past 20×, which only ever
 * applied to figures that cannot occur — and inside a 1.00–2.00 band the
 * second decimal is the whole signal. `1.1×` and `1.4×` are the same glyph
 * count and a third of the information.
 */
export function multiplierLabel(m) {
    const v = Number(m);
    if (!Number.isFinite(v) || v < 0) return "—";
    return `${v.toFixed(2)}×`;
}

// ─── The tape ───────────────────────────────────────────────────────────────

const timeOf = (v) => {
    const t = new Date(v || 0).getTime();
    return Number.isFinite(t) && t > 0 ? t : null;
};

/**
 * THE PRICE HISTORY IS ALREADY RECORDED, so nothing here is stored.
 *
 * Every position carries its stake, its probability and the moment it was
 * taken, and `priceOf` is a pure function of the positions standing at the
 * time. Replaying them in order therefore reproduces the price path EXACTLY —
 * every step, with who caused it — without a snapshot table, a scheduler, or a
 * column that can drift away from the board it is meant to describe. The rule
 * `redoQueue` and `subjectHub` already follow: derived, so it cannot go stale,
 * double up, or disagree with the screen it came from.
 *
 * (It reproduces `price_at_entry` too, which is the check that this is a
 * reconstruction and not an approximation — market.test.mjs pins it.)
 *
 * IT IS A STEP FUNCTION AND IT IS DRAWN AS ONE. Polymarket's smooth curves are
 * a picture of continuous liquidity; this board has thirty active students, so
 * a market's whole week is three or four steps with flat stretches between
 * them. Smoothing that draws a line through data that is not there. The steps
 * are the better object anyway — a step knows WHO took it and by how much,
 * which is a sentence about a person rather than a curve.
 */
export function priceHistory(market, positions = null, now = Date.now()) {
    const held = positions || market?.positions || [];
    const prior = clampP(market?.prior ?? 0.5);
    const ordered = [...held]
        .filter((x) => x && Number(x.stake) > 0)
        .sort((a, b) => (timeOf(a.created_date) ?? 0) - (timeOf(b.created_date) ?? 0));

    const firstT = timeOf(ordered[0]?.created_date);
    const openT = timeOf(market?.opens_at) ?? timeOf(market?.created_date) ?? firstT ?? now;
    const endT = timeOf(market?.resolved_at)
        ?? (market?.status && market.status !== "open"
            ? (timeOf(market?.closes_at) ?? now)
            : now);

    const points = [{ t: openT, price: prior, kind: "open", delta: 0 }];
    const run = [];
    for (const pos of ordered) {
        run.push(pos);
        const price = priceOf(market, run);
        const prev = points[points.length - 1];
        points.push({
            // A clock skew must never run the tape backwards: a step landing
            // before the one before it draws as a line doubling back on itself.
            t: Math.max(prev.t, timeOf(pos.created_date) ?? prev.t),
            price,
            kind: "trade",
            delta: Math.round((price - prev.price) * 100),
            by: pos.user_name || null,
            is_me: !!pos.is_me,
            stake: Math.max(0, Number(pos.stake) || 0),
            p: clampP(pos.p),
            side: sideOf(pos.p),
        });
    }

    const last = points[points.length - 1];
    // The tape runs to the right edge. Without this a market nobody has
    // touched since Monday draws as a stub in the corner and reads as a chart
    // that failed to load rather than as a quiet market.
    if (endT > last.t) points.push({ t: endT, price: last.price, kind: "now", delta: 0 });

    const prices = points.map((x) => x.price);
    const span = points[points.length - 1].t - points[0].t;
    return {
        points,
        open: prior,
        last: last.price,
        high: Math.max(...prices),
        low: Math.min(...prices),
        // Against the PRIOR, because that is where this market started and it
        // is the one fixed point everybody in it entered against.
        change: Math.round((last.price - prior) * 100),
        trades: ordered.length,
        span: Math.max(1, span),
    };
}

// ─── Stakes ─────────────────────────────────────────────────────────────────

/**
 * Cred: the unit. Not XP and not the AI chips.
 *
 * XP is the progression currency — it drives level, rank and what a student
 * has built — so staking it means a bad week of calls visibly costs you rank,
 * and the rational play becomes never betting. A market where the safe move is
 * to abstain is not a market. And `chips.js` is already the weekly AI budget,
 * so reusing that word would conflate "can I afford to ask Ace" with "can I
 * afford a position".
 *
 * Cred is granted weekly and capped. The weekly grant is the retention hook —
 * a reason to come back on Monday that is not a streak — and the cap stops a
 * student who ignored Compete for a term arriving with an unanswerable stack.
 */
export const CRED_WEEKLY_GRANT = 1000;
export const CRED_BALANCE_CAP = 3000;
export const STAKE_MIN = 10;
export const STAKE_MAX = 500;

export const clampStake = (n) =>
    Math.min(STAKE_MAX, Math.max(STAKE_MIN, Math.round(Number(n) || 0)));

// ─── The kinds ──────────────────────────────────────────────────────────────

/**
 * Every kind is a template that MINTS markets and knows how to resolve itself
 * from rows the app already owns. `resolves` is prose for the card — a market
 * has to say where its answer will come from, or nobody can judge whether the
 * question is fair.
 *
 * `selfResolving` is the load-bearing flag. See `canTakePosition` below.
 */
export const KINDS = {
    streak: {
        id: "streak", label: "Streak", icon: "Flame",
        resolves: "from their study log, both tables",
        selfResolving: false,
    },
    hours: {
        id: "hours", label: "Hours", icon: "Clock",
        resolves: "from countable study minutes",
        selfResolving: false,
    },
    quiz: {
        id: "quiz", label: "Quiz", icon: "FileText",
        resolves: "from their first sit after this opened",
        selfResolving: false,
    },
    callout: {
        id: "callout", label: "Call-out", icon: "Megaphone",
        resolves: "when the call-out is answered",
        selfResolving: false,
    },
    battle: {
        id: "battle", label: "Battle", icon: "Trophy",
        resolves: "on the contest's own final standings",
        selfResolving: false,
    },
    // ─── THE SPECIAL LINES ──────────────────────────────────────────────
    // Four more QUESTIONS, not four more objects. Same card, same gesture,
    // same settlement — `kind` picks the glyph and the sentence and nothing
    // else, which is the line that keeps this from becoming the seven nouns
    // the rebuild deleted. What they buy is board SUPPLY: each one of these
    // stands where several solo markets used to, so the same thirty students
    // concentrate on fifteen questions instead of scattering over two hundred.
    versus: {
        id: "versus", label: "Head to head", icon: "Swords",
        resolves: "on the two study logs, side by side",
        selfResolving: false, featured: true,
    },
    cohort: {
        id: "cohort", label: "The board", icon: "Users",
        resolves: "from everybody's study log on Sunday night",
        // NOBODY IS BLOCKED, deliberately. A cohort line is resolved by the
        // app from the study tables, and one student cannot decide it — they
        // can only contribute to it by studying, which is the product working.
        // Exactly the reasoning that lets somebody back their own study log.
        selfResolving: false, featured: true,
    },
    longshot: {
        id: "longshot", label: "Longshot", icon: "Rocket",
        resolves: "from the board's study log",
        // The long price IS the draw, and it is safe to make one: the payout
        // is scored on your edge against the price, never on the odds, so a
        // 12× cannot be farmed by anybody who simply agrees it is unlikely.
        selfResolving: false, featured: true,
    },
    prep: {
        id: "prep", label: "Prep", icon: "CalendarClock",
        resolves: "from their study log in the lead-up",
        selfResolving: false, featured: true,
    },
    sac: {
        id: "sac", label: "SAC mark", icon: "GraduationCap",
        resolves: "on the mark they report",
        // ─── THE ONE KIND THE SUBJECT CONTROLS ──────────────────────────────
        selfResolving: true,
    },
};

export const KIND_LIST = Object.values(KINDS);

// ─── Who may take a position ────────────────────────────────────────────────

/**
 * YOU MAY NEVER HOLD A PAYING POSITION ON A MARKET YOU RESOLVE.
 *
 * This is the one rule the whole design rests on, and it is Polymarket's own.
 * The old wagering layer died because a student typed in their own SAC mark
 * and collected on it — set a line, submit, take 3×, no study required. Every
 * patch since has been a special case of this rule; stating it once, as a rule
 * about WHO rather than about which feature, closes the whole class:
 *
 *   · A SAC mark is reported by the student, so the student cannot back it.
 *     Their line is public and other people trade it — which is a better game
 *     anyway, because being read by twelve people is far more motivating than
 *     being paid for a number you typed yourself.
 *   · A call-out's caller and target decide its outcome — the target by how
 *     hard they try, the caller by whom they picked — so neither may hold.
 *   · A battle's own competitors decide the standings.
 *
 * A market on your own STUDY LOG is different and is deliberately allowed: the
 * app measures that itself, under the service role, with the integrity caps
 * on top. Betting that you will study five days and then studying five days is
 * not an exploit — it is the product working.
 *
 * Returns null when it is allowed, or the reason it is not.
 */
export function blockReason(market, email) {
    if (!market || !email) return "Sign in to take a side.";
    if (market.status && market.status !== "open") return "This one is already decided.";
    const me = String(email).toLowerCase();
    const is = (x) => String(x || "").toLowerCase() === me;

    const kind = KINDS[market.kind];
    if (kind?.selfResolving && is(market.subject_email)) {
        return "You report this mark, so you can't back it — but everyone else can.";
    }
    if (market.kind === "callout" && (is(market.caller_email) || is(market.subject_email))) {
        return "You're in this call-out. You decide how it goes, so you can't hold a side on it.";
    }
    if (market.kind === "battle" && (market.competitor_emails || []).some(is)) {
        return "You're competing in this one — you can't take a position on yourself.";
    }
    // A head-to-head is settled by the two logs in it, so neither of the two
    // may hold: the battle rule, stated about the PEOPLE rather than about the
    // feature, which is what made it general enough to cover a kind that did
    // not exist when it was written. `in_contest` is computed server-side
    // because the two emails never leave it — the card names them, the payload
    // does not, and a client cannot be trusted to enforce a rule about itself.
    if (market.kind === "versus" && market.in_contest) {
        return "You're one of the two in this one, so you can't hold a side on it.";
    }
    // cohort, longshot and prep fall through ON PURPOSE. Each is measured by
    // the app out of the study tables under the service role, and the only way
    // a student can push one is by studying — which is the outcome the whole
    // app exists to cause, not an exploit to close.
    return null;
}

export const canTakePosition = (market, email) => blockReason(market, email) === null;

// ─── Reading a market ───────────────────────────────────────────────────────

/**
 * Everything a card needs, derived. Nothing here is stored, so nothing here
 * can go stale or disagree with the rows it came from — the rule `redoQueue`
 * and `subjectHub` already follow.
 */
export function readMarket(market, positions = [], email = null) {
    const mine = positions.find((p) => String(p.user_email || "").toLowerCase()
        === String(email || "").toLowerCase()) || null;
    const price = priceOf(market, positions);
    const yes = positions.filter((p) => sideOf(p.p) === YES);
    const no = positions.filter((p) => sideOf(p.p) === NO);
    const volume = positions.reduce((s, p) => s + (Number(p.stake) || 0), 0);

    return {
        ...market,
        price,
        priceLabel: priceLabel(price),
        prior: clampP(market.prior ?? 0.5),
        tone: priceTone(price, market.prior ?? 0.5),
        positions,
        mine,
        // Counts, not just a price: a probability is the most abstract thing on
        // the page, and "8 backing yes, 3 backing no" is the same fact as a
        // number with people in it. OddsDots makes the same argument.
        yesCount: yes.length,
        noCount: no.length,
        volume,
        traders: positions.length,
        blocked: blockReason(market, email),
    };
}

/**
 * What a position is currently worth, if the market resolved the way it is
 * priced right now. Honest about being provisional: this is what the CROWD
 * implies, not a promise.
 */
export function markToMarket(position, price) {
    if (!position) return null;
    const stake = Math.max(0, Number(position.stake) || 0);
    const p = clampP(position.p);
    const yesReturn = payoutFor(stake, p, position.price_at_entry ?? price, true);
    const noReturn = payoutFor(stake, p, position.price_at_entry ?? price, false);
    // Expected value under the market's own current price.
    const ev = clampP(price) * yesReturn + (1 - clampP(price)) * noReturn;
    return { stake, ifYes: yesReturn, ifNo: noReturn, ev: Math.round(ev) };
}

// ─── Sorting the board ──────────────────────────────────────────────────────

export const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;

/**
 * HEAT, not recency.
 *
 * A board sorted by "newest" puts a market nobody has touched above one that
 * four people are arguing over, which is the opposite of what a front page is
 * for. Heat is conviction on the table plus a clock running out — the two
 * things that make a market worth opening now rather than later.
 *
 * A market ABOUT YOU always sorts first, whatever its heat. Twelve people
 * taking a position on whether you will fold this week is the single most
 * motivating thing this app can put on a screen, and burying it under a
 * livelier question about somebody else would be throwing that away.
 */
export function heatOf(market, now = Date.now()) {
    const closes = market.closes_at ? new Date(market.closes_at).getTime() : null;
    const left = Number.isFinite(closes) ? closes - now : null;
    const urgency = left != null && left > 0 && left <= CLOSING_SOON_MS
        ? 1 - left / CLOSING_SOON_MS
        : 0;
    const volume = Math.log1p(Number(market.volume) || 0);
    const crowd = Math.log1p(Number(market.traders) || 0) * 2;
    return volume + crowd + urgency * 6;
}

/**
 * FEATURED IS A HANDFUL OF QUESTIONS THE WHOLE ROOM CAN ARGUE ABOUT.
 *
 * A board of solo markets is a board of private facts: "will Maya study five
 * days" is a question about one person that maybe four people in the room have
 * a view on. The lines flagged `featured` are the opposite — a cohort total, a
 * rivalry, a longshot, a SAC on Friday — and every one of them is something
 * anybody can hold an opinion about without knowing the person. That is what
 * makes a market board feel busy at thirty students rather than at three
 * thousand: concentrate the traders, don't multiply the questions.
 *
 * A market ABOUT YOU is never featured here even when its kind is, because it
 * already sorts first on the board proper — featuring it too would print the
 * same card twice on one screen, which is the paper-cut this page has had
 * before.
 */
export function featuredOf(markets = [], email = null, limit = 4) {
    const me = String(email || "").toLowerCase();
    const pool = markets.filter((m) => KINDS[m.kind]?.featured
        && String(m.subject_email || "").toLowerCase() !== me
        && !m.subject_is_me
        && isOpen(m));
    const ranked = sortBoard(pool, email).slice(0, Math.max(0, limit));
    // AN EVEN NUMBER, because the strip is a two-column grid and three cards
    // leaves a hole beside the third — a gap in the middle of a short section
    // reads as a card that failed to render rather than as the end of a row.
    // Nothing is lost: whatever is trimmed falls through to the floor below,
    // which is a long grid where a ragged last row is simply how grids end.
    const even = ranked.length - (ranked.length % 2);
    // One featured card under its own heading is more furniture than content.
    return even >= 2 ? ranked.slice(0, even) : [];
}

/* ═══ ROOMS: a VIEW of one floor, never a floor of its own ══════════════════
 *
 * "Having all users is too much" is a real complaint and it has two causes,
 * only one of which is browsing.
 *
 * THE CAUSE IS SUPPLY. Minting makes one question per active student, paired
 * into head-to-heads — so 30 actives is ~18 markets, which is the design
 * target, and 130 actives is ~68, which is nearly four times it. That is the
 * "supply scales with the roster" failure this board was rebuilt to fix,
 * arriving the second time through GROWTH rather than through signups. At ~110
 * positions a week it puts under two traders on each question. `pickBoard` is
 * the fix; a room is the browsing.
 *
 * AND A ROOM IS A VIEW. Everybody trades the same market at the same price;
 * the room only decides which of them are listed. That keeps the property the
 * "friends are a sort and never a filter" rule below exists to protect —
 * five friends means five possible traders, and a question priced by five
 * teenagers is not priced — while still giving a student a floor they can read.
 * The rule was never about what may be SHOWN. It was about what may be PRICED.
 */

export const ROOMS = {
    // Everything. The floor as it has always been, and the default.
    all: { id: "all", label: "Everyone" },
    // Questions about people they know, and about themselves. The subject's
    // address never reaches the client, so this reads the server's own flags.
    friends: { id: "friends", label: "Friends" },
    // The questions that are about NOBODY in particular — the whole board's
    // week, and the longshot. Best value per row on the floor: one market,
    // everybody has a genuine view, and no names are involved at all.
    cohort: { id: "cohort", label: "Whole cohort" },
};

/** The kinds that are about the room rather than about a person. */
const COHORT_KINDS = new Set(["cohort", "longshot"]);

export const isAboutMe = (m, email) =>
    !!m?.subject_is_me
    || (!!email && String(m?.subject_email || "").toLowerCase() === String(email).toLowerCase());

/** Does this market belong in that room? `all` takes everything. */
export function inRoom(market, room = "all", email = null) {
    if (!market) return false;
    if (room === ROOMS.cohort.id) return COHORT_KINDS.has(market.kind);
    if (room === ROOMS.friends.id) {
        // Your own questions belong with your friends': the room is "people I
        // have a reason to care about", and the most motivating market on the
        // board is the one about you.
        return !!market.subject_is_friend || isAboutMe(market, email);
    }
    return true;
}

/**
 * Which rooms to OFFER, and how many each holds.
 *
 * A tab that is always empty teaches that the feature is broken, so a room is
 * offered only once it has something in it — a student with no friends yet
 * never sees a Friends tab rather than meeting an empty one on their first
 * visit. `all` is always offered, because it is the floor.
 */
export function roomsFor(markets = [], email = null) {
    const counts = {};
    for (const id of Object.keys(ROOMS)) {
        counts[id] = markets.filter((m) => inRoom(m, id, email)).length;
    }
    return {
        counts,
        rooms: Object.values(ROOMS).filter((r) => r.id === ROOMS.all.id || counts[r.id] > 0),
    };
}

/* ═══ HOW MANY QUESTIONS THE FLOOR SHOULD CARRY ════════════════════════════ */

/**
 * The target, which is about TRADERS and not about students.
 *
 * ~110 positions a week across the room, and a price only means something at
 * five to seven traders a question. That is fifteen to twenty questions, and
 * it does not change when the roster does — which is exactly why minting one
 * per student cannot be right at any size.
 */
export const BOARD_TARGET = 20;

/** How far from even a question may price and still be worth anybody's time. */
export const TRADEABLE_EDGE = 0.25;

const evenness = (m) => Math.abs((Number(m?.prior) || 0.5) - 0.5);

/**
 * WHICH QUESTIONS MAKE THE BOARD when more were minted than it should carry.
 *
 * Three rules, in order:
 *
 *  1. **The special lines always make it.** `cohort`, `longshot` and `prep` are
 *     few, and each is the best value per row on the floor — one market the
 *     whole room can hold a view on, or one that came off somebody's planner.
 *     Capping those to make space for a head-to-head is backwards.
 *  2. **An EVEN question beats a lopsided one.** A market priced at 90¢ pays
 *     nobody and teaches that the board is decoration — the same reasoning
 *     that makes `pairUpRoom` match on the base rate in the first place.
 *  3. **BUT THE BOARD ROTATES, or the same students own it every week.**
 *     Ranking on evenness alone would mean a student whose prior sits at 0.85
 *     never once sees a question about themselves, which is the single most
 *     motivating thing this board does. So the tradeable ones are rotated by
 *     the week before slicing: everybody surfaces, just not all at once.
 *
 * Pure and tested, because it decides who appears on a social board — the kind
 * of thing that is invisible until a student notices they are never on it.
 */
export function pickBoard(candidates = [], { target = BOARD_TARGET, weekKey = "", existing = 0 } = {}) {
    const rows = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    const special = rows.filter((m) => COHORT_KINDS.has(m.kind) || m.kind === "prep");
    const people = rows.filter((m) => !COHORT_KINDS.has(m.kind) && m.kind !== "prep");

    // What is already open counts against the target: the cap is on the BOARD,
    // not on one minting run, or a second visit doubles it.
    const room = Math.max(0, target - Math.max(0, existing) - special.length);
    if (room <= 0) return special;

    const tradeable = people.filter((m) => evenness(m) <= TRADEABLE_EDGE)
        .sort((a, b) => evenness(a) - evenness(b) || String(a.subject_email).localeCompare(String(b.subject_email)));
    const rest = people.filter((m) => evenness(m) > TRADEABLE_EDGE)
        .sort((a, b) => evenness(a) - evenness(b) || String(a.subject_email).localeCompare(String(b.subject_email)));

    // The rotation. A stable hash of the week, so the same week always picks
    // the same board — a floor that reshuffles between two page loads is a
    // floor nobody can come back to.
    const spin = tradeable.length > 0
        ? Math.abs(hashWeek(weekKey)) % tradeable.length
        : 0;
    const rotated = [...tradeable.slice(spin), ...tradeable.slice(0, spin)];

    return [...special, ...rotated, ...rest].slice(0, special.length + room);
}

/** A small stable hash, so the rotation is deterministic across processes. */
function hashWeek(key) {
    let h = 0;
    for (const ch of String(key || "")) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return h;
}

/**
 * FRIENDS ARE A SORT AND NEVER A FILTER, and the difference is the whole board.
 *
 * A friends-only board sounds like the obvious fix for a floor flooded with
 * strangers, and it makes the real problem strictly worse: if your board is
 * your five friends' questions, each of those questions has at most five
 * people who can trade it, and the price stops meaning anything. It is the
 * same arithmetic that rules out an order book here — thin markets need
 * CONCENTRATION, so the answer is fewer questions on one floor, not the same
 * questions split across a room per person. School would fragment it harder
 * still: two to five students each.
 *
 * So everybody trades one board, and knowing somebody moves their question up
 * it. `subject_is_friend` is computed server-side for the same reason
 * `in_contest` is — the subject's email is stripped from the payload for
 * everyone but its owner, so the client has nothing to match on.
 */
export function sortBoard(markets = [], email = null) {
    const me = String(email || "").toLowerCase();
    const aboutMe = (m) => String(m.subject_email || "").toLowerCase() === me
        || !!m.subject_is_me;
    const known = (m) => !!m.subject_is_friend;
    return [...markets].sort((a, b) => {
        if (aboutMe(a) !== aboutMe(b)) return aboutMe(a) ? -1 : 1;
        if (known(a) !== known(b)) return known(a) ? -1 : 1;
        return heatOf(b) - heatOf(a);
    });
}

/** A market with no clock has no place on a board sorted by one. */
export function isOpen(market, now = Date.now()) {
    if (!market || market.status !== "open") return false;
    const closes = market.closes_at ? new Date(market.closes_at).getTime() : null;
    if (closes != null && Number.isFinite(closes) && closes <= now) return false;
    return true;
}

// ─── Settlement ─────────────────────────────────────────────────────────────

/**
 * HOW MUCH BETTER YOU READ IT THAN THE ROOM, in points.
 *
 * The payout is a squared-error difference, which is the right thing to PAY on
 * and an impossible thing to explain. "You said 85, the room said 62, it
 * happened — you were 23 points closer" is the same finding in a sentence a
 * student can check by subtracting two numbers they can both see.
 *
 * Absolute error, not squared, precisely so it stays checkable. THE SIGN
 * CANNOT DISAGREE WITH THE PAYOUT: |a| < |b| exactly when a² < b², so a
 * positive edge is always a positive payout and the screen can never praise a
 * call that lost cred. A test pins that.
 */
export function edgePoints(p, price, outcome) {
    const o = outcome ? 1 : 0;
    const mine = Math.abs(clampP(p) - o);
    const room = Math.abs(clampP(price) - o);
    return Math.round((room - mine) * 100);
}

/**
 * What happened to YOUR position on a resolved market, or null.
 *
 * `kind` is four cases and not two, because the two extra ones are real and
 * both would read as a loss if they were collapsed:
 *
 *   won   — you were closer than the room and it paid.
 *   lost  — the room was closer.
 *   level — you agreed with the price. The rule pays EXACTLY zero for that by
 *           design, and a screen that drew it as a defeat would be teaching the
 *           wrong lesson about the one property the whole system rests on.
 *   void  — nothing was tested, so nobody was right. Stake back, whole.
 */
export function settlementOf(market, email) {
    if (!market || market.status === "open") return null;
    const me = String(email || "").toLowerCase();
    const mine = (market.positions || []).find(
        (p) => String(p.user_email || "").toLowerCase() === me || p.is_me);
    if (!mine || !mine.settled_at) return null;

    const voided = market.status === "void";
    const outcome = !!market.outcome;
    const payout = voided ? 0 : Math.round(Number(mine.payout) || 0);
    const stake = Math.max(0, Number(mine.stake) || 0);

    return {
        id: market.id,
        title: market.title,
        kind: voided ? "void" : payout > 0 ? "won" : payout < 0 ? "lost" : "level",
        outcome: voided ? null : outcome,
        side: sideOf(mine.p),
        said: Math.round(clampP(mine.p) * 100),
        room: Math.round(clampP(mine.price_at_entry) * 100),
        edge: voided ? 0 : edgePoints(mine.p, mine.price_at_entry, outcome),
        payout,
        stake,
        // What actually lands back in the balance. Never negative: the stake was
        // escrowed and the payout is bounded by it.
        returned: voided ? stake : Math.max(0, stake + payout),
    };
}

// ─── A MARK, AND THE LINE SOMEBODY CALLS ON IT ──────────────────────────────
//
// Imported by the server, never mirrored, for the reason the rest of this file
// is: the prior a line opens at decides what every trader is scored against,
// and a second copy of that arithmetic is a board that pays differently
// depending which half of the app computed it.

/**
 * A raw mark as a percentage, or null.
 *
 * SACs are out of 60, or 40, or 25 — the denominator is a fact about the
 * assessment and it is on the row. The market asks its question in PERCENT
 * because that is the only scale on which "will they clear 80" means the same
 * thing across two subjects, and because the room has to be able to read it.
 *
 * Null rather than zero when either half is missing. `Number(null) === 0` is
 * the trap this codebase keeps meeting, and here it would settle a market
 * against a mark nobody has entered — reporting a fail for a student who has
 * simply not typed their result in yet.
 */
export function markPercent(score, outOf) {
    const s = score === null || score === undefined || score === "" ? NaN : Number(score);
    const o = outOf === null || outOf === undefined || outOf === "" ? NaN : Number(outOf);
    if (!Number.isFinite(s) || !Number.isFinite(o) || o <= 0 || s < 0) return null;
    return Math.max(0, Math.min(100, Math.round((s / o) * 100)));
}

/**
 * How many past marks it takes before this board will price a line off them.
 *
 * The same refusal as `MARKET_MIN_OBS`, `TREND_MIN`, `CALIBRATION_MIN` and
 * `MIN_BASELINE_WEEKS`, each added after the same mistake: a prior computed
 * from two results is a coin flip wearing a number, and here it would be a
 * coin flip that every trader on the market is scored against.
 */
export const MARK_MIN_OBS = 3;

/**
 * WHERE A MARK LINE OPENS, GIVEN WHAT THE STUDENT HAS ACTUALLY SCORED.
 *
 * Every SAC line used to open at 0.5 whatever it said, which is the same hole
 * the activity gate closed on the weekly lines: "Will they score 95+?" from a
 * student averaging 58 opened at even money and paid whoever took no, on a
 * fact anybody with a calendar could see. A prior is not a formality — it is
 * the market's opening statement, and an obviously wrong one is free cred.
 *
 * Laplace-smoothed rather than the raw share, so four-from-four does not open
 * at 100¢ and leave nothing to trade, and so the number moves toward the
 * evidence at a rate the evidence can support. Clamped either side for the
 * same reason `PRIOR_WEIGHT` exists: an opening price nobody can profitably
 * disagree with is not a market.
 *
 * Under `MARK_MIN_OBS` marks it REFUSES and opens even, flagged `thin` so the
 * card can say the room is pricing this from nothing.
 */
export function priorForLine(pastPercents = [], line) {
    const target = Number(line);
    const seen = (Array.isArray(pastPercents) ? pastPercents : [])
        .map((v) => (v === null || v === undefined || v === "" ? NaN : Number(v)))
        .filter((v) => Number.isFinite(v));
    const average = seen.length
        ? Math.round(seen.reduce((a, b) => a + b, 0) / seen.length) : null;

    if (!Number.isFinite(target) || seen.length < MARK_MIN_OBS) {
        return { prior: 0.5, thin: true, seen: seen.length, average };
    }
    const hits = seen.filter((v) => v >= target).length;
    const smoothed = (hits + 1) / (seen.length + 2);
    return {
        prior: Math.max(0.12, Math.min(0.88, smoothed)),
        thin: false, seen: seen.length, average,
    };
}

/**
 * WHAT THE PERSON WHOSE MARK IT IS GETS OUT OF IT.
 *
 * They cannot hold a position — they report the result, which is the rule that
 * makes this safe to pay on at all — so the payoff has to be something other
 * than cred, and it already exists in the positions: the room read them, and
 * the tape says which way. "Six people backed you, nine faded you, you were
 * right" is a stronger sentence than any payout, and nothing about it is
 * farmable because no cred moves toward the subject in any branch.
 *
 * `called` is their own line, `room` is where the crowd left it, and `actual`
 * is the mark. The third number is the one that makes the other two mean
 * something, so a market with no mark reported yet returns `actual: null`
 * rather than a zero — see `markPercent`.
 */
export function selfLine(market) {
    if (!market || market.kind !== "sac") return null;
    const meta = market.meta || {};
    const target = Number(meta.target);
    if (!Number.isFinite(target)) return null;

    const positions = market.positions || [];
    const backed = positions.filter((x) => sideOf(x.p) === YES).length;
    const faded = positions.length - backed;
    const reported = meta.reported === null || meta.reported === undefined
        ? null : Number(meta.reported);
    const actual = Number.isFinite(reported) ? reported : null;

    return {
        id: market.id,
        title: market.title,
        subject: meta.subject || market.subject_name || null,
        called: Math.round(target),
        room: Math.round(priceOf(market, positions) * 100),
        actual,
        cleared: actual === null ? null : actual >= target,
        backed, faded,
        traders: positions.length,
        thin: !!meta.thin,
        status: market.status,
        // Whether the room agreed with them, which is the read they were
        // being given. Only meaningful once somebody has taken a side.
        roomBacked: positions.length ? backed > faded : null,
    };
}

/**
 * How well a student calls their OWN marks, over every line they have closed.
 *
 * The mirror of the calibration curve the book draws for their calls on other
 * people, and it refuses on the same grounds: a hit rate off two SACs is a
 * personality judgement made on a coin flip. Under `MARK_MIN_OBS` closed lines
 * it reports the count and nothing else.
 */
export function selfRecord(markets = [], email = null) {
    const me = String(email || "").toLowerCase();
    const lines = (Array.isArray(markets) ? markets : [])
        .filter((m) => m && m.kind === "sac" && m.status !== "open"
            && (m.subject_is_me || String(m.subject_email || "").toLowerCase() === me))
        .map(selfLine)
        .filter((l) => l && l.actual !== null);

    const cleared = lines.filter((l) => l.cleared).length;
    // How far out they were, in points, signed: positive means they beat their
    // own call. The average of that is the useful number — a student who
    // clears every line is not well calibrated, they are sandbagging.
    const misses = lines.map((l) => l.actual - l.called);
    const drift = misses.length
        ? Math.round(misses.reduce((a, b) => a + b, 0) / misses.length) : null;

    return {
        lines, closed: lines.length, cleared,
        enough: lines.length >= MARK_MIN_OBS,
        rate: lines.length ? cleared / lines.length : null,
        drift,
    };
}

const SETTLED_SEEN_KEY = "acedit.markets.settled.seen";

function seenSettlements() {
    try {
        const raw = localStorage.getItem(SETTLED_SEEN_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        // BLOCKED STORAGE COUNTS AS ALREADY-SEEN. Replaying somebody's loss at
        // them on every single page load is far worse than never showing it —
        // the rule the old SettlementReveal kept, and the reason it is stated
        // here rather than left to the component.
        return null;
    }
}

export function markSettlementsSeen(ids = []) {
    try {
        const s = seenSettlements() || new Set();
        ids.forEach((id) => id && s.add(id));
        localStorage.setItem(SETTLED_SEEN_KEY, JSON.stringify([...s].slice(-300)));
    } catch { /* the guard above already treats this as seen */ }
}

/**
 * Results this device has not shown yet, quietest FIRST.
 *
 * A Monday sweep can settle several at once, and a batch that opens on its
 * biggest number and trails off is an anticlimax — the same ordering
 * `AchievementUnlock` arrived at. Zero-payout and void results sort before the
 * ones with something at stake.
 */
export function unseenSettlements(markets = [], email = null) {
    const seen = seenSettlements();
    if (seen === null) return [];
    return markets
        // TWO KINDS OF RESULT, one seen-set. A position that paid out, and a
        // line of your own that the room has now been proved right or wrong
        // about — which is the only result the SUBJECT of a market ever gets,
        // because they may not hold a position on it. Without this the person
        // whose SAC the whole board was trading is the one person the floor
        // never tells anything.
        .map((m) => settlementOf(m, email) || calledOf(m, email))
        .filter((s) => s && !seen.has(s.id))
        .sort((a, b) => Math.abs(a.payout || 0) - Math.abs(b.payout || 0));
}

/**
 * YOUR OWN LINE, RESOLVED. The subject's half of a settlement.
 *
 * No cred in any branch and none is possible: the subject cannot hold a
 * position, which is the rule that makes a self-reported mark safe to pay
 * others on. What they get instead is the read — their call, the price the
 * room reached, the mark, and how the room split on them.
 *
 * `missed` is drawn in the CAUTION ink rather than the loss red wherever this
 * renders. The number on it is a real school result, and an app that prints a
 * sixteen-year-old's SAC mark in the same colour it uses for a lost bet has
 * started editorialising about their schooling.
 */
export function calledOf(market, email) {
    const line = selfLine(market);
    if (!line || market.status === "open" || line.actual === null) return null;
    const me = String(email || "").toLowerCase();
    const mine = market.subject_is_me
        || String(market.subject_email || "").toLowerCase() === me;
    if (!mine) return null;

    return {
        // Namespaced, so a subject result and a position result on one market
        // can never share a seen-key and silently swallow each other.
        id: `called:${market.id}`,
        kind: line.cleared ? "beat" : "missed",
        title: market.title,
        called: line.called,
        actual: line.actual,
        room: line.room,
        backed: line.backed,
        faded: line.faded,
        traders: line.traders,
        outcome: line.cleared,
        payout: 0,
    };
}
