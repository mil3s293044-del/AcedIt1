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
 * ─── YOUR CONVICTION IS YOUR PRICE, so the panel says so in odds ────────────
 * Saying 85 into a market trading at 62 is exactly "I think yes is cheap at
 * 62". That is a limit order in everything but name, and printing it as one —
 * the room is offering 1.61×, your call is 1.18× — is what makes this read as
 * a market rather than a survey, without changing a line of the model. The
 * tick above the slider is where the room already sits.
 *
 * ─── THE PAYOUT ROLLS, BECAUSE THE NUMBERS ARE THE FEEDBACK ─────────────────
 * Dragging conviction changes what you win and what you lose at the same time,
 * in opposite directions, and that trade-off is the entire decision. Swapped,
 * it has to be reconstructed from two remembered states; rolled, it is visible
 * as motion. Same argument `Odometer` on the old Compete made, kept because it
 * was the one thing on that page that genuinely worked.
 *
 * ─── THE TILES ARE LABELLED BY OUTCOME, NOT BY "RIGHT" ──────────────────────
 * They used to read "If you're right" / "If you're wrong", with right meaning
 * your own side, and that is WRONG under a scoring rule in a way that printed
 * a lie. Take NO at 55% into a market already pricing NO at 80¢ and you are
 * further from NO than the price is: the rule pays you when YES lands and
 * charges you when NO does. The old panel showed that as "If you're right:
 * −16" in green — a negative number under the winning label, in the winning
 * colour.
 *
 * A side is not a position here; a DISTANCE FROM THE PRICE is. So the tiles
 * name the two outcomes, the colour follows the sign of the money rather than
 * the side of the bet, and when the two disagree the panel says out loud that
 * you are backing the other side of the room's price and where the line is.
 * Discovering that at settlement instead would be the worst possible way to
 * learn how the scoring works.
 *
 * ─── AND IT SHOWS THE LOSS AS LOUDLY AS THE WIN ─────────────────────────────
 * A proper scoring rule is symmetric: confidence costs exactly what it pays.
 * Drawing only the upside would make the slider feel like a free dial and the
 * first settlement a betrayal. Both numbers, same size, side by side.
 */
import React, { useMemo, useState } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import PriceChart from "./PriceChart";
import {
    YES, NO, probFor, payoutFor, clampStake, multiplierOf, multiplierLabel,
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
const pct = (v) => Math.round(v * 100);

export default function TakeSide({
    price, balance = 0, busy = false, onTake, onCancel, history = null, myEntry = null,
}) {
    const [side, setSide] = useState(YES);
    const [conviction, setConviction] = useState(0.7);
    const [stake, setStake] = useState(50);

    const p = probFor(side, conviction);
    const ifYes = useMemo(() => payoutFor(stake, p, price, true), [stake, p, price]);
    const ifNo = useMemo(() => payoutFor(stake, p, price, false), [stake, p, price]);
    const tooMuch = stake > balance;

    // Where your call sits against the room's, in the units above the chart.
    const roomMult = multiplierOf(price, side);
    const myMult = multiplierOf(p, side);

    // The conviction at which you exactly restate the price. Below it, your
    // "side" is really a position on the other one.
    const breakeven = side === YES ? price : 1 - price;
    const level = Math.abs(p - price) < 0.005;
    const inverted = !level && (side === YES ? ifYes < 0 : ifNo < 0);
    const tickAt = (breakeven - CONVICTION_MIN) / (CONVICTION_MAX - CONVICTION_MIN);
    const tickVisible = tickAt > 0.01 && tickAt < 0.99;

    return (
        <div className="space-y-3 pt-3 border-t border-[#233247]">
            {/* ── What the price has done. The case for disagreeing. ── */}
            {history && history.points?.length > 1 && (
                <PriceChart history={history} myEntry={myEntry} height={150} header={false} />
            )}

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
                            <span className="block text-[10px] font-bold opacity-70 tabular-nums">
                                {multiplierLabel(multiplierOf(price, v))}
                            </span>
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
                        {pct(conviction)}%
                    </span>
                </div>
                {/* The room's line, drawn on your own scale. A slider with a
                    mark on it is a limit price; a slider without one is a dial
                    with no reference, which is what this was. */}
                <div className="relative">
                    {tickVisible && (
                        <span aria-hidden="true"
                            className="absolute -top-1 w-px h-2 bg-[#8FA3BF]"
                            style={{ left: `${tickAt * 100}%` }} />
                    )}
                    <input
                        type="range" min={CONVICTION_MIN * 100} max={CONVICTION_MAX * 100}
                        value={pct(conviction)}
                        onChange={(e) => setConviction(Number(e.target.value) / 100)}
                        className="w-full accent-[#1CB0F6] cursor-pointer"
                        aria-label="How sure are you"
                    />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-[#4E6484]">
                    <span>coin flip</span>
                    {tickVisible && <span className="text-[#8FA3BF]">the room</span>}
                    <span>near certain</span>
                </div>
                <p className="text-[11px] text-[#8FA3BF] mt-1.5 leading-snug">
                    Room&apos;s price <span className="font-bold tabular-nums text-[#E8F0FB]">
                        {multiplierLabel(roomMult)}</span>
                    {" · your call "}
                    <span className="font-bold tabular-nums text-[#E8F0FB]">
                        {multiplierLabel(myMult)}</span>
                    {!level && !inverted && (
                        <span> — you rate {side === YES ? "yes" : "no"} more likely
                            than the room does, and that gap is what pays.</span>
                    )}
                </p>
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

            {/* ── What each outcome pays ───────────────────────────── */}
            {/* Labelled by OUTCOME and coloured by SIGN, so the two can never
                contradict each other the way "if you're right: −16" did. */}
            <div className="flex items-center justify-between rounded-xl bg-[#0E1929] px-3 py-2.5">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#4E6484]">
                        If it lands yes
                    </p>
                    <Roll value={ifYes} className={`font-display font-black text-lg
                        ${ifYes > 0 ? "text-[#58CC02]" : ifYes < 0 ? "text-[#FF5A5F]" : "text-[#8FA3BF]"}`} />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#4E6484]">
                        If it lands no
                    </p>
                    <Roll value={ifNo} className={`font-display font-black text-lg
                        ${ifNo > 0 ? "text-[#58CC02]" : ifNo < 0 ? "text-[#FF5A5F]" : "text-[#8FA3BF]"}`} />
                </div>
            </div>

            {/* You picked a side but priced it below where the room already has
                it, which makes this a position on the OTHER outcome. Said here,
                with the line, rather than discovered at settlement. */}
            {inverted && (
                <p className="text-[11px] text-[#FFC800] leading-snug">
                    The room already has {side === YES ? "yes" : "no"} at {multiplierLabel(roomMult)}.
                    At {pct(conviction)}% you&apos;re calling it less likely than that, so this pays
                    if it lands {side === YES ? "no" : "yes"}. Go past {pct(breakeven)}% to back{" "}
                    {side === YES ? "yes" : "no"}.
                </p>
            )}

            {/* Agreeing with the price pays nothing, and the panel says so
                rather than letting a student discover a zero at settlement. */}
            {level && (
                <p className="text-[11px] text-[#6F86A8] leading-snug">
                    That&apos;s exactly where the market already sits — it&apos;d pay nothing either
                    way. You only earn by disagreeing with the price and being right.
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
