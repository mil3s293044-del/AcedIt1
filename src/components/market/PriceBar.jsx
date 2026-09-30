/**
 * PriceBar — the price, drawn, with what each side pays under its own end.
 *
 * ─── THE PRICE WAS THE SMALLEST FIGURE ON A SCREEN MADE OF PRICES ───────────
 * The card led with two payout ceilings in 20px type and tucked 42¢ into a
 * 62px gutter beside them. That is backwards on both counts. The multiple is
 * a CONDITIONAL — what the strongest call the slider allows returns IF it
 * lands, on a call nobody has made yet. The price is the market's actual
 * state: it is what everybody already holding a position was scored against,
 * it is the number the tape moves, and it is the only thing on the card that
 * changes while a student is reading it.
 *
 * So the price leads, and the multiples sit under the two ends of the bar
 * where they are still the second thing read.
 *
 * ─── A SPLIT IS A PICTURE AND A PERCENTAGE IS NOT ───────────────────────────
 * "42¢" is a fact a sixteen-year-old has to convert. A bar split four-tenths
 * of the way along is the same fact with nothing to convert, read peripherally
 * and at a glance down a column of cards — which is what a board is for. The
 * figure stays printed beside it, because a bar cannot be read to the cent and
 * the take-side sheet speaks in cents.
 *
 * ─── AND THE SPLIT IS A SECOND CHANNEL ─────────────────────────────────────
 * The brand green and the streak red sit at ΔE 7.0 under deuteranopia, so the
 * floor's rule is that nothing encodes a side in those two hues alone. Here
 * POSITION carries it: yes runs from the left, no from the right, and the
 * boundary is where the room has got to. The labels are printed at their own
 * ends on top of that, so the bar survives being read in greyscale.
 *
 * ─── THE LABELS ARE UNDER THE BAR, NEVER INSIDE IT ──────────────────────────
 * Inside is the tempting drawing and it breaks at exactly the prices worth
 * looking at: a longshot sitting at 6¢ has a sliver too narrow to hold the
 * word "Yes", let alone "Priyanka 1.15×". Underneath, a 3¢ market and a 97¢
 * one render identically well.
 */
import React from "react";
import { priceLabel } from "@/lib/market";
import PriceTick from "./PriceTick";

/** Never a hairline: a side the room has all but abandoned still has to be
 *  visible as a side, or the bar reads as a solid block and says nothing. */
const MIN_SHARE = 4;

export default function PriceBar({ price, pays, labels, change = null, trades = 0 }) {
    const p = Number(price);
    const pct = Number.isFinite(p) ? Math.round(p * 100) : 50;
    const yesShare = Math.min(100 - MIN_SHARE, Math.max(MIN_SHARE, pct));

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
            <div className="flex items-stretch gap-[3px] h-2.5" aria-hidden="true">
                <span className="rounded-l-full bg-[var(--floor-yes)] transition-[width] duration-500"
                    style={{ width: `${yesShare}%` }} />
                <span className="flex-1 rounded-r-full bg-[var(--floor-no)]" />
            </div>

            {/* ── What each side pays, under its own end ─────────────────── */}
            <div className="flex items-baseline justify-between gap-3 mt-1.5">
                <span className="min-w-0 truncate">
                    <span className="text-[10px] font-black uppercase tracking-widest
                        text-[var(--floor-muted-2)]">{labels.yes}</span>
                    <span className="font-display font-black text-base tabular-nums ml-1.5
                        text-[var(--floor-yes-ink)]">{pays.yesLabel}</span>
                </span>
                <span className="min-w-0 truncate text-right">
                    <span className="font-display font-black text-base tabular-nums mr-1.5
                        text-[var(--floor-no-ink)]">{pays.noLabel}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest
                        text-[var(--floor-muted-2)]">{labels.no}</span>
                </span>
            </div>
        </div>
    );
}
