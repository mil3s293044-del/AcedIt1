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

import { ATAR_BANDS } from "@/lib/atarBands";

/**
 * The bands, lowest first, with the tone each one is drawn in.
 *
 * THE THRESHOLDS COME FROM `atarBands.js` — they are not restated here. This
 * file used to carry its own copy of all eight numbers, which made three
 * copies of one list (here, atarBands.js and `atarBand()` in server.mjs) with
 * nothing checking any of them against each other. The TONE is the only part
 * this file owns, so it is the only part written down.
 */
const TONE = {
    "Foundation": "muted",
    "Building": "xp",
    "On Track": "chart-3",
    "Solid": "chart-3",
    "Strong": "primary",
    "Elite": "primary",
    "State Contender": "chart-4",
    "The 99 Club": "chart-4",
};

export const BANDS = [...ATAR_BANDS]
    .sort((a, b) => a.min - b.min)
    .map((b) => ({ name: b.name, min: b.min, tone: TONE[b.name] || "muted" }));

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

/**
 * WHERE EACH COMPONENT IS ACTUALLY MOVED, and the exact thing to do there.
 *
 * ─── A BAR WITH NO DOOR IS A DIAGNOSIS ──────────────────────────────────────
 * Ranked drew five components and named the weakest one in a sentence, and
 * every one of them left the student to work out which screen moves it. The
 * score is the thing the whole app is standardised around; "your planning is
 * 22" with no way through is the same failure as a percentage with no evidence
 * under it, one step further along.
 *
 * It is a DEEP LINK where one exists rather than a page: `/Study?tab=pomodoro`
 * lands on the timer and not on the technique grid, which is the rule
 * `startFromSuggestion` keeps — a suggestion that says it will build the thing
 * has to build it.
 *
 * TWO OF THEM DELIBERATELY DO NOT DEEP-LINK, and that is the honest answer
 * rather than a shortfall:
 *   breadth      — the action IS choosing a technique you have not used, and
 *                  Study's landing screen is that chooser. Picking one FOR
 *                  them would need the technique families the component only
 *                  stores a COUNT of, so naming one would be a guess.
 *   consistency  — it counts DAYS. There is no screen that adds one; the only
 *                  thing that moves it is coming back tomorrow, so it goes to
 *                  the move for today rather than pretending otherwise.
 *
 * `COMPONENT_PAGE` used to live inside StandingRail as its own object, which
 * is the second copy this codebase keeps deleting — Ranked now needs the same
 * mapping, and two of them would have drifted the first time one changed.
 */
export const COMPONENT_MOVE = {
    mastery:     { label: "Fix a dropped mark", page: "MistakeBank" },
    consistency: { label: "Today's move",       page: "Dashboard" },
    effort:      { label: "Start a block",      page: "Study", query: "?tab=pomodoro" },
    breadth:     { label: "Pick a new one",     page: "Study" },
    planning:    { label: "Plan this week",     page: "Goals", query: "?plan=week" },
};

/** The href for a component's move, or null for a key that has none. */
export function moveHref(key, pageUrl) {
    const m = COMPONENT_MOVE[key];
    if (!m || typeof pageUrl !== "function") return null;
    return pageUrl(m.page) + (m.query || "");
}

export function weakestComponent(components) {
    if (!components) return null;
    const keys = Object.keys(COMPONENT_ACTION).filter(k => typeof components[k] === "number");
    if (!keys.length) return null;
    const key = keys.reduce((w, k) => (components[k] < components[w] ? k : w));
    return { key, value: components[key], action: COMPONENT_ACTION[key] };
}

/**
 * ─── THE BOARDS, AND THE ERA EACH ONE MEASURES ──────────────────────────────
 *
 * These descriptors were inline in `Ranked.jsx`, which was fine while one tab
 * held all three. The page is split by ERA now — the ATAR is a trailing 28-day
 * score and belongs with the panel that explains it, XP and study time are
 * lifetime totals and belong together — so two tabs need the list and a second
 * copy of it is the mirror this codebase keeps deleting.
 *
 * `era` is what decides which tab a board appears on, so the split is a fact
 * about the board rather than two hard-coded arrays that can disagree about
 * where the ATAR lives.
 *
 * `gap` is the sentence form ("1.24 behind"); `gapShort` is what fits beside a
 * bar on a board row, where the direction is already drawn by an arrow.
 */
export const fmtMins = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h === 0 ? `${mm}m` : mm === 0 ? `${h}h` : `${h}h ${mm}m`;
};

export const BOARDS = [
    {
        id: "atar", era: "month", label: "ATAR", icon: "GraduationCap",
        // What the board is OF, printed under the heading. A board nobody can
        // name the window of is a board a student cannot argue with — and
        // these three measure three different spans of time, which is most of
        // what made one chip row holding all of them confusing.
        window: "Trailing 28 days",
        value: (r) => r.acedit_atar,
        fmt: (v) => (v == null ? "—" : v.toFixed(2)),
        gap: (g) => `${g.toFixed(2)} behind`,
        gapShort: (g) => g.toFixed(2),
    },
    {
        id: "xp", era: "alltime", label: "XP", icon: "Zap",
        window: "Everything you have ever earned",
        value: (r) => r.total_xp || 0,
        fmt: (v) => (v || 0).toLocaleString(),
        gap: (g) => `${Math.round(g).toLocaleString()} XP behind`,
        gapShort: (g) => Math.round(g).toLocaleString(),
    },
    {
        id: "time", era: "alltime", label: "Study time", icon: "Clock",
        window: "Every minute you have logged",
        value: (r) => r.total_study_time || 0,
        fmt: (v) => fmtMins(v || 0),
        gap: (g) => `${fmtMins(g)} behind`,
        gapShort: (g) => fmtMins(g),
    },
];

/** The boards on one tab. Derived, so the tabs cannot disagree about the ATAR. */
export const boardsFor = (era) => BOARDS.filter(b => b.era === era);
export const boardById = (id) => BOARDS.find(b => b.id === id) || BOARDS[0];

/**
 * Who you are being measured against.
 *
 * ONE control rather than three chips beside three more. At 360px the old row
 * was six bordered buttons on one line, which is most of what made the board
 * header read as a toolbar rather than as a leaderboard.
 */
export const SCOPES = [
    { id: "global", label: "Global", blurb: "Everyone on AcedIt" },
    { id: "friends", label: "Friends", blurb: "People you know" },
    { id: "school", label: "School", blurb: "Your school" },
];
