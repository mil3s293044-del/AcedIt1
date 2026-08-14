/**
 * MemoryPanel — is any of it sticking?
 *
 * Everything on this panel comes from the SM-2 state the app has been writing
 * to every flashcard since day one and reading only to decide what to show
 * next. The scheduler already had an opinion about how long each memory would
 * last; nothing ever showed that opinion to the student.
 *
 * Three things, in the order they matter:
 *   1. Retrieval share — the highest-return change available, and the one the
 *      Study page already teaches without ever measuring.
 *   2. Stability per subject — the comparison that tells you which subject is
 *      actually in trouble, as opposed to which one you've spent least time on.
 *   3. The forecast — what stopping costs.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Repeat, Info, TrendingDown, ArrowRight } from "lucide-react";
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

    const pct = share.share == null ? null : Math.round(share.share * 100);

    return (
        <div className="space-y-5">
            {/* ── Retrieval vs encoding ── */}
            <div className="card-soft p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                        <Repeat className="w-5 h-5 text-chart-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-display font-extrabold text-foreground text-base">Retrieval vs review</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Time pulling it back out, against time spent with the material
                        </p>
                    </div>
                </div>

                {!share.hasData ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing logged in this range. This fills in as soon as you run any study session.
                    </p>
                ) : (
                    <>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="font-display font-extrabold text-foreground text-3xl tabular-nums">{pct}%</span>
                            <span className="text-sm text-muted-foreground">retrieval practice</span>
                        </div>
                        <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary" data-retrieval-bar>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7 }} className="bg-chart-4"
                                title={`${share.retrievalMinutes} minutes retrieving`} />
                            <motion.div initial={{ width: 0 }} animate={{ width: `${100 - pct}%` }}
                                transition={{ duration: 0.7 }} className="bg-foreground/15"
                                title={`${share.encodingMinutes} minutes reviewing`} />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-2">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-chart-4" />
                                <span className="font-bold text-foreground tabular-nums">{share.retrievalMinutes}m</span> retrieving
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground/25" />
                                <span className="font-bold text-foreground tabular-nums">{share.encodingMinutes}m</span> reviewing
                            </span>
                        </div>

                        <ul className="mt-4 space-y-1.5">
                            {share.byTechnique.map(t => (
                                <li key={t.id} className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.isRetrieval ? "bg-chart-4" : "bg-foreground/25"}`} />
                                    <span className="text-xs text-foreground truncate flex-1 min-w-0">{t.label}</span>
                                    <span className="text-xs font-bold text-foreground tabular-nums flex-shrink-0">{t.minutes}m</span>
                                </li>
                            ))}
                        </ul>

                        {verdict[0] && (
                            <p className="text-xs text-muted-foreground leading-snug mt-4 pt-3 border-t border-border">
                                {verdict[0]}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* ── Stability by subject ── */}
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

                {!stability.hasData ? (
                    <p className="text-sm text-muted-foreground">
                        No cards have been reviewed yet. Two rounds through a deck and this fills in,
                        it's built from the schedule your reviews earn, not from anything you have to enter.
                    </p>
                ) : (
                    <>
                        <ul className="space-y-2.5">
                            {stability.subjects.map(s => {
                                const w = Math.max(3, Math.min(100, (s.medianInterval / 30) * 100));
                                return (
                                    <li key={s.subject}>
                                        <div className="flex items-baseline justify-between gap-3 mb-1">
                                            <span className="text-sm font-bold text-foreground truncate">{s.subject}</span>
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
                )}
            </div>

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
