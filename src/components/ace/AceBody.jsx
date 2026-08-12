/**
 * AceBody — Ace as an actual character, and one that MOVES.
 *
 * The first version of this drew him properly and then held him perfectly
 * still. `POSES` was a table of static numbers, so switching pose was a cut,
 * not a movement: the arm didn't swing up to wave, it teleported. Nothing
 * inside the silhouette ever moved — only the whole SVG, as a block. That is
 * the difference between a character and a sticker, and it's what he was.
 *
 * FOUR THINGS MAKE HIM ALIVE, and they're worth naming because each one is a
 * different trick:
 *
 * 1. EVERY POSE INTERPOLATES. Arms, tilt, gaze and lids are motion values, so
 *    the transition between two poses is animated rather than swapped. The key
 *    move that makes this work: arms are ALWAYS drawn, and "at rest" is a
 *    position tucked inside the silhouette, behind the body path. He doesn't
 *    grow an arm to wave — the arm was always there, hidden, and it swings out.
 *
 * 2. HE BREATHES. A slow squash on the body, about four seconds. Almost
 *    invisible, and its absence is what makes a still drawing look dead.
 *
 * 3. HE LOOKS AT YOU. Pupils track the pointer, spring-damped and clamped so
 *    he glances rather than stares. A drawing that follows you across a page
 *    stops reading as a drawing.
 *
 * 4. HE FIDGETS. While he's resting, an idle fires every ten seconds or so —
 *    a glance around, a rock on his heels, a small hop. Randomised interval,
 *    because anything on a fixed beat reads as a machine.
 *
 * WHAT HE STILL WON'T DO: move while you're reading something of his. The
 * idles only fire from resting poses, and every one of them folds flat under
 * prefers-reduced-motion. A mascot animating over the text it just asked you
 * to read is a mascot you switch off.
 *
 * The face is still CUT OUT of the silhouette — eye whites are the surface
 * colour, pupils the body colour — so he's two fills and can never end up with
 * black eyes on a black body in dark mode.
 */
import React, { useEffect, useRef, useState } from "react";
import {
    motion, useReducedMotion, useMotionValue, useSpring, useTransform,
} from "framer-motion";
import { watchPointer } from "@/components/ace/acePointer";

/* ── The silhouette ───────────────────────────────────────────────────── */
const VIEW = "-10 0 84 92";

const BODY = "M32 4 C32 4 4 25 4 37 C4 45.5 10.5 51.5 18 51.5 C23.5 51.5 28 48.5 30 44.5 "
    + "C29.5 51.5 26 57.5 19 62 L45 62 C38 57.5 34.5 51.5 34 44.5 "
    + "C36 48.5 40.5 51.5 46 51.5 C53.5 51.5 60 45.5 60 37 C60 25 32 4 32 4 Z";

const EYE = { x: [23, 41], y: 31, rx: 8.2, ry: 9.4 };

/* ── Arms ─────────────────────────────────────────────────────────────────
   Always drawn, always behind the body path. `tuck` is inside the silhouette,
   which is what lets an arm swing OUT of him instead of appearing from
   nowhere — the single change that turned the pose table into animation. */
const TUCK = { l: { x: 22, y: 48, r: 6 }, r: { x: 42, y: 48, r: 6 } };

const ARMS = {
    down:  { l: TUCK.l,                    r: TUCK.r },
    hips:  { l: { x: 13, y: 55, r: 5.6 },  r: { x: 51, y: 55, r: 5.6 } },
    up:    { l: { x: -3, y: 13, r: 7 },    r: { x: 67, y: 13, r: 7 } },
    wave:  { l: TUCK.l,                    r: { x: 68, y: 12, r: 7 } },
    point: { l: TUCK.l,                    r: { x: 70, y: 44, r: 7 } },
    swing: { l: { x: 3,  y: 55, r: 7 },    r: { x: 61, y: 61, r: 7 } },
    carry: { l: { x: 11, y: 57, r: 7 },    r: { x: 53, y: 57, r: 7 } },
    // One arm up behind his head. Reads as "hang on, I'm thinking".
    scratch: { l: TUCK.l,                  r: { x: 52, y: 8,  r: 6.4 } },
    // Both mitts over the eyes. The whole peekaboo gag.
    cover:   { l: { x: 21, y: 30, r: 7.5 }, r: { x: 43, y: 30, r: 7.5 } },
    // Elbows out, fists in — a tiny bodybuilder.
    flex:    { l: { x: 0,  y: 24, r: 7 },  r: { x: 64, y: 24, r: 7 } },
    // Arms out sideways for balance, mid-stumble.
    flail:   { l: { x: -4, y: 34, r: 6.5 }, r: { x: 68, y: 40, r: 6.5 } },
};

