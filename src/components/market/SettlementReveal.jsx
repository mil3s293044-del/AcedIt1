/**
 * SettlementReveal — the moment a market answers you.
 *
 * ─── Why this has to exist ──────────────────────────────────────────────────
 * Everything else on the floor pays out visibly: the price moves while you
 * watch, the payout rolls as you drag. The one place with a REAL result was a
 * line on the tape. A market that resolves in a scrolling list is a receipt,
 * not a result, and a game whose only actual verdict arrives as small grey
 * text is a game nobody comes back for. The old Compete had exactly this hole
 * — a battle ending, weeks of work between four people, announced as a toast.
 *
 * ─── THE REVEAL IS THE TWO NUMBERS, NOT THE CRED ────────────────────────────
 * What makes this different from every other betting screen is that you were
 * scored against WHAT EVERYONE ELSE BELIEVED. So the centre of the card is
 * "you said 85, the room said 62" — and the cred is the consequence of that,
 * printed under it. Lead with the payout and it is a slot machine; lead with
 * the disagreement and it is a read you got right, which is the thing worth
 * being proud of and the thing that teaches somebody to do it again.
 *
 * `edgePoints` is absolute error rather than squared for exactly this reason:
 * a student can check it by subtracting two numbers both printed on the card.
 * Its sign can never disagree with the payout — market.test.mjs sweeps that.
 *
 * ─── A LOSS IS SHORT ────────────────────────────────────────────────────────
 * The win gets the confetti, the count-up and the stagger. A loss gets the
 * verdict, the number and a button. Drawing a defeat with the same ceremony is
 * the app enjoying it, and these are sixteen-year-olds losing in front of a
 * group. Carried over verbatim from the SettlementReveal this replaces,
 * because it was the one rule that version most got right.
 *
 * ─── It fires ONCE, and blocked storage counts as already-seen ──────────────
 * `unseenSettlements` owns the seen-set, so the rule lives with the model
 * rather than in a component somebody might later copy without it. The server
 * re-reports resolved markets forever — it has to, that is what `recent` is —
 * so without the guard opening the floor would replay a student's whole
 * history of losses at them, every time.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, X, Minus, RotateCcw } from "lucide-react";
import { YES } from "@/lib/market";

/** How loudly each outcome lands. A loss is deliberately the quiet one. */
const RITE = {
    won:   { confetti: 90, hold: 0, ink: "#58CC02", label: "You read it right" },
    lost:  { confetti: 0,  hold: 0, ink: "#FF5A5F", label: "The room had it" },
    level: { confetti: 0,  hold: 0, ink: "#8FA3BF", label: "You agreed with the room" },
    void:  { confetti: 0,  hold: 0, ink: "#8FA3BF", label: "Nothing was tested" },
};

const VERDICT = {
    won: Check, lost: X, level: Minus, void: RotateCcw,
};

/** Cred that counts up, because a number that appears has not been won. */
function CountUp({ value, className = "" }) {
    const reduce = useReducedMotion();
    const mv = useMotionValue(reduce ? value : 0);
    const spring = useSpring(mv, { stiffness: 60, damping: 18 });
    const [shown, setShown] = useState(reduce ? value : 0);
    useEffect(() => {
        if (reduce) { setShown(value); return undefined; }
        mv.set(value);
        return spring.on("change", (v) => setShown(Math.round(v)));
    }, [value, mv, spring, reduce]);
    return (
        <span className={`tabular-nums ${className}`}>
            {shown > 0 ? "+" : ""}{shown.toLocaleString()}
        </span>
    );
}

