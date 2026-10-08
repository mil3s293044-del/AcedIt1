/**
 * AttentionPanel — when the work actually happens.
 *
 * The honesty here matters more than anywhere else on the page, because
 * "attention span" is exactly the kind of number an app can invent and a
 * student will believe. There is no attention telemetry yet: nothing records
 * pauses, abandoned timers or tab switches. What exists is when a session was
 * saved and how long it ran.
 *
 * So this says ONE true thing and refuses the rest. It will show you which
 * part of the day carries your hours, and it stays silent below MIN_SESSIONS
 * rather than drawing a chart from three points — a short session is a choice
 * as much as a limit, and the app cannot tell focus running out from dinner
 * being ready.
 *
 * ─── "HOW LONG IT HOLDS UP" IS GONE ─────────────────────────────────────────
 * It plotted the student's OWN productivity rating against session length, and
 * its own copy called it "the only subjective signal in here". That was the
 * argument FOR it and it is the argument against: a 205px panel whose x and y
 * both come from the same self-report cannot tell a student anything they did
 * not already type in, and it sat on a tab where everything else is measured.
 * `lengthCurve` and `attentionVerdict`'s curve half survive in
 * `attentionAnalytics.js` with no drawn consumer — read the note there before
 * rehoming them.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { peakWindow, attentionVerdict, MIN_SESSIONS } from "@/lib/attentionAnalytics";

const fmt = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h === 0 ? `${mm}m` : mm === 0 ? `${h}h` : `${h}h ${mm}m`;
};

export default function AttentionPanel({ techniques = [] }) {
    const peak = useMemo(() => peakWindow(techniques), [techniques]);
    // `attentionVerdict` takes a curve half too; it is destructured with
    // optional chaining and simply contributes no line when absent.
    const verdict = useMemo(() => attentionVerdict({ peak }), [peak]);

    const maxWindow = Math.max(1, ...peak.windows.map(w => w.minutes));

    /**
     * ─── NOTHING TIMED, NOTHING DRAWN ───────────────────────────────────────
     * It used to render the panel with "No timed sessions in this range yet"
     * inside it — 132 measured pixels saying there is nothing to say, on a tab
     * whose strip above already names the one thing that fills it. The refusal
     * every builder in `studyQueue.js` makes about a zero row.
     */
    if (!peak.hasData) return null;

    return (
        <div className="space-y-5">
            {/* ── When the hours land ── */}
            <div className="card-soft p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-chart-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display font-extrabold text-foreground text-base">When you actually work</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Hours by part of the day, from sessions the app timed itself
                        </p>
                    </div>
                    {peak.hasData && (
                        <span className="pill bg-secondary text-foreground flex-shrink-0">
                            {peak.sessions} session{peak.sessions === 1 ? "" : "s"}
                        </span>
                    )}
                </div>

                <>
                        <ul className="space-y-2.5">
                            {peak.windows.map(w => (
                                <li key={w.id}>
                                    <div className="flex items-baseline justify-between gap-3 mb-1">
                                        <span className="text-sm font-bold text-foreground">
                                            {w.label} <span className="font-normal text-xs text-muted-foreground">{w.blurb}</span>
                                        </span>
                                        <span className="text-xs font-bold text-foreground tabular-nums flex-shrink-0">
                                            {fmt(w.minutes)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(w.minutes / maxWindow) * 100}%` }}
                                            transition={{ duration: 0.7 }}
                                            className="h-full rounded-full bg-chart-3" />
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {/* Below the threshold this is anecdote, and it says so
                            rather than drawing a conclusion from five sessions. */}
                        <p className="text-xs text-muted-foreground leading-snug mt-4 pt-3 border-t border-border">
                            {peak.enough
                                ? verdict[0]
                                : `Only ${peak.sessions} timed session${peak.sessions === 1 ? "" : "s"} so far — not enough to call a pattern. ${MIN_SESSIONS} is where this starts meaning something.`}
                        </p>
                </>
            </div>

        </div>
    );
}
