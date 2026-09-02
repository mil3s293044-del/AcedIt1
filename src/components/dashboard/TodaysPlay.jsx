/**
 * TodaysPlay — the day's one instruction, and the case for it.
 *
 * ─── What it is ─────────────────────────────────────────────────────────────
 * Three columns, and each one is a different job:
 *
 *   THE BRAIN    which systems this move works, drawn over the systems the
 *                student's last four weeks actually lit. A region dark in
 *                their history and full in the move is the argument, drawn.
 *   THE MOVE     what to do, one line on why, one button.
 *   THE CASE     the trigger fact, the gap, and what it is worth in ATAR
 *                points. See todaysCase.js — every row is dropped when its
 *                number is not real.
 *
 * ─── Why the brain and not the playing card ─────────────────────────────────
 * The card was right about one thing and wrong about another. Right that the
 * hero should be an OBJECT rather than a notification bar — that is why the
 * rest of the page is still cards. Wrong that a rank could carry the argument:
 * an Ace tells you the move is urgent, which the headline already said, and
 * then the largest element on the most important panel is spending its space
 * restating one word.
 *
 * The brain spends the same space on something nothing else in the product
 * says. It is the student's own 28-day technique history (`brainActivity`),
 * so a Pomodoro-only month reads as a bright front and a dark middle at a
 * glance, and the move's own regions come up full on top of it. It is also
 * already built, already cited, and already the thing the landing page and
 * the signup wizard use to sell the app — this is the first time a student
 * sees it aimed at their own work.
 *
 * The card language is untouched everywhere else on the page: YourHand, the
 * subject deck, the quiz table, ClearedPile.
 *
 * ─── What is drawn is never the only copy of a fact ─────────────────────────
 * The cloud is atmosphere; the regions are named in HTML beside it. If the
 * canvas never paints — reduced motion, an old device, a screen reader —
 * nothing factual is lost. BrainModel's own header makes the same promise and
 * this panel keeps it.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import CommitmentRun from "@/components/dashboard/CommitmentRun";
import BrainModel from "@/components/study/BrainModel";

/** Static class lookups — Tailwind cannot see a class built at runtime. */
const ROW_TONE = {
    trigger: "text-foreground",
    brain:   "text-chart-4",
    payoff:  "text-primary",
};

