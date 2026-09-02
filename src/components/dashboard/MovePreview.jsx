/**
 * MovePreview — the day's move as a card off the deck, showing the actual work.
 *
 * ─── What this fixes about the version before it ────────────────────────────
 * The hero has been through two shapes and each got half of it right.
 *
 * The dealt PLAYING CARD was right that the hero should be an object rather
 * than a notification bar, and its rank was a genuinely good idea — an Ace for
 * a deadline, a Jack for "not started". What it could not justify was its
 * FACE: an icon in a rounded square and the move's label, which is the
 * headline beside it, restated in the largest element on the page.
 *
 * The BRAIN carried real information and none of it was about the work. It
 * told a student which systems the move leans on, which is interesting once
 * and then never again on a screen they open every morning.
 *
 * So the card is back and its face is the ACTUAL FIRST THING THEY WOULD FACE.
 * The real question off their own deck. The real assessment title and the
 * days left. A clock counting the block they are about to commit to. Seeing
 * the work is a stronger reason to start than any description of it, and it is
 * the only content here that cannot be wrong — it is their own material.
 *
 * ─── Face down until they look ──────────────────────────────────────────────
 * It arrives face down and turns over on hover, tap or keyboard focus. That is
 * not decoration: a card you turn over is the smallest possible commitment,
 * and the flip is the same motion the review deck and the quiz table already
 * use, so it is the third time a student sees it and the first on their own
 * work.
 *
 * ─── Never invent a face ────────────────────────────────────────────────────
 * With no preview to show — a move we have no material for, an empty deck —
 * the card turns over to the move's label and icon, which is exactly what the
 * old one did. That is the floor, not the target: a face-down card that turns
 * over to nothing would be a promise the panel then breaks.
 */
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import MarkdownMath from "@/components/shared/MarkdownMath";

/** How many backs sit under the dealt card. Enough to read as a deck. */
const DEPTH = 3;
const STEP = 4;

export default function MovePreview({ move, card, theme, preview }) {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);
    const Icon = move.icon;
    const turned = open || reduce;

    return (
        <div className="relative flex-shrink-0 mx-auto lg:mx-0"
            style={{ width: 176, height: 232 }}>
            {/* THE POSITIONING IS ON A WRAPPER, not on CardBack. CardBack's own
                class list opens with `relative`, and Tailwind emits position
                utilities in a fixed order where `relative` comes after
                `absolute` — so an `absolute` handed in through className loses,
                every back stays in normal flow, and the deck unstacks itself
                down the page. Same trap as the review pile and the hero hand. */}
            {Array.from({ length: DEPTH }, (_, k) => (
                <div key={k} className="absolute w-[132px]"
                    style={{
                        left: 8 - k * STEP, top: 26 - k * STEP,
                        transform: `rotate(${-7 - k * 1.6}deg)`,
                        zIndex: DEPTH - k,
                        opacity: 1 - k * 0.14,
                    }}>
                    <CardBack tone={card.tone} flat={k > 0} className="w-full aspect-[2.5/3.5]" />
                </div>
            ))}

            {/* TWO NESTED MOTION ELEMENTS, and that separation is the fix.
                The deal-in and the flip used to share one `animate` object on
                one spring: hovering re-entered the spring while it still had
                velocity from `rotate` and `scale`, so the card wobbled on its
                way over instead of turning. A spring is right for a card being
                dealt and wrong for a card being turned — a turn has a fixed
                arc and should take the same time every time.

                Outer: the deal, once, on a spring. Inner: the flip, on a
                tween, and nothing else animates with it.

                `perspective` lives here rather than on the rotating element,
                because an element cannot supply its own vanishing point — put
                it on the child and rotateY reads as a horizontal squash. */}
            <div className="absolute right-0 top-0 w-[152px]"
                style={{ zIndex: 20, perspective: 900 }}>
                <motion.div
                    initial={reduce ? { opacity: 0 } : {
                        opacity: 0, x: -40, y: 18, rotate: -24, scale: 0.86,
                    }}
                    animate={{ opacity: 1, x: 0, y: 0, rotate: 3.5, scale: 1 }}
                    transition={reduce ? { duration: 0.2 } : {
                        type: "spring", stiffness: 170, damping: 18, mass: 0.9, delay: 0.18,
                    }}
                >
                    <motion.button
                        type="button"
                        data-todays-play
                        aria-label={preview ? `${move.label}: turn the card over` : move.label}
                        aria-pressed={open}
                        onClick={() => setOpen((v) => !v)}
                        onPointerEnter={() => setOpen(true)}
                        onPointerLeave={() => setOpen(false)}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        className="block w-full cursor-pointer text-left
                            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
                            focus-visible:outline-ring rounded-xl"
                        style={{ transformStyle: "preserve-3d" }}
                        animate={{ rotateY: turned ? 180 : 0 }}
                        transition={reduce
                            ? { duration: 0 }
                            /* A tween, not a spring. Same 0.42s every time, no
                               overshoot, no dependence on where the previous
                               animation left off — which is what made a fast
                               hover-out-hover-in stutter. */
                            : { duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
                    >
                {/* Both faces are mounted and one is rotated behind the other,
                    so the flip is a real turn rather than a crossfade between
                    two elements that happen to swap. `backfaceVisibility`
                    hides whichever is facing away. */}
                <span className="block" style={{ backfaceVisibility: "hidden" }}>
                    <CardBack tone={card.tone} className="w-full aspect-[2.5/3.5]" />
                </span>
                <span className="absolute inset-0"
                    style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}>
                    <PlayingCard rank={card.rank} suit={card.suit} tone={card.tone}
                        smallIndices watermark={false} pips="faint"
                        className="w-full h-full">
                        {preview ? (
                            <span className="absolute inset-0 flex flex-col justify-center
                                gap-1.5 px-3.5 text-left">
                                <span className="stat-label text-[9px] leading-tight">{preview.label}</span>
                                {/* Clamped hard. A card is a card: three lines
                                    of a long question is the right amount to
                                    make somebody want the rest of it. */}
                                <MarkdownMath className="text-[13px] font-bold text-foreground
                                    leading-snug line-clamp-4">
                                    {preview.body}
                                </MarkdownMath>
                                {preview.foot && (
                                    <span className="text-[10px] text-muted-foreground leading-tight">
                                        {preview.foot}
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span className="absolute inset-0 flex flex-col items-center
                                justify-center gap-2.5 px-3 text-center">
                                <span className={`w-12 h-12 rounded-xl ${theme.iconBg}
                                    flex items-center justify-center`}>
                                    <Icon className={`w-6 h-6 ${theme.iconText}`} />
                                </span>
                                <span className="stat-label leading-tight">{move.label}</span>
                            </span>
                        )}
                    </PlayingCard>
                </span>
                    </motion.button>
                </motion.div>
            </div>

            {/* Said out loud, because a card that only turns on hover is a card
                a touch user never learns turns at all. It goes when they have
                turned it once. */}
            {preview && !open && !reduce && (
                <p className="absolute -bottom-1 left-0 right-0 text-center text-[10px]
                    text-muted-foreground pointer-events-none">
                    Tap to see the first one
                </p>
            )}
        </div>
    );
}
