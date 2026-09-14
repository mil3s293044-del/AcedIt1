/**
 * PriceChart — the tape, drawn.
 *
 * ─── Why a chart at all ─────────────────────────────────────────────────────
 * A price is a number and a number is a fact you read past. A price WITH ITS
 * HISTORY is an argument: it opened at even, four people leaned in, and it has
 * been drifting back since. That is the thing a student can disagree with, and
 * disagreeing with it in the right direction is the entire game — so the
 * history is not decoration here, it is the case for taking a side.
 *
 * ─── IT PLOTS THE PRICE AND PRINTS THE MULTIPLIER ───────────────────────────
 * The multiplier is the readable unit — 1.61× says "the favourite" to somebody
 * who has never met a probability — but it is NOT a chartable quantity. It is
 * 1/p, so every favourite in the world lives between 1.0× and 2.0× while the
 * underdog half runs to infinity: a market drifting 10¢ → 5¢ would dwarf every
 * other line on the board while one drifting 50¢ → 45¢ looked motionless. So
 * the line is the price, on a linear axis, and the multiplier is printed large
 * beside it. A real exchange does exactly this, for exactly this reason.
 *
 * ONE LINE, NOT TWO. NO is 100 − YES by construction, so a YES line and a NO
 * line are one line and its own reflection. Drawing both is drawing the same
 * fact twice, which is the thing this codebase keeps having to delete.
 *
 * ─── IT IS A STEP CHART BECAUSE IT IS A STEP FUNCTION ───────────────────────
 * Polymarket's smooth curves are a picture of continuous liquidity. This board
 * has thirty active students, so a market's entire week is three or four steps
 * with long flat stretches between them. Smoothing that draws a line through
 * data that does not exist — and the steps are the better object anyway,
 * because a step knows WHO took it and by how much. The flat stretches are not
 * a defect to hide; they are the market waiting for somebody, which is a true
 * and interesting thing about a board this size.
 *
 * ─── THE READOUT IS UNDER THE CHART, NEVER FLOATING OVER IT ─────────────────
 * A hover tooltip is content behind something that vanishes when you reach for
 * it — the failure MarkModule was rebuilt to end, and worse on a touch screen
 * where there is no hover at all. Pointing at a step updates a caption that is
 * simply on the page, and with nothing selected the caption reads the latest
 * step, so the most useful sentence is there before anybody interacts.
 *
 * ─── Geometry ───────────────────────────────────────────────────────────────
 * The paths live in a `preserveAspectRatio="none"` viewBox so the line fills
 * any width without measuring the container, with `vector-effect` keeping the
 * stroke an honest 2px under that stretch. Anything ROUND is an HTML element
 * positioned in percentages on top, because a circle inside a non-uniformly
 * scaled viewBox is an ellipse.
 *
 * The floor paints literal inks in both themes on purpose (see Competitions),
 * so there are no design tokens in this file and that is deliberate.
 */
import React, { useMemo, useState } from "react";
import { priceLabel, multipliers, YES } from "@/lib/market";

/* The floor's palette, literal because the room does not follow the theme. */
const INK = {
    up: "#58CC02", down: "#FF5A5F", flat: "#6F86A8",
    grid: "#233247", prior: "#4E6484",
    dim: "#4E6484", mid: "#8FA3BF", bright: "#E8F0FB",
    mine: "#FFC800",
};

/**
 * The y-window: padded around what happened, never narrower than MIN_SPAN.
 *
 * Auto-scaling tight to the data is what an exchange does and it is wrong for
 * a probability: a market that wandered two points would be drawn as a crash.
 * Fixing the axis at 0–100 is wrong the other way — the markets that matter
 * most are the ones hovering near even, and they would all be flat lines
 * through the middle. Twenty points minimum is the compromise, and the axis
 * prints its own bounds so the scale is never a guess.
 */
const MIN_SPAN = 0.2;
function windowFor(prices) {
    let lo = Math.min(...prices) - 0.05;
    let hi = Math.max(...prices) + 0.05;
    if (hi - lo < MIN_SPAN) {
        const mid = (hi + lo) / 2;
        lo = mid - MIN_SPAN / 2;
        hi = mid + MIN_SPAN / 2;
    }
    // Clamping can eat the span back, so the shortfall is pushed to the far
    // side rather than silently returning a squashed window.
    if (lo < 0) { hi = Math.min(1, hi - lo); lo = 0; }
    if (hi > 1) { lo = Math.max(0, lo - (hi - 1)); hi = 1; }
    return { lo, hi: Math.max(hi, lo + 0.02) };
}

