/**
 * QueueRow — one thing you owe, with the reason and the way to answer it.
 *
 * ─── A ROW IS A SPINE, NOT A BOX ────────────────────────────────────────────
 * Six of these stack, and six bordered cards inside a bordered panel is the
 * "blob patched on top of the page" the study setup screens were rebuilt out
 * of. The KIND's colour is a spine down a flush row — the idiom Subjects, the
 * Quizzes shelf and WhatToTest already use to identify a thing — so the eye
 * runs straight down the list instead of hunting for the next card edge.
 *
 * ─── EVERY ROW CARRIES A REASON, and that is the whole point ────────────────
 * "12 cards ready" is a number. "12 cards ready — 4 came up for review, 8 you
 * have never opened" is something a student can decide about. The reason is
 * not decoration and it is never generated: it is the evidence the count was
 * computed from, which is the same rule the ATAR components keep about their
 * own bars.
 *
 * ─── AND THE ACTION IS ON THE ROW ───────────────────────────────────────────
 * A bar with no way through is a DIAGNOSIS — Ranked's own lesson, on the page
 * that is now the app's to-do list. Every row ends in the button that does the
 * thing, so nothing here is a readout the student has to work out the screen
 * for.
 *
 * The TOP row gets the loud button and the rest get quiet ones. Six filled
 * buttons in a column is a toolbar, and the queue has already said which one
 * is costing the most by putting it first.
 */
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    CalendarClock, PenLine, RotateCcw, Target, TrendingDown, Layers, ArrowRight,
} from "lucide-react";

/**
 * ─── THE SPINE IS THE TIER, NOT THE KIND ────────────────────────────────────
 * Six kinds against a five-hue palette means two of them share a colour
 * whatever you do, and the first version picked the pairing by accident:
 * "Mistakes" and "Sit again" both came out purple, two rows apart, for no
 * reason a student could read.
 *
 * Colouring by TIER makes the accident the point. The queue is ranked —
 * deadline, then marks already dropped, then marks about to be, then the
 * routine pile — and four tiers against four hues means the ORDER is visible
 * as bands down the left edge before a single word is read. Three purple rows
 * in a row is now a statement: those are all things that have already cost
 * you marks.
 *
 * The KIND is carried by the glyph and the word above the title, which is
 * where it belongs: it says what the row is, and the colour says how much it
 * costs to skip.
 *
 * STATIC CLASS NAMES in both tables, because Tailwind's JIT cannot see a
 * template string — the recurring gotcha this codebase records.
 */
export const TIER_INK = {
    deadline: { spine: "bg-streak",  ink: "text-streak" },
    dropped:  { spine: "bg-chart-4", ink: "text-chart-4" },
    decaying: { spine: "bg-chart-3", ink: "text-chart-3" },
    routine:  { spine: "bg-primary", ink: "text-primary" },
};

/** `label` is the kind said in the student's words, never the internal name. */
export const KIND_META = {
    assessment: { icon: CalendarClock, label: "Assessment" },
    unmarked:   { icon: PenLine,       label: "Unmarked" },
    resit:      { icon: RotateCcw,     label: "Sit again" },
    decay:      { icon: TrendingDown,  label: "Slipping" },
    mistakes:   { icon: Target,        label: "Mistakes" },
    cards:      { icon: Layers,        label: "Cards" },
};

export default function QueueRow({ item, href, lead = false, index = 0 }) {
    const meta = KIND_META[item.kind];
    const tier = TIER_INK[item.tier];
    // A kind or tier with no look is drawn plainly rather than not at all:
    // losing a real piece of work because somebody added one and forgot the
    // table is the worse failure.
    const Icon = meta?.icon || Layers;
    const spine = tier?.spine || "bg-border";
    const ink = tier?.ink || "text-muted-foreground";

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.3 }}
            data-queue-kind={item.kind}
            className="relative flex items-start gap-3 sm:gap-4 py-3.5 pl-4 pr-3 sm:pr-4
                border-t border-border first:border-t-0 transition-colors hover:bg-secondary/40">

            {/* The spine. Full height of the row, flush to its left edge. */}
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${spine}`} aria-hidden="true" />

            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ink}`} aria-hidden="true" />

            <div className="flex-1 min-w-0">
                <p className={`stat-label ${ink}`}>{meta?.label || item.kind}</p>
                <p className="font-display font-extrabold text-foreground leading-snug mt-0.5">
                    {item.title}
                </p>
                {item.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.detail}</p>
                )}
                {/* THE REASON. Never generated, never a restatement of the
                    title — it is the evidence the count came from. */}
                {item.why && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">{item.why}</p>
                )}

                {/* On a phone the action sits under the text rather than beside
                    it: a 44px button and three lines of copy do not share a row
                    at 360 without the copy going to five lines. */}
                <div className="sm:hidden mt-2.5">
                    <Action href={href} lead={lead} cta={item.cta} />
                </div>
            </div>

            <div className="hidden sm:block flex-shrink-0 self-center">
                <Action href={href} lead={lead} cta={item.cta} />
            </div>
        </motion.div>
    );
}

function Action({ href, lead, cta }) {
    const base = "inline-flex items-center gap-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap";
    return (
        <Link to={href}
            className={lead
                ? `${base} px-4 py-2.5 bg-foreground text-background hover:opacity-90`
                : `${base} px-3 py-2 border-2 border-border text-foreground hover:border-foreground/40 hover:bg-secondary`}>
            {cta}
            <ArrowRight className="w-3.5 h-3.5" />
        </Link>
    );
}
