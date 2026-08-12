/**
 * AceShuffle — Ace riffling a deck, instead of a grey circle going round.
 *
 * There are about thirty `<Loader2 className="animate-spin" />` in this app.
 * Every one of them is a moment where a student is waiting and the product
 * shows them the same generic spinner every website on earth uses. It's the
 * cheapest personality in the whole codebase: the waiting already happens, the
 * space is already reserved, and nobody has to learn anything new.
 *
 * Three cards fan out, riffle back together, and Ace's face sits on top of the
 * stack. It reads as "shuffling" — which is what waiting IS here, the app
 * dealing you the next thing.
 *
 * Sizes are deliberately limited. A loader that can be any size is a loader
 * that ends up 200px inside a button, so there are three and they map to the
 * three places a spinner actually appears: inside a control, beside a line of
 * text, and in the middle of an empty panel.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SpadeFace, SpadePip } from "@/components/ace/SpadeMark";
import AceBody from "@/components/ace/AceBody";

const SIZES = {
    // In a button, next to a label. Too small for a face — the pip carries it.
    sm: { box: "w-5 h-6",   card: "rounded-[3px] border", face: false, spread: 5,  lift: 3 },
    // The common one: beside "Loading your dashboard…".
    md: { box: "w-9 h-12",  card: "rounded-md border-2",  face: true,  spread: 9,  lift: 5 },
    // Alone in the middle of a panel with nothing else in it.
    lg: { box: "w-16 h-20", card: "rounded-lg border-2",  face: true,  spread: 15, lift: 8 },
};

/** The three cards, back to front. The front one wears the face. */
const CARDS = [
    { id: 0, delay: 0,    tilt: -1, rest: -1 },
    { id: 1, delay: 0.12, tilt: 1,  rest: 1 },
    { id: 2, delay: 0.24, tilt: 0,  rest: 0 },
];

export default function AceShuffle({ size = "md", label = "Loading", className = "" }) {
    const s = SIZES[size] || SIZES.md;
    const reduce = useReducedMotion();

    return (
        <span role="status" aria-label={label} data-ace-shuffle={size}
            className={`relative inline-flex items-center justify-center flex-shrink-0 ${s.box} ${className}`}>
            {CARDS.map((c, i) => {
                const last = i === CARDS.length - 1;
                // Each card slides out, hangs, and snaps back — offset in time
                // so the three of them read as a riffle rather than as one
                // card that got bigger.
                // The deck rests slightly fanned rather than perfectly
                // squared. Stacked exactly, a still frame is one card — and
                // the still frame is the first thing anyone sees.
                const restX = c.rest * s.spread * 0.28;
                const restR = c.rest * 5;
                const anim = reduce ? { x: restX, rotate: restR } : {
                    x: [restX, c.tilt * s.spread, restX, restX],
                    y: [0, -s.lift * Math.abs(c.tilt), 0, 0],
                    rotate: [restR, c.tilt * 14, restR, restR],
                    transition: {
                        duration: 1.15,
                        times: [0, 0.35, 0.62, 1],
                        repeat: Infinity,
                        delay: c.delay,
                        ease: "easeInOut",
                    },
                };
                return (
                    <motion.span key={c.id} animate={anim} aria-hidden="true"
                        className={`absolute inset-0 bg-surface border-border shadow-soft ${s.card}`}
                        style={{ zIndex: i + 1 }}>
                        {/* Only the top card gets a face — three faces in a
                            stack looks like three mascots, not one deck. */}
                        {last && (
                            <span className="absolute inset-0 grid place-items-center">
                                {s.face
                                    ? <SpadeFace className="w-[62%] h-[62%]" mood="thinking" blink={!reduce} />
                                    : <SpadePip className="w-[52%] h-[52%]" />}
                            </span>
                        )}
                    </motion.span>
                );
            })}
        </span>
    );
}

/**
 * The whole "we're fetching your stuff" block, as one thing.
 *
 * Every page had its own hand-rolled version of this — a spinner, some
 * margins, and a sentence — and they'd all drifted apart. One component means
 * the wait looks the same wherever you hit it.
 */
/**
 * How he waits, by how long the wait is.
 *
 * One animation for every wait is one animation you stop seeing. These are
 * matched to the kind of wait rather than chosen for variety:
 *
 *   deck   — the riffling card stack. Short, mechanical waits: a page
 *            fetching rows. Small, quiet, over in a second.
 *   toss   — the whole character, flicking cards out of frame. Long AI
 *            generations, ten to forty seconds, where a small spinner starts
 *            to feel like nothing is happening.
 *   think  — the whole character, scratching his head. Waits where the app is
 *            genuinely reasoning about YOUR data — marking, planning,
 *            analysing — because "he's working it out" is the honest read.
 */
const WAITS = {
    deck:  null,          // handled by AceShuffle below
    toss:  { pose: "toss",  size: "w-32 sm:w-40" },
    think: { pose: "think", size: "w-28 sm:w-36" },
};

export function AceLoading({ children = "Just a sec…", variant = "deck", className = "" }) {
    const w = WAITS[variant];
    const label = typeof children === "string" ? children : "Loading";
    return (
        <div className={`relative overflow-hidden flex flex-col items-center justify-center
                py-12 gap-3 ${className}`}
            data-ace-loading={variant}>
            {w
                ? <span role="status" aria-label={label}>
                    <AceBody className={w.size} pose={w.pose} />
                  </span>
                : <AceShuffle size="lg" label={label} />}
            <p className="text-sm text-muted-foreground text-center max-w-xs">{children}</p>
        </div>
    );
}
