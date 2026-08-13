/**
 * ReviewTable — reviewing as a hand of cards rather than a form.
 *
 * The old review screen was a progress bar, a panel, and a button that said
 * "Tap to reveal". Every one of those is a generic component doing a job the
 * material already does better: a flashcard IS a card, a deck IS a progress
 * bar, and turning a card over IS the reveal. This replaces all three with the
 * object they were standing in for.
 *
 * THE RHYTHM, and why it's this and not something else:
 *
 *   deal → read → flip → grade → toss
 *
 * The card arrives face-UP showing the question, the way a dealer slides you a
 * card you're allowed to see. Dealing it face-down and making you flip it
 * twice would be more literal and would cost an extra beat on every single
 * card — and in a sitting you do sixty of them. The one flip in the loop is
 * the one that earns its place, because it's the moment the answer arrives.
 *
 * TWO PILES INSTEAD OF A PROGRESS BAR. The draw pile thins and the discard
 * pile thickens. That's the same information the bar carried, except it's
 * carried by the thing the information is about, and it needs no label to be
 * understood. The counts are still printed underneath, because "roughly a
 * third left" is a feeling and some people want the number.
 *
 * WHAT THIS COMPONENT DOES NOT DO. It doesn't know what a flashcard is, what
 * SM-2 is, or what the grades mean. It takes two faces and a key, and it deals,
 * flips and tosses. The review screen keeps all of its own logic — which is
 * what lets the same table front a quiz later without a rewrite.
 *
 * REDUCED MOTION. No deal, no toss, no 3D. The faces cross-fade and the piles
 * still count. The metaphor survives the motion being switched off, which is
 * the test of whether it was structure or decoration.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack, CARD_H } from "@/components/cards/PlayingCard";

/** Piles are sized off the same height as the card, so one number moves both. */
const PILE_H = `calc(${CARD_H} * 0.3)`;
const STRIP_H = `calc(${CARD_H} * 0.15)`;

/** How many card edges a pile shows before it stops getting visibly thicker. */
const MAX_DEPTH = 6;

/**
 * A stack of face-down cards. `count` is the real number; the visible depth is
 * capped, because past about six edges you cannot tell seven from eleven and
 * the stack just gets taller than the table.
 */
function Pile({ count, tone, h, spent = false, glow, className = "" }) {
    const depth = Math.min(count, MAX_DEPTH);
    return (
        <span className={`relative inline-block ${className}`}
            style={{ height: h, aspectRatio: "2.5 / 3.5" }}>
            {/* The landing flash. It's the only confirmation of WHICH grade you
                pressed when you graded with the keyboard and never looked at
                the buttons — so it's feedback, not decoration. */}
            <AnimatePresence>
                {glow && (
                    <motion.span key="glow" className="absolute -inset-1 rounded-[1.1rem] pointer-events-none"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.12 }}
                        transition={{ duration: 0.22 }}
                        style={{ boxShadow: `0 0 0 3px ${glow}, 0 0 22px 2px ${glow}` }} />
                )}
            </AnimatePresence>
            {Array.from({ length: depth }).map((_, i) => {
                // Deepest card first, furthest down and right; the top card
                // lands square at 0,0. Done the other way round the top of the
                // stack floats up off its own label.
                const back = depth - 1 - i;
                return (
                    // The positioning lives on a wrapper, NOT on the card.
                    // Passing `absolute` to something whose own class list says
                    // `relative` loses: Tailwind emits position utilities in a
                    // fixed order and `relative` comes last, so it wins however
                    // the strings are concatenated. The card collapsed to a
                    // 3px sliver.
                    <span key={i} className="absolute inset-0"
                        style={{
                            transform: `translate(${back * 1.8}px, ${back * 1.8}px)`
                                + (spent ? " rotate(5deg)" : ""),
                            opacity: spent ? 0.5 : 1,
                        }}>
                        {/* Only the top card carries a shadow. Six stacked
                            drop shadows make a pile look like a smudge. */}
                        <CardBack tone={tone} flat={back > 0} className="w-full h-full" />
                    </span>
                );
            })}
            {/* An empty slot still holds its place — the table shouldn't
                re-centre itself when you take the last card. */}
            {depth === 0 && (
                <span className="absolute inset-0 rounded-[0.9rem] border-2 border-dashed border-border/70" />
            )}
        </span>
    );
}

