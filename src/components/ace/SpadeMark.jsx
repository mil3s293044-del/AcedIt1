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
 * He blinks, he bobs, and he reacts. All of it is small and all of it stops
 * when the system asks for reduced motion — a mascot that moves constantly is
 * a mascot people turn off, and the point of him being alive is that you like
 * having him around rather than that you notice him.
 */
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// The spade: apex, two lobes, and the tail, as one closed path so the
// silhouette stays crisp at 16px. Fuller in the cheeks than a printed pip —
// the extra width is what turns a suit symbol into a face.
const SPADE = "M32 6 C32 6 5 26 5 37 C5 45 11 50.5 18 50.5 C23.5 50.5 28 47.5 30 43.5 "
    + "C29.5 50 26 55.5 19.5 60 L44.5 60 C38 55.5 34.5 50 34 43.5 "
    + "C36 47.5 40.5 50.5 46 50.5 C53 50.5 59 45 59 37 C59 26 32 6 32 6 Z";

const EYE_X = [23.5, 40.5];
const EYE_Y = 30;

/**
 * Moods. `squash` is how much the eye is closed — 1 is open, 0 is a line —
 * which is the only thing the blink has to animate, so blinking and
 * expression share one mechanism instead of fighting over the same shapes.
 */
const MOODS = {
    idle:     { rx: 6.4, ry: 7.6, dx: 0,    dy: 0,   squash: 1, mouth: null,     blush: false },
    happy:    { rx: 6.4, ry: 7.6, dx: 0,    dy: 0,   squash: 1, mouth: "smile",  blush: true },
    pleased:  { rx: 6.4, ry: 7.6, dx: 0,    dy: 0,   squash: 0, mouth: "smile",  blush: true, arcs: true },
    thinking: { rx: 6,   ry: 7.2, dx: -1.8, dy: -1.5, squash: 1, mouth: null,    blush: false },
    alert:    { rx: 7.4, ry: 8.8, dx: 0,    dy: 0,   squash: 1, mouth: "o",      blush: false },
    excited:  { rx: 7.2, ry: 8.4, dx: 0,    dy: -0.5, squash: 1, mouth: "smile", blush: true, sparkle: true },
    wink:     { rx: 6.4, ry: 7.6, dx: 0,    dy: 0,   squash: 1, mouth: "smile",  blush: true, winkRight: true },
    sleepy:   { rx: 6.4, ry: 4,   dx: 0,    dy: 1.5, squash: 1, mouth: null,     blush: false },
};

/** Blink timing. Irregular on purpose — a metronome blink reads as a machine. */
const BLINK_MIN = 2600, BLINK_SPREAD = 3600;

