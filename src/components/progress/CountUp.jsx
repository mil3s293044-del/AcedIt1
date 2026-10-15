/**
 * CountUp — a report figure that arrives by counting.
 *
 * THIS IS A REVEAL, NOT A LIVE NUMBER. `LiveNumber` refuses to animate on
 * arrival, and it is right to: a price that counts up on every page load
 * announces a move nobody made. A report is the other case — the student just
 * asked "how did my week go" by opening a tab, and the figure counting to its
 * value is the answer arriving. It counts from zero on mount and from the old
 * value when the period or the subject changes it.
 *
 * The FINAL frame is always the exact value through the caller's own
 * formatter, so "2h 45m" never settles on a figure a rounding step produced.
 * Reduced motion skips the count and prints the value.
 */
import React, { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

const plain = (n) => Math.round(n).toLocaleString();

export default function CountUp({ value, format = plain, duration = 0.9, className = "" }) {
    const reduce = useReducedMotion();
    const target = Number(value);
    const ok = Number.isFinite(target);
    const [shown, setShown] = useState(reduce || !ok ? target : 0);
    const from = useRef(0);

    useEffect(() => {
        if (!ok) return undefined;
        if (reduce) { setShown(target); from.current = target; return undefined; }
        const controls = animate(from.current, target, {
            duration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (v) => setShown(v),
            onComplete: () => setShown(target),
        });
        from.current = target;
        return () => controls.stop();
    }, [target, ok, reduce, duration]);

    if (!ok) return null;
    return <span className={`tabular-nums ${className}`}>{format(shown === target ? target : shown)}</span>;
}
