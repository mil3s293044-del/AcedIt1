/**
 * Streak helpers — client-side utilities.
 * Call updateStreak() on any study action to tick the streak.
 * Use getStreakMultiplier(days) to scale XP before awarding.
 */
import { updateStreak } from '@/functions/updateStreak';
import { awardXP } from '@/functions/awardXP';

export function getStreakMultiplier(days) {
    if (!days || days < 1) return 1.0;
    if (days >= 30) return 2.0;
    if (days >= 14) return 1.5;
    if (days >= 7)  return 1.25;
    if (days >= 3)  return 1.1;
    return 1.0;
}

export function streakMultiplierLabel(days) {
    const m = getStreakMultiplier(days);
    if (m === 1.0) return null;
    return `${m}× streak bonus`;
}

/**
 * Call this whenever a user completes a study action.
 * Returns { streak_days, is_new_day, multiplier, hit_milestone }
 * Also fires a window event for the StreakCelebration component.
 */
export async function recordStudyAndGetStreak() {
    try {
        // Send the browser's timezone offset (minutes east of UTC, e.g. +660 for Melbourne)
        // JS getTimezoneOffset() returns minutes WEST (negative = east), so we negate it
        const timezoneOffset = -new Date().getTimezoneOffset();
        const res = await updateStreak({ timezoneOffset });
        const data = res?.data || res;
        if (data?.is_new_day) {
            window.dispatchEvent(new CustomEvent('streak_updated', { detail: data }));
        }
        return data;
    } catch (e) {
        console.error('recordStudyAndGetStreak error', e);
        return { streak_days: 0, multiplier: 1.0 };
    }
}

/**
 * Award XP with streak multiplier automatically applied.
 * streakDays — pass in from UserProfile.streak_days (or fetch fresh via recordStudyAndGetStreak).
 */
export async function awardXPWithStreak(params, streakDays = 0) {
    const multiplier = getStreakMultiplier(streakDays);
    // The backend applies its own caps, so we just pass the streak multiplier as metadata.
    // The multiplier is applied server-side in awardXP when streak_multiplier is passed.
    return awardXP({ ...params, streak_multiplier: multiplier });
}