function Count({ n, label, className = "" }) {
    return (
        <p className={`text-[11px] sm:text-xs text-muted-foreground text-center leading-tight ${className}`}>
            <span className="font-bold text-foreground tabular-nums">{n}</span> {label}
        </p>
    );
}

/**
 * A deterministic wobble from the card's position in the deck. Cards thrown
 * onto a pile don't land square, but they also mustn't land somewhere new on
 * every re-render — `Math.random()` here would make the card twitch whenever
 * React decided to run again.
 */
function jitter(seed) {
    const n = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
    return { rot: 6 + n * 14, dy: -30 - n * 30 };
}

/**
 * How the card leaves, per grade. Not decoration: the throw is the only thing
 * that acknowledges what you just pressed, and pressing "Again" should not
 * feel identical to pressing "Easy". A missed card gets thrown down and away;
 * an easy one gets flicked up onto the pile.
 *
 * `mult` scales the jittered arc so no two cards land quite the same.
 */
const THROW = {
    1: { x: 215, dy: 46, spin: -1.5 },
    2: { x: 190, dy: 6, spin: 0.7 },
    3: { x: 178, dy: -6, spin: 1 },
    4: { x: 172, dy: -34, spin: 1.5 },
};

/** How long the discard pile holds its landing flash. */
const FLASH_MS = 420;

