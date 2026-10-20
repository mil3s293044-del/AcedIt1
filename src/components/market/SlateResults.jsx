/**
 * SlateResults — Sunday night, turned over.
 *
 * ─── THE WEEK HAS AN ENDING NOW ─────────────────────────────────────────────
 * The floor used to settle one market at a time, each as a line on the tape
 * and a card in the settlement reveal. That is right for a question you
 * happened to call and wrong for the slate, which everybody called together:
 * a shared card deserves a shared ending, and the ending is the part of a
 * competition people come back for.
 *
 * Three beats, in the order the questions get asked:
 *   1. THE CARDS TURN OVER, one at a time — each question's answer, your call
 *      on it and what it was worth. Turned in sequence because that is how a
 *      result is read: question by question, with the total arriving last.
 *   2. THE PODIUM DEALS — the three best reads in the room, off the board kit's
 *      own `CardPodium`, so the floor's podium and Ranked's are one object.
 *   3. YOUR LINE — your read points, how many in the room you finished ahead
 *      of (a band, never a position), and the season bar moving.
 *
 * ─── IT LEADS WITH THE READ, NOT THE CREDITS ────────────────────────────────
 * Nothing on this screen is money. Points are how much better than the room
 * you called it, and the credits each call returned were already paid into
 * the balance at settlement. A results screen that led with a payout would be
 * the slot machine the settlement reveal was written not to be.
 *
 * ─── A LOSS DOES NOT PERFORM ────────────────────────────────────────────────
 * A week below zero gets the same cards turned at the same pace — the reads
 * are information, and hiding them would be less kind rather than more — but
 * no podium flourish is pointed at them and nothing counts up. Under reduced
 * motion everything is simply placed.
 *
 * Shown once per device per week (`slateResultsDue`), marked seen on arrival.
 */
import React, { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { CardBack } from "@/components/cards/PlayingCard";
import CardPodium from "@/components/boards/CardPodium";
import { DivisionMark } from "./SeasonStrip";
import { divisionOf } from "@/lib/slate";
import { claimAce } from "@/components/ace/useAceYield";

const TURN_AT = 0.45;
const TURN_EACH = 0.32;

function ResultCard({ card, i, still }) {
    const delay = still ? 0 : TURN_AT + i * TURN_EACH;
    const pts = card.calls.length ? card.points : null;
    return (
        <div className="relative aspect-[4/5]" style={{ perspective: 900 }}>
            <motion.div className="absolute inset-0"
                style={{ transformStyle: "preserve-3d" }}
                initial={still ? false : { rotateY: 0 }}
                animate={{ rotateY: 180 }}
                transition={{ duration: still ? 0 : 0.5, delay, ease: [0.4, 0, 0.2, 1] }}>
                <span className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                    <CardBack skin={null} ink="var(--floor-edge-strong)" soft="var(--floor-well)"
                        flat className="w-full h-full" />
                </span>
                <span className="absolute inset-0 rounded-[0.9rem] border-2 border-[var(--floor-edge)]
                    bg-[var(--floor-card)] p-2.5 flex flex-col justify-between gap-1"
                    style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}>
                    <span className="text-[11px] font-bold leading-snug text-[var(--floor-muted-2)] line-clamp-3">
                        {card.title}
                    </span>
                    {/* The answer is the face: it is what the card turned over
                        to show, so it is the largest thing on it. */}
                    <span className="min-w-0">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-[var(--floor-dim)]">
                            {card.void ? "Voided" : "Answer"}
                        </span>
                        <span className="block font-display font-black text-lg leading-tight text-[var(--floor-ink)] truncate">
                            {card.void ? "Not called" : card.answer || "—"}
                        </span>
                    </span>
                    <span className="flex items-baseline justify-between gap-1 border-t border-[var(--floor-edge)] pt-1.5">
                        <span className="text-[10px] text-[var(--floor-muted-2)] truncate">
                            {card.calls.length ? `You: ${card.calls.map((c) => c.pick).join(", ")}` : "No call"}
                        </span>
                        {pts !== null && (
                            <span className={`font-display font-black text-[14px] tabular-nums
                                ${pts > 0 ? "text-[var(--floor-yes-ink)]" : pts < 0 ? "text-[var(--floor-no-ink)]" : "text-[var(--floor-muted-2)]"}`}>
                                {pts > 0 ? "+" : ""}{pts}
                            </span>
                        )}
                    </span>
                </span>
            </motion.div>
        </div>
    );
}