const dayLabel = (t) => new Date(t).toLocaleDateString(undefined,
    { weekday: "short", hour: "numeric" });

export default function PriceChart({
    history, compact = false, height = compact ? 44 : 168, myEntry = null,
    // NOTHING IS PRINTED TWICE. Inside TakeSide the card's own header is two
    // inches above with the identical odds, price and change on it, so the
    // chart draws the plot alone — a second copy of a figure does not add
    // emphasis, it costs the first one its authority.
    header = true,
}) {
    const [picked, setPicked] = useState(null);
    const pts = history?.points || [];

    const geo = useMemo(() => {
        if (pts.length < 2) return null;
        const { lo, hi } = windowFor(pts.map((p) => p.price));
        const t0 = pts[0].t;
        const span = Math.max(1, pts[pts.length - 1].t - t0);
        const x = (t) => ((t - t0) / span) * 100;
        const y = (p) => (1 - (p - lo) / (hi - lo)) * 100;

        // Step-after: the price holds until the moment somebody changes it,
        // then changes there. A diagonal between two trades would claim the
        // price was drifting through values nobody ever traded at.
        let d = `M ${x(pts[0].t)} ${y(pts[0].price)}`;
        for (let i = 1; i < pts.length; i += 1) {
            d += ` L ${x(pts[i].t)} ${y(pts[i - 1].price)} L ${x(pts[i].t)} ${y(pts[i].price)}`;
        }
        const area = `${d} L 100 100 L 0 100 Z`;
        return { d, area, x, y, lo, hi, t0, span };
    }, [pts]);

    if (!geo) return null;

    const change = history.change;
    const ink = history.trades === 0 ? INK.flat
        : change > 0 ? INK.up : change < 0 ? INK.down : INK.flat;
    const trades = pts.filter((p) => p.kind === "trade");
    const shown = picked ?? trades[trades.length - 1] ?? null;
    const mult = multipliers(history.last);

    /* ── The sparkline: a shape, no furniture ───────────────────────────── */
    if (compact) {
        return (
            <div className="relative w-full" style={{ height }} aria-hidden="true">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100"
                    preserveAspectRatio="none">
                    {/* A hint of body under the line, not a slab: on a 44px
                        strip a heavier fill becomes the loudest thing on the
                        card and the line stops being the figure. */}
                    <path d={geo.area} fill={ink} opacity="0.08" />
                    <path d={geo.d} fill="none" stroke={ink} strokeWidth="2"
                        strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                        strokeDasharray={history.trades === 0 ? "3 3" : undefined} />
                </svg>
                {/* Where it stands now. A line with no head reads unfinished. */}
                <span className="absolute rounded-full"
                    style={{
                        left: "100%", top: `${geo.y(history.last)}%`, width: 6, height: 6,
                        background: ink, transform: "translate(-100%, -50%)",
                    }} />
                {myEntry && (
                    <span className="absolute rounded-full border-2"
                        style={{
                            left: `${geo.x(myEntry.t)}%`, top: `${geo.y(myEntry.price)}%`,
                            width: 8, height: 8, borderColor: INK.mine, background: "#121C2E",
                            transform: "translate(-50%, -50%)",
                        }} />
                )}
            </div>
        );
    }

    /* ── The full chart ─────────────────────────────────────────────────── */
    return (
        <div>
            {/* The reading, in the units people read odds in. */}
            {header && (
            <div className="flex items-end justify-between gap-3 mb-2">
                <div className="flex items-end gap-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: INK.dim }}>Yes</p>
                        <p className="font-display font-black text-2xl leading-none tabular-nums"
                            style={{ color: INK.up }}>{mult.yesLabel}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: INK.dim }}>No</p>
                        <p className="font-display font-black text-2xl leading-none tabular-nums"
                            style={{ color: INK.down }}>{mult.noLabel}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-display font-black text-lg leading-none tabular-nums"
                        style={{ color: INK.bright }}>{priceLabel(history.last)}</p>
                    <p className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color: ink }}>
                        {change > 0 ? "▲" : change < 0 ? "▼" : "■"} {Math.abs(change)}
                        <span className="font-medium" style={{ color: INK.dim }}> from open</span>
                    </p>
                </div>
            </div>
            )}

            <div className="relative w-full rounded-xl overflow-hidden"
                style={{ height, background: "#0E1929" }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100"
                    preserveAspectRatio="none">
                    {/* The house's opening call, which is what every position on
                        this market was taken against. */}
                    <line x1="0" x2="100" y1={geo.y(history.open)} y2={geo.y(history.open)}
                        stroke={INK.prior} strokeWidth="1" strokeDasharray="4 4"
                        vectorEffect="non-scaling-stroke" />
                    <path d={geo.area} fill={ink} opacity="0.13" />
                    <path d={geo.d} fill="none" stroke={ink} strokeWidth="2"
                        strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                        strokeDasharray={history.trades === 0 ? "4 4" : undefined} />
                </svg>

                {/* Axis bounds, so the window is stated rather than assumed. */}
                <span className="absolute right-1.5 top-1 text-[9px] font-bold tabular-nums"
                    style={{ color: INK.dim }}>{priceLabel(geo.hi)}</span>
                <span className="absolute right-1.5 bottom-1 text-[9px] font-bold tabular-nums"
                    style={{ color: INK.dim }}>{priceLabel(geo.lo)}</span>
                {/* Knocked out of the plot rather than laid over it: the prior
                    line and the price line meet at x=0 by definition, so a
                    transparent label here always sits on top of the stroke. */}
                <span className="absolute left-1.5 text-[9px] font-bold px-1 rounded"
                    style={{
                        color: INK.prior, background: "#0E1929",
                        top: `calc(${geo.y(history.open)}% - 7px)`,
                    }}>
                    open
                </span>

                {/* Each step, sized by what was staked on it — volume without a
                    second chart under the first one. */}
                {trades.map((p, i) => (
                    <button key={i} type="button"
                        onPointerEnter={() => setPicked(p)}
                        onFocus={() => setPicked(p)}
                        onClick={() => setPicked(p)}
                        aria-label={`${p.by || "Someone"} took ${p.side} — price went to ${priceLabel(p.price)}`}
                        className="absolute rounded-full border-2 focus:outline-none"
                        style={{
                            left: `${geo.x(p.t)}%`, top: `${geo.y(p.price)}%`,
                            width: Math.min(16, 8 + Math.round(p.stake / 90)),
                            height: Math.min(16, 8 + Math.round(p.stake / 90)),
                            background: "#0E1929",
                            borderColor: p.is_me ? INK.mine : p.side === YES ? INK.up : INK.down,
                            transform: "translate(-50%, -50%)",
                            opacity: shown === p ? 1 : 0.85,
                        }} />
                ))}

                {/* Your own entry, if it is not already one of the steps above —
                    the price you were scored against is the one number on this
                    chart that is about you. */}
                {myEntry && !trades.some((p) => p.is_me) && (
                    <span className="absolute rounded-full border-2"
                        style={{
                            left: `${geo.x(myEntry.t)}%`, top: `${geo.y(myEntry.price)}%`,
                            width: 10, height: 10, borderColor: INK.mine, background: "#0E1929",
                            transform: "translate(-50%, -50%)",
                        }} />
                )}
            </div>

            {/* ── The readout. On the page, never over the chart. ────────── */}
            <p className="text-[11px] mt-2 leading-snug min-h-[1.5em]" style={{ color: INK.mid }}>
                {history.trades === 0 ? (
                    <>No one has taken a side yet — the line is the house&apos;s opening call,
                        and the first position is what starts it.</>
                ) : shown ? (
                    <>
                        <span className="font-bold" style={{ color: shown.is_me ? INK.mine : INK.bright }}>
                            {shown.is_me ? "You" : (shown.by || "Someone")}
                        </span>
                        {" took "}
                        <span className="font-bold"
                            style={{ color: shown.side === YES ? INK.up : INK.down }}>
                            {shown.side === YES ? "yes" : "no"}
                        </span>
                        {` with ${shown.stake.toLocaleString()} cred · `}
                        <span className="tabular-nums">
                            {shown.delta > 0 ? "+" : ""}{shown.delta} to {priceLabel(shown.price)}
                        </span>
                        <span style={{ color: INK.dim }}> · {dayLabel(shown.t)}</span>
                    </>
                ) : null}
            </p>
        </div>
    );
}
