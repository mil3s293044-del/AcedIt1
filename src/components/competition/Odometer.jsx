/**
 * Odometer — a number that rolls to its new value instead of jumping.
 *
 * ─── Why this is worth a component ──────────────────────────────────────────
 * On the forecast dial, the payout numbers are the feedback: they are how a
 * student learns what disagreeing with the house costs. Swapped instantly they
 * read as two unrelated states, and the trade-off has to be reconstructed by
 * comparing remembered numbers. Rolled, the change IS the information — you
 * can see the upside shrinking as the downside grows without reading either.
 *
 * ─── It is a spring on a value, not a tween on text ─────────────────────────
 * The obvious implementation animates a string, which cannot work: there is
 * nothing to interpolate between "-5" and "+14". This holds a motion value,
 * springs it, and formats on every frame. `useMotionValue` + `useSpring` also
 * means a change mid-flight retargets rather than restarting, which is what
 * keeps a fast drag smooth instead of stuttering — the same lesson MovePreview
 * records about re-entering an animation with velocity still on it.
 *
 * Respects reduced motion by snapping, because a number that rolls is
 * precisely the kind of motion that does not survive a vestibular disorder.
 */
import React, { useEffect, useState } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "framer-motion";

export default function Odometer({ value, format, className = "", ...rest }) {
    const reduce = useReducedMotion();
    const target = Number(value) || 0;
    const mv = useMotionValue(target);
    const spring = useSpring(mv, { stiffness: 220, damping: 28, mass: 0.6 });
    const [shown, setShown] = useState(target);

    useEffect(() => { mv.set(target); }, [target, mv]);

    useEffect(() => {
        if (reduce) { setShown(target); return undefined; }
        return spring.on("change", (v) => setShown(v));
    }, [spring, reduce, target]);

    const n = Math.round(reduce ? target : shown);
    return (
        <span className={`tabular-nums ${className}`} {...rest}>
            {format ? format(n) : n}
        </span>
    );
}
