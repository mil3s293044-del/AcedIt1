/**
 * SuitPip — the four suit marks, on one 0–64 box.
 *
 * Lifted out of PlayingCard so the court figure can use it without importing
 * the card that imports the court figure. A cycle between those two resolves
 * at render time and would probably work, and "probably works" is not what you
 * want under the one component every other surface is built on.
 *
 * All four are drawn on the SAME box, which is what lets any of them be
 * dropped into a pip layout, a corner index or a court panel at any size and
 * come out the same visual weight. A heart drawn on its own bounding box would
 * be noticeably larger than a diamond at the identical class.
 */
import React from "react";
import { SpadePip } from "@/components/ace/SpadeMark";
import { SUIT_IS_RED } from "@/components/cards/cardIdentity";

const HEART = "M32 57 C32 57 6 39 6 22.5 C6 13.4 12.9 7 20.8 7 C26.2 7 30.1 10 32 13.6 "
    + "C33.9 10 37.8 7 43.2 7 C51.1 7 58 13.4 58 22.5 C58 39 32 57 32 57 Z";
const DIAMOND = "M32 4 L54 32 L32 60 L10 32 Z";
const CLUB = "M32 5 C25.8 5 20.8 10 20.8 16.2 C20.8 18.1 21.3 19.9 22.1 21.4 "
    + "C20.9 20.8 19.5 20.5 18 20.5 C11.8 20.5 6.8 25.5 6.8 31.7 C6.8 37.9 11.8 42.9 18 42.9 "
    + "C22.5 42.9 26.4 40.2 28.1 36.4 C28.4 42.7 25.9 50.2 20.8 55 L43.2 55 "
    + "C38.1 50.2 35.6 42.7 35.9 36.4 C37.6 40.2 41.5 42.9 46 42.9 C52.2 42.9 57.2 37.9 57.2 31.7 "
    + "C57.2 25.5 52.2 20.5 46 20.5 C44.5 20.5 43.1 20.8 41.9 21.4 C42.7 19.9 43.2 18.1 43.2 16.2 "
    + "C43.2 10 38.2 5 32 5 Z";

const PATHS = { heart: HEART, diamond: DIAMOND, club: CLUB };

/**
 * One suit mark. Spades come from the mascot's own pip so the two agree.
 *
 * `tone` overrides the suit's own colour, for the court figure, which prints
 * its pip in the subject's ink alongside the rest of the plate.
 */
export default function SuitPip({ suit = "spade", className = "w-3 h-3", tone }) {
    const ink = tone || (SUIT_IS_RED[suit] ? "fill-destructive" : "fill-foreground");
    if (suit === "spade" || !PATHS[suit]) return <SpadePip className={className} tone={ink} />;
    return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
            <path d={PATHS[suit]} className={ink} />
        </svg>
    );
}
