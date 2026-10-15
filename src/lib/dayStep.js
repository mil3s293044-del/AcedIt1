/**
 * dayStep — one swipe on the planner's phone agenda.
 *
 * A swipe is a DAY, and a week is just seven of them: swiping past Sunday lands
 * on next Monday rather than stopping at the edge. It may only reach the weeks
 * the board's own chevrons can reach, so the phone and the desktop cannot
 * disagree about how far ahead a student can plan.
 *
 * Returns `{ weekDelta, index }` for the day the swipe lands on, or null when
 * it would leave the bounds. Pure, so the boundary the page relies on is held
 * by a test rather than by reading a ternary.
 */
export function dayStep(index, delta, weekOffset, { min = -1, max = 8 } = {}) {
    if (!Number.isInteger(index) || index < 0 || index > 6) return null;
    const j = index + delta;
    const weekDelta = j < 0 ? -1 : j > 6 ? 1 : 0;
    const week = weekOffset + weekDelta;
    if (week < min || week > max) return null;
    return { weekDelta, index: ((j % 7) + 7) % 7 };
}
