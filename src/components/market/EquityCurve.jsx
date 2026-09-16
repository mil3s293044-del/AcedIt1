/**
 * EquityCurve — the cumulative consequence of your own calls.
 *
 * ─── IT IS RESULTS, NOT BALANCE ─────────────────────────────────────────────
 * A balance chart would be dominated by the Monday grant and the top-up, and
 * neither of those is anything the student did — the line would step up every
 * week regardless of whether they read a single market correctly, which is the
 * opposite of what a performance chart is for. This is the running total of
 * settled payouts: the part of the number they actually control, starting at
 * zero on their first result.
 *
 * ─── One series, coloured by sign ───────────────────────────────────────────
 * Green up and red down is a STATUS use of colour (good/bad), which is the one
 * legitimate reason to reach for those two hues — and the sign is printed in
 * the figure beside the line, so a reader who cannot separate the two hues
 * still has the number. The zero rule is a solid hairline, not a dash: it is an
 * axis, and dashing an axis reads as a projection.
 *
 * Step-free, unlike PriceChart: a payout lands at a moment and the line between
 * two settlements is genuinely nothing happening, so a straight segment is an
 * honest join rather than an invented path through values nobody traded at.
 */
import React from "react";

const INK = {
    up: "var(--floor-yes-ink)", down: "var(--floor-no-ink)", flat: "var(--floor-muted-2)",
    zero: "var(--floor-dimmest)", dim: "var(--floor-dim)", mid: "var(--floor-muted)", bright: "var(--floor-ink)",
};

export default function EquityCurve({ curve, height = 120, footer = true }) {
    const pts = curve?.points || [];
    if (pts.length < 2) {
        return (
            <p className="text-[11px] leading-snug" style={{ color: INK.dim }}>
                Nothing has settled yet. This fills in as your calls resolve.
            </p>
        );
    }

    const ink = curve.last > 0 ? INK.up : curve.last < 0 ? INK.down : INK.flat;
    const t0 = pts[0].t;
    const span = Math.max(1, pts[pts.length - 1].t - t0);
    // Padded so the line never runs along the very edge, and always including
    // zero — a curve that has only ever been positive still needs its baseline
    // on screen or the reader cannot see how far above it they are.
    const hi = Math.max(curve.high, 0) + Math.max(6, Math.abs(curve.high) * 0.12);
    const lo = Math.min(curve.low, 0) - Math.max(6, Math.abs(curve.low) * 0.12);
    const x = (t) => ((t - t0) / span) * 100;
    const y = (v) => ((hi - v) / (hi - lo)) * 100;

    const line = pts.map((p, i) => `${i ? "L" : "M"} ${x(p.t)} ${y(p.value)}`).join(" ");
    const area = `${line} L 100 ${y(0)} L 0 ${y(0)} Z`;

    return (
        <div>
            <div className="relative w-full rounded-xl overflow-hidden"
                style={{ height, background: "var(--floor-well)" }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100"
                    preserveAspectRatio="none">
                    <line x1="0" x2="100" y1={y(0)} y2={y(0)}
                        stroke={INK.zero} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <path d={area} fill={ink} opacity="0.1" />
                    <path d={line} fill="none" stroke={ink} strokeWidth="2"
                        strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {/* The endpoint, direct-labelled. Selective on purpose: a number
                    beside every settlement is chaos and goes unread. */}
                <span className="absolute rounded-full"
                    style={{
                        left: "100%", top: `${y(curve.last)}%`, width: 7, height: 7,
                        background: ink, transform: "translate(-100%, -50%)",
                    }} />
                <span className="absolute text-[9px] font-bold px-1 rounded tabular-nums"
                    style={{ color: INK.dim, background: "var(--floor-well)", left: 4, top: `calc(${y(0)}% - 7px)` }}>
                    0
                </span>
            </div>
            {/* OFF WHERE A HERO ALREADY PRINTS THE FIGURE. The book leads with
                this exact number four inches above the chart, and a curve that
                restates its own headline underneath is the finding said twice —
                which this codebase refuses everywhere from MarkPanel to the
                dashboard's footer strip. It stays on anywhere the chart has to
                explain itself. */}
            {footer && (
                <p className="text-[11px] mt-1.5 leading-snug" style={{ color: INK.mid }}>
                    <span className="font-bold tabular-nums" style={{ color: ink }}>
                        {curve.last > 0 ? "+" : ""}{curve.last.toLocaleString()} cred
                    </span>
                    {" from "}{pts.length - 1} settled {pts.length === 2 ? "call" : "calls"}
                    {curve.best > 0 && (
                        <span style={{ color: INK.dim }}>
                            {" "}· best +{curve.best.toLocaleString()}
                        </span>
                    )}
                </p>
            )}
        </div>
    );
}
