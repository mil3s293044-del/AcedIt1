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
 */
import React from "react";

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

function LineChart({ chart, max }) {
    const xs = chart.x;
    const px = (i) => PAD_L + (i / (xs.length - 1)) * plotW;
    const py = (v) => PAD_T + plotH - (v / max) * plotH;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
            aria-label={`${chart.title}. ${chart.series.map(s => `${s.name}: ends at ${s.values[s.values.length - 1]}`).join(". ")}`}>
            {[0, 0.5, 1].map(f => (
                <line key={f} x1={PAD_L} x2={W - PAD_R} y1={py(max * f)} y2={py(max * f)}
                    className="stroke-border" strokeWidth="1" />
            ))}
            {[0, 0.5, 1].map(f => (
                <text key={`t${f}`} x={PAD_L - 5} y={py(max * f) + 3} textAnchor="end"
                    className="fill-muted-foreground text-[9px]">{Math.round(max * f)}</text>
            ))}
            {chart.series.map(s => (
                <g key={s.name}>
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
        </svg>
    );
}

function BarChart({ chart, max }) {
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
                            return (
                                <g key={v.name}>
                                    <rect x={x} y={py(v.value)} width={bw} height={PAD_T + plotH - py(v.value)}
                                        rx="3" className={TONE_FILL[v.tone] || "fill-primary"} opacity="0.9" />
                                    <text x={x + bw / 2} y={py(v.value) - 3} textAnchor="middle"
                                        className="fill-foreground text-[9px] font-bold">{v.value}</text>
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

export default function EvidenceChart({ chart, max }) {
    if (!chart) return null;
    const legend = chart.kind === "bars"
        ? chart.groups[0].values.map(v => ({ name: v.name, tone: v.tone }))
        : chart.series.map(s => ({ name: s.name, tone: s.tone }));
    return (
        <div className="space-y-2">
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
            {chart.kind === "bars" ? <BarChart chart={chart} max={max} /> : <LineChart chart={chart} max={max} />}
            <p className="text-[11px] text-muted-foreground leading-snug">{chart.caption}</p>
        </div>
    );
}
