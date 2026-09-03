/**
 * CourtFigure — what is actually printed on a jack, a queen and a king.
 *
 * ─── What this replaces ─────────────────────────────────────────────────────
 * A framed box with the suit pip in it twice, mirrored. The reasoning at the
 * time was that a bad illustration is worse than none, which is true, and it
 * skipped the part that matters: a court card is not a numbered card with a
 * different middle. It is the ONE card in the deck that carries a FIGURE, and
 * the figure is the whole reason you can tell a jack from a three across a
 * table. Two clubs in a rectangle reads as a domino — which is exactly what a
 * student said about it.
 *
 * ─── What makes a court card read as one, in order ──────────────────────────
 *
 *   1. IT IS DOUBLE-HEADED. Mirrored about the horizontal midline, so the card
 *      is the same either way up. That silhouette — two heads pointing away
 *      from a centre line — is unmistakable at any size, and it is the first
 *      thing you see before any detail resolves.
 *   2. THE HEADWEAR TELLS YOU THE RANK. A pointed crown is a king, a rounded
 *      one a queen, a plumed cap a jack. Real decks lean on this because the
 *      corner index is hidden by the cards in front of it in a fan.
 *   3. THE PIP SITS IN THE CORNER OF EACH HALF, so the suit still reads once
 *      the figure has the middle.
 *
 * ─── Drawn as a silhouette, deliberately ────────────────────────────────────
 * A real court card is a four-colour woodcut with a halberd, a fleur-de-lis
 * border and a face. Reproducing that at 55 pixels wide gets you a smudge, and
 * this card is drawn at 55 pixels wide far more often than it is drawn large.
 * So: flat shapes, in the subject's own ink, at the scale where each still has
 * an outline you can read — crown, head, ruff, shoulders. It is the SHAPE of a
 * court card, which is the part that survives being small.
 *
 * The ink is the subject's colour, the same one tinting the card's printed
 * rule, so a hand of five subjects comes out five different courts rather than
 * five grey ones.
 */
import React from "react";
import SuitPip from "@/components/cards/SuitPip";

/**
 * Head, ruff and shoulders — identical for all three ranks, because on a real
 * deck they are: the plate is the same engraving with different regalia.
 *
 * Coordinates are a 0–100 box whose BOTTOM edge is the mirror line, so the
 * shoulders run right into it and the two halves meet as one body. Anything
 * that floats clear of that line looks like two small people rather than one
 * double-headed figure.
 */
/**
 * The plate is drawn in a 100 × 62 box whose BOTTOM edge is the mirror line.
 *
 * LANDSCAPE, not square, and that is the whole reason the first pass came out
 * as a vase on a plinth. Each half of the panel is about 64 wide by 39 tall on
 * a 2.5:3.5 card, so a square viewBox letterboxed to the height and drew the
 * figure at half the width it had — a narrow column with margins either side,
 * which is a chess piece. Matched to the half's real ratio, the robe reaches
 * the sides and the two halves meet as one garment across the middle of the
 * card, which is what a court card actually looks like.
 */
const BODY = (
    <>
        {/* The robe, filling the FULL WIDTH at the mirror line — square into
            both bottom corners, not tapered to a point at each end. Tapered,
            the two mirrored halves meet as a pointed lens across the middle of
            the card and the figure reads as a flying saucer; squared, they
            meet as one band of cloth, which is what the middle of a real court
            card is. */}
        <path d="M0 62 L0 49 C17 45 33 43 50 43 C67 43 83 45 100 49 L100 62 Z" />
        {/* The ruff. Narrower than the shoulders — it was wider, which made it
            the broadest thing on the card and turned the figure into a bow
            tie. Its job is only to separate the head from the body. */}
        <path d="M33 32 Q50 39 67 32 L73 44 Q50 51 27 44 Z" />
        {/* Head. */}
        <ellipse cx="50" cy="22" rx="13" ry="13.5" />
    </>
);

/**
 * The regalia. This is the only thing that differs between the three, which is
 * why each one is a distinct SILHOUETTE rather than a distinct detail — a
 * king's spikes and a queen's domes have to be told apart in about six pixels
 * of headroom.
 */
const CROWN = {
    // Pointed spikes, and the tallest of the three.
    K: <path d="M28 17 L33 1 L41 10 L50 -3 L59 10 L67 1 L72 17 Z" />,
    // Rounded arches with pearls on the tips. Shorter and wider than the king.
    Q: (
        <>
            <path d="M29 17 Q30 4 39 10 Q50 -3 61 10 Q70 4 71 17 Z" />
            <circle cx="39" cy="7" r="3.2" />
            <circle cx="50" cy="-2" r="3.6" />
            <circle cx="61" cy="7" r="3.2" />
        </>
    ),
    // A soft cap with a plume — no crown at all, which is the point. The jack
    // is a servant, and every real deck draws him without one.
    J: (
        <>
            <path d="M29 18 Q30 3 50 3 Q70 3 71 18 Z" />
            <path d="M66 7 Q80 -6 92 -1 Q78 4 71 16 Z" />
        </>
    ),
};

/**
 * What the figure is holding.
 *
 * Every court card in a real deck holds something, and at this size the object
 * does more work than the face: something cutting up through the robe is the
 * difference between a person and a bust on a plinth. It is also the second
 * rank cue after the headwear — the sword is the king's, the flower the
 * queen's, and the jack carries a staff.
 */
const HELD = {
    K: (
        <>
            <path d="M16 30 L20 30 L20 62 L16 62 Z" />
            <path d="M10 33 L26 33 L26 37 L10 37 Z" />
        </>
    ),
    Q: (
        <>
            <path d="M17 40 L21 40 L21 62 L17 62 Z" />
            <circle cx="19" cy="34" r="5" />
            <circle cx="12" cy="39" r="3" />
            <circle cx="26" cy="39" r="3" />
        </>
    ),
    J: (
        <>
            <path d="M17 36 L21 36 L21 62 L17 62 Z" />
            <path d="M19 20 Q26.5 28 19 36 Q11.5 28 19 20 Z" />
        </>
    ),
};

/**
 * One half of the figure. Rendered twice by CourtFace, the second rotated 180°.
 *
 * `xMidYMax` pins the body to the mirror line whatever shape the half ends up
 * — the panel is not a fixed ratio, and a figure centred in its half leaves a
 * gap down the middle of the card that no real court card has.
 */
export default function CourtFigure({ rank, suit, ink }) {
    return (
        <span className="relative flex-1 min-h-0 overflow-hidden">
            <svg viewBox="0 0 100 62" preserveAspectRatio="xMidYMax meet"
                className="absolute inset-0 w-full h-full" aria-hidden="true">
                <g fill={ink}>
                    {CROWN[rank] || CROWN.J}
                    {HELD[rank] || HELD.J}
                    {BODY}
                </g>
            </svg>
            {/* The suit, in the corner of the half — where a real court card
                prints it, and the only place on this card it is not competing
                with the figure for the middle.

                `fill-current` off an inline `color`, because the ink is an
                rgba string built from the subject's hex: there is no Tailwind
                class for it, and SuitPip takes a class rather than a style so
                that spades (which forward to the mascot's own pip) cannot
                silently miss out. */}
            <span className="absolute top-[6%] left-[7%] w-[20%] max-w-[14px] aspect-square"
                style={{ color: ink }}>
                <SuitPip suit={suit} tone="fill-current" className="w-full h-full" />
            </span>
        </span>
    );
}
