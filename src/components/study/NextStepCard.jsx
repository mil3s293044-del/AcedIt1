/**
 * NextStepCard — the one thing the Study page leads with, as one object.
 *
 * ─── IT WAS A HEADING WITH A BUTTON FLOATING OFF TO THE RIGHT ───────────────
 * "Morning, Sam. Unit 3 SAC 2 — Redox is in 4 days." at 40px, two lines,
 * with the button bottom-aligned at the far edge — so the top of the page was
 * a large sentence beside a hole, and the button read as belonging to the tab
 * bar under it rather than to the sentence it acts on. A card holds the three
 * together: the FIGURE the sentence turns on, the sentence, and its door.
 *
 * ─── THE FIGURE IS THE SENTENCE'S OWN NUMBER, SET LARGE ─────────────────────
 * "4 days", "14 ready", "25 min" — `stepFigure`, which refuses to produce one
 * for a step with nothing countable. Then the tile carries the technique's
 * glyph instead: a big number nobody can check is decoration in the most
 * prominent place on the page.
 *
 * ─── THE RING IS ONLY EVER AGAINST WHAT THEY SAID ───────────────────────────
 * `todayRing` is null without a declared intent, and so is the ring. The app
 * has no basis for a daily target of its own — WeekPace's rule — so a
 * student who has not said what today is for sees their minutes in the line
 * above the card and no circle implying they are behind something.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMinutes } from "@/lib/studyPage";

/** Static class sets, so JIT sees every one. */
const TONES = {
    primary:   { tile: "bg-primary/10",  ink: "text-primary",  stroke: "stroke-primary",  rail: "bg-primary" },
    "chart-3": { tile: "bg-chart-3/10",  ink: "text-chart-3",  stroke: "stroke-chart-3",  rail: "bg-chart-3" },
    "chart-4": { tile: "bg-chart-4/10",  ink: "text-chart-4",  stroke: "stroke-chart-4",  rail: "bg-chart-4" },
    xp:        { tile: "bg-xp/10",       ink: "text-xp",       stroke: "stroke-xp",       rail: "bg-xp" },
    streak:    { tile: "bg-streak/10",   ink: "text-streak",   stroke: "stroke-streak",   rail: "bg-streak" },
    map:       { tile: "bg-map/10",      ink: "text-map",      stroke: "stroke-map",      rail: "bg-map" },
};

/** Today's minutes against the intent, as a ring. Only drawn when `ring` exists. */
function TodayRing({ ring, compact = false }) {
    const reduce = useReducedMotion();
    const size = compact ? 40 : 84;
    const sw = compact ? 5 : 7;
    const r = (size - sw) / 2;
    const c = 2 * Math.PI * r;
    return (
        <div className={`flex items-center ${compact ? "gap-2.5" : "flex-col gap-1.5"}`}>
            <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} className="stroke-secondary" />
                    <motion.circle
                        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} strokeLinecap="round"
                        className="stroke-primary"
                        strokeDasharray={c}
                        initial={{ strokeDashoffset: reduce ? c * (1 - ring.pct) : c }}
                        animate={{ strokeDashoffset: c * (1 - ring.pct) }}
                        transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.25 }}
                    />
                </svg>
                {!compact && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                        {ring.met
                            ? <Check className="w-6 h-6 text-primary" aria-hidden="true" />
                            : <span className="font-display text-lg font-extrabold text-foreground tabular-nums">{fmtMinutes(ring.done)}</span>}
                    </span>
                )}
            </div>
            <p className={`text-xs leading-tight ${compact ? "" : "text-center"}`}>
                <span className="font-bold text-foreground tabular-nums">
                    {compact || ring.met ? `${fmtMinutes(ring.done)} of ${fmtMinutes(ring.target)}` : `of ${fmtMinutes(ring.target)}`}
                </span>
                <span className="block text-muted-foreground">{ring.label.toLowerCase()} today</span>
            </p>
        </div>
    );
}

export default function NextStepCard({ greeting, step, figure, technique, ring, onGo }) {
    const reduce = useReducedMotion();
    const tone = TONES[technique?.tone] || TONES.primary;
    const Icon = technique?.icon;

    return (
        <motion.section
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            aria-label="Your next step"
            className="card-soft on-table relative overflow-clip"
        >
            {/* The technique's spine, the identity idiom the shelves use. */}
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${step ? tone.rail : "bg-border"}`} aria-hidden="true" />

            <div className="flex items-start gap-4 sm:gap-6 p-5 sm:p-6 sm:items-center">
                {/* ── The figure, or the glyph when there is no honest one ── */}
                <div className={`flex-shrink-0 w-[4.5rem] h-[4.5rem] sm:w-24 sm:h-24 rounded-2xl flex flex-col items-center justify-center
                    ${step ? tone.tile : "bg-secondary animate-pulse"}`}>
                    {step && figure && (
                        <>
                            <span className={`font-display font-extrabold leading-none tabular-nums
                                ${figure.value.length > 3 ? "text-lg sm:text-2xl" : "text-3xl sm:text-[2.6rem]"} ${tone.ink}`}>
                                {figure.value}
                            </span>
                            {figure.unit && (
                                <span className="mt-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {figure.unit}
                                </span>
                            )}
                        </>
                    )}
                    {step && !figure && Icon && <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${tone.ink}`} aria-hidden="true" />}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-muted-foreground">{greeting}</p>
                    <h1 className="mt-0.5 font-display text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold tracking-tight leading-[1.15] text-foreground">
                        {step ? step.title : "Getting today ready…"}
                    </h1>
                    {step?.sub && (
                        <p className="mt-1.5 text-sm text-muted-foreground leading-snug max-w-2xl">{step.sub}</p>
                    )}
                    {/* On a phone the ring has no column of its own; it is a
                        line under the sentence instead. */}
                    {ring && <div className="mt-3 sm:hidden"><TodayRing ring={ring} compact /></div>}
                    {step?.cta && (
                        <Button
                            onClick={onGo}
                            className="btn-3d mt-4 h-11 px-5 rounded-xl gap-2 font-bold w-full sm:w-auto"
                        >
                            {step.cta}
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </Button>
                    )}
                </div>

                {ring && (
                    <div className="hidden sm:block flex-shrink-0 pl-6 border-l border-border self-stretch">
                        <div className="h-full flex items-center"><TodayRing ring={ring} /></div>
                    </div>
                )}
            </div>
        </motion.section>
    );
}
