/**
 * FeatureWork — the outstanding work on THIS feature, at the top of its tab.
 *
 * ─── THE ACTION OUTRANKS THE ANALYTICS ──────────────────────────────────────
 * Every feature tab used to open with a 252px figure and put its one action in
 * the top-right corner as a small outlined button, with the panels below. So
 * the thing a student can DO was the smallest element on a screen full of
 * numbers about what they had already done — and on CARDS, the tab about
 * flashcards, the actual review was a corner button and a fold 1491 pixels
 * further down.
 *
 * ─── AND IT IS THE REAL QUEUE, NOT A SECOND ONE ─────────────────────────────
 * These are `studyQueue` items, filtered by kind through `TAB_KINDS`, drawn
 * with the same `QueueRow` the Today tab draws. Nothing is stored and nothing
 * is recomputed, so a count here cannot disagree with the same row one tab
 * over — which is the whole reason the filter is one exported map rather than
 * a list of kinds written out at each call site.
 *
 * ─── NO ROWS, NO BLOCK ──────────────────────────────────────────────────────
 * Not an empty state: the tab's own strip already carries the figure and a
 * door, and "nothing outstanding" printed above a report is a line that says
 * nothing. Hours has no outstanding-work kind at all and therefore never draws
 * one, which is honest rather than a gap — there is no such thing as an
 * overdue hour.
 */
import React from "react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import QueueRow from "@/components/study/QueueRow";

export default function FeatureWork({ items = [] }) {
    if (!items.length) return null;
    return (
        <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="card-soft on-table overflow-hidden">
            {items.map((item, i) => (
                <QueueRow key={item.key} item={item} index={i} lead={i === 0}
                    href={createPageUrl(item.page) + (item.query || "")} />
            ))}
        </motion.section>
    );
}
