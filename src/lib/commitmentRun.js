/**
 * commitmentRun — how many cards the day's promise is worth, and how many of
 * them you have turned over.
 *
 * Lives in lib rather than in the component for the same reason studyMove
 * does: it is the part with branching and rounding in it, and a component file
 * cannot be imported by a plain node test. Two of its three interesting cases
 * (a target long enough to rescale the block, and the floor-versus-round call)
 * are invisible in any screenshot.
 */

/** Never fewer than 6 cards and never more than 12, whatever the target. */
export const MIN_CARDS = 6;
export const MAX_CARDS = 12;

/**
 * How long one card is worth.
 *
 * Five minutes reads as a pomodoro-ish unit and gives a 45-minute commitment
 * nine cards, which is a hand. Past an hour the block grows so the row stays
 * countable: the number you want to see at a glance is how many are LEFT, and
 * nobody glances at twenty-four of anything.
 */
export function blockFor(targetMins) {
    const t = Math.max(1, Number(targetMins) || 0);
    if (t <= MAX_CARDS * 5) return 5;
    return Math.ceil(t / MAX_CARDS);
}

export function runOf(commitment) {
    const target = Math.max(1, Number(commitment?.target) || 0);
    const done = Math.max(0, Number(commitment?.done) || 0);
    const block = blockFor(target);
    const total = Math.min(MAX_CARDS, Math.max(MIN_CARDS, Math.ceil(target / block)));
    // Floor, not round: a card turns when the block is BEHIND you. Rounding
    // would flip the last card two and a half minutes in and claim five.
    const turned = Math.min(total, Math.floor(done / block));
    return { total, turned, block };
}
