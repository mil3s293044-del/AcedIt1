/**
 * LiveDot — the "something is happening" mark on a nav item.
 *
 * ─── What it has to earn ────────────────────────────────────────────────────
 * A permanent badge is wallpaper. This appears ONLY while a contest is
 * actually running, so its presence is the information — a student who glances
 * at the rail and sees nothing knows there is nothing to look at, which is a
 * useful thing to be told and only stays useful if the dot is honest.
 *
 * It PULSES rather than sits, because the thing it marks is a clock running
 * down. A static dot says "there is something here"; a pulsing one says "it is
 * moving without you", and the second is the sentence that gets clicked.
 *
 * ─── Two rings, not one ─────────────────────────────────────────────────────
 * A solid core with a ring expanding out of it and fading. One element
 * scaling and fading reads as a rendering glitch at this size; the core
 * staying put is what makes the ring read as emitted from it.
 *
 * The count is drawn only when there is more than one, because "1" beside a
 * dot is the dot restated — the same rule the icon guidance keeps about a
 * glyph that says what the word next to it already says.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function LiveDot({ count = 0, className = "" }) {
    const reduce = useReducedMotion();
    const many = count > 1;

    return (
        <span className={`absolute -top-1 -right-1 flex items-center justify-center ${className}`}
            aria-label={count > 0 ? `${count} live` : "live"}>
            {!reduce && (
                <motion.span
                    aria-hidden="true"
                    className="absolute rounded-full bg-streak"
                    style={{ width: many ? 16 : 8, height: many ? 16 : 8 }}
                    animate={{ scale: [1, 2.1, 2.1], opacity: [0.55, 0, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", times: [0, 0.6, 1] }}
                />
            )}
            <span className={`relative rounded-full bg-streak ring-2 ring-background
                ${many ? "min-w-[16px] h-4 px-1 flex items-center justify-center" : "w-2 h-2"}`}>
                {many && (
                    <span className="text-[10px] font-black text-white leading-none tabular-nums">
                        {count > 9 ? "9+" : count}
                    </span>
                )}
            </span>
        </span>
    );
}
