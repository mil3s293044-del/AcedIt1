/**
 * EvidenceChart — the "with it vs without it" graphs.
 *
 * Hand-rolled SVG rather than recharts. Two reasons: these are two fixed chart
 * shapes rather than a charting need, and every number on screen has to be
 * assertable in a test — a claim about study evidence that silently renders
 * the wrong bar is worse than no chart.
 *
 * Every chart carries its provenance. `schematic` means the SHAPE is from the
 * published result but the points are drawn, not reproduced. `approx` means
 * the headline numbers are reproduced approximately. Neither is allowed to
 * render without saying so — see the badge below.
 *
 * ─── The animation IS the finding ───────────────────────────────────────────
 * Most of these charts are a crossover: one side wins on the day and loses a
 * week later. Bars grow GROUP BY GROUP, so the first moment is shown before
 * the second and the reversal happens in front of the student, which is the
 * one thing a static bar chart cannot do. A line draws itself left to right,
 * which is time passing. It plays once, when the chart comes into view, and
 * under reduced motion it is simply drawn.
 *
 * `marker` puts a running Pomodoro on the attention curve: "You · 12 min".
 * It moves as the block runs, and is the only part of a chart that changes
 * after it has drawn.
 */
import React, { useId, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const TONE_STROKE = {
    primary: "stroke-primary", xp: "stroke-xp", streak: "stroke-streak",
    "chart-3": "stroke-chart-3", "chart-4": "stroke-chart-4", map: "stroke-map",
};
const TONE_FILL = {
    primary: "fill-primary", xp: "fill-xp", streak: "fill-streak",
    "chart-3": "fill-chart-3", "chart-4": "fill-chart-4", map: "fill-map",
};
const TONE_DOT = {
    primary: "bg-primary", xp: "bg-xp", streak: "bg-streak",
    "chart-3": "bg-chart-3", "chart-4": "bg-chart-4", map: "bg-map",
};

const W = 320, H = 150, PAD_L = 30, PAD_B = 24, PAD_T = 10, PAD_R = 8;
const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;

function Provenance({ chart }) {
    if (!chart.schematic && !chart.approx) return null;
    return (
        <span className="pill bg-secondary text-muted-foreground text-[10px] flex-shrink-0"
            title={chart.schematic
                ? "The shape is from the published result; the points are drawn to illustrate it, not reproduced from the dataset."
                : "Headline figures reproduced approximately from the published result."}>
            {chart.schematic ? "shape of the finding" : "approx. figures"}
        </span>
    );
}

/** Where a value on the x axis lands, for a marker between two sampled points. */
function xAt(xs, value) {
    const lo = xs[0], hi = xs[xs.length - 1];
    const v = Math.max(lo, Math.min(hi, value));
    let i = 0;
    while (i < xs.length - 2 && xs[i + 1] < v) i++;
    const span = xs[i + 1] - xs[i] || 1;
    const t = (v - xs[i]) / span;
    return PAD_L + ((i + t) / (xs.length - 1)) * plotW;
}

function LineChart({ chart, max, play, still, marker }) {
    const xs = chart.x;
    const clip = `ln${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    const px = (i) => PAD_L + (i / (xs.length - 1)) * plotW;
    const py = (v) => PAD_T + plotH - (v / max) * plotH;
    const mx = marker && Number.isFinite(marker.x) ? xAt(xs, marker.x) : null;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
            aria-label={`${chart.title}. ${chart.series.map(s => `${s.name}: ends at ${s.values[s.values.length - 1]}`).join(". ")}${marker?.label ? `. ${marker.label}` : ""}`}>
            {/* The line draws by REVEALING a clip, not by tweening the path:
                every series is drawn whole and uncovered left to right, so the
                points and the stroke can never disagree mid-animation. */}
            <defs>
                <clipPath id={clip}>
                    <motion.rect x={0} y={0} height={H}
                        initial={false}
                        animate={{ width: still || play ? W : PAD_L }}
                        transition={{ duration: still ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }} />
                </clipPath>
            </defs>
            {[0, 0.5, 1].map(f => (
                <line key={f} x1={PAD_L} x2={W - PAD_R} y1={py(max * f)} y2={py(max * f)}
                    className="stroke-border" strokeWidth="1" />
            ))}
            {[0, 0.5, 1].map(f => (
                <text key={`t${f}`} x={PAD_L - 5} y={py(max * f) + 3} textAnchor="end"
                    className="fill-muted-foreground text-[9px]">{Math.round(max * f)}</text>
            ))}
            {chart.series.map(s => (
                <g key={s.name} clipPath={`url(#${clip})`}>
                    <path d={s.values.map((v, i) => `${i ? "L" : "M"} ${px(i)} ${py(v)}`).join(" ")}
                        fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={TONE_STROKE[s.tone] || "stroke-primary"} />
                    {s.values.map((v, i) => (
                        <circle key={i} cx={px(i)} cy={py(v)} r="2.6"
                            className={TONE_FILL[s.tone] || "fill-primary"} />
                    ))}
                </g>
            ))}
            {xs.map((x, i) => (
                (i === 0 || i === xs.length - 1 || i === Math.floor(xs.length / 2)) && (
                    <text key={x} x={px(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === xs.length - 1 ? "end" : "middle"}
                        className="fill-muted-foreground text-[9px]">{x}</text>
                )
            ))}
            {/* You, on the curve. Drawn in the foreground ink so it reads as a
                different kind of mark from either series. */}
            {mx != null && (
                <motion.g data-chart-marker initial={false} animate={{ x: mx }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}>
                    <line x1={0} x2={0} y1={PAD_T} y2={PAD_T + plotH} className="stroke-foreground"
                        strokeWidth="1.5" strokeDasharray="3 3" />
                    <circle cx={0} cy={PAD_T + plotH} r="3" className="fill-foreground" />
                    {/* Low in the plot, where the curves are not: an attention
                        curve lives near the top, and the label sat on both lines. */}
                    <text x={0} y={PAD_T + plotH - 7} textAnchor={mx > W - 70 ? "end" : "start"} dx={mx > W - 70 ? -6 : 6}
                        className="fill-foreground text-[10px] font-bold">{marker.label}</text>
                </motion.g>
            )}
        </svg>
    );
}

