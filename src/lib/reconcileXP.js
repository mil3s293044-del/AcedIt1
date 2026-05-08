// Reconcile UserProfile.total_xp / season_xp / level against the Leaderboard
// entry, which is updated by the server-side awardXP function. If the
// Leaderboard holds a higher value than the profile (because the profile
// was wiped or corrupted at some point), restore the profile to match.
//
// XP is strictly additive — it can never legitimately decrease. So taking
// max(profile, leaderboard) is always safe.

import { base44 } from "@/api/base44Client";
import { levelFromXP } from "@/components/shared/xpSystem";

/**
 * Compares the user's stored XP against their leaderboard entry and restores
 * the profile if it's lagging behind.
 *
 * @param {{ email: string }} user — the authenticated user
 * @param {{ id: string, total_xp?: number, season_xp?: number, current_level?: number }} userProfile — the user's loaded profile
 * @returns {Promise<{ reconciled: boolean, correctTotalXp: number, correctSeasonXp: number, prevTotalXp: number }>}
 */
export async function reconcileUserXP(user, userProfile) {
    if (!user?.email || !userProfile?.id) {
        return { reconciled: false, correctTotalXp: 0, correctSeasonXp: 0, prevTotalXp: 0 };
    }

    const storedTotal  = userProfile.total_xp  || 0;
    const storedSeason = userProfile.season_xp || 0;

    let leaderboardEntry = null;
    try {
        const entries = await base44.entities.Leaderboard.filter({ user_email: user.email });
        leaderboardEntry = entries[0] || null;
    } catch {
        // Leaderboard read failed — nothing we can do. Bail out quietly.
        return { reconciled: false, correctTotalXp: storedTotal, correctSeasonXp: storedSeason, prevTotalXp: storedTotal };
    }

    if (!leaderboardEntry) {
        return { reconciled: false, correctTotalXp: storedTotal, correctSeasonXp: storedSeason, prevTotalXp: storedTotal };
    }

    const lbTotal  = leaderboardEntry.total_xp  || 0;
    const lbSeason = leaderboardEntry.season_xp || 0;

    // Take the max of profile vs leaderboard for both totals.
    const correctTotal  = Math.max(storedTotal,  lbTotal);
    const correctSeason = Math.max(storedSeason, lbSeason);

    // Only write if the profile is actually behind. Don't touch the profile
    // (or trigger spurious re-renders) if it already matches.
    const profileBehind = correctTotal > storedTotal || correctSeason > storedSeason;
    if (!profileBehind) {
        return { reconciled: false, correctTotalXp: storedTotal, correctSeasonXp: storedSeason, prevTotalXp: storedTotal };
    }

    try {
        const correctLevel = levelFromXP(correctTotal);
        await base44.entities.UserProfile.update(userProfile.id, {
            total_xp: correctTotal,
            season_xp: correctSeason,
            current_level: correctLevel,
        });
        // Also normalise leaderboard to the corrected total so any future
        // comparison between sources agrees.
        if (lbTotal < correctTotal || lbSeason < correctSeason) {
            try {
                await base44.entities.Leaderboard.update(leaderboardEntry.id, {
                    total_xp: correctTotal,
                    season_xp: correctSeason,
                    level: correctLevel,
                    last_updated: new Date().toISOString(),
                });
            } catch {
                // Non-fatal. Profile is the source of truth from here on.
            }
        }
        return { reconciled: true, correctTotalXp: correctTotal, correctSeasonXp: correctSeason, prevTotalXp: storedTotal };
    } catch (err) {
        console.error("XP reconciliation failed:", err);
        return { reconciled: false, correctTotalXp: storedTotal, correctSeasonXp: storedSeason, prevTotalXp: storedTotal };
    }
}
