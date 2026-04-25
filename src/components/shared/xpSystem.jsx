/**
 * XP System v2 — shared client-side constants & helpers
 * Mirrors functions/awardXP.js — keep in sync.
 *
 * KEY CHANGES vs v1:
 *  - Level curve steeper: 120 × i^1.6 (vs 100 × i^1.5)
 *  - All-Time XP thresholds ~3-4× higher
 *  - Seasonal rank system added (Bronze → Legend, 17 tiers)
 *  - Season XP resets each season (~20 weeks)
 *  - All-Time XP never resets (prestige)
 */

// ─── Level Curve ──────────────────────────────────────────────────────────────

export function xpForLevel(n) {
    if (n <= 1) return 0;
    let total = 0;
    for (let i = 1; i < n; i++) total += Math.round(120 * Math.pow(i, 1.6));
    return total;
}

export function xpToNextLevel(n) {
    return Math.round(120 * Math.pow(n, 1.6));
}

export function levelFromXP(totalXP) {
    let level = 1;
    while (xpForLevel(level + 1) <= totalXP) {
        level++;
        if (level > 500) break;
    }
    return level;
}

export function levelProgress(totalXP) {
    const level = levelFromXP(totalXP);
    const start = xpForLevel(level);
    const end = xpForLevel(level + 1);
    if (end === start) return 100;
    return Math.min(100, Math.round(((totalXP - start) / (end - start)) * 100));
}

// ─── All-Time XP Rank Tiers (HIGHER thresholds — long-term prestige) ─────────

export const XP_RANKS = [
    { name: "Slackademic",            minXP: 0,       maxXP: 800,    tier: 1,  gradient: "from-slate-500 via-gray-500 to-slate-600",           color: "#64748b", emoji: "😴" },
    { name: "Barely Literate Bandit", minXP: 800,     maxXP: 3000,   tier: 2,  gradient: "from-stone-500 via-stone-600 to-slate-500",           color: "#78716c", emoji: "📖" },
    { name: "Wikipedia Warrior",      minXP: 3000,    maxXP: 8000,   tier: 3,  gradient: "from-orange-500 via-amber-500 to-yellow-500",         color: "#f97316", emoji: "🖱️" },
    { name: "Flash Card Finesser",    minXP: 8000,    maxXP: 18000,  tier: 4,  gradient: "from-amber-500 via-yellow-500 to-orange-500",         color: "#f59e0b", emoji: "🗂️" },
    { name: "Highlighter Hoarder",    minXP: 18000,   maxXP: 35000,  tier: 5,  gradient: "from-lime-500 via-green-500 to-emerald-500",          color: "#84cc16", emoji: "🖍️" },
    { name: "Grind Gremlin",          minXP: 35000,   maxXP: 65000,  tier: 6,  gradient: "from-emerald-500 via-teal-500 to-cyan-500",           color: "#10b981", emoji: "🧠" },
    { name: "Pomodoro Prodigy",       minXP: 65000,   maxXP: 120000, tier: 7,  gradient: "from-cyan-500 via-blue-500 to-indigo-500",            color: "#06b6d4", emoji: "⏱️" },
    { name: "Academic Weapon",        minXP: 120000,  maxXP: 220000, tier: 8,  gradient: "from-violet-500 via-purple-500 to-fuchsia-500",       color: "#8b5cf6", emoji: "🚀" },
    { name: "VCE Demigod",            minXP: 220000,  maxXP: 400000, tier: 9,  gradient: "from-rose-500 via-pink-500 to-fuchsia-600",           color: "#f43f5e", emoji: "⚡" },
    { name: "Legend of the HSC",      minXP: 400000,  maxXP: Infinity, tier: 10, gradient: "from-yellow-400 via-amber-400 to-orange-500",      color: "#f59e0b", emoji: "👑" },
];

export function getRankFromXP(totalXP) {
    return XP_RANKS.find(r => totalXP >= r.minXP && totalXP < r.maxXP) || XP_RANKS[XP_RANKS.length - 1];
}

export function getRankProgress(totalXP) {
    const rank = getRankFromXP(totalXP);
    if (rank.maxXP === Infinity) return 100;
    return Math.min(100, Math.round(((totalXP - rank.minXP) / (rank.maxXP - rank.minXP)) * 100));
}

export function xpToNextRank(totalXP) {
    const rank = getRankFromXP(totalXP);
    if (rank.maxXP === Infinity) return 0;
    return rank.maxXP - totalXP;
}

// ─── Seasonal Rank Tiers (resets per season ~20 weeks — competitive ladder) ──