function Card({ item, remaining, onNext }) {
    const reduce = useReducedMotion();
    const rite = RITE[item.kind] || RITE.level;
    const Verdict = VERDICT[item.kind] || Minus;
    const fired = useRef(false);
    const won = item.kind === "won";
    // ── A LOSS DOES NOT PERFORM ──────────────────────────────────────────
    // The read stays on a loss — it is INFORMATION, and the one thing that
    // helps somebody call the next one better, so hiding it would be less kind
    // rather than more. What goes is the staging: a win reveals in steps, a
    // loss arrives all at once and waits to be dismissed. Ceremony on a defeat
    // is the app enjoying it, and these are sixteen-year-olds losing in front
    // of a group.
    const step = (t) => (reduce || !won ? 0 : t);

    useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        if (rite.confetti > 0 && !reduce) {
            confetti({
                particleCount: rite.confetti, spread: 70, startVelocity: 40,
                origin: { y: 0.6 },
                colors: ["#58CC02", "#1CB0F6", "#FFC800", "#E8F0FB"],
                disableForReducedMotion: true,
            });
        }
    }, [rite, reduce]);

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            style={{ background: "rgba(4, 8, 15, 0.86)" }}
            onClick={onNext}
        >
            <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: reduce ? 1 : 0.9, y: reduce ? 0 : 22, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="w-full max-w-sm rounded-3xl border-2 bg-[#121C2E] p-7 text-center"
                style={{ borderColor: `${rite.ink}66` }}
            >
                {/* The verdict stamps: overshoots and settles, the way a seal
                    lands. A fade would be the app apologising for the result. */}
                <motion.span
                    initial={{ scale: reduce ? 1 : 2, rotate: reduce ? 0 : -12, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 15, delay: step(0.06) }}
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border-2"
                    style={{ borderColor: `${rite.ink}66`, color: rite.ink, background: `${rite.ink}1A` }}
                >
                    <Verdict className="w-7 h-7" strokeWidth={3} />
                </motion.span>

                <p className="text-[10px] font-black uppercase tracking-widest mt-4"
                    style={{ color: rite.ink }}>
                    {rite.label}
                </p>

                <h2 className="font-display font-extrabold text-[#E8F0FB] text-base leading-snug mt-1.5">
                    {item.title}
                </h2>

                {item.kind === "void" ? (
                    <p className="text-[13px] text-[#8FA3BF] mt-3 leading-snug">
                        The question was never asked, so nobody was right.
                        Your {item.stake.toLocaleString()} cred is back.
                    </p>
                ) : (
                    <>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#4E6484] mt-3">
                            It resolved {item.outcome ? "YES" : "NO"}
                        </p>

                        {/* ── THE READ. The two numbers are the point ────────── */}
                        <motion.div
                            initial={{ opacity: 0, y: reduce || !won ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: step(0.24) }}
                            className="flex items-stretch gap-2 mt-4"
                        >
                            <div className="flex-1 rounded-xl bg-[#0E1929] py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#4E6484]">
                                    You said
                                </p>
                                <p className="font-display font-black text-2xl tabular-nums"
                                    style={{ color: rite.ink }}>
                                    {item.side === YES ? item.said : 100 - item.said}
                                    <span className="text-xs ml-0.5">
                                        {item.side === YES ? "¢ yes" : "¢ no"}
                                    </span>
                                </p>
                            </div>
                            <div className="flex-1 rounded-xl bg-[#0E1929] py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#4E6484]">
                                    The room
                                </p>
                                <p className="font-display font-black text-2xl text-[#8FA3BF] tabular-nums">
                                    {item.room}<span className="text-xs ml-0.5">¢</span>
                                </p>
                            </div>
                        </motion.div>

                        {/* One sentence, checkable by subtracting the two numbers
                            directly above it. "level" has no edge to state, so it
                            says the thing that is actually true instead. */}
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: step(0.34) }}
                            className="text-[12px] text-[#8FA3BF] mt-2.5 leading-snug"
                        >
                            {item.kind === "level"
                                ? "Restating the price pays nothing either way — that's what keeps the board honest."
                                : item.edge > 0
                                    ? `You read that ${item.edge} points closer than the room did.`
                                    : `The room read that ${Math.abs(item.edge)} points closer than you did.`}
                        </motion.p>

                        {/* The consequence, under the read rather than over it. */}
                        <motion.p
                            initial={{ opacity: 0, scale: reduce || !won ? 1 : 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: step(0.44), type: "spring", stiffness: 300, damping: 18 }}
                            className="font-display font-black text-4xl mt-5"
                            style={{ color: item.payout > 0 ? "#58CC02" : item.payout < 0 ? "#FF5A5F" : "#8FA3BF" }}
                        >
                            {won ? <CountUp value={item.payout} /> : (
                                <span className="tabular-nums">
                                    {item.payout > 0 ? "+" : ""}{item.payout.toLocaleString()}
                                </span>
                            )}
                            <span className="text-base font-bold text-[#4E6484] ml-1.5">cred</span>
                        </motion.p>

                        {/* Staged with the figure it annotates, or the footnote
                            lands before its own headline — visible at 250ms on
                            a win, where the number is still counting up and its
                            own caption is already sitting there. */}
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: step(0.52) }}
                            className="text-[11px] text-[#4E6484] mt-1 tabular-nums">
                            {item.returned.toLocaleString()} back from a {item.stake.toLocaleString()} stake
                        </motion.p>
                    </>
                )}

                <button type="button" onClick={onNext}
                    className="w-full mt-6 py-3 rounded-2xl bg-[#E8F0FB] text-[#0A121F]
                        font-display font-black text-sm hover:bg-white transition-colors">
                    {remaining > 0 ? `Next (${remaining} more)` : "Done"}
                </button>
            </motion.div>
        </motion.div>
    );
}

/**
 * Mount on the floor. Feed it resolved markets; it plays the ones this device
 * has not shown, quietest first, and remembers them.
 */
export default function SettlementReveal({ items = [], onSeen }) {
    const [queue, setQueue] = useState([]);
    const queued = useRef(new Set());

    useEffect(() => {
        const fresh = items.filter((s) => s && !queued.current.has(s.id));
        if (!fresh.length) return;
        // Marked seen on ARRIVAL, not on dismissal. A student who closes the
        // tab mid-run has still had the result put in front of them, and
        // re-running it on their next visit would be the replay this guards
        // against — the queue is a courtesy, the seen-set is the contract.
        fresh.forEach((s) => queued.current.add(s.id));
        onSeen?.(fresh.map((s) => s.id));
        setQueue((q) => [...q, ...fresh]);
    }, [items, onSeen]);

    const next = useCallback(() => setQueue((q) => q.slice(1)), []);
    const current = queue[0];
    const remaining = Math.max(0, queue.length - 1);

    return (
        <AnimatePresence mode="wait">
            {current && (
                <Card key={current.id} item={current} remaining={remaining} onNext={next} />
            )}
        </AnimatePresence>
    );
}
