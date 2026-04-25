/**
 * Composite Ranking Engine v3 — Term-Length Seasons
 *
 * Seasons = one school term (~10 weeks). 4 terms per year → 4 seasons.
 * Season XP resets each term. All-Time XP never resets.
 *
 * Composite Score (0–1000):
 *   Season XP     45% (450 pts) — log-scaled from season XP only (competitive within term)
 *   Consistency   25% (250 pts) — streak days + peak streak
 *   Goal Quality  15% (150 pts) — completed goals weighted by difficulty
 *   Competition   15% (150 pts) — win rate + competition volume (bets included)
 *
 * Between terms: season XP resets, composite resets.
 * Veterans carry a 20% prestige bonus to their new season score floor.
 */

// ─── Season Schedule (one per school term) ────────────────────────────────────

export const SEASONS = [
    // 2025
    { id: "2025-T1", name: "⚡ Term 1 2025", short: "T1 '25", start: "2025-01-28", end: "2025-04-11", theme: "from-emerald-500 to-teal-600", emoji: "🌱" },
    { id: "2025-T2", name: "🔥 Term 2 2025", short: "T2 '25", start: "2025-04-28", end: "2025-06-27", theme: "from-orange-500 to-red-600",   emoji: "🔥" },
    { id: "2025-T3", name: "💎 Term 3 2025", short: "T3 '25", start: "2025-07-14", end: "2025-09-19", theme: "from-violet-500 to-purple-600", emoji: "💎" },
    { id: "2025-T4", name: "👑 Term 4 2025", short: "T4 '25", start: "2025-10-06", end: "2025-12-05", theme: "from-amber-500 to-orange-600",  emoji: "👑" },
    // 2026
    { id: "2026-T1", name: "⚡ Term 1 2026", short: "T1 '26", start: "2026-01-27", end: "2026-04-10", theme: "from-rose-500 to-pink-600",     emoji: "🌱" },
    { id: "2026-T2", name: "🔥 Term 2 2026", short: "T2 '26", start: "2026-04-27", end: "2026-06-26", theme: "from-cyan-500 to-blue-600",     emoji: "🔥" },
    { id: "2026-T3", name: "💎 Term 3 2026", short: "T3 '26", start: "2026-07-13", end: "2026-09-18", theme: "from-indigo-500 to-violet-600", emoji: "💎" },
    { id: "2026-T4", name: "👑 Term 4 2026", short: "T4 '26", start: "2026-10-05", end: "2026-12-04", theme: "from-amber-400 to-yellow-600",  emoji: "👑" },
];

export function getCurrentSeason() {
    const today = new Date();
    return SEASONS.find(s => today >= new Date(s.start) && today <= new Date(s.end)) || null;
}

export function getDaysRemainingInSeason(season) {
    if (!season) return 0;
    return Math.max(0, Math.ceil((new Date(season.end) - new Date()) / 86400000));
}

