/**
 * PrankOverlay — a prank, played, with a name on it.
 *
 * ─── IT IS BRIEF, IT IS REVERSIBLE, AND IT COSTS THE RECIPIENT NOTHING ──────
 * Every kind here is a few seconds of screen and then it is over. Nothing a
 * prank does can reach XP, a streak, the ATAR, a mark, a deck or a position —
 * if it could, it would not be a prank, it would be a penalty somebody bought.
 *
 * ─── THE NAME IS THE WHOLE REASON THIS IS PLAYFUL ───────────────────────────
 * There is no anonymous prank. The card says who sent it, every time, and the
 * server drops a row whose sender it cannot resolve rather than delivering one
 * without a name. A student who can see who did it is being joked with; one who
 * cannot is being got at, and those are different products.
 *
 * ─── REDUCED MOTION STILL DELIVERS SOMETHING ────────────────────────────────
 * Under `prefers-reduced-motion` the animation does not play — but the CARD
 * does, because the alternative is a student with motion sensitivity silently
 * receiving nothing while their friend is charged for something that did not
 * happen. Every kind degrades to the same card, which names the sender and says
 * what they sent.
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

function Confetti({ reduce }) {
    if (reduce) return null;
    const xs = scatter(28, 1);
    const ds = scatter(28, 2);
    return (
        <div className="absolute inset-0 overflow-hidden">
            {xs.map((x, i) => (
                <motion.span key={i}
                    className="absolute w-2 h-3 rounded-[2px]"
                    style={{
                        left: `${x * 100}%`, top: "-5%",
                        // THE APP'S OWN TOKENS, not literal hex. This plays over
                        // ANY page — a quiz, the dashboard, the planner — so it
                        // is not floor ink and must follow the theme like
                        // everything else the student is looking at.
                        background: ["hsl(var(--primary))", "hsl(var(--chart-3))",
                            "hsl(var(--xp))", "hsl(var(--streak))"][i % 4],
                    }}
                    initial={{ y: "-10vh", rotate: 0, opacity: 1 }}
                    animate={{ y: "110vh", rotate: 540, opacity: [1, 1, 0] }}
                    transition={{ duration: 1.6 + ds[i] * 0.8, delay: ds[i] * 0.5, ease: "easeIn" }}
                />
            ))}
        </div>
    );
}

function Snow({ reduce }) {
    if (reduce) return null;
    const xs = scatter(40, 3);
    const ds = scatter(40, 4);
    return (
        <div className="absolute inset-0 overflow-hidden">
            {xs.map((x, i) => (
                <motion.span key={i}
                    className="absolute rounded-full bg-white"
                    style={{ left: `${x * 100}%`, top: "-5%", width: 3 + ds[i] * 5, height: 3 + ds[i] * 5, opacity: 0.85 }}
                    initial={{ y: "-10vh" }}
                    animate={{ y: "110vh", x: [0, 18, -18, 0] }}
                    transition={{ duration: 3 + ds[i] * 2, delay: ds[i] * 1.2, ease: "linear" }}
                />
            ))}
        </div>
    );
}

function AceRun({ reduce }) {
    if (reduce) return null;
    return (
        <motion.div className="absolute bottom-[12%]"
            initial={{ left: "-15%" }} animate={{ left: "115%" }}
            transition={{ duration: 2.2, ease: "linear" }}>
            <motion.div animate={{ rotate: [-8, 8, -8] }}
                transition={{ duration: 0.28, repeat: Infinity }}>
                <SpadePip className="w-16 h-16" tone="fill-primary" />
            </motion.div>
        </motion.div>
    );
}

/** The card. It is the ONLY part that always plays, including under reduced
 *  motion, because it is the part that names who did this. */
function Card({ spec, from }) {
    return (
        <motion.div
            className="absolute left-1/2 top-[18%] -translate-x-1/2 px-4 py-2.5 rounded-2xl
                bg-foreground text-background shadow-xl text-center"
            initial={{ opacity: 0, y: -12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
        >
            <p className="font-display font-black text-sm leading-tight">{from} got you</p>
            <p className="text-[11px] opacity-70 mt-0.5">{spec.label}</p>
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
        // The CARD needs a beat of its own under reduced motion, or a prank
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
                    className="fixed inset-0 z-[90] pointer-events-none"
                    initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                    {spec.id === "confetti" && <Confetti reduce={reduce} />}
                    {spec.id === "snow" && <Snow reduce={reduce} />}
                    {spec.id === "spade" && <AceRun reduce={reduce} />}
                    <Card spec={spec} from={prank.from} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** `shake` and `upside` act on the PAGE rather than drawing over it, so they
 *  are a class on a wrapper rather than an overlay child. Exported so Layout
 *  can apply them to the element it already owns. */
export function prankBodyClass(prank, reduce) {
    if (reduce) return "";
    const id = prankKind(prank?.kind)?.id;
    if (id === "shake") return "prank-shake";
    if (id === "upside") return "prank-upside";
    return "";
}