/**
 * Where each arm attaches — at the BOTTOM of the lobes, not their widest
 * point. From the waistline the arms sat inside the silhouette (the lobes
 * already reach x 4 and x 60 at y 37–51) and read as lumps on his shoulders.
 */
const SHOULDER = { l: { x: 17, y: 49 }, r: { x: 47, y: 49 } };

/**
 * Poses.
 *
 *   look  — where the pupils point, in eye-radius units. `null` means "track
 *           the pointer", which is the default for anything at rest.
 *   lids  — 1 open, 0 shut. Under ~0.35 the catchlight is dropped.
 *   mouth — smile | grin | o | flat | null
 *   tilt  — degrees, whole body
 *   hop   — a vertical offset, for poses that leave the ground
 */
const POSES = {
    stand:   { look: null,          lids: 1,    mouth: "smile", arms: "down",  tilt: 0 },
    happy:   { look: null,          lids: 1,    mouth: "grin",  arms: "down",  tilt: 0,  blush: true },
    wave:    { look: null,          lids: 1,    mouth: "grin",  arms: "wave",  tilt: -4, blush: true },
    point:   { look: [0.55, 0.3],   lids: 1,    mouth: "smile", arms: "point", tilt: 3 },
    think:   { look: [-0.55, -0.4], lids: 0.8,  mouth: "flat",  arms: "scratch", tilt: -6, brow: "down" },
    cheer:   { look: [0, -0.25],    lids: 1,    mouth: "o",     arms: "up",    tilt: 0,  blush: true, sparkle: true, hop: -4 },
    proud:   { look: [0, 0],        lids: 0.05, mouth: "grin",  arms: "hips",  tilt: 0,  blush: true, arcs: true },
    peek:    { look: null,          lids: 1,    mouth: null,    arms: "down",  tilt: 0 },
    sleep:   { look: [0, 0],        lids: 0,    mouth: null,    arms: "down",  tilt: -14, blush: true, lids0: true },
    alert:   { look: [0, -0.15],    lids: 1,    mouth: "o",     arms: "up",    tilt: 0,  brow: "up" },
    wink:    { look: [0, 0],        lids: 1,    mouth: "grin",  arms: "wave",  tilt: -3, blush: true, winkRight: true },
    walk:    { look: [0.25, 0],     lids: 1,    mouth: "smile", arms: "swing", tilt: 2 },
    offer:   { look: null,          lids: 1,    mouth: "smile", arms: "carry", tilt: -2 },
    // ── Idles. Never set by a caller; fired from within while he rests. ──
    glanceL: { look: [-0.9, -0.15], lids: 1,    mouth: "smile", arms: "down",  tilt: -5 },
    glanceR: { look: [0.9, -0.15],  lids: 1,    mouth: "smile", arms: "down",  tilt: 5 },
    ponder:  { look: [-0.4, -0.5],  lids: 0.85, mouth: "flat",  arms: "scratch", tilt: -7 },
    bounce:  { look: null,          lids: 1,    mouth: "grin",  arms: "up",    tilt: 0, blush: true, hop: -6 },
    yawn:    { look: [0, 0.2],      lids: 0.15, mouth: "o",     arms: "up",    tilt: -3 },
    // Hands over the eyes, then off. Reads as a gag rather than a mood.
    peekaboo:{ look: [0, 0],        lids: 0.5,  mouth: "grin",  arms: "cover", tilt: 0,  blush: true, front: true },
    // The full-body stretch that follows a yawn.
    stretch: { look: [0, -0.3],     lids: 0.25, mouth: "o",     arms: "up",    tilt: -4, hop: -3 },
    // Looking anywhere but at you, entirely innocent.
    whistle: { look: [-0.8, -0.6],  lids: 0.7,  mouth: "o",     arms: "hips",  tilt: 5 },
    // Caught something out of the corner of his eye.
    doubletake:{ look: [0.95, -0.3], lids: 1,   mouth: "o",     arms: "down",  tilt: 8,  brow: "up" },
    // Losing his balance and getting it back.
    trip:    { look: [0, -0.4],     lids: 1,    mouth: "o",     arms: "flail", tilt: -16, hop: -2, brow: "up" },
    // He is a playing card. Riffling one is the most on-brand thing he can do.
    shuffle: { look: [0, 0.3],      lids: 1,    mouth: "smile", arms: "carry", tilt: -5, sparkle: true },
    // Very small, very pleased with himself.
    flex:    { look: [0, 0],        lids: 0.05, mouth: "grin",  arms: "flex",  tilt: 0,  blush: true, arcs: true },
    // A single decisive nod.
    nod:     { look: [0, 0.5],      lids: 0.4,  mouth: "smile", arms: "down",  tilt: 0,  hop: 2 },
};

