/**
 * LiveFigure — a board's number, which counts when it changes.
 *
 * Three cases, and they are deliberately different:
 *
 *   ARRIVING (`countIn`). The podium's figures count up from nothing as their
 *   cards turn over — the reveal is the answer to "who is on top", and the
 *   number arriving is part of it. Only the podium does this; thirty rows all
 *   counting from zero at once is a slot machine, not a board.
 *
 *   CHANGING, SAME QUANTITY. When a live refresh moves somebody's XP the figure
 *   counts from the old value to the new one, and an INCREASE flashes the
 *   brand green for a moment. A decrease is printed and left alone: a board
 *   that turns a number red because somebody else studied is editorialising.
 *
 *   CHANGING, NEW QUANTITY (`quantity`). Switching the board from XP to study
 *   time is not a change in anybody's figure — counting 38,800 down to "6h 20m"
 *   would be animating arithmetic that does not exist. It is simply printed.
 *
 * The last frame is always the exact value through the caller's formatter, and
 * an integer counts in integers (`countFrame`). Reduced motion prints it whole.
 */
import React, { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { countFrame, figureChange } from "@/lib/boardKit";

export default function LiveFigure({
    value, format = (v) => String(v), quantity = "", countIn = false, delay = 0,
    duration = 0.9, className = "", tone = "text-foreground", flashTone = "text-primary",
}) {
    const reduce = useReducedMotion();
    const target = Number(value);
    const ok = value != null && Number.isFinite(target);
    const start = ok && countIn && !reduce ? 0 : target;
    const [shown, setShown] = useState(start);
    const [flash, setFlash] = useState(false);
    // What is on screen right now (mid-count included), the quantity it is a
    // figure of, and whether the arrival count has finished.
    const live = useRef(start);
    const kind = useRef(quantity);
    const counting = useRef(ok && countIn && !reduce);

    useEffect(() => {
        if (!ok) return undefined;
        if (reduce || kind.current !== quantity) {
            kind.current = quantity;
            live.current = target;
            counting.current = false;
            setShown(target);
            return undefined;
        }
        const from = live.current;
        if (from === target) { setShown(target); return undefined; }
        const arriving = counting.current;
        const up = !arriving && figureChange(from, target) === "up";
        if (up) setFlash(true);
        const controls = animate(from, target, {
            duration,
            delay: arriving ? delay : 0,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (v) => { live.current = v; setShown(countFrame(v, target)); },
            onComplete: () => { live.current = target; counting.current = false; setShown(target); },
        });
        const t = up ? setTimeout(() => setFlash(false), 1400) : null;
        return () => { controls.stop(); if (t) clearTimeout(t); };
    }, [target, ok, quantity, reduce, delay, duration]);

    if (!ok) return <span className={`${className} ${tone}`}>{format(value)}</span>;
    return (
        <span className={`tabular-nums transition-colors duration-700 ${className} ${flash ? flashTone : tone}`}>
            {format(shown === target ? target : shown)}
        </span>
    );
}
