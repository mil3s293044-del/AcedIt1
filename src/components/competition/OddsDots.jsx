/**
 * OddsDots — a probability you can count.
 *
 * ─── Why ten dots rather than a number ──────────────────────────────────────
 * "65%" is the most abstract thing on this page, and a student mid-decision
 * does not convert it to anything. Ten dots with seven filled is a COUNT, and
 * a count is a thing you can hold: "seven times out of ten". Nothing is lost —
 * the percentage is still printed beside it — but the dots are what makes the
 * dial feel like a claim rather than a slider.
 *
 * Rounded to the nearest dot deliberately. A probability of 0.68 is not more
 * knowable than "about seven in ten", and pretending otherwise on a base rate
 * built from a dozen observations would be precision the data does not have.
 *
 * ─── The house's dots are drawn too ─────────────────────────────────────────
 * When `base` is given, the dots the base rate would fill are ringed. That is
 * the whole disagreement, made visible: the dots you are adding or taking away
 * from what the app expected are exactly what you are being scored on.
 */
import React from "react";
import { motion } from "framer-motion";

const DOTS = 10;

export default function OddsDots({
    value, base, tone = "hsl(var(--primary))", size = "md", animate = true,
}) {
    const filled = Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * DOTS);
    const houseFilled = base == null
        ? null
        : Math.round(Math.min(1, Math.max(0, Number(base))) * DOTS);

    const dot = size === "sm" ? "w-1.5 h-1.5" : "w-2.5 h-2.5";
    const gap = size === "sm" ? "gap-1" : "gap-1.5";

    return (
        <div className={`flex items-center ${gap}`} aria-hidden="true">
            {Array.from({ length: DOTS }).map((_, i) => {
                const on = i < filled;
                const houseOn = houseFilled != null && i < houseFilled;
                return (
                    <motion.span
                        key={i}
                        className={`${dot} rounded-full flex-shrink-0`}
                        style={{
                            background: on ? tone : "hsl(var(--border))",
                            // A dot the house would have filled but you have not
                            // (or the reverse) is ringed, so the gap between your
                            // call and the base rate is countable too.
                            boxShadow: houseOn !== on ? `0 0 0 2px ${tone}55` : undefined,
                        }}
                        initial={false}
                        animate={{ scale: on ? 1 : 0.7, opacity: on ? 1 : 0.6 }}
                        transition={animate
                            // Staggered by index so filling reads left to right
                            // as a count rather than a block changing colour.
                            ? { duration: 0.18, delay: on ? i * 0.015 : 0 }
                            : { duration: 0 }}
                    />
                );
            })}
        </div>
    );
}

/** The sentence version, for where a row of dots would be too much furniture. */
export function oddsPhrase(p) {
    const n = Math.round(Math.min(1, Math.max(0, Number(p) || 0)) * DOTS);
    if (n === DOTS) return "every time";
    if (n === 0) return "never";
    return `${n} time${n === 1 ? "" : "s"} in ${DOTS}`;
}
