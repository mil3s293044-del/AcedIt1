/**
 * QuizInsightRail — one panel, because a student has one next thing.
 *
 * ─── What this replaced ─────────────────────────────────────────────────────
 * Three stacked panels: "Where you're losing marks", "What the verb is costing
 * you", and "Fading fastest". Each was defensible on its own. Together, on a
 * page that ALSO carries a mistake-bank panel and a "Next quiz" strip, they
 * meant a student opening Quizzes was handed five different answers to "what
 * now", each with its own heading and its own bar chart, and no indication of
 * which one to believe. Choosing between five is work the app was supposed to
 * have already done.
 *
 * ─── Where the rest went ────────────────────────────────────────────────────
 * The command-term breakdown is DIAGNOSIS, not an action — it tells you the
 * verb is costing you, and the thing to do about it happens somewhere else. So
 * it lives on /MistakeBank now, next to the repeated-criterion grouping, which
 * is the same question asked a different way. The mistake bank is the diagnosis
 * screen; this page sits you down in front of questions.
 *
 * ─── The list is evidence first, estimate second ────────────────────────────
 * See `workQueue`. A question you have missed twice is a fact; a quiz "fading"
 * is a curve fitted to nobody's data. Blending them would have required
 * inventing an exchange rate between the two and then printing it as though it
 * were measured, so they stay in kind order and every row says which it is.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Loader2, Zap, Info, Bookmark, RotateCcw } from "lucide-react";
import { createPageUrl } from "@/utils";
import { workQueue, buildDrillQuestions, hasQuestionData } from "@/lib/quizInsight";

/** Shown where the panel needs data the student hasn't generated yet. */
function NotYet({ children }) {
    return (
        <div className="flex items-start gap-2 rounded-xl bg-secondary/50 p-3">
            <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">{children}</p>
        </div>
    );
}

const KIND = {
    miss: { icon: Target,    tone: "text-streak",  label: "Keeps catching you" },
    fade: { icon: RotateCcw, tone: "text-chart-3", label: "Going stale" },
};

export default function QuizInsightRail({ quizzes = [], attempts = [], onDrill, onOpenQuiz }) {
    const [drilling, setDrilling] = useState(false);

    const haveDetail = useMemo(() => hasQuestionData(attempts), [attempts]);
    const queue = useMemo(() => workQueue(quizzes, attempts), [quizzes, attempts]);

    const drill = async () => {
        const questions = buildDrillQuestions(queue.misses.map(m => m.spot), quizzes);
        if (!questions.length) return;
        setDrilling(true);
        try { await onDrill?.(questions, queue.misses.map(m => m.spot)); } finally { setDrilling(false); }
    };

    return (
        <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid gap-3 items-start"
            aria-label="What to work on"
        >
            <div className="card-soft p-4 border-2 border-border space-y-3">
                <p className="stat-label flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-streak" /> What to work on
                </p>

                {queue.total === 0 ? (
                    <NotYet>
                        {haveDetail
                            ? "Nothing has caught you out twice and nothing's gone stale. Sit something new."
                            : "This fills in from your next quiz — it needs to know which individual questions you missed, and older attempts didn't record that."}
                    </NotYet>
                ) : (
                    <>
                        <p className="text-xs text-muted-foreground leading-snug">
                            {queue.misses.length > 0 && (
                                <>
                                    {queue.misses.length} question{queue.misses.length === 1 ? "" : "s"} you&rsquo;ve
                                    missed more than once
                                    {queue.stale.length > 0 && ", then "}
                                </>
                            )}
                            {queue.stale.length > 0 && (
                                <>
                                    {queue.stale.length} quiz{queue.stale.length === 1 ? "" : "zes"} due
                                    a retake
                                </>
                            )}
                            .
                        </p>

                        <ul className="space-y-2">
                            {queue.rows.map((row, i) => {
                                const k = KIND[row.kind];
                                const Icon = k.icon;
                                // A fading quiz opens; a missed question has no
                                // screen of its own and is played by the button
                                // below, so it is not pretending to be a link.
                                const openable = row.kind === "fade" && row.quizId;
                                const body = (
                                    <>
                                        <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                                            {row.title}
                                        </p>
                                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                                            <Icon className={`w-3 h-3 flex-shrink-0 ${k.tone}`} />
                                            {row.where ? `${row.where} · ` : ""}{row.detail}
                                            {row.term && <> · <span className="capitalize">{row.term}</span></>}
                                        </p>
                                    </>
                                );
                                return (
                                    <li key={row.id}>
                                        {openable ? (
                                            <button onClick={() => onOpenQuiz?.(row.quizId)}
                                                className="w-full text-left rounded-xl border border-border p-2.5 hover:border-chart-3/50 hover:bg-secondary/30 transition-colors">
                                                {body}
                                            </button>
                                        ) : (
                                            <div className="rounded-xl border border-border p-2.5">{body}</div>
                                        )}
                                        {/* The seam between evidence and estimate, said once,
                                            where it happens. Two lists under one heading with
                                            no line between them reads as one ranking. */}
                                        {row.kind === "miss" && queue.rows[i + 1]?.kind === "fade" && (
                                            <p className="text-[10px] text-muted-foreground/70 pt-2.5 px-0.5">
                                                Below here is an estimate of what&rsquo;s fading, not a record of
                                                what you got wrong.
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {queue.total > queue.rows.length && (
                            <p className="text-[11px] text-muted-foreground">
                                + {queue.total - queue.rows.length} more
                            </p>
                        )}

                        {queue.misses.length > 0 && (
                            <>
                                <Button size="sm" onClick={drill} disabled={drilling}
                                    className="w-full rounded-xl gap-1.5 text-xs h-9 btn-3d">
                                    {drilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                    Drill just these {queue.misses.length}
                                </Button>
                                {/* Said plainly, because it happened without being asked
                                    for. An app that quietly writes rows on your behalf and
                                    never mentions it is one you stop being able to predict. */}
                                <p className="text-[10px] text-muted-foreground leading-snug">
                                    These exact questions, no AI and no waiting. They&rsquo;re also{" "}
                                    <Link to={createPageUrl("MistakeBank")}
                                        className="font-bold text-streak inline-flex items-center gap-0.5 hover:underline">
                                        <Bookmark className="w-2.5 h-2.5" />in your mistake bank
                                    </Link>
                                    , so they come back on their own schedule.
                                </p>
                            </>
                        )}
                    </>
                )}
            </div>
        </motion.aside>
    );
}
