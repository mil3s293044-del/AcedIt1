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
 * ─── THE TRACK STARTS AT THE ROOM'S PRICE, AND THAT DELETED A PARAGRAPH ─────
 * Two controls over one number could disagree, and did. Picking YES at 55%
 * into a market already pricing yes at 80¢ puts you FURTHER from yes than the
 * price is, so the rule pays you when NO lands — correct arithmetic that
 * printed as a contradiction, under the side the student had just chosen. The
 * panel answered it with a warning: a paragraph naming the side you were
 * really on, the line, and what to drag to fix it.
 *
 * A warning that explains a control is a control that wants replacing. The
 * range was the wrong thing: conviction ran from the coin flip whatever the
 * price was, so half the track was, for that side, a position on the other
 * one. `convictionRange` anchors the floor at what the room already pays for
 * the side you picked, and the inversion is not warned about — IT CANNOT BE
 * EXPRESSED. `market.test.mjs` walks every price and every reachable
 * conviction to hold that, because the warning it replaced is gone and
 * nothing on screen would say so if it came back.
 *
 * What is left is the reading that was buried in the sentence: HOW FAR PAST
 * THE ROOM YOU HAVE DRAGGED is the gap you are paid on, and it is now a
 * distance rather than a subtraction of two numbers printed in a paragraph.
 *
 * ─── YOUR CONVICTION IS YOUR PRICE, so the panel prints both ────────────────
 * Saying 85 into a market trading at 62 is exactly "I think yes is cheap at
 * 62". That is a limit order in everything but name, and putting the two
 * prices side by side — the room says 62¢, you are calling it 85¢ — is what
 * makes this read as a market rather than a survey, without changing a line of
 * the model. It is also the sentence SettlementReveal will use when this
 * resolves, so the student meets the comparison they will be scored on BEFORE
 * they commit rather than afterwards. The tick above the slider is where the
 * room already sits.
 *
 * Both prices are in ¢ and neither is an odds figure. An earlier version put
 * implied odds here ("the room is offering 1.61×") which was 1/price — a
 * number with no relationship to cred, next to two tiles made of cred.
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
 * name the two outcomes and the colour follows the sign of the money rather
 * than the side of the bet. They stay named that way even though the track
 * can no longer produce the contradiction: the labels are what make the two
 * numbers checkable against the reveal, and "if you're right" was never a
 * thing a scoring rule could promise.
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
    YES, NO, probFor, payoutFor, clampStake, priceLabel,
    returnMultiple, bestReturn, multiplierLabel,
    convictionRange, startingConviction,
    STAKE_MIN, STAKE_MAX,
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
    // Open on a side that can actually be backed. A market the room has run
    // past on one side still has a call on the other, and starting on the
    // dead one greets a student with a disabled button and no reason.
    const [side, setSide] = useState(
        () => (convictionRange(YES, price).tradeable ? YES : NO));
    const [held, setConviction] = useState(() => startingConviction(side, price));
    const [stake, setStake] = useState(50);

    // Where this side's track runs. The floor is the room's line for it — see
    // the header: everything to the right of the floor is a genuine position
    // on the side that is selected, and there is nowhere else to stand.
    const range = convictionRange(side, price);

    // CLAMPED ON READ, not only where it is set. The price is a prop and it
    // moves — somebody else takes a side while this sheet is open and the
    // floor slides out from under a handle that has not been touched. Held in
    // state and used raw, that is the inversion arriving without anybody
    // dragging anything.
    const conviction = Math.min(range.ceiling, Math.max(range.floor, held));

    // Switching sides moves the floor, so the handle moves with it rather
    // than carrying a conviction that is meaningless under the new one.
    const pickSide = (v) => {
        setSide(v);
        setConviction(startingConviction(v, price, conviction));
    };

    const p = probFor(side, conviction);
    const ifYes = useMemo(() => payoutFor(stake, p, price, true), [stake, p, price]);
    const ifNo = useMemo(() => payoutFor(stake, p, price, false), [stake, p, price]);
    const tooMuch = stake > balance;

    // What this exact call returns per cred staked — the same multiple the
    // card advertises, now pinned to the conviction actually on the slider.
    const backIfYes = returnMultiple(p, price, true);
    const backIfNo = returnMultiple(p, price, false);
    // Your price against the room's, both in ¢, which is what they are.
    // How far past the room the handle has travelled, in points. On a price
    // under even money the floor is the coin flip instead, so this measures
    // from the FLOOR — the thing the track actually starts at.
    const gap = Math.max(0, Math.round((conviction - range.floor) * 100));

    // Sitting on the floor is restating the price, which pays exactly nothing.
    // It is the one end of the track rather than a hazard anywhere along it.
    const level = conviction <= range.floor + 0.005;

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
                    // A side the room has already priced past the ceiling has
                    // no call left on it. Disabled with the reason underneath
                    // rather than offered and then paying nothing.
                    const open = convictionRange(v, price).tradeable;
                    const tone = v === YES
                        ? (on ? "bg-[#58CC02] text-[#0A121F] border-[#58CC02]"
                              : "border-[#2C3E57] text-[#8FA3BF] hover:border-[#58CC02]/50")
                        : (on ? "bg-[#FF5A5F] text-white border-[#FF5A5F]"
                              : "border-[#2C3E57] text-[#8FA3BF] hover:border-[#FF5A5F]/50");
                    return (
                        <button key={v} type="button" onClick={() => pickSide(v)}
                            disabled={!open}
                            className={`rounded-xl border-2 py-2.5 font-display font-black text-sm
                                transition-colors disabled:opacity-35 disabled:cursor-not-allowed
                                ${tone}`}>
                            {label}
                            <span className="block text-[10px] font-bold opacity-70 tabular-nums">
                                {open ? `up to ${multiplierLabel(bestReturn(price, v).win)}`
                                    : "already priced in"}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── How sure ─────────────────────────────────────────── */}
            {/* The track BEGINS where the room already is, so every position
                on it is a position on the side above. See the header. */}
            <div>
                <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#6F86A8]">
                        How sure
                    </span>
                    <span className="font-display font-black text-sm text-[#E8F0FB] tabular-nums">
                        {pct(conviction)}%
                    </span>
                </div>
                <input
                    type="range" min={pct(range.floor)} max={pct(range.ceiling)}
                    value={pct(conviction)}
                    onChange={(e) => setConviction(Number(e.target.value) / 100)}
                    className="w-full accent-[#1CB0F6] cursor-pointer"
                    aria-label="How sure are you"
                />
                {/* The ends of the track say what they ARE. The left one is the
                    room's own line when there is one and the coin flip when the
                    price is on the other side of even — the label has to name
                    the thing the handle is actually anchored to. */}
                <div className="flex justify-between text-[10px] font-bold text-[#4E6484]">
                    <span>{range.atRoom
                        ? `the room · ${priceLabel(range.room)}`
                        : "coin flip"}</span>
                    <span>near certain</span>
                </div>
                {/* ONE line, and it is the distance the handle has travelled —
                    which is the quantity the payout is made of. */}
                <p className="text-[11px] text-[#8FA3BF] mt-1.5 leading-snug">
                    {level ? (
                        range.atRoom
                            ? "That's exactly where the room already has it — it'd pay nothing "
                              + "either way. You earn by going past the price and being right."
                            : "A coin flip pays nothing. Drag right to make a call."
                    ) : (
                        <>
                            You&apos;re calling it{" "}
                            <span className="font-bold tabular-nums text-[#E8F0FB]">
                                {priceLabel(p)}</span>
                            {" — "}
                            <span className="font-bold tabular-nums text-[#E8F0FB]">
                                {gap}</span>
                            {gap === 1 ? " point" : " points"} past{" "}
                            {/* The track is anchored at the room's line OR at
                                the coin flip, and the sentence has to name the
                                same one the label under the handle does. At a
                                price under even money they are different, and
                                "past the room" there is simply false. */}
                            {range.atRoom ? "the room" : "a coin flip"}, and that gap is
                            the whole thing you get paid on.
                        </>
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
                    {/* The multiple, beside the cred it is a multiple OF. This
                        is the only place both appear together, which is what
                        makes the × on the board checkable rather than a claim. */}
                    <p className="text-[10px] font-bold tabular-nums text-[#4E6484]">
                        {multiplierLabel(backIfYes)} back
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#4E6484]">
                        If it lands no
                    </p>
                    <Roll value={ifNo} className={`font-display font-black text-lg
                        ${ifNo > 0 ? "text-[#58CC02]" : ifNo < 0 ? "text-[#FF5A5F]" : "text-[#8FA3BF]"}`} />
                    <p className="text-[10px] font-bold tabular-nums text-[#4E6484]">
                        {multiplierLabel(backIfNo)} back
                    </p>
                </div>
            </div>

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
