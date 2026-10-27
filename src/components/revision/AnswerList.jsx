/**
 * AnswerList — the answers worth learning, each with its ladder.
 *
 * The mistake bank's row, pointed the other way: the headline is the QUESTION
 * (an answer is only worth anything against the question it answers), the
 * label says whose answer it is — your own full-mark one, or the model answer
 * — and the ladder is on every row at every width, because how far through it
 * an answer is, is the most useful thing to know about it.
 *
 * Answers saved on the Quizzes page before this existed sit under their own
 * heading and move in with one tap. Never on page load: a screen that writes
 * rows because it was opened is the `autoBankRows` mistake.
 */
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Play, Check, Archive, Trash2, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownMath from "@/components/shared/MarkdownMath";
import QuestionPanel from "@/components/mistakes/QuestionPanel";
import LadderTrack from "@/components/mistakes/LadderTrack";
import ForChip from "@/components/shared/ForChip";
import { exemplarMeta, answerSteps, answerState, parseSavedAnswer } from "@/lib/answerBank";

const STATE = {
    slipping:   { label: "slipping — it comes back tomorrow", text: "text-streak" },
    new:        { label: "not drilled yet", text: "text-muted-foreground" },
    rehearsing: { label: "on the ladder", text: "text-xp" },
    learned:    { label: "learned", text: "text-primary" },
};
const KIND = {
    own: { label: "Your full-mark answer", cls: "bg-primary/10 text-primary" },
    model: { label: "Model answer", cls: "bg-chart-3/10 text-chart-3" },
    yours_unmarked: { label: "Your answer (never marked)", cls: "bg-secondary text-muted-foreground" },
};

function AnswerRow({ card, onRetire, onDelete, index, tags }) {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);
    const meta = exemplarMeta(card);
    const state = answerState(card);
    const steps = useMemo(() => answerSteps(card), [card]);
    const look = STATE[state];
    const kind = KIND[meta.kind] || KIND.model;

    return (
        <motion.li data-answer={state}
            initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.25) }}
            className="rounded-2xl border-2 border-border bg-surface overflow-hidden">
            {/* NOT ONE BIG BUTTON. The question sits in a QuestionPanel, which
                carries its own "show the whole question" control, and a button
                inside a button is invalid and eats the inner tap. So the row is
                a block with the opener on its own. */}
            <div className="px-3.5 py-3 grid gap-x-3 gap-y-2 grid-cols-[1fr_auto] sm:grid-cols-[1fr_9.5rem_auto] items-start">
                <div className="min-w-0">
                    <QuestionPanel label="" tone="plain" textClass="text-sm font-bold text-foreground leading-snug">
                        {meta.question}
                    </QuestionPanel>
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
                        <span className={`pill text-[10px] ${kind.cls}`}>{kind.label}</span>
                        {meta.outOf ? <span className="tabular-nums">{meta.outOf} mark{meta.outOf === 1 ? "" : "s"}</span> : null}
                        {meta.topic && <span className="truncate max-w-[14rem]">· {meta.topic}</span>}
                        <span className={`font-bold ${look.text}`}>· {look.label}</span>
                    </p>
                </div>
                <div className="col-span-2 sm:col-span-1 order-last sm:order-none sm:mt-0.5" data-answer-ladder>
                    <LadderTrack steps={steps} compact />
                </div>
                <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                    aria-label={open ? "Hide the answer" : "Show the answer"} data-answer-open
                    className="-mr-1 -mt-0.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
            </div>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-3.5 pb-3.5 pt-3 space-y-3 border-t border-border/60">
                            <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
                                <p className="stat-label text-primary">{meta.kind === "own" ? "What you wrote" : "The answer"}</p>
                                <MarkdownMath className="text-sm text-foreground leading-relaxed mt-1">{meta.answer}</MarkdownMath>
                            </div>
                            {meta.criteria.length > 0 && (
                                <div>
                                    <p className="stat-label text-muted-foreground">What earned the marks</p>
                                    <ul className="mt-1.5 space-y-1">
                                        {meta.criteria.map((c) => (
                                            <li key={c} className="flex items-start gap-2 text-sm text-foreground leading-snug">
                                                <Check className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" strokeWidth={3} />
                                                <MarkdownMath className="min-w-0">{c}</MarkdownMath>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <LadderTrack steps={steps} />
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <ForChip tags={tags} kind="answers" id={card.id} subject={card.subject_name} />
                                <Button size="sm" variant="outline" onClick={() => onRetire?.([card])} data-answer-retire
                                    className="border-2 border-border rounded-xl gap-1.5 text-xs">
                                    <Archive className="w-3.5 h-3.5" /> Put it away
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => onDelete?.(card)} data-answer-delete
                                    className="rounded-xl gap-1.5 text-xs text-muted-foreground hover:text-streak">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.li>
    );
}

/** An answer saved before the bank existed. Readable; drillable once moved in. */
function LegacyRow({ row, onMove, moving }) {
    const p = parseSavedAnswer(row);
    return (
        <li className="rounded-2xl border-2 border-dashed border-border px-3.5 py-3 flex flex-col sm:flex-row sm:items-start gap-3" data-legacy={row.id}>
            <div className="min-w-0 flex-1">
                <QuestionPanel label="" tone="plain" textClass="text-sm font-bold text-foreground leading-snug">
                    {p.question || row.title}
                </QuestionPanel>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Saved from {row.topic || "a quiz"}{p.model ? " · has a model answer" : ""}
                </p>
            </div>
            <Button size="sm" onClick={() => onMove(row)} disabled={moving} data-legacy-move
                className="h-8 rounded-xl gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/15 border-2 border-primary/30 flex-shrink-0">
                <ArrowDownToLine className="w-3.5 h-3.5" /> {moving ? "Moving…" : "Start learning it"}
            </Button>
        </li>
    );
}

export default function AnswerList({ answers = [], legacy = [], ready = [], onDrill, onRetire, onDelete, onMoveLegacy, movingId, empty, tags }) {
    const order = { slipping: 0, new: 1, rehearsing: 2, learned: 3 };
    const sorted = [...answers].sort((a, b) => order[answerState(a)] - order[answerState(b)]);
    if (!answers.length && !legacy.length) return empty || null;
    return (
        <div className="space-y-4" data-answer-list>
            {answers.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="text-sm text-muted-foreground flex-1 min-w-[12rem]">
                        <span className="font-bold text-foreground tabular-nums">{answers.length}</span> saved ·{" "}
                        <span className="text-primary font-bold tabular-nums">{answers.filter((c) => answerState(c) === "learned").length}</span> learned
                    </p>
                    {ready.length > 0 && onDrill && (
                        <Button size="sm" onClick={() => onDrill(ready)} data-answers-drill
                            className="btn-3d h-9 bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-1.5 text-xs">
                            <Play className="w-3.5 h-3.5" /> Drill {ready.length} ready
                        </Button>
                    )}
                </div>
            )}
            {answers.length > 0 && (
                <ul className="space-y-2">
                    {sorted.map((c, i) => <AnswerRow key={c.id} card={c} index={i} onRetire={onRetire} onDelete={onDelete} tags={tags} />)}
                </ul>
            )}
            {legacy.length > 0 && (
                <div className="space-y-2" data-legacy-list>
                    <p className="stat-label text-muted-foreground">Saved before you could drill them</p>
                    <ul className="space-y-2">
                        {legacy.map((row) => <LegacyRow key={row.id} row={row} onMove={onMoveLegacy} moving={movingId === row.id} />)}
                    </ul>
                </div>
            )}
        </div>
    );
}
