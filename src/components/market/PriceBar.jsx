/**
 * PriceBar — the price, as a physical thing rather than a number.
 *
 * ─── A probability is the most abstract thing on the page ───────────────────
 * `OddsDots` made this argument already and it still holds: 71% is a fact a
 * student reads past. A bar filled most of the way, with a mark showing where
 * the question STARTED, is the same fact with the movement in it — and the
 * movement is the only part anybody can act on.
 *
 * ─── THE PRIOR MARK IS THE INFORMATION ──────────────────────────────────────
 * The tick is where the house opened the question. The distance between the
 * tick and the fill is exactly what the crowd disagreed with the house about,
 * which is precisely what the scoring rule pays on. A bar without it is just a
 * percentage lying down.
 *
 * ─── A thin market says so ──────────────────────────────────────────────────
 * Under a few weeks of history there is no base rate, only a coin flip, and
 * the bar is drawn hollow with the tick hidden. Printing a confident 50¢ off
 * nothing is the "100% — from your last 1" failure the forecast panel already
 * refuses.
 */
import React from "react";
import { motion } from "framer-motion";
import { priceLabel, clampP } from "@/lib/market";

export default function PriceBar({ price, prior, thin = false, compact = false }) {
    const p = clampP(price);
    const base = clampP(prior ?? 0.5);
    const pct = p * 100;
    const moved = Math.abs(p - base) >= 0.02;

    return (
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="font-display font-black text-[#E8F0FB] tabular-nums
                    text-2xl leading-none">
                    {priceLabel(p)}
                </span>
                {thin ? (
                    <span className="text-[11px] font-bold text-[#6F86A8]">
                        no history yet — opened at even
                    </span>
                ) : moved ? (
                    <span className={`text-[11px] font-bold tabular-nums
                        ${p > base ? "text-[#58CC02]" : "text-[#FF5A5F]"}`}>
                        {p > base ? "▲" : "▼"} {Math.abs(Math.round((p - base) * 100))}
                        <span className="text-[#6F86A8] font-medium"> from open</span>
                    </span>
                ) : (
                    <span className="text-[11px] font-bold text-[#6F86A8]">at the open</span>
                )}
            </div>

            <div className={`relative w-full rounded-full bg-[#1B2839] overflow-hidden
                ${compact ? "h-2" : "h-3"}`}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    className={`h-full rounded-full ${thin ? "bg-[#31455F]" : "bg-[#1CB0F6]"}`}
                />
                {/* Where the house opened it. Hidden on a thin market, because a
                    tick on a number nobody computed claims a precision that is
                    not there. */}
                {!thin && (
                    <span
                        aria-hidden="true"
                        className="absolute top-0 bottom-0 w-px bg-[#E8F0FB]/70"
                        style={{ left: `${base * 100}%` }}
                    />
                )}
            </div>
        </div>
    );
}
