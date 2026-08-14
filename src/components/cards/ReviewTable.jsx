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
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack, CARD_H } from "@/components/cards/PlayingCard";
import { Pile, Count } from "@/components/cards/Pile";

/** Piles are sized off the same height as the card, so one number moves both. */
const PILE_H = `calc(${CARD_H} * 0.3)`;
const STRIP_H = `calc(${CARD_H} * 0.15)`;

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
 * Two ways off the table, and the difference is the point.
 *
 *   FILE (Good, Easy) — the card is flicked across and LANDS on the finished
 *   pile. It travels to where the pile actually is, shrinks to the size the
 *   pile actually is, and only fades in the last fraction of the throw, by
 *   which time it's sitting exactly on top of a pile that has already grown by
 *   one. It reads as the card becoming the new top of the stack.
 *
 *   AWAY (Again, Hard) — the card is thrown OFF the table, down and left,
 *   tumbling, and it does not land anywhere. Which is the truth: you didn't
 *   finish with it, it's coming back. Filing a card you just failed onto the
 *   "done" pile would be the animation telling you something the scheduler
 *   disagrees with.
 */
const FILED = new Set([3, 4]);

/**
 * The two ways of being thrown off. Down and to the LEFT, deliberately: the
 * finished pile is on the right, so a card flung to the right would read as
 * being filed on it after all.
 *
 * Distances are FRACTIONS OF THE CARD, not pixels. A transform that runs past
 * the bottom of the document grows the scroll height, and the page sprouts a
 * scrollbar for half a second every time you press Again — measured at 112px
 * of new page with a fixed 470px throw. Sized off the card, the throw stays
 * inside the space the table already occupies at every viewport.
 */
const AWAY = {
    1: { fx: -0.98, fy: 0.80, rotate: -112, scale: 0.5, dur: 0.48 },
    2: { fx: -0.80, fy: 0.74, rotate: -74, scale: 0.55, dur: 0.5 },
};

/** How long the flick onto the pile takes. */
const FILE_MS = 420;
/** How long the discard pile holds its landing flash. */
const FLASH_MS = 380;

/**
 * How far down the card may be thrown without the document getting taller.
 *
 * Fractions of the card were still 4px over on some layouts, and 4px of new
 * page is a scrollbar appearing and vanishing. This asks how much room there
 * actually is below the card and clamps to it — with a floor, because a throw
 * that barely moves is worse than a scrollbar.
 */
function roomBelow(box, h, a) {
    const want = h * a.fy;
    if (!box || typeof window === "undefined") return want;
    const pageBottom = document.documentElement.scrollHeight - window.scrollY;
    // The card shrinks as it goes, which lifts its bottom edge by half the
    // height it loses — that headroom is real and worth spending.
    const slack = (h - h * a.scale) / 2;
    const most = (pageBottom - box.bottom) - 6 + slack;
    return Math.max(h * 0.34, Math.min(want, most));
}

/**
 * Where the finished pile is, right now, relative to the card.
 *
 * MEASURED rather than hardcoded, because the pile is in a completely
 * different place on a phone — it's in the strip above the card, not out to
 * the right — and a card "landing on the pile" that lands two hundred pixels
 * away from it is worse than one that just fades. Both piles are in the DOM at
 * all times with only one displayed, so the one with a real width is the one
 * on screen.
 *
 * Returns null when it can't tell, and the caller falls back to a plain toss.
 */
function landingFor(cardEl) {
    if (!cardEl) return null;
    const pile = [...document.querySelectorAll("[data-discard-pile]")]
        .map((el) => el.getBoundingClientRect())
        .find((r) => r.width > 0 && r.height > 0);
    if (!pile) return null;
    const card = cardEl.getBoundingClientRect();
    if (!card.width) return null;
    return {
        // Centre to centre. Scaling happens about the centre too, so moving
        // the centres together puts the card exactly on the pile.
        x: (pile.left + pile.width / 2) - (card.left + card.width / 2),
        y: (pile.top + pile.height / 2) - (card.top + card.height / 2),
        scale: pile.width / card.width,
    };
}

