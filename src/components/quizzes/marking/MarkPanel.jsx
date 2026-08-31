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
 * MISSED CRITERIA FIRST. A list that opens with three ticks buries the one
 * line the student needed to read. `orderedCriteria` does the sorting; this
 * only renders it.
 *
 * THE MARK IS A FRACTION, NOT A PERCENTAGE. "2/4" is what an assessor writes
 * and it keeps the itemisation underneath it checkable — three criteria worth
 * one, one and two should visibly add up to the number at the top. When they
 * did not, `normaliseMark` has already recomputed the number from the list and
 * flagged it, and this says so rather than printing a total it knows is wrong.
 *
 * FULL MARKS SAYS NOTHING ELSE. No praise, no "great job". The existing marker
 * prompt already refuses to write praise for a clean mark; printing an empty
 * feedback card under it would undo that.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import InlineEdit from "@/components/quizzes/marking/PenMarks";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { orderedCriteria, isFullMarks } from "@/lib/quizMarking";

/** Static lookups — Tailwind cannot see a class assembled at runtime. */
const BAND = {
    full: "text-primary",
    most: "text-chart-3",
    some: "text-xp",
    none: "text-streak",
};
const bandFor = (m) => {
    if (m.outOf <= 0) return "none";
    const r = m.marks / m.outOf;
    return r >= 1 ? "full" : r >= 0.7 ? "most" : r >= 0.4 ? "some" : "none";
};

function Criterion({ c, index }) {
    const reduce = useReducedMotion();
    return (
        <motion.li
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.06, 0.4) }}
            className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 border
                ${c.got ? "bg-primary/5 border-primary/20" : "bg-streak/5 border-streak/20"}`}
        >
            <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0
                ${c.got ? "bg-primary" : "bg-streak"}`}>
                {c.got
                    ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    : <X className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <MarkdownMath className="text-sm font-bold text-foreground leading-snug">
                        {c.text}
                    </MarkdownMath>
                    <span className={`text-[11px] font-black tabular-nums flex-shrink-0
                        ${c.got ? "text-primary" : "text-streak"}`}>
                        {c.got ? "+" : "−"}{c.worth}
                    </span>
                </div>
                {c.note && (
                    <MarkdownMath className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {c.note}
                    </MarkdownMath>
                )}
            </div>
        </motion.li>
    );
}

/**
 * One suggested rewrite, as the landing page draws it: their phrase struck
 * through, the one that scores underlined beside it, and what the swap buys.
 */
function Edit({ e, index }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 + index * 0.1 }}
            className="rounded-2xl bg-surface border border-border p-3.5"
        >
            <p className="text-base leading-relaxed">
                <InlineEdit was={e.was} now={e.now} delay={0.3 + index * 0.1} />
            </p>
            <div className="flex items-baseline gap-2 flex-wrap mt-2.5">
                <span className="stat-label">AcedIt · {e.criterion}</span>
                <span className="pill bg-primary/15 text-primary">+{e.worth} mark{e.worth === 1 ? "" : "s"}</span>
            </div>
            {e.why && (
                <MarkdownMath className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                    {e.why}
                </MarkdownMath>
            )}
        </motion.div>
    );
}

export default function MarkPanel({ mark, title }) {
    if (!mark) return null;
    const ordered = orderedCriteria(mark);
    const clean = isFullMarks(mark);

    return (
        <div data-mark-panel={title} className="space-y-3">
            {/* The mark, as an assessor writes it. */}
            <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    {title && <span className="stat-label text-muted-foreground">{title}</span>}
                    {clean && <span className="pill bg-primary/15 text-primary">Clean mark</span>}
                </div>
                <p className="font-display font-black tabular-nums leading-none">
                    <span className={`text-2xl ${BAND[bandFor(mark)]}`}>{mark.marks}</span>
                    <span className="text-sm text-muted-foreground">/{mark.outOf}</span>
                </p>
            </div>

            {mark.criteria.length > 0 && (
                <>
                    <ul className="space-y-1.5">
                        {ordered.map((c, i) => <Criterion key={`${c.text}-${i}`} c={c} index={i} />)}
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
                </>
            )}

            {mark.edits.length > 0 && (
                <div className="space-y-2 pt-1">
                    <p className="stat-label text-muted-foreground">Worth rewording</p>
                    {mark.edits.map((e, i) => <Edit key={`${e.was}-${i}`} e={e} index={i} />)}
                </div>
            )}

            {/* No itemisation came back — render exactly what the old marker
                returned rather than an empty panel. */}
            {!mark.itemised && (mark.whatWrong || mark.improve) && (
                <div className="space-y-2">
                    {mark.whatWrong && (
                        <p className="text-sm text-foreground leading-relaxed">{mark.whatWrong}</p>
                    )}
                    {mark.improve && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{mark.improve}</p>
                    )}
                </div>
            )}
        </div>
    );
}