export default function TodaysPlay({
    move, theme, commitment, fmtTime, todaysCase,
    // The day's numbers. They used to live in a separate green panel beside
    // this one — two boxes both headed "today", which is one box. They now sit
    // as a footer strip rather than a third column, because the case beside
    // the move is what the panel is FOR and the numbers are context on it.
    todayMins, weekMins, weekGoalHours, weekPct, avgQuiz,
}) {
    const reduce = useReducedMotion();
    const Icon = move.icon;
    // The badge follows the target the panel actually SHOWS. It used to fire
    // off the XP goal, which is no longer drawn anywhere, so "Hit" would have
    // appeared against nothing the student could see they had hit.
    const hit = !!commitment?.met;
    const done = !!commitment?.met;
    const rows = todaysCase?.rows || [];
    const regions = todaysCase?.regions || [];
    // No history and no technique means every region would read the same, and
    // an identical picture for every student is the decoration this app keeps
    // taking out. See todaysCase's `hasBrain`.
    const showBrain = Boolean(todaysCase?.hasBrain) && regions.length > 0;

    return (
        <div className="rounded-2xl bg-surface border border-border on-table overflow-hidden">
            <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8 p-5 lg:p-6">

                {/* ── The brain ─────────────────────────────────────────── */}
                {showBrain && (
                    <div className="lg:w-[300px] flex-shrink-0 flex flex-col justify-center">
                        {/* `plate` gives the cloud a dark backing so the unlit
                            points stay visible in light mode — without it the
                            dark half of the picture, which is the half making
                            the argument, disappears into the panel. */}
                        <div className="relative rounded-2xl overflow-hidden">
                            <BrainModel regions={regions} height={224} glow />
                        </div>
                        {/* The regions in HTML, because the canvas is
                            atmosphere and this is the fact. Only what the move
                            works — the student's own history is in the
                            brightness, not in this list. */}
                        {todaysCase?.gaps?.length > 0 && (
                            <p className="text-[11px] text-muted-foreground leading-snug mt-2 text-center lg:text-left">
                                Wakes{" "}
                                <span className="font-bold text-foreground">
                                    {todaysCase.gaps.map((g) => g.name).join(", ")}
                                </span>
                                {" "}— quiet in your last four weeks.
                            </p>
                        )}
                    </div>
                )}

                {/* ── What it says, and the one button ──────────────────── */}
                {/* The COLUMN fills; the TEXT is capped inside it. Capping the
                    column instead left the surplus as one 500px hole between
                    the button and the rail on a wide screen — the middle of
                    the most important panel on the page, empty. Text stops
                    being comfortable somewhere around 75 characters, so the
                    headline and the line under it carry their own measure and
                    the column is free to close the gap. */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-7 h-7 rounded-lg ${theme.iconBg}
                            flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${theme.iconText}`} />
                        </span>
                        <p className="stat-label">{done ? "Today" : move.label}</p>
                    </div>
                    {/* It grows with the viewport rather than sitting at one
                        size and leaving the extra width as a hole beside the
                        rail. A short headline on a wide screen is the only
                        thing here that can honestly take the space — padding
                        the copy or the rail to fill it would be inventing
                        content to fix a layout. */}
                    <h2 className="font-display font-extrabold text-foreground
                        text-xl lg:text-3xl xl:text-4xl leading-tight tracking-tight max-w-2xl">
                        {done ? "You did what you said you'd do." : move.title}
                    </h2>
                    <p className="text-muted-foreground text-sm lg:text-base mt-2 leading-relaxed max-w-lg">
                        {done
                            ? `${fmtTime(commitment.done)} against the ${fmtTime(commitment.target)} you committed to.`
                            : move.sub}
                    </p>

                    {/* The commitment, as cards. It was a 1.5px bar under the
                        copy while a ring three columns over drew a made-up XP
                        target at 112px across — the honest number small and the
                        invented one large. */}
                    <CommitmentRun commitment={commitment} fmtTime={fmtTime} />

                    <Link to={createPageUrl(move.link)} className="inline-block mt-5">
                        <Button size="lg" className="text-base">
                            {move.cta} <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                {/* ── The case ──────────────────────────────────────────── */}
                {/* Dropped entirely when nothing survived. A rail of dashes on
                    a first-week account teaches a student that the numbers on
                    this page are decoration. */}
                {rows.length > 0 && (
                    <div className="lg:w-[264px] flex-shrink-0 lg:border-l lg:border-border/70
                        lg:pl-7 pt-5 lg:pt-0 border-t border-border/70 lg:border-t-0
                        flex flex-col justify-center">
                        <p className="stat-label mb-3">Why this</p>
                        <ul className="space-y-3.5">
                            {rows.map((r, i) => (
                                <motion.li key={r.kind}
                                    initial={reduce ? false : { opacity: 0, x: 6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: 0.25 + i * 0.08 }}
                                    className="leading-tight">
                                    <span className={`font-display font-extrabold text-xl tabular-nums
                                        ${ROW_TONE[r.kind] || "text-foreground"}`}>
                                        {r.value}
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                                        {r.label}
                                    </span>
                                </motion.li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* ── The day's numbers ─────────────────────────────────────── */}
            {/* A strip, not a column. Three small readouts standing beside the
                case would compete with it for the same corner, and the case is
                the thing this panel exists to make. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/70
                bg-secondary/30 px-5 lg:px-6 py-3">
                <span className="flex items-center gap-2">
                    <span className="stat-label">Today</span>
                    {hit && <span className="pill bg-primary/15 text-primary">Hit</span>}
                </span>
                <span className="flex items-baseline gap-1.5 text-xs">
                    <span className="font-bold text-muted-foreground">Time</span>
                    <span className="font-bold text-foreground tabular-nums">{fmtTime(todayMins)}</span>
                </span>
                <span className="flex items-baseline gap-1.5 text-xs min-w-[9rem] flex-1 max-w-[16rem]">
                    <span className="font-bold text-muted-foreground">Week</span>
                    <span className="font-bold text-foreground tabular-nums">
                        {fmtTime(weekMins)}
                        <span className="text-muted-foreground/60"> / {weekGoalHours}h</span>
                    </span>
                    <span className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden ml-1">
                        <motion.span
                            className={`block h-full rounded-full ${weekPct >= 100 ? "bg-primary" : "bg-xp"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${weekPct}%` }}
                            transition={{ duration: 0.9, delay: 0.35 }} />
                    </span>
                </span>
                <span className="flex items-baseline gap-1.5 text-xs">
                    <span className="font-bold text-muted-foreground">Avg quiz</span>
                    <span className="font-bold text-foreground tabular-nums">
                        {avgQuiz != null ? `${avgQuiz}%` : "-"}
                    </span>
                </span>
            </div>
        </div>
    );
}
