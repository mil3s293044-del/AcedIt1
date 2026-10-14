/**
 * YearCards — the first question, dealt instead of listed.
 *
 * THE RANKS DO WORK. Years seven to ten are number cards, eleven a jack and
 * twelve a queen: seniority, read off the rank, so the very first answer
 * teaches how the rest of the app reads a card. The table they come from is
 * `YEARS` in onboardingFlow.js — the hand used to keep its own copy of it.
 *
 * THE NAME SITS ON A BAND, NOT OVER THE PIPS. The year used to be printed in
 * the middle of the card on top of the pip field and the court figure, so
 * "Year 10" read through ten ghosted clubs. The pips go to the top two thirds
 * (`compact`) and the name takes the bottom edge, which is how the hand prints
 * a subject and so how every card in this flow prints its name.
 *
 * A CARD LEANS TOWARD THE POINTER. It is the cheapest thing that makes a grid
 * of six read as six objects on a table rather than six tiles in a form, and
 * it is the hover a real card has when a finger is about to pick it up. The
 * tilt is on an inner element so the button's own box never moves under the
 * pointer — the hover-on-a-rotating-element trap MovePreview records.
 *
 * CARD STOCK IS WHITE IN BOTH THEMES, here as on the table. A card picked in
 * the dark used to be a dark card that left the page and landed white on the
 * felt — the one thing a flight must never do is change what it is carrying.
 *
 * `onPick(value, el)` hands back the card's element so the page can fly it to
 * the table.
 */
import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import PlayingCard from "@/components/cards/PlayingCard";
import { YEARS } from "@/lib/onboardingFlow";

function TiltCard({ y, on, onPick, i, reduce }) {
    const ref = useRef(null);
    const rx = useMotionValue(0);
    const ry = useMotionValue(0);
    const sx = useSpring(rx, { stiffness: 220, damping: 18 });
    const sy = useSpring(ry, { stiffness: 220, damping: 18 });

    const onMove = (e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * 16);
        rx.set(-py * 14);
    };
    const onLeave = () => { rx.set(0); ry.set(0); };

    return (
        <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -60, x: 30, rotate: -10, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 230, damping: 21, delay: 0.12 + i * 0.06 }}
            style={{ perspective: 800 }}
        >
            <button
                ref={ref}
                type="button"
                data-year={y.value}
                aria-pressed={on}
                aria-label={`${y.label}, ${y.sub}`}
                onClick={() => onPick(y.value, ref.current)}
                onPointerMove={onMove}
                onPointerLeave={onLeave}
                className="group relative block w-full text-left focus-visible:outline-none"
            >
                <motion.div
                    style={{ rotateX: sx, rotateY: sy, transformStyle: "preserve-3d" }}
                    whileHover={reduce ? undefined : { y: -6 }}
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                    animate={on && !reduce ? { y: -8, scale: 1.03 } : { y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className={`rounded-[0.95rem] transition-shadow duration-300 ${on
                        ? "shadow-[0_0_0_3px_hsl(var(--primary)),0_22px_40px_-16px_hsl(var(--primary)/0.55)]"
                        : "shadow-[0_2px_4px_rgba(13,22,38,0.08),0_18px_34px_-22px_rgba(13,22,38,0.45)] group-hover:shadow-[0_2px_4px_rgba(13,22,38,0.1),0_28px_46px_-20px_rgba(13,22,38,0.5)] group-focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.5)]"}`}
                >
                    <PlayingCard rank={y.rank} suit={y.suit} smallIndices pips="compact"
                        tone={on ? "#58CC02" : y.tone} className="theme-locked-light w-full aspect-[2.5/3.5]">
                        <span className="absolute inset-x-0 bottom-0 px-2 pt-2 pb-2.5 text-center
                            bg-gradient-to-t from-surface via-surface to-surface/0"
                            style={{ paddingRight: "var(--card-index-w)", paddingLeft: "var(--card-index-w)" }}>
                            <span className={`block font-display font-extrabold leading-none text-[15px] sm:text-xl
                                ${on ? "text-primary" : "text-foreground"}`}>
                                {y.label}
                            </span>
                            <span className="block mt-1 text-[9px] sm:text-[10px] leading-tight text-muted-foreground font-semibold">
                                {y.sub}
                            </span>
                        </span>
                    </PlayingCard>
                    {on && (
                        <motion.span
                            initial={reduce ? false : { scale: 0, rotate: -40 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 420, damping: 18 }}
                            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground
                                flex items-center justify-center shadow-md">
                            <Check className="w-4 h-4" strokeWidth={3.5} />
                        </motion.span>
                    )}
                </motion.div>
            </button>
        </motion.div>
    );
}

export default function YearCards({ value, onPick }) {
    const reduce = useReducedMotion();
    return (
        <div data-year-cards className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[30rem]">
            {YEARS.map((y, i) => (
                <TiltCard key={y.value} y={y} i={i} on={value === y.value} onPick={onPick} reduce={reduce} />
            ))}
        </div>
    );
}
