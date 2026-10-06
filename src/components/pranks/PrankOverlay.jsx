/**
 * PrankOverlay — a prank, played, with a name on it.
 *
 * ─── IT IS BRIEF, IT IS REVERSIBLE, AND IT COSTS THE RECIPIENT NOTHING ──────
 * Every kind here is a few seconds of screen and then it is over. Nothing a
 * prank does can reach XP, a streak, the ATAR, a mark, a deck or a position —
 * if it could, it would not be a prank, it would be a penalty somebody bought.
 *
 * ─── THE NAME IS THE WHOLE REASON THIS IS PLAYFUL ───────────────────────────
 * There is no anonymous prank. The plate says who sent it, every time, and the
 * server drops a row whose sender it cannot resolve rather than delivering one
 * without a name. A student who can see who did it is being joked with; one who
 * cannot is being got at, and those are different products.
 *
 * It used to be drawn INSIDE the element that carries `prank-upside`, so during
 * a flip the one thing on screen explaining what was happening turned over with
 * the page and could not be read — on the kind where it matters most. Layout
 * renders this as a SIBLING of that element now, which also puts `position:
 * fixed` back on the viewport: a transformed or filtered ancestor becomes the
 * containing block for fixed descendants, the trap MarkModule and AceRoam each
 * record, so `fixed inset-0` here was not the screen at all.
 *
 * ─── REDUCED MOTION STILL DELIVERS SOMETHING ────────────────────────────────
 * Under `prefers-reduced-motion` the animation does not play — but the PLATE
 * does, because the alternative is a student with motion sensitivity silently
 * receiving nothing while their friend is charged for something that did not
 * happen. Every kind degrades to the same plate, which names the sender and
 * says what they sent.
 *
 * ─── IT IS NOT A MARKET COMPONENT, which is why it does not live with them ──
 * A prank is BOUGHT on the floor and PLAYS anywhere — over a quiz, the
 * dashboard, the planner. So it follows the app's own tokens rather than the
 * floor's `--floor-*` palette, which is blank outside `.floor` and would have
 * rendered an invisible prank on every screen except the one it was bought on.
 * `floorInk.test.mjs` caught it sitting in `components/market/` with literal
 * hex in it, which is two mistakes that look like one.
 *
 * ─── NOTHING IS PORTALLED AND NOTHING TAKES A TAP ───────────────────────────
 * `pointer-events-none` throughout. A prank that could swallow a click would be
 * the one thing here that costs the recipient something real — a missed button
 * on a quiz they were mid-way through.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { prankKind } from "@/lib/pranks";
import { SpadePip } from "@/components/ace/SpadeMark";

/* A deterministic scatter: `Math.random` in a render makes every re-render a
   different snowfall, and React may render more than once per play. */
const scatter = (n, seed) => Array.from({ length: n }, (_, i) => {
    const r = Math.sin(seed + i * 12.9898) * 43758.5453;
    return r - Math.floor(r);
});

/* The app's own tokens, never literal hex. These play over ANY page — a quiz,
   the dashboard, the planner — so they are not floor ink and must follow the
   theme like everything else the student is looking at. */
const PAPER = ["hsl(var(--primary))", "hsl(var(--chart-3))",
    "hsl(var(--xp))", "hsl(var(--streak))", "hsl(var(--chart-4))"];

/**
 * A CANNON, NOT A DRIP.
 *
 * It used to be 28 pieces released from the top edge falling straight down,
 * which is the shape of a loading state rather than of a celebration — nothing
 * about it said anybody had DONE something. Two emitters fire from the bottom
 * corners: each piece gets an outward-and-upward burst, then gravity takes it,
 * which is the whole reason a real confetti cannon reads as an event.
 *
 * The arc is two keyframes on `y` with different easings — up on `easeOut`,
 * down on `easeIn` — rather than a physics loop. Three SHAPES, because a field
 * of identical rectangles reads as a texture and a mixed one reads as paper.
 */
