/**
 * AceBody — Ace as an actual character, not a logo in a circle.
 *
 * The old mark was a spade with a face knocked out of it, sitting in a 36px
 * disc. That reads as an icon, and an icon can't be a companion: it can't walk
 * in, point at something, sit on the edge of a card or look where you're
 * looking. This is the same spade given a body, arms, feet and a pair of eyes
 * big enough to carry an expression across a room.
 *
 * WHAT'S KEPT FROM THE OLD DRAWING, and why:
 *
 * The face is still CUT OUT of the silhouette rather than painted on. The eye
 * whites are the surface colour and the pupils are the body colour, so the
 * whole character is two fills and it can never end up with black eyes on a
 * black body in dark mode. Every pose below is a change of numbers, not a
 * change of shapes — one drawing, many expressions.
 *
 * WHAT'S NEW:
 *
 * Pupils. The old eyes were solid knock-outs, which means they could only be
 * open, shut or squashed. A pupil can LOOK somewhere, and "looks at the thing
 * he's talking about" is most of what makes a mascot feel present.
 *
 * Arms and feet. They're what let him wave, point, carry something and walk.
 * They're deliberately simple — mitts and ovals, no joints — because a
 * character you have to rig is a character nobody adds a pose to later.
 */
import React, { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* ── The silhouette ──────────────────────────────────────────────────────
   Drawn in a 64-wide space so the original spade path still fits, with room
   left and right for arms and below for feet. */
const VIEW = "-10 0 84 92";

const BODY = "M32 4 C32 4 4 25 4 37 C4 45.5 10.5 51.5 18 51.5 C23.5 51.5 28 48.5 30 44.5 "
    + "C29.5 51.5 26 57.5 19 62 L45 62 C38 57.5 34.5 51.5 34 44.5 "
    + "C36 48.5 40.5 51.5 46 51.5 C53.5 51.5 60 45.5 60 37 C60 25 32 4 32 4 Z";

const EYE = { x: [23, 41], y: 31, rx: 8.2, ry: 9.4 };

/**
 * Poses.
 *
 *   look      — where the pupils point, in eye-radius units
 *   lids      — 1 open, 0 shut. Below ~0.35 the highlight is dropped.
 *   mouth     — smile | grin | o | flat | null
 *   arms      — down | up | wave | point | hips | carry
 *   tilt      — head tilt in degrees, applied to the whole body
 *   brow      — up | down | null. Two strokes; the cheapest expression there is.
 */
const POSES = {
    stand:   { look: [0, 0],       lids: 1,    mouth: "smile", arms: "down",  tilt: 0 },
    happy:   { look: [0, -0.1],    lids: 1,    mouth: "grin",  arms: "down",  tilt: 0,  blush: true },
    wave:    { look: [0.15, -0.1], lids: 1,    mouth: "grin",  arms: "wave",  tilt: -4, blush: true },
    point:   { look: [0.5, 0.35],  lids: 1,    mouth: "smile", arms: "point", tilt: 3 },
    think:   { look: [-0.55, -0.4], lids: 0.8, mouth: "flat",  arms: "hips",  tilt: -6, brow: "down" },
    cheer:   { look: [0, -0.25],   lids: 1,    mouth: "o",     arms: "up",    tilt: 0,  blush: true, sparkle: true },
    proud:   { look: [0, 0],       lids: 0.05, mouth: "grin",  arms: "hips",  tilt: 0,  blush: true, arcs: true },
    peek:    { look: [0, -0.5],    lids: 1,    mouth: null,    arms: "down",  tilt: 0 },
    sleep:   { look: [0, 0],       lids: 0,    mouth: null,    arms: "down",  tilt: -14, blush: true, lids0: true },
    alert:   { look: [0, -0.15],   lids: 1,    mouth: "o",     arms: "up",    tilt: 0,  brow: "up" },
    wink:    { look: [0, 0],       lids: 1,    mouth: "grin",  arms: "wave",  tilt: -3, blush: true, winkRight: true },
    // Mid-stride. The legs do the walking; this is the upper half of it.
    walk:    { look: [0.25, 0],    lids: 1,    mouth: "smile", arms: "swing", tilt: 2 },
    // Holding something out to you — the shape a check-in or a suggestion takes.
    offer:   { look: [0.1, 0.25],  lids: 1,    mouth: "smile", arms: "carry", tilt: -2 },
};

/** Irregular on purpose — a metronome blink reads as a machine. */
const BLINK_MIN = 2800, BLINK_SPREAD = 3800;

/* ── Arms ────────────────────────────────────────────────────────────────
   Each is a stub and a mitt. Written as explicit coordinates per pose rather
   than as a transform, because a rotation about a shoulder that doesn't exist
   looks like a detached limb sliding around. */
const ARMS = {
    // At rest he has none, and that is the point. The spade's two lobes
    // already read as a folded-arms body; drawing limbs on top of them gave
    // him four appendages at the bottom of the frame, competing with the feet
    // and reading as a spider. Arms appear when they have a job.
    down:  null,
    hips:  null,
    up:    { l: { x: -3,  y: 13, r: 7 },   r: { x: 67,  y: 13, r: 7 } },
    wave:  { l: null,                       r: { x: 68,  y: 12, r: 7 } },
    point: { l: null,                       r: { x: 70,  y: 44, r: 7 } },
    swing: { l: { x: 3,   y: 55, r: 7 },   r: { x: 61,  y: 61, r: 7 } },
    carry: { l: { x: 11,  y: 57, r: 7 },   r: { x: 53,  y: 57, r: 7 } },
};

/**
 * Where each arm attaches — at the BOTTOM of the lobes, not their widest
 * point. Attached at the waistline the arms sat inside the silhouette (the
 * lobes already reach x 4 and x 60 at y 37–51) and read as two lumps on his
 * shoulders rather than as limbs. From down here they cross the narrow tail
 * and come out against the background, where an arm can be seen.
 */
const SHOULDER = { l: { x: 17, y: 49 }, r: { x: 47, y: 49 } };

function Arm({ side, pose, tone }) {
    const set = ARMS[pose];
    const a = set && set[side];
    if (!a) return null;
    const s = SHOULDER[side];
    return (
        <g className={tone}>
            <line x1={s.x} y1={s.y} x2={a.x} y2={a.y}
                stroke="currentColor" strokeWidth={a.r * 1.25} strokeLinecap="round"
                style={{ color: "inherit" }} className={tone.replace("fill-", "stroke-")} />
            <circle cx={a.x} cy={a.y} r={a.r} />
        </g>
    );
}

export default function AceBody({
    className = "w-24",
    pose = "stand",
    tone = "fill-foreground",
    card = "fill-surface",
    cardStroke = "stroke-surface",
    blink = true,
    title,
    step = 0,
}) {
    const p = POSES[pose] || POSES.stand;
    const reduce = useReducedMotion();
    const [blinking, setBlinking] = useState(false);

    useEffect(() => {
        if (!blink || reduce || p.lids < 0.2) return;
        let t;
        const schedule = () => {
            t = setTimeout(() => {
                setBlinking(true);
                setTimeout(() => { setBlinking(false); schedule(); }, 110);
            }, BLINK_MIN + Math.random() * BLINK_SPREAD);
        };
        schedule();
        return () => clearTimeout(t);
    }, [blink, reduce, p.lids]);

    const open = blinking ? 0.06 : p.lids;
    const shut = open < 0.12;
    const [lx, ly] = p.look;

    // Feet. `step` swings them for the walk cycle; at rest they're level.
    const lift = reduce ? 0 : step;
    const feet = [
        { x: 23, y: 69 - Math.max(0, lift) * 4, rx: 9.5, ry: 5.4 },
        { x: 41, y: 69 - Math.max(0, -lift) * 4, rx: 9.5, ry: 5.4 },
    ];

    return (
        <svg viewBox={VIEW} className={className}
            role={title ? "img" : "presentation"}
            aria-label={title || undefined} aria-hidden={title ? undefined : true}>
            <g transform={`rotate(${p.tilt} 32 40)`}>
                {/* Feet first so the body overlaps them — it reads as standing
                    ON them rather than balanced above them. */}
                {feet.map((f, i) => (
                    <ellipse key={`f${i}`} cx={f.x} cy={f.y} rx={f.rx} ry={f.ry} className={tone} />
                ))}

                <Arm side="l" pose={p.arms} tone={tone} />
                <Arm side="r" pose={p.arms} tone={tone} />

                <path d={BODY} className={tone} />

                {/* Cheeks, under the eyes, knocked out at low opacity so they
                    read as a blush rather than as two more holes. */}
                {p.blush && EYE.x.map((x, i) => (
                    <ellipse key={`b${i}`} cx={x + (i ? 7.5 : -7.5)} cy={EYE.y + 9} rx="4.6" ry="3"
                        className={card} opacity="0.4" />
                ))}

                {/* Eyes. Whites knocked out of the body, pupils in the body
                    colour on top — which is what lets him look at things. */}
                {!shut && !p.arcs && EYE.x.map((x, i) => {
                    const winking = p.winkRight && i === 1;
                    if (winking) return (
                        <path key={i} d={`M${x - 5.5} ${EYE.y} Q${x} ${EYE.y - 5.5} ${x + 5.5} ${EYE.y}`}
                            fill="none" className={cardStroke} strokeWidth="3.4" strokeLinecap="round" />
                    );
                    return (
                        <g key={i}>
                            <ellipse cx={x} cy={EYE.y} rx={EYE.rx} ry={EYE.ry * open} className={card} />
                            {open > 0.35 && (
                                <>
                                    <circle cx={x + lx * EYE.rx * 0.55} cy={EYE.y + ly * EYE.ry * 0.5}
                                        r={EYE.rx * 0.52} className={tone} />
                                    {/* The catchlight. Without it a pupil is a
                                        hole; with it the eye looks wet. */}
                                    <circle cx={x + lx * EYE.rx * 0.55 + 1.8}
                                        cy={EYE.y + ly * EYE.ry * 0.5 - 2}
                                        r={EYE.rx * 0.19} className={card} />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* Squeezed shut into happy arcs. */}
                {p.arcs && EYE.x.map((x, i) => (
                    <path key={`a${i}`} d={`M${x - 6} ${EYE.y + 2.5} Q${x} ${EYE.y - 5} ${x + 6} ${EYE.y + 2.5}`}
                        fill="none" className={cardStroke} strokeWidth="3.4" strokeLinecap="round" />
                ))}

                {/* Out cold: flat lines. An ellipse with ry 0 draws nothing. */}
                {p.lids0 && EYE.x.map((x, i) => (
                    <path key={`l${i}`} d={`M${x - 6} ${EYE.y + 1} L${x + 6} ${EYE.y + 1}`}
                        className={cardStroke} strokeWidth="3.4" strokeLinecap="round" />
                ))}

                {p.brow && EYE.x.map((x, i) => {
                    const inner = i ? -1 : 1;
                    const drop = p.brow === "down" ? 2.6 : -2.6;
                    return (
                        <path key={`br${i}`}
                            d={`M${x - 6 * inner} ${EYE.y - 12 + drop} L${x + 5 * inner} ${EYE.y - 13 - drop}`}
                            className={cardStroke} strokeWidth="2.8" strokeLinecap="round" />
                    );
                })}

                {p.mouth === "smile" && (
                    <path d="M26 42.5 Q32 47.5 38 42.5" fill="none"
                        className={cardStroke} strokeWidth="3" strokeLinecap="round" />
                )}
                {p.mouth === "grin" && (
                    <path d="M25 41.5 Q32 50 39 41.5 Z" className={card} />
                )}
                {p.mouth === "flat" && (
                    <path d="M26 44 L38 44" fill="none"
                        className={cardStroke} strokeWidth="3" strokeLinecap="round" />
                )}
                {p.mouth === "o" && (
                    <ellipse cx="32" cy="44" rx="3.6" ry="4.4" className={card} />
                )}

                {p.sparkle && (
                    <g className={tone}>
                        <path d="M14 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" opacity="0.9" />
                        <path d="M48 6 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" opacity="0.75" />
                    </g>
                )}
            </g>
        </svg>
    );
}

export { POSES };
