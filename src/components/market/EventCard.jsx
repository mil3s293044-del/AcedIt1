/**
 * EventCard — one slate question with several answers, each with its own price.
 *
 * ─── A MARKET OF QUESTIONS WITHOUT A FLOOD OF CARDS ─────────────────────────
 * "Who tops this week's League?" is four questions — one per name, and one for
 * everybody else — and drawn as four MarketCards it would be four cards saying
 * the same title with a different word in it. Drawn as one card with four
 * priced rows it is what a student is actually looking at: a race, with the
 * room's read on every runner side by side. The board gets denser without
 * getting longer, which is the whole of what the slate is for.
 *
 * ─── EACH ROW IS AN ORDINARY MARKET UNDERNEATH ──────────────────────────────
 * Every answer is its own binary market (`meta.group` ties them together), so
 * the price, the payout, the settlement and the commit sheet are exactly the
 * ones every other question uses. That is why the prices do not have to add to
 * 100: each is the room's read on "will THIS one happen", and printing a
 * normalised figure that differs from the one a call is scored against would
 * break the rule that the printed price is always the true price.
 *
 * ─── THE ROWS DO NOT RE-SORT ────────────────────────────────────────────────
 * They stay in the order they were minted (last week's form, the field last).
 * Re-ranking by price would move the row a student is reaching for out from
 * under their finger every time somebody else called — the board's live tick
 * makes that a real hazard, not a hypothetical one.
 *
 * ─── YOUR NAME ON THE CARD ──────────────────────────────────────────────────
 * When a student is one of the names, only their own row takes a call from
 * them, and only for themselves (`sideBlockReason`). The other rows say so
 * rather than offering a button that the server will refuse.
 */
import React, { useState } from "react";
import { Clock, Lock, Trophy, Users, BookOpen, ChevronDown } from "lucide-react";
import TakeSide from "./TakeSide";
import { useCallClock, useJustCalled, CallStamp } from "./MarketCard";
import { YES, NO, sideOf, priceLabel, sideBlockReason, convictionRange, groupPrices } from "@/lib/market";

const KIND_OF = {
    league_top: { label: "The League", Icon: Trophy },
    total_bracket: { label: "The board", Icon: Users },
    top_subject: { label: "Subjects", Icon: BookOpen },
};

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";

/** Whether any call at all is open to this student on a row. */
const callable = (row) =>
    [YES, NO].some((v) => !sideBlockReason(row, v) && convictionRange(v, row.price).tradeable);