export default function ReviewTable({
    /** Changes when the card changes. Drives the deal and the toss. */
    cardKey,
    rank = "A",
    suit = "spade",
    mastery,
    tone,
    /** Cards still to be seen, INCLUDING the one on the table. */
    remaining = 1,
    /** Cards already graded. */
    done = 0,
    flipped = false,
    onFlip,
    front,
    back,
    /** Sits above the card — the weak-spot flag and the like. */
    badge,
    revealHint = "Tap to turn over · or press Space",
    /** 1–4: how the last card was graded. Shapes the throw and the flash. */
    grade,
    /** A colour for the flash, per grade. Inline, so the JIT can't miss it. */
    gradeTone,
}) {
    const reduce = useReducedMotion();
    const j = jitter(Number(cardKey) || 0);
    const inDeck = Math.max(0, remaining - 1);
    const lift = useAnimationControls();
    const [flash, setFlash] = useState(null);

    // A card turning over lifts off the table for a moment. Run imperatively
    // rather than as an `animate` keyframe array: framer only replays
    // keyframes when the target CHANGES, and an array rebuilt every render is
    // a coin toss as to whether it plays at all.
    useEffect(() => {
        if (reduce) return;
        lift.start({ scale: [1, 1.055, 1], transition: { duration: 0.46, ease: "easeOut" } });
    }, [flipped, cardKey, reduce, lift]);

    // Keyed off `done` rather than off `grade`, so grading two cards the same
    // way in a row still flashes twice.
    useEffect(() => {
        if (!done || reduce) return undefined;
        setFlash(true);
        const t = setTimeout(() => setFlash(false), FLASH_MS);
        return () => clearTimeout(t);
    }, [done, reduce]);

    /**
     * The exit animation is a VARIANT taking `custom`, not a plain object, and
     * that is load-bearing. AnimatePresence renders the leaving child from the
     * previous render tree, so a plain `exit={{…}}` built from the grade you
     * just pressed would animate with the PREVIOUS grade — every throw one
     * card behind. `custom` on AnimatePresence is re-read at exit time, which
     * is the whole reason the hook exists.
     */
    const leaving = { t: THROW[grade] || THROW[3], j };
    const variants = {
        enter: reduce ? { opacity: 0 }
            // Out of the draw pile, off to the left — not out of nowhere.
            : { opacity: 0, x: -215, y: -34, rotate: -15, scale: 0.45 },
        center: reduce ? { opacity: 1 }
            : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
        exit: (c) => (reduce ? { opacity: 0 } : {
            opacity: 0,
            x: c.t.x,
            y: c.j.dy * 0.5 + c.t.dy,
            rotate: c.j.rot * c.t.spin,
            scale: 0.42,
        }),
    };

    // Size only — the wrappers below own the positioning, for the reason in
    // Pile above.
    const faceProps = { rank, suit, mastery, tone, className: "w-full h-full" };

    return (
        <div data-review-table className="w-full">
            {/* Small screens: the two piles as a strip above the card. Flanking
                piles need roughly 260px of clear space either side of a card
                that is already most of a phone's width, so below `sm` they
                move rather than overlap the thing you're reading. */}
            <div className="flex sm:hidden items-end justify-between gap-3 mb-3 px-1">
                <div className="flex items-end gap-2">
                    <Pile count={inDeck} tone={tone} h={STRIP_H} />
                    <Count n={inDeck} label="to go" className="!text-left" />
                </div>
                <div className="flex items-end gap-2">
                    <Count n={done} label="done" className="!text-right" />
                    <Pile count={done} tone={tone} h={STRIP_H} spent glow={flash ? gradeTone : null} />
                </div>
            </div>

            <div className="flex items-center justify-center gap-3 md:gap-8">
                {/* Draw pile */}
                <div className="hidden sm:flex flex-col items-center gap-2 flex-shrink-0">
                    <Pile count={inDeck} tone={tone} h={PILE_H} />
                    <Count n={inDeck} label="to go" />
                </div>

                <div className="flex flex-col items-center gap-3 min-w-0">
                    {badge}
                    <div
                        className="relative flex-shrink-0 max-w-[88vw]"
                        style={{ height: CARD_H, aspectRatio: "2.5 / 3.5", perspective: 1400 }}
                    >
                        <AnimatePresence initial={false} custom={leaving}>
                            <motion.div
                                key={cardKey}
                                className="absolute inset-0"
                                custom={leaving}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={reduce
                                    ? { duration: 0.15 }
                                    : { type: "spring", stiffness: 260, damping: 26, mass: 0.9 }}
                                style={{ transformStyle: reduce ? undefined : "preserve-3d" }}
                            >
                              <motion.div className="absolute inset-0" animate={lift}
                                  style={{ transformStyle: reduce ? undefined : "preserve-3d" }}>
                                <motion.div
                                    className="absolute inset-0"
                                    // framer owns every key it animates: without
                                    // `initial={false}` the first frame renders
                                    // rotateY undefined and the card blinks.
                                    initial={false}
                                    animate={reduce ? undefined : { rotateY: flipped ? 180 : 0 }}
                                    transition={{ type: "spring", stiffness: 170, damping: 21 }}
                                    style={{ transformStyle: reduce ? undefined : "preserve-3d" }}
                                >
                                    {/* QUESTION. The whole face is the reveal
                                        control — a card you turn over by
                                        touching it anywhere, not by finding a
                                        button on it. */}
                                    {(!reduce || !flipped) && (
                                        <button
                                            type="button"
                                            data-card-face="question"
                                            onClick={flipped ? undefined : onFlip}
                                            tabIndex={flipped ? -1 : 0}
                                            aria-hidden={flipped ? "true" : undefined}
                                            className="absolute inset-0 text-left cursor-pointer"
                                            style={reduce ? undefined : {
                                                backfaceVisibility: "hidden",
                                                WebkitBackfaceVisibility: "hidden",
                                            }}
                                        >
                                            <PlayingCard {...faceProps}>
                                                {/* `min-h-full` on the inner column rather than
                                                    `justify-center` on the scroller: a centred
                                                    flex child that outgrows an overflow container
                                                    has its top clipped away with no way to scroll
                                                    back up to it. */}
                                                <span className="absolute inset-0 block overflow-y-auto px-6 sm:px-7 pt-11 pb-12">
                                                    <span className="min-h-full flex flex-col items-center justify-center
                                                        text-center gap-4">
                                                        {front}
                                                    </span>
                                                </span>
                                                <span className="absolute inset-x-0 bottom-5 text-center text-[11px]
                                                    font-bold text-muted-foreground px-6">
                                                    {revealHint}
                                                </span>
                                            </PlayingCard>
                                        </button>
                                    )}

                                    {/* ANSWER — the reverse of the same card. */}
                                    {(!reduce || flipped) && (
                                        <div
                                            data-card-face="answer"
                                            aria-hidden={flipped ? undefined : "true"}
                                            className="absolute inset-0"
                                            style={reduce ? undefined : {
                                                backfaceVisibility: "hidden",
                                                WebkitBackfaceVisibility: "hidden",
                                                transform: "rotateY(180deg)",
                                            }}
                                        >
                                            <PlayingCard {...faceProps}>{back}</PlayingCard>
                                        </div>
                                    )}
                                </motion.div>
                              </motion.div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Discard pile */}
                <div className="hidden sm:flex flex-col items-center gap-2 flex-shrink-0">
                    <Pile count={done} tone={tone} h={PILE_H} spent glow={flash ? gradeTone : null} />
                    <Count n={done} label="done" />
                </div>
            </div>
        </div>
    );
}
