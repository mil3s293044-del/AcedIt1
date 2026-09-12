/**
 * MarketCard — THE card. Every competitive thing in AcedIt renders through it.
 *
 * ─── One card is the whole point of the rebuild ─────────────────────────────
 * Compete had a different card for battles, duels, call-outs, forecasts,
 * progress bets and back-yourself bets — six shapes for six nouns, each with
 * its own affordances to learn. A student who understood one had learned
 * nothing about the next. This is the one shape: a question, a price, who is
 * on which side, and a way in. A SAC mark and a weekly streak look identical
 * because they ARE the same object.
 *
 * ─── A MARKET ABOUT YOU IS DRAWN DIFFERENTLY ────────────────────────────────
 * "Twelve people are trading your week" is the most motivating sentence this
 * app can put on a screen, and it is the whole reason Compete can be a
 * retention engine rather than a leaderboard. It gets its own ink and its own
 * line, and it sorts to the top of the board (see `sortBoard`).
 *
 * ─── The crowd is drawn as PEOPLE, not just a price ─────────────────────────
 * "8 backing yes · 3 no" with names on hover. A market where you cannot see
 * who is on which side is a private bet, which is exactly what the old
 * wagering layer was and why nothing about it felt social.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Clock, Lock } from "lucide-react";
import PriceBar from "./PriceBar";
import TakeSide from "./TakeSide";
import { KINDS, sideOf, YES, priceLabel, payoutFor } from "@/lib/market";

function untilLabel(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return null;                 // never the epoch
    const ms = t - Date.now();
    if (ms <= 0) return "closed";
    const mins = Math.floor(ms / 60000);
    const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60);
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return `${h}h`;
    return `${mins}m`;
}

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";

export default function MarketCard({ market, balance, busy, onTake, onReport }) {
    const [open, setOpen] = useState(false);
    const kind = KINDS[market.kind] || KINDS.streak;
    const KindIcon = Icons[kind.icon] || Icons.CircleDot;
    const left = untilLabel(market.closes_at);
    const closing = left && /^\d+[mh]$/.test(left);
    const mine = market.mine;
    const names = (market.positions || [])
        .filter((p) => sideOf(p.p) === YES).map((p) => firstName(p.user_name)).slice(0, 4);

    return (
        <motion.article
            layout
            // A market about YOU is marked by its border and its own line, not
            // by a different ground: tinting the panel came out a muddy olive
            // that read as a rendering fault rather than as emphasis, and the
            // room only works while every panel sits on the same ink.
            className={`rounded-2xl border-2 p-4 transition-colors bg-[#121C2E]
                ${market.subject_is_me
                    ? "border-[#FFC800]/60"
                    : "border-[#233247] hover:border-[#33486A]"}`}
        >
            {/* ── Kicker: what kind, and the clock ──────────────────── */}
            <div className="flex items-center justify-between gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black
                    uppercase tracking-widest text-[#6F86A8]">
                    <KindIcon className="w-3.5 h-3.5" /> {kind.label}
                </span>
                {left && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums
                        ${closing ? "text-[#FFC800]" : "text-[#6F86A8]"}`}>
                        <Clock className="w-3 h-3" /> {left}
                    </span>
                )}
            </div>

            {/* ── The question ─────────────────────────────────────── */}
            <h3 className="font-display font-extrabold text-[#E8F0FB] text-base leading-snug mb-3">
                {market.title}
            </h3>

            {/* ── IT'S ABOUT YOU ───────────────────────────────────── */}
            {market.subject_is_me && market.traders > 0 && (
                <p className="text-[13px] font-bold text-[#FFC800] mb-3 leading-snug">
                    {market.traders === 1
                        ? "Someone has taken a position on your week."
                        : `${market.traders} people are trading your week.`}
                </p>
            )}

            <PriceBar price={market.price} prior={market.prior} thin={!!market.meta?.thin} />

            {/* ── The crowd, as people ─────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 mt-2.5 text-[11px]">
                <span className="text-[#6F86A8] font-bold">
                    {market.traders === 0 ? (
                        <span className="text-[#4E6484]">No one has taken a side yet</span>
                    ) : (
                        <>
                            <span className="text-[#58CC02]">{market.yesCount} yes</span>
                            <span className="text-[#33445E] mx-1.5">·</span>
                            <span className="text-[#FF5A5F]">{market.noCount} no</span>
                            {names.length > 0 && (
                                <span className="text-[#4E6484]"> — {names.join(", ")}
                                    {market.yesCount > names.length ? " +more" : ""}</span>
                            )}
                        </>
                    )}
                </span>
                <span className="text-[#4E6484] font-bold tabular-nums">
                    {market.volume.toLocaleString()} in
                </span>
            </div>

            {/* ── Your side ────────────────────────────────────────── */}
            {mine && (
                <div className="flex items-center justify-between gap-3 mt-3 rounded-xl
                    bg-[#0E1929] px-3 py-2">
                    <span className="text-[11px] font-bold text-[#8FA3BF]">
                        You: <span className={sideOf(mine.p) === YES ? "text-[#58CC02]" : "text-[#FF5A5F]"}>
                            {sideOf(mine.p) === YES ? "YES" : "NO"}
                        </span>
                        <span className="text-[#4E6484]"> · {mine.stake} @ {priceLabel(mine.price_at_entry)}</span>
                    </span>
                    <span className="text-[11px] font-black tabular-nums text-[#58CC02]">
                        {(() => {
                            const w = payoutFor(mine.stake, mine.p, mine.price_at_entry, sideOf(mine.p) === YES);
                            return `${w > 0 ? "+" : ""}${w} if right`;
                        })()}
                    </span>
                </div>
            )}

            {/* ── The way in ───────────────────────────────────────── */}
            {open ? (
                <TakeSide
                    price={market.price} balance={balance} busy={busy}
                    onCancel={() => setOpen(false)}
                    onTake={async (pick) => { await onTake?.(market, pick); setOpen(false); }}
                />
            ) : mine ? null : market.blocked ? (
                // A refusal SAYS WHY. A greyed-out button with no reason is the
                // "disabled button that says nothing" paper-cut this project
                // already fixed once on the Study page.
                <p className="flex items-start gap-1.5 mt-3 text-[11px] text-[#6F86A8] leading-snug">
                    <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" /> {market.blocked}
                </p>
            ) : (
                <button type="button" onClick={() => setOpen(true)}
                    className="w-full mt-3 py-2.5 rounded-xl border-2 border-[#2C3E57]
                        text-[#E8F0FB] font-display font-black text-sm
                        hover:border-[#1CB0F6] hover:bg-[#1CB0F6]/10 transition-colors">
                    Take a side
                </button>
            )}

            {/* ── Your own mark to report ──────────────────────────── */}
            {market.kind === "sac" && market.subject_is_me && onReport && (
                <button type="button" onClick={() => onReport(market)}
                    className="w-full mt-2 py-2 rounded-xl bg-[#FFC800] text-[#0A121F]
                        font-display font-black text-sm hover:bg-[#ffd433] transition-colors">
                    Report your mark
                </button>
            )}

            <p className="text-[10px] text-[#4E6484] mt-2.5 leading-snug">
                {market.resolves_note || kind.resolves}
            </p>
        </motion.article>
    );
}
