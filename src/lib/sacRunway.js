/**
 * sacRunway — how a countdown should look at each distance.
 *
 * The hero was one gradient with a single branch in it: three days or fewer
 * went red-orange, everything else went blue-purple. So a SAC eleven days out
 * and one three weeks out were the same picture, and the day it flipped was
 * the only day the card ever changed. A countdown whose design never counts is
 * a number in a coloured box.
 *
 * Five bands, matching the five SAC_MOOD bands Ace already speaks from, so the
 * picture and the sentence never disagree. The ramp runs cool to hot through
 * the brand tokens — chart-3, chart-4, primary, xp, streak — which also means
 * the card belongs to the app rather than to a gradient generator.
 *
 * `urgency` (0 → 1) is the one number the UI animates against: it scales the
 * runway, the pulse and how tightly Ace holds himself. One source, so nothing
 * gets out of step with anything else.
 *
 * Static Tailwind class strings throughout — JIT cannot see a template literal.
 */

export const RUNWAY_MAX = 14;

const BANDS = [
    {
        id: "today", within: 0, label: "It's today", urgency: 1,
        grad: "bg-gradient-to-br from-streak via-streak to-xp",
        pip: "bg-white", pipDim: "bg-white/25", chip: "bg-white/20 hover:bg-white/30",
        glow: "shadow-[0_0_60px_-12px_rgba(255,255,255,0.35)]",
    },
    {
        id: "tomorrow", within: 1, label: "Crunch time", urgency: 1,
        grad: "bg-gradient-to-br from-streak via-streak to-xp",
        pip: "bg-white", pipDim: "bg-white/25", chip: "bg-white/20 hover:bg-white/30",
        glow: "shadow-[0_0_60px_-12px_rgba(255,255,255,0.35)]",
    },
    {
        id: "close", within: 3, label: "Closing in", urgency: 0.75,
        grad: "bg-gradient-to-br from-xp via-xp to-streak",
        pip: "bg-white", pipDim: "bg-white/25", chip: "bg-white/20 hover:bg-white/30",
        glow: "",
    },
    {
        id: "week", within: 7, label: "The good window", urgency: 0.5,
        grad: "bg-gradient-to-br from-primary via-primary to-chart-3",
        pip: "bg-white", pipDim: "bg-white/25", chip: "bg-white/20 hover:bg-white/30",
        glow: "",
    },
    {
        id: "fortnight", within: 14, label: "Room to work", urgency: 0.28,
        grad: "bg-gradient-to-br from-chart-4 via-chart-4 to-primary",
        pip: "bg-white", pipDim: "bg-white/25", chip: "bg-white/20 hover:bg-white/30",
        glow: "",
    },
    {
        id: "far", within: Infinity, label: "On the horizon", urgency: 0.1,
        grad: "bg-gradient-to-br from-chart-3 via-chart-3 to-chart-4",
        pip: "bg-white", pipDim: "bg-white/25", chip: "bg-white/20 hover:bg-white/30",
        glow: "",
    },
];

/** The band a distance falls in. Never null — "no date" is the calmest band. */
export function sacBand(days) {
    const d = Number.isFinite(days) ? Math.max(0, days) : Infinity;
    return BANDS.find((b) => d <= b.within) || BANDS[BANDS.length - 1];
}

/**
 * The runway itself: one marker per day left, capped.
 *
 * `lit` are the days you still have. Beyond the cap the strip is drawn full
 * with an overflow flag, because "twenty-three pips" is not a readable
 * quantity and the honest message that far out is simply "plenty".
 */
export function runway(days) {
    const d = Number.isFinite(days) ? Math.max(0, Math.round(days)) : null;
    if (d == null) return { lit: 0, total: RUNWAY_MAX, overflow: true, today: false };
    if (d === 0) return { lit: 0, total: RUNWAY_MAX, overflow: false, today: true };
    return {
        lit: Math.min(d, RUNWAY_MAX),
        total: RUNWAY_MAX,
        overflow: d > RUNWAY_MAX,
        today: false,
    };
}

/**
 * How many cards are left in the fan behind the number.
 *
 * The old watermark was a flag at a fixed size — the same picture on every day
 * of the countdown. The fan thins as the date approaches, so the background is
 * carrying the story too, and a fanned card is the most on-brand shape this
 * app has.
 */
export function fanCards(days) {
    const d = Number.isFinite(days) ? Math.max(0, days) : RUNWAY_MAX;
    if (d <= 1) return 1;
    if (d <= 3) return 2;
    if (d <= 7) return 3;
    if (d <= 14) return 4;
    return 5;
}
