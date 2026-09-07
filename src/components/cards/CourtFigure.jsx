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
 * The plate is drawn in a 100 × 62 box whose BOTTOM edge is the mirror line.
 *
 * LANDSCAPE, not square, and that is the whole reason the first pass came out
 * as a vase on a plinth. Each half of the panel is about 64 wide by 39 tall on
 * a 2.5:3.5 card, so a square viewBox letterboxed to the height and drew the
 * figure at half the width it had — a narrow column with margins either side,
 * which is a chess piece.
 *
 * ─── WHAT MEETS AT THE FOLD DECIDES WHETHER THIS IS A FIGURE ────────────────
 * The robe used to run the full width and curve UP toward the centre, and the
 * note here claimed squaring its bottom corners had fixed the flying saucer.
 * It had not, and the reason is that the saucer was never made by the corners:
 * mirror ANY silhouette whose top edge peaks in the middle and you get a lens.
 * Full width made it worse, because the lens then spanned the whole card and
 * the horizontal rule between the halves ran through it like an equator.
 *
 * So the robe stops short of the sides and its last stretch into the fold is
 * VERTICAL. Mirrored, vertical sides meet as a rectangle — one band of cloth
 * across the middle of the card, which is what the waist of a real court card
 * is — and the taper above it reads as shoulders instead of as the top half of
 * an ellipse. This is the property to preserve: at the mirror line the outline
 * must be parallel to the fold's normal, never converging on it.
 *
 * ─── ONE SILHOUETTE, NOT FOUR SHAPES ────────────────────────────────────────
 * Head, ruff, robe and the held object were four separate marks with daylight
 * between them, so at any size below "large" they read as scattered debris and
 * at large size they read as a diagram. They interlock now: the ruff overlaps
 * the head, the robe overlaps the ruff, and the object's shaft runs down UNDER
 * the robe — which is free, because BODY is painted last and simply covers it.
 * What is left above the robe is the part a hand would be holding up.
 */
const BODY = (
    <>
        {/* The robe. Vertical from y=54 into the fold — see the note above; a
            curve here is the flying saucer, every time. Inset from the sides
            so the fold's band is cloth rather than the whole card. */}
        <path d="M20 62 L20 54 L25 48 Q32 43 41 41 L59 41 Q68 43 75 48 L80 54 L80 62 Z" />
        {/* The collar, ON TOP of the robe and in the same ink, so it prints as
            a denser V rather than needing a second colour or a knocked-out
            hole. It is the one mark that stops the robe reading as a slab. */}
        <path d="M43 41 L50 55 L57 41 Z" />
        {/* The ruff. Deliberately overlaps the head above (its top curve dips
            behind the skull) and is overlapped by the robe below, so head,
            neck and shoulders are ONE mass. Left with daylight around it the
            head reads as a ball resting on a pedestal. */}
        <path d="M37 33 Q50 39 63 33 L68 43 Q50 49 32 43 Z" />
        {/* Head. */}
        <ellipse cx="50" cy="25" rx="11" ry="11.5" />
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
    K: <path d="M30 22 L34 6 L42 15 L50 2 L58 15 L66 6 L70 22 Z" />,
    // Rounded arches with pearls on the tips. Shorter and wider than the king.
    Q: (
        <>
            <path d="M31 22 Q32 10 40 15 Q50 4 60 15 Q68 10 69 22 Z" />
            {/* Pearls ON the arch tips, overlapping the outline. Clear of
                it they read as three loose dots above her head — the same
                daylight problem the head and ruff had. */}
            <circle cx="40" cy="13" r="2.6" />
            <circle cx="50" cy="6" r="3" />
            <circle cx="60" cy="13" r="2.6" />
        </>
    ),
    // A soft cap with a plume — no crown at all, which is the point. The jack
    // is a servant, and every real deck draws him without one.
    J: (
        <>
            <path d="M31 23 Q32 9 50 9 Q68 9 69 23 Z" />
            {/* The feather hugs the cap. Swept further it stops reading as
                a plume on a hat and becomes a horn coming out of one. */}
            <path d="M60 14 Q69 5 75 8 Q67 12 63 20 Z" />
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
            {/* The blade runs down UNDER the robe — BODY paints last and simply
                covers it, which costs nothing and is the whole difference
                between held and laid alongside. Only what a raised hand would
                show is left above the shoulder. */}
            <path d="M26 20 L30 20 L30 52 L26 52 Z" />
            <path d="M20 32 L36 32 L36 36 L20 36 Z" />
            <path d="M26 20 L28 14 L30 20 Z" />
        </>
    ),
    Q: (
        <>
            <path d="M26 32 L29.5 32 L29.5 52 L26 52 Z" />
            <circle cx="27.75" cy="28" r="4.6" />
        </>
    ),
    J: (
        <>
            <path d="M26 24 L29.5 24 L29.5 52 L26 52 Z" />
            <path d="M27.75 10 Q34 17 27.75 24 Q21.5 17 27.75 10 Z" />
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
