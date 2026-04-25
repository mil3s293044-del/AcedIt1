/**
 * updateStreak — called whenever a user completes any study action.
 * - Uses the user's local calendar date (via timezone offset sent from client, or fallback to server date)
 * - Checks if streak was already updated today (idempotent per calendar day)
 * - Updates streak_days on UserProfile & Leaderboard
 * - Streak resets if more than 1 calendar day has been missed
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function getStreakMultiplier(days) {
    if (days >= 30) return 2.0;
    if (days >= 14) return 1.5;
    if (days >= 7)  return 1.25;
    if (days >= 3)  return 1.1;
    return 1.0;
}

/** Get YYYY-MM-DD for a given timezone offset in minutes (e.g. +660 for Melbourne AEST) */
function getLocalDateStr(timezoneOffsetMinutes) {
    const now = new Date();
    // Apply the offset: UTC + offsetMinutes
    const localMs = now.getTime() + (timezoneOffsetMinutes * 60 * 1000);
    const localDate = new Date(localMs);
    return localDate.toISOString().split('T')[0];
}

/** Return YYYY-MM-DD for the day before the given YYYY-MM-DD string */
function getPreviousDateStr(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Client can send timezoneOffset (in minutes, positive = east of UTC) for accurate local date
        let body = {};
        try { body = await req.clone().json(); } catch (_) {}
        
        // Default to Melbourne AEST +660 / AEDT +660 if not provided
        const timezoneOffsetMinutes = typeof body.timezoneOffset === 'number' ? body.timezoneOffset : 660;
        const todayStr = getLocalDateStr(timezoneOffsetMinutes);

        // Load profile
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        let profile = profiles[0];
        if (!profile) {
            profile = await base44.entities.UserProfile.create({
                created_by: user.email,
                total_xp: 0,
                current_level: 1,
                streak_days: 0,
            });
        }

        const lastStreakDate = profile.last_streak_date || null;
        const currentStreak = profile.streak_days || 0;
        const peakStreak = profile.peak_streak || 0;

        // Already updated today (same calendar day) — idempotent, return current state
        if (lastStreakDate === todayStr) {
            return Response.json({
                success: true,
                streak_days: currentStreak,
                is_new_day: false,
                multiplier: getStreakMultiplier(currentStreak),
                peak_streak: peakStreak,
            });
        }

        // Check if yesterday was the last streak day (consecutive calendar days)
        const yesterdayStr = getPreviousDateStr(todayStr);
        const isConsecutive = lastStreakDate === yesterdayStr;

        // If there's a gap of more than 1 day, reset streak to 1
        // If yesterday was the last day, increment
        // If no prior streak, start at 1
        let newStreak = isConsecutive ? currentStreak + 1 : 1;
        const newPeak = Math.max(peakStreak, newStreak);

        // Update profile
        await base44.asServiceRole.entities.UserProfile.update(profile.id, {
            streak_days: newStreak,
            peak_streak: newPeak,
            last_streak_date: todayStr,
        });

        // Update Leaderboard entry
        try {
            const lbEntries = await base44.asServiceRole.entities.Leaderboard.filter({ user_email: user.email });
            if (lbEntries.length > 0) {
                await base44.asServiceRole.entities.Leaderboard.update(lbEntries[0].id, {
                    streak_days: newStreak,
                    last_updated: new Date().toISOString(),
                });
            }
        } catch (_) {}

        const milestones = [3, 7, 14, 30, 60, 100, 150, 200, 365];
        const hitMilestone = milestones.includes(newStreak);

        return Response.json({
            success: true,
            streak_days: newStreak,
            is_new_day: true,
            is_consecutive: isConsecutive,
            multiplier: getStreakMultiplier(newStreak),
            peak_streak: newPeak,
            hit_milestone: hitMilestone,
        });

    } catch (error) {
        console.error('updateStreak error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});