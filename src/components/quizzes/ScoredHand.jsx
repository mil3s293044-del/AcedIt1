/**
 * ScoredHand — the moment after marking: the questions you played, turned over.
 *
 * The results used to open on a star in a tinted tile, "71%", and under it
 * "2 RIGHT · 4 TOTAL" — a percentage of MARKS above a count of QUESTIONS, so a
 * four-mark answer that earned three read as "wrong" directly under a figure
 * that had counted the three. And none of it looked like the table the student
 * had just spent ten minutes at.
 *
 * So the hand comes back. Every question is the card it was dealt as during
 * the sit (the same rank in the corner, the same suit), laid face down on the
 * felt and turned over one at a time. Each card says what it earned under it,
 * and the total counts up AS THE CARDS TURN — the number is the cards being
 * added, never a figure animating on its own. Then, if the sit beat the best,
 * the quiz's own deck card turns to its new rank, because rank is your best
 * and that card is sitting on the shelf you are about to go back to.
 *
 * ─── WHAT A CARD SAYS (`cardState` in quizSit.js) ───────────────────────────
 *   full     every mark                                ✓ green
 *   part     dropped a mark or two, above the drill line  − amber
 *   missed   under the drill line: what "Redo" re-asks  ✕ red
 *   pending  written work still with the marker         face down
 * SHAPE CARRIES IT TOO — a tick, a dash, a cross — because the brand green and
 * the streak red sit at ΔE 7 under deuteranopia, the floor's step-dot lesson.
 *
 * A written answer the marker has not returned STAYS FACE DOWN and adds
 * nothing to the total. It is not a zero, and a card turned over to show 0/3
 * before anybody has read it would be the screen marking the student itself.
 * When the marks land, those cards turn.
 *
 * ─── PREMIUM BUT CALM ───────────────────────────────────────────────────────
 * One deal, one turn per card, capped however long the paper (`handTiming`),
 * then nothing moves. Under reduced motion every card is simply face up and
 * every figure printed whole. The felt is the podium's table held still, in
 * literal ink in both themes; card stock is white in both.
 *
 * Each card is a button: tapping it opens that question's marking.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Minus, X } from "lucide-react";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import { rankAt, aRank } from "@/components/cards/cardIdentity";
import { handTiming, marksShown, HAND } from "@/lib/quizSit";

// Literal ink: the felt is literal in both themes, so tokens would flip on it.
const STATE = {
    full: { ring: "ring-[#7BE03A]", text: "text-[#9BEA6A]", Icon: Check, word: "full marks" },
    part: { ring: "ring-[#F6C454]", text: "text-[#F6C454]", Icon: Minus, word: "dropped marks" },
    missed: { ring: "ring-[#FF8A7A]", text: "text-[#FF9C8F]", Icon: X, word: "to redo" },
    pending: { ring: "ring-white/20", text: "text-white/55", Icon: null, word: "with the marker" },
};

// A paper of thirty questions still fits: the cards shrink as the hand grows.
const CARD_W = (n) => (n <= 6 ? "w-14 sm:w-[4.5rem]" : n <= 12 ? "w-12 sm:w-14" : "w-10 sm:w-12");

function HandCard({ card, suit, tone, deal, reduce, turnDelay, onTurned, onOpen, size }) {
    const up = card.state !== "pending";
    const look = STATE[card.state];
    const Icon = look.Icon;
    return (
        <button type="button" onClick={() => onOpen?.(card.index)} data-hand-card={card.state}
            aria-label={`Question ${card.index + 1}: ${up ? `${card.auto} of ${card.outOf} marks, ${look.word}` : "still being marked"}`}
            className="flex flex-col items-center gap-1.5 group focus:outline-none">
            <motion.div className={`${size} aspect-[2.5/3.5] relative rounded-[0.6rem]
                    ring-2 ring-offset-2 ring-offset-[#0D1626] ${look.ring} transition-shadow`}
                style={{ perspective: 700 }}
                initial={deal ? { opacity: 0, y: -26, rotate: -6 } : false}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22, delay: deal ? deal.at : 0 }}
                whileHover={reduce ? undefined : { y: -3 }}>
                <motion.div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}
                    initial={reduce ? false : { rotateY: 180 }}
                    animate={{ rotateY: up ? 0 : 180 }}
                    transition={{ duration: HAND.turn, ease: "easeInOut", delay: up ? turnDelay : 0 }}
                    onAnimationComplete={() => { if (up) onTurned(card.index); }}>
                    <div className="absolute inset-0 theme-locked-light" style={{ backfaceVisibility: "hidden" }}>
                        <PlayingCard rank={rankAt(card.index + 1)} suit={suit} tone={tone} pips
                            smallIndices watermark={false} className="w-full h-full" />
                    </div>
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        <CardBack className="w-full h-full" />
                    </div>
                </motion.div>
            </motion.div>
            <span className={`flex items-center gap-0.5 text-[11px] font-bold tabular-nums leading-none ${look.text}`}>
                {up ? (
                    <motion.span className="inline-flex items-center gap-0.5"
                        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: turnDelay + HAND.turn * 0.6 }}>
                        {Icon && <Icon className="w-3 h-3" strokeWidth={3} aria-hidden="true" />}
                        {card.auto}/{card.outOf}
                    </motion.span>
                ) : (
                    <span className="animate-pulse">···</span>
                )}
            </span>
        </button>
    );
}

/** The quiz's own deck card, turning from its old rank to the one this sit earned. */
function DeckTurn({ turn, suit, tone, delay, reduce, score, previousBest }) {
    const line = turn.first
        ? `First sit. This quiz's card is ${aRank(turn.to)} now.`
        : turn.turned
            ? `New best, up from ${aRank(turn.from)} to ${aRank(turn.to)}.`
            : `New best — ${score}%, up from ${Math.round(previousBest)}%.`;
    return (
        <motion.div data-deck-turn={turn.turned ? "turned" : "best"}
            initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className="flex items-center gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="w-10 sm:w-11 aspect-[2.5/3.5] flex-shrink-0" style={{ perspective: 600 }} aria-hidden="true">
                <motion.div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}
                    initial={reduce || !turn.turned ? false : { rotateY: 180 }} animate={{ rotateY: 0 }}
                    transition={{ duration: 0.6, ease: "easeInOut", delay: delay + 0.25 }}>
                    <div className="absolute inset-0 theme-locked-light" style={{ backfaceVisibility: "hidden" }}>
                        <PlayingCard rank={turn.to} suit={suit} tone={tone} pips smallIndices watermark={false}
                            className="w-full h-full" />
                    </div>
                    <div className="absolute inset-0 theme-locked-light" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        <PlayingCard rank={turn.from} suit={suit} tone={tone} pips smallIndices watermark={false}
                            className="w-full h-full" />
                    </div>
                </motion.div>
            </div>
            <p className="text-sm font-bold text-[#F4F1EA] leading-snug">{line}</p>
        </motion.div>
    );
}

