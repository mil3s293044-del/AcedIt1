/**
 * SpadeMark — Ace, drawn as the ace of spades.
 *
 * He used to be a gradient circle with a sparkle in it, which is the icon
 * every AI chat button in the world uses and says nothing about who he is.
 * "Ace" already implies a card; committing to the spade gives him a shape
 * people recognise before they read anything.
 *
 * The face is cut OUT of the spade rather than drawn on top of it. That's not
 * a style choice — a knocked-out eye is whatever colour the card behind it is,
 * so the whole mascot works in light and dark from one fill and can never end
 * up with black eyes on a black spade.
 *
 * Moods are the only animation. A mascot that bounces continuously is a mascot
 * you turn off.
 */
import React from "react";

// The spade itself: apex, two lobes, and the tail, as one closed path so the
// silhouette stays crisp at 16px.
const SPADE = "M32 5 C32 5 6 26 6 36 C6 43.5 11.5 49 18 49 C23 49 27.5 46 30 42 "
    + "C29.5 49 26 55 19.5 59.5 L44.5 59.5 C38 55 34.5 49 34 42 "
    + "C36.5 46 41 49 46 49 C52.5 49 58 43.5 58 36 C58 26 32 5 32 5 Z";

/** Where the eyes sit, and how they change per mood. */
const MOODS = {
    // Open and level — the default, and what he wears 95% of the time.
    idle:     { eye: { rx: 6.4, ry: 7.6, dy: 0, dx: 0 }, brow: null },
    // Looking up and away while he works something out.
    thinking: { eye: { rx: 6, ry: 7.2, dy: -1.5, dx: -1.8 }, brow: null },
    // Squeezed shut into happy arcs.
    pleased:  { eye: null, brow: "happy" },
    // Wide, for the moment he's flagging something.
    alert:    { eye: { rx: 7.2, ry: 8.6, dy: 0, dx: 0 }, brow: null },
};

const EYE_X = [24, 40];
const EYE_Y = 30;

/**
 * The mascot's head. `tone` picks the spade's fill; the default reads as a
 * real playing card — black pip on the card stock.
 */
export function SpadeFace({
    className = "w-8 h-8",
    mood = "idle",
    tone = "fill-foreground",
    // Both halves of the knock-out colour, spelled out. Tailwind's scanner
    // never sees a class assembled at runtime, so `card.replace("fill-",
    // "stroke-")` compiled to nothing and the pleased face rendered blank.
    card = "fill-surface",
    cardStroke = "stroke-surface",
    title,
}) {
    const m = MOODS[mood] || MOODS.idle;
    return (
        <svg viewBox="0 0 64 64" className={className} role={title ? "img" : "presentation"}
            aria-label={title || undefined} aria-hidden={title ? undefined : true}>
            <path d={SPADE} className={tone} />
            {m.eye && EYE_X.map((x, i) => (
                <ellipse key={i} cx={x + m.eye.dx} cy={EYE_Y + m.eye.dy}
                    rx={m.eye.rx} ry={m.eye.ry} className={card} />
            ))}
            {m.brow === "happy" && EYE_X.map((x, i) => (
                <path key={i}
                    d={`M${x - 4.5} ${EYE_Y + 1.5} Q${x} ${EYE_Y - 4} ${x + 4.5} ${EYE_Y + 1.5}`}
                    fill="none" className={cardStroke}
                    strokeWidth="3" strokeLinecap="round" />
            ))}
            {/* A mouth only when he's pleased — a permanent smile on a small
                mark turns into a smudge. */}
            {mood === "pleased" && (
                <path d="M26.5 36.5 Q32 41.5 37.5 36.5" fill="none"
                    className={cardStroke}
                    strokeWidth="2.8" strokeLinecap="round" />
            )}
        </svg>
    );
}

/** A plain spade pip, no face — for suit labels and card corners. */
export function SpadePip({ className = "w-3 h-3", tone = "fill-foreground" }) {
    return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
            <path d={SPADE} className={tone} />
        </svg>
    );
}

/**
 * Ace as an actual playing card — corner index, big centred face.
 *
 * Used where he introduces himself and has room to. The proportions are a real
 * card's (2.5:3.5) so it reads as one at a glance.
 */
export function AceCard({ className = "w-20", mood = "idle", tilt = 0 }) {
    return (
        <div className={`relative aspect-[2.5/3.5] rounded-xl bg-surface border-2 border-border shadow-soft overflow-hidden ${className}`}
            style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
            <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
                <span className="font-display font-black text-[10px] text-foreground">A</span>
                <SpadePip className="w-2 h-2" />
            </div>
            <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
                <span className="font-display font-black text-[10px] text-foreground">A</span>
                <SpadePip className="w-2 h-2" />
            </div>
            <div className="absolute inset-0 grid place-items-center">
                <SpadeFace className="w-1/2 h-1/2" mood={mood} />
            </div>
        </div>
    );
}

/**
 * The mark used in the launcher and the panel header: the face on a round
 * card. Small enough that the pip has to carry it, so no index corners here.
 */
export default function SpadeMark({ className = "w-9 h-9", mood = "idle", title }) {
    return (
        <div className={`relative grid place-items-center rounded-full bg-surface border-2 border-border overflow-hidden ${className}`}>
            <SpadeFace className="w-[68%] h-[68%]" mood={mood} title={title} />
        </div>
    );
}
