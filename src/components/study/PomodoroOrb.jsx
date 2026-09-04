/**
 * PomodoroOrb — the running timer, as a clock rather than a number.
 *
 * ─── What it replaces ───────────────────────────────────────────────────────
 * A purple `Clock` glyph beside a mono countdown. The icon was decoration in
 * the exact sense this codebase keeps removing: a picture of a clock sitting
 * next to the time, carrying nothing the digits did not already say.
 *
 * This one carries three things the digits cannot:
 *
 *   THE ARC       how much of the block is left, as a proportion. "12:30" is a
 *                 number you have to divide; a half-empty ring is a glance.
 *   THE HAND      that it is RUNNING. A frozen number and a ticking one look
 *                 identical in a screenshot and nearly identical in the corner
 *                 of your eye; a hand that moves every second does not.
 *   THE COLOUR    work or break, before you read a word.
 *
 * ─── The hand ticks; it does not sweep ──────────────────────────────────────
 * One step per second, six degrees at a time, the way a wall clock moves. A
 * smooth sweep would need an animation frame every 16ms for something the
 * student is not looking at — this is a fixed widget on every page in the app,
 * and it should cost one render per second and nothing else.
 *
 * ─── Drawn from the SAME numbers the digits use ─────────────────────────────
 * `left` and `total` in seconds, and nothing else. The ring cannot disagree
 * with the countdown beside it because there is only one source for both. When
 * `total` is missing — an older saved state with no settings in it — the ring
 * is simply not drawn rather than being drawn against a guess.
 */
import React from "react";

const R = 19;                       // radius of the progress ring
const SIZE = 48;
const MID = SIZE / 2;

/**
 * The remaining slice, from twelve o'clock, clockwise.
 *
 * `frac` is what is LEFT, so the arc shortens toward the top as the block runs
 * down — the same direction a real hand travels, which is why it can be read
 * without thinking about it.
 */
function arcPath(frac) {
    const theta = frac * 2 * Math.PI;
    const x = MID + R * Math.sin(theta);
    const y = MID - R * Math.cos(theta);
    // sweep-flag 1 is clockwise; large-arc kicks in past the halfway mark.
    return `M ${MID} ${MID - R} A ${R} ${R} 0 ${frac > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

/**
 * Static tones. Green is the work block; the break is amber, and that is
 * information rather than decoration — which of the two you are in is the
 * thing you most want to know from across the room, and it should not require
 * reading "Break Time" in 11px.
 */
const TONE = {
    work:  { varName: "--primary", text: "text-primary", ring: "stroke-primary" },
    break: { varName: "--xp",      text: "text-xp",      ring: "stroke-xp" },
};

export default function PomodoroOrb({ left = 0, total = 0, isBreak = false, size = SIZE }) {
    const tone = isBreak ? TONE.break : TONE.work;

    /**
     * TWO STOPS, BOTH BELOW FULL STRENGTH — a defined edge and a modest bloom.
     *
     * This was one `drop-shadow(0 0 5px)` at the token's full alpha, which is
     * fine on cream and wrong on a dark page: with nothing to absorb it the
     * bloom spread across the whole orb and came out as a fuzzy green smear,
     * the loudest thing on a widget that floats over every screen in the app.
     * Nothing else in the dark theme glows like that. Same idiom BrandMark
     * uses on the side rail: tight for the edge, wide and faint for the halo.
     */
    const glow = `drop-shadow(0 0 2px hsl(var(${tone.varName}) / 0.55))`
        + ` drop-shadow(0 0 7px hsl(var(${tone.varName}) / 0.28))`;

    // Remaining, not elapsed: the ring empties as the block runs down, so a
    // nearly-gone ring means a nearly-gone block without any inversion to do
    // in your head.
    const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : null;

    // Ticks with the countdown, because it is derived from it. A separate
    // clock would drift out of step with the digits within a minute.
    const seconds = Math.max(0, Math.floor(left)) % 60;
    // 12 o'clock is -90°, and the hand runs backwards with the count so it
    // sweeps toward the top as the block ends.
    const handAngle = -90 + (60 - seconds) % 60 * 6;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}
            className={tone.text} aria-hidden="true"
            style={{ filter: glow }}>
            {/* The face. Kept very quiet — it is a bezel, not content. */}
            <circle cx={MID} cy={MID} r={R + 3}
                className="fill-surface stroke-current" strokeOpacity={0.18} strokeWidth={1} />

            {/* Hour ticks. Four, not twelve: at 48px, twelve marks is a grey
                smudge, and the quarters are what a glance actually reads. */}
            {[0, 90, 180, 270].map((deg) => (
                <line key={deg}
                    x1={MID} y1={MID - R + 1} x2={MID} y2={MID - R + 4}
                    className="stroke-current" strokeOpacity={0.35} strokeWidth={1.5}
                    strokeLinecap="round"
                    transform={`rotate(${deg} ${MID} ${MID})`} />
            ))}

            {/* The track, then the arc over it.

                DRAWN AS A REAL ARC, not a dash-offset on a circle. The
                dasharray trick is the usual idiom and it is ambiguous about
                DIRECTION — an SVG circle's start point and winding are not
                something you can read off the code, and the first version of
                this ran anticlockwise, which on a clock face is the one thing
                it must not do. An explicit arc with sweep-flag 1 is clockwise
                and stays clockwise. */}
            {frac != null && (
                <>
                    <circle cx={MID} cy={MID} r={R} fill="none"
                        className="stroke-current" strokeOpacity={0.15} strokeWidth={3} />
                    {frac >= 0.999 ? (
                        <circle cx={MID} cy={MID} r={R} fill="none"
                            className={tone.ring} strokeWidth={3} />
                    ) : frac > 0.001 && (
                        <path d={arcPath(frac)} fill="none"
                            className={tone.ring} strokeWidth={3} strokeLinecap="round" />
                    )}
                </>
            )}

            {/* The second hand. No CSS transition on the rotation: a wall clock
                steps, and a 1s ease between steps reads as a lag rather than a
                tick. */}
            <line x1={MID} y1={MID} x2={MID} y2={MID - R + 5}
                className="stroke-current" strokeWidth={1.5} strokeLinecap="round"
                strokeOpacity={0.9}
                transform={`rotate(${handAngle + 90} ${MID} ${MID})`} />

            <circle cx={MID} cy={MID} r={2} className="fill-current" />
        </svg>
    );
}
