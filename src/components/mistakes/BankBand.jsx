/**
 * BankBand — one subject's mistakes, as a band on the shelf; and BankPile, the
 * headline's picture of the pile.
 *
 * ─── ONE ORGANISATION ───────────────────────────────────────────────────────
 * The bank used to show the same mistakes three ways: a by-subject accordion
 * with a Review button per subject AND per topic, six state filter chips over
 * two rows, and the full list. Subject is the unit a student sits down with
 * before a SAC, so the page is subject bands — the Quizzes shelf's idiom, a
 * colour spine and a rule to the end of the row — and the topic rides on each
 * row, where it labels the mistake without becoming a second menu.
 *
 * ─── A STATE IS SAID ONCE ───────────────────────────────────────────────────
 * Each row drew its state as a dot, a coloured border, a segment of the bar
 * and a chip. It is one word now, in its colour, beside the topic. The ladder
 * track beside it is a DIFFERENT fact — how far through the rehearsal it is —
 * and it is drawn on every width: it was `hidden sm:block`, so on a phone the
 * most useful thing about the bank disappeared.
 *
 * ─── "YOU KEEP MAKING THIS" IS ON THE ROW ───────────────────────────────────
 * It was a panel above the list naming criteria, two inches from the rows it
 * was about. A count on the row says the same thing where the mistake is, and
 * the "explain" hand-over to the AI tools moved into the opened row, where it
 * is offered for every mistake rather than only repeated ones.
 */
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ForChip from "@/components/shared/ForChip";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownMath from "@/components/shared/MarkdownMath";
import QuestionPanel from "@/components/mistakes/QuestionPanel";
import LadderTrack from "@/components/mistakes/LadderTrack";
import { createPageUrl } from "@/utils";
import { toolQuery } from "@/lib/toolBrief";
import { colorFor } from "@/components/cards/cardIdentity";
import { mistakeMeta } from "@/lib/mistakeBank";
import { stepsFor } from "@/lib/bankRun";

/** The state, in words, in its colour. Static classes — JIT cannot see an assembled one. */
export const STATE = {
    slipping: { label: "still getting it wrong", text: "text-streak" },
    new:      { label: "not drilled yet",        text: "text-muted-foreground" },
    working:  { label: "coming back",            text: "text-xp" },
    drilled:  { label: "rehearsed — sit it to prove it", text: "text-chart-3" },
    fixed:    { label: "fixed",                  text: "text-primary" },
};

/**
 * The pile, shrinking. One slot per mistake, fixed at the end, in ONE colour —
 * the bar used five, which needed a five-entry legend to be read, and the rows
 * already say each one's state. Past PILE_SLOTS_MAX it is a continuous bar.
 */
export function BankPile({ pile }) {
    const reduce = useReducedMotion();
    if (!pile?.total) return null;
    const label = `${pile.fixed} of ${pile.total} fixed`;
    if (!pile.slots) {
        return (
            <div role="img" aria-label={label} data-pile="bar" className="h-2.5 rounded-full bg-foreground/10 overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full"
                    initial={reduce ? false : { width: 0 }} animate={{ width: `${pile.pct}%` }}
                    transition={{ duration: 0.6, delay: 0.15 }} />
            </div>
        );
    }
    return (
        <div role="img" aria-label={label} data-pile="slots" className="flex gap-1">
            {pile.slots.map((fixed, i) => (
                <motion.span key={i}
                    className={`h-2.5 flex-1 rounded-full ${fixed ? "bg-primary" : "bg-foreground/10"}`}
                    initial={reduce || !fixed ? false : { opacity: 0, scaleY: 0.3 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.3, delay: 0.15 + i * 0.03 }} />
            ))}
        </div>
    );
}

