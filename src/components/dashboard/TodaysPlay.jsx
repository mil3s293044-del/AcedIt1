/**
 * TodaysPlay — the day's one instruction, as the card Ace deals you.
 *
 * What it replaces was a tinted banner: an icon in a rounded square, a label,
 * a headline, a line of copy and a button, on a pastel background that changed
 * colour with the accent. It worked, and it looked like every notification bar
 * ever shipped — which is a problem for the single most important element on
 * the page, because "the one thing to do today" was reading as "a message the
 * app would like you to dismiss".
 *
 * SO IT IS A CARD, OFF THE TOP OF A DECK. The rest of the product is built on
 * PlayingCard now — the review deck, the quiz table, the landing hero — and
 * the dashboard was the one screen that did not know the object existed. A
 * card is also the right SHAPE for this content: it is a single thing, it is
 * physical, and it arrives, which a banner never does.
 *
 * THE RANK IS NOT DECORATION. It is how urgent the move is, on the scale every
 * card player already knows: an Ace is the deadline you cannot beat, a Jack is
 * "you have not started yet", a 9 is "you are already going, here is a bonus".
 * Someone who never reads a word of the label still gets the ordering right.
 *
 * The deal is the same motion the review deck and the quiz table use, so this
 * is the third time a visitor sees it and the first time they see it on their
 * own data.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";

/** How many backs sit under the dealt card. Enough to read as a deck. */
const DEPTH = 3;
const STEP = 4;
const R = 42;
const CIRC = 2 * Math.PI * R;

