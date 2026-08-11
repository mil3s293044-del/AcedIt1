/**
 * CalibrationReport — where your confidence was wrong.
 *
 * Shown at the end of a recall session, beside the score. The score says how
 * much you knew; this says whether you KNEW how much you knew, which is the
 * part that decides what you revise next.
 *
 * The two errors are kept apart on purpose. Being sure and wrong is the
 * dangerous one — those are the topics that get crossed off a list and cost
 * marks. Being unsure and right is worth knowing but costs nothing, and
 * averaging them into a single "calibration score" would hide the difference.
 */
import React from "react";
import { motion } from "framer-motion";
import { Gauge, AlertTriangle, ThumbsUp, Info } from "lucide-react";
import { calibrate, calibrationVerdict, overconfidentItems, CONFIDENCE } from "@/lib/calibration";
import AceTip from "@/components/ace/AceTip";

export default function CalibrationReport({ answers = [] }) {
    const c = calibrate(answers);
    if (!c.hasData) return null;
    const verdict = calibrationVerdict(c);
    const items = overconfidentItems(c);
    const label = (n) => CONFIDENCE.find(x => x.value === n)?.label || "";

    return (
        <div className="card-soft p-5">
            <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                    <Gauge className="w-4.5 h-4.5 text-chart-4" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-display font-extrabold text-foreground text-base inline-flex items-center gap-1.5">
                        Did you know what you knew? <AceTip term="calibration" />
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Your confidence before the answer, against how it went
                    </p>
                </div>
            </div>

            {/* Three counts, never averaged into one. */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                    { n: c.overconfident.length, label: "sure, wrong", dot: "bg-streak" },
                    { n: c.aligned, label: "matched", dot: "bg-primary" },
                    { n: c.underconfident.length, label: "unsure, right", dot: "bg-chart-3" },
                ].map(x => (
                    <div key={x.label} className="rounded-2xl border-2 border-border p-3 text-center">
                        <p className="font-display font-black text-2xl text-foreground tabular-nums leading-none">{x.n}</p>
                        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${x.dot}`} />{x.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* The one number worth remembering, when there is one. */}
            {c.overconfidenceRate != null && c.confidentTotal >= 3 && (
                <div className="mb-4">
                    <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[11px] font-bold text-foreground">
                            Of the {c.confidentTotal} you were sure about
                        </span>
                        <span className="text-[11px] font-bold text-foreground tabular-nums">
                            {Math.round(c.overconfidenceRate * 100)}% missed
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(c.overconfidenceRate * 100)}%` }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                            className="h-full rounded-full bg-streak" />
                    </div>
                </div>
            )}

            <p className="text-sm text-foreground leading-snug">{verdict}</p>

            {/* The actionable half: what to look at again. */}
            {items.length > 0 && (
                <div className="mt-4 rounded-2xl border-2 border-streak/25 bg-streak/5 p-3">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-streak" />
                        Look at these again first
                    </p>
                    <ul className="space-y-1.5">
                        {items.map((r, i) => (
                            <li key={i} className="text-xs text-muted-foreground leading-snug">
                                <span className="font-bold text-foreground">{label(r.confidence)}</span>
                                {" — "}{r.question || "Question " + (i + 1)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {c.overconfident.length === 0 && c.underconfident.length > 0 && (
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground leading-snug">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    Nothing you were sure about was wrong. That's the half that matters.
                </p>
            )}

            <p className="text-[10px] text-muted-foreground leading-snug flex items-start gap-1.5 pt-3 mt-3 border-t border-border">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                Only counts answers you rated before seeing the verdict — a confidence rating
                collected afterwards measures nothing.
            </p>
        </div>
    );
}
