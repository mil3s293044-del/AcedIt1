/**
 * DeckStack — a flashcard deck in the list, drawn as a deck.
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
 * The pack itself — the backs, the fan, the deal — is CardPack, shared with
 * the quiz shelf. Everything below is what gets printed on this deck's face.
 */
import React from "react";
import { motion } from "framer-motion";
import { BarChart3, Trash2 } from "lucide-react";
import CardPack, { PackAction } from "@/components/cards/CardPack";
import { rankFor, suitFor } from "@/components/cards/cardIdentity";

export default function DeckStack({
    topic, unit, subject, total = 0, due = 0, weak = 0, mastery = 0, tone,
    onSelect, onStats, onDelete,
    /** Position in the list — staggers the deal. */
    index = 0,
}) {
    return (
        <CardPack
            index={index}
            label={topic}
            ariaLabel={`${topic}${unit && unit !== "General" ? `, ${unit}` : ""} — ${total} card${total === 1 ? "" : "s"}, ${due} due`}
            total={total}
            tone={tone}
            rank={rankFor(mastery)}
            suit={suitFor(subject)}
            mastery={mastery}
            onSelect={onSelect}
            // No watermark pip: at this size the card is nearly all text and a
            // big pale suit behind "142 due" is just haze. The pack behind it
            // is already doing the "this is a card" work.
            watermark={false}
            actions={(
                <>
                    <PackAction label={`Stats for ${topic}`} onClick={onStats}>
                        <BarChart3 className="w-3.5 h-3.5" />
                    </PackAction>
                    <PackAction label={`Delete ${topic}`} tone="danger" onClick={onDelete}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </PackAction>
                </>
            )}
        >
            <span className="font-display font-extrabold text-foreground text-[14px]
                leading-tight line-clamp-3">{topic}</span>
            {unit && unit !== "General" && (
                <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">{unit}</span>
            )}

            {/* The one number that answers "what now", printed where a card
                prints its pips — dead centre. Pushed to the bottom instead, it
                left the middle of the card blank, which is the one place on a
                playing card that is never empty. */}
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

            {/* Mastery, as a rule at the foot of the card rather than as
                another labelled progress bar. The corner index already says it
                in words. */}
            <span className="block h-1 rounded-full bg-secondary overflow-hidden mt-1.5 mr-1">
                <motion.span className="block h-full rounded-full"
                    style={{ backgroundColor: tone || "hsl(var(--primary))" }}
                    initial={{ width: 0 }} animate={{ width: `${Math.max(2, mastery)}%` }}
                    transition={{ duration: 0.7, delay: 0.15 }} />
            </span>
        </CardPack>
    );
}