function Confetti({ reduce }) {
    if (reduce) return null;
    const a = scatter(64, 1);
    const b = scatter(64, 2);
    const c = scatter(64, 5);
    return (
        <div className="absolute inset-0 overflow-hidden">
            {a.map((r, i) => {
                const left = i % 2 === 0;           // alternating cannons
                const spread = 20 + r * 62;         // how far across it is thrown
                const lift = 46 + b[i] * 42;        // how high it goes first
                const shape = i % 5 === 0 ? "streamer" : (i % 3 === 0 ? "round" : "rect");
                return (
                    <motion.span
                        key={i}
                        className={shape === "round" ? "absolute rounded-full" : "absolute rounded-[1px]"}
                        style={{
                            left: left ? "4%" : "96%",
                            bottom: "-4%",
                            width: shape === "streamer" ? 3 : (shape === "round" ? 7 : 9),
                            height: shape === "streamer" ? 16 : (shape === "round" ? 7 : 6),
                            background: PAPER[i % PAPER.length],
                        }}
                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                        animate={{
                            x: left ? [`0vw`, `${spread}vw`] : [`0vw`, `-${spread}vw`],
                            y: ["0vh", `-${lift}vh`, "12vh"],
                            rotate: [0, left ? 420 + c[i] * 540 : -(420 + c[i] * 540)],
                            opacity: [1, 1, 1, 0],
                        }}
                        transition={{
                            x: { duration: 1.5 + c[i] * 0.7, ease: "easeOut", delay: b[i] * 0.22 },
                            y: { duration: 1.5 + c[i] * 0.7, times: [0, 0.38, 1],
                                 ease: ["easeOut", "easeIn"], delay: b[i] * 0.22 },
                            rotate: { duration: 1.5 + c[i] * 0.7, ease: "linear", delay: b[i] * 0.22 },
                            opacity: { duration: 1.5 + c[i] * 0.7, times: [0, 0.6, 0.85, 1], delay: b[i] * 0.22 },
                        }}
                    />
                );
            })}
        </div>
    );
}

/**
 * A BLIZZARD, with depth and weather.
 *
 * Forty identical dots drifting down is weather on a screensaver. THREE LAYERS,
 * each with its own size, opacity and fall speed, is what makes it read as
 * space rather than as a sprite sheet: the near flakes are big, bright and
 * fast, the far ones small, faint and slow. The gust is a shared horizontal
 * swing so the field moves TOGETHER, which is the part that says wind rather
 * than noise.
 *
 * The frost is a vignette that creeps in from the edges and is drawn with a
 * `boxShadow` inset rather than a gradient, so it needs no assumption about
 * what colour the page underneath it is.
 */
function Snow({ reduce }) {
    if (reduce) return null;
    const xs = scatter(90, 3);
    const ds = scatter(90, 4);
    return (
        <div className="absolute inset-0 overflow-hidden">
            <motion.div
                className="absolute inset-0"
                style={{ boxShadow: "inset 0 0 120px 40px rgba(255,255,255,0.55)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0.9, 0] }}
                transition={{ duration: 4, times: [0, 0.35, 0.75, 1] }}
            />
            {xs.map((x, i) => {
                const depth = i % 3;                        // 0 near · 2 far
                const size = [7, 4.5, 2.5][depth] + ds[i] * 2;
                const fall = [2.1, 3.1, 4.4][depth] + ds[i] * 1.1;
                const gust = [34, 22, 12][depth];
                return (
                    <motion.span
                        key={i}
                        className="absolute rounded-full bg-white"
                        style={{
                            left: `${x * 104 - 2}%`, top: "-6%",
                            width: size, height: size,
                            opacity: [0.95, 0.7, 0.45][depth],
                            filter: depth === 2 ? "blur(1px)" : "none",
                        }}
                        initial={{ y: "-10vh", x: 0 }}
                        animate={{ y: "112vh", x: [0, gust, -gust * 0.6, gust * 0.8, 0] }}
                        transition={{
                            y: { duration: fall, delay: ds[i] * 1.4, ease: "linear" },
                            x: { duration: fall, delay: ds[i] * 1.4, ease: "easeInOut" },
                        }}
                    />
                );
            })}
        </div>
    );
}

/**
 * ACE ACTUALLY RUNS.
 *
 * He used to be one 64px pip sliding across at constant speed with a rotation
 * wobble — a sprite being translated, not a character moving. What makes a run
 * read as a run is SQUASH AND STRETCH on the stride and a speed that is not
 * flat, so he accelerates in, pounds across, and is gone.
 *
 * The dust is four puffs left behind at his heels, each fading as it grows,
 * which is what gives the motion a direction when the figure itself is a
 * symmetrical shape. And the screen gets KNOCKED as he passes — that is
 * `prank-knock` on the page, so the run has a consequence rather than playing
 * over a still one.
 */
function AceRun({ reduce }) {
    if (reduce) return null;
    const puffs = scatter(5, 7);
    return (
        <motion.div
            className="absolute bottom-[10%]"
            initial={{ left: "-18%" }}
            animate={{ left: "118%" }}
            transition={{ duration: 2.2, ease: [0.5, 0, 0.6, 1] }}
        >
            <div className="relative">
                {puffs.map((p, i) => (
                    <motion.span
                        key={i}
                        className="absolute rounded-full bg-foreground/15"
                        style={{ left: -14 - i * 15, bottom: 2 + p * 8, width: 12, height: 12 }}
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: [0, 0.55, 0], scale: [0.4, 2.1, 2.6] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.11, ease: "easeOut" }}
                    />
                ))}
                {/* The stride: lean, bob and squash, on one short loop. */}
                <motion.div
                    animate={{
                        rotate: [-16, 10, -16],
                        y: [0, -14, 0],
                        scaleY: [0.86, 1.14, 0.86],
                        scaleX: [1.12, 0.92, 1.12],
                    }}
                    transition={{ duration: 0.24, repeat: Infinity, ease: "easeInOut" }}
                >
                    <SpadePip className="w-24 h-24" tone="fill-primary" />
                </motion.div>
            </div>
        </motion.div>
    );
}

