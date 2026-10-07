/**
 * Confetti — ONE cannon, for every moment in the app that earns one.
 *
 * It was written for the `confetti` prank and lived inside `PrankOverlay`, so
 * the only other screen that has ever genuinely deserved it — the one where
 * somebody has just paid — had nothing, and a second copy would have been the
 * mirror this codebase keeps deleting. The reasoning below is unchanged; only
 * its address is.
 */
import React from "react";
import { motion } from "framer-motion";

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
export function Confetti({ reduce }) {
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

export default Confetti;
export { PAPER, scatter };
