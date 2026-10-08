/**
 * Cleared — the done pile, and a row leaving the list it was on.
 *
 * In `components/study/` rather than inside Review.jsx so the probe can draw
 * the REAL components: /Review is auth-gated, and the one thing that settles a
 * layout is opening it. A fixture-shaped copy in the probe would be the mirror
 * this codebase keeps deleting, and the copy that drifted would be the one
 * anybody actually looked at.
 */
import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock } from "lucide-react";
import { KIND_META, TIER_INK } from "@/components/study/QueueRow";
import { hoursLabel } from "@/lib/studyQueue";

/**
 * ClearedStrip — the done pile, which this page did not have.
 *
 * ─── A TO-DO LIST WITH NO DONE PILE IS A LIST OF FAILINGS ───────────────────
 * Everything else on this page answers what a student OWES, and it gets
 * SHORTER the better they do — so the reward for clearing eighty cards was
 * arriving at the same screen as somebody who opened nothing, with a slightly
 * shorter list of things they had not done. `clearedThisWeek` is the other
 * half, counted off the same rows the queue is built from.
 *
 * ─── A STRIP, NOT A ROW OF TILES ────────────────────────────────────────────
 * Four bordered stat tiles is the shape this codebase keeps deleting — the old
 * quiz list, the nineteen-box dashboard. These are three or four small figures
 * that are read together as one sentence, so they are set as one: the number
 * leads each pair, the glyph is the queue's OWN glyph for that kind, and the
 * ink is the queue's own tier ink, so a figure and the row it came off cannot
 * be told apart by colour.
 *
 * ─── AND IT IS NOT DRAWN AT ALL ON A QUIET WEEK ─────────────────────────────
 * `any` is false when nothing was reviewed, sat or logged, and an empty strip
 * is the zero row every builder in `studyQueue.js` refuses — "0 cards reviewed
 * this week" printed at somebody on a Monday morning is the app telling them
 * off for the week not having happened yet.
 */
export function ClearedStrip({ cleared }) {
    const time = hoursLabel(cleared?.minutes);
    if (!cleared?.any) return null;

    const parts = [
        ...cleared.items.map((i) => ({
            key: i.kind,
            n: i.n.toLocaleString(),
            label: i.label,
            Icon: KIND_META[i.kind]?.icon || CheckCircle2,
            ink: TIER_INK[i.tier]?.ink || "text-primary",
        })),
        ...(time ? [{ key: "time", n: time, label: "studied", Icon: Clock, ink: "text-xp" }] : []),
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="card-soft on-table px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                <span className="inline-flex items-center gap-1.5 stat-label text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Cleared this week
                </span>
                {parts.map(({ key, n, label, Icon, ink }) => (
                    <span key={key} className="inline-flex items-baseline gap-1.5 min-w-0">
                        <Icon className={`w-3.5 h-3.5 self-center flex-shrink-0 ${ink}`} aria-hidden="true" />
                        <span className="font-display font-extrabold text-foreground tabular-nums">{n}</span>
                        <span className="text-xs text-muted-foreground truncate">{label}</span>
                    </span>
                ))}
            </div>
        </motion.div>
    );
}

/**
 * A row that has just stopped being true.
 *
 * ─── THE ONLY HONEST WAY TO CHECK SOMETHING OFF HERE ────────────────────────
 * The obvious build is a checkbox, and it cannot be done: the queue is DERIVED
 * and stores nothing, so a tick would need a "dismissed" flag — which is the
 * one thing `studyQueue.js`'s own header rules out, and which would let a
 * student tick away a SAC that is still on Friday. The ticking has to be the
 * WORK, not a control.
 *
 * So the page refetches when the student comes back to the tab, and anything
 * that was on the list and is not any more is held on screen for a moment with
 * a tick through it before it goes. Nothing is claimed that did not happen: an
 * item leaves this list because the fact behind it stopped being true, which
 * is the same reason it was on the list in the first place.
 */
export function ClearedRow({ item }) {
    const meta = KIND_META[item.kind];
    const Icon = meta?.icon || CheckCircle2;
    return (
        <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden border-t border-border first:border-t-0 bg-primary/5">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" aria-hidden="true" />
            <div className="flex items-center gap-3 sm:gap-4 py-3.5 pl-4 pr-3 sm:pr-4">
                <Icon className="w-4 h-4 flex-shrink-0 text-primary/60" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <p className="stat-label text-primary">Done</p>
                    <p className="font-display font-extrabold text-muted-foreground line-through
                        leading-snug mt-0.5 truncate">
                        {item.title}
                    </p>
                </div>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-primary" aria-hidden="true" />
            </div>
        </motion.div>
    );
}