/**
 * THE GLITCH'S OVERLAY HALF.
 *
 * The chromatic fringe and the jitter are a CSS filter on the page itself
 * (`prank-glitch`, index.css) because they have to act on content this
 * component cannot see. What belongs up here is the stuff that is drawn ON TOP:
 * scanlines, and the horizontal TEAR bands that sell it — a few slices that
 * jump sideways in hard steps, the way a broken signal looks.
 *
 * THE BANDS CORRUPT WHAT IS BEHIND THEM rather than being laid over it. The
 * first version used `mix-blend-mode: difference` with a brand hue, and against
 * the app's cream page that resolves to a PASTEL — a band of pale pink across a
 * study screen reads as a rendering fault in the gentlest possible way.
 * `backdrop-filter: invert()` takes the actual pixels under the slice and
 * flips them, so a tear is dark where the page is light and carries the text
 * through it. Content-aware, and it cannot be wrong about the page's colour.
 *
 * The hue rotation is what stops an inverted slice reading as a plain negative:
 * it is the colour shift a broken signal has. A thin DIFFERENCE edge rides the
 * top of each band, because a tear with a hard bright lip reads as torn and one
 * with two soft edges reads as a highlight.
 */
function Glitch({ reduce }) {
    if (reduce) return null;
    const tops = scatter(7, 11);
    const hs = scatter(7, 12);
    return (
        <div className="absolute inset-0 overflow-hidden">
            <div className="prank-scanlines absolute inset-0 opacity-50" />
            {tops.map((t, i) => (
                <motion.span
                    key={i}
                    className="absolute left-0 right-0"
                    style={{
                        top: `${t * 92}%`,
                        height: 8 + hs[i] * 34,
                        backdropFilter: `invert(1) hue-rotate(${60 + i * 40}deg) saturate(1.6)`,
                        WebkitBackdropFilter: `invert(1) hue-rotate(${60 + i * 40}deg) saturate(1.6)`,
                        borderTop: "2px solid",
                        borderColor: i % 2 ? "hsl(var(--chart-3))" : "hsl(var(--streak))",
                    }}
                    initial={{ x: 0, opacity: 0 }}
                    // A TEAR JUMPS; IT DOES NOT SLIDE. The obvious way to say
                    // that is a stepped easing, and `ease: "steps(1, end)"` is
                    // a CSS string framer-motion rejects at runtime — it throws
                    // `Invalid easing type`, which aborts the whole animation
                    // batch for that render, so the NAME PLATE stayed at its
                    // initial `opacity: 0` for the entire prank. A thrown
                    // easing is invisible to lint and to the build and only
                    // showed up in the console. Held keyframes do the same job
                    // with nothing to get wrong: each value is repeated, so the
                    // travel between them is ~2% of the duration.
                    animate={{
                        x: (() => {
                            const a = (i % 2 ? 1 : -1) * (24 + hs[i] * 60);
                            const b = (i % 2 ? -1 : 1) * 32;
                            return [0, a, a, 0, 0, b, b, 0];
                        })(),
                        opacity: [0, 1, 1, 0, 0, 1, 1, 0],
                    }}
                    transition={{
                        duration: 1.8,
                        times: [0, 0.10, 0.25, 0.27, 0.46, 0.48, 0.70, 0.72],
                        ease: "linear",
                    }}
                />
            ))}
        </div>
    );
}

/**
 * LIGHTS OUT.
 *
 * The one kind that is purely an overlay: the room goes dark and something
 * sweeps past. The beam is a wide, soft, tilted band of light crossing the
 * blackout — not a torch, which would need a pointer to follow and this surface
 * deliberately has none.
 *
 * THE DARK IS A LITERAL BLACK, not `bg-foreground`. That token is near-WHITE in
 * dark mode, so an inverted "lights out" would turn the lights ON for half the
 * students — the exact failure focus mode records about its own blackout, and
 * the scrim in `UpdatePrompt` after it. A scrim is shadow, never ink.
 *
 * The plate renders after this, so the name stays readable in the dark — which
 * is the whole point of the kind that hides the screen.
 */