/** One mistake. The criterion IS the headline — it is what was wanted. */
function MistakeRow({ row, attempts, onClear, index, tags }) {
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();
    const { card, state, topic, repeat } = row;
    const meta = mistakeMeta(card);
    const look = STATE[state];
    // The SAME steps the drill run draws — see stepsFor for the card whose
    // counter sat on a rung it could not build, and lit nothing.
    const steps = useMemo(() => stepsFor(card, attempts), [card, attempts]);
    const subject = card.subject_name || null;

    return (
        <motion.li data-mistake={state}
            initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.25) }}
            className="rounded-2xl border-2 border-border bg-surface overflow-hidden">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className="w-full text-left px-3.5 py-3 cursor-pointer grid gap-x-3 gap-y-2
                    grid-cols-[1fr_auto] sm:grid-cols-[1fr_8.5rem_3.25rem] items-start">
                <span className="min-w-0">
                    <MarkdownMath className="text-sm font-bold text-foreground leading-snug">
                        {meta.criterion || card.question}
                    </MarkdownMath>
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                        {topic && <span className="truncate max-w-full">{topic}</span>}
                        {meta.cost > 0 && <span className="tabular-nums">· cost {meta.cost} mark{meta.cost === 1 ? "" : "s"}</span>}
                        <span className={`font-bold ${look.text}`}>· {look.label}</span>
                    </span>
                </span>
                {/* The ladder, on every width: under the words on a phone,
                    beside them from sm up. */}
                <span className="col-span-2 sm:col-span-1 order-last sm:order-none sm:mt-0.5" data-row-ladder>
                    <LadderTrack steps={steps} compact />
                </span>
                {/* A FIXED column, so every ladder on the band lines up whether
                    or not a row carries a repeat badge. */}
                <span className="flex items-center justify-end gap-1.5 flex-shrink-0">
                    {repeat > 1 && (
                        <span className="pill bg-streak/10 text-streak text-[10px] font-black tabular-nums"
                            title={`You have dropped this criterion ${repeat} times`} data-repeat={repeat}>
                            {repeat}×
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-3.5 pb-3.5 pt-3 space-y-2.5 border-t border-border/60">
                            {meta.question && <QuestionPanel>{meta.question}</QuestionPanel>}
                            {meta.quote && (
                                <p className="text-sm text-muted-foreground italic leading-snug">You wrote “{meta.quote}”</p>
                            )}
                            <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
                                <p className="stat-label text-primary">What scores</p>
                                <MarkdownMath className="text-sm text-foreground leading-snug mt-0.5">{card.answer}</MarkdownMath>
                            </div>
                            <LadderTrack steps={steps} />
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                                {/* THE HANDOVER. The exact words an assessor wanted
                                    are the most specific thing the app knows about
                                    a student's writing; the ladder DRILLS them, and
                                    this is the other half for when it is not clear
                                    what they mean. */}
                                {meta.criterion && (
                                    <Link data-explain
                                        to={`${createPageUrl("AITools")}?${toolQuery({
                                            tool: "concept_explainer",
                                            subject,
                                            seed: `An assessor marked me down for this: "${meta.criterion}"${subject ? ` in ${subject}` : ""}. Explain what they are actually looking for, and show me what a full-mark version sounds like.`,
                                        })}`}
                                        className="text-xs font-bold text-muted-foreground hover:text-foreground underline underline-offset-4">
                                        Ask what the assessor means
                                    </Link>
                                )}
                                {/* On its own, or with its quiz: a mistake follows the quiz
                                    it came from into a SAC, and this tags the one mark. */}
                                <ForChip tags={tags} kind="mistakes" id={card.id} subject={subject} />
                                {state === "fixed" && (
                                    <Button size="sm" variant="outline" onClick={() => onClear?.([card])}
                                        className="border-2 border-border rounded-xl gap-1.5 text-xs">
                                        <Check className="w-3.5 h-3.5 text-primary" /> Clear it out of the bank
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.li>
    );
}

export default function BankBand({ band, attempts, onDrill, onClear, tags }) {
    const tone = colorFor(band.subject);
    return (
        <section data-band={band.subject} aria-label={band.subject}>
            {/* A RULE TO THE END OF THE ROW, the Quizzes shelf's idiom: it ends
                the band, so a heading reads as a shelf rather than a label. */}
            <div className="flex items-center gap-2.5 mb-3">
                <span className="w-1.5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: tone }} aria-hidden="true" />
                <h2 className="font-display font-extrabold text-foreground truncate">{band.subject}</h2>
                <span className="text-xs font-bold text-muted-foreground tabular-nums flex-shrink-0">
                    {band.fixed} of {band.total} fixed
                </span>
                <span className="flex-1 h-px bg-border" aria-hidden="true" />
                {/* What its own count says: READY, not total. */}
                {band.ready.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => onDrill(band.ready)} data-band-drill
                        className="h-8 border-2 border-primary/40 text-primary hover:bg-primary/10 rounded-xl gap-1.5 text-xs flex-shrink-0">
                        <Play className="w-3 h-3" /> Drill {band.ready.length}
                    </Button>
                )}
            </div>
            <ul className="space-y-2">
                {band.rows.map((row, i) => (
                    <MistakeRow key={row.card.id} row={row} index={i} attempts={attempts} onClear={onClear} tags={tags} />
                ))}
            </ul>
        </section>
    );
}
