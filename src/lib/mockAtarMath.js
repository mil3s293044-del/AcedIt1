// ════════════════════════════════════════════════════════════════════════════
// Mock ATAR math — CLIENT MIRROR of the server formula in server.mjs
// (computeMockAtar). The server remains the source of truth for stored
// scores; this mirror powers the "What do I need?" planner so its sliders
// show exactly what the real formula would produce. KEEP THE TWO IN SYNC.
//
// The whole thing is a game metric (disclaimed in the UI), not a prediction.
// ════════════════════════════════════════════════════════════════════════════

/** Mock study score (15–50) for one subject, or null while locked. */
export function subjectScore({ accuracy = 0, attempts = 0, minutes = 0, streak = 0 }) {
    if (attempts === 0 && minutes < 15) return null;
    const s =
        18
        + (accuracy / 100) * 16 * Math.min(1, attempts / 3)   // accuracy, full weight from 3 quizzes
        + Math.min(9, Math.sqrt(minutes / 45) * 2.2)          // study time, diminishing returns
        + Math.min(4, Math.sqrt(attempts) * 1.1)              // practice volume
        + Math.min(3, streak * 0.1);                          // consistency
    return Math.round(Math.max(15, Math.min(50, s)) * 10) / 10;
}

/** Aggregate mock ATAR (30–99.95 in 0.05 steps) from subject scores. */
export function atarFrom(scores, { streak = 0, totalXP = 0 } = {}) {
    const un = scores.filter((s) => s != null).sort((a, b) => b - a);
    if (un.length === 0) return null;
    const top = un.slice(0, 4);
    const mean = (top.reduce((a, b) => a + b, 0) - Math.max(0, 4 - top.length) * 1.5) / top.length;
    const raw =
        30
        + (Math.max(15, mean) - 18) * 2.05
        + Math.min(2, un.length * 0.5)
        + Math.min(1.5, streak * 0.05)
        + Math.min(1.5, totalXP / 15000);
    return Math.round(Math.max(30, Math.min(99.95, raw)) * 20) / 20;
}

/**
 * Invert the aggregate: the top-4 mean subject score needed to hit `target`.
 * Can exceed 50 — that means the target isn't reachable at the current
 * breadth/bonuses and the caller should say so.
 */
export function requiredTop4Mean(target, { streak = 0, totalXP = 0, unlockedCount = 1 } = {}) {
    const bonuses =
        Math.min(2, unlockedCount * 0.5)
        + Math.min(1.5, streak * 0.05)
        + Math.min(1.5, totalXP / 15000);
    return Math.round((18 + (target - 30 - bonuses) / 2.05) * 10) / 10;
}

// ─── ATAR Clubs — accolade thresholds ────────────────────────────────────────
export const CLUBS = [
    { min: 99.95, name: "The Ceiling", emoji: "🏆", badge: "bg-foreground text-background" },
    { min: 90,    name: "90 Club",     emoji: "💎", badge: "bg-primary/15 text-primary" },
    { min: 80,    name: "80 Club",     emoji: "🔥", badge: "bg-xp/15 text-xp" },
    { min: 70,    name: "70 Club",     emoji: "⭐", badge: "bg-chart-3/15 text-chart-3" },
];

export function clubOf(atar) {
    if (atar == null) return null;
    return CLUBS.find((c) => atar >= c.min) || null;
}