function BarChart({ chart, max, play, still }) {
    const groups = chart.groups;
    const gw = plotW / groups.length;
    const py = (v) => PAD_T + plotH - (v / max) * plotH;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
            aria-label={`${chart.title}. ${groups.map(g => `${g.name}: ${g.values.map(v => `${v.name} ${v.value}`).join(", ")}`).join(". ")}`}>
            {[0, 0.5, 1].map(f => (
                <line key={f} x1={PAD_L} x2={W - PAD_R} y1={py(max * f)} y2={py(max * f)}
                    className="stroke-border" strokeWidth="1" />
            ))}
            {[0, 0.5, 1].map(f => (
                <text key={`t${f}`} x={PAD_L - 5} y={py(max * f) + 3} textAnchor="end"
                    className="fill-muted-foreground text-[9px]">{Math.round(max * f)}</text>
            ))}
            {groups.map((g, gi) => {
                const bw = Math.min(30, (gw - 22) / g.values.length);
                const startX = PAD_L + gi * gw + (gw - bw * g.values.length - 6 * (g.values.length - 1)) / 2;
                return (
                    <g key={g.name}>
                        {g.values.map((v, vi) => {
                            const x = startX + vi * (bw + 6);
                            const floor = PAD_T + plotH;
                            const up = still || play;
                            // Group by group: the first moment lands before the
                            // second, so the crossover happens on screen.
                            const delay = still ? 0 : 0.15 + gi * 0.75 + vi * 0.12;
                            return (
                                <g key={v.name} data-bar={`${gi}-${vi}`}>
                                    <motion.rect x={x} width={bw} rx="3"
                                        className={TONE_FILL[v.tone] || "fill-primary"} opacity="0.9"
                                        initial={false}
                                        animate={up
                                            ? { y: py(v.value), height: floor - py(v.value) }
                                            : { y: floor, height: 0 }}
                                        transition={{ duration: still ? 0 : 0.55, delay, ease: [0.22, 1, 0.36, 1] }} />
                                    <motion.text x={x + bw / 2} y={py(v.value) - 3} textAnchor="middle"
                                        className="fill-foreground text-[9px] font-bold"
                                        initial={false} animate={{ opacity: up ? 1 : 0 }}
                                        transition={{ duration: 0.2, delay: still ? 0 : delay + 0.45 }}>
                                        {v.value}
                                    </motion.text>
                                </g>
                            );
                        })}
                        <text x={PAD_L + gi * gw + gw / 2} y={H - 8} textAnchor="middle"
                            className="fill-muted-foreground text-[9px]">{g.name}</text>
                    </g>
                );
            })}
        </svg>
    );
}

export default function EvidenceChart({ chart, max, marker = null, caption = true }) {
    const ref = useRef(null);
    const play = useInView(ref, { once: true, margin: "-30px" });
    const still = useReducedMotion();
    if (!chart) return null;
    const legend = chart.kind === "bars"
        ? chart.groups[0].values.map(v => ({ name: v.name, tone: v.tone }))
        : chart.series.map(s => ({ name: s.name, tone: s.tone }));
    return (
        <div className="space-y-2" ref={ref}>
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-foreground leading-snug">{chart.title}</p>
                <Provenance chart={chart} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                {legend.map(l => (
                    <span key={l.name} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${TONE_DOT[l.tone] || "bg-primary"}`} />
                        {l.name}
                    </span>
                ))}
            </div>
            {chart.kind === "bars"
                ? <BarChart chart={chart} max={max} play={play} still={still} />
                : <LineChart chart={chart} max={max} play={play} still={still} marker={marker} />}
            {caption && <p className="text-[11px] text-muted-foreground leading-snug">{chart.caption}</p>}
        </div>
    );
}
