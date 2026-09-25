/**
 * Act VI — YOUR HAND. The turn, and the seam that is no longer there.
 *
 * THIS IS THE ONE MOMENT THE WHOLE REBUILD EXISTS FOR. The old page ended here
 * with a button that called `window.location.assign("/onboarding")` — a full
 * document reload: white flash, fresh boot, a new page with a grey segmented
 * progress bar on it. Ninety seconds of momentum, spent on a navigation.
 *
 * The button now calls `advance()`. It scrolls. The same table, the same hand,
 * the same film — and the next thing on screen is a question instead of a
 * claim. A student cannot tell where the marketing ended and the product
 * started, which is the correct answer to "where did the marketing end", since
 * everything they have been shown so far came out of the product anyway.
 *
 * THE HAND IS THE ARGUMENT. Not a feature list, not three testimonials: the
 * four or five things they have personally just been told, each of them true,
 * checkable, and about them. The close writes no new claim at all — it reads
 * back what already happened, which is the same refusal `closingFacts` makes
 * at the end of the first-win run and for the same reason. A student who has
 * been told five true things believes the sixth.
 *
 * WITH AN EMPTY HAND IT SAYS SOMETHING ELSE. A skimmer who scrolled past every
 * act arrives holding nothing, and fanning out zero cards under the words "this
 * is what you know now" would be the page talking to itself. They get the plain
 * invitation instead — which is all a landing page was ever going to give them.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useReel, useAct } from "@/components/reel/ReelContext";
import { TRIAL_DAYS } from "@/lib/reel";

const SUIT_GLYPH = { spade: "♠", heart: "♥", diamond: "♦", club: "♣" };
const INK = "#0D1626";

export default function ActHand({ onLogin }) {
    const { hand } = useReel();
    const { advance, played } = useAct("hand");
    const reduce = useReducedMotion();
    const has = hand.length > 0;

    return (
        <div className="w-full flex flex-col items-center text-center" style={{ color: INK }}>
            <p className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase opacity-45">
                Your hand
            </p>

            <h2 className="mt-3 font-display font-black leading-[1.02] tracking-tight
                           text-[9vw] sm:text-[4.6vw] lg:text-[3.4rem] max-w-3xl">
                {has ? (
                    <>Every card is true<br className="hidden sm:block" />{" "}
                        <span className="opacity-40">and none is about us.</span></>
                ) : (
                    <>Three questions.<br className="hidden sm:block" />{" "}
                        <span className="opacity-40">Then it is yours.</span></>
                )}
            </h2>

            {/* The fan. Large, once, and only if there is something in it. */}
            {has && (
                <div className="mt-10 flex items-end justify-center" style={{ perspective: 1000 }}>
                    {hand.map((c, i) => {
                        const mid = (hand.length - 1) / 2;
                        return (
                            <motion.div
                                key={c.id}
                                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, rotate: 0, x: 0 }}
                                animate={played
                                    ? {
                                        opacity: 1, y: Math.abs(i - mid) * 9,
                                        rotate: reduce ? 0 : (i - mid) * 8,
                                        x: (i - mid) * 4,
                                    }
                                    : { opacity: 0, y: 60 }}
                                transition={reduce
                                    ? { duration: 0.25, delay: i * 0.04 }
                                    : { type: "spring", stiffness: 180, damping: 19, delay: 0.1 + i * 0.09 }}
                                style={{
                                    transformOrigin: "50% 100%",
                                    marginLeft: i ? "-10px" : 0,
                                    zIndex: i,
                                    /* THE CARD'S OWN BORDER, the way HandRail
                                       draws it. This was a separate div pulled
                                       out with negative margins, which under
                                       the fan's rotation rendered as a
                                       detached diagonal line floating above
                                       each card. One way to draw this object,
                                       not two. */
                                    borderTopColor: c.tone,
                                    borderTopWidth: 4,
                                }}
                                className="w-[86px] sm:w-[118px] rounded-xl bg-white border border-black/10
                                           px-2.5 py-2 sm:px-3 sm:py-2.5 text-left
                                           shadow-[0_16px_34px_-16px_rgba(13,22,38,0.5)]"
                            >
                                <div className="flex items-center justify-between leading-none">
                                    <span className="text-[11px] font-black">{c.rank}</span>
                                    <span className="text-[10px]"
                                          style={{ color: c.suit === "heart" || c.suit === "diamond" ? "#D33" : INK }}>
                                        {SUIT_GLYPH[c.suit]}
                                    </span>
                                </div>
                                <div className="mt-1.5 text-[12px] sm:text-[15px] font-black leading-tight">
                                    {c.label}
                                </div>
                                <div className="mt-0.5 text-[8.5px] sm:text-[10px] font-semibold opacity-55 leading-tight">
                                    {c.note}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <p className="mt-9 text-sm sm:text-lg font-bold opacity-65 max-w-lg">
                {has
                    ? "Now three questions about you, and the app is set up for your subjects."
                    : "Tell us your subjects and what you are chasing. It takes about a minute."}
            </p>

            <motion.button
                type="button"
                onClick={advance}
                className="mt-7 inline-flex items-center gap-2.5 rounded-2xl bg-primary text-white
                           font-display font-black text-lg sm:text-2xl px-8 sm:px-11 py-4 sm:py-5
                           border-b-[5px] border-primary-dark shadow-pop cursor-pointer
                           active:translate-y-0.5 active:border-b-[3px] transition"
                whileHover={reduce ? undefined : { scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
            >
                Deal me in
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
            </motion.button>

            <p className="mt-4 text-xs sm:text-sm font-bold opacity-45">
                Free for {TRIAL_DAYS} days &middot; no card
            </p>

            <button
                type="button"
                onClick={onLogin}
                className="mt-6 text-sm font-bold opacity-55 hover:opacity-90 underline
                           underline-offset-4 cursor-pointer transition"
            >
                I already have an account
            </button>
        </div>
    );
}
