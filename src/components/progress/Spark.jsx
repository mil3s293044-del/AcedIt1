/**
 * Spark — the headline figure's own line across the window.
 *
 * ─── A PAGE CALLED PROGRESS HAD NO TRAJECTORY ───────────────────────────────
 * Every figure here was a point reading with one movement chip beside it, on
 * the one screen whose entire subject is movement. The daily buckets were
 * already computed for the day-by-day bars; this draws them under the number
 * they belong to, which is what turns a readout into instrumentation.
 *
 * ─── IT IS NOT A CHART AND MUST NOT BECOME ONE ──────────────────────────────
 * No axes, no gridlines, no tooltip, no legend. The figure beside it IS the
 * value and the window is stated in the label — a sparkline that grows a
 * y-axis has become a panel, which is the 240px box this deliberately is not.
 * recharts is in the bundle and is the wrong tool at 40px: it mounts a
 * ResizeObserver and a tree of components to draw one polyline.
 *
 * ─── A GAP IS A GAP, NEVER A ZERO ───────────────────────────────────────────
 * `dailySeries` emits `value: null` for a day an AVERAGE has no rows for, and
 * the line BREAKS there rather than diving to the floor. A rest day drawn at
 * zero says the student scored nothing that day, which is the chart form of
 * the `Number(null) === 0` trap this codebase keeps meeting. A count series
 * has real zeroes and plots them.
 *
 * ─── THE SCALE STARTS AT ZERO AND HAS A FLOOR ───────────────────────────────
 * Auto-scaling to the data's own min draws a wander between 70% and 72% as a
 * mountain range — the lesson `PriceChart`'s `MIN_SPAN` records. The band is
 * 0..max for a count (where zero is meaningful) and padded around the data
 * for a percentage, never narrower than `MIN_SPAN`.
 *
 * ─── AND IT DRAWS NOTHING RATHER THAN A STRAIGHT LINE ───────────────────────
 * Under `MIN_POINTS` real values there is no trajectory to show, and two
 * points joined up is a direction invented from one comparison — the same
 * refusal `TREND_MIN`, `CALIBRATION_MIN` and `MIN_BASELINE_WEEKS` each make.
 */
import React, { useId } from "react";
import { spanOf, runsOf, MIN_POINTS } from "@/lib/spark";

const W = 100;
const H = 28;

export default function Spark({ series = [], tone = "primary", percent = false, label }) {
    const gid = useId();
    const pts = Array.isArray(series) ? series : [];
    const real = pts.filter((p) => Number.isFinite(p?.value));
    if (real.length < MIN_POINTS) return null;

    const { lo, hi } = spanOf(real.map((p) => p.value), percent);
    const x = (i) => (pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2);
    const y = (v) => H - ((v - lo) / (hi - lo)) * H;

    // ONE PATH PER UNBROKEN RUN. A single `d` across a null would join the
    // days either side of a gap, which is the invented reading above.
    const runs = runsOf(pts).map((r) => r.map(([i, v]) => [x(i), y(v)]));

    const d = (r) => r.map(([px, py], i) =>
        `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    const longest = runs.reduce((a, b) => (b.length > a.length ? b : a), []);
    const last = longest[longest.length - 1];

    const stroke = tone === "streak" ? "stroke-streak" : tone === "chart-3" ? "stroke-chart-3" : "stroke-primary";
    const fill = tone === "streak" ? "fill-streak" : tone === "chart-3" ? "fill-chart-3" : "fill-primary";

    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
            className="w-full h-7 overflow-visible" role="img"
            aria-label={label || `Trend across the period, ${real.length} days with activity`}>
            <defs>
                {/* The wash is what stops a 1px line reading as a scratch on a
                    wide strip. Clipped to the longest run so a gap stays a gap. */}
                <linearGradient id={`sp${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className={fill} stopOpacity="0.18" />
                    <stop offset="100%" className={fill} stopOpacity="0" />
                </linearGradient>
            </defs>
            {longest.length > 1 && (
                <path d={`${d(longest)} L${longest[longest.length - 1][0].toFixed(1)},${H} L${longest[0][0].toFixed(1)},${H} Z`}
                    fill={`url(#sp${gid})`} />
            )}
            {runs.map((r, i) => (
                <path key={i} d={d(r)} className={`${stroke} fill-none`} strokeWidth="1.75"
                    vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {/* WHERE YOU ARE NOW. The rightmost real point, so the eye lands on
                today rather than on the shape in the middle. */}
            {last && <circle cx={last[0]} cy={last[1]} r="2.5" className={fill}
                vectorEffect="non-scaling-stroke" />}
        </svg>
    );
}