export function getSeasonProgress(season) {
    if (!season) return 0;
    const start = new Date(season.start);
    const end = new Date(season.end);
    const total = end - start;
    const elapsed = new Date() - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

// ─── Composite Score ──────────────────────────────────────────────────────────

const GOAL_DIFF_MULT = { easy: 0.5, medium: 1.0, hard: 1.6, very_hard: 2.2 };

/**
 * @param {Object} params
 * @param {number}   params.totalXP
 * @param {number}   params.seasonXP
 * @param {number}   params.streakDays
 * @param {number}   params.peakStreak
 * @param {Array}    params.completedGoals       — Goal objects with difficulty_level & sub_goals
 * @param {number}   params.competitionsWon
 * @param {number}   params.competitionsPlayed
 * @returns {{ composite: number, breakdown: Object }}
 */
export function computeCompositeScore({
    totalXP = 0,
    seasonXP = 0,
    streakDays = 0,
    peakStreak = 0,
    completedGoals = [],
    competitionsWon = 0,
    competitionsPlayed = 0,
    betsWon = 0,
}) {
    // 1. Season XP score — log-scaled to 450 pts (season XP is primary driver now)
    // Uses a tighter log scale so term-length is competitive from day 1
    const xpScore = Math.min(450, Math.round(
        (Math.log10(Math.max(seasonXP, 1)) / Math.log10(50000)) * 450
    ));

    // 2. Consistency — streak (up to 150) + peak streak bonus (up to 100)
    const streakScore = Math.min(150, Math.round((Math.min(streakDays, 60) / 60) * 150));
    const peakBonus   = Math.min(100, Math.round((Math.min(peakStreak, 30) / 30) * 100));
    const consistencyScore = Math.min(250, streakScore + peakBonus);

    // 3. Goal quality — weighted by difficulty (capped lower to keep XP dominant)
    let goalQuality = 0;
    completedGoals.forEach(goal => {
        const mult = GOAL_DIFF_MULT[goal.difficulty_level] || 1.0;
        const subBonus = (goal.sub_goals?.filter(s => s.completed).length || 0) * 1.5;
        goalQuality += (8 + subBonus) * mult;
    });
    const goalScore = Math.min(150, Math.round(goalQuality));

    // 4. Competition — win rate + volume + bets
    const winRate = competitionsPlayed > 0 ? (competitionsWon / competitionsPlayed) : 0;
    const volumeBonus = Math.min(40, competitionsPlayed * 4);
    const betBonus = Math.min(30, betsWon * 5);
    const compScore = Math.min(150, Math.round(winRate * 80 + volumeBonus + betBonus));

    const composite = Math.min(1000, xpScore + consistencyScore + goalScore + compScore);

    return {
        composite,
        breakdown: {
            xp:          { score: xpScore,          max: 450, label: "Season XP",    pct: 45, description: "Based on this term's XP (resets each term)" },
            consistency: { score: consistencyScore,  max: 250, label: "Consistency",  pct: 25, description: "Daily streak + peak streak this term" },
            goalQuality: { score: goalScore,         max: 150, label: "Goal Quality", pct: 15, description: "Completed goals weighted by difficulty" },
            competition: { score: compScore,         max: 150, label: "Competition",  pct: 15, description: "Competition wins + bets won this term" },
        },
    };
}

// ─── Composite Rank Tiers ─────────────────────────────────────────────────────

export const COMPOSITE_TIERS = [
    { name: "Rookie",       min: 0,   max: 100,  gradient: "from-slate-400 to-gray-500",               emoji: "🌱",  color: "#94a3b8" },
    { name: "Bronze I",     min: 100, max: 200,  gradient: "from-amber-600 to-yellow-700",              emoji: "🥉",  color: "#b45309" },
    { name: "Bronze II",    min: 200, max: 300,  gradient: "from-amber-500 to-orange-600",              emoji: "🥉",  color: "#d97706" },
    { name: "Silver I",     min: 300, max: 420,  gradient: "from-slate-400 to-slate-600",               emoji: "🥈",  color: "#475569" },
    { name: "Silver II",    min: 420, max: 540,  gradient: "from-gray-400 to-slate-500",                emoji: "🥈",  color: "#64748b" },
    { name: "Gold I",       min: 540, max: 650,  gradient: "from-yellow-400 to-amber-500",              emoji: "🥇",  color: "#f59e0b" },
    { name: "Gold II",      min: 650, max: 760,  gradient: "from-amber-400 to-yellow-500",              emoji: "🥇",  color: "#d97706" },
    { name: "Platinum",     min: 760, max: 860,  gradient: "from-cyan-400 to-teal-500",                 emoji: "💠",  color: "#0891b2" },
    { name: "Diamond",      min: 860, max: 940,  gradient: "from-violet-500 to-purple-600",             emoji: "💎",  color: "#7c3aed" },
    { name: "Term Legend",  min: 940, max: 1001, gradient: "from-rose-500 via-pink-500 to-fuchsia-600", emoji: "👑",  color: "#e11d48" },
];

export function getCompositeTier(score) {
    return COMPOSITE_TIERS.find(t => score >= t.min && score < t.max) || COMPOSITE_TIERS[COMPOSITE_TIERS.length - 1];
}

export function getCompositeTierProgress(score) {
    const tier = getCompositeTier(score);
    const range = tier.max - tier.min;
    return Math.min(100, Math.round(((score - tier.min) / range) * 100));
}

// ─── Season Prestige (soft reset) ─────────────────────────────────────────────
/**
 * On term reset, carry forward 20% of previous composite score as prestige bonus.
 * Shorter seasons = more competitive, veterans get smaller advantage.
 */
export function calculatePrestigeBonus(prevComposite) {
    return Math.round(prevComposite * 0.20);
}

// ─── Term Badge / flavour text ────────────────────────────────────────────────
export function getTermFlavour(season) {
    if (!season) return null;
    const daysLeft = Math.max(0, Math.ceil((new Date(season.end) - new Date()) / 86400000));
    if (daysLeft <= 7)  return { text: "FINAL WEEK 🔥", color: "text-red-600 bg-red-50 border-red-200" };
    if (daysLeft <= 14) return { text: "Last 2 weeks", color: "text-orange-600 bg-orange-50 border-orange-200" };
    if (daysLeft <= 21) return { text: "Sprint time!", color: "text-amber-600 bg-amber-50 border-amber-200" };
    return null;
}

// ─── School Contribution ──────────────────────────────────────────────────────
/**
 * School contribution = seasonXP × activityMultiplier
 * Activity multiplier rewards variety, capped at 2.5× to prevent grinding abuse.
 */
export function schoolContribution({ seasonXP, goalsCompleted, competitionsWon, streakDays }) {
    const activityMult = 1
        + (goalsCompleted * 0.06)
        + (competitionsWon * 0.12)
        + (Math.min(streakDays, 30) * 0.015);
    return Math.round(seasonXP * Math.min(activityMult, 2.5));
}

// ─── End-of-Season Rewards ────────────────────────────────────────────────────
/**
 * XP bonus awarded at end of season based on final season rank tier.
 * Paid as flat_xp via awardXP with source='season_reward'.
 */
export const SEASON_REWARD_XP = {
    1:  500,    // Bronze I
    2:  700,    // Bronze II
    3:  1000,   // Bronze III
    4:  1500,   // Silver I
    5:  2200,   // Silver II
    6:  3000,   // Silver III
    7:  4500,   // Gold I
    8:  6000,   // Gold II
    9:  8000,   // Gold III
    10: 12000,  // Platinum I
    11: 16000,  // Platinum II
    12: 22000,  // Platinum III
    13: 30000,  // Diamond I
    14: 40000,  // Diamond II
    15: 55000,  // Diamond III
    16: 75000,  // Elite
    17: 100000, // Legend
};