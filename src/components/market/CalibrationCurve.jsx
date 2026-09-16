/**
 * CalibrationCurve — when you say 80%, are you right 80% of the time?
 *
 * ─── The one chart a betting app cannot draw ────────────────────────────────
 * Everything else on the portfolio tab exists on any trading screen: a balance,
 * a P/L, a record. This one exists because the model asks a student to STATE A
 * BELIEF rather than accept a price, so the beliefs are on file and can be
 * checked against what happened. That makes forecasting a measurable skill
 * rather than a vibe, and it is the aggregate of the sentence SettlementReveal
 * prints one result at a time: you said 85, the room said 62, it landed yes.
 *
 * ─── IT REFUSES TO SCORE SOMEBODY ON TWO CALLS ──────────────────────────────
 * A band under `CALIBRATION_MIN` is drawn as a tick on the axis with its count,
 * never as a point on the curve, and with under `CALIBRATION_MIN_TOTAL` settled
 * calls the whole panel says how many more are needed instead of drawing
 * anything. Telling a sixteen-year-old with three resolved calls that they are
 * overconfident is a personality judgement made off a coin flip — the
 * "never score a student on a signal they can't reach" rule in its most
 * damaging form.
 *
 * ─── Chart decisions, and why ───────────────────────────────────────────────
 * ONE SERIES, so there is no legend and no categorical palette to get wrong —
 * the dots are the student and the hairline is the reference. The reference is
 * SOLID, because a dashed rule reads as a projection or a threshold when this
 * one is neither; it is the line their dots are being compared to and it is
 * labelled rather than left to be inferred from its angle.
 *
 * COUNT IS THE DOT'S SIZE, NEVER A SECOND AXIS. How many calls sit in a band
 * and how accurate they were are different scales, and a second y-axis would
 * invent a relationship between them — the single worst thing a chart can do.
 * Size is a composite encoding on the one axis, the same move PriceChart makes
 * with stake.
 *
 * NO HOVER TOOLTIP. The readout lives under the plot, which is the rule
 * MarkModule was rebuilt around: content you need is never behind something
 * that disappears when you reach for it, and on a phone there is no hover at
 * all to put it behind.
 */
import React, { useState } from "react";
import { CALIBRATION_MIN } from "@/lib/holdings";

const INK = {
    you: "var(--floor-accent-ink)", ref: "var(--floor-dim)", grid: "var(--floor-edge)",
    dim: "var(--floor-dim)", mid: "var(--floor-muted)", bright: "var(--floor-ink)",
    over: "var(--floor-warn-ink)", under: "var(--floor-yes-ink)",
};

/* x: stated confidence 50–100. y: what actually happened, 0–100. The reference
   is not drawn at 45° and does not need to be — the label is what says what it
   means, and forcing the angle would cost half the plot to a region the
   conviction slider cannot reach. */
const X0 = 0.5;
const xAt = (v) => ((v - X0) / (1 - X0)) * 100;
const yAt = (v) => (1 - v) * 100;

export default function CalibrationCurve({ data, height = 190 }) {
    const [picked, setPicked] = useState(null);
    if (!data) return null;

    const drawn = data.bands.filter((b) => b.enough);
    const thin = data.bands.filter((b) => !b.enough && b.n > 0);

    if (!data.ready) {
        return (
            <div className="rounded-xl bg-[var(--floor-well)] p-5 text-center">
                <p className="font-display font-black text-2xl text-[var(--floor-ink)] tabular-nums">
                    {data.graded}
                </p>
                <p className="text-[11px] text-[var(--floor-muted)] mt-1 leading-snug">
                    calls settled so far. {data.needs > 0
                        ? `${data.needs} more and this starts showing whether your confidence matches your hit rate.`
                        : "A band needs a few calls in it before it can say anything."}
                </p>
            </div>
        );
    }

    const shown = picked || drawn.reduce((a, b) => (b.n > (a?.n || 0) ? b : a), null);
    const off = shown ? Math.round((shown.stated - shown.actual) * 100) : 0;

    return (
        <div>
            <div className="relative w-full rounded-xl overflow-hidden"
                style={{ height, background: "var(--floor-well)" }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100"
                    preserveAspectRatio="none">
                    {[0.25, 0.5, 0.75].map((g) => (
                        <line key={g} x1="0" x2="100" y1={yAt(g)} y2={yAt(g)}
                            stroke={INK.grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    ))}
                    {/* Perfectly calibrated: what you said is what happened. */}
                    <line x1={xAt(0.5)} y1={yAt(0.5)} x2={xAt(1)} y2={yAt(1)}
                        stroke={INK.ref} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </svg>

                <span className="absolute text-[9px] font-bold px-1 rounded"
                    style={{ color: INK.ref, background: "var(--floor-well)", right: 4, top: 2 }}>
                    perfect
                </span>
                <span className="absolute left-1.5 top-1 text-[9px] font-bold"
                    style={{ color: INK.dim }}>100%</span>
                <span className="absolute left-1.5 bottom-1 text-[9px] font-bold"
                    style={{ color: INK.dim }}>0%</span>

                {drawn.map((b) => {
                    const size = Math.min(22, 10 + Math.round(b.n * 1.6));
                    const on = shown === b;
                    return (
                        <button key={b.label} type="button"
                            onPointerEnter={() => setPicked(b)}
                            onFocus={() => setPicked(b)}
                            onClick={() => setPicked(b)}
                            aria-label={`${b.label} confidence: right ${Math.round(b.actual * 100)}% of ${b.n}`}
                            className="absolute rounded-full border-2 focus:outline-none"
                            style={{
                                left: `${xAt(b.stated)}%`, top: `${yAt(b.actual)}%`,
                                width: size, height: size,
                                // A 2px ring in the surface colour, so two bands
                                // that land close together stay two marks.
                                background: on ? INK.you : "var(--floor-well)",
                                borderColor: INK.you,
                                boxShadow: "0 0 0 2px var(--floor-well)",
                                transform: "translate(-50%, -50%)",
                            }} />
                    );
                })}
            </div>

            {/* The axis, named rather than ticked: five bands is few enough to
                print and "how sure you said you were" is the thing the numbers
                would otherwise leave unexplained. */}
            <div className="flex justify-between text-[9px] font-bold mt-1"
                style={{ color: INK.dim }}>
                <span>said 50%</span>
                <span>how sure you said you were</span>
                <span>said 100%</span>
            </div>

            {thin.length > 0 && (
                <p className="text-[10px] mt-1.5 leading-snug" style={{ color: INK.dim }}>
                    Not enough yet at {thin.map((b) => b.label).join(", ")} — a band needs{" "}
                    {CALIBRATION_MIN} settled calls before it can say anything.
                </p>
            )}

            <p className="text-[11px] mt-2 leading-snug min-h-[2.2em]" style={{ color: INK.mid }}>
                {shown && (
                    <>
                        When you said <span className="font-bold" style={{ color: INK.bright }}>
                            {Math.round(shown.stated * 100)}%</span>, you were right{" "}
                        <span className="font-bold" style={{ color: INK.bright }}>
                            {Math.round(shown.actual * 100)}%</span> of{" "}
                        {shown.n} {shown.n === 1 ? "call" : "calls"}
                        {Math.abs(off) < 5 ? (
                            <span style={{ color: INK.under }}> — that&apos;s on the line.</span>
                        ) : off > 0 ? (
                            <span style={{ color: INK.over }}> — {off} points over.</span>
                        ) : (
                            <span style={{ color: INK.under }}> — {Math.abs(off)} points under,
                                so you could back yourself harder.</span>
                        )}
                    </>
                )}
            </p>
        </div>
    );
}
