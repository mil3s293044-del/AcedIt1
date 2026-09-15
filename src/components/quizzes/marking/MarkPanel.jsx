/**
 * MarkPanel — one part's mark, itemised.
 *
 * This is the landing page's promise, delivered on the student's own work. The
 * page shows a criterion list where you can see WHICH mark you dropped, and a
 * word-level edit showing what the better answer said instead; the product
 * used to return a number and two paragraphs. Same components now, same
 * meaning, on their answer rather than on a demo.
 *
 * ─── What goes where, and why ───────────────────────────────────────────────
 * ONE LEDGER, AND EVERY NUMBER COMES OFF IT. The fraction at the top, the
 * "costing you N marks" line, and the −n on each module are all the same
 * subtraction — see `markLedger`. They used to be two independent verdicts and
 * they disagreed in front of the student.
 *
 * LOST MARKS FIRST. A list that opens with three ticks buries the one line the
 * student needed to read. `markModules` does the sorting; this renders it.
 *
 * THE MARK IS A FRACTION, NOT A PERCENTAGE. "2/4" is what an assessor writes
 * and it keeps the itemisation underneath it checkable — three criteria worth
 * one, one and two should visibly add up to the number at the top. When they
 * did not, `normaliseMark` has already recomputed the number from the list and
 * flagged it, and this says so rather than printing a total it knows is wrong.
 *
 * AND THE FRACTION COMES FROM `quizScore`, not from the mark on its own. This
 * panel had the reconciled number when nothing else did, which is how a student
 * got a header pill reading 3/5 over this panel reading 0/5 on the same
 * question. One model now answers "what did this question score", every surface
 * reads it, and the two things it knows that a criteria list cannot — a blank
 * answer scores nothing, and marks the student awarded themselves on paper are
 * not in the itemisation — are SAID rather than left to look like an error.
 *
 * FULL MARKS SAYS NOTHING ELSE. No praise, no "great job". The existing marker
 * prompt already refuses to write praise for a clean mark; printing an empty
 * feedback card under it would undo that.
 *
 * THE ANSWER IS EVIDENCE, NOT A SECOND FEEDBACK LIST. It sits below the
 * modules and is underlined where the marker could point; the underline opens
 * a small label naming which mark that phrase belongs to, and clicking it
 * scrolls to that module. Everything you can DO lives in the module, on the
 * screen, not behind a hover.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import AnnotatedAnswer from "@/components/quizzes/marking/AnnotatedAnswer";
import MarkModule from "@/components/quizzes/marking/MarkModule";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { markLedger, isFullMarks } from "@/lib/quizMarking";
import { bankKey } from "@/lib/mistakeBank";

/** Static lookups — Tailwind cannot see a class assembled at runtime. */
const BAND = {
    full: "text-primary",
    most: "text-chart-3",
    some: "text-xp",
    none: "text-streak",
};
const bandFor = (awarded, outOf) => {
    if (outOf <= 0) return "none";
    const r = awarded / outOf;
    return r >= 1 ? "full" : r >= 0.7 ? "most" : r >= 0.4 ? "some" : "none";
};

