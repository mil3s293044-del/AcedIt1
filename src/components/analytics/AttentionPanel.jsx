/**
 * AttentionPanel — when the work actually happens, and how long it holds up.
 *
 * The honesty here matters more than anywhere else on the page, because
 * "attention span" is exactly the kind of number an app can invent and a
 * student will believe. There is no attention telemetry yet: nothing records
 * pauses, abandoned timers or tab switches. What exists is when a session was
 * saved, how long it ran, and how the student rated it.
 *
 * So this panel says two true things and refuses the third. It will show you
 * which part of the day carries your hours and whether your own ratings fall
 * off past a length — and it says plainly that a short session is a choice as
 * much as a limit, because the app cannot tell focus running out from dinner
 * being ready.
 *
 * Both halves stay silent below MIN_SESSIONS rather than drawing a chart from
 * three points.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Gauge, Info } from "lucide-react";
import { peakWindow, lengthCurve, attentionVerdict, MIN_SESSIONS } from "@/lib/attentionAnalytics";

const fmt = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h === 0 ? `${mm}m` : mm === 0 ? `${h}h` : `${h}h ${mm}m`;
};

export default function AttentionPanel({ techniques = [], sessions = [] }) {
    const peak = useMemo(() => peakWindow(techniques), [techniques]);
    const curve = useMemo(() => lengthCurve(sessions), [sessions]);
    const verdict = useMemo(() => attentionVerdict({ peak, curve }), [peak, curve]);

    const maxWindow = Math.max(1, ...peak.windows.map(w => w.minutes));
    const maxRating = 5;

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

                {!peak.hasData ? (
                    <p className="text-sm text-muted-foreground">
                        No timed sessions in this range yet. Run a Pomodoro or any technique and this fills in.
                    </p>
                ) : (
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
                )}
            </div>

            {/* ── Session length against your own ratings ── */}
            <div className="card-soft p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                        <Gauge className="w-5 h-5 text-xp" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-display font-extrabold text-foreground text-base">How long it holds up</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Your own productivity rating, by how long the session ran
                        </p>
                    </div>
                </div>

                {!curve.hasData ? (
                    <p className="text-sm text-muted-foreground">
                        This one needs sessions you've rated. Rate a few after logging them and the shape appears —
                        it's the only subjective signal in here, which is exactly why it's worth having.
                    </p>
                ) : (
                    <>
                        <ul className="space-y-2.5">
                            {curve.bands.map(b => (
                                <li key={b.id}>
                                    <div className="flex items-baseline justify-between gap-3 mb-1">
                                        <span className="text-sm font-bold text-foreground">{b.label}</span>
                                        <span className="text-xs text-muted-foreground flex-shrink-0">
                                            {b.avgRating != null ? (
                                                <>
                                                    <span className="font-bold text-foreground tabular-nums">{b.avgRating.toFixed(1)}</span> / 5
                                                    <span className="mx-1.5 text-muted-foreground/50">·</span>
                                                </>
                                            ) : null}
                                            {b.sessions} session{b.sessions === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                        {/* A band with sessions but no ratings gets no bar at
                                            all — a zero-width bar beside real ones would read
                                            as "you rated this badly". */}
                                        {b.avgRating != null && (
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${(b.avgRating / maxRating) * 100}%` }}
                                                transition={{ duration: 0.7 }}
                                                className={`h-full rounded-full ${b.id === curve.best?.id ? "bg-primary" : "bg-xp"}`} />
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <p className="text-xs text-muted-foreground leading-snug mt-4 pt-3 border-t border-border">
                            {curve.enough
                                ? verdict[verdict.length - 1]
                                : `${curve.ratedSessions} rated session${curve.ratedSessions === 1 ? "" : "s"} so far — not enough to call a pattern yet.`}
                        </p>
                    </>
                )}

                <p className="text-[10px] text-muted-foreground leading-snug flex items-start gap-1.5 pt-3 mt-3 border-t border-border">
                    <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    This is not a measure of your attention span. Nothing yet records pauses or abandoned
                    timers, and a short session is a choice as often as a limit — the app can't tell focus
                    running out from dinner being ready. What it can show is when your hours land and how
                    you rated them.
                </p>
            </div>
        </div>
    );
}
