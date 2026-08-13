/**
 * PlayingCard — the physical card. Everything the card theme is built on.
 *
 * This is deliberately a PRIMITIVE rather than a flashcard component. The
 * point of committing to a theme is that one object turns up everywhere — the
 * review deck, the planner's hand, an achievement — and it is recognisably the
 * same object each time. Something that only knows how to be a flashcard would
 * have to be copied to be anything else, and copies drift.
 *
 * WHAT MAKES IT READ AS A CARD, in order of how much each one matters:
 *
 *   1. THE PROPORTION. 2.5:3.5 is the one thing you cannot fake. A rounded
 *      rectangle at any other ratio reads as a panel. Crucially the aspect is
 *      driven off HEIGHT here, not width — a card sized by width overflows the
 *      bottom of a laptop the moment the text gets long, and a card that has
 *      to scroll the page is not a card on a table.
 *
 *   2. THE PRINTED FRAME. Real cards have a hairline rule inset a few
 *      millimetres from the edge. It costs one pseudo-element and it is most
 *      of the difference between "playing card" and "div".
 *
 *   3. THE CORNER INDICES. Rank and suit, top-left and bottom-right rotated
 *      180°, because that is how you read a card held in a fan. See
 *      cardIdentity.js for what the two marks actually mean here — they are
 *      not decoration, they're the mastery score and the subject.
 *
 *   4. THE SHADOW. A thin object lying on a surface, not a floating panel:
 *      tight contact shadow plus a long soft one.
 *
 * It stays theme-aware. A playing card in dark mode is still a card — it is
 * not a white rectangle burning a hole in a dark screen — so the stock is
 * `bg-surface` and the ink is `text-foreground`, same as everything else.
 */
import React, { useId } from "react";
import { SpadePip } from "@/components/ace/SpadeMark";
import { SUIT_IS_RED, rankTitle } from "@/components/cards/cardIdentity";

/**
 * The other three suits, drawn on the same 0–64 box as the spade so all four
 * pips are interchangeable at any size.
 */
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

/** One suit mark. Spades come from the mascot's own pip so the two agree. */
export function SuitPip({ suit = "spade", className = "w-3 h-3" }) {
    const tone = SUIT_IS_RED[suit] ? "fill-destructive" : "fill-foreground";
    if (suit === "spade" || !PATHS[suit]) return <SpadePip className={className} tone={tone} />;
    return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
            <path d={PATHS[suit]} className={tone} />
        </svg>
    );
}

/**
 * `#3B82F6` → `rgba(59,130,246,a)`. Subject colours arrive as hex from the
 * database and there is no guarantee of the format, so anything that isn't a
 * six-digit hex falls back to nothing rather than producing `#3B82F633` —
 * which some browsers accept, some ignore, and which is impossible to debug
 * when it silently does nothing.
 */
