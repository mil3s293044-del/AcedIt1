/**
 * PriceBar — what the room thinks, drawn: the figure, the split, and who is on
 * each end of it.
 *
 * ─── THE PRICE WAS THE SMALLEST FIGURE ON A SCREEN MADE OF PRICES ───────────
 * The card led with two payout ceilings in 20px type and tucked the price into
 * a 62px gutter beside them. The price is the market's actual state: it is
 * what everybody already holding a position was scored against, it is the
 * number the tape moves, and it is the only thing on the card that changes
 * while a student is reading it. So it leads.
 *
 * ─── NO ODDS UNDER THE BAR ──────────────────────────────────────────────────
 * Each end used to carry a return multiple — "Yes 1.34×", "1.17× No". Those
 * were honest figures (the most the strongest call could return) and they were
 * still a bookmaker's board: a multiple under each outcome is the exact shape
 * of a betting slip, on a floor that is selling itself to schools as a
 * forecasting competition. What a student can act on is what the ROOM thinks
 * and how many people think it, so each end carries the side and the number of
 * people calling it. What a call is worth in credits appears once, in the
 * sheet where a call is actually being made, against a real commitment.
 *
 * ─── A SPLIT IS A PICTURE AND A PERCENTAGE IS NOT ───────────────────────────
 * A bar split four-tenths of the way along is the price with nothing to
 * convert, read peripherally down a column of cards — which is what a board is
 * for. And POSITION is the second channel the floor's CVD rule asks for: the
 * brand green and the streak red sit at ΔE 7.0 under deuteranopia, so yes runs
 * from the left and no from the right and the bar survives greyscale.
 *
 * ─── THE LABELS ARE UNDER THE BAR, NEVER INSIDE IT ──────────────────────────
 * Inside breaks at exactly the prices worth looking at: an outside chance at
 * 6% has a sliver too narrow to hold a word.
 *
 * ─── `preview` IS YOUR CALL, BEFORE YOU MAKE IT ─────────────────────────────
 * The commit sheet passes the price the room would move to if this call went
 * in, and the bar draws it as a ghost boundary: the effect of your call is a
 * thing you can see before you press, not a number you infer afterwards.
 */
import React, { useEffect, useRef, useState } from "react";
import { priceLabel } from "@/lib/market";
import PriceTick from "./PriceTick";

/** Never a hairline: a side the room has all but abandoned still has to be
 *  visible as a side, or the bar reads as a solid block and says nothing. */
const MIN_SHARE = 4;

const shareOf = (v) => {
    const p = Number(v);
    const pct = Number.isFinite(p) ? Math.round(p * 100) : 50;
    return Math.min(100 - MIN_SHARE, Math.max(MIN_SHARE, pct));
};

/**
 * A count that goes up each time the price MOVES after the first paint. Keyed
 * onto the pulse, so a refetch that changed nothing plays nothing and a page
 * load is never announced as somebody calling.
 */
function useMoveCount(value) {
    const prev = useRef(value);
    const [n, setN] = useState(0);
    useEffect(() => {
        if (prev.current !== value && Number.isFinite(Number(prev.current))) setN((k) => k + 1);
        prev.current = value;
    }, [value]);
    return n;
}

export default function PriceBar({ price, counts = null, labels, change = null, trades = 0, preview = null }) {
    const yesShare = shareOf(price);
    const ghost = preview === null || preview === undefined ? null : shareOf(preview);
    const moved = useMoveCount(yesShare);

    return (
        <div>
            {/* ── The state: the price, and whether it just moved ────────── */}
            <div className="flex items-end justify-between gap-3 mb-1.5">
                <PriceTick price={price} label={priceLabel(price)} size="lg" />
                {/* A market nobody has traded has not moved, and "0 from open"
                    is a measurement of nothing dressed as one. */}
                {trades > 0 && Number.isFinite(change) && (
                    <span className={`text-[11px] font-bold tabular-nums leading-none pb-0.5
                        ${change > 0 ? "text-[var(--floor-yes-ink)]"
                            : change < 0 ? "text-[var(--floor-no-ink)]"
                                : "text-[var(--floor-muted-2)]"}`}>
                        {change > 0 ? "▲" : change < 0 ? "▼" : "■"}{" "}
                        {Math.abs(change)} from open
                    </span>
                )}
            </div>

            {/* ── The split ──────────────────────────────────────────────── */}
            {/* Two filled segments with the CARD showing through between them.
                The gap is the boundary: a single bar with a colour change at
                the split reads as one object that happens to be two colours,
                and the eye does not land on the one place that matters. */}
            <div className="relative">
                <div className="flex items-stretch gap-[3px] h-2.5" aria-hidden="true">
                    <span className="rounded-l-full bg-[var(--floor-yes)] transition-[width] duration-500"
                        style={{ width: `${yesShare}%` }} />
                    <span className="flex-1 rounded-r-full bg-[var(--floor-no)]" />
                </div>
                {/* Somebody just called it: the boundary flares where it
                    landed, once. */}
                {moved > 0 && (
                    <span key={moved} aria-hidden="true" data-price-pulse
                        className="floor-price-pulse pointer-events-none absolute -top-1 -bottom-1 w-2 rounded-full
                            bg-[var(--floor-accent)]"
                        style={{ left: `calc(${yesShare}% - 4px)` }} />
                )}
                {/* Where your call would leave the room: a tick, not a second
                    bar, so the bar still reads as what the room thinks NOW. */}
                {ghost !== null && ghost !== yesShare && (
                    <span aria-hidden="true" data-price-preview
                        className="absolute -top-1 -bottom-1 w-[3px] rounded-full bg-[var(--floor-ink)]
                            transition-[left] duration-300"
                        style={{ left: `calc(${ghost}% - 1.5px)` }} />
                )}
            </div>

            {/* ── Who is on each end ─────────────────────────────────────── */}
            <div className="flex items-baseline justify-between gap-3 mt-1.5">
                <span className="min-w-0 truncate">
                    <span className="text-[10px] font-black uppercase tracking-widest
                        text-[var(--floor-yes-ink)]">{labels.yes}</span>
                    {counts && (
                        <span className="text-[11px] font-bold tabular-nums ml-1.5 text-[var(--floor-muted-2)]">
                            {counts.yes} calling
                        </span>
                    )}
                </span>
                <span className="min-w-0 truncate text-right">
                    {counts && (
                        <span className="text-[11px] font-bold tabular-nums mr-1.5 text-[var(--floor-muted-2)]">
                            {counts.no} calling
                        </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest
                        text-[var(--floor-no-ink)]">{labels.no}</span>
                </span>
            </div>
        </div>
    );
}
