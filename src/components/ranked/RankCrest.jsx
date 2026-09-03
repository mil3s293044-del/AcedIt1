/**
 * RankCrest — the rank as an object, not a line of text.
 *
 * ─── What it replaces ───────────────────────────────────────────────────────
 * A generic amber `Trophy` glyph in a rounded square, printed identically for
 * all ten tiers, next to the rank's name. Every rank looked like every other
 * rank, which is the one thing a ladder must not do: if tier 2 and tier 9 are
 * drawn the same, arriving at tier 9 is a string change. And the trophy was
 * decoration in the exact sense this codebase keeps removing — a picture of a
 * prize beside the word for the prize.
 *
 * The crest carries three things the name cannot:
 *
 *   THE TIER      a numeral, so where you are in the ten is readable at a
 *                 glance rather than something you work out from the name.
 *   THE COLOUR    each rank's own, so the badge changes visibly as you climb.
 *                 This is why ranks are worth reaching.
 *   THE PROGRESS  a ring around the crest, so the next tier is a distance you
 *                 can see rather than a percentage you have to read.
 *
 * ─── The ring is a real arc ─────────────────────────────────────────────────
 * Drawn as an explicit arc path with sweep-flag 1, not a dash offset on a
 * circle — the dash idiom is ambiguous about winding and comes out
 * anticlockwise as often as not. PomodoroOrb records the same lesson.
 */
import React from "react";

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

/** From twelve o'clock, clockwise. `frac` is how far through the tier. */
function arcPath(frac, mid, r) {
    // A full ring has no start and end to distinguish, so a 360° arc collapses
    // to a point. Stop just short and the join is invisible at this size.
    const f = Math.min(frac, 0.9999);
    const theta = f * 2 * Math.PI;
    const x = mid + r * Math.sin(theta);
    const y = mid - r * Math.cos(theta);
    return `M ${mid} ${mid - r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

/** A hexagon — the shape a rank badge has been since badges existed. */
function hexPoints(mid, r) {
    return Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;      // flat-top, point-up
        return `${mid + r * Math.sin(a)},${mid - r * Math.cos(a)}`;
    }).join(" ");
}

export default function RankCrest({
    rank, pct = 0, size = 96, showRing = true, className = "",
}) {
    const S = 100, MID = S / 2;
    const RING = 45;
    // With no ring there is no reason to leave room for one. A rung in the
    // ladder is drawn at 38px, and at the ringed hex size its tier numeral
    // came out about eight pixels tall — present, unreadable, and therefore
    // not doing the one job the numeral is here for.
    const HEX = showRing ? 33 : 46;
    const colour = rank?.color || "#64748b";
    const frac = clamp01(pct / 100);

    return (
        <svg width={size} height={size} viewBox={`0 0 ${S} ${S}`} className={className}
            role="img"
            aria-label={`${rank?.name || "Unranked"}, tier ${rank?.tier ?? "?"} of 10`}>
            {showRing && (
                <>
                    <circle cx={MID} cy={MID} r={RING} fill="none"
                        className="stroke-border" strokeWidth={4} />
                    {frac > 0.004 && (
                        <path d={arcPath(frac, MID, RING)} fill="none"
                            stroke={colour} strokeWidth={4} strokeLinecap="round" />
                    )}
                </>
            )}

            {/* The crest. A flat wash rather than a gradient: at 96px a
                three-stop gradient is mud, and the rank's colour is the
                identity — it should be the colour, not an average of three. */}
            <polygon points={hexPoints(MID, HEX)} fill={colour} />
            {/* An inner rule, the same trick PlayingCard uses to turn a shape
                into something that looks printed rather than filled. */}
            <polygon points={hexPoints(MID, HEX - (showRing ? 4 : 5))} fill="none"
                stroke="#fff" strokeOpacity={0.35} strokeWidth={1.5} />

            <text x={MID} y={MID} textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize={showRing ? 26 : 36} fontWeight={900}
                style={{ fontFamily: "inherit", letterSpacing: "-0.02em" }}>
                {rank?.tier ?? "?"}
            </text>
        </svg>
    );
}
