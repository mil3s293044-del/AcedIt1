/**
 * MemoryPanel — is any of it sticking?
 *
 * Everything on this panel comes from the SM-2 state the app has been writing
 * to every flashcard since day one and reading only to decide what to show
 * next. The scheduler already had an opinion about how long each memory would
 * last; nothing ever showed that opinion to the student.
 *
 * Two things now, and the third was cut:
 *   1. Stability per subject — the comparison that tells you which subject is
 *      actually in trouble, as opposed to which one you've spent least time
 *      on. Every row is a link into that subject's own review session.
 *   2. The forecast — what stopping costs.
 *
 * ─── RETRIEVAL VS REVIEW IS GONE ────────────────────────────────────────────
 * It was 334 measured pixels: a percentage, a two-colour bar, a legend, a list
 * of techniques by minutes, and a paragraph. On a real account it printed 0%
 * over a long explainer, because the figure is a share of LOGGED technique
 * minutes and most students log their time against quizzes. The techniques
 * breakdown it was built on is still drawn, on the HOURS tab where the hours
 * live, with every row a door into that technique — so what was useful about
 * it survives and the apology does not.
 *
 * ─── AND A PANEL WITH NOTHING TO SAY IS NOT DRAWN AT ALL ────────────────────
 * Both halves used to render a box explaining what would fill them, which on a
 * first-week account is 600px of apology above a report. Same refusal every
 * builder in `studyQueue.js` makes about a zero row.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronRight, Info, TrendingDown, ArrowRight } from "lucide-react";
import {
    retrievalShare, stabilityBySubject, lapseProfile, retentionForecast, memoryVerdict,
} from "@/lib/memoryAnalytics";
import AceTip from "@/components/ace/AceTip";

const LAPSE_BAND = {
    solid:          { label: "Solid",         cls: "bg-primary/15 text-foreground" },
    normal:         { label: "Normal",        cls: "bg-secondary text-foreground" },
    shaky:          { label: "Shaky",         cls: "bg-xp/25 text-foreground" },
    "not sticking": { label: "Not sticking",  cls: "bg-streak/20 text-foreground" },
};

/** Projected share of the collection still holding, over the next month. */
function ForecastChart({ forecast }) {
    if (!forecast?.hasData) return null;
    const W = 100, H = 52;
    const pts = forecast.points;
    const x = (d) => (d / forecast.days) * W;
    const y = (s) => H - s * H;
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(2)},${y(p.share).toFixed(2)}`).join(" ");
    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[80px]"
                role="img"
                aria-label={`Projected share of cards still holding over ${forecast.days} days with no reviews: ${Math.round(pts[0].share * 100)}% today falling to ${Math.round(forecast.endShare * 100)}%.`}>
                <rect x="0" y="0" width={W} height={H} className="fill-secondary" rx="1" />
                <path d={`${line} L${W},${H} L0,${H} Z`} className="fill-map/20" />
                <path d={line} className="stroke-map fill-none" strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span className="tabular-nums">today · {Math.round(pts[0].share * 100)}%</span>
                <span className="tabular-nums">
                    day {forecast.days} · <span className="font-bold text-foreground">{Math.round(forecast.endShare * 100)}%</span>
                </span>
            </div>
        </div>
    );
}

export default function MemoryPanel({ techniques = [], cards = [] }) {
    const share = useMemo(() => retrievalShare(techniques), [techniques]);
    const stability = useMemo(() => stabilityBySubject(cards), [cards]);
    const lapse = useMemo(() => lapseProfile(cards), [cards]);
    const forecast = useMemo(() => retentionForecast(cards, { days: 30 }), [cards]);
    const verdict = useMemo(() => memoryVerdict({ share, stability, lapse }), [share, stability, lapse]);

    /**
     * ─── A PANEL WITH NOTHING TO SAY IS NOT DRAWN ───────────────────────────
     * It used to render two boxes explaining what WOULD fill them, which on a
     * first-week account is 600px of apology above a report. The strip at the
     * top of the tab already names the one thing that fills this, so the
     * refusal is the same one every builder in `studyQueue.js` makes about a
     * zero row.
     */
    if (!stability.hasData && !forecast.hasData) return null;

    return (
        <div className="space-y-5">
            {/* ── Stability by subject ── */}
            {stability.hasData && (
            <div className="card-soft p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-map/10 flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="w-5 h-5 text-map" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display font-extrabold text-foreground text-base">How long it holds</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Median gap your cards have earned between reviews, per subject
                        </p>
                    </div>
                    {lapse.band && (
                        <span className={`pill flex-shrink-0 inline-flex items-center gap-1 ${LAPSE_BAND[lapse.band].cls}`}>
                            {Math.round(lapse.rate * 100)}% lapse · {LAPSE_BAND[lapse.band].label}
                            <AceTip term="lapse_rate" align="end" />
                        </span>
                    )}
                </div>

                <>
                        <ul className="space-y-2.5">
                            {stability.subjects.map(s => {
                                const w = Math.max(3, Math.min(100, (s.medianInterval / 30) * 100));
                                return (
                                    <li key={s.subject}>
                                        {/* A ROW IS A DOOR, and this one is exact:
                                            /Study honours `subject`, so the link
                                            opens the review session for the subject
                                            the row is about rather than for the
                                            whole deck. */}
                                        <Link to={`${createPageUrl("Study")}?tab=spaced_repetition&subject=${encodeURIComponent(s.subject)}`}
                                            className="group block rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary/60 transition-colors">
                                        <div className="flex items-baseline justify-between gap-3 mb-1">
                                            <span className="text-sm font-bold text-foreground truncate flex items-center gap-1">
                                                {s.subject}
                                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0
                                                    opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                                            </span>
                                            <span className="text-xs text-muted-foreground flex-shrink-0">
                                                <span className="font-bold text-foreground tabular-nums">{s.medianInterval}d</span> between reviews
                                                <span className="mx-1.5 text-muted-foreground/50">·</span>
                                                {s.cards} card{s.cards === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }}
                                                transition={{ duration: 0.7 }}
                                                className="h-full rounded-full bg-map" />
                                        </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                        {verdict.slice(1).map((line, i) => (
                            <p key={i} className="text-xs text-muted-foreground leading-snug mt-4 pt-3 border-t border-border">
                                {line}
                            </p>
                        ))}
                </>
            </div>
            )}

            {/* ── The forecast ── */}
            {forecast.hasData && (
                <div className="card-soft p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="min-w-0">
                            <h2 className="font-display font-extrabold text-foreground text-base">If you stopped today</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Share of your {forecast.learnedCount} learned cards still within reach, with no reviews
                            </p>
                        </div>
                        <Link to={createPageUrl("Study?tab=spaced_repetition")}
                            className="text-xs font-bold text-foreground underline underline-offset-2 flex-shrink-0 inline-flex items-center gap-1">
                            Review <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <ForecastChart forecast={forecast} />
                    {forecast.halfGoneDay != null && (
                        <p className="text-xs text-muted-foreground leading-snug mt-3">
                            Half of it drops out of reach by{" "}
                            <span className="font-bold text-foreground">day {forecast.halfGoneDay}</span>.
                        </p>
                    )}
                    <p className="text-[10px] text-muted-foreground leading-snug flex items-start gap-1.5 pt-3 mt-3 border-t border-border">
                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        A projection, not a reading of your memory. It applies the standard forgetting curve to
                        the review intervals your own cards have earned, and assumes you review nothing in the
                        meantime — which is the point of it.
                    </p>
                </div>
            )}
        </div>
    );
}
