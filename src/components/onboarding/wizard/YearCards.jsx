/**
 * YearCards — the first question, dealt instead of listed.
 *
 * This is the first screen after the landing page, and the landing page ends
 * with several hundred cards forming a brain. What used to be here was six
 * grey tiles with the same graduation-cap icon repeated six times, which is a
 * settings panel wearing the clothes of a welcome.
 *
 * THE RANKS DO WORK. Years seven through ten are number cards; year eleven is
 * a jack and year twelve is a queen. It is the correct shape for the fact
 * being asked about, seniority, and it means the answer to the very first
 * question already teaches the reader how to read the rest of the app, where
 * a rank always means "how far up this is".
 *
 * It stops short of giving year twelve the Ace. The Ace is the target on the
 * next screen but one, and it is the mastery ceiling in the review deck. Handing
 * it out for ticking a box would spend the only card the product has left to
 * give.
 *
 * THE DEAL IS STAGGERED AND SHORT. Six cards at 55ms apart is over in a third
 * of a second, which is under the threshold where a person waiting to click
 * something starts to resent the animation. The deal exists to say "this is a
 * table"; it is not a performance and it is not allowed to be in the way. The
 * cards are clickable from the first frame, because they are laid out by the
 * grid and only transformed by the animation.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import PlayingCard from "@/components/cards/PlayingCard";

export const YEAR_CARDS = [
    { value: "Year 7",            rank: "7",  suit: "club",    label: "Year 7",  sub: "Junior secondary" },
    { value: "Year 8",            rank: "8",  suit: "diamond", label: "Year 8",  sub: "Junior secondary" },
    { value: "Year 9",            rank: "9",  suit: "heart",   label: "Year 9",  sub: "Junior secondary" },
    { value: "Year 10",           rank: "10", suit: "club",    label: "Year 10", sub: "Senior foundation" },
    { value: "Year 11 Units 1&2", rank: "J",  suit: "diamond", label: "Year 11", sub: "VCE Units 1 & 2" },
    { value: "Year 12 Units 3&4", rank: "Q",  suit: "spade",   label: "Year 12", sub: "Units 3 & 4, counts toward your ATAR" },
];

export default function YearCards({ value, onPick }) {
    const reduce = useReducedMotion();

    return (
        // Capped width, because the card ratio is driven off the column and a
        // three-column grid in a 42rem shell gives 13rem cards: a playing card
        // the size of a paperback, mostly empty in the middle. The cap keeps
        // them at about the size of the real thing.
        <div data-year-cards
            className="grid grid-cols-3 gap-2.5 sm:gap-4 max-w-[30rem] mx-auto">
            {YEAR_CARDS.map((y, i) => {
                const on = value === y.value;
                return (
                    <motion.div
                        key={y.value}
                        initial={reduce
                            ? { opacity: 0 }
                            : { opacity: 0, y: -70, x: 24, rotate: -9, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
                        transition={reduce
                            ? { duration: 0.2 }
                            : { type: "spring", stiffness: 240, damping: 22, delay: i * 0.055 }}
                    >
                        {/* The button is the whole card and carries the press.
                            Hover lift lives on a transform so nothing reflows,
                            and the aspect comes off the card ratio rather than
                            a fixed height, so a phone gets a smaller card and
                            not a squashed one. */}
                        <button
                            type="button"
                            data-year={y.value}
                            aria-pressed={on}
                            onClick={() => onPick(y.value)}
                            className="group w-full text-left transition-transform duration-200
                                hover:-translate-y-1.5 focus-visible:-translate-y-1.5
                                focus-visible:outline-none active:translate-y-0"
                        >
                            <PlayingCard
                                rank={y.rank}
                                suit={y.suit}
                                smallIndices
                                // The watermark sits behind the year, and at
                                // 3.5% on cream it reads as a smudge on the
                                // print rather than as a suit mark.
                                watermark={false}
                                tone={on ? "#58CC02" : undefined}
                                className={`w-full aspect-[2.5/3.5] transition-shadow ${
                                    on
                                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                        : "group-hover:shadow-[0_2px_4px_rgba(13,22,38,0.12),0_26px_44px_-20px_rgba(13,22,38,0.5)]"
                                }`}
                            >
                                <span className="absolute inset-0 flex flex-col items-center
                                    justify-center px-2 pt-4 text-center">
                                    <span className={`font-display font-extrabold leading-none
                                        text-lg sm:text-2xl ${on ? "text-primary" : "text-foreground"}`}>
                                        {y.label}
                                    </span>
                                    <span className="mt-1.5 text-[9px] sm:text-[10px] leading-tight
                                        text-muted-foreground font-semibold">
                                        {y.sub}
                                    </span>
                                </span>
                            </PlayingCard>
                        </button>
                    </motion.div>
                );
            })}
        </div>
    );
}