export default function MarkPanel({ mark, score, title, answer, onBank, banked = new Set(), saving = new Set(), questionIndex = 0 }) {
    const ledger = useMemo(() => markLedger(mark), [mark]);
    // Which module a phrase belongs to, so pointing at one finds the other in
    // either direction.
    const moduleForAnnotation = useMemo(() => {
        const map = new Map();
        for (const mod of ledger.modules) for (const a of mod.evidence) map.set(a.id, mod);
        return map;
    }, [ledger]);

    const [flash, setFlash] = useState(null);
    const flashTimer = useRef(null);
    const rootRef = useRef(null);

    /** Bring one element into view and mark it for a beat. */
    const reveal = useCallback((selector, id) => {
        const el = rootRef.current?.querySelector(selector);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        clearTimeout(flashTimer.current);
        setFlash(id);
        flashTimer.current = setTimeout(() => setFlash(null), 1600);
    }, []);

    // Module → the phrase in their answer.
    const pointAtAnswer = useCallback((ann) => {
        reveal(`[data-annotation="${CSS.escape(ann.id)}"]`, `ann:${ann.id}`);
    }, [reveal]);

    // Phrase in their answer → the mark it belongs to.
    const pointAtModule = useCallback((ann) => {
        const mod = moduleForAnnotation.get(ann.id);
        if (mod) reveal(`[data-mark-module="${CSS.escape(mod.id)}"]`, `mod:${mod.id}`);
    }, [moduleForAnnotation, reveal]);

    if (!mark) return null;
    // The printed pair. `score` is quizScore's answer for this question and is
    // what every other surface prints; without one (a panel rendered on a mark
    // alone) fall back to the mark's own reconciled total.
    const awarded = score ? score.awarded : mark.marks;
    const outOf = score ? score.outOf : mark.outOf;
    const clean = score ? awarded >= outOf && outOf > 0 : isFullMarks(mark);
    // Everything still worth saving. The header offers the lot in one gesture
    // because a student with four dropped marks should not have to open four
    // modules to keep them.
    const unsaved = ledger.bankable.filter((m) => !banked.has(bankKey(m, questionIndex)));

    return (
        <div ref={rootRef} data-mark-panel={title} className="space-y-3">
            {/* The mark, as an assessor writes it. */}
            <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                    {title && <span className="stat-label text-muted-foreground">{title}</span>}
                    {clean && <span className="pill bg-primary/15 text-primary">Clean mark</span>}
                </div>
                <p className="font-display font-black tabular-nums leading-none">
                    <span className={`text-2xl ${BAND[bandFor(awarded, outOf)]}`}>{awarded}</span>
                    <span className="text-sm text-muted-foreground">/{outOf}</span>
                </p>
            </div>

            {ledger.modules.length > 0 && (
                <>
                    {/* The one sentence that says where the marks went, from the
                        same subtraction as the fraction above it. */}
                    {ledger.lost > 0 && (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground">
                                <span className="font-bold text-streak tabular-nums">
                                    {ledger.lost} mark{ledger.lost === 1 ? "" : "s"}
                                </span>{" "}
                                went on {ledger.lostModules.length} thing{ledger.lostModules.length === 1 ? "" : "s"}.
                            </p>
                            {onBank && unsaved.length > 1 && (
                                <button type="button"
                                    onClick={() => unsaved.forEach((m) => onBank(m))}
                                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-2.5 py-1
                                        text-xs font-bold text-foreground hover:border-primary/50 cursor-pointer transition-colors">
                                    <Bookmark className="w-3.5 h-3.5" /> Save all {unsaved.length}
                                </button>
                            )}
                        </div>
                    )}

                    <ul className="space-y-2">
                        {ledger.modules.map((mod, i) => (
                            <MarkModule key={mod.id} mod={mod} index={i}
                                banked={banked.has(bankKey(mod, questionIndex))}
                                saving={saving.has(bankKey(mod, questionIndex))}
                                onBank={onBank}
                                onPoint={pointAtAnswer}
                                flash={flash === `mod:${mod.id}`} />
                        ))}
                    </ul>

                    {/* Said out loud rather than hidden: the total printed at
                        the top was recalculated to match the list, because the
                        two disagreed. A student who can add up would have
                        caught it. */}
                    {mark.reconciled && (
                        <p className="text-xs text-muted-foreground italic">
                            Total taken from the criteria above.
                        </p>
                    )}

                    {/* The two ways the fraction at the top can legitimately
                        differ from the list under it, as ONE sentence rather
                        than two. Stated, because a number that does not add up
                        is indistinguishable from a broken one — which is the
                        whole reason this panel and the pill above it had to be
                        reconciled in the first place. Said separately they
                        contradicted each other: "nothing scored" sat directly
                        under a 4/5 on a question marked from paper. */}
                    {(score?.blank || score?.selfMarked) && (
                        <p className="text-xs text-muted-foreground italic">
                            {score.blank && !score.selfMarked && (
                                <>Nothing was written, so nothing scored — the criteria above are
                                what a full-mark answer needed.</>
                            )}
                            {score.blank && score.selfMarked && (
                                <>Nothing was written here, so the marker scored none of it.
                                The {score.self} above {score.self === 1 ? "is" : "are"} yours,
                                from paper.</>
                            )}
                            {!score.blank && score.selfMarked && (
                                <>Includes {score.self} mark{score.self === 1 ? "" : "s"} you
                                marked yourself.</>
                            )}
                            {score.selfMarked && <> XP is paid on {score.auto}/{score.outOf}.</>}
                        </p>
                    )}
                </>
            )}

            {/* Their own answer, marked where it went wrong. Only rendered
                when we HAVE the answer to mark — an annotation list with no
                text to sit on has nowhere to go, and printing the quotes on
                their own would be the out-of-context card this replaced. */}
            {answer && mark.annotations.length > 0 && (
                <div className="space-y-2 pt-1">
                    <p className="stat-label text-muted-foreground">Your answer, marked</p>
                    <div className="rounded-2xl bg-surface border border-border p-3.5">
                        <AnnotatedAnswer text={answer} annotations={mark.annotations}
                            onOpen={pointAtModule} flash={flash} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Underlined phrases point at the mark they belong to — tap one to jump to it.
                    </p>
                </div>
            )}

            {/* No itemisation came back — render exactly what the old marker
                returned rather than an empty panel. */}
            {!mark.itemised && (mark.whatWrong || mark.improve) && (
                <div className="space-y-2">
                    {mark.whatWrong && (
                        <MarkdownMath className="text-sm text-foreground leading-relaxed">{mark.whatWrong}</MarkdownMath>
                    )}
                    {mark.improve && (
                        <MarkdownMath className="text-sm text-muted-foreground leading-relaxed">{mark.improve}</MarkdownMath>
                    )}
                </div>
            )}
        </div>
    );
}
