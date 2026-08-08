/**
 * NeuroPanel — the science rail beside whichever technique is open.
 *
 * The brief was a neuroscience vibe that builds trust. Trust comes from being
 * checkable, so the order here is deliberate: what your brain is doing, what
 * the numbers say, why it feels wrong, and then every source named so a
 * teacher can go and look. The "feels like" section is not filler — the single
 * most useful thing a student can learn is that the technique that feels worst
 * is usually the one working, and that their sense of how well it's going is
 * not a reliable signal.
 *
 * Nothing in here is generated. It all comes from src/lib/neuro.js, where
 * every claim carries a citation and anything reproduced from memory is
 * flagged.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    Brain, ChevronDown, BookOpen, TrendingUp, AlertTriangle, Sparkles,
} from "lucide-react";
import BrainModel from "./BrainModel";
import EvidenceChart from "./EvidenceChart";
import { TECHNIQUE_NEURO, REGIONS, REGION_NOTE, UTILITY, chartMax } from "@/lib/neuro";

const TONE_DOT = {
    primary: "bg-primary", xp: "bg-xp", streak: "bg-streak",
    "chart-3": "bg-chart-3", "chart-4": "bg-chart-4", map: "bg-map",
};
const TONE_PILL = {
    primary: "bg-primary/15 text-primary", xp: "bg-xp/15 text-xp",
    streak: "bg-streak/15 text-streak", map: "bg-map/15 text-map",
};

export default function NeuroPanel({ techniqueId, techniqueName }) {
    const data = TECHNIQUE_NEURO[techniqueId];
    const [showSources, setShowSources] = useState(false);
    if (!data) return null;
    const utility = data.utility ? UTILITY[data.utility] : null;

    // One column as a side rail; two when it stacks under the tool and has the
    // width, so the space it gains is used rather than spent on 1100px-long
    // lines of body text.
    return (
        <motion.aside
            key={techniqueId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid gap-3 items-start md:grid-cols-2 xl:grid-cols-1"
            aria-label={`The science behind ${techniqueName}`}
        >
            {/* ── The brain ──────────────────────────────────────────────── */}
            <div className="rounded-3xl border-2 border-border bg-gradient-to-b from-secondary/40 to-transparent overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-4">
                    <div className="w-7 h-7 rounded-lg bg-map/15 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-map" />
                    </div>
                    <p className="stat-label">Your brain on {techniqueName}</p>
                </div>

                <BrainModel key={techniqueId} regions={data.regions} height={250} className="mt-1" />

                <div className="px-4 pb-4 space-y-2.5">
                    <p className="text-sm text-foreground leading-snug">{data.network}</p>
                    <ul className="space-y-1.5">
                        {data.regions.map(r => (
                            <li key={r.id} className="flex items-start gap-2">
                                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TONE_DOT[r.tone] || "bg-map"}`} />
                                <span className="min-w-0">
                                    <span className="text-xs font-bold text-foreground">{REGIONS[r.id]?.name}</span>
                                    <span className="text-xs text-muted-foreground"> — {r.role}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-[10px] text-muted-foreground/80 leading-snug pt-1 border-t border-border">
                        {REGION_NOTE}
                    </p>
                </div>
            </div>

            {/* ── The numbers ────────────────────────────────────────────── */}
            <div className="card-soft p-4 border-2 border-border space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="stat-label flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> With it vs without it
                    </p>
                    {utility && (
                        <span className={`pill ${TONE_PILL[utility.tone] || TONE_PILL.primary}`} title={utility.blurb}>
                            {utility.label}
                        </span>
                    )}
                </div>
                <p className="text-sm font-bold text-foreground leading-snug">{data.headline}</p>
                <EvidenceChart chart={data.chart} max={chartMax(data.chart)} />
                {data.effect && (
                    <div className="rounded-xl bg-secondary/50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                            <span className="font-display font-black text-foreground text-sm tabular-nums">
                                g&nbsp;≈&nbsp;{data.effect.g.toFixed(2)}
                            </span>{" "}
                            for {data.effect.label} — {data.effect.source}
                            {data.effect.approx && <span className="text-muted-foreground/70"> (approx.)</span>}
                        </p>
                    </div>
                )}
            </div>

            {/* ── Why it feels wrong ─────────────────────────────────────── */}
            <div className="rounded-2xl border-2 border-xp/25 bg-xp/5 p-4">
                <p className="stat-label text-xp flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Why it feels harder than it is
                </p>
                <p className="text-sm text-foreground leading-snug">{data.feelsLike}</p>
            </div>

            {/* ── Where the evidence is thin ─────────────────────────────── */}
            {data.caveat && (
                <div className="rounded-2xl border-2 border-border p-4">
                    <p className="stat-label flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" /> Worth knowing
                    </p>
                    <p className="text-sm text-muted-foreground leading-snug">{data.caveat}</p>
                </div>
            )}

            {/* ── Sources ────────────────────────────────────────────────── */}
            <div className="card-soft border-2 border-border overflow-hidden">
                <button onClick={() => setShowSources(s => !s)}
                    aria-expanded={showSources}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="stat-label flex-1">Where this comes from ({data.sources.length})</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showSources ? "rotate-180" : ""}`} />
                </button>
                {showSources && (
                    <ul className="px-4 pb-4 space-y-2.5">
                        {data.sources.map(s => (
                            <li key={s.ref}>
                                <p className="text-xs font-bold text-foreground leading-snug">{s.ref}</p>
                                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.note}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </motion.aside>
    );
}
