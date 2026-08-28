/**
 * SacHero — the countdown, drawn so that it counts.
 *
 * It was a number on a gradient with one branch in it: three days or fewer
 * went red, everything else went blue. Eleven days out and three weeks out
 * were the same picture, and the day it flipped was the only day the card ever
 * changed. Three things carry the distance now, and all three read from the
 * same band (sacRunway), so the picture, the motion and Ace's line can never
 * disagree:
 *
 *  · THE RUNWAY. One marker per day left. It is literally shorter every
 *    morning, which is the thing a countdown is supposed to feel like and the
 *    thing a big number cannot do on its own — "6" only means something if you
 *    saw the 7.
 *  · THE FAN. The watermark is a hand of cards, and the hand thins as the date
 *    closes. It replaces a flag that was the same shape on every day of the
 *    countdown, and a fanned card is the most on-brand silhouette this app has.
 *  · THE HOLD. Ace stands at the end of the runway rather than floating in a
 *    corner as decoration, and how tightly he moves scales with urgency: a slow
 *    drift three weeks out, a small tense bob the night before. He already
 *    breathes and fidgets on his own; this is the one thing his own idle system
 *    cannot know, because only the page knows the date.
 *
 * All of it folds flat under prefers-reduced-motion. A countdown that pulses at
 * a student the night before a SAC is a countdown they close.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, CalendarDays } from "lucide-react";
import AceBody from "@/components/ace/AceBody";
import { sacBand, runway, fanCards } from "@/lib/sacRunway";

/**
 * The hand behind the number. Thins as the date closes.
 *
 * Drawn as SVG rather than rotated divs: with CSS the pivot sat below each
 * card, so at any real spread the hand swung out of the card's overflow and
 * the "fan" rendered as one pale slab. Here the pivot is a point inside the
 * viewBox and every card is guaranteed to land where it was put.
 */
// The pivot sits just off the top-right corner and the cards hang DOWN and to
// the left, which is how a hand is actually held. Fanning up from a low pivot
// put most of every card above the hero's own edge, so all that showed was the
// tips — vertical streaks rather than a hand.
function CardFan({ count, urgency }) {
    const spread = 13 + urgency * 5;
    const mid = (count - 1) / 2;
    return (
        <svg viewBox="0 0 200 200" aria-hidden="true"
            className="absolute -top-4 -right-6 w-60 h-60 sm:w-80 sm:h-80 pointer-events-none select-none">
            <g transform="translate(168 18)">
                {Array.from({ length: count }, (_, i) => (
                    <g key={i} transform={`rotate(${20 + (i - mid) * spread})`}>
                        <rect x="-30" y="0" width="60" height="132" rx="8"
                            fill="currentColor" className="text-white" fillOpacity="0.08"
                            stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
                    </g>
                ))}
            </g>
        </svg>
    );
}

/**
 * One marker per day remaining.
 *
 * Drawn right-to-left so the last marker — the SAC itself — is pinned at the
 * end and the strip grows backwards from it. That way the flag never moves;
 * only the distance to it does.
 */
function Runway({ days, band }) {
    const r = runway(days);
    const reduce = useReducedMotion();
    return (
        <div className="flex items-center gap-1.5 mt-4" aria-hidden="true">
            {r.overflow && (
                <span className="text-[11px] font-black text-white/50 mr-0.5">+</span>
            )}
            {Array.from({ length: r.total }, (_, i) => {
                // Index 0 is the furthest day out; the lit run sits at the end.
                const lit = i >= r.total - r.lit;
                const fromEnd = r.total - 1 - i;
                return (
                    <motion.span
                        key={i}
                        initial={reduce ? false : { scaleY: 0.3, opacity: 0 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        transition={{ delay: reduce ? 0 : 0.25 + fromEnd * 0.025, duration: 0.35 }}
                        className={`h-5 sm:h-6 flex-1 max-w-[14px] rounded-full origin-bottom ${
                            lit ? band.pip : band.pipDim}`}
                        style={{ opacity: lit ? 1 : undefined }}
                    />
                );
            })}
            {/* The date itself, always at the end of the strip. */}
            <span className={`ml-1.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0
                ${r.today ? "bg-white text-streak" : "bg-white/25 text-white"}`}>
                <CalendarDays className="w-3.5 h-3.5" />
            </span>
        </div>
    );
}

export default function SacHero({ sac, days, daysLabel, feel, dateLabel }) {
    const band = sacBand(days);
    const reduce = useReducedMotion();
    const u = band.urgency;

    return (
        <div className={`relative overflow-hidden rounded-3xl p-6 lg:p-8 text-white shadow-soft h-full
            ${band.grad} ${band.glow}`}>
            <CardFan count={fanCards(days)} urgency={u} />

            {/* Ace, at the end of the runway. Amplitude and speed track urgency
                — a slow drift when there's room, a tight bob when there isn't. */}
            <motion.div
                className="absolute right-4 bottom-3 sm:right-8 sm:bottom-4 w-20 sm:w-28 pointer-events-none"
                data-ace-sac={feel.pose}
                animate={reduce ? {} : { y: [0, -4 - u * 4, 0] }}
                transition={reduce ? {} : {
                    duration: 4.4 - u * 2.6, repeat: Infinity, ease: "easeInOut",
                }}
            >
                {/* Black on the coloured banner rather than white: the white
                    silhouette washed out against the warm end of every ramp. */}
                <AceBody className="w-full" pose={feel.pose} title="Ace"
                    tone="fill-slate-900" card="fill-white" cardStroke="stroke-white" />
            </motion.div>

            {/* Right padding reserves Ace's corner. Without it a short card —
                the day itself, where the copy is shortest — let the line run
                under him. */}
            <div className="relative h-full flex flex-col justify-center pr-20 sm:pr-28">
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
                    {band.label}
                </p>
                <div className="flex items-end gap-4 flex-wrap">
                    <p className="font-display font-black leading-none tabular-nums"
                        style={{ fontSize: "clamp(3rem, 8vw, 5rem)" }}>
                        {daysLabel}
                    </p>
                    <div className="mb-2 min-w-0">
                        <p className="font-extrabold text-white truncate text-lg">
                            {sac.subject_name} — {sac.title}
                        </p>
                        <p className="text-sm text-white/75">{dateLabel}</p>
                        <p className="text-sm font-bold text-white/90 mt-1 max-w-md" data-ace-sac-line>
                            {feel.line}
                        </p>
                    </div>
                </div>

                <div className="max-w-md"><Runway days={days} band={band} /></div>

                <div className="flex gap-2 mt-5 flex-wrap">
                    <Link to="/Study?tab=exam"
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${band.chip}`}>
                        <GraduationCap className="w-4 h-4" /> Run a timed mock
                    </Link>
                    <Link to="/Study?tab=spaced_repetition"
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${band.chip}`}>
                        <BookOpen className="w-4 h-4" /> Review cards
                    </Link>
                </div>
            </div>
        </div>
    );
}
