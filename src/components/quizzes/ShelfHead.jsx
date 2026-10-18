/**
 * ShelfHead — the top of /Quizzes: the quiz to sit next, and how it is going.
 *
 * The page used to open on FOUR things answering overlapping questions before
 * the first quiz appeared: an eyebrow reading "4 quizzes · 70% avg", a coach
 * headline reading "70% average — keep at it", a hero panel with a giant "4
 * quizzes" and a tile reading "70%", a mistake-bank panel that said "—" on an
 * account with nothing banked, and a "Next quiz" strip offering whichever quiz
 * happened to be first in the list under a sentence about active recall.
 * 70% three times, the quiz count twice, and the one decision — what to sit —
 * was the fifth thing down and not actually decided.
 *
 * Now it is one block:
 *
 *   THE CARD   the next quiz's own deck card, rank and all — rank is your best
 *              on it, so it is the same card that will turn on the results.
 *              Tapping it, or the button, opens the table before the sit.
 *   THE REASON why this quiz, as a fact a student can check against the card
 *              (`nextSit` / `nextSitLine`): last sat at 58%, never sat, last
 *              sat nine days ago, your lowest.
 *   TWO FIGURES average and trend, each saying what it is over, and the trend
 *              saying what unlocks it rather than printing a dash forever.
 *
 * The mistake bank is a third figure ONLY when there is something in it — an
 * empty bank had a panel the size of the hero explaining what a bank is.
 *
 * With no quizzes it is the one ask the page makes, and the shelf below is not
 * drawn: a heading, a toolbar and an empty box would be three more things
 * saying "you have none".
 */
import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import { suitFor } from "@/components/cards/cardIdentity";
import { createPageUrl } from "@/utils";
import { nextSitLine, sitHistory } from "@/lib/quizSit";

