/**
 * TakeSide — the gesture. Pick a side, say how sure, see what it pays.
 *
 * ─── Why a side and a strength, not a probability ───────────────────────────
 * "What probability do you assign to this?" is not a question a sixteen-year-
 * old answers, and a site that asks it has already lost them. "Do you think
 * yes or no, and how sure are you" is the same number arrived at by a route
 * anybody can walk — `probFor` collapses the two back into the one value the
 * scoring rule needs.
 *
 * ─── THE PAYOUT ROLLS, BECAUSE THE NUMBERS ARE THE FEEDBACK ─────────────────
 * Dragging conviction changes what you win and what you lose at the same time,
 * in opposite directions, and that trade-off is the entire decision. Swapped,
 * it has to be reconstructed from two remembered states; rolled, it is visible
 * as motion. Same argument `Odometer` on the old Compete made, kept because it
 * was the one thing on that page that genuinely worked.
 *
 * ─── AND IT SHOWS THE LOSS AS LOUDLY AS THE WIN ─────────────────────────────
 * A proper scoring rule is symmetric: confidence costs exactly what it pays.
 * Drawing only the upside would make the slider feel like a free dial and the
 * first settlement a betrayal. Both numbers, same size, side by side.
 */
import React, { useMemo, useState } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
    YES, NO, probFor, payoutFor, clampStake,
    STAKE_MIN, STAKE_MAX, CONVICTION_MIN, CONVICTION_MAX,
} from "@/lib/market";

/** A number that rolls rather than swaps. */
function Roll({ value, className = "" }) {
    const reduce = useReducedMotion();
    const mv = useMotionValue(value);
    const spring = useSpring(mv, { stiffness: 200, damping: 26 });
    const [shown, setShown] = useState(value);
    React.useEffect(() => {
        if (reduce) { setShown(value); return undefined; }
        mv.set(value);
        return spring.on("change", (v) => setShown(Math.round(v)));
    }, [value, mv, spring, reduce]);
    return (
        <span className={`tabular-nums ${className}`}>
            {shown > 0 ? "+" : ""}{shown}
        </span>
    );
}

const STAKES = [25, 50, 100, 250];

export default function TakeSide({ price, balance = 0, busy = false, onTake, onCancel }) {
    const [side, setSide] = useState(YES);
    const [conviction, setConviction] = useState(0.7);
    const [stake, setStake] = useState(50);

    const p = probFor(side, conviction);
    const win = useMemo(() => payoutFor(stake, p, price, side === YES), [stake, p, price, side]);
    const lose = useMemo(() => payoutFor(stake, p, price, side !== YES), [stake, p, price, side]);
    const tooMuch = stake > balance;

    return (
        <div className="space-y-3 pt-3 border-t border-[#233247]">
            {/* ── Side ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
                {[[YES, "Yes"], [NO, "No"]].map(([v, label]) => {
                    const on = side === v;
                    const tone = v === YES
                        ? (on ? "bg-[#58CC02] text-[#0A121F] border-[#58CC02]"
                              : "border-[#2C3E57] text-[#8FA3BF] hover:border-[#58CC02]/50")
                        : (on ? "bg-[#FF5A5F] text-white border-[#FF5A5F]"
                              : "border-[#2C3E57] text-[#8FA3BF] hover:border-[#FF5A5F]/50");
                    return (
                        <button key={v} type="button" onClick={() => setSide(v)}
                            className={`rounded-xl border-2 py-2.5 font-display font-black text-sm
                                transition-colors ${tone}`}>
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ── How sure ─────────────────────────────────────────── */}
            <div>
                <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#6F86A8]">
                        How sure
                    </span>
                    <span className="font-display font-black text-sm text-[#E8F0FB] tabular-nums">
                        {Math.round(conviction * 100)}%
                    </span>
                </div>
                <input
                    type="range" min={CONVICTION_MIN * 100} max={CONVICTION_MAX * 100}
                    value={Math.round(conviction * 100)}
                    onChange={(e) => setConviction(Number(e.target.value) / 100)}
                    className="w-full accent-[#1CB0F6] cursor-pointer"
                    aria-label="How sure are you"
                />
                <div className="flex justify-between text-[10px] font-bold text-[#4E6484]">
                    <span>coin flip</span><span>near certain</span>
                </div>
            </div>

            {/* ── Stake ────────────────────────────────────────────── */}
            <div>
                <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#6F86A8]">
                        Stake
                    </span>
                    <span className="text-[11px] font-bold text-[#6F86A8] tabular-nums">
                        {balance.toLocaleString()} cred
                    </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {STAKES.map((n) => (
                        <button key={n} type="button"
                            onClick={() => setStake(clampStake(n))}
                            disabled={n > balance}
                            className={`rounded-lg border-2 py-1.5 font-display font-black text-xs
                                tabular-nums transition-colors disabled:opacity-30
                                ${stake === n ? "bg-[#1CB0F6] border-[#1CB0F6] text-[#0A121F]"
                                    : "border-[#2C3E57] text-[#8FA3BF] hover:border-[#1CB0F6]/50"}`}>
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── What it pays, and what it costs ──────────────────── */}
            {/* Both, the same size. A proper rule is symmetric and drawing only
                the upside would make this feel like a free dial. */}
            <div className="flex items-center justify-between rounded-xl bg-[#0E1929] px-3 py-2.5">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#4E6484]">
                        If you're right
                    </p>
                    <Roll value={win} className="font-display font-black text-lg text-[#58CC02]" />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#4E6484]">
                        If you're wrong
                    </p>
                    <Roll value={lose} className="font-display font-black text-lg text-[#FF5A5F]" />
                </div>
            </div>

            {/* Agreeing with the price pays nothing, and the panel says so
                rather than letting a student discover a zero at settlement. */}
            {win === 0 && lose === 0 && (
                <p className="text-[11px] text-[#6F86A8] leading-snug">
                    That's exactly where the market already sits — it'd pay nothing either way.
                    You only earn by disagreeing with the price and being right.
                </p>
            )}

            <div className="flex gap-2">
                <button type="button" onClick={onCancel}
                    className="px-3 py-2.5 rounded-xl border-2 border-[#2C3E57] text-[#8FA3BF]
                        font-bold text-sm hover:text-[#E8F0FB] transition-colors">
                    Cancel
                </button>
                <button type="button"
                    disabled={busy || tooMuch}
                    onClick={() => onTake?.({ side, conviction, stake: clampStake(stake) })}
                    className="flex-1 py-2.5 rounded-xl bg-[#E8F0FB] text-[#0A121F]
                        font-display font-black text-sm disabled:opacity-40
                        hover:bg-white transition-colors inline-flex items-center justify-center gap-2">
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    {tooMuch ? "Not enough cred" : `Put ${stake} on ${side === YES ? "Yes" : "No"}`}
                </button>
            </div>
        </div>
    );
}

export { STAKE_MIN, STAKE_MAX };
