/**
 * Reveal — ONE entrance for a whole page, instead of eight.
 *
 * ─── What this replaces ─────────────────────────────────────────────────────
 * Compete had roughly eight sections, each carrying its own
 * `initial={{ opacity: 0, y: 12 }} animate={...}` with its own duration and
 * its own hand-picked delay. Nothing coordinated them, so the page did not
 * arrive — it twitched into place in eight unrelated movements, and a
 * component added later simply guessed a delay that did not fit the ones
 * either side of it.
 *
 * A stagger container is the whole fix: the parent owns the timing, children
 * declare only that they are part of it, and the page assembles as one gesture.
 *
 * ─── AND MOST THINGS SHOULD NOT ANIMATE ON ARRIVAL AT ALL ───────────────────
 * This is the more important half. A page a student opens every morning should
 * not perform for them; an entrance animation is a cost paid on every visit
 * for information that was true before they arrived. Motion means SOMETHING
 * CHANGED — a number moving, a row overtaking, a call-out landing — and the
 * live system already owns all of those. Every fade-in spent on content that
 * merely appeared makes the ones that carry meaning land less.
 *
 * So the entrance here is deliberately small and quick (`RISE` is 6px, not the
 * 12 the page used) and there is a hard rule about what it wraps: the SHELL of
 * a page, once. Never a list that re-renders, never a row whose data updates,
 * never anything already animating on change.
 *
 * `prefers-reduced-motion` collapses it to nothing at all.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Small on purpose. A big slide reads as the page being assembled twice. */
const RISE = 6;

const container = (reduce, stagger) => ({
    hidden: {},
    shown: {
        transition: reduce ? {} : { staggerChildren: stagger, delayChildren: 0.02 },
    },
});

const item = (reduce) => ({
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: RISE },
    shown: {
        opacity: 1,
        y: 0,
        transition: reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
    },
});

/**
 * Wrap a page's top-level sections. Children are `Reveal.Item`, or any
 * `motion` element carrying `variants={revealItem}`.
 */
export default function Reveal({ children, stagger = 0.05, className = "" }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            variants={container(reduce, stagger)}
            initial="hidden"
            animate="shown"
            className={className}
        >
            {children}
        </motion.div>
    );
}

function Item({ children, className = "", ...rest }) {
    const reduce = useReducedMotion();
    return (
        <motion.div variants={item(reduce)} className={className} {...rest}>
            {children}
        </motion.div>
    );
}

Reveal.Item = Item;

/** For a section that needs to be its own element type (a button, a section). */
export const revealItem = item;
