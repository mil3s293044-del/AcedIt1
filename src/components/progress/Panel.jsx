/**
 * Panel — one block inside a tab: a heading, a rule to the end of the row, and
 * the thing itself.
 *
 * The rule is the Quizzes-shelf idiom and it is doing the same job here: a
 * heading over a two-row list reads as a hole without it, and these lists are
 * short by design — four command terms, three techniques, five subjects.
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
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="card-soft on-table p-5">
            <div className="flex items-baseline gap-3 mb-1">
                <h3 className="font-display font-extrabold text-foreground text-sm">{title}</h3>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                {action}
            </div>
            {note && <p className="text-xs text-muted-foreground mb-3.5 leading-snug">{note}</p>}
            {!note && <div className="mb-3.5" />}
            {children}
        </motion.section>
    );
}
