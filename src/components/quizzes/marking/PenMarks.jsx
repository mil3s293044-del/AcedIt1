/**
 * PenMarks — the two strokes an assessor actually makes, drawn rather than
 * printed.
 *
 * Lifted out of the landing page's MarkedWord, which had them hardcoded to the
 * marketing palette. Same paths, same wobble, same reason: a straight
 * `line-through` and a `border-bottom` say the same thing and read as a
 * spreadsheet. These arrive the way a pen arrives, by animating pathLength.
 *
 * On design tokens now, because in the app they have to survive a theme —
 * the landing page gets to hardcode #FF4B4B, a component used inside the
 * product does not.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** A stroke with a wobble in it, so it reads as a pen and not as a rule. */
const STRIKE = "M1 5.4 C 22 3.2, 44 6.6, 66 4.2 S 92 5.8, 99 3.9";
const UNDER = "M1 4.2 C 24 6.8, 47 2.4, 70 5.6 S 93 3.2, 99 5.0";

function Stroke({ d, colour, className, width, delay }) {
    const reduce = useReducedMotion();
    return (
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"
            className={`absolute overflow-visible pointer-events-none ${className}`}>
            <motion.path d={d} fill="none" stroke={colour}
                strokeWidth={width} strokeLinecap="round" vectorEffect="non-scaling-stroke"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduce ? { duration: 0 } : { duration: 0.5, delay, ease: "easeInOut" }} />
        </svg>
    );
}

/** Struck through — the words that cost the mark. */
export function StruckText({ children, delay = 0 }) {
    return (
        <span className="relative inline-block text-muted-foreground">
            {children}
            <Stroke d={STRIKE} colour="hsl(var(--streak))" width="3.2" delay={delay}
                className="left-[-3%] top-1/2 w-[106%] h-[0.42em] -translate-y-1/2" />
        </span>
    );
}

/** Underlined — what an assessor wanted instead. */
export function UnderlinedText({ children, delay = 0.3 }) {
    const reduce = useReducedMotion();
    return (
        <span className="relative inline-block">
            <motion.span className="inline-block font-bold text-primary"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: delay * 0.6 }}>
                {children}
            </motion.span>
            <Stroke d={UNDER} colour="hsl(var(--primary))" width="3.4" delay={delay}
                className="left-[-2%] -bottom-[0.12em] w-[104%] h-[0.3em]" />
        </span>
    );
}

/**
 * One edit: the phrase they wrote, struck, and the one that scores, underlined.
 *
 * NOTHING REFLOWS — both halves occupy their space from the first paint, so a
 * paragraph does not jump around as the marks arrive. That was the rule on the
 * landing page for a centred headline and it matters more here, where the edit
 * sits inside a block of the student's own prose.
 */
export default function InlineEdit({ was, now, delay = 0 }) {
    return (
        <span data-inline-edit className="relative inline-block">
            <StruckText delay={delay}>{was}</StruckText>{" "}
            <UnderlinedText delay={delay + 0.3}>{now}</UnderlinedText>
        </span>
    );
}