export function alpha(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return undefined;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The height ladder. Every card and pile on a table is sized off one of these. */
export const CARD_H = "clamp(19rem, 56vh, 32rem)";

/** A corner index: rank over pip, the way it's printed. */
function Index({ rank, suit, flip }) {
    return (
        <span aria-hidden="true"
            className={`absolute flex flex-col items-center leading-none z-10 ${
                flip ? "bottom-2.5 right-3 rotate-180" : "top-2.5 left-3"}`}>
            <span className={`font-display font-black text-sm sm:text-base tabular-nums ${
                SUIT_IS_RED[suit] ? "text-destructive" : "text-foreground"}`}>{rank}</span>
            <SuitPip suit={suit} className="w-2.5 h-2.5 sm:w-3 sm:h-3 -mt-0.5" />
        </span>
    );
}

export default function PlayingCard({
    rank = "A",
    suit = "spade",
    /** The subject's colour, as hex. Tints the printed frame and the edge. */
    tone,
    /** Skip the corner marks — for a card too small to print them legibly. */
    indices = true,
    /** Explains the two corner marks on hover, and to a screen reader. */
    mastery,
    /**
     * The big suit mark printed under the face. A real card is never blank in
     * the middle, and a flashcard with a short answer leaves most of the card
     * empty — without this it reads as a card that failed to load. Kept at the
     * threshold of visibility so it can never compete with the text.
     */
    watermark = true,
    className = "",
    style,
    children,
    ...rest
}) {
    const ink = alpha(tone, 0.34);
    return (
        <div
            className={`relative rounded-[0.9rem] bg-surface border border-border overflow-hidden
                shadow-[0_1px_2px_rgba(13,22,38,0.10),0_18px_34px_-18px_rgba(13,22,38,0.42)]
                ${className}`}
            style={style}
            {...rest}
        >
            {/* The printed rule. Inset, hairline, tinted by the subject — the
                single cheapest thing that turns a rounded box into card stock.
                Pointer-events off so it can never eat a tap on the face. */}
            <span aria-hidden="true"
                className="absolute inset-[6px] rounded-[0.6rem] border pointer-events-none z-10"
                style={{ borderColor: ink || "hsl(var(--border))" }} />

            {watermark && (
                <span aria-hidden="true"
                    className="absolute inset-0 grid place-items-center pointer-events-none opacity-[0.035]">
                    <SuitPip suit={suit} className="w-[42%] h-[42%]" />
                </span>
            )}

            {indices && (
                <span title={rankTitle(rank, suit, mastery)}>
                    <Index rank={rank} suit={suit} />
                    <Index rank={rank} suit={suit} flip />
                </span>
            )}

            {children}
        </div>
    );
}

/**
 * The reverse. Every card in a deck shares one back, which is exactly why a
 * face-down pile reads as a DECK rather than as a pile of unrelated cards.
 *
 * Drawn as SVG with a userSpaceOnUse lattice so the diagonals stay the same
 * gauge whatever size the card is rendered at — a CSS gradient lattice scales
 * with the box and goes coarse on a big card and muddy on a small one.
 */
export function CardBack({ tone, flat = false, className = "", style, ...rest }) {
    const ink = alpha(tone, 0.9) || "hsl(var(--primary))";
    const soft = alpha(tone, 0.16) || "hsl(var(--primary) / 0.16)";
    // The lattice is a <pattern>, and a pattern is referenced BY ID. Two decks
    // with different subject colours on one screen would both resolve to
    // whichever back mounted first, so every back gets its own id. React's
    // generated ids contain colons, which url(#…) will not accept.
    const pid = `ace-back-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    return (
        <div
            className={`relative rounded-[0.9rem] bg-surface border border-border overflow-hidden
                ${flat ? "" : "shadow-[0_1px_2px_rgba(13,22,38,0.10),0_18px_34px_-18px_rgba(13,22,38,0.42)]"}
                ${className}`}
            style={style}
            aria-hidden="true"
            {...rest}
        >
            <svg className="absolute inset-[5px] w-[calc(100%-10px)] h-[calc(100%-10px)]"
                viewBox="0 0 100 140" preserveAspectRatio="none">
                <defs>
                    <pattern id={pid} width="8" height="8" patternUnits="userSpaceOnUse">
                        <path d="M0 8 L8 0 M-2 2 L2 -2 M6 10 L10 6" stroke={ink}
                            strokeWidth="1" strokeOpacity="0.5" fill="none" />
                    </pattern>
                </defs>
                <rect width="100" height="140" rx="7" fill={soft} />
                <rect width="100" height="140" rx="7" fill={`url(#${pid})`} />
                <rect x="1" y="1" width="98" height="138" rx="6.5"
                    fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="1.5" />
            </svg>
            {/* The medallion. Something has to sit in the middle or the back
                reads as wallpaper rather than as the back of THIS deck. */}
            <span className="absolute inset-0 grid place-items-center">
                <span className="grid place-items-center rounded-full w-[38%] aspect-square border-2"
                    style={{ borderColor: ink, backgroundColor: "hsl(var(--surface))" }}>
                    <SpadePip className="w-1/2 h-1/2" tone="fill-foreground" />
                </span>
            </span>
        </div>
    );
}
