/**
 * DeckStack — a deck in the list, drawn as a deck.
 *
 * These were white rectangles with three stat tiles and a progress bar in
 * them: the same block the dashboard uses, the planner uses, and every other
 * screen uses. Ten of them in a grid is the exact thing that makes an app look
 * generated — nothing on the page knows what it's about.
 *
 * A deck of flashcards is a deck of cards. So it is one: the top card face-up
 * with the deck's name on it, and the rest of the pack showing as edges behind
 * it. THE STACK IS THE COUNT — a 142-card deck is visibly fatter than a
 * 12-card one before you read a number, which is the same trick the review
 * table's two piles play.
 *
 * THE CORNER INDEX is the deck's average mastery as a rank, on the subject's
 * suit — the same two marks, meaning the same two things, as on the cards
 * inside it. That consistency is the whole point of having a theme: you learn
 * to read "queen, fat stack" once and it works everywhere.
 *
 * WHAT'S DELIBERATELY NOT ON IT. Total, weak and mastered used to each get a
 * tile. On a card the size of a card there is room for one big number, and the
 * only one that answers "what do I do now" is how many are due. The rest is on
 * the deck's own screen, one tap away, where there's room to say it properly.
 *
 * THE FAN IS DRIVEN BY STATE, not by framer's variant propagation. A parent
 * that animates with objects and hovers with a label is exactly the mix where
 * propagation quietly stops working, and a hover effect that silently does
 * nothing is worse than no hover effect.
 */
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Trash2 } from "lucide-react";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import { rankFor, suitFor } from "@/components/cards/cardIdentity";

/**
 * How many card edges show behind the top one. Not linear with the card count
 * — the difference between 12 and 30 cards is worth seeing, the difference
 * between 200 and 240 is not, and a stack that keeps growing eats the row.
 */
function depthFor(total) {
    if (total >= 90) return 4;
    if (total >= 40) return 3;
    if (total >= 12) return 2;
    return total > 1 ? 1 : 0;
}

/** Each edge sits this far down and right of the one above it. */
const STEP = 3.5;
/** Reserved so a fanned stack can't overlap its neighbour in the row. */
const PAD = 4 * STEP * 1.9 + 4;

const SPRING = { type: "spring", stiffness: 320, damping: 24 };

export default function DeckStack({
    topic, unit, subject, total = 0, due = 0, weak = 0, mastery = 0, tone,
    onSelect, onStats, onDelete,
    /** Position in the list — staggers the deal. */
    index = 0,
}) {
    const reduce = useReducedMotion();
    const [lift, setLift] = useState(false);
    const depth = depthFor(total);
    const up = lift && !reduce;

    return (
        <motion.div
            className="relative w-[158px] sm:w-[176px] flex-shrink-0"
            // content-box, deliberately. Tailwind sets border-box globally, so
            // the reserved fan space was being taken OUT of the declared width:
            // the top card came out 145px wide while the pack behind it stayed
            // 176, and the deck looked like a small card on a big one.
            style={{ paddingRight: PAD, paddingBottom: PAD, boxSizing: "content-box" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -60, y: -14, rotate: -8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            transition={reduce ? { duration: 0.2 } : {
                ...SPRING,
                // Dealt round the table rather than all at once, capped so a
                // shelf of thirty decks doesn't take four seconds to arrive.
                delay: Math.min(index * 0.045, 0.5),
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
                        className="absolute top-0 left-0 w-[158px] sm:w-[176px] aspect-[2.5/3.5]"
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
                data-deck-stack={topic}
                className="relative block w-full text-left rounded-[0.9rem]
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-ring"
                initial={false}
                animate={up ? { y: -8, rotate: -1.4 } : { y: 0, rotate: 0 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={SPRING}
            >
                {/* No watermark pip: at this size the card is nearly all text
                    and a big pale suit behind "142 due" is just haze. The pack
                    behind it is already doing the "this is a card" work. */}
                <PlayingCard rank={rankFor(mastery)} suit={suitFor(subject)} mastery={mastery} tone={tone}
                    smallIndices watermark={false}
                    className="w-[158px] sm:w-[176px] aspect-[2.5/3.5]">
                    {/* Right padding clears the bottom-right index; the top
                        clears the top-left one. Both indices are printed INSIDE
                        the card, so the text has to make room for them rather
                        than run underneath. */}
                    <span className="absolute inset-0 flex flex-col pl-3 pr-5 pt-7 pb-5">
                        <span className="block font-display font-extrabold text-foreground text-[14px]
                            leading-tight line-clamp-3">{topic}</span>
                        {unit && unit !== "General" && (
                            <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">{unit}</span>
                        )}

                        {/* The one number that answers "what now", printed
                            where a card prints its pips — dead centre. Pushed
                            to the bottom instead, it left the middle of the
                            card blank, which is the one place on a playing
                            card that is never empty. */}
                        <span className="flex-1 grid place-items-center">
                            {due > 0 ? (
                                <span className="flex flex-col items-center font-display leading-none">
                                    <span className="text-[30px] font-black tabular-nums text-foreground">{due}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest
                                        text-muted-foreground mt-1">due</span>
                                </span>
                            ) : (
                                <span className="text-[11px] font-bold text-muted-foreground text-center">
                                    All caught up
                                </span>
                            )}
                        </span>

                        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="tabular-nums">{total} card{total === 1 ? "" : "s"}</span>
                            {weak > 0 && (
                                <span className="inline-flex items-center gap-1 text-streak font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-streak" />{weak} weak
                                </span>
                            )}
                        </span>

                        {/* Mastery, as a rule at the foot of the card rather
                            than as another labelled progress bar. The corner
                            index already says it in words. */}
                        <span className="block h-1 rounded-full bg-secondary overflow-hidden mt-1.5 mr-1">
                            <motion.span className="block h-full rounded-full"
                                style={{ backgroundColor: tone || "hsl(var(--primary))" }}
                                initial={{ width: 0 }} animate={{ width: `${Math.max(2, mastery)}%` }}
                                transition={{ duration: 0.7, delay: 0.15 }} />
                        </span>
                    </span>
                </PlayingCard>
            </motion.button>

            {/* Deck actions. Outside the card button — a button inside a button
                is invalid HTML and the inner one stops firing. Absolute offsets
                resolve against the PADDING box, so the reserved fan space has
                to be added back or these land out in the gutter. */}
            <div style={{ right: PAD + 6 }}
                className={`absolute top-1.5 flex gap-0.5 transition-opacity
                    ${up ? "opacity-100" : "opacity-0"} focus-within:opacity-100`}>
                <button type="button" aria-label={`Stats for ${topic}`}
                    onClick={(e) => { e.stopPropagation(); onStats?.(); }}
                    className="w-6 h-6 grid place-items-center rounded-lg bg-surface/90 backdrop-blur-sm
                        border border-border text-muted-foreground hover:text-foreground">
                    <BarChart3 className="w-3 h-3" />
                </button>
                <button type="button" aria-label={`Delete ${topic}`}
                    onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                    className="w-6 h-6 grid place-items-center rounded-lg bg-surface/90 backdrop-blur-sm
                        border border-border text-streak hover:bg-streak/10">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    );
}
