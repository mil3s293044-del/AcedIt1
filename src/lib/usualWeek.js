/**
 * usual — how much time a normal week holds for each subject, and how to say
 * it on a card.
 *
 * ─── What this replaced, twice ──────────────────────────────────────────────
 * The hand's corner has now carried three things. The card COUNT first, which
 * is inventory: it does not move when you work and it names nothing to do.
 * Then DAYS SINCE YOU TOUCHED IT, which moved and was actionable and was also
 * a countdown of guilt — it goes up on its own, it is highest on the subject
 * you are already avoiding, and it never says anything good.
 *
 * The usual weekly hours say where your time actually goes. It is the fact a
 * student cannot get anywhere else and cannot honestly guess about themselves,
 * it sits next to the rank so the subject you starve is legible right beside
 * the one you know least, and it is the same "usual" the week panel below is
 * built on — one idea, said twice, from one calculation.
 */

/** Under this many minutes a week, a subject is being starved rather than studied. */
export const THIN_WEEK_MINUTES = 30;

/**
 * The order the hand is dealt in: least time first.
 *
 * UNKNOWN SORTS LAST, not first. A subject with no usual yet — a new account,
 * or one added this week — has not been starved, it has not been measured, and
 * putting "we don't know" at the head of a list headed by the problem is the
 * page claiming something it cannot see. Mastery breaks ties, so between two
 * subjects getting the same half hour, the one you know least leads.
 */
export function usualOrder(rows = [], minutesFor) {
    const key = (r) => {
        const m = minutesFor(r);
        return m == null ? Number.POSITIVE_INFINITY : m;
    };
    return [...rows].sort((a, b) =>
        key(a) - key(b)
        || (a.mastery || 0) - (b.mastery || 0)
        || String(a.subject).localeCompare(String(b.subject)));
}

/**
 * What goes in the card's corner: "2h/wk", "1.5h/wk", "45m/wk", "—".
 *
 * Short, because it prints at 9px in the corner of a 92px card, and ROUNDED TO
 * THE HALF HOUR above an hour. The underlying figure is a median across weeks,
 * so "3.3h" claims a precision it does not have — and a decimal that changes
 * every time a session lands reads as a live counter rather than as the shape
 * of a normal week. The half is kept because 1.5h and 2h are genuinely
 * different weeks; the tenth is not.
 */
export function usualLabel(minutes) {
    if (minutes == null) return "—";
    if (minutes < 60) return `${Math.round(minutes)}m/wk`;
    const h = Math.round((minutes / 60) * 2) / 2;
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h/wk`;
}

/**
 * The sentence over the hand.
 *
 * Only claims a starved subject when there IS one and there is enough history
 * to know. With no usual yet it says so rather than naming a subject off two
 * days of data — the same rule the week panel keeps about its own baseline.
 */
export function usualLine(rows = [], minutesFor) {
    const known = rows.filter((r) => minutesFor(r) != null);
    if (!known.length) return { kind: "unknown" };
    const thin = known[0];
    const m = minutesFor(thin);
    if (m <= THIN_WEEK_MINUTES) return { kind: "thin", subject: thin.subject, minutes: m };
    return { kind: "even", subject: thin.subject, minutes: m };
}
