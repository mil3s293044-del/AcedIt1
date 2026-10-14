import React from "react";
import PlayingCard, { alpha } from "@/components/cards/PlayingCard";

/** The rail's card width — a card is fully showing when its strip is this wide. */
const CARD_W = 62;

/**
 * FanCard — a card as seen in a hand, where only its left edge is showing.
 *
 * This exists because the first two attempts at the hand got the same thing
 * wrong twice, once in the rail and once in the spread. A fanned card is
 * overlapped by the card in front of it: the visible part is a strip as wide
 * as the fan's step, not the whole card. Anything centred on the CARD is
 * therefore centred under its neighbour, and every label in the hand came out
 * as "Mathema", "Chen", "Eng", "Phy" — clipped, and clipped differently on
 * every card, which reads as a rendering fault rather than as a full hand.
 *
 * So the label is laid out in the strip. It is left-anchored, `step` wide, and
 * the last card in the fan gets the full width because nothing covers it.
 *
 * BOTH CORNER INDICES, as a real card is printed. This used to print only the
 * top-left, on the reasoning that a card held in a fan shows only that corner
 * — true of the cards that ARE overlapped, and the last card in the fan is not
 * overlapped by anything, so it sat there with one index and read as a card
 * with a corner missing.
 *
 * What made the single index look necessary was the label, which ran under the
 * bottom-right mark. So the LABEL gives way, not the index: on the last card
 * its band reserves the corner. On every other card the band is only as wide
 * as the visible strip and the index is out under the next card, where it
 * costs nothing.
 */
export default function FanCard({ card, strip, labelSize, width = CARD_W }) {
    const tone = card.tone || (card.gold ? "#F0B429" : undefined);
    // Only the card whose whole face is showing has to make room for its own
    // bottom-right index; on an overlapped card that corner is behind the next
    // card, and stealing width from a 34px strip clips the subject name.
    const clearsIndex = strip >= width - 2;
    // A strip too narrow for its name sets it UP THE EDGE, the way a spine is
    // printed. The horizontal band fits whatever the last card says, but a
    // seven-card hand on a phone leaves each overlapped card a 34px strip, and
    // "Chemistry" across that came out as "Chemi" — clipped, which reads as a
    // rendering fault however carefully the label was shortened. Up the edge
    // the constraint is the card's HEIGHT, which every short label fits.
    const spine = !clearsIndex && strip < width * 0.8;
    const ground = tone ? alpha(tone, 0.16) : "hsl(var(--muted))";
    return (
        <PlayingCard
            rank={card.rank}
            suit={card.suit}
            smallIndices
            // The real face: two marks for a two, a framed panel for a court
            // card, one big mark for the ace. Compact, so the layout sits in
            // the top two thirds and leaves the bottom edge for the name.
            // Printing a rank in a corner and nothing else is what made every
            // card in this hand read as unused stock.
            pips="compact"
            tone={tone}
            className="w-full h-full"
        >
            {spine ? (
                <span className="absolute left-0 bottom-0 flex justify-center overflow-hidden"
                    style={{
                        top: "calc(var(--card-index-h) + 2px)",
                        width: `calc(${labelSize || "8px"} * 2)`,
                        background: ground,
                    }}>
                    <span className="block font-bold leading-none text-foreground/75 whitespace-nowrap"
                        style={{
                            fontSize: labelSize,
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            padding: "5px 0",
                        }}>
                        {card.label}
                    </span>
                </span>
            ) : (
            /* The name sits on a band in the subject's own colour, opaque so
                the pips above cannot show through it. That colour is not
                decoration: it is what this subject looks like everywhere in
                the app from the moment the account exists. */
            <span className="absolute bottom-0 left-0 pt-1 pb-1.5 pl-1 text-center"
                style={{
                    width: strip,
                    // The card publishes how much room its index actually
                    // takes, so the reserve follows the mark instead of
                    // guessing at it. It used to be a flat 18px — 29% of a
                    // 62px card, reserved for a mark that is nothing like
                    // that wide once it scales with the card it is on.
                    paddingRight: clearsIndex ? "var(--card-index-w)" : 4,
                    background: ground,
                }}>
                {/* BETWEEN WORDS, NEVER INSIDE ONE. This was `break-words
                    hyphens-auto`, which is what turned "Mathematical Methods"
                    into "Mathem / atical Methods" and "Chemistry" into
                    "Chemistr / y" — a word cut in half reads as a rendering
                    fault. Labels come out of `shortSubject`, whose test holds
                    every word to what a strip can carry. */}
                <span className="block font-bold leading-[1.15] text-foreground/75
                    line-clamp-2 break-normal"
                    style={{ fontSize: labelSize }}>
                    {card.label}
                </span>
            </span>
            )}
        </PlayingCard>
    );
}

