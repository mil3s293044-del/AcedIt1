/**
 * Pile — a stack of face-down cards, and the count under it.
 *
 * Lives on its own because two screens now count in piles: the review table
 * (cards to go / cards finished) and the quiz table (questions to go /
 * questions won). Copying it would let the two drift, and the whole value of
 * the theme is that a pile means the same thing wherever you meet one.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CardBack } from "@/components/cards/PlayingCard";

/** How many card edges a pile shows before it stops getting visibly thicker. */
export const MAX_DEPTH = 6;

/**
 * `count` is the real number; the visible depth is capped, because past about
 * six edges you cannot tell seven from eleven and the stack just gets taller
 * than the table.
 */
export function Pile({ count, tone, h, spent = false, glow, className = "", ...rest }) {
    const depth = Math.min(count, MAX_DEPTH);
    return (
        <span className={`relative inline-block ${className}`}
            style={{ height: h, aspectRatio: "2.5 / 3.5" }} {...rest}>
            {/* The landing flash. It's the only confirmation of WHICH grade you
                pressed when you graded with the keyboard and never looked at
                the buttons — so it's feedback, not decoration. */}
            <AnimatePresence>
                {glow && (
                    <motion.span key="glow" className="absolute -inset-1 rounded-[1.1rem] pointer-events-none"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.12 }}
                        transition={{ duration: 0.22 }}
                        style={{ boxShadow: `0 0 0 3px ${glow}, 0 0 22px 2px ${glow}` }} />
                )}
            </AnimatePresence>
            {Array.from({ length: depth }).map((_, i) => {
                // Deepest card first, furthest down and right; the top card
                // lands square at 0,0. Done the other way round the top of the
                // stack floats up off its own label.
                const back = depth - 1 - i;
                return (
                    // The positioning lives on a wrapper, NOT on the card.
                    // Passing `absolute` to something whose own class list says
                    // `relative` loses: Tailwind emits position utilities in a
                    // fixed order and `relative` comes last, so it wins however
                    // the strings are concatenated. The card collapsed to a
                    // 3px sliver.
                    <span key={i} className="absolute inset-0"
                        style={{
                            transform: `translate(${back * 1.8}px, ${back * 1.8}px)`
                                + (spent ? " rotate(5deg)" : ""),
                            opacity: spent ? 0.5 : 1,
                        }}>
                        {/* Only the top card carries a shadow. Six stacked
                            drop shadows make a pile look like a smudge. */}
                        <CardBack tone={tone} flat={back > 0} className="w-full h-full" />
                    </span>
                );
            })}
            {/* An empty slot still holds its place — the table shouldn't
                re-centre itself when you take the last card. */}
            {depth === 0 && (
                <span className="absolute inset-0 rounded-[0.9rem] border-2 border-dashed border-border/70" />
            )}
        </span>
    );
}

export function Count({ n, label, className = "" }) {
    return (
        <p className={`text-[11px] sm:text-xs text-muted-foreground text-center leading-tight ${className}`}>
            <span className="font-bold text-foreground tabular-nums">{n}</span> {label}
        </p>
    );
}
