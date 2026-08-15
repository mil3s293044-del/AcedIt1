/**
 * Payout — the thing a question gives back the moment it is answered.
 *
 * The wizard's structural problem was that four of six screens took and none
 * of them gave. Every one of those answers is worth something back
 * immediately, and it has to be a FACT rather than a compliment: "great
 * choice!" is what a form says when it has nothing.
 *
 * So each question pays out one true, checkable line derived from the answer
 * itself. It arrives under the question a beat after the pick lands, in the
 * shape of a card being turned face up, and it is deliberately small. A
 * payout that took a screen would be another wall between the student and the
 * next question; a payout that is one sentence is a reason to answer the next
 * one.
 */
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/**
 * When the exams this student is working toward actually are.
 *
 * VCE written exams run from late October; Units 1 and 2 exams sit in
 * November; junior years finish out the school year in December. Computed
 * against the current date rather than hard-coded, so the number is right in
 * March and still right in September, and it rolls to next year once the date
 * has passed rather than counting backwards.
 */
export function weeksUntilExams(yearLevel, now = new Date()) {
    const senior = /Year 12/.test(yearLevel || "");
    const eleven = /Year 11/.test(yearLevel || "");
    // Month is 0-indexed: 9 = October, 10 = November, 11 = December.
    const [month, day] = senior ? [9, 25] : eleven ? [10, 5] : [11, 12];

    let target = new Date(now.getFullYear(), month, day);
    if (target <= now) target = new Date(now.getFullYear() + 1, month, day);

    const weeks = Math.round((target - now) / (7 * 86400000));
    const label = senior
        ? "until VCE written exams start"
        : eleven
            ? "until end-of-year exams"
            : "until the end of the school year";
    return { weeks, label };
}

export default function Payout({ show, children, delay = 0.45 }) {
    const reduce = useReducedMotion();
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    data-payout
                    className="mt-5 rounded-2xl bg-primary/5 border border-primary/15 p-4"
                    // Turned over, not faded in. It is a card arriving, and the
                    // rotate is small enough to read as a flick of the wrist
                    // rather than as a spin.
                    initial={reduce
                        ? { opacity: 0 }
                        : { opacity: 0, y: 12, rotate: -1.5, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={reduce
                        ? { duration: 0.25, delay }
                        : { type: "spring", stiffness: 230, damping: 24, delay }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
