/**
 * CardFlush — the curtain. A royal flush in spades sweeps across the screen,
 * holds for a beat, and drops away to reveal the page.
 *
 * WHY A ROYAL FLUSH AND NOT SOME CARDS. The hand is A K Q J 10 of spades,
 * which is the best hand there is, and the product is called AcedIt and its
 * mascot is the Ace of Spades. So the opening shot is the thing the whole
 * brand is named after, dealt in full, before a word of copy is read. A
 * decorative loader says "this site has an animation". This says what the site
 * is about.
 *
 * FOUR RULES, because an intro animation is the easiest thing on a landing
 * page to get wrong and the most expensive when you do:
 *
 *   IT IS SHORT. Two seconds, door to door. Every extra beat is measured in
 *   people who left.
 *
 *   IT IS SKIPPABLE. Click, scroll, or any key drops the curtain immediately.
 *   Someone who has seen it once and came back to read the pricing should
 *   never be made to sit through it.
 *
 *   IT HAPPENS ONCE. Marked in sessionStorage, so navigating away and back
 *   does not replay it. A flourish you cannot escape stops being a flourish
 *   on the second viewing.
 *
 *   IT IS NOT LOAD-BEARING. The page is fully rendered and interactive
 *   underneath the whole time; this is a sheet on top, and it takes itself out
 *   of the accessibility tree and out of hit-testing the moment it starts to
 *   leave. Under reduced motion it never mounts at all.
 */
import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack, SuitPip } from "@/components/cards/PlayingCard";
import { FLUSH_SEEN, FLUSH_MS } from "@/components/marketing/flushGate";

/** The hand, in the order it lands. */
const FLUSH = ["10", "J", "Q", "K", "A"];

/** How long the cards hold before they drop. */
const HOLD_MS = 620;

export default function CardFlush() {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);
    const [dealt, setDealt] = useState(false);

    useEffect(() => {
        // The once-per-session decision is made in flushGate, at import time,
        // so the hero hand can read the same answer without consuming it.
        if (reduce || FLUSH_SEEN) return undefined;
        setOpen(true);
        const a = setTimeout(() => setDealt(true), 40);
        const b = setTimeout(() => setOpen(false), FLUSH_MS);
        return () => { clearTimeout(a); clearTimeout(b); };
    }, [reduce]);

    // Any intent to get on with it drops the curtain.
    const skip = useCallback(() => setOpen(false), []);
    useEffect(() => {
        if (!open) return undefined;
        const opts = { passive: true };
        window.addEventListener("wheel", skip, opts);
        window.addEventListener("touchstart", skip, opts);
        window.addEventListener("keydown", skip);
        return () => {
            window.removeEventListener("wheel", skip);
            window.removeEventListener("touchstart", skip);
            window.removeEventListener("keydown", skip);
        };
    }, [open, skip]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="flush"
                    aria-hidden="true"
                    onClick={skip}
                    className="fixed inset-0 z-[100] overflow-hidden cursor-pointer"
                    style={{ background: "#0D1626" }}
                    initial={{ opacity: 1 }}
                    /* The sheet itself lifts as the cards fall, so the reveal
                       is one movement rather than a fade with debris on top. */
                    exit={{ opacity: 0, transition: { duration: 0.42, ease: [0.4, 0, 1, 1] } }}
                >
                    {/* The felt the hand is dealt onto, so the curtain is the
                        same table the hero lands on rather than a black box. */}
                    <div className="absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage:
                                "linear-gradient(to right, #fff 1px, transparent 1px),"
                                + "linear-gradient(to bottom, #fff 1px, transparent 1px)",
                            backgroundSize: "64px 64px",
                            transform: "perspective(900px) rotateX(64deg) translateY(24%)",
                            transformOrigin: "center bottom",
                            maskImage: "linear-gradient(to bottom, transparent, black 55%, transparent)",
                            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 55%, transparent)",
                        }} />

                    <div className="absolute inset-0 flex items-center justify-center"
                        style={{ perspective: 1600 }}>
                        {FLUSH.map((rank, i) => {
                            const t = i - (FLUSH.length - 1) / 2;
                            return (
                                <motion.div
                                    key={rank}
                                    data-flush-card={rank}
                                    className="absolute w-[clamp(104px,15vw,190px)]"
                                    style={{ zIndex: 10 + i, transformStyle: "preserve-3d" }}
                                    /* Thrown in from off the right, face-down
                                       and spinning, the way a hand is spread
                                       across a table in one sweep. */
                                    initial={{
                                        x: "560%", y: 90, rotate: 120, rotateY: 180,
                                        scale: 0.7, opacity: 0,
                                    }}
                                    animate={dealt ? {
                                        x: `${t * 86}%`, y: t * t * 9, rotate: t * 7,
                                        rotateY: 0, scale: 1, opacity: 1,
                                    } : {}}
                                    transition={{
                                        type: "spring", stiffness: 180, damping: 21, mass: 0.85,
                                        delay: i * 0.062,
                                    }}
                                    /* And swept off the bottom, one after the
                                       other, faster than they arrived. */
                                    exit={{
                                        y: "150vh", rotate: t * 7 + (t < 0 ? -38 : 38), opacity: 0,
                                        transition: {
                                            duration: 0.5, ease: [0.32, 0, 0.67, 0],
                                            delay: (FLUSH.length - 1 - i) * 0.035,
                                        },
                                    }}
                                >
                                    <div style={{ filter: "drop-shadow(0 26px 34px rgba(0,0,0,0.55))" }}>
                                        {/* Both faces, so the spin actually
                                            turns a card over rather than
                                            rotating a picture of one. */}
                                        <div className="relative aspect-[2.5/3.5]"
                                            style={{ transformStyle: "preserve-3d" }}>
                                            <div className="absolute inset-0"
                                                style={{
                                                    backfaceVisibility: "hidden",
                                                    WebkitBackfaceVisibility: "hidden",
                                                }}>
                                                {/* A real card is not blank in
                                                    the middle. PlayingCard's
                                                    watermark sits at 3.5%
                                                    because it is designed to
                                                    go UNDER a flashcard's
                                                    text; with no content on
                                                    top these read as five
                                                    pieces of blank stock. */}
                                                <PlayingCard rank={rank} suit="spade" tone="#0D1626"
                                                    watermark={false} className="w-full h-full">
                                                    <span className="absolute inset-0 grid place-items-center">
                                                        <SuitPip suit="spade" className="w-[38%] h-[38%]" />
                                                    </span>
                                                </PlayingCard>
                                            </div>
                                            <div className="absolute inset-0"
                                                style={{
                                                    backfaceVisibility: "hidden",
                                                    WebkitBackfaceVisibility: "hidden",
                                                    transform: "rotateY(180deg)",
                                                }}>
                                                <CardBack tone="#58CC02" className="w-full h-full" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    <motion.p
                        className="absolute inset-x-0 bottom-[12%] text-center text-white/45
                            text-[11px] font-semibold tracking-[0.2em] uppercase"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: HOLD_MS / 1000 } }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        Ace it
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