export default function ReviewTable({
    /** Changes when the card changes. Drives the deal and the toss. */
    cardKey,
    rank = "A",
    suit = "spade",
    mastery,
    tone,
    /** Cards still to be seen, INCLUDING the one on the table. */
    remaining = 1,
    /** Cards filed on the finished pile — the ones you actually recalled. */
    done = 0,
    /** Cards thrown back: graded Again or Hard, so they're due again. */
    returning = 0,
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
    const tableRef = useRef(null);

    // A card turning over lifts off the table for a moment. Run imperatively
    // rather than as an `animate` keyframe array: framer only replays
    // keyframes when the target CHANGES, and an array rebuilt every render is
    // a coin toss as to whether it plays at all.
    // Only when a card is actually turned over. Firing it on every card change
    // as well meant the LEAVING card got a lift too — both cards subscribe to
    // the same controls while they overlap — so it swelled 5% in mid-throw and
    // no longer matched the pile it was landing on.
    useEffect(() => {
        if (reduce || !flipped) return;
        lift.start({ scale: [1, 1.055, 1], transition: { duration: 0.46, ease: "easeOut" } });
    }, [flipped, reduce, lift]);

    // The pile flashes when something lands ON it — so only for a filed card,
    // and only once the card has arrived. Flashing as the card leaves would
    // have the pile react before it was hit.
    useEffect(() => {
        if (!done || reduce) return undefined;
        const land = setTimeout(() => setFlash(true), FILE_MS * 0.7);
        const off = setTimeout(() => setFlash(false), FILE_MS * 0.7 + FLASH_MS);
        return () => { clearTimeout(land); clearTimeout(off); };
    }, [done, reduce]);

    /**
     * The exit animation is a VARIANT taking `custom`, not a plain object, and
     * that is load-bearing. AnimatePresence renders the leaving child from the
     * previous render tree, so a plain `exit={{…}}` built from the grade you
     * just pressed would animate with the PREVIOUS grade — every throw one
     * card behind. `custom` on AnimatePresence is re-read at exit time, which
     * is the whole reason the hook exists.
     */
    const leaving = { grade, j, el: tableRef };
    const variants = {
        enter: reduce ? { opacity: 0 }
            // Out of the draw pile, off to the left — not out of nowhere.
            : { opacity: 0, x: -215, y: -34, rotate: -15, scale: 0.45 },
        center: reduce ? { opacity: 1 }
            : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
        exit: (c) => {
            if (reduce) return { opacity: 0 };
            if (!FILED.has(c.grade)) {
                // Thrown off the table. It isn't landing on anything, so it
                // only needs the card's own size to scale the throw by.
                const a = AWAY[c.grade] || AWAY[1];
                const box = c.el?.current?.getBoundingClientRect();
                const w = box?.width || 340, h = box?.height || 480;
                return {
                    opacity: [1, 1, 0], x: w * a.fx, y: roomBelow(box, h, a),
                    rotate: a.rotate + c.j.rot, scale: a.scale,
                    transition: {
                        duration: a.dur, ease: [0.36, 0, 0.7, 0.4],
                        opacity: { duration: a.dur, times: [0, 0.5, 1], ease: "linear" },
                    },
                };
            }
            const land = landingFor(c.el?.current);
            // No pile to aim at (a layout we didn't foresee) — a plain toss to
            // the right is still better than snapping out of existence.
            if (!land) {
                return {
                    opacity: 0, x: 180, y: -20, rotate: c.j.rot, scale: 0.42,
                    transition: { duration: FILE_MS / 1000 },
                };
            }
            return {
                // Held at full opacity almost the whole way, so you SEE it land.
                opacity: [1, 1, 0],
                x: land.x, y: land.y, scale: land.scale,
                // A card thrown onto a pile lands askew, never square.
                rotate: c.j.rot * 0.9,
                transition: {
                    duration: FILE_MS / 1000,
                    // Fast out of the hand, easing into the landing.
                    ease: [0.16, 0.72, 0.24, 1],
                    opacity: { duration: FILE_MS / 1000, times: [0, 0.82, 1], ease: "linear" },
                },
            };
        },
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
                    <div>
                        <Count n={done} label="done" className="!text-right" />
                        {returning > 0 && (
                            <p className="text-[10px] text-muted-foreground/70 text-right leading-tight">
                                {returning} coming back
                            </p>
                        )}
                    </div>
                    <Pile data-discard-pile count={done} tone={tone} h={STRIP_H} spent
                        glow={flash ? gradeTone : null} />
                </div>
            </div>

            <div className="flex items-center justify-center gap-3 md:gap-8">
                {/* Draw pile */}
                <div className="hidden sm:flex flex-col items-center gap-2 flex-shrink-0">
                    <Pile count={inDeck} tone={tone} h={PILE_H} />
                    <Count n={inDeck} label="to go" />
                </div>

                <div className="flex flex-col items-center gap-3 min-w-0">
                    {/* The badge slot is reserved whether or not there's a
                        badge in it. Letting it collapse moved the card — and
                        therefore the piles, which are centred against it — by
                        about twenty pixels every time a weak-spot card was
                        followed by an ordinary one. */}
                    <div className="h-6 flex items-center">{badge}</div>
                    {/* The flying card leaves this box and crosses the piles,
                        so it has to sit above them. */}
                    <div
                        ref={tableRef}
                        className="relative flex-shrink-0 max-w-[88vw] z-20"
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

                              {/* The card turns face-down as it leaves, so it
                                  arrives on the pile as one of the pile rather
                                  than as a shrunken page of text sitting on
                                  top of it. Landing a face on a stack of backs
                                  was the one thing that gave the flick away.

                                  It rides the parent's variant labels — which
                                  works precisely because this has `variants`
                                  and no `animate` of its own. */}
                              {!reduce && (
                                  <motion.div
                                      data-card-turning
                                      className="absolute inset-0 pointer-events-none"
                                      variants={{
                                          enter: { opacity: 0 },
                                          center: { opacity: 0 },
                                          exit: {
                                              opacity: [0, 1, 1],
                                              transition: { duration: 0.3, times: [0, 0.45, 1] },
                                          },
                                      }}
                                  >
                                      <CardBack tone={tone} className="w-full h-full" />
                                  </motion.div>
                              )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* The finished pile. Only cards you actually recalled land
                    here — see FILED. */}
                <div className="hidden sm:flex flex-col items-center gap-2 flex-shrink-0">
                    <Pile data-discard-pile count={done} tone={tone} h={PILE_H} spent
                        glow={flash ? gradeTone : null} />
                    <Count n={done} label="done" />
                    {returning > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 text-center leading-tight -mt-1.5">
                            {returning} coming back
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