/** Poses he's allowed to fidget out of — i.e. the ones where he's just there. */
const RESTING = new Set(["stand", "happy", "peek", "offer"]);
/** What a fidget can be, and how long it holds. */
const IDLES = [
    { pose: "glanceL",    ms: 1000 },
    { pose: "glanceR",    ms: 1000 },
    { pose: "bounce",     ms: 700 },
    { pose: "ponder",     ms: 1300 },
    { pose: "yawn",       ms: 1200 },
    { pose: "peekaboo",   ms: 1100 },
    { pose: "stretch",    ms: 1300 },
    { pose: "whistle",    ms: 1600 },
    { pose: "doubletake", ms: 900 },
    { pose: "trip",       ms: 700 },
    { pose: "shuffle",    ms: 1200 },
    { pose: "flex",       ms: 1000 },
    { pose: "nod",        ms: 600 },
];

/**
 * How often he does something.
 *
 * Was 7–14 seconds, which on a page you glance at meant you often never saw
 * one. 3.5–7.5 roughly doubles the rate. The randomised spread matters more
 * than the floor: a fidget on a fixed beat reads as a loop, and a loop is the
 * thing that gets noticed and then resented.
 *
 * The guard rails are unchanged and they're what make a higher rate safe —
 * idles fire ONLY from resting poses, so he never animates over a line he
 * just asked you to read, and every one folds flat under reduced motion.
 */
const IDLE_MIN = 3500, IDLE_SPREAD = 4000;

/** Irregular on purpose — a metronome blink reads as a machine. */
const BLINK_MIN = 2800, BLINK_SPREAD = 3800;

const SPRING = { type: "spring", stiffness: 210, damping: 18, mass: 0.7 };

