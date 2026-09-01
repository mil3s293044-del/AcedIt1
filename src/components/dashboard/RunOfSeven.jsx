/**
 * RunOfSeven — the last seven days, as seven cards.
 *
 * What it replaces was seven rounded squares: filled with a flame if you
 * studied, a dashed outline for today, a pale tint for a miss. It read fine
 * and it read as a habit-tracker widget, which is what every app with a streak
 * ships. It was also the one place on the page where the week — the thing the
 * whole streak is made of — got shown, and it was 28px tall.
 *
 * A RUN IS A CARD IDEA. Seven consecutive cards is a straight, and a straight
 * with a gap in it is nothing — which is exactly, and unforgivingly, what a
 * streak is. So a day you showed up is a card turned face-up, a day you missed
 * is a card face-down, and today is the card still to be played: outlined,
 * empty, waiting. Nobody needs that explained.
 *
 * The turn is staggered left to right, so the week deals itself out the way it
 * happened. Under reduced motion the cards are simply in their final state.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SuitPip } from "@/components/cards/PlayingCard";

/** The suits cycle so the run reads as seven different cards, not seven copies. */
const SUITS = ["spade", "heart", "club", "diamond", "spade", "heart", "club"];

/**
 * The streak red, at an alpha.
 *
 * `tone` used to default to the literal #FF4B4B and the alphas were appended
 * as hex pairs (`${tone}66`). That is the same colour as --streak written a
 * second time, in a form the theme cannot reach: the day the streak red is
 * retuned, or a theme wants a different one, this panel keeps the old value
 * and nothing tells you. Callers can still pass a hex `tone` for a one-off,
 * and the default now comes from the token.
 */
const streak = (alpha) => `hsl(var(--streak) / ${alpha})`;

export default function RunOfSeven({ days = [], tone = null }) {
    const reduce = useReducedMotion();
    const at = (alpha, hexPair) => (tone ? `${tone}${hexPair}` : streak(alpha));

    return (
        <div data-run-of-seven className="flex items-end gap-1.5 mt-4"
            style={{ perspective: 700 }}>
            {days.map((d, i) => {
                const state = d.studied ? "up" : d.isToday ? "open" : "down";
                return (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <motion.div
                            data-run-day={i}
                            data-run-state={state}
                            className="relative w-7 h-[38px] rounded-[5px] overflow-hidden"
                            style={{
                                transformStyle: "preserve-3d",
                                background: state === "up" ? "hsl(var(--surface))" : "transparent",
                                border: state === "open"
                                    ? `1.5px dashed ${at(0.4, "66")}`
                                    : state === "up"
                                        ? `1px solid ${at(0.35, "59")}`
                                        : `1px solid ${at(0.15, "26")}`,
                                // A face-down day is the deck's own hatch, at
                                // the weight of a card lying in shadow.
                                backgroundImage: state === "down"
                                    ? `repeating-linear-gradient(45deg, ${at(0.125, "20")} 0 2px, transparent 2px 4px)`
                                    : undefined,
                            }}
                            initial={reduce ? false : { rotateY: state === "up" ? 180 : 0, opacity: 0 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            transition={reduce ? { duration: 0.2 } : {
                                type: "spring", stiffness: 200, damping: 20, delay: 0.25 + i * 0.06,
                            }}
                        >
                            {state === "up" && (
                                <span className="absolute inset-0 grid place-items-center">
                                    <SuitPip suit={SUITS[i % 7]} className="w-3 h-3" />
                                </span>
                            )}
                        </motion.div>
                        <span className={`text-[10px] font-bold ${
                            d.isToday ? "text-streak" : "text-muted-foreground/50"}`}>
                            {d.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
