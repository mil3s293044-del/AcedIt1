/**
 * PriceTick — the price, and the fact that it just moved.
 *
 * ─── THE FLOOR REFETCHES AND SAID NOTHING ───────────────────────────────────
 * `Competitions.jsx` already holds a `useLiveTick`, so a card whose room has
 * traded re-renders at the new price on its own. It just did it SILENTLY: 71¢
 * became 68¢ between two paints and nothing on screen said a person had done
 * that. The single most important fact a market board can carry — somebody
 * disagreed with you while you were reading — was being thrown away by a
 * component that already had it.
 *
 * So the number COUNTS to its new value and the delta ghosts off above it. The
 * motion is the information: a figure that slides has moved, a figure that
 * appears has always been there, and a student can tell those apart without
 * reading anything.
 *
 * ─── IT NEVER ANIMATES ON ARRIVAL ───────────────────────────────────────────
 * The first price a card ever shows has not moved — it is simply the price. A
 * mount that counts up from zero would tell every student that every market on
 * the board had just swung, on every page load, which is the boy-who-cried-wolf
 * version of this. `seen` starts UNSET and the first real value only fills it
 * in, so the first tick after mount is the first one that can animate.
 *
 * ─── AND IT IS THE PRICE, SO IT IS NEVER WRONG MID-FLIGHT ───────────────────
 * The printed figure is the TARGET from the moment the tick starts, not the
 * interpolated one. A card mid-animation still reads the true current price if
 * you screenshot it; only the ghost is transient. Animating the real number
 * would mean a student who taps during the count stakes against a figure the
 * card was still on its way to, which is the kind of disagreement `quizScore`
 * spent four fixes on.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/** How long the ghost hangs around. Long enough to read, short enough to miss. */
const GHOST_MS = 1600;

/**
 * Two sizes, because the price is the headline on a board card and a detail
 * inside the take-side sheet, and a figure that changes weight between them is
 * two different things saying one number.
 */
const SIZE = {
    md: "text-base",
    lg: "text-[26px]",
};

export default function PriceTick({ price, label, size = "md", className = "" }) {
    const reduce = useReducedMotion();
    const seen = useRef(null);
    const [move, setMove] = useState(null);

    useEffect(() => {
        const now = Number(price);
        if (!Number.isFinite(now)) return;
        const before = seen.current;
        seen.current = now;
        // First real value: record it and say nothing. See the header.
        if (before === null) return;
        const delta = Math.round((now - before) * 100);
        if (delta === 0) return;
        // Keyed on the arrival time so two moves in quick succession are two
        // ghosts rather than one that never re-enters — an AnimatePresence
        // child with a stable key is mounted once and then merely updated.
        setMove({ delta, at: Date.now() });
        const t = setTimeout(() => setMove(null), GHOST_MS);
        return () => clearTimeout(t);
    }, [price]);

    const up = move && move.delta > 0;

    return (
        <span className={`relative inline-flex flex-col items-end ${className}`}>
            {/* THE PRINTED FIGURE IS ALWAYS THE TRUE PRICE. Only its weight and
                colour move, so nothing a student could act on is ever mid-flight. */}
            <motion.span
                key={move?.at || "still"}
                initial={reduce || !move ? false : { scale: 1 }}
                animate={move && !reduce
                    ? { scale: [1, 1.14, 1], color: [null, up ? "var(--floor-yes-ink)" : "var(--floor-no-ink)", null] }
                    : {}}
                transition={{ duration: 0.5, times: [0, 0.3, 1], ease: "easeOut" }}
                className={`font-display font-black leading-none tabular-nums
                    text-[var(--floor-ink)] ${SIZE[size] || SIZE.md}`}
            >
                {label}
            </motion.span>

            <AnimatePresence>
                {move && !reduce && (
                    <motion.span
                        key={move.at}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: -13 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        // pointer-events-none and absolutely placed: a figure
                        // drifting upward must never take a tap meant for the
                        // card, and must never reflow the row it floats over.
                        className={`absolute right-0 top-0 pointer-events-none text-[11px] font-black tabular-nums
                            ${up ? "text-[var(--floor-yes-ink)]" : "text-[var(--floor-no-ink)]"}`}
                    >
                        {up ? "+" : "−"}{Math.abs(move.delta)}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}
