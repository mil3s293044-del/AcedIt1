/**
 * Placed — a panel that arrives the way a card is put down on a table.
 *
 * Every section of the dashboard used the same entrance: opacity 0 to 1, y 12
 * to 0, over 350ms, all of them starting at once or within a few tens of
 * milliseconds of each other. That is the default entrance animation, it is on
 * every page built in the last five years, and eight of them firing together
 * reads as "the page faded in", which is not an event.
 *
 * A CARD DOES NOT ARRIVE STRAIGHT. It comes in off-square, drops the last
 * few pixels, and settles. The rotation here is tiny, one degree or so, and
 * alternates side to side down the page so no two neighbours lean the same
 * way. You are not meant to notice any single one of them. You are meant to
 * come away with the impression that the page was dealt rather than rendered,
 * which is the whole reason the theme exists.
 *
 * The stagger is index-driven and deliberately short. A dashboard is a working
 * screen someone opens forty times a week, so the last panel has to be settled
 * well inside a second; anything more elegant is something they would come to
 * resent by Wednesday.
 *
 * Under reduced motion it is a plain fade with no movement at all.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Alternating lean, in degrees. Fixed rather than random: a layout that
 *  reshuffles itself on every re-render reads as a glitch, not as a table. */
const LIE = [-0.9, 0.7, -0.5, 1.0, -0.7, 0.6];

export default function Placed({ index = 0, className = "", children, ...rest }) {
    const reduce = useReducedMotion();
    const lie = LIE[index % LIE.length];

    return (
        <motion.section
            className={className}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22, rotate: lie * 3, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            transition={reduce ? { duration: 0.25 } : {
                type: "spring", stiffness: 240, damping: 24, mass: 0.7,
                delay: 0.05 + index * 0.07,
            }}
            {...rest}
        >
            {children}
        </motion.section>
    );
}
