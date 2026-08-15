/**
 * clearedWeek — the sessions behind the pile on the dashboard.
 *
 * In lib for the same reason the other derived shapes are: the arithmetic is
 * the part worth being certain about and it is the part a screenshot cannot
 * check. The window in particular has an off-by-one in it that shipped once
 * already — counting back a full seven days from today spans EIGHT distinct
 * dates, so the panel read "16 sessions across 8 days" under a heading saying
 * "this week".
 */

/**
 * How many DAYS the window covers, today included.
 *
 * Seven means today and the six before it.
 */
export const WINDOW_DAYS = 7;

const dayKey = (d) => String(d || "").slice(0, 10);

/** This week's sessions, newest first, with the totals that go under the pile. */
export function clearedThisWeek(sessions = [], now = new Date()) {
    const cutoff = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86400000);
    const cutKey = dayKey(cutoff.toISOString());

    const recent = (sessions || [])
        .filter((s) => dayKey(s?.date) >= cutKey)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const minutes = recent.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
    const days = new Set(recent.map((s) => dayKey(s.date))).size;
    const subjects = [...new Set(recent.map((s) => s.subject).filter(Boolean))];

    return { sessions: recent, count: recent.length, minutes, days, subjects };
}