export function SpadeFace({
    className = "w-8 h-8",
    mood = "idle",
    tone = "fill-foreground",
    // Both halves of the knock-out colour, spelled out. Tailwind's scanner
    // never sees a class assembled at runtime, so `card.replace("fill-",
    // "stroke-")` compiled to nothing and the pleased face rendered blank.
    card = "fill-surface",
    cardStroke = "stroke-surface",
    blink = true,
    title,
}) {
    const m = MOODS[mood] || MOODS.idle;
    const reduce = useReducedMotion();
    const [blinking, setBlinking] = useState(false);

    useEffect(() => {
        if (!blink || reduce || m.squash === 0) return;
        let timer;
        const schedule = () => {
            timer = setTimeout(() => {
                setBlinking(true);
                setTimeout(() => { setBlinking(false); schedule(); }, 110);
            }, BLINK_MIN + Math.random() * BLINK_SPREAD);
        };
        schedule();
        return () => clearTimeout(timer);
    }, [blink, reduce, m.squash]);

    const open = blinking ? 0.08 : m.squash;
    const eyeShut = m.squash === 0;

    return (
        <svg viewBox="0 0 64 64" className={className} role={title ? "img" : "presentation"}
            aria-label={title || undefined} aria-hidden={title ? undefined : true}>
            <path d={SPADE} className={tone} />

            {/* Cheeks. Sitting UNDER the eyes and knocked out of the spade at
                low opacity, so they read as a blush rather than as two more
                holes in his face. */}
            {m.blush && EYE_X.map((x, i) => (
                <ellipse key={`b${i}`} cx={x + (i ? 6.5 : -6.5)} cy={EYE_Y + 7.5} rx="4.2" ry="2.8"
                    className={card} opacity="0.4" />
            ))}

            {!eyeShut && EYE_X.map((x, i) => {
                // One eye shut while the other stays open is the whole wink.
                const shut = m.winkRight && i === 1;
                return shut ? (
                    <path key={i} d={`M${x - 4.6} ${EYE_Y} Q${x} ${EYE_Y - 4.6} ${x + 4.6} ${EYE_Y}`}
                        fill="none" className={cardStroke} strokeWidth="3" strokeLinecap="round" />
                ) : (
                    <g key={i} transform={`translate(${x + m.dx} ${EYE_Y + m.dy})`}>
                        <ellipse rx={m.rx} ry={m.ry * open} className={card} />
                        {/* The highlight is what makes an eye look wet rather
                            than punched out. Hidden mid-blink so it can't
                            float in a closed eye. */}
                        {open > 0.5 && (
                            <circle cx={m.rx * 0.34} cy={-m.ry * 0.34} r={m.rx * 0.26}
                                className={tone} opacity="0.55" />
                        )}
                    </g>
                );
            })}

            {/* Eyes squeezed shut into happy arcs. */}
            {m.arcs && EYE_X.map((x, i) => (
                <path key={`a${i}`}
                    d={`M${x - 5} ${EYE_Y + 2} Q${x} ${EYE_Y - 4.5} ${x + 5} ${EYE_Y + 2}`}
                    fill="none" className={cardStroke} strokeWidth="3" strokeLinecap="round" />
            ))}

            {m.mouth === "smile" && (
                <path d="M25.5 37 Q32 43 38.5 37" fill="none"
                    className={cardStroke} strokeWidth="3.4" strokeLinecap="round" />
            )}
            {m.mouth === "o" && (
                <ellipse cx="32" cy="39.5" rx="3.2" ry="3.8" className={card} />
            )}

            {/* A couple of sparks for the moment something good happened. */}
            {m.sparkle && (
                <g className={card}>
                    <path d="M52 15 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" opacity="0.9" />
                    <path d="M12 20 l1.1 2.7 2.7 1.1 -2.7 1.1 -1.1 2.7 -1.1 -2.7 -2.7 -1.1 2.7 -1.1 Z" opacity="0.7" />
                </g>
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
 * The proportions are a real card's (2.5:3.5) so it reads as one at a glance.
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
 * How he moves, per mood. Kept here rather than at each call site so he
 * behaves the same everywhere — a mascot with a different bounce on every
 * screen reads as three different mascots.
 */
const MOTION = {
    idle:     { y: [0, -2.5, 0], transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } },
    happy:    { y: [0, -3.5, 0], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } },
    excited:  { y: [0, -6, 0], rotate: [0, -5, 5, 0], transition: { duration: 0.9, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" } },
    thinking: { rotate: [0, -7, 0, 7, 0], transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } },
    sleepy:   { y: [0, 1.5, 0], transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" } },
    pleased:  { scale: [1, 1.06, 1], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } },
};

/**
 * The mark used in the launcher, the panel header and the buddy: the face on
 * a round card. Small enough that the pip has to carry it, so no index
 * corners here.
 *
 * `alive` adds the idle motion. It defaults ON because the whole point of him
 * is company, but every animation still folds flat under reduced motion.
 */
export default function SpadeMark({ className = "w-9 h-9", mood = "idle", alive = true, title }) {
    const reduce = useReducedMotion();
    const anim = !reduce && alive ? MOTION[mood] || MOTION.idle : undefined;
    return (
        <motion.div
            animate={anim}
            className={`relative grid place-items-center rounded-full bg-surface border-2 border-border overflow-hidden ${className}`}>
            <SpadeFace className="w-[68%] h-[68%]" mood={mood} blink={alive} title={title} />
        </motion.div>
    );
}
