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
import SuitPip from "@/components/cards/SuitPip";
import CourtFigure from "@/components/cards/CourtFigure";
import { SUIT_IS_RED, rankTitle } from "@/components/cards/cardIdentity";

/** Re-exported: five call sites import the pip from here, and the suit mark
 *  belonging to the card is the right mental model even now that it lives in
 *  its own file (it had to, or CourtFigure and this would import each other). */
export { default as SuitPip } from "@/components/cards/SuitPip";

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

/**
 * A corner index: rank over pip, the way it's printed.
 *
 * Two sizes, because the index has to stay in proportion to the card. The
 * full-size mark on a 176px deck stack lands on top of the deck's own name —
 * a real card prints its index at a fixed fraction of the card, not a fixed
 * number of millimetres.
 */
function Index({ rank, suit, flip, small }) {
    return (
        <span aria-hidden="true"
            className={`absolute flex flex-col items-center leading-none z-10 ${
                small
                    ? (flip ? "bottom-1.5 right-2 rotate-180" : "top-1.5 left-2")
                    : (flip ? "bottom-2.5 right-3 rotate-180" : "top-2.5 left-3")}`}>
            <span className={`font-display font-black tabular-nums ${
                small ? "text-[11px]" : "text-sm sm:text-base"} ${
                SUIT_IS_RED[suit] ? "text-destructive" : "text-foreground"}`}>{rank}</span>
            <SuitPip suit={suit}
                className={small ? "w-2 h-2 mt-0.5" : "w-2.5 h-2.5 sm:w-3 sm:h-3 -mt-0.5"} />
        </span>
    );
}

/**
 * THE PIP LAYOUTS. The reason a blank card reads as blank.
 *
 * A rounded rectangle with a rank in the corner is not a playing card, it is a
 * label. What makes a five a five, at a glance, from across a table, is that
 * there are five marks arranged in the way fives have been arranged since the
 * fifteenth century. Nobody has to count them; the shape of the arrangement IS
 * the number. Leaving the middle empty throws away the one piece of visual
 * information the object was designed around, and every card in the app read
 * as unfinished stock because of it.
 *
 * Positions are [column, row] on a 3 × 7 grid: column 0 left, 1 centre, 2
 * right; row 0 top, 6 bottom. Fractional rows are the classic off-grid pips in
 * the sevens and eights. Everything below the midline is printed upside down,
 * exactly as it is on a real card, which is what lets a hand be read from
 * either end.
 */
const PIP_LAYOUT = {
    A:  [[1, 3]],
    2:  [[1, 0], [1, 6]],
    3:  [[1, 0], [1, 3], [1, 6]],
    4:  [[0, 0], [2, 0], [0, 6], [2, 6]],
    5:  [[0, 0], [2, 0], [1, 3], [0, 6], [2, 6]],
    6:  [[0, 0], [2, 0], [0, 3], [2, 3], [0, 6], [2, 6]],
    7:  [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [0, 6], [2, 6]],
    8:  [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [1, 4.5], [0, 6], [2, 6]],
    9:  [[0, 0], [2, 0], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4], [0, 6], [2, 6]],
    10: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4], [1, 5], [0, 6], [2, 6]],
};

/** Court cards get a panel, not twelve pips. Same as the real thing. */
const COURT = { J: true, Q: true, K: true };

/**
 * The face of a numbered card.
 *
 * `inset` keeps the pips clear of the corner indices; without it the top-left
 * pip of a four sits under its own rank. Sized as a percentage of the card so
 * one component serves a 62px card in a fan and a 32rem card on a table.
 */
function PipFace({ rank, suit, compact }) {
    const layout = PIP_LAYOUT[String(rank)];
    if (!layout) return null;

    // `compact` pulls the face up into the top two thirds, for a card that
    // also has to print a name along its bottom edge. Without it the row-6
    // pips land underneath the label and the card reads as a printing fault.
    //
    // The top of the field CLEARS THE INDEX, which it did not: at 20% the
    // top-left pip of a four printed straight over its own rank, on every
    // numbered card from four up. On a real card the pip field is a panel
    // inset from all four corners and the indices live outside it — the
    // columns are pulled in to 27/50/73 for the same reason.
    const top = compact ? 21 : 24;
    const span = compact ? 40 : 55;
    const size = compact ? 13 : 14;

    // One big mark, centred, for an ace. It is the whole convention, and it
    // has to come BEFORE the layout below: PIP_LAYOUT has an entry for the
    // ace too, so without this an ace prints as a single ordinary pip and
    // reads as a card with one mark on it rather than as an ace.
    if (String(rank) === "A") {
        return (
            <span aria-hidden="true"
                className="absolute inset-0 grid place-items-center pointer-events-none"
                style={compact ? { paddingBottom: "22%" } : undefined}>
                <SuitPip suit={suit} className="w-[34%] h-[34%]" />
            </span>
        );
    }

    // The pip is positioned by a wrapper rather than by passing `style` into
    // SuitPip. SuitPip forwards to SpadePip for spades and takes className
    // only, so a style prop would silently apply to three suits and not the
    // fourth — the exact class of bug that is invisible until someone picks a
    // subject that hashes to spades.
    return (
        <span aria-hidden="true" className="absolute inset-0 pointer-events-none">
            {layout.map(([c, r], i) => (
                <span
                    key={i}
                    className="absolute"
                    // Square off the WIDTH. Sized as a percentage in both
                    // axes the box came out 2.5:3.5 like the card, and an
                    // svg letterboxes inside it — so the pip drew at its
                    // width while occupying its height, and the vertical
                    // rhythm of a ten was set by a number nothing printed.
                    style={{
                        width: `${size}%`,
                        aspectRatio: "1",
                        left: `${27 + c * 23}%`,
                        top: `${top + (r / 6) * span}%`,
                        transform: `translate(-50%,-50%)${r > 3 ? " rotate(180deg)" : ""}`,
                    }}
                >
                    <SuitPip suit={suit} className="w-full h-full" />
                </span>
            ))}
        </span>
    );
}

