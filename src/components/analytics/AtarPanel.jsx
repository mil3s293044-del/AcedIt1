/**
 * AtarPanel — the AcedIt ATAR on the Analytics page.
 *
 * Analytics had zero references to acedit_atar, atar_components or goal_atar:
 * the score the whole app is standardised around was absent from the one page
 * whose job is telling a student how they're doing.
 *
 * Two things here that Ranked can't show. The trajectory — the score used to be
 * recomputed and overwritten, so "am I improving?" had no answer anywhere in
 * the app until refreshAcedItATAR started snapshotting weekly. And the movement
 * per component, because a flat overall score can hide one slice collapsing
 * while another quietly carries it.
 */
import React from "react";
import { motion } from "framer-motion";
import { GraduationCap, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { atarBandOf } from "@/lib/atarBands";

const fmtMins = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h === 0 ? `${mm}m` : mm === 0 ? `${h}h` : `${h}h ${mm}m`;
};

// Same evidence lines as Ranked — one component, one place, one wording.
const COMPONENTS = [
    {
        key: "mastery", short: "m", label: "Mastery", bar: "bg-chart-4",
        evidence: (c) => {
            const bits = [];
            if (c.quiz_marks) bits.push(`${c.quiz_marks} quiz marks`);
            if (c.cards_reviewed) bits.push(`${c.cards_reviewed} cards`);
            return bits.join(" · ") || "no quizzes or cards yet";
        },
    },
    { key: "consistency", short: "c", label: "Consistency", bar: "bg-streak", evidence: (c) => `${c.study_days ?? 0} of 20 days` },
    { key: "effort", short: "e", label: "Effort", bar: "bg-xp", evidence: (c) => `${fmtMins(c.minutes)} of ~20h` },
    { key: "breadth", short: "b", label: "Breadth", bar: "bg-chart-3", evidence: (c) => `${c.technique_families ?? 0} of 5 techniques` },
    {
        key: "planning", short: "p", label: "Planning", bar: "bg-primary",
        evidence: (c) => {
            const bits = [];
            if (c.goals_set) bits.push(`${c.goals_met ?? 0}/${c.goals_set} goals`);
            if (c.blocks_planned) bits.push(`${c.blocks_kept ?? 0}/${c.blocks_planned} blocks`);
            if (c.intents_declared) bits.push(`${c.intents_kept ?? 0}/${c.intents_declared} intents`);
            return bits.join(" · ") || "nothing planned yet";
        },
    },
];

function Delta({ value }) {
    if (value == null) return null;
    const rounded = Math.round(value * 100) / 100;
    if (Math.abs(rounded) < 0.05) {
        return <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="w-3 h-3" /> level</span>;
    }
    const up = rounded > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-1 font-bold ${up ? "text-primary" : "text-streak"}`}>
            <Icon className="w-3 h-3" /> {up ? "+" : ""}{rounded.toFixed(2)}
        </span>
    );
}

export default function AtarPanel({ atar, band, components, history = [], goalAtar }) {
    const comps = components || {};
    const series = Array.isArray(history) ? history.filter((h) => h && typeof h.a === "number") : [];
    const first = series[0];
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const sinceLast = prev && atar != null ? atar - prev.a : null;
    const sinceStart = first && atar != null && series.length > 1 ? atar - first.a : null;

    // Sparkline geometry. Scaled to the range actually walked, not 0-99.95 —
    // over six months a real student moves a few points and a full-scale axis
    // renders that as a flat line.
    const values = series.map((h) => h.a);
    const lo = Math.min(...values, atar ?? Infinity);
    const hi = Math.max(...values, atar ?? -Infinity);
    const span = Math.max(1, hi - lo);
    const points = series.map((h, i) => {
        const x = series.length === 1 ? 100 : (i / (series.length - 1)) * 100;
        const y = 100 - ((h.a - lo) / span) * 100;
        return `${x},${y}`;
    }).join(" ");

    if (atar == null) {
        return (
            <div className="card-soft p-6">
                <p className="stat-label mb-1">AcedIt ATAR</p>
                <p className="font-display font-extrabold text-foreground text-xl">Not ranked yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Three study days puts you on the board. Everything on this page starts feeding it from then on.
                </p>
            </div>
        );
    }

    return (
        <div className="card-soft p-6 lg:p-7">
            <div className="flex flex-wrap items-start gap-6">
                <div className="min-w-[160px]">
                    <p className="stat-label mb-1 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" /> AcedIt ATAR
                    </p>
                    <p className="font-display font-black text-foreground leading-none" style={{ fontSize: "clamp(2.5rem, 7vw, 3.75rem)" }}>
                        {atar.toFixed(2)}
                    </p>
                    <p className="text-sm font-bold text-muted-foreground mt-1">{band || atarBandOf(atar)}</p>
                    <div className="flex flex-col gap-1 mt-3 text-xs">
                        {sinceLast != null && (
                            <span className="text-muted-foreground">Since last week <Delta value={sinceLast} /></span>
                        )}
                        {sinceStart != null && (
                            <span className="text-muted-foreground">Since you started <Delta value={sinceStart} /></span>
                        )}
                        {goalAtar && atar < goalAtar && (
                            <span className="text-muted-foreground">{(goalAtar - atar).toFixed(2)} off your {goalAtar} goal</span>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-w-[240px] space-y-2.5">
                    {COMPONENTS.map((c) => {
                        const v = comps[c.key] ?? 0;
                        const was = prev?.c?.[c.short];
                        const moved = typeof was === "number" ? v - was : null;
                        return (
                            <div key={c.key}>
                                <div className="flex items-baseline justify-between mb-1 gap-2">
                                    <span className="text-xs font-bold text-foreground">{c.label}</span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                                        {moved != null && Math.abs(moved) >= 1 && (
                                            <span className={moved > 0 ? "text-primary font-bold" : "text-streak font-bold"}>
                                                {moved > 0 ? "+" : ""}{moved}
                                            </span>
                                        )}
                                        <span className="font-bold text-foreground">{v}</span>
                                    </span>
                                </div>
                                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, delay: 0.15 }}
                                        className={`h-full rounded-full ${c.bar}`} />
                                </div>
                                <p className="text-[11px] text-muted-foreground/70 mt-1">{c.evidence(comps)}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Trajectory */}
            <div className="mt-6 pt-5 border-t border-border">
                <div className="flex items-baseline justify-between mb-2">
                    <p className="stat-label">Trajectory</p>
                    {series.length > 1 && (
                        <p className="text-[11px] text-muted-foreground/70">{lo.toFixed(2)} – {hi.toFixed(2)} over {series.length} weeks</p>
                    )}
                </div>
                {series.length > 1 ? (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-20" role="img" aria-label="AcedIt ATAR over time">
                        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"
                            vectorEffect="non-scaling-stroke" className="text-chart-4" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                ) : (
                    <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Your score is snapshotted once a week — the line appears here from your second one.
                    </p>
                )}
            </div>

            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Measures how you've studied over the last 28 days. It's yours to change, and it is not a VCAA prediction.
            </p>
        </div>
    );
}
