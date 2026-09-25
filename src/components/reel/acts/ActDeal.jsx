/**
 * Act I — DEAL IN. The first gesture on the site, and it is a question.
 *
 * THE OPENING BEAT OF A LANDING PAGE IS NORMALLY A CLAIM. This one is a deal:
 * three cards face down, pick the one that is you, and it turns over carrying a
 * number about YOUR year that you did not know when you arrived and can check
 * against a calendar. Nothing is asserted about AcedIt at all — the first thing
 * this app ever does for a student is tell them something true.
 *
 * AND THE ANSWER IS KEPT. This is the wizard's year question, asked at beat one
 * instead of on a grey screen four minutes later, which is most of what makes
 * the two halves of this reel read as one sitting. See lib/reel's manifest note
 * on why there is deliberately no second year step.
 *
 * TWO RENDERING RULES, both learned the hard way in this codebase and both
 * live here:
 *
 *   PERSPECTIVE GOES ON THE PARENT. An element cannot supply its own vanishing
 *   point; on the child a rotateY reads as a flat horizontal squash rather than
 *   as a card turning over.
 *
 *   HOVER DETECTION NEVER GOES ON THE ELEMENT THAT ROTATES. As a card turns
 *   through 90° its projected width collapses to nothing, so a stationary
 *   pointer falls outside its own hit box: pointerleave fires, it turns back,
 *   the box widens, pointerenter fires, forever. Holding the mouse still makes
 *   it oscillate. The handlers sit on the static wrapper; only the inner
 *   element rotates.
 */
import React, { useState, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CardBack } from "@/components/cards/PlayingCard";
import { weeksUntilExams } from "@/lib/reel";
import { useAct } from "@/components/reel/ReelContext";
import Cue from "@/components/reel/Cue";

/**
 * Three, and they are the three that change the answer.
 *
 * Not a dropdown of seven year levels: the exam date this pays out only has
 * three distinct values, so a longer list would be a longer question with no
 * more information in it. "Year 10 & under" is one card because the payout for
 * all of them is the end of the school year.
 */
const YEARS = [
    { value: "Year 10 or below", short: "Year 10\n& under", tone: "#1CB0F6" },
    { value: "Year 11",          short: "Year 11",          tone: "#FFC800" },
    { value: "Year 12",          short: "Year 12",          tone: "#58CC02" },
];

const INK = "#0D1626";