/**
 * A court card's face: the framed panel, with the double-headed figure in it.
 *
 * The panel is the border a real jack, queen and king are printed inside; the
 * mirror line across the middle is the fold the figure is reflected about.
 * Both halves are the SAME component, the lower one rotated 180°, which is
 * exactly how the plate is made — and it means the card reads the same way up
 * whichever end of a fan you are holding.
 */
function CourtFace({ rank, suit, tone, compact }) {
    // The figure is inked LIGHTER than its own frame. It is a large filled
    // shape where a numbered card has half a dozen small marks, so matching
    // their alpha makes a court card visibly heavier than every other card in
    // the same hand — and rank is supposed to mean strength here, not weight.
    const ink = alpha(tone, 0.38) || "hsl(var(--muted-foreground))";
    const rule = alpha(tone, 0.5) || "hsl(var(--border))";
    return (
        <span aria-hidden="true"
            className={`absolute rounded-[0.35rem] border-2 pointer-events-none
                flex flex-col overflow-hidden ${
                // Same reason PipFace has a compact mode: the panel's lower
                // edge lands under the name band otherwise, and a court card
                // with its bottom sliced off looks broken rather than framed.
                compact ? "left-[18%] right-[18%] top-[13%] bottom-[31%]" : "inset-[18%]"}`}
            style={{ borderColor: rule, color: ink }}>
            <span className="flex-1 min-h-0 flex border-b" style={{ borderColor: rule }}>
                <CourtFigure rank={String(rank)} suit={suit} ink={ink} />
            </span>
            <span className="flex-1 min-h-0 flex rotate-180">
                <CourtFigure rank={String(rank)} suit={suit} ink={ink} />
            </span>
        </span>
    );
}

/**
 * How strongly the printed face is inked, per mode.
 *
 * A real card has nothing on it but the face, so a card being a CARD prints at
 * full strength. Every other mode here has the app's own words over the top —
 * a subject name, a move, a question — and the face has to lose that contest
 * without disappearing, because the thing underneath is a pattern you read
 * with your peripheral vision and the words are the thing you read.
 *
 *   true      the card is the card. Full ink.
 *   compact   a name band along the bottom edge. Backed off enough that the
 *             band and the rank both win, which the full-strength panel did
 *             not: at 92px the court frame was the loudest thing on a card
 *             whose whole job was to say "English".
 *   faint     a paragraph over the top. Printing-ghost strength.
 */
const PIP_INK = { true: 1, compact: 0.42, faint: 0.13 };

export default function PlayingCard({
    rank = "A",
    suit = "spade",
    /** The subject's colour, as hex. Tints the printed frame and the edge. */
    tone,
    /** Skip the corner marks — for a card too small to print them legibly. */
    indices = true,
    /** Smaller corner marks, for a card rendered at deck-tile size. */
    smallIndices = false,
    /** Explains the two corner marks on hover, and to a screen reader. */
    mastery,
    /**
     * The big suit mark printed under the face. A real card is never blank in
     * the middle, and a flashcard with a short answer leaves most of the card
     * empty — without this it reads as a card that failed to load. Kept at the
     * threshold of visibility so it can never compete with the text.
     */
    watermark = true,
    /**
     * Print the real pip layout in the middle: five marks for a five, a panel
     * for a court card, one big mark for an ace. Off by default because most
     * cards in the app are flashcards whose middle is the question, and pips
     * behind a paragraph are noise. On wherever the card is being a CARD —
     * a hand, a fan, a pick — which is where the empty middle was making
     * everything look like unprinted stock.
     *
     *   true      full layout, nothing else in the middle
     *   "compact" layout pulled into the top two thirds, for a card that also
     *             prints a name along its bottom edge
     *   "faint"   full layout at printing-ink strength behind other content,
     *             for a card whose middle is a word. This is what the old
     *             `watermark` was reaching for and getting wrong: one giant
     *             ghost suit says nothing, whereas seven small marks in the
     *             seven-arrangement still say "seven" even at a whisper.
     */
    pips = false,
    className = "",
    style,
    children,
    ...rest
}) {
    const ink = alpha(tone, 0.34);
    const court = COURT[String(rank)];
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

            {/* Pips win over the watermark. They are the same idea done
                properly, and printing both would put a giant ghost suit behind
                a correctly laid-out face. */}
            {pips
                ? (
                    <span aria-hidden="true"
                        className="absolute inset-0 pointer-events-none"
                        style={{ opacity: PIP_INK[String(pips)] ?? 1 }}>
                        {court
                            ? <CourtFace rank={rank} suit={suit} tone={tone}
                                compact={pips === "compact"} />
                            : <PipFace rank={rank} suit={suit} compact={pips === "compact"} />}
                    </span>
                )
                : watermark && (
                    <span aria-hidden="true"
                        className="absolute inset-0 grid place-items-center pointer-events-none opacity-[0.035]">
                        <SuitPip suit={suit} className="w-[42%] h-[42%]" />
                    </span>
                )}

            {indices && (
                <span title={rankTitle(rank, suit, mastery)}>
                    <Index rank={rank} suit={suit} small={smallIndices} />
                    <Index rank={rank} suit={suit} small={smallIndices} flip />
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
