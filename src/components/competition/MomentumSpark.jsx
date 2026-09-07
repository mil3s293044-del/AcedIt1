/**
 * MomentumSpark — the win-probability trail for a battle, drawn so you can
 * actually see it move.
 *
 * ─── The bug this replaces ──────────────────────────────────────────────────
 * BattleRow already drew this line, and it was very nearly useless, because it
 * scaled to a fixed 0–100:
 *
 *     const lo = Math.min(...ps, 0), hi = Math.max(...ps, 100);
 *
 * Both terms are constants — the seeds pin the range open — so every battle was
 * plotted on the full scale. A race swinging from 48% to 55%, which is the
 * whole story of a close battle, moved the line 1.4 pixels inside a 20-pixel
 * box and read as flat. The one shape that could tell a student the race was
 * turning was the shape that got flattened.
 *
 * It scales to the DATA now, with a floor. The floor matters as much as the
 * scaling: without it, a genuinely steady battle would be stretched to fill the
 * box and read as violent swings, which is the same lie in the other direction.
 * `MIN_SPAN` is the smallest range worth drawing at full height — below it, the
 * line stays visibly calm.
 *
 * ─── Fifty per cent is drawn, because it is what the line MEANS ─────────────
 * A win-probability trail without the coin-flip on it is just a wiggle. With
 * it, crossing the line is the event: the moment a lead stopped being a lead.
 * The area between the line and 50 is tinted for the same reason — the
 * distance from even is the story, not the absolute height.
 *
 * ─── Nothing is drawn from nothing ──────────────────────────────────────────
 * Under three points there is no shape, only noise, and a two-point line is a
 * straight segment that claims a trend the data cannot support. It renders
 * null and the row says nothing, which is what the codebase does everywhere
 * else it lacks the evidence.
 */
import React, { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

const W = 100;
const H = 22;
const EVEN = 50;

/** The smallest probability range that gets the full height of the box. */
const MIN_SPAN = 24;

export default function MomentumSpark({ series, className = "" }) {
    const reduce = useReducedMotion();
    const uid = `ms${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

    const pts = Array.isArray(series)
        ? series.map((d) => Number(d?.p)).filter((n) => Number.isFinite(n))
        : [];
    if (pts.length < 3) return null;

    // Scale to the data, centred, never tighter than MIN_SPAN — and always
    // wide enough to include the 50 line, or the thing the line is measured
    // against would sit off the top of its own chart.
    const lo0 = Math.min(...pts, EVEN);
    const hi0 = Math.max(...pts, EVEN);
    const mid = (lo0 + hi0) / 2;
    const span = Math.max(MIN_SPAN, hi0 - lo0);
    const lo = mid - span / 2;

    const x = (i) => (i / (pts.length - 1)) * W;
    const y = (p) => H - ((p - lo) / span) * H;

    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(" ");
    const evenY = y(EVEN);
    // Closed back to the 50 line rather than to the floor: the fill is the
    // distance from even, which is what the reader is being asked to judge.
    const area = `${line} L${W} ${evenY.toFixed(1)} L0 ${evenY.toFixed(1)} Z`;

    const last = pts[pts.length - 1];
    const up = last >= EVEN;
    const stroke = up ? "hsl(var(--primary))" : "hsl(var(--streak))";

    // The dot's position as a FRACTION, so it can be drawn outside the
    // stretched coordinate system. See below for why it cannot live in the SVG.
    const dotTop = ((y(last)) / H) * 100;

    return (
        <div className={`relative w-full h-6 ${className}`}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                className="w-full h-full" aria-hidden="true">
                <defs>
                    {/* ONE clip reveals both the line and the fill.
                        The obvious way to draw a line on is framer's
                        `pathLength`, which it implements as a stroke dash — and
                        a dash pattern inside a `preserveAspectRatio="none"`
                        viewBox is stretched horizontally by however much the box
                        is wider than it is tall, so the line rendered with gaps
                        torn through it. A clip rectangle has no such geometry to
                        distort, and revealing both marks together is what makes
                        the sweep read as one gesture. */}
                    <clipPath id={`${uid}-c`}>
                        <motion.rect x="0" y={-H} height={H * 3}
                            initial={{ width: reduce ? W : 0 }} animate={{ width: W }}
                            transition={{ duration: reduce ? 0 : 0.7, ease: "easeOut" }} />
                    </clipPath>
                </defs>

                {/* Even. Dashed, so it reads as a reference and not as data.
                    Its dashes stretch too, which is fine — a reference line is
                    allowed to be a texture. */}
                <line x1="0" y1={evenY} x2={W} y2={evenY}
                    stroke="currentColor" strokeOpacity="0.25" strokeWidth="1"
                    strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
                    className="text-foreground" />

                <g clipPath={`url(#${uid}-c)`}>
                    <path d={area} fill={stroke} fillOpacity="0.14" />
                    <path d={line} fill="none" stroke={stroke} strokeWidth="1.5"
                        strokeLinejoin="round" strokeLinecap="round"
                        vectorEffect="non-scaling-stroke" />
                </g>
            </svg>

            {/* Where it stands now, drawn as HTML rather than as an SVG circle.
                The viewBox is stretched non-uniformly, so a circle inside it
                renders as an ellipse — the dot came out as a flattened oval.
                Positioned by percentage out here, it is a circle at any width. */}
            <motion.span
                className="absolute w-[7px] h-[7px] rounded-full border-2 border-surface"
                style={{ background: stroke, right: 0, top: `${dotTop}%`,
                    marginTop: -3.5, marginRight: -3.5 }}
                initial={{ scale: reduce ? 1 : 0 }} animate={{ scale: 1 }}
                transition={{ delay: reduce ? 0 : 0.6, type: "spring", stiffness: 500, damping: 20 }} />
        </div>
    );
}
