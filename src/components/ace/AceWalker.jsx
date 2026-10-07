/**
 * AceWalker — Ace standing in the corner at mascot size, who walks.
 *
 * The companion used to be a 44px mark inside a card. That's a notification
 * with a face on it: it appears, it says a thing, it disappears. This is the
 * character himself, standing on the page, with the card coming out of his
 * mouth instead of the other way round.
 *
 * THE WALK. When the page changes he doesn't teleport — he strides in from
 * off the right edge, arrives, and settles. It costs about 900ms and it's the
 * entire difference between "a tooltip fired" and "he came with me".
 *
 * The cycle is two frames. `step` flips between -1 and 1, which lifts one foot
 * and drops the other, and the body bobs a couple of pixels on the same beat.
 * Two frames is enough because the eye reads gait from the bob far more than
 * from the feet — and a two-frame walk is one you can actually keep in your
 * head when you change it later.
 *
 * WHAT HE WILL NOT DO:
 *
 *   - Walk under reduced motion. He fades in standing still.
 *   - Cover the bottom-right corner controls. He sits ABOVE the launcher lane.
 *   - Take pointer events anywhere except his own dismiss button — the whole
 *     figure is decoration except the one control that makes him go away.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import AceBody from "@/components/ace/AceBody";

/** How long the stride takes, and how fast the feet alternate inside it. */
const WALK_MS = 900;
const STEP_MS = 150;

export default function AceWalker({
    pose = "stand",
    size = "w-24 sm:w-28",
    /** Bumping this replays the walk-in — pass the page key. */
    trip = 0,
    children,
    className = "",
    onClick,
    label,
}) {
    const reduce = useReducedMotion();
    const [walking, setWalking] = useState(!reduce);
    const [step, setStep] = useState(0);
    const first = useRef(true);

    // Walk in on mount and on every change of `trip`.
    useEffect(() => {
        if (reduce) { setWalking(false); return; }
        // Skip the very first render's duplicate when trip starts at 0.
        if (first.current) first.current = false;
        setWalking(true);
        const done = setTimeout(() => setWalking(false), WALK_MS);
        return () => clearTimeout(done);
    }, [trip, reduce]);

    // The two-frame cycle, running only while he's actually moving.
    useEffect(() => {
        if (!walking || reduce) { setStep(0); return; }
        const t = setInterval(() => setStep((s) => (s > 0 ? -1 : 1)), STEP_MS);
        return () => clearInterval(t);
    }, [walking, reduce]);

    const Tag = onClick ? "button" : "div";

    return (
        <div className={`flex items-end gap-2 ${className}`} data-ace-walker={walking ? "walking" : "still"}>
            {/* The bubble is on his LEFT so it grows into the page rather than
                off the right edge, which is where he stands. */}
            {children}

            <motion.div
                initial={reduce ? false : { x: 120, opacity: 0 }}
                animate={{
                    x: 0,
                    opacity: 1,
                    // The bob rides the same beat as the feet, which is what
                    // actually sells the gait.
                    y: walking && !reduce ? (step > 0 ? -3 : 0) : 0,
                }}
                transition={{
                    x: { type: "spring", stiffness: 90, damping: 16 },
                    opacity: { duration: 0.25 },
                    y: { duration: STEP_MS / 1000, ease: "easeInOut" },
                }}
                className="flex-shrink-0 origin-bottom"
            >
                <Tag
                    onClick={onClick}
                    aria-label={onClick ? label : undefined}
                    className={onClick ? "block cursor-pointer" : "block"}
                >
                    <AceBody
                        className={size}
                        pose={walking && !reduce ? "walk" : pose}
                        step={step}
                        title={label}
                    />
                </Tag>
            </motion.div>
        </div>
    );
}

/**
 * The thing he says, as a bubble with a tail pointing at him.
 *
 * `block` on the tail spans matters and is not a style preference: a span is
 * inline by default, and an inline element with borders and no box doesn't
 * form a triangle at all — the tail simply isn't there.
 */
export function AceBubble({ children, className = "" }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 26, delay: 0.25 }}
            className={`relative rounded-2xl bg-surface border-2 border-border shadow-soft-lg p-4 ${className}`}
        >
            <span aria-hidden="true"
                className="block absolute right-0 bottom-6 translate-x-full
                    border-y-8 border-y-transparent border-l-8 border-l-border" />
            <span aria-hidden="true"
                className="block absolute right-0 bottom-6 translate-x-[calc(100%-2px)]
                    border-y-8 border-y-transparent border-l-8 border-l-surface" />
            {children}
        </motion.div>
    );
}

/**
 * ─── HE TALKED TOO FAST, AND THE BUBBLE EMPTIED BETWEEN BEATS ───────────────
 * Both the first run and the tour swapped their content inside an
 * `AnimatePresence mode="wait"` whose exit was a bare `opacity: 0`. `wait`
 * means exactly that: the OLD content animates out to nothing, and only then
 * does the new content start. So between two beats the bubble sat there empty
 * for a beat of its own — which reads as the bubble disappearing, because for
 * a moment it had. And nothing paced what arrived: a label, a headline, a
 * paragraph and a row of buttons all appeared on the same frame, which at the
 * speed the beats move is a wall of text that changed before it was read.
 *
 * `AceSay` replaces it. There is no exit at all — React swaps the children,
 * the bubble never empties — and the new beat reveals as LINES, in order, the
 * way somebody says them. `key` is the beat, so the reveal replays per beat
 * rather than once per mount.
 *
 * NOTHING HERE DISMISSES ITSELF. There is no timer, and that is deliberate
 * rather than an omission: he is answering a question the student has to act
 * on, and a bubble that times out is a question withdrawn before it was read.
 * The only way out is the close button, which is the student's.
 *
 * `STAGGER` is deliberately slow enough to read and short enough that four
 * lines are all on screen inside half a second — a typewriter would be worse,
 * because a character-by-character reveal of a paragraph on a phone is slower
 * than reading it and cannot be skipped.
 */
const STAGGER = 0.11;

const SAY = {
    hidden: {},
    shown: { transition: { staggerChildren: STAGGER, delayChildren: 0.06 } },
};
const LINE = {
    hidden: { opacity: 0, y: 6 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function AceSay({ beat, children, className = "" }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            key={beat}
            variants={SAY}
            /* REDUCED MOTION ARRIVES WHOLE rather than slowly: the point of the
               stagger is pacing, and somebody who has asked for less motion is
               not asking to be made to wait. */
            initial={reduce ? false : "hidden"}
            animate="shown"
            className={className}
        >
            {children}
        </motion.div>
    );
}

/** One line of what he is saying. Reveals in the order it is written. */
export function AceLine({ children, className = "" }) {
    return (
        <motion.div variants={LINE} className={className}>{children}</motion.div>
    );
}

export { AnimatePresence };
