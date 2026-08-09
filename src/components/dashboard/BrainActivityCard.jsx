/**
 * BrainActivityCard — the student's own month, on a brain.
 *
 * The honest framing is the whole design. This is not a scan and the card
 * says so: it maps the techniques they actually used onto the regions imaging
 * studies implicate in those activities, weighted by time spent. Claiming
 * anything more would be exactly the kind of neuro-flavoured nonsense the
 * Study page's evidence rail exists to avoid.
 *
 * The picture is the hook. The payload is the DARK part — a region nothing
 * they've done touches, with the technique that would light it. A student who
 * only runs Pomodoro has a bright front and a dark middle, and the middle is
 * where retrieval lives.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Brain, ArrowRight, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import BrainModel from "@/components/study/BrainModel";
import { brainActivity, activitySummary } from "@/lib/brainActivity";

const TONE_DOT = {
    primary: "bg-primary", xp: "bg-xp", streak: "bg-streak",
    "chart-3": "bg-chart-3", "chart-4": "bg-chart-4", map: "bg-map",
};

const fmtMins = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h === 0 ? `${mm}m` : mm === 0 ? `${h}h` : `${h}h ${mm}m`;
};

export default function BrainActivityCard({ techniques = [] }) {
    const a = useMemo(() => brainActivity(techniques), [techniques]);
    // The quiet region worth naming: the one a technique they're not using
    // would light. Only ever one — a list of eight gaps is a list nobody acts on.
    const gap = a.quiet.find(q => q.label) || null;

    return (
        <div className="card-soft border-2 border-border overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5">
                <div className="w-8 h-8 rounded-xl bg-map/15 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-map" />
                </div>
                <div className="min-w-0">
                    <p className="stat-label">Your last 28 days</p>
                    <p className="text-[11px] text-muted-foreground">
                        {a.hasData ? `${fmtMins(a.totalMinutes)} across ${a.techniques.length} technique${a.techniques.length === 1 ? "" : "s"}` : "nothing logged yet"}
                    </p>
                </div>
            </div>

            <div className="px-5 pt-4">
                <BrainModel regions={a.regions} glow height={250} />
            </div>

            <div className="px-5 pb-5 space-y-3">
                <p className="text-sm text-foreground leading-snug">{activitySummary(a)}</p>

                {a.hasData && (
                    <>
                        {/* Which systems, and how hard. */}
                        <ul className="space-y-1.5">
                            {a.regions.slice(0, 4).map(r => (
                                <li key={r.id} className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TONE_DOT[r.tone] || "bg-map"}`} />
                                    <span className="text-xs font-bold text-foreground truncate flex-1 min-w-0">{r.name}</span>
                                    <span className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                                        <motion.span initial={{ width: 0 }} animate={{ width: `${Math.round(r.activation * 100)}%` }}
                                            transition={{ duration: 0.7, delay: 0.15 }}
                                            className={`block h-full rounded-full ${TONE_DOT[r.tone] || "bg-map"}`} />
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* Coverage — the breadth signal, in one line. */}
                        <div>
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[11px] font-bold text-foreground">Systems lit</span>
                                <span className="text-[11px] font-bold text-foreground tabular-nums">
                                    {a.litCount} / {a.totalRegions}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(a.coverage * 100)}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 }}
                                    className="h-full rounded-full bg-map" />
                            </div>
                        </div>
                    </>
                )}

                {/* The dark part — the only actionable thing on the card. */}
                {gap && (
                    <Link to={createPageUrl(`Study?tab=${gap.technique}`)}
                        className="block rounded-2xl border-2 border-border bg-secondary/40 p-3 hover:border-map/50 transition-colors group">
                        <p className="text-xs text-muted-foreground leading-snug">
                            <span className="font-bold text-foreground">Your {gap.name.toLowerCase()} is dark.</span>{" "}
                            {gap.role}. {gap.label} is what lights it.
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-map mt-1.5">
                            Open {gap.label} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                    </Link>
                )}

                <p className="text-[10px] text-muted-foreground/80 leading-snug flex items-start gap-1.5 pt-1 border-t border-border">
                    <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    Not a scan. This maps the techniques you used onto the regions imaging studies
                    consistently link to them, weighted by time.
                </p>
            </div>
        </div>
    );
}
