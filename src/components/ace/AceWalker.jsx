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
 * AND HE DOES NOT FREEZE WHEN HE ARRIVES. `pose` may be a SEQUENCE: he plays
 * it in order once the stride has landed and holds the last one. That last
 * entry is the one that matters — end on a resting pose (`stand`, `happy`,
 * `peek`, `offer`) and AceBody's own fidget system takes over, so a beat the
 * student reads for a minute has a character standing in it rather than a
 * drawing. End on a gesture and he holds the gesture, which is occasionally
 * what you want and never what a long beat wants.
 *
 * That is the AceDeal lesson stated the other way round: the switches that
 * turn his own motion off are the bug. Holding `point` is one of them —
 * RESTING does not contain it, so a held point is a still frame.
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
/**
 * How long one gesture in a sequence holds before the next.
 *
 * Long enough to read as a movement rather than a flicker — AceDeal's own
 * recovery beat is the same length, for the same reason.
 */
const GESTURE_MS = 1200;

export default function AceWalker({
    /** A pose, or a sequence played on arrival whose LAST entry is held. */
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
    const [phase, setPhase] = useState(0);
    const first = useRef(true);

    // A string is a sequence of one, so every caller takes the same path.
    const seq = Array.isArray(pose) ? pose.filter(Boolean) : [pose];
    const last = Math.max(0, seq.length - 1);
    // Keyed on the CONTENT, not the array: a literal prop is a new array on
    // every render, and depending on its identity would restart the sequence
    // forever.
    const seqKey = seq.join("|");

    // Walk in on mount and on every change of `trip`.
    useEffect(() => {
        if (reduce) { setWalking(false); return; }
        // Skip the very first render's duplicate when trip starts at 0.
        if (first.current) first.current = false;
        setWalking(true);
        const done = setTimeout(() => setWalking(false), WALK_MS);
        return () => clearTimeout(done);
    }, [trip, reduce]);

    // A new beat, or new copy, restarts the sequence from its first gesture.
    useEffect(() => { setPhase(0); }, [trip, seqKey]);

    // Advance only once he has ARRIVED: the stride overrides the pose, so a
    // gesture played during it is one nobody sees. Under reduced motion he
    // goes straight to the pose he settles on.
    useEffect(() => {
        if (reduce) { setPhase(last); return; }
        if (walking || phase >= last) return;
        const t = setTimeout(() => setPhase((p) => p + 1), GESTURE_MS);
        return () => clearTimeout(t);
    }, [walking, phase, last, reduce]);

    // The two-frame cycle, running only while he's actually moving.
    useEffect(() => {
        if (!walking || reduce) { setStep(0); return; }
        const t = setInterval(() => setStep((s) => (s > 0 ? -1 : 1)), STEP_MS);
        return () => clearInterval(t);
    }, [walking, reduce]);

    const Tag = onClick ? "button" : "div";
    const held = seq[Math.min(phase, last)] || "stand";

    return (
        <div className={`flex items-end gap-2 ${className}`}
            data-ace-walker={walking ? "walking" : "still"} data-ace-pose={held}>
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
                        pose={walking && !reduce ? "walk" : held}
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

export { AnimatePresence };