export default function ActDeal({ onYear }) {
    const { advance, deal } = useAct("deal");
    const reduce = useReducedMotion();
    const [picked, setPicked] = useState(null);
    const [hovered, setHovered] = useState(null);
    // The pick arrives in the same tick that the payout is computed, so a
    // state read here would be one render behind — the trap
    // `startFromSuggestion` already records. The ref is the current answer.
    const answered = useRef(false);

    const pick = (y) => {
        if (answered.current && picked?.value === y.value) return;
        answered.current = true;
        const { weeks, label } = weeksUntilExams(y.value);
        setPicked({ ...y, weeks, label });
        deal({ weeks, weeksLabel: label, yearLevel: y.value });
        onYear?.(y.value);
    };

    return (
        <div className="w-full flex flex-col items-center text-center" style={{ color: INK }}>
            <motion.p
                className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase opacity-45"
                initial={{ opacity: 0 }} animate={{ opacity: 0.45 }} transition={{ delay: 0.15 }}
            >
                AcedIt &middot; VCE
            </motion.p>

            <h1 className="mt-4 font-display font-black leading-[0.95] tracking-tight
                           text-[13vw] sm:text-[8vw] lg:text-[5.4rem]">
                You are closer than
                <br />
                <span className="text-primary">you think.</span>
            </h1>

            {/* The question, not a subhead. A landing page's first paragraph is
                normally a claim nobody reads; this one is the only thing on
                screen asking for something. */}
            <p className="mt-5 text-base sm:text-xl font-bold opacity-70 max-w-xl">
                {picked ? "Here is what that actually means." : "Pick your year. We will tell you something true."}
            </p>

            {/* perspective on the PARENT — see the header. */}
            <div className="mt-9 sm:mt-11 flex items-end justify-center gap-3 sm:gap-6"
                 style={{ perspective: 1200 }}>
                {YEARS.map((y, i) => {
                    const isPicked = picked?.value === y.value;
                    const dimmed = picked && !isPicked;
                    return (
                        <div
                            key={y.value}
                            /* STATIC WRAPPER holds the pointer handlers. */
                            onPointerEnter={() => setHovered(y.value)}
                            onPointerLeave={() => setHovered(null)}
                            className="flex flex-col items-center"
                        >
                            <motion.button
                                type="button"
                                onClick={() => pick(y)}
                                aria-label={`I am in ${y.value}`}
                                aria-pressed={isPicked}
                                className="relative cursor-pointer rounded-xl focus-visible:outline-offset-4"
                                style={{ transformStyle: "preserve-3d" }}
                                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 90, rotate: -18 }}
                                animate={{
                                    opacity: dimmed ? 0.3 : 1,
                                    y: hovered === y.value && !picked ? -14 : 0,
                                    rotate: reduce ? 0 : (i - 1) * 7,
                                    rotateY: isPicked ? 180 : 0,
                                    scale: isPicked ? 1.06 : 1,
                                }}
                                transition={{
                                    // The DEAL is a spring; the FLIP is a fixed
                                    // tween. Sharing one spring across both is
                                    // what made MovePreview's card wobble —
                                    // re-entering the animation with velocity
                                    // still on rotate.
                                    rotateY: { duration: reduce ? 0 : 0.5, ease: [0.4, 0, 0.2, 1] },
                                    default: reduce
                                        ? { duration: 0.2, delay: i * 0.05 }
                                        : { type: "spring", stiffness: 150, damping: 17, delay: 0.25 + i * 0.12 },
                                }}
                            >
                                {/* BACK of the card — what you see first. */}
                                <div style={{ backfaceVisibility: "hidden" }}>
                                    <CardBack
                                        tone={y.tone}
                                        className="w-[84px] h-[118px] sm:w-[124px] sm:h-[174px] rounded-xl
                                                   shadow-[0_18px_40px_-18px_rgba(13,22,38,0.55)]"
                                    />
                                </div>
                                {/* FACE — the payout, pre-rotated so it reads
                                    the right way round once the card turns. */}
                                <div
                                    className="absolute inset-0 rounded-xl bg-white border-2 flex flex-col
                                               items-center justify-center px-2"
                                    style={{
                                        backfaceVisibility: "hidden",
                                        transform: "rotateY(180deg)",
                                        borderColor: y.tone,
                                        boxShadow: "0 18px 40px -18px rgba(13,22,38,0.55)",
                                    }}
                                >
                                    <span className="font-display font-black tabular-nums leading-none
                                                     text-[30px] sm:text-[44px]" style={{ color: y.tone }}>
                                        {picked?.weeks ?? ""}
                                    </span>
                                    <span className="mt-1 text-[9px] sm:text-[11px] font-black uppercase tracking-wider opacity-60">
                                        weeks
                                    </span>
                                </div>
                            </motion.button>

                            <span className={`mt-3 text-[11px] sm:text-sm font-black whitespace-pre-line leading-tight
                                              transition-opacity ${dimmed ? "opacity-30" : "opacity-75"}`}>
                                {y.short}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* The payout line. It appears only once there is one — no slot, no
                dash, nothing reserving space for a fact that does not exist. */}
            <motion.div
                className="mt-7 h-7"
                initial={false}
                animate={{ opacity: picked ? 1 : 0, y: picked ? 0 : 8 }}
                transition={{ duration: 0.35, delay: picked ? 0.35 : 0 }}
            >
                {picked && (
                    <p className="text-sm sm:text-lg font-bold">
                        <span className="text-primary font-black">{picked.weeks} weeks</span>{" "}
                        <span className="opacity-65">{picked.label}.</span>
                    </p>
                )}
            </motion.div>

            <Cue done={!!picked} onAdvance={advance} nextLabel="So what happens to what you study?" ink={INK}>
                Pick a card
            </Cue>
        </div>
    );
}