export default function SlateResults({ results, season, onClose, onSeen }) {
    const reduce = useReducedMotion();
    useEffect(() => { onSeen?.(results?.week); }, [results?.week, onSeen]);
    // Nobody stands in the corner over the scrim. See ACE_ORDER's "results".
    useEffect(() => claimAce("results"), []);
    if (!results) return null;

    const cards = results.cards || [];
    const cardsEnd = reduce ? 0 : TURN_AT + cards.length * TURN_EACH + 0.4;
    const mine = results.me;
    const div = divisionOf(season?.points ?? 0);
    const lost = mine && mine.points < 0;
    const podium = (results.podium || []).map((p) => ({
        key: `${p.place}-${p.name}`, name: p.name, isMe: !!p.is_me,
        figure: { value: p.points, format: (v) => `+${Math.round(v)}`, quantity: "read points" },
        reward: `${p.calls} ${p.calls === 1 ? "call" : "calls"}`,
    }));

    return (
        <motion.div data-slate-results
            className="fixed inset-0 z-[120] overflow-y-auto p-4 sm:p-8"
            style={{ background: "var(--floor-scrim)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="max-w-3xl mx-auto rounded-3xl border-2 border-[var(--floor-edge)]
                bg-[var(--floor-ground)] p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]">
                            Last week&apos;s slate
                        </p>
                        <h2 className="font-display font-black text-[var(--floor-ink)] text-2xl leading-tight">
                            {mine
                                ? (mine.points > 0 ? "You read the room" : mine.points === 0 ? "Level with the room" : "The room had this one")
                                : "How the slate landed"}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="rounded-lg p-1.5 text-[var(--floor-muted-2)] hover:text-[var(--floor-ink)]">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── 1. The cards turn over ─────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {cards.map((c, i) => <ResultCard key={c.id} card={c} i={i} still={reduce} />)}
                </div>

                {/* ── 2. The podium deals ────────────────────────────── */}
                {podium.length > 0 && (
                    <motion.div className="mt-6"
                        initial={reduce ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: cardsEnd, duration: 0.4 }}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)] mb-2">
                            Best reads in the room
                        </p>
                        <CardPodium entries={podium} size="sm" layoutScope="slate" label="Best reads last week" />
                    </motion.div>
                )}

                {/* ── 3. Your line ───────────────────────────────────── */}
                <motion.div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-[var(--floor-card)]
                    border-2 border-[var(--floor-edge)] p-4"
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: cardsEnd + (podium.length ? 0.9 : 0.2), duration: 0.4 }}>
                    <DivisionMark division={div.id} size={44} />
                    <div className="min-w-0 flex-1">
                        {mine ? (
                            <>
                                <p className="font-display font-black text-[var(--floor-ink)] text-lg leading-tight">
                                    <span className={lost ? "text-[var(--floor-no-ink)]" : "text-[var(--floor-yes-ink)]"}>
                                        {mine.points > 0 ? "+" : ""}{mine.points}
                                    </span>{" "}read points from {mine.calls} {mine.calls === 1 ? "call" : "calls"}
                                </p>
                                <p className="text-[12px] text-[var(--floor-muted-2)]">
                                    {mine.ahead === null || mine.ahead === undefined
                                        ? "Nobody else called the slate."
                                        : `Ahead of ${mine.ahead}% of the ${results.entrants - 1} others who called it.`}
                                    {" "}You&apos;re {div.label} this season
                                    {div.next ? `, ${div.toNext} from ${div.next.label}.` : "."}
                                </p>
                            </>
                        ) : (
                            <p className="text-[13px] text-[var(--floor-muted)]">
                                You didn&apos;t call last week&apos;s slate. This week&apos;s is open now.
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose}
                        className="rounded-xl bg-[var(--floor-solid)] text-[var(--floor-on-solid)] px-4 py-2.5
                            font-display font-black text-sm">
                        This week&apos;s slate
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}
