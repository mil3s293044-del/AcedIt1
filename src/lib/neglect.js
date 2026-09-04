/**
 * neglect — how long a subject has been left alone, and how to say it.
 *
 * The hand on the dashboard printed each subject's total card count. That was
 * a second measure on an object that already carries one (the rank is the
 * mastery score) and it was the wrong second measure: "310 cards" is
 * inventory. It does not move when the student works, it does not say which
 * subject to open, and a big number reads like an achievement when it is
 * really just a big deck.
 *
 * Days since you touched it does all three. It goes UP when you ignore a
 * subject and resets the moment you do anything with it, it names the subject
 * you have been avoiding, and it is the one fact about a subject that nothing
 * else on the dashboard reports.
 */

/** Past this many days a subject is called out rather than just listed. */
export const STALE_DAYS = 7;

/**
 * The order the hand is dealt in: most neglected first.
 *
 * NEVER TOUCHED SORTS FIRST, and mastery breaks ties — between two subjects
 * left the same number of days, the one you know least is the one to open.
 * `daysSince` returns null for never-touched rather than a large number, so
 * that case is handled here explicitly instead of being smuggled in as
 * Infinity somewhere and printed as a day count.
 */
export function neglectOrder(rows = [], daysFor) {
    const key = (r) => {
        const d = daysFor(r);
        return d == null ? Number.POSITIVE_INFINITY : d;
    };
    return [...rows].sort((a, b) =>
        key(b) - key(a)
        || (a.mastery || 0) - (b.mastery || 0)
        || String(a.subject).localeCompare(String(b.subject)));
}

/**
 * What goes in the card's corner.
 *
 * Short, because it is printed at 9px in the corner of a 92px card: "12d",
 * "now", "new". A subject with cards that has never been opened says "new"
 * rather than a number — it has not been neglected, it has not been started,
 * and those want different words even though they sort to the same end.
 */
export function neglectLabel(days) {
    if (days == null) return "new";
    if (days === 0) return "today";
    if (days === 1) return "1d";
    return `${days}d`;
}

/** The sentence over the hand. Only claims neglect when there is some. */
export function neglectLine(rows = [], daysFor) {
    const worst = rows[0];
    if (!worst) return null;
    const d = daysFor(worst);
    if (d == null) return { subject: worst.subject, kind: "new" };
    if (d >= STALE_DAYS) return { subject: worst.subject, kind: "stale", days: d };
    return { subject: worst.subject, kind: "fresh", days: d };
}
