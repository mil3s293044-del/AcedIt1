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
 * ─── The card is back, and its face is the work ────────────────────────────
 * This column has been a dealt playing card, then a brain, and now a card
 * again — but not the same card. The first one turned over to an icon and the
 * move's LABEL, which is the headline beside it restated in the largest
 * element on the page. The brain carried real information and none of it was
 * about the work.
 *
 * It now turns over to the ACTUAL FIRST THING they would face: the real
 * question off their own deck, the real assessment title, the clock counting
 * the block. Seeing the work beats any description of it, and it is the one
 * thing here that cannot be wrong, because it is their own material. See
 * MovePreview, and `previewFor` for the rule that it is never invented.
 *
 * ─── The rail is the evidence, and it is text ──────────────────────────────
 * Nothing factual lives in the card. A student who never turns it over still
 * has the headline, the case and the button — the flip adds appetite, never
 * information.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import CommitmentRun from "@/components/dashboard/CommitmentRun";
import MovePreview from "@/components/dashboard/MovePreview";

/** Static class lookups — Tailwind cannot see a class built at runtime. */
const ROW_TONE = {
    trigger: "text-foreground",
    risk:    "text-streak",
    payoff:  "text-primary",
};

export default function TodaysPlay({
    move, card, theme, commitment, fmtTime, todaysCase, preview,
    // The day's numbers used to run along the bottom of this panel — today's
    // minutes, the week against a 20h goal, the average quiz. Removed: the
    // week's time is now a panel of its own that compares it to the student's
    // own usual rather than to a number nobody chose, the quiz average is on
    // Quizzes beside the trend that gives it meaning, and this panel is for
    // making ONE case. A strip of context under it was the third thing on
    // screen answering "how am I doing" and the weakest of the three.
}) {
    const reduce = useReducedMotion();
    const Icon = move.icon;
    const done = !!commitment?.met;
    const rows = todaysCase?.rows || [];

    return (
        <div className="rounded-2xl bg-surface border border-border on-table overflow-hidden">
            <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8 p-5 lg:p-6">

                {/* ── The card, and the deck it came off ───────────────── */}
                <div className="flex-shrink-0 flex flex-col justify-center lg:pr-2">
                    <MovePreview move={move} card={card} theme={theme} preview={preview} />
                </div>

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
                    <CommitmentRun commitment={commitment} fmtTime={fmtTime} hasCard={!!preview} />

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

        </div>
    );
}
