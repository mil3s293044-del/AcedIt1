/**
 * AtarCut — the target, cut off the top of the deck.
 *
 * The old screen printed the number at 7rem over a slider, which was already
 * the strongest thing in the wizard and is most of why this one keeps the same
 * shape. What it did not do was give the number any meaning. A student drags
 * to 96, reads "96", and learns nothing they did not know before they dragged.
 *
 * So the number is printed on a card that is cut off a deck, and under it sits
 * the band that number falls in, from atarBands — which is the app's own
 * ladder, the same label the dashboard prints next to their score once they
 * are inside. Setting a target here and meeting the same words on the
 * dashboard later is the whole point: it makes the target a thing in the
 * product rather than a number in a form.
 *
 * WHY IT IS AN ACE. Every other card in the hand is what it is: the year is
 * ranked by year, subjects are twos because nothing has been studied. The
 * target is the only Ace anyone gets before they have earned one, and it is
 * face up in front of them for the rest of the flow. That is the argument the
 * screen is making, and it is made by the object rather than by a sentence
 * underneath it.
 *
 * THE BAND SWAPS, THE CARD DOES NOT. Dragging the slider changes the number
 * every frame, so the card itself must be completely still or the screen
 * becomes a strobe. Only the band label animates, and only when it actually
 * changes, keyed on the band name so a drag from 90 to 94 does nothing at all.
 */
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import { atarBandOf } from "@/lib/atarBands";

const GOLD = "#F0B429";

/** 96 → "96", 96.35 → "96.35". Trailing zeroes on an ATAR read as a typo. */
export function formatAtar(n) {
    return Number(n).toFixed(Number(n) % 1 === 0 ? 0 : 2);
}

export default function AtarCut({ value, onChange }) {
    const reduce = useReducedMotion();
    const band = atarBandOf(value);

    return (
        <div data-atar-cut className="flex flex-col items-center">
            {/* The cut. Two backs squared underneath, the Ace lifted off the
                top of them and rotated a couple of degrees, so the card reads
                as having come from somewhere rather than as a panel that was
                always there. The backs are absolute and behind; the Ace is in
                flow and sets the height, which keeps the whole block from
                collapsing to zero on a browser that skips the animation. */}
            <div className="relative w-[13rem] sm:w-[15rem]">
                <CardBack tone={GOLD} aria-hidden="true"
                    className="absolute inset-0 w-full h-full -rotate-[7deg] translate-y-2 opacity-70" />
                <CardBack tone={GOLD} aria-hidden="true"
                    className="absolute inset-0 w-full h-full -rotate-[3.5deg] translate-y-1 opacity-85" />

                <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, rotate: -8, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, rotate: 1.6, scale: 1 }}
                    transition={reduce
                        ? { duration: 0.25 }
                        : { type: "spring", stiffness: 210, damping: 21 }}
                >
                    <PlayingCard rank="A" suit="spade" tone={GOLD} watermark={false}
                        className="w-full aspect-[2.5/3.5]">
                        <span className="absolute inset-0 flex flex-col items-center justify-center px-3">
                            <span className="stat-label text-muted-foreground mb-1">My target</span>
                            <span
                                className="font-display font-extrabold text-foreground leading-none
                                    tabular-nums tracking-tight"
                                style={{ fontSize: "clamp(2.6rem, 11vw, 4rem)" }}
                            >
                                {formatAtar(value)}
                            </span>

                            {/* Fixed-height slot. If the label sized the row,
                                a band name that wraps would nudge the number
                                mid-drag and the card would breathe. */}
                            <span className="relative block h-6 mt-2.5 w-full text-center">
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.span
                                        key={band}
                                        className="absolute inset-0 flex items-center justify-center"
                                        initial={reduce ? false : { opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5 }}
                                        transition={{ duration: 0.18 }}
                                    >
                                        <span className="pill text-[10px] px-2.5 py-0.5"
                                            style={{ backgroundColor: "rgba(240,180,41,0.16)", color: "#8A5B00" }}>
                                            {band}
                                        </span>
                                    </motion.span>
                                </AnimatePresence>
                            </span>
                        </span>
                    </PlayingCard>
                </motion.div>
            </div>

            <div className="w-full max-w-sm mt-7">
                <input
                    type="range"
                    aria-label="Target ATAR"
                    min={50}
                    max={99.95}
                    step={0.05}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-semibold mt-2">
                    <span>50</span>
                    <span>75</span>
                    <span>99.95</span>
                </div>
            </div>

            <p className="text-xs text-muted-foreground mt-5 text-center max-w-xs leading-relaxed">
                A target is a direction, not a promise. You can move it whenever you want,
                and nothing in AcedIt is locked behind it.
            </p>
        </div>
    );
}