/** One eye. Its own component so the pupil transforms can use hooks. */
function Eye({ cx, gazeX, gazeY, open, tone, card, showPupil }) {
    const px = useTransform(gazeX, (v) => cx + v * EYE.rx * 0.55);
    const py = useTransform(gazeY, (v) => EYE.y + v * EYE.ry * 0.5);
    const hx = useTransform(px, (v) => v + 1.8);
    const hy = useTransform(py, (v) => v - 2);
    return (
        <g>
            <motion.ellipse cx={cx} cy={EYE.y} rx={EYE.rx} ry={EYE.ry * open} initial={false}
                animate={{ ry: EYE.ry * open }} transition={{ duration: 0.09 }}
                className={card} />
            {showPupil && (
                <>
                    <motion.circle cx={px} cy={py} r={EYE.rx * 0.52} className={tone} />
                    {/* The catchlight. Without it a pupil is a hole; with it
                        the eye looks wet. */}
                    <motion.circle cx={hx} cy={hy} r={EYE.rx * 0.19} className={card} />
                </>
            )}
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
    /** Fidget while resting. Off for anything decorative or repeated. */
    idle = true,
    /** Follow the pointer with his eyes. */
    eyes = true,
    title,
    step = 0,
}) {
    const reduce = useReducedMotion();
    const ref = useRef(null);
    const [fidget, setFidget] = useState(null);
    const [blinking, setBlinking] = useState(false);

    // The pose actually being drawn: a fidget wins, but only while resting.
    const active = fidget && RESTING.has(pose) ? fidget : pose;
    const p = POSES[active] || POSES.stand;

    /* ── Gaze ──────────────────────────────────────────────────────────── */
    const rawX = useMotionValue(0), rawY = useMotionValue(0);
    const gazeX = useSpring(rawX, { stiffness: 140, damping: 16 });
    const gazeY = useSpring(rawY, { stiffness: 140, damping: 16 });

    const fixed = p.look;
    useEffect(() => {
        // A pose with an explicit gaze overrides tracking — when he's pointing
        // at something he looks at THAT, not at your cursor.
        if (fixed) { rawX.set(fixed[0]); rawY.set(fixed[1]); return; }
        if (!eyes || reduce) { rawX.set(0); rawY.set(0); return; }
        return watchPointer((mx, my) => {
            const el = ref.current;
            if (!el) return;
            const b = el.getBoundingClientRect();
            if (!b.width) return;
            // Clamped hard: he glances toward you, he doesn't lock on.
            const dx = (mx - (b.left + b.width / 2)) / (b.width * 2.2);
            const dy = (my - (b.top + b.height * 0.38)) / (b.height * 2.2);
            rawX.set(Math.max(-1, Math.min(1, dx)));
            rawY.set(Math.max(-1, Math.min(1, dy)));
        });
    }, [fixed, eyes, reduce, rawX, rawY]);

    /* ── Blink ─────────────────────────────────────────────────────────── */
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

    /* ── Fidgets ───────────────────────────────────────────────────────── */
    useEffect(() => {
        if (!idle || reduce || !RESTING.has(pose)) { setFidget(null); return; }
        let hold, next;
        const schedule = () => {
            next = setTimeout(() => {
                const pick = IDLES[Math.floor(Math.random() * IDLES.length)];
                setFidget(pick.pose);
                hold = setTimeout(() => { setFidget(null); schedule(); }, pick.ms);
            }, IDLE_MIN + Math.random() * IDLE_SPREAD);
        };
        schedule();
        return () => { clearTimeout(next); clearTimeout(hold); };
    }, [idle, reduce, pose]);

    const open = blinking ? 0.06 : p.lids;
    const shut = open < 0.12;
    const arms = ARMS[p.arms] || ARMS.down;
    const lift = reduce ? 0 : step;

    return (
        <motion.svg ref={ref} viewBox={VIEW} className={className}
            role={title ? "img" : "presentation"}
            aria-label={title || undefined} aria-hidden={title ? undefined : true}
            // Breathing. Four seconds, barely there, and the thing whose
            // absence makes a still drawing look dead.
            animate={reduce ? {} : { scaleY: [1, 1.018, 1], scaleX: [1, 0.994, 1] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "50% 88%", overflow: "visible" }}>

            <motion.g
                animate={{ rotate: p.tilt, y: p.hop || 0 }}
                transition={reduce ? { duration: 0 } : SPRING}
                style={{ transformOrigin: "32px 62px" }}>

                {/* Feet first so the body overlaps them — he stands ON them
                    rather than balancing above them. */}
                <motion.ellipse cx={23} cy={69} rx={9.5} ry={5.4} className={tone}
                    animate={{ y: -Math.max(0, lift) * 4 }} transition={{ duration: 0.14 }} />
                <motion.ellipse cx={41} cy={69} rx={9.5} ry={5.4} className={tone}
                    animate={{ y: -Math.max(0, -lift) * 4 }} transition={{ duration: 0.14 }} />

                {/* Arms, BEHIND the body. At rest they're tucked inside the
                    silhouette and invisible, which is what lets them swing out
                    rather than appear — and what means a pose covering the
                    face has to draw them a second time on top (see `front`). */}
                {!p.front && ["l", "r"].map((side) => {
                    const a = arms[side], s = SHOULDER[side];
                    const strokeCls = tone.replace("fill-", "stroke-");
                    return (
                        <g key={side}>
                            <motion.line x1={s.x} y1={s.y} x2={a.x} y2={a.y}
                                strokeWidth={a.r * 1.25} strokeLinecap="round"
                                className={strokeCls} stroke="currentColor"
                                initial={false}
                                animate={{ x2: a.x, y2: a.y, strokeWidth: a.r * 1.25 }}
                                transition={reduce ? { duration: 0 } : SPRING} />
                            <motion.circle cx={a.x} cy={a.y} r={a.r} className={tone}
                                initial={false}
                                animate={{ cx: a.x, cy: a.y, r: a.r }}
                                transition={reduce ? { duration: 0 } : SPRING} />
                        </g>
                    );
                })}

                <path d={BODY} className={tone} />

                {/* Cheeks, under the eyes, knocked out at low opacity so they
                    read as a blush rather than as two more holes. */}
                {EYE.x.map((x, i) => (
                    <motion.ellipse key={`b${i}`} cx={x + (i ? 7.5 : -7.5)} cy={EYE.y + 9}
                        rx="4.6" ry="3" className={card}
                        animate={{ opacity: p.blush ? 0.4 : 0 }} transition={{ duration: 0.25 }} />
                ))}

                {!shut && !p.arcs && EYE.x.map((x, i) => (
                    p.winkRight && i === 1 ? (
                        <path key={i} d={`M${x - 5.5} ${EYE.y} Q${x} ${EYE.y - 5.5} ${x + 5.5} ${EYE.y}`}
                            fill="none" className={cardStroke} strokeWidth="3.4" strokeLinecap="round" />
                    ) : (
                        <Eye key={i} cx={x} gazeX={gazeX} gazeY={gazeY} open={open}
                            tone={tone} card={card} showPupil={open > 0.35} />
                    )
                ))}

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
                {p.mouth === "grin" && <path d="M25 41.5 Q32 50 39 41.5 Z" className={card} />}
                {p.mouth === "flat" && (
                    <path d="M26 44 L38 44" fill="none"
                        className={cardStroke} strokeWidth="3" strokeLinecap="round" />
                )}
                {p.mouth === "o" && <ellipse cx="32" cy="44" rx="3.6" ry="4.4" className={card} />}

                {/* The front layer. Only for poses whose hands are meant to
                    be over the face — otherwise the mitts vanish behind his
                    own head, which is what peekaboo did on the first pass. */}
                {p.front && ["l", "r"].map((side) => {
                    const a = arms[side], sh = SHOULDER[side];
                    const strokeCls = tone.replace("fill-", "stroke-");
                    return (
                        <g key={`f${side}`}>
                            <motion.line x1={sh.x} y1={sh.y} x2={a.x} y2={a.y}
                                strokeWidth={a.r * 1.25} strokeLinecap="round"
                                className={strokeCls} stroke="currentColor"
                                initial={false}
                                animate={{ x2: a.x, y2: a.y, strokeWidth: a.r * 1.25 }}
                                transition={reduce ? { duration: 0 } : SPRING} />
                            <motion.circle cx={a.x} cy={a.y} r={a.r} className={tone}
                                initial={false}
                                animate={{ cx: a.x, cy: a.y, r: a.r }}
                                transition={reduce ? { duration: 0 } : SPRING} />
                        </g>
                    );
                })}

                {p.sparkle && (
                    <g className={tone}>
                        <path d="M14 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" opacity="0.9" />
                        <path d="M48 6 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" opacity="0.75" />
                    </g>
                )}
            </motion.g>
        </motion.svg>
    );
}

export { POSES, RESTING };
