/**
 * xpRanks — the ten rank tiers, and the ONE copy of their thresholds.
 *
 * Extracted from `xpSystem.jsx` unchanged, for the reason `sm2.js` and
 * `mastery.js` were: a `.jsx` cannot be imported by `server.mjs` or resolved by
 * the plain-node test loader, so anything on the server that needs a rank had
 * only two options — restate the thresholds, or go without.
 *
 * It needed one the moment the weekly cred grant started depending on rank
 * (`credStore.js`). Restating ten thresholds is exactly the mirror drift
 * `mirrors.test.mjs` exists to catch, and the cheaper fix is not to have a
 * second copy: `xpSystem.jsx` re-exports this, so every screen that already
 * imported `XP_RANKS` from there is untouched.
 */

// ─── All-Time XP Rank Tiers (HIGHER thresholds — long-term prestige) ─────────

/**
 * The ladder. Ten tiers, never reset, and the names carry the app's voice —
 * a student should want to screenshot the one they are on.
 *
 * NO STATE OR CURRICULUM IN A RANK NAME. Two of these used to be "VCE Demigod"
 * and "Legend of the HSC", which named a state's exam system in a ladder every
 * student on the app climbs — and named two DIFFERENT states' systems in
 * consecutive tiers, so the top of the ladder read as though it had been
 * written by two people. A rank has to mean the same thing to everybody who
 * reaches it.
 */
export const XP_RANKS = [
    { name: "Slackademic",            minXP: 0,       maxXP: 800,    tier: 1,  gradient: "from-slate-500 via-gray-500 to-slate-600",           color: "#64748b" },
    { name: "Barely Literate Bandit", minXP: 800,     maxXP: 3000,   tier: 2,  gradient: "from-stone-500 via-stone-600 to-slate-500",           color: "#78716c" },
    { name: "Wikipedia Warrior",      minXP: 3000,    maxXP: 8000,   tier: 3,  gradient: "from-orange-500 via-amber-500 to-yellow-500",         color: "#f97316" },
    { name: "Flash Card Finesser",    minXP: 8000,    maxXP: 18000,  tier: 4,  gradient: "from-amber-500 via-yellow-500 to-orange-500",         color: "#f59e0b" },
    { name: "Highlighter Hoarder",    minXP: 18000,   maxXP: 35000,  tier: 5,  gradient: "from-lime-500 via-green-500 to-emerald-500",          color: "#84cc16" },
    { name: "Grind Gremlin",          minXP: 35000,   maxXP: 65000,  tier: 6,  gradient: "from-emerald-500 via-teal-500 to-cyan-500",           color: "#10b981" },
    { name: "Pomodoro Prodigy",       minXP: 65000,   maxXP: 120000, tier: 7,  gradient: "from-cyan-500 via-blue-500 to-indigo-500",            color: "#06b6d4" },
    { name: "Academic Weapon",        minXP: 120000,  maxXP: 220000, tier: 8,  gradient: "from-violet-500 via-purple-500 to-fuchsia-500",       color: "#8b5cf6" },
    { name: "Syllabus Slayer",        minXP: 220000,  maxXP: 400000, tier: 9,  gradient: "from-rose-500 via-pink-500 to-fuchsia-600",           color: "#f43f5e" },
    { name: "Final Boss",             minXP: 400000,  maxXP: Infinity, tier: 10, gradient: "from-yellow-400 via-amber-400 to-orange-500",      color: "#f59e0b" },
];

/**
 * Which tier a total XP figure falls in, as a NUMBER 1–10.
 *
 * A number rather than the rank object, because the server only ever needs the
 * tier and shipping the whole row would invite reading `gradient` on a surface
 * that cannot render one. Junk XP lands on tier 1 — the floor, never the
 * ceiling, the same asymmetry `grantForTier` keeps.
 */
export function rankTierFromXP(totalXP) {
    const xp = Number(totalXP);
    if (!Number.isFinite(xp) || xp < 0) return 1;
    let tier = 1;
    for (const r of XP_RANKS) if (xp >= r.minXP) tier = r.tier;
    return tier;
}

export default { XP_RANKS, rankTierFromXP };
