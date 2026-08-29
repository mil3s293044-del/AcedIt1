/**
 * CardPack — a pack of cards in a list: backs behind, one face on top.
 *
 * Lifted out of DeckStack when the quiz list needed the same object. Two
 * near-identical two-hundred-line components, one for flashcard decks and one
 * for quizzes, is the copy that rots: the fan gets tuned on one of them and
 * the app quietly ends up with two different packs.
 *
 * So everything about being a PACK lives here — the backs, the depth, the fan
 * on hover, the deal-in stagger, the actions that live outside the card — and
 * the caller supplies only what is printed on the face.
 *
 * THE STACK IS THE COUNT. A forty-question quiz is visibly fatter than a six
 * before you read a number, the same way a 142-card deck is. It is the one
 * piece of information you get for free from drawing the thing as what it is.
 */
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";

/**
 * How many card edges show behind the top one. Not linear with the count — the
 * difference between 12 and 30 is worth seeing, the difference between 200 and
 * 240 is not, and a stack that keeps growing eats the row.
 */
export function depthFor(total) {
    if (total >= 90) return 4;
    if (total >= 40) return 3;
    if (total >= 12) return 2;
    return total > 1 ? 1 : 0;
}

/** Each edge sits this far down and right of the one above it. */
export const STEP = 3.5;
/** Reserved so a fanned stack can't overlap its neighbour in the row. */
export const PAD = 4 * STEP * 1.9 + 4;

const SPRING = { type: "spring", stiffness: 320, damping: 24 };

/**
 * The shared card footprint, so a row of packs lines up whatever is on them.
 *
 * ONE PER ROW ON A PHONE IS CORRECT, and this was narrowed to 140 once to try
 * to fit two. It did not fit two — 2 x (140 + the fan gutter) plus the page's
 * own padding is still wider than 390 — and the face paid for it anyway:
 * titles clipped mid-word and the footer wrapped "18 q - 2 tries" onto two
 * lines. A card has a fixed aspect ratio and a face with real text on it;
 * below about 150 it stops being readable. Two-up arrives at the sm
 * breakpoint, where there is room for it.
 */
export const PACK_W = "w-[158px] sm:w-[176px]";

export default function CardPack({
    /** Corner marks — rank and suit mean the same thing on every card in the app. */
    rank, suit, mastery, tone,
    /** Drives how thick the pack looks. */
    total = 0,
    /** Face content, laid out by the caller inside the card. */
    children,
    /** Small buttons that sit above the card, outside its own button. */
    actions,
    onSelect,
    label,
    /**
     * What a screen reader should hear. Without it the accessible name is
     * whatever the face happens to print, which on a card reads out as "King,
     * hearts, Calculus, 94%, best, 42 q, 5 tries" — every mark on the card, in
     * printing order, none of it a sentence.
     */
    ariaLabel,
    /** Position in the list — staggers the deal. */
    index = 0,
    watermark = false,
}) {
    const reduce = useReducedMotion();
    const [lift, setLift] = useState(false);
    const depth = depthFor(total);
    const up = lift && !reduce;

    return (
        <motion.div
            className={`relative ${PACK_W} flex-shrink-0`}
            // content-box, deliberately. Tailwind sets border-box globally, so
            // the reserved fan space was being taken OUT of the declared width:
            // the top card came out 145px wide while the pack behind it stayed
            // 176, and the deck looked like a small card on a big one.
            style={{ paddingRight: PAD, paddingBottom: PAD, boxSizing: "content-box" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -60, y: -14, rotate: -8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            transition={reduce ? { duration: 0.2 } : {
                // Dealt round the table rather than all at once, capped so a
                // shelf of thirty packs doesn't take four seconds to arrive.
                ...SPRING, delay: Math.min(index * 0.045, 0.5),
            }}
            onHoverStart={() => setLift(true)}
            onHoverEnd={() => setLift(false)}
            onFocus={() => setLift(true)}
            onBlur={() => setLift(false)}
        >
            {/* The rest of the pack. Purely the count made visible — it carries
                no text, so it can never be the thing you were supposed to read. */}
            {Array.from({ length: depth }).map((_, i) => {
                const n = depth - i;
                return (
                    <motion.span key={i} aria-hidden="true"
                        className={`absolute top-0 left-0 ${PACK_W} aspect-[2.5/3.5]`}
                        initial={false}
                        animate={up
                            ? { x: n * STEP * 1.9, y: n * STEP * 1.5, rotate: n * 1.7 }
                            : { x: n * STEP, y: n * STEP, rotate: 0 }}
                        transition={SPRING}
                    >
                        <CardBack tone={tone} flat={i > 0} className="w-full h-full" />
                    </motion.span>
                );
            })}

            <motion.button
                type="button"
                onClick={() => onSelect?.()}
                data-card-pack={label}
                aria-label={ariaLabel || label}
                className="relative block w-full text-left cursor-pointer rounded-[0.9rem]
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-ring"
                initial={false}
                animate={up ? { y: -8, rotate: -1.4 } : { y: 0, rotate: 0 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={SPRING}
            >
                <PlayingCard rank={rank} suit={suit} mastery={mastery} tone={tone}
                    smallIndices watermark={watermark}
                    className={`${PACK_W} aspect-[2.5/3.5]`}>
                    {/* Right padding clears the bottom-right index; the top
                        clears the top-left one. Both indices are printed INSIDE
                        the card, so the face has to make room for them rather
                        than run underneath. */}
                    <span className="absolute inset-0 flex flex-col pl-3 pr-5 pt-7 pb-5">
                        {children}
                    </span>
                </PlayingCard>
            </motion.button>

            {/* Actions, in the gutter BELOW the card rather than over its
                top-right corner.
                
                Two bugs, one move. They used to be `opacity-0` until hover,
                which on a touch screen — where nothing ever hovers — made
                delete and stats unreachable rather than subtle. Showing them
                always then exposed the second one: the corner they sat in is
                where the title starts, so a three-line title ran underneath
                three floating buttons.
                
                Down here nothing is behind them, they are visible without a
                pointer, and the fan spreads down-RIGHT on hover so it clears a
                left-anchored row. Outside the card's own button either way — a
                button inside a button is invalid HTML and the inner one stops
                firing. */}
            {actions && (
                <div className={`absolute left-0 flex gap-1 transition-opacity duration-200
                    ${up ? "opacity-100" : "opacity-70"} focus-within:opacity-100`}
                    style={{ bottom: (PAD - 28) / 2 }}>
                    {actions}
                </div>
            )}
        </motion.div>
    );
}

/**
 * One of the small buttons in that row.
 *
 * 28px rather than the 44px a primary control would get: three of them at 44
 * would be wider than the 176px card they belong to. They are secondary by
 * construction — the card's own tap opens a sheet that offers the same things
 * with room to label them — so the smaller target is the right trade here, and
 * it is a real 28px box rather than an icon with a hit area painted round it.
 */
export function PackAction({ label, onClick, tone = "muted", children }) {
    const colour = tone === "danger"
        ? "text-streak hover:bg-streak/10"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary";
    return (
        <button type="button" aria-label={label} title={label}
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className={`w-7 h-7 grid place-items-center rounded-lg bg-surface/90 backdrop-blur-sm
                border border-border cursor-pointer transition-colors duration-200
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
                focus-visible:outline-ring ${colour}`}>
            {children}
        </button>
    );
}
