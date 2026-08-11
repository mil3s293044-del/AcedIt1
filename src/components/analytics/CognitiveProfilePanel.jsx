/**
 * CognitiveProfilePanel — the five axes, on a radar, with the brain beside it.
 *
 * The radar is the hook; the list underneath is the payload. Every axis shows
 * its real number in its own unit, what it means, and the one thing that moves
 * it — because "your Retrieval is 43%" is only useful if you can also see that
 * it means 300 of 700 minutes and that blurting is what changes it.
 *
 * UNKNOWN IS NOT ZERO. An axis the app has no data for is drawn at the neutral
 * ring and labelled, never collapsed to the origin. A student who has never
 * made a flashcard would otherwise see two spikes flattened to nothing and
 * conclude their memory is failing, which the app has no basis to say.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Brain, ArrowRight, Info, HelpCircle } from "lucide-react";
import BrainModel from "@/components/study/BrainModel";
import { cognitiveProfile, whatUnlocks, REFERENCES } from "@/lib/cognitiveProfile";
import AceTip from "@/components/ace/AceTip";

// The ring radius has to leave room for the axis LABELS, which sit at 1.3x it.
// At R=96 in a 260 box, "Stability" and "Focus" ran off both edges and rendered
// as "Stabili" and "ocus".
const SIZE = 280, C = SIZE / 2, R = 82;
/** Where an unknown axis is drawn — visibly not a score. */
const UNKNOWN_R = 0.18;

const pointAt = (i, n, frac) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [C + Math.cos(a) * R * frac, C + Math.sin(a) * R * frac];
};

function Radar({ axes }) {
    const n = axes.length;
    const poly = axes
        .map((a, i) => pointAt(i, n, a.known ? Math.max(0.04, a.score) : UNKNOWN_R).map(v => v.toFixed(1)).join(","))
        .join(" ");
    const label = axes.map(a => `${a.label} ${a.known ? a.display : "not measured yet"}`).join(", ");

    return (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[280px] mx-auto"
            role="img" aria-label={`Cognitive profile: ${label}.`}>
            {[0.25, 0.5, 0.75, 1].map(f => (
                <circle key={f} cx={C} cy={C} r={R * f} className="fill-none stroke-border" strokeWidth="1" />
            ))}
            {axes.map((a, i) => {
                const [x, y] = pointAt(i, n, 1);
                return <line key={a.id} x1={C} y1={C} x2={x} y2={y} className="stroke-border" strokeWidth="1" />;
            })}
            <motion.polygon points={poly}
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }} style={{ transformOrigin: `${C}px ${C}px` }}
                className="fill-map/25 stroke-map" strokeWidth="2" strokeLinejoin="round" />
            {axes.map((a, i) => {
                const [x, y] = pointAt(i, n, a.known ? Math.max(0.04, a.score) : UNKNOWN_R);
                return (
                    <circle key={a.id} cx={x} cy={y} r="3.5"
                        className={a.known ? "fill-map" : "fill-muted-foreground"} />
                );
            })}
            {axes.map((a, i) => {
                const [x, y] = pointAt(i, n, 1.3);
                return (
                    <text key={a.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                        className="fill-foreground text-[10px] font-bold">{a.label}</text>
                );
            })}
        </svg>
    );
}

export default function CognitiveProfilePanel({ techniques = [], cards = [], sessions = [] }) {
    const p = useMemo(() => cognitiveProfile({ techniques, cards, sessions }), [techniques, cards, sessions]);
    // One quiet region worth naming — the one a technique they aren't using
    // would light. Only ever one: a list of eight gaps is a list nobody acts on.
    const gap = p.sources.brain.quiet.find(q => q.label) || null;

    return (
        <div className="card-soft p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-map/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-map" />
                </div>
                <div className="min-w-0">
                    <h2 className="font-display font-extrabold text-foreground text-base">Cognitive profile</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Five things about how you learn — measured separately, because each has a different fix
                    </p>
                </div>
            </div>

            {!p.hasData ? (
                <div className="text-center py-8">
                    <p className="text-sm text-foreground font-bold">Nothing measured yet.</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        Log a study session or review a deck and these fill in. Until then the app has no
                        basis for an opinion — so it isn't giving you one.
                    </p>
                </div>
            ) : (
                <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
                    <div className="space-y-3">
                        <Radar axes={p.axes} />
                        <p className="text-[11px] text-muted-foreground text-center">
                            {p.known} of {p.total} measured
                        </p>
                        {/* Spread, made visual. Same model and the same region
                            mapping as the Dashboard card, so the two pages are
                            talking about one thing rather than two. */}
                        {p.sources.brain.hasData && (
                            <div>
                                <BrainModel regions={p.sources.brain.regions} glow height={190} />
                                <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                                    {p.sources.brain.litCount} of {p.sources.brain.totalRegions} systems
                                    engaged this range
                                </p>
                                {/* The dark part. This was the payload of the
                                    Dashboard brain card and the only actionable
                                    thing on it, so it moved here with the model
                                    rather than being dropped. */}
                                {gap && (
                                    <Link to={createPageUrl(`Study?tab=${gap.technique}`)}
                                        className="block rounded-2xl border-2 border-border bg-secondary/40 p-3 mt-3 hover:border-map/50 transition-colors group">
                                        <p className="text-xs text-muted-foreground leading-snug">
                                            <span className="font-bold text-foreground">Your {gap.name.toLowerCase()} is dark.</span>{" "}
                                            {gap.role}. {gap.label} is what lights it.
                                        </p>
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground underline underline-offset-2 mt-1.5">
                                            Open {gap.label} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                        </span>
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    <ul className="space-y-3 min-w-0">
                        {p.axes.map(a => (
                            <li key={a.id} className="min-w-0">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
                                        {a.label} <AceTip term={a.id} />
                                    </span>
                                    {a.known ? (
                                        <span className="text-sm font-bold text-foreground tabular-nums flex-shrink-0">
                                            {a.display}<span className="text-[10px] font-normal text-muted-foreground ml-1">{a.unit}</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground flex-shrink-0">
                                            <HelpCircle className="w-3 h-3" /> not measured yet
                                        </span>
                                    )}
                                </div>
                                <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-1">
                                    {a.known && (
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(a.score * 100)}%` }}
                                            transition={{ duration: 0.7, delay: 0.1 }}
                                            className="h-full rounded-full bg-map" />
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug mt-1">
                                    {a.known ? a.what : whatUnlocks(a.id)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* The one thing worth doing about it. */}
            {p.weakest && (
                <Link to={createPageUrl(p.weakest.to)}
                    className="mt-5 flex items-start gap-3 rounded-2xl border-2 border-border bg-secondary/40 p-4 hover:border-map/50 transition-colors group">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground leading-snug">
                            <span className="font-bold">{p.weakest.label} is your thinnest of the five.</span>{" "}
                            {p.weakest.why}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground underline underline-offset-2 mt-2">
                            {p.weakest.fix} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                    </div>
                </Link>
            )}

            <p className="text-[10px] text-muted-foreground leading-snug flex items-start gap-1.5 pt-3 mt-4 border-t border-border">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                Not a measurement of your brain. Each axis is scored against a stated reference —
                {" "}{Math.round(REFERENCES.retrievalShare * 100)}% retrieval practice,
                {" "}{REFERENCES.medianInterval}-day card intervals,
                {" "}a {Math.round(REFERENCES.lapseRate * 100)}% lapse rate and
                {" "}{REFERENCES.focusMinutes}-minute sessions. Those are judgement calls about what a
                good month looks like, not findings.
            </p>
        </div>
    );
}
