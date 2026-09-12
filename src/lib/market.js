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

/** The inverse, for drawing a position somebody already holds. */
export function sideOf(p) {
    return clampP(p) >= 0.5 ? YES : NO;
}
export function convictionOf(p) {
    const v = clampP(p);
    return v >= 0.5 ? v : 1 - v;
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
        id: "callout", label: "Call-out", icon: "Swords",
        resolves: "when the call-out is answered",
        selfResolving: false,
    },
    battle: {
        id: "battle", label: "Head to head", icon: "Trophy",
        resolves: "on the contest's own final standings",
        selfResolving: false,
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

export function sortBoard(markets = [], email = null) {
    const me = String(email || "").toLowerCase();
    const aboutMe = (m) => String(m.subject_email || "").toLowerCase() === me;
    return [...markets].sort((a, b) => {
        if (aboutMe(a) !== aboutMe(b)) return aboutMe(a) ? -1 : 1;
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
        .map((m) => settlementOf(m, email))
        .filter((s) => s && !seen.has(s.id))
        .sort((a, b) => Math.abs(a.payout) - Math.abs(b.payout));
}