export default function ScoredHand({
    hand = [], total, suit = "spade", tone, marking = false, elapsed = null,
    turn = null, previousBest = null, onOpen, footnote = null,
}) {
    const reduce = useReducedMotion();
    const timing = useMemo(() => handTiming(hand.length), [hand.length]);
    // Cards face up when the hand first lands turn on the reveal's clock; any
    // that turn LATER (the marker came back) turn together, a beat apart.
    const firstUp = useRef(null);
    if (firstUp.current === null) firstUp.current = new Set(hand.filter((c) => c.state !== "pending").map((c) => c.index));
    const [turnedState, setTurned] = useState(() => new Set());
    const onTurned = (i) => setTurned((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    // Under reduced motion nothing turns, so everything marked is simply up —
    // derived, not stored, or a fresh Set per render would re-render forever.
    const turned = reduce ? new Set(hand.filter((c) => c.state !== "pending").map((c) => c.index)) : turnedState;

    // THE COUNT IS THE CARDS: only a card that has finished turning adds.
    const shownMarks = marksShown(hand, turned);
    const allIn = hand.every((c) => c.state === "pending" || turned.has(c.index));
    const late = hand.filter((c) => c.state !== "pending" && !firstUp.current.has(c.index)).map((c) => c.index);
    const size = CARD_W(hand.length);
    const finished = total && total.pending === 0 && !marking;

    return (
        <section data-scored-hand aria-label="Your marks, question by question"
            className="onb-felt felt-still rounded-3xl px-4 sm:px-7 pt-5 sm:pt-6 pb-5">
            <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-3 sm:gap-x-3">
                {hand.map((card) => (
                    <HandCard key={card.index} card={card} suit={suit} tone={tone} size={size} reduce={reduce}
                        deal={reduce ? null : { at: timing.dealAt(card.index) }}
                        turnDelay={firstUp.current.has(card.index) ? timing.turnAt(card.index) : 0.15 + late.indexOf(card.index) * 0.12}
                        onTurned={onTurned} onOpen={onOpen} />
                ))}
            </div>

            {/* ── The total, in MARKS ──────────────────────────────────────── */}
            <div className="mt-5 flex items-end justify-center gap-6 sm:gap-10 text-center">
                <div>
                    <p className="font-display font-black leading-none text-[#F4F1EA] tabular-nums">
                        <span className="text-4xl sm:text-5xl" data-marks-shown={shownMarks}>{shownMarks}</span>
                        <span className="text-lg sm:text-xl text-white/55 font-extrabold">
                            {" "}of {total ? total.outOf + total.pendingMarks : 0}
                        </span>
                    </p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/55 mt-1.5">marks</p>
                </div>
                <div>
                    <p className="font-display font-black text-3xl sm:text-4xl leading-none text-[#F6C454] tabular-nums">
                        {finished && allIn && total.pct != null ? `${total.pct}%` : "—"}
                    </p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/55 mt-1.5">score</p>
                </div>
                {elapsed && (
                    <div>
                        <p className="font-display font-black text-2xl sm:text-3xl leading-none text-white/80 tabular-nums">{elapsed}</p>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-white/55 mt-1.5">time</p>
                    </div>
                )}
            </div>

            {(marking || footnote) && (
                <p className="mt-3 text-center text-xs text-white/60" data-hand-note>
                    {marking ? `Marking your written answers — ${total?.pendingMarks ?? 0} marks to come.` : footnote}
                </p>
            )}

            {turn && finished && (
                <DeckTurn turn={turn} suit={suit} tone={tone} reduce={reduce}
                    delay={reduce ? 0 : timing.doneAt + 0.2} score={total.pct} previousBest={previousBest} />
            )}
        </section>
    );
}
