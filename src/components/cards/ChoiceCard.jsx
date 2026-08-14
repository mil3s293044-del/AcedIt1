/**
 * ChoiceCard — one multiple-choice option, as a card you can play.
 *
 * THE SUITS ARE THE POINT. The options were A, B, C, D in grey circles, which
 * is the most generic control in the app. There are four options and there are
 * four suits; ♠ ♥ ♦ ♣ costs nothing, gives each option a colour that isn't
 * arbitrary, and turns "pick an answer" into "play a card" without changing a
 * single thing about how the question works.
 *
 * It degrades honestly. A question with three or five options gets letters
 * back — a fifth suit doesn't exist, and inventing one would be worse than
 * admitting the trick only fits the common case. That case is the overwhelming
 * majority of MCQs.
 *
 * The row is card STOCK, not card proportion: the printed rule and the corner
 * mark, on a shape that fits a sentence. A flashcard's 2.5:3.5 is load-bearing
 * because the flashcard IS the card; an option is a card lying on the table,
 * and a table can hold a card any way up.
 */
import React from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { SuitPip } from "@/components/cards/PlayingCard";
import { SUITS } from "@/components/cards/cardIdentity";

/**
 * Which suit each option gets. Fixed order, so the third option is always
 * diamonds — a suit that moved between questions would be no better than a
 * random colour.
 */
export function suitForOption(index, count) {
    return count === SUITS.length ? SUITS[index] : null;
}

/** Static, because a Tailwind class built at runtime compiles to nothing. */
const ROW = {
    default:   "border-border bg-surface hover:border-chart-3/50 hover:bg-chart-3/[0.04]",
    selected:  "border-chart-3 bg-chart-3/10",
    correct:   "border-primary bg-primary/10",
    incorrect: "border-streak bg-streak/10",
    dimmed:    "border-border bg-secondary/40 opacity-60",
};

const BADGE = {
    default:   "bg-secondary",
    selected:  "bg-chart-3/20 ring-2 ring-chart-3",
    correct:   "bg-primary text-white",
    incorrect: "bg-streak text-white",
    dimmed:    "bg-secondary",
};

export default function ChoiceCard({
    index,
    count,
    /** default | selected | correct | incorrect | dimmed */
    state = "default",
    disabled = false,
    onClick,
    children,
}) {
    const suit = suitForOption(index, count);
    const letter = String.fromCharCode(65 + index);
    const verdict = state === "correct" || state === "incorrect";

    return (
        <motion.button
            type="button"
            data-choice={index}
            data-choice-state={state}
            disabled={disabled}
            onClick={onClick}
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className={`relative w-full flex items-center gap-3.5 pl-3 pr-4 py-3.5 rounded-[0.9rem]
                border-2 text-left transition-colors
                ${ROW[state]} ${disabled ? "cursor-default" : "cursor-pointer"}`}
        >
            {/* The printed rule, same as every other card in the app. */}
            <span aria-hidden="true"
                className="absolute inset-[5px] rounded-[0.55rem] border border-border/60 pointer-events-none" />

            <span className={`relative w-10 h-10 rounded-xl grid place-items-center flex-shrink-0
                transition-colors ${BADGE[state]}`}>
                {verdict ? (
                    state === "correct" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />
                ) : suit ? (
                    <SuitPip suit={suit} className="w-5 h-5" />
                ) : (
                    <span className="font-display font-black text-sm text-muted-foreground">{letter}</span>
                )}
            </span>

            <span className="relative flex-1 font-medium text-base text-foreground">{children}</span>

            {/* The key that plays it. Only worth printing while it still works. */}
            {!disabled && !verdict && (
                <span aria-hidden="true"
                    className="relative hidden sm:grid place-items-center w-5 h-5 rounded-md bg-secondary
                        text-[10px] font-black text-muted-foreground/70 flex-shrink-0">
                    {index + 1}
                </span>
            )}
        </motion.button>
    );
}
