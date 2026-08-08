/**
 * ranked — the competitive maths behind the board.
 *
 * The page had all of this data and showed none of it. A leaderboard that
 * tells you you're 47th tells you nothing you can act on; one that tells you
 * you're 1.24 behind the person above and 0.6 off the next band gives you a
 * target. Every number here comes from the board array that was already being
 * fetched — no new query, no new column.
 *
 * Titles are the personality layer, and the rule that makes them mean anything
 * is scarcity: a title is either a superlative someone actually holds on this
 * board, or a threshold hard enough that most people don't have it. If
 * everyone gets a title, nobody has one.
 */

/** The bands, with the floor each one starts at. Mirrors atarBand() on the server. */
export const BANDS = [
    { name: "Foundation",      min: 0,  tone: "muted" },
    { name: "Building",        min: 50, tone: "xp" },
    { name: "On Track",        min: 60, tone: "chart-3" },
    { name: "Solid",           min: 70, tone: "chart-3" },
    { name: "Strong",          min: 80, tone: "primary" },
    { name: "Elite",           min: 90, tone: "primary" },
    { name: "State Contender", min: 95, tone: "chart-4" },
    { name: "The 99 Club",     min: 99, tone: "chart-4" },
];

export const BAND_TONE = Object.fromEntries(BANDS.map(b => [b.name, b.tone]));

export const bandOf = (atar) => {
    if (atar == null) return null;
    let found = BANDS[0];
    for (const b of BANDS) if (atar >= b.min) found = b;
    return found;
};

/** The band above yours, and what it costs to get there. */
export function nextBand(atar) {
    if (atar == null) return null;
    const next = BANDS.find(b => b.min > atar);
    if (!next) return null;
    return { ...next, gap: +(next.min - atar).toFixed(2) };
}

/**
 * Where you sit in the field.
 *
 * Percentile is reported as "top N%" because that's how students talk about
 * an ATAR, and it's rounded away from zero so nobody is ever told they're in
 * the top 0%.
 */
export function standing(rows = [], me, valueOf = (r) => r.acedit_atar) {
    const ranked = rows
        .filter(r => valueOf(r) != null)
        .sort((a, b) => (valueOf(b) || 0) - (valueOf(a) || 0));
    const idx = ranked.findIndex(r => r.user_email === me);
    if (idx < 0) return { rank: null, total: ranked.length, percentile: null, above: null, below: null };

    const above = idx > 0 ? ranked[idx - 1] : null;
    const below = idx < ranked.length - 1 ? ranked[idx + 1] : null;
    const mine = valueOf(ranked[idx]) || 0;
    return {
        rank: idx + 1,
        total: ranked.length,
        percentile: Math.max(1, Math.round(((idx + 1) / ranked.length) * 100)),
        above: above ? { row: above, gap: +((valueOf(above) || 0) - mine).toFixed(2) } : null,
        below: below ? { row: below, gap: +(mine - (valueOf(below) || 0)).toFixed(2) } : null,
    };
}

/**
 * Titles, awarded from the board itself.
 *
 * Superlatives go to exactly one person each — whoever actually leads that
 * stat — and the streak titles need a number most people won't have. The point
 * is that seeing one on a row tells you something true about that student,
 * which a title everybody carries cannot do.
 */
const SUPERLATIVES = [
    { id: "machine", label: "The Machine", tone: "chart-3", of: (r) => r.total_study_time || 0, min: 600,
      blurb: "Most hours on this board" },
    { id: "baron",   label: "XP Baron",    tone: "xp",      of: (r) => r.total_xp || 0,         min: 2000,
      blurb: "Most XP on this board" },
    { id: "unbroken",label: "Unbreakable", tone: "streak",  of: (r) => r.streak_days || 0,      min: 14,
      blurb: "Longest streak on this board" },
];

export function titlesFor(rows = []) {
    const out = new Map();
    for (const s of SUPERLATIVES) {
        let best = null;
        for (const r of rows) {
            const v = s.of(r);
            if (v < s.min) continue;
            if (!best || v > s.of(best)) best = r;
        }
        // A superlative nobody clears the floor for goes unawarded rather than
        // being handed to whoever happens to be least bad at it.
        if (best && !out.has(best.user_email)) {
            out.set(best.user_email, { id: s.id, label: s.label, tone: s.tone, blurb: s.blurb });
        }
    }
    // Threshold titles for anyone still untitled — earned, not ranked.
    for (const r of rows) {
        if (out.has(r.user_email)) continue;
        if ((r.streak_days || 0) >= 100) out.set(r.user_email, { id: "century", label: "Century", tone: "streak", blurb: "100-day streak" });
        else if ((r.streak_days || 0) >= 30) out.set(r.user_email, { id: "metronome", label: "Metronome", tone: "streak", blurb: "30-day streak" });
        else if ((r.acedit_atar || 0) >= 99) out.set(r.user_email, { id: "99", label: "99 Club", tone: "chart-4", blurb: "AcedIt ATAR of 99+" });
    }
    return out;
}

/**
 * A stable colour per person, so a name is recognisable at a glance.
 * Whole-string hash — hashing the first character alone put every Chemistry
 * and every Chloe on the same hue.
 */
export function avatarHue(seed) {
    const s = String(seed || "?");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
}

export const initialsOf = (name) => String(name || "?")
    .split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

/** Compact secondary stat for a board row: what else is notable about them. */
export function rowFlex(row, boardId) {
    const bits = [];
    if (boardId !== "time" && (row.total_study_time || 0) >= 60) {
        bits.push(`${Math.round((row.total_study_time || 0) / 60)}h`);
    }
    if (boardId !== "xp" && (row.total_xp || 0) >= 500) {
        const xp = row.total_xp || 0;
        bits.push(xp >= 1000 ? `${(xp / 1000).toFixed(1)}k XP` : `${xp} XP`);
    }
    if (boardId !== "atar" && row.acedit_atar != null) bits.push(`ATAR ${row.acedit_atar.toFixed(1)}`);
    return bits.slice(0, 2).join(" · ");
}

/**
 * Which of the five ATAR components is holding you back, and therefore the one
 * worth moving. Lowest wins, because the score is a weighted blend and the
 * cheapest points are always in whatever you've neglected.
 */
export const COMPONENT_ACTION = {
    mastery:     "Sit a quiz or clear your due cards — accuracy is what moves this.",
    consistency: "Show up tomorrow. This one counts days, not hours.",
    effort:      "Book a focused block. This is minutes, plainly.",
    breadth:     "Try a technique you haven't used this month.",
    planning:    "Set a goal or plan a block, then actually keep it.",
};

export function weakestComponent(components) {
    if (!components) return null;
    const keys = Object.keys(COMPONENT_ACTION).filter(k => typeof components[k] === "number");
    if (!keys.length) return null;
    const key = keys.reduce((w, k) => (components[k] < components[w] ? k : w));
    return { key, value: components[key], action: COMPONENT_ACTION[key] };
}
