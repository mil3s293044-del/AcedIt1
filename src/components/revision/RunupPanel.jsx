/**
 * RunupPanel — how the run-up to one SAC is going, counted off what is in it.
 *
 * ─── THREE FIGURES, FOUR BARS AND ONE LINE ──────────────────────────────────
 * Time studied for it, sits and their average, reviews — then the time as four
 * Monday weeks, and readiness as a line across the days the folder was opened.
 * Each figure is the folder's own: its topics plus everything tagged to it, so
 * tagging a deck is how its reviews start counting here.
 *
 * ─── A RULED SECTION, NOT A CARD ────────────────────────────────────────────
 * A bordered, elevated box on this app is something you press; this is
 * something you read (the Progress page's rule). So it is a heading with a rule
 * under it, and the hero above it keeps the only card.
 *
 * ─── IT SAYS NOTHING RATHER THAN NOUGHT ─────────────────────────────────────
 * A figure that is null is not drawn, and with nothing at all and no line yet
 * the panel is not drawn either — "0 minutes · 0 sits" at somebody a month out
 * is the padding studyQueue refuses. The bars sum to the minutes printed beside
 * them (`folderStats` builds the total from them), and the readiness line is
 * what the folder actually showed on each day it was opened, never filled in
 * backwards.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import Spark from "@/components/progress/Spark";
import { hhmm } from "@/lib/progressReport";
import { readinessSeries } from "@/lib/sacTags";

const dayLabel = (iso) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    const at = new Date(y, m - 1, d);
    return Number.isNaN(at.getTime()) ? "" : at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

function Figure({ value, label, data }) {
    return (
        <span className="inline-flex items-baseline gap-1.5" data-runup-figure={data}>
            <span className="font-display font-extrabold text-xl text-foreground tabular-nums">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
        </span>
    );
}

export default function RunupPanel({ stats, history = [] }) {
    const reduce = useReducedMotion();
    const series = readinessSeries(history);
    const line = series.map((p) => ({ value: p.ready }));
    if (!stats?.any && series.length < 2) return null;

    const top = Math.max(1, ...stats.weeks.map((w) => w.minutes));
    const latest = series[series.length - 1];
    const first = series[0];

    return (
        <section aria-label="The run-up" className="space-y-4" data-runup>
            <div className="flex items-center gap-2.5">
                <h2 className="font-display font-extrabold text-foreground">The run-up</h2>
                <span className="text-xs text-muted-foreground whitespace-nowrap">since {dayLabel(stats.range.from)}</span>
                <span className="flex-1 h-px bg-border" aria-hidden="true" />
            </div>

            <div className="grid gap-6 sm:grid-cols-[1fr_auto] items-end">
                <div className="space-y-4 min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                        {stats.minutes != null && <Figure value={hhmm(stats.minutes)} label="studied for it" data="minutes" />}
                        {stats.sits != null && (
                            <Figure value={stats.sits}
                                label={`sit${stats.sits === 1 ? "" : "s"}${stats.average != null ? `, averaging ${stats.average}%` : ""}`}
                                data="sits" />
                        )}
                        {stats.reviewed != null && (
                            <Figure value={stats.reviewed} label={`card${stats.reviewed === 1 ? "" : "s"} reviewed`} data="reviewed" />
                        )}
                        {stats.planned && (
                            <Figure value={`${stats.planned.done}/${stats.planned.total}`}
                                label={`planned session${stats.planned.total === 1 ? "" : "s"} done`} data="planned" />
                        )}
                    </p>

                    {/* The time as four Monday weeks. Height is minutes against the
                        busiest of the four, so a quiet run-up is not drawn as a
                        busy one by a scale that rescales to it. */}
                    {stats.minutes != null && (
                        <div className="flex items-end gap-2 h-16" role="img" data-runup-weeks
                            aria-label={stats.weeks.map((w, i) => `${i === stats.weeks.length - 1 ? "this week" : `${stats.weeks.length - 1 - i} weeks ago`}: ${hhmm(w.minutes) || "nothing"}`).join(", ")}>
                            {stats.weeks.map((w, i) => (
                                <div key={w.from} className="flex-1 max-w-[4.5rem] flex flex-col items-center gap-1">
                                    <div className="w-full h-11 flex items-end">
                                        <motion.div
                                            initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                                            transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.06 }}
                                            style={{ height: `${Math.max(w.minutes ? 8 : 2, (w.minutes / top) * 100)}%`, transformOrigin: "bottom" }}
                                            className={`w-full rounded-md ${w.minutes ? (w.current ? "bg-primary" : "bg-primary/45") : "bg-border"}`} />
                                    </div>
                                    <span className={`text-[10px] tabular-nums ${w.current ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                                        {w.current ? "This wk" : dayLabel(w.from)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Readiness across the days the folder was opened. Two points
                    is a line; one is a reading, said as a sentence. */}
                {series.length >= 2 ? (
                    <div className="sm:w-56" data-runup-line>
                        <p className="text-xs text-muted-foreground">
                            Ready <span className="font-bold text-foreground tabular-nums">{first.ready}%</span>
                            {" → "}
                            <span className="font-bold text-foreground tabular-nums">{latest.ready}%</span>
                            <span className="whitespace-nowrap"> since {dayLabel(first.d)}</span>
                        </p>
                        <div className="mt-1.5">
                            <Spark series={line} percent tone="primary" label="Readiness over the run-up" />
                        </div>
                    </div>
                ) : series.length === 1 ? (
                    <p className="text-xs text-muted-foreground sm:w-56 leading-snug" data-runup-line="starts">
                        Your readiness line starts today at <span className="font-bold text-foreground tabular-nums">{latest.ready}%</span>. Open this folder again and it draws itself.
                    </p>
                ) : null}
            </div>
        </section>
    );
}
