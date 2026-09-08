/**
 * LiveNumber — a figure that MOVES to its new value and says how far it came.
 *
 * ─── Why a swap is not enough ───────────────────────────────────────────────
 * A number that changes from 400 to 445 between two renders is, to the person
 * watching, a number that has always said 445. There is nothing to notice. The
 * whole reason a live leaderboard feels different from a static one is that
 * you can see the change happen — so the value rolls, and the amount it rolled
 * by floats off beside it and fades.
 *
 * The roll is the reading; the chip is the receipt.
 *
 * ─── The first render never animates ────────────────────────────────────────
 * Opening the page must not flash "+400" at somebody for XP they earned last
 * Tuesday. The initial value is adopted silently, and only changes AFTER that
 * are events. A screen that animates everything on arrival teaches people to
 * ignore the animation that matters, which costs the feature its entire point.
 *
 * ─── And it never lies about direction ──────────────────────────────────────
 * The chip's sign, its colour and its arrow all come off the same subtraction,
 * so they cannot disagree — the bug `ScalingMark` exists to prevent on Browse
 * and the one the compete feed's sliding price hit.
 */
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

const DEFAULT_FORMAT = (n) => n.toLocaleString();

export default function LiveNumber({
    value,
    format = DEFAULT_FORMAT,
    className = "",
    chipClassName = "",
    showDelta = true,
    /** Below this, a change is not worth drawing attention to. */
    minDelta = 1,
    springConfig = { stiffness: 90, damping: 20 },
}) {
    const reduce = useReducedMotion();
    const target = Number.isFinite(Number(value)) ? Number(value) : 0;

    const mv = useMotionValue(target);
    const spring = useSpring(mv, springConfig);
    const [shown, setShown] = useState(target);
    const [delta, setDelta] = useState(null);

    // `null` until the first real value has been adopted. A ref rather than
    // state so adopting it cannot itself cause a render.
    const seeded = useRef(false);
    const prev = useRef(target);

    useEffect(() => {
        if (!seeded.current) {
            seeded.current = true;
            prev.current = target;
            mv.set(target);
            setShown(target);
            return;
        }
        const d = target - prev.current;
        prev.current = target;

        if (reduce) {
            mv.set(target);
            setShown(target);
        } else {
            mv.set(target);
        }

        if (showDelta && Math.abs(d) >= minDelta) {
            setDelta({ d, id: Date.now() });
        }
    }, [target, mv, reduce, showDelta, minDelta]);

    useEffect(() => spring.on("change", (v) => setShown(Math.round(v))), [spring]);

    // The chip clears itself. Keyed on its own id so a second change while one
    // is still on screen replaces it rather than queueing — a stack of floating
    // numbers is noise, and only the latest one is true.
    useEffect(() => {
        if (!delta) return undefined;
        const t = setTimeout(() => setDelta(null), 1600);
        return () => clearTimeout(t);
    }, [delta]);

    const up = (delta?.d ?? 0) > 0;

    return (
        <span className={`relative inline-flex items-baseline ${className}`}>
            <span className="tabular-nums">{format(reduce ? target : shown)}</span>
            <AnimatePresence>
                {delta && !reduce && (
                    <motion.span
                        key={delta.id}
                        initial={{ opacity: 0, y: 4, scale: 0.85 }}
                        animate={{ opacity: 1, y: -14, scale: 1 }}
                        exit={{ opacity: 0, y: -22 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={`absolute left-full ml-1 top-0 whitespace-nowrap pointer-events-none
                            font-display font-black text-xs tabular-nums
                            ${up ? "text-primary" : "text-streak"} ${chipClassName}`}
                    >
                        {up ? "+" : "−"}{Math.abs(delta.d).toLocaleString()}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}

/**
 * A row that flashes when it moves — the other half of a live leaderboard.
 *
 * Overtaking is the most dramatic thing a leaderboard does and it used to be
 * a silent redraw: the rows were in a different order the next time you
 * looked, with nothing to say it had happened. framer's `layout` does the
 * physical swap; this adds the flash so the pair that swapped is the pair you
 * look at.
 *
 * The flash is a background wash rather than a border or a scale, because the
 * rows are already moving — a row that also grows reads as a rendering
 * glitch, and a border change on a moving element is invisible.
 */
export function MoveFlash({ active, tone = "primary", children, className = "" }) {
    const reduce = useReducedMotion();
    const wash = tone === "streak" ? "rgba(255,75,75,0.16)" : "rgba(88,204,2,0.16)";

    return (
        <motion.div
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            animate={reduce || !active
                ? { backgroundColor: "rgba(0,0,0,0)" }
                : { backgroundColor: ["rgba(0,0,0,0)", wash, "rgba(0,0,0,0)"] }}
            // Slow enough to be noticed on a row that is also sliding, short
            // enough that it is over before the eye moves on.
            transitionEnd={{ backgroundColor: "rgba(0,0,0,0)" }}
            className={`rounded-2xl ${className}`}
            style={{ willChange: "transform" }}
        >
            {children}
        </motion.div>
    );
}