export default function EventCard({ entry, balance, busy, onTake, fresh = false }) {
    const [openId, setOpenId] = useState(null);
    const rows = entry.rows;
    const head = rows[0] || {};
    const { label, Icon } = KIND_OF[head.meta?.metric] || { label: "The slate", Icon: Users };
    const { locked, left, closing } = useCallClock(head);
    const mineRow = rows.find((r) => r.mine) || null;
    const justCalled = useJustCalled(mineRow?.mine || null);
    const aboutMe = rows.some((r) => r.about_me);
    const callers = new Set(rows.flatMap((r) => (r.positions || []).map((p) => p.id))).size;

    return (
        <article data-event-card
            className={`relative rounded-2xl border-2 p-4 bg-[var(--floor-card)] transition-colors
                ${aboutMe ? "border-[rgb(var(--floor-warn-rgb)/0.6)]"
                    : "border-[var(--floor-edge)] hover:border-[var(--floor-edge-hover)]"}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black
                    uppercase tracking-widest text-[var(--floor-muted-2)]">
                    <Icon className="w-3.5 h-3.5" /> {label}
                    {fresh && (
                        <span className="ml-1 rounded-md bg-[var(--floor-accent)] px-1.5 py-0.5
                            text-[9px] text-[var(--floor-on-bright)] tracking-wider">New</span>
                    )}
                </span>
                {locked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--floor-muted-2)]">
                        <Lock className="w-3 h-3" /> Locked
                    </span>
                ) : left && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums
                        ${closing ? "text-[var(--floor-warn-ink)]" : "text-[var(--floor-muted-2)]"}`}>
                        <Clock className="w-3 h-3" /> last call {left}
                    </span>
                )}
            </div>
            <CallStamp show={justCalled}
                text={mineRow ? `Called · ${sideOf(mineRow.mine.p) === YES ? "" : "not "}${mineRow.meta?.outcome || ""}` : ""} />

            <h3 className="font-display font-extrabold text-base leading-snug mb-3 text-[var(--floor-ink)]">
                {entry.title}
            </h3>

            <div className="space-y-1.5">
                {rows.map((r) => {
                    const pct = Math.round((Number(r.price) || 0) * 100);
                    const me = r.mine;
                    const can = !locked && !me && callable(r);
                    const own = r.about_me && r.own_outcome;
                    const open = openId === r.id && can;
                    return (
                        <div key={r.id} data-outcome-row
                            className={`rounded-xl px-3 py-2 transition-colors
                                ${me ? "bg-[rgb(var(--floor-accent-rgb)/0.12)]" : "bg-[var(--floor-well)]"}`}>
                            <div className="flex items-center gap-3">
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-baseline justify-between gap-2">
                                        <span className={`text-[13px] font-bold truncate
                                            ${own ? "text-[var(--floor-warn-ink)]" : "text-[var(--floor-ink)]"}`}>
                                            {r.meta?.outcome || r.title}
                                            {own && <span className="font-medium"> · you</span>}
                                        </span>
                                        <span className="font-display font-black text-[15px] tabular-nums text-[var(--floor-ink)]">
                                            {priceLabel(r.price)}
                                        </span>
                                    </span>
                                    {/* The room's read on this answer, as a length.
                                        One ink for every row: colour here would
                                        say yes/no, and a row is not a side. */}
                                    <span className="mt-1 block h-1.5 rounded-full bg-[var(--floor-edge)] overflow-hidden" aria-hidden="true">
                                        <span className="block h-full rounded-full bg-[var(--floor-accent)] transition-[width] duration-500"
                                            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
                                    </span>
                                </span>
                                <span className="w-[4.5rem] flex-shrink-0 text-right">
                                    {me ? (
                                        <span className={`text-[11px] font-black ${sideOf(me.p) === YES
                                            ? "text-[var(--floor-yes-ink)]" : "text-[var(--floor-no-ink)]"}`}>
                                            You: {sideOf(me.p) === YES ? "yes" : "no"}
                                        </span>
                                    ) : can ? (
                                        <button type="button"
                                            onClick={() => setOpenId(open ? null : r.id)}
                                            aria-expanded={open}
                                            className={`inline-flex items-center gap-1 rounded-lg border-2 px-2.5 py-1
                                                text-[12px] font-display font-black transition-colors
                                                ${open ? "border-[var(--floor-accent-ink)] text-[var(--floor-accent-ink)]"
                                                    : "border-[var(--floor-edge-strong)] text-[var(--floor-ink)] hover:border-[var(--floor-accent-ink)]"}`}>
                                            {own ? "Back" : "Call"}
                                            <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
                                        </button>
                                    ) : (
                                        <Lock className="w-3.5 h-3.5 ml-auto text-[var(--floor-dim)]"
                                            aria-label={locked ? "Locked" : "Not open to you"} />
                                    )}
                                </span>
                            </div>
                            {r.traders > 0 && (
                                <p className="mt-1 text-[10px] font-bold text-[var(--floor-dim)] truncate">
                                    {(r.positions || []).slice(0, 3).map((p) => firstName(p.user_name)).join(", ")}
                                    {r.traders > 3 ? ` +${r.traders - 3}` : ""}
                                    {" "}· {r.yesCount} yes, {r.noCount} no
                                </p>
                            )}
                            {open && (
                                <TakeSide market={r} price={r.price} balance={balance} busy={busy}
                                    priceAfter={(call) => groupPrices(rows.map((x) => (x.id === r.id
                                        ? { ...x, positions: [...(x.positions || []), call] } : x))).get(r.id)}
                                    onCancel={() => setOpenId(null)}
                                    onTake={async (pick) => { await onTake?.(r, pick); setOpenId(null); }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {aboutMe && !locked && !openId && (
                <p className="mt-2.5 text-[11px] text-[var(--floor-muted-2)] leading-snug">
                    Your name is on this card, so the only call open to you is backing yourself.
                </p>
            )}
            <div className="flex items-center justify-between gap-3 mt-3">
                <p className="text-[10px] text-[var(--floor-dim)] leading-snug min-w-0">
                    {head.resolves_note}
                </p>
                <span className="text-[10px] font-bold text-[var(--floor-dim)] flex-shrink-0 tabular-nums">
                    {callers === 0 ? "No calls yet" : `${callers} ${callers === 1 ? "call" : "calls"}`}
                </span>
            </div>
        </article>
    );
}