export default function TodaysPlay({
    move, card, theme, commitment, fmtTime,
    // The day's numbers. They used to live in a separate green panel beside
    // this one — two boxes both headed "today", which is one box.
    todayXP, dailyGoal, todayMins, weekMins, weekGoalHours, weekPct, avgQuiz,
}) {
    const reduce = useReducedMotion();
    const Icon = move.icon;
    const hit = todayXP >= dailyGoal;

    return (
        <div className="rounded-2xl bg-surface border border-border shadow-soft p-5 lg:p-6">
            <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8">

                {/* ── The deck, and the card off the top of it ──────────── */}
                {/* The deck leans LEFT out of its own box, so the box is padded
                    to hold the overhang. Without that the panel's own rounding
                    clipped the bottom corner off the lowest back and it read as
                    a rendering bug rather than as a deck. */}
                <div className="relative flex-shrink-0 mx-auto lg:mx-0"
                    style={{ width: 168, height: 208 }}>
                    {/* THE POSITIONING IS ON A WRAPPER, not on CardBack.
                        CardBack's own class list opens with `relative`, and
                        Tailwind emits position utilities in a fixed order where
                        `relative` comes after `absolute` — so an `absolute`
                        handed in through className loses, every back stays in
                        normal flow, and the deck unstacks itself down the
                        page. Same trap as the review pile and the hero hand. */}
                    {Array.from({ length: DEPTH }, (_, k) => (
                        <div key={k} className="absolute w-[118px]"
                            style={{
                                left: 8 - k * STEP, top: 22 - k * STEP,
                                transform: `rotate(${-7 - k * 1.6}deg)`,
                                zIndex: DEPTH - k,
                                opacity: 1 - k * 0.14,
                            }}>
                            <CardBack tone={card.tone} flat={k > 0}
                                className="w-full aspect-[2.5/3.5]" />
                        </div>
                    ))}

                    <motion.div
                        data-todays-play
                        className="absolute right-0 top-0 w-[134px]"
                        style={{ zIndex: 20 }}
                        /* Dealt FROM the deck: it starts where the backs are,
                           turned over, and lands square on top of them. */
                        initial={reduce ? { opacity: 0 } : {
                            opacity: 0, x: -40, y: 18, rotate: -24, scale: 0.86,
                        }}
                        animate={{ opacity: 1, x: 0, y: 0, rotate: 3.5, scale: 1 }}
                        transition={reduce ? { duration: 0.2 } : {
                            type: "spring", stiffness: 170, damping: 18, mass: 0.9, delay: 0.18,
                        }}
                        whileHover={reduce ? undefined : { rotate: 0, y: -6, scale: 1.04 }}
                    >
                        <PlayingCard rank={card.rank} suit={card.suit} tone={card.tone}
                            smallIndices className="w-full aspect-[2.5/3.5]">
                            <span className="absolute inset-0 flex flex-col items-center
                                justify-center gap-2.5 px-3 text-center">
                                <span className={`w-12 h-12 rounded-xl ${theme.iconBg}
                                    flex items-center justify-center`}>
                                    <Icon className={`w-6 h-6 ${theme.iconText}`} />
                                </span>
                                <span className="stat-label leading-tight">{move.label}</span>
                            </span>
                        </PlayingCard>
                    </motion.div>
                </div>

                {/* ── What it says, and the one button ──────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="stat-label mb-1.5">Your play</p>
                    <h2 className="font-display font-extrabold text-foreground
                        text-xl lg:text-2xl leading-snug tracking-tight">
                        {commitment?.met ? "You did what you said you'd do." : move.title}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed max-w-lg">
                        {commitment?.met
                            ? `${fmtTime(commitment.done)} against the ${fmtTime(commitment.target)} you committed to.`
                            : move.sub}
                    </p>

                    {commitment && !commitment.met && (
                        <div className="mt-3 max-w-md">
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[11px] font-bold text-foreground">
                                    {fmtTime(commitment.done)} of {fmtTime(commitment.target)}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    {commitment.done === 0
                                        ? "you committed to this today"
                                        : `${commitment.pct}%`}
                                </span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${commitment.pct}%` }}
                                    transition={{ duration: 0.7, delay: 0.3 }}
                                    className={`h-full rounded-full ${theme.bar}`}
                                />
                            </div>
                        </div>
                    )}

                    <Link to={createPageUrl(move.link)} className="inline-block mt-5">
                        <Button>{move.cta} <ArrowRight className="w-4 h-4" /></Button>
                    </Link>
                </div>

                {/* ── The day's numbers ─────────────────────────────────── */}
                <div className="lg:w-[212px] flex-shrink-0 lg:border-l lg:border-border/70
                    lg:pl-7 pt-5 lg:pt-0 border-t border-border/70 lg:border-t-0
                    flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="stat-label">Today</p>
                        {hit && <span className="pill bg-primary/15 text-primary">Hit</span>}
                    </div>

                    <div className="relative w-28 h-28 mx-auto">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9"
                                className="stroke-secondary" />
                            <motion.circle cx="50" cy="50" r={R} fill="none" strokeWidth="9"
                                strokeLinecap="round"
                                className={hit ? "stroke-primary" : "stroke-xp"}
                                strokeDasharray={CIRC}
                                initial={{ strokeDashoffset: CIRC }}
                                animate={{ strokeDashoffset: CIRC * (1 - Math.min(1, todayXP / dailyGoal)) }}
                                transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <p className="font-display font-extrabold text-foreground
                                text-2xl leading-none tabular-nums">{(todayXP || 0).toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1">
                                / {dailyGoal} XP
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 mt-3">
                        <div className="flex items-baseline justify-between">
                            <p className="text-xs font-bold text-muted-foreground">Time today</p>
                            <p className="text-xs font-bold text-foreground">{fmtTime(todayMins)}</p>
                        </div>
                        <div>
                            <div className="flex items-baseline justify-between mb-1">
                                <p className="text-xs font-bold text-muted-foreground">This week</p>
                                <p className="text-xs font-bold text-foreground">
                                    {fmtTime(weekMins)}
                                    <span className="text-muted-foreground/60"> / {weekGoalHours}h</span>
                                </p>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${weekPct}%` }}
                                    transition={{ duration: 0.9, delay: 0.35 }}
                                    className={`h-full rounded-full ${weekPct >= 100 ? "bg-primary" : "bg-xp"}`}
                                />
                            </div>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <p className="text-xs font-bold text-muted-foreground">Avg quiz</p>
                            <p className="text-xs font-bold text-foreground">
                                {avgQuiz != null ? `${avgQuiz}%` : "-"}
                            </p>
                        </div>
                    </div>

                    <Link to={createPageUrl("Study")} className="mt-4">
                        <Button size="sm" variant="outline" className="w-full">
                            <Play className="w-3.5 h-3.5" /> Study now
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