function Figure({ value, label, tone = "text-foreground", to, testid }) {
    const body = (
        <>
            <p className={`font-display font-extrabold text-2xl sm:text-[1.75rem] leading-none tabular-nums ${tone}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{label}</p>
        </>
    );
    return to ? (
        <Link to={to} data-figure={testid}
            className="block min-w-0 rounded-xl -m-2 p-2 hover:bg-secondary/60 transition-colors">{body}</Link>
    ) : <div data-figure={testid} className="min-w-0">{body}</div>;
}

export default function ShelfHead({
    next, summary, bank, attempts = [], tone, sharedWaiting = 0,
    onSit, onGenerate, onCreate,
}) {
    const reduce = useReducedMotion();

    // ── No quizzes: the one ask ─────────────────────────────────────────────
    if (!next) {
        return (
            <section data-shelf-head="empty"
                className="card-soft on-table p-5 sm:p-7 flex flex-col sm:flex-row gap-4 sm:gap-7 items-start sm:items-center">
                {/* Above the words on a phone: beside them, the column left the
                    button wider than the card it sat in. */}
                <div className="w-14 sm:w-24 aspect-[2.5/3.5] flex-shrink-0 -rotate-3" aria-hidden="true">
                    <CardBack className="w-full h-full rounded-xl shadow-soft" />
                </div>
                <div className="min-w-0">
                    <p className="stat-label">Quizzes</p>
                    <h1 className="font-display font-extrabold text-xl sm:text-3xl text-foreground leading-tight mt-1">
                        Make your first quiz from your notes.
                    </h1>
                    <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
                        Upload notes, a chapter or a photo of your book. It writes VCAA-style questions, and marks your written answers the way an examiner would.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                        <Button onClick={onGenerate} className="btn-3d gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl">
                            <Wand2 className="w-4 h-4" /> Make a quiz from notes
                        </Button>
                        <button type="button" onClick={onCreate}
                            className="text-sm font-bold text-muted-foreground hover:text-foreground underline underline-offset-4">
                            or write one yourself
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    const quiz = next.quiz;
    const history = sitHistory(quiz, attempts);
    const line = nextSitLine(next);
    const trend = summary?.trend;
    const avg = summary?.avgScore;

    return (
        <section data-shelf-head={next.reason}
            className="card-soft on-table p-5 sm:p-7 lg:flex lg:items-stretch lg:gap-10">
            {/* On a wide screen the figures take a column of their own: under
                the sit they were a short rule and three numbers with half the
                card empty beside them. */}
            <div className="flex-1 min-w-0">
            <div className="flex gap-4 sm:gap-7 items-start">
                {/* The card is the quiz. A button, because sitting it is the one
                    thing this block is for. */}
                <motion.button type="button" onClick={() => onSit?.(quiz)} data-next-card
                    aria-label={`Sit ${quiz.title}`}
                    className="w-[4.75rem] sm:w-28 aspect-[2.5/3.5] flex-shrink-0 rounded-xl
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    initial={reduce ? false : { opacity: 0, y: -14, rotate: -6 }}
                    animate={{ opacity: 1, y: 0, rotate: -2 }}
                    whileHover={reduce ? undefined : { y: -4, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                    <PlayingCard rank={history.rank} suit={suitFor(quiz.subject)} tone={tone} pips
                        smallIndices watermark={false} className="w-full h-full shadow-soft-lg" />
                </motion.button>

                <div className="min-w-0 flex-1">
                    <p className="stat-label truncate">Sit next · {quiz.subject || "Quiz"}</p>
                    <h1 className="font-display font-extrabold text-xl sm:text-3xl text-foreground leading-tight mt-1">
                        {quiz.title}
                    </h1>
                    {line && <p className="text-sm sm:text-base text-muted-foreground mt-1.5" data-next-reason>{line}</p>}
                    <Button onClick={() => onSit?.(quiz)} data-next-sit
                        className="btn-3d gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl mt-4">
                        Sit it <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {sharedWaiting > 0 && (
                <Link to="/Friends" className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-chart-3 hover:underline underline-offset-4">
                    {sharedWaiting} quiz{sharedWaiting === 1 ? "" : "zes"} shared with you <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            )}
            </div>

            {/* ── How it is going ───────────────────────────────────────────── */}
            <div data-shelf-figures
                className={`grid gap-4 mt-6 pt-5 border-t border-border
                    lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-10 lg:w-72 lg:grid-cols-1 lg:content-center lg:gap-5
                    ${bank?.total > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
                <Figure testid="average"
                    value={avg != null ? `${avg}%` : "—"}
                    tone={avg == null ? "text-muted-foreground/60" : avg >= 85 ? "text-primary" : avg >= 60 ? "text-xp" : "text-streak"}
                    label={avg != null ? `average of your last ${summary.avgOver === 1 ? "sit" : `${summary.avgOver} sits`}` : "average, after your first sit"} />
                <Figure testid="trend"
                    value={trend == null ? "—" : trend === 0 ? "Level" : `${trend > 0 ? "+" : "−"}${Math.abs(trend)}`}
                    tone={trend == null ? "text-muted-foreground/60" : trend > 0 ? "text-primary" : trend < 0 ? "text-streak" : "text-foreground"}
                    label={trend == null
                        ? `trend, after ${summary?.trendNeeds ?? 0} more sit${summary?.trendNeeds === 1 ? "" : "s"}`
                        : `points on the ${summary.trendOver} before`} />
                {bank?.total > 0 && (
                    <Figure testid="bank" to={createPageUrl("MistakeBank")}
                        value={bank.outstanding}
                        tone={bank.outstanding > 0 ? "text-streak" : "text-primary"}
                        label={bank.outstanding > 0
                            ? `mistake${bank.outstanding === 1 ? "" : "s"} to fix${bank.ready > 0 ? ` · ${bank.ready} ready` : ""}`
                            : `all ${bank.total} fixed`} />
                )}
            </div>
        </section>
    );
}