function LightsOut({ reduce }) {
    return (
        <>
            <motion.div
                className="absolute inset-0 bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: reduce ? [0, 0.6, 0.6, 0] : [0, 0.93, 0.93, 0] }}
                transition={{ duration: 2.8, times: [0, 0.12, 0.8, 1], ease: "easeInOut" }}
            />
            {!reduce && (
                <motion.div
                    className="absolute -top-1/2 h-[200%] w-[26vw]"
                    style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.20) 45%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.20) 55%, transparent)",
                        filter: "blur(10px)",
                        transform: "rotate(14deg)",
                    }}
                    initial={{ left: "-35%" }}
                    animate={{ left: ["-35%", "115%"] }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                />
            )}
        </>
    );
}

/**
 * THE NAME PLATE. The only part that always plays, including under reduced
 * motion, because it is the part that names who did this.
 *
 * It was a small pill reading "<name> got you" in 11px. It is a plate now: the
 * name at display size, what they sent under it, and a spring on the way in —
 * a prank is a thing somebody did TO you and the one piece of information worth
 * having is who. It holds for the whole prank rather than fading, so arriving
 * halfway through still answers the question.
 *
 * Drawn in LITERAL ink rather than `bg-foreground`/`text-background`, which
 * invert with the theme: this plays over the lights-out blackout and over a
 * page mid-glitch, and a plate that goes white-on-white in one theme is the
 * focus-mode bug again. Dark plate, light text, in both themes.
 */
function NamePlate({ spec, from, reduce }) {
    return (
        <motion.div
            className="absolute left-1/2 top-[14%] -translate-x-1/2 px-5 py-3 rounded-2xl text-center
                shadow-2xl ring-1 ring-white/10"
            style={{ background: "rgba(10, 18, 31, 0.94)" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -26, scale: 0.8, rotate: -4 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={reduce
                ? { duration: 0.25 }
                : { type: "spring", stiffness: 520, damping: 18, mass: 0.7 }}
        >
            <p className="font-display font-black text-xl sm:text-2xl leading-none text-white">
                {from} got you
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] mt-2 text-white/55">
                {spec.label}
            </p>
        </motion.div>
    );
}

/**
 * Plays one prank at a time. `onDone` fires when it finishes, so the queue
 * advances — two pranks at once is a mess nobody can read, and the receive cap
 * means there are never more than a few waiting.
 */
export default function PrankOverlay({ prank, onDone }) {
    const reduce = useReducedMotion();
    const [live, setLive] = useState(false);
    const spec = prankKind(prank?.kind);

    useEffect(() => {
        if (!spec) { onDone?.(); return undefined; }
        setLive(true);
        // The PLATE needs a beat of its own under reduced motion, or a prank
        // would arrive and leave inside one frame.
        const ms = reduce ? 2200 : spec.ms;
        const t = setTimeout(() => { setLive(false); onDone?.(); }, ms);
        return () => clearTimeout(t);
    }, [spec, reduce, onDone, prank?.id]);

    if (!spec) return null;

    return (
        <AnimatePresence>
            {live && (
                <motion.div
                    key={prank.id}
                    // NOTHING HERE TAKES A TAP. A prank that swallowed a click
                    // would be the one thing on this screen that costs the
                    // recipient something real.
                    className="fixed inset-0 z-[90] pointer-events-none overflow-hidden"
                    initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                    {spec.id === "confetti" && <Confetti reduce={reduce} />}
                    {spec.id === "snow" && <Snow reduce={reduce} />}
                    {spec.id === "spade" && <AceRun reduce={reduce} />}
                    {spec.id === "glitch" && <Glitch reduce={reduce} />}
                    {spec.id === "lights" && <LightsOut reduce={reduce} />}
                    {/* LAST, so it is over the blackout and over the tears —
                        the name is the one thing that must survive every kind. */}
                    <NamePlate spec={spec} from={prank.from} reduce={reduce} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * The kinds that act on the PAGE rather than drawing over it, as a class on the
 * element Layout already owns.
 *
 * `spade` is here too, which is new: Ace knocks the screen as he goes past, so
 * the run has a consequence instead of being a sprite sliding over a still
 * page. Every one of these is a transform or a filter, so none of them changes
 * layout and nothing moves out from under a finger mid-quiz.
 */
export function prankBodyClass(prank, reduce) {
    if (reduce) return "";
    const id = prankKind(prank?.kind)?.id;
    if (id === "shake") return "prank-shake";
    if (id === "upside") return "prank-upside";
    if (id === "spade") return "prank-knock";
    if (id === "glitch") return "prank-glitch";
    return "";
}
