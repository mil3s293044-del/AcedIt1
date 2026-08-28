/**
 * portfolio — the whole book, not one battle.
 *
 * The Compete page could tell you how one race was going and left you to hold
 * the rest in your head. A student in three battles has a position, and the
 * question they open the app with is "am I winning, overall, and has that
 * changed since I looked?" — which is a portfolio question, and the one number
 * a market puts at the top of the screen.
 *
 * Everything here derives from the per-battle `market` series (oddsSeries),
 * so nothing new is measured and nothing is invented. Where a battle has no
 * trail yet it is left out of the aggregate rather than counted as a coin
 * flip: a book of two real positions is honest, a book of two real positions
 * and a guess is not.
 *
 * Weighting is by XP at stake. An even average would let a 20 XP duel drag the
 * headline number as hard as a 340 XP battle, which is not how exposure works
 * and not how it feels.
 */

const liveWithTrail = (battles) =>
    (battles || []).filter((b) => b?.status === "live" && Array.isArray(b.market) && b.market.length >= 2);

const weightOf = (b) => Math.max(1, Number(b.potXP) || 0);
const at = (series, ms) => {
    const pt = [...series].reverse().find((d) => new Date(d.t).getTime() <= ms);
    return pt ? pt.p : null;
};

/**
 * Stake-weighted win probability across every live battle.
 * Null when there is nothing with a trail to average — never a fake 50%.
 */
export function bookOdds(battles) {
    const live = liveWithTrail(battles);
    if (!live.length) return null;
    let num = 0, den = 0;
    for (const b of live) {
        const p = b.odds ?? b.market[b.market.length - 1].p;
        if (!Number.isFinite(p)) continue;
        num += p * weightOf(b);
        den += weightOf(b);
    }
    return den ? Math.round(num / den) : null;
}

/**
 * The book replayed over time, on one clock.
 *
 * Battles start at different moments and record at different intervals, so
 * each is stepped onto a shared grid — last known value at or before each
 * sample. A battle that had not started at a given sample is excluded from
 * that sample rather than held at its opening price, so the line doesn't
 * pretend you were exposed before you were.
 */
export function bookSeries(battles, { points = 40 } = {}) {
    const live = liveWithTrail(battles);
    if (!live.length) return [];
    const starts = live.map((b) => new Date(b.market[0].t).getTime()).filter(Number.isFinite);
    if (!starts.length) return [];
    const from = Math.min(...starts);
    const to = Date.now();
    if (!(to > from)) return [];

    const out = [];
    for (let i = 0; i < points; i++) {
        const ms = from + ((to - from) * i) / (points - 1);
        let num = 0, den = 0;
        for (const b of live) {
            const p = at(b.market, ms);
            if (p == null) continue;
            num += p * weightOf(b);
            den += weightOf(b);
        }
        if (den) out.push({ t: new Date(ms).toISOString(), p: Math.round(num / den) });
    }
    return out;
}

/** XP exposed, and what the book is worth at current odds. */
export function bookExposure(battles) {
    const live = (battles || []).filter((b) => b?.status === "live");
    let atStake = 0, expected = 0;
    for (const b of live) {
        const pot = Number(b.potXP) || 0;
        atStake += pot;
        const p = b.odds;
        if (Number.isFinite(p)) expected += (pot * p) / 100;
    }
    return { atStake: Math.round(atStake), expected: Math.round(expected) };
}

/**
 * What moved, and by how much, over the last `hours`.
 *
 * Deliberately says the price moved in a window — never that a particular
 * rival's quiz caused it. The trail records a score every few hours; anything
 * finer than "this shifted over that window" would be a story about data we
 * don't have.
 */
export function movers(battles, { hours = 24, limit = 4, minDelta = 1 } = {}) {
    const cutoff = Date.now() - hours * 3600 * 1000;
    return liveWithTrail(battles)
        .map((b) => {
            const now = b.market[b.market.length - 1].p;
            const then = at(b.market, cutoff) ?? b.market[0].p;
            return { battle: b, delta: Math.round(now - then), odds: now };
        })
        .filter((m) => Math.abs(m.delta) >= minDelta)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, limit);
}

/**
 * Rival activity from the arena ticker, tied to the battle it belongs to.
 *
 * The ticker was only ever read inside a single battle, which is exactly
 * backwards: someone else's session changing YOUR number is the thing worth
 * opening the app for, and it was the one place you couldn't see it.
 */
export function rivalFeed({ battles, ticker, myEmail, limit = 5 }) {
    const live = liveWithTrail(battles);
    const battleFor = new Map();
    for (const b of live) {
        for (const s of b.sides || []) {
            if (!s.isMe && s.email && !battleFor.has(s.email)) battleFor.set(s.email, b);
        }
    }
    return (ticker || [])
        .filter((e) => e?.email && e.email !== myEmail && battleFor.has(e.email))
        .slice(0, limit)
        .map((e) => ({ ...e, battle: battleFor.get(e.email) }));
}