export const SEASON_RANKS = [
    { name: "Bronze I",     minXP: 0,      maxXP: 1200,   tier: 1,  gradient: "from-amber-700 to-yellow-800",             color: "#92400e", emoji: "🥉", division: "Bronze"   },
    { name: "Bronze II",    minXP: 1200,   maxXP: 2800,   tier: 2,  gradient: "from-amber-600 to-yellow-700",             color: "#b45309", emoji: "🥉", division: "Bronze"   },
    { name: "Bronze III",   minXP: 2800,   maxXP: 5000,   tier: 3,  gradient: "from-amber-500 to-yellow-600",             color: "#d97706", emoji: "🥉", division: "Bronze"   },
    { name: "Silver I",     minXP: 5000,   maxXP: 9000,   tier: 4,  gradient: "from-slate-400 to-gray-500",               color: "#6b7280", emoji: "🥈", division: "Silver"   },
    { name: "Silver II",    minXP: 9000,   maxXP: 15000,  tier: 5,  gradient: "from-slate-300 to-gray-400",               color: "#9ca3af", emoji: "🥈", division: "Silver"   },
    { name: "Silver III",   minXP: 15000,  maxXP: 24000,  tier: 6,  gradient: "from-gray-300 to-slate-300",               color: "#d1d5db", emoji: "🥈", division: "Silver"   },
    { name: "Gold I",       minXP: 24000,  maxXP: 38000,  tier: 7,  gradient: "from-yellow-400 to-amber-500",             color: "#f59e0b", emoji: "🥇", division: "Gold"     },
    { name: "Gold II",      minXP: 38000,  maxXP: 58000,  tier: 8,  gradient: "from-yellow-300 to-amber-400",             color: "#fbbf24", emoji: "🥇", division: "Gold"     },
    { name: "Gold III",     minXP: 58000,  maxXP: 85000,  tier: 9,  gradient: "from-yellow-200 to-amber-300",             color: "#fde68a", emoji: "🥇", division: "Gold"     },
    { name: "Platinum I",   minXP: 85000,  maxXP: 120000, tier: 10, gradient: "from-cyan-400 to-teal-500",                color: "#0891b2", emoji: "💠", division: "Platinum" },
    { name: "Platinum II",  minXP: 120000, maxXP: 170000, tier: 11, gradient: "from-cyan-300 to-teal-400",                color: "#22d3ee", emoji: "💠", division: "Platinum" },
    { name: "Platinum III", minXP: 170000, maxXP: 240000, tier: 12, gradient: "from-cyan-200 to-sky-300",                 color: "#7dd3fc", emoji: "💠", division: "Platinum" },
    { name: "Diamond I",    minXP: 240000, maxXP: 330000, tier: 13, gradient: "from-violet-400 to-purple-500",            color: "#8b5cf6", emoji: "💎", division: "Diamond"  },
    { name: "Diamond II",   minXP: 330000, maxXP: 440000, tier: 14, gradient: "from-violet-300 to-purple-400",            color: "#a78bfa", emoji: "💎", division: "Diamond"  },
    { name: "Diamond III",  minXP: 440000, maxXP: 600000, tier: 15, gradient: "from-fuchsia-400 to-violet-500",           color: "#c084fc", emoji: "💎", division: "Diamond"  },
    { name: "Elite",        minXP: 600000, maxXP: 800000, tier: 16, gradient: "from-rose-500 to-pink-600",                color: "#f43f5e", emoji: "⚔️", division: "Elite"    },
    { name: "Legend",       minXP: 800000, maxXP: Infinity, tier: 17, gradient: "from-yellow-400 via-rose-500 to-fuchsia-600", color: "#fbbf24", emoji: "👑", division: "Legend" },
];

export function getSeasonRankFromXP(seasonXP) {
    return SEASON_RANKS.find(r => seasonXP >= r.minXP && seasonXP < r.maxXP) || SEASON_RANKS[SEASON_RANKS.length - 1];
}

export function getSeasonRankProgress(seasonXP) {
    const rank = getSeasonRankFromXP(seasonXP);
    if (rank.maxXP === Infinity) return 100;
    return Math.min(100, Math.round(((seasonXP - rank.minXP) / (rank.maxXP - rank.minXP)) * 100));
}

export function xpToNextSeasonRank(seasonXP) {
    const rank = getSeasonRankFromXP(seasonXP);
    if (rank.maxXP === Infinity) return 0;
    return rank.maxXP - seasonXP;
}

// ─── XP Hints (for UI display) ────────────────────────────────────────────────

export const XP_HINTS = {
    focus_session_30min:       24,    // ~30 min clean session
    focus_session_60min:       48,    // ~60 min no distractions
    practice_questions_10_75:  20,    // 10 questions at 75% accuracy
    flashcard_50_80pct:        38,    // 50 cards, 80% correct
    mini_test_90pct:           36,    // 90% score, improvement bonus
    challenge_foundation:      28,
    challenge_exam_ready:      80,
    challenge_exam_ready_90:  104,    // exam_ready + 90% score
    sub_goal_high:             65,
    goal_very_hard:            540,
    quiz_perfect:              50,
    streak_7day:               29,
    streak_30day:              75,
    friend_win:               100,
    wager_exact_500:          1750,
};

// ─── Season XP targets (rough guidance per season ~20 weeks) ─────────────────

export const SEASON_MILESTONES = [
    { label: "Bronze III",  xp: 5000,   weeks_needed: 2 },
    { label: "Silver I",    xp: 5000,   weeks_needed: 3 },
    { label: "Gold I",      xp: 24000,  weeks_needed: 6 },
    { label: "Platinum I",  xp: 85000,  weeks_needed: 10 },
    { label: "Diamond I",   xp: 240000, weeks_needed: 15 },
    { label: "Elite",       xp: 600000, weeks_needed: 19 },
    { label: "Legend",      xp: 800000, weeks_needed: 20 },
];