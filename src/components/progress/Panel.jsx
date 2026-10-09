/**
 * Panel — one block inside a tab: a heading, a rule to the end of the row,
 * and the thing itself. NOT A CARD.
 *
 * ─── CARDS ARE FOR ACTIONS. EVERYTHING ELSE IS A RULED SECTION ──────────────
 * Measured on the render that prompted this: a tab drew six `card-soft` boxes
 * — the outstanding-work rows, the figure strip and every panel — all the
 * same object at the same weight. So nothing on the screen said which of them
 * could be PRESSED, which is the "nineteen identical boxes" failure the AI
 * Tools console section records, on the page whose own rework had just
 * established that the action outranks the analytics.
 *
 * One rule now carries the whole hierarchy: **a bordered, elevated box is
 * something you do; a heading with a rule under it is something you read.**
 * The queue rows keep `card-soft on-table` and are the only thing on a tab
 * that has it, so they lead by construction rather than by being bigger.
 *
 * The rule itself is the Quizzes-shelf idiom and does the job the border was
 * doing: it TERMINATES the band, so the space beside a two-row list is margin
 * somebody chose rather than somewhere content failed to reach.
 *
 * `note` is where a panel SAYS WHAT IT COUNTED. A figure whose basis is not
 * stated is one a student cannot argue with, which is the rule every board on
 * Ranked keeps about its own window.
 */
import React from "react";
import { motion } from "framer-motion";

export default function Panel({ title, note, action, children, delay = 0 }) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="pt-1">
            <div className="flex items-baseline gap-3 mb-1">
                <h3 className="font-display font-extrabold text-foreground text-sm">{title}</h3>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                {action}
            </div>
            {note && <p className="text-xs text-muted-foreground mb-3.5 leading-snug max-w-prose">{note}</p>}
            {!note && <div className="mb-3.5" />}
            {children}
        </motion.section>
    );
}
