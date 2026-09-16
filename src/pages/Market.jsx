/**
 * Market — one question, in full.
 *
 * ─── Why a page and not an expanding card ───────────────────────────────────
 * A market is a thing you send somebody. "Twelve people are trading your week"
 * is the most motivating sentence this app can print, and it is worth far more
 * with a link under it. An in-place expansion keeps your scroll position and
 * loses that entirely, which is the wrong trade for the one screen the whole
 * social case rests on. The id rides in the QUERY STRING because
 * `createPageUrl` builds `/PageName` and every cross-page link in the app is
 * built with it — a second URL scheme for one page is how routes start
 * disagreeing with the router (the rule SubjectHub already follows).
 *
 * ─── THE TAPE IS THE CONVERSATION ───────────────────────────────────────────
 * The board card shows a summary because thirty of them share a screen. This
 * shows every position with a name on it, because the interesting thing about a
 * market with fourteen people in it IS the fourteen people. "Maya took no at
 * 71¢ with 300 cred" is a statement with a name and money behind it — and it is
 * the reason this page needs no comment box to be social. See Reactions.jsx for
 * why there isn't one.
 *
 * ─── It never invents the room ──────────────────────────────────────────────
 * Everything here comes from `getMarket`, which returns the real positions and
 * the real reactions. A market that has gone (deleted, or an id somebody typed)
 * says so and offers the way back, rather than rendering an empty page that
 * looks like a question nobody has traded.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { ArrowLeft, Clock, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { takeFn, fnError } from "@/lib/fnResult";
import { createPageUrl } from "@/utils";
import Room from "@/components/market/Room";
import PriceChart from "@/components/market/PriceChart";
import TakeSide from "@/components/market/TakeSide";
import Reactions from "@/components/market/Reactions";
import AceShuffle from "@/components/ace/AceShuffle";
import {
    KINDS, readMarket, priceHistory, priceLabel, sideOf, YES,
    payoutFor, markToMarket, blockReason, settlementOf,
} from "@/lib/market";

const INK = { dim: "var(--floor-dim)", mid: "var(--floor-muted)", bright: "var(--floor-ink)",
    up: "var(--floor-yes-ink)", down: "var(--floor-no-ink)", gold: "var(--floor-warn-ink)" };

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";

function when(iso) {
    const t = new Date(iso || 0).getTime();
    if (!Number.isFinite(t) || t <= 0) return "";
    return new Date(t).toLocaleDateString(undefined,
        { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function until(iso) {
    const t = new Date(iso || 0).getTime();
    if (!Number.isFinite(t) || t <= 0) return null;
    const ms = t - Date.now();
    if (ms <= 0) return "closed";
    const mins = Math.floor(ms / 60000);
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    return h > 0 ? `${h}h` : `${mins}m`;
}

export default function Market() {
    const id = useMemo(() => {
        try { return new URLSearchParams(window.location.search).get("id"); }
        catch { return null; }
    }, []);
    const [state, setState] = useState({ loading: true });
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!id) { setState({ loading: false, missing: true }); return; }
        try {
            const data = await takeFn(await base44.functions.invoke("getMarket", { market_id: id }));
            setState({ loading: false, data });
        } catch (err) {
            setState({ loading: false, error: err?.message || String(err) });
        }
    }, [id]);
    useEffect(() => { load(); }, [load]);

    const raw = state.data?.market;
    const market = useMemo(
        () => (raw ? readMarket(raw, raw.positions || [], state.data?.me?.email) : null),
        [raw, state.data]);
    const history = useMemo(() => (market ? priceHistory(market) : null), [market]);
    const settled = useMemo(
        () => (market ? settlementOf(market, state.data?.me?.email) : null),
        [market, state.data]);

    const take = async (pick) => {
        setBusy(true); setError(null);
        try {
            const res = await base44.functions.invoke("takePosition", {
                market_id: id, side: pick.side,
                conviction: pick.conviction, stake: pick.stake,
            });
            const bad = fnError(res);
            if (bad) throw new Error(bad);
            setOpen(false);
            await load();
        } catch (err) {
            setError(err?.message || String(err));
        } finally {
            setBusy(false);
        }
    };

    const back = (
        <a href={createPageUrl("Competitions")}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--floor-muted-2)]
                hover:text-[var(--floor-ink)] transition-colors mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> The floor
        </a>
    );

    if (state.loading) {
        return (
            <Room>
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <AceShuffle size="lg" label="Opening it" ink="floor" />
                    <p className="text-sm text-[var(--floor-muted-2)]">Opening it…</p>
                </div>
            </Room>
        );
    }

    if (!market) {
        return (
            <Room>
                <div className="max-w-md mx-auto text-center py-24">
                    {back}
                    <p className="font-display font-black text-[var(--floor-ink)] text-lg">
                        {state.data?.available === false
                            ? "The floor isn't open yet."
                            : "That question isn't here any more."}
                    </p>
                    <p className="text-[13px] text-[var(--floor-muted)] mt-2 leading-snug">
                        {state.data?.reason
                            || state.error
                            || "It may have settled and been cleared, or the link is wrong."}
                    </p>
                </div>
            </Room>
        );
    }

    const kind = KINDS[market.kind] || KINDS.streak;
    const KindIcon = Icons[kind.icon] || Icons.CircleDot;
    const left = until(market.closes_at);
    const mine = market.mine;
    const blocked = market.blocked || blockReason(market, state.data?.me?.email);
    const myEntry = mine?.created_date
        ? { t: new Date(mine.created_date).getTime(), price: Number(mine.price_at_entry) }
        : null;
    const mtm = mine ? markToMarket(mine, market.price) : null;
    const reactions = state.data?.reactions || { market: {}, positions: {}, mine: {} };

    return (
        <Room>
            <div className="max-w-3xl mx-auto">
                {back}

                {/* ── The question ─────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black
                        uppercase tracking-widest text-[var(--floor-muted-2)]">
                        <KindIcon className="w-3.5 h-3.5" /> {kind.label}
                    </span>
                    {left && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold
                            tabular-nums text-[var(--floor-muted-2)]">
                            <Clock className="w-3 h-3" /> {left}
                        </span>
                    )}
                </div>
                <h1 className="font-display font-black text-[var(--floor-ink)] text-xl sm:text-2xl
                    leading-tight">{market.title}</h1>
                {market.subject_is_me && market.traders > 0 && (
                    <p className="text-[13px] font-bold text-[var(--floor-warn-ink)] mt-1.5">
                        {market.traders === 1
                            ? "Someone is trading this."
                            : `${market.traders} people are trading this.`}
                    </p>
                )}

                {/* ── Where it stands ──────────────────────────────── */}
                <div className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] p-4 mt-4">
                    <PriceChart history={history} myEntry={myEntry} height={200} />
                </div>

                {market.status !== "open" && (
                    <div className="rounded-2xl border-2 p-4 mt-3"
                        style={{ borderColor: `${market.status === "void" ? INK.mid : INK.gold}55`,
                            background: "var(--floor-card)" }}>
                        <p className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: INK.dim }}>Settled</p>
                        <p className="font-display font-black text-[var(--floor-ink)] text-lg mt-0.5">
                            {market.status === "void"
                                ? "Voided — every stake came back whole."
                                : `It resolved ${market.outcome ? "YES" : "NO"}.`}
                        </p>
                        {market.resolution_note && (
                            <p className="text-[12px] mt-1" style={{ color: INK.mid }}>
                                {market.resolution_note}
                            </p>
                        )}
                        {settled && settled.kind !== "void" && (
                            <p className="text-[13px] mt-2" style={{ color: INK.mid }}>
                                You said <span className="font-bold" style={{ color: INK.bright }}>
                                    {settled.said}¢</span>, the room said{" "}
                                <span className="font-bold" style={{ color: INK.bright }}>
                                    {settled.room}¢</span> —{" "}
                                <span className="font-black tabular-nums"
                                    style={{ color: settled.payout > 0 ? INK.up
                                        : settled.payout < 0 ? INK.down : INK.mid }}>
                                    {settled.payout > 0 ? "+" : ""}{settled.payout} cred
                                </span>
                            </p>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mt-3 rounded-xl border-2 border-[rgb(var(--floor-no-rgb)/0.4)] bg-[rgb(var(--floor-no-rgb)/0.1)]
                        px-4 py-2.5 text-[13px] text-[var(--floor-no-soft)]">{error}</div>
                )}

                {/* ── Your side ────────────────────────────────────── */}
                {mine ? (
                    <div className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] p-4 mt-3">
                        <p className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: INK.dim }}>Your position</p>
                        <p className="text-[14px] font-bold mt-1" style={{ color: INK.mid }}>
                            <span style={{ color: sideOf(mine.p) === YES ? INK.up : INK.down }}>
                                {sideOf(mine.p) === YES ? "YES" : "NO"}
                            </span>
                            {` · ${mine.stake} cred at ${priceLabel(mine.price_at_entry)}`}
                        </p>
                        {market.status === "open" && mtm && (
                            <p className="text-[12px] mt-1.5 tabular-nums" style={{ color: INK.dim }}>
                                <span style={{ color: INK.up }}>
                                    {mtm.ifYes > 0 ? "+" : ""}{mtm.ifYes}
                                </span> if yes ·{" "}
                                <span style={{ color: INK.down }}>
                                    {mtm.ifNo > 0 ? "+" : ""}{mtm.ifNo}
                                </span> if no
                            </p>
                        )}
                    </div>
                ) : market.status === "open" && (
                    // A CARD AROUND A SINGLE BUTTON IS A BOX AROUND NOTHING.
                    // The panel only earns its border once there is a form
                    // inside it; collapsed, the button is the whole control and
                    // wrapping it in a bordered card just prints a large empty
                    // rectangle. Same paper-cut as the single-tab Tabs bar.
                    open ? (
                        <div className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] p-4 mt-3">
                            <TakeSide price={market.price} balance={state.data?.me?.cred ?? 0}
                                busy={busy} history={history} myEntry={myEntry}
                                onCancel={() => setOpen(false)} onTake={take} />
                        </div>
                    ) : blocked ? (
                        <p className="flex items-start gap-1.5 text-[12px] leading-snug mt-3"
                            style={{ color: INK.mid }}>
                            <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {blocked}
                        </p>
                    ) : (
                        <button type="button" onClick={() => setOpen(true)}
                            className="w-full mt-3 py-3 rounded-xl border-2 border-[var(--floor-edge-strong)]
                                text-[var(--floor-ink)] font-display font-black text-sm
                                hover:border-[var(--floor-accent-ink)] hover:bg-[rgb(var(--floor-accent-rgb)/0.1)] transition-colors">
                            Take a side
                        </button>
                    )
                )}

                <div className="mt-3">
                    <Reactions marketId={market.id} counts={reactions.market}
                        mine={reactions.mine?.market} />
                </div>

                {/* ── The tape ─────────────────────────────────────── */}
                <div className="flex items-center gap-3 mt-6 mb-2.5">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--floor-muted)]">
                        Who&apos;s on it
                    </h2>
                    <span className="text-[11px] font-bold" style={{ color: INK.dim }}>
                        {market.traders === 0 ? "nobody yet" : `${market.traders}`}
                    </span>
                    <span className="flex-1 h-px bg-[var(--floor-edge)]" aria-hidden="true" />
                </div>

                {market.positions.length === 0 ? (
                    <p className="text-[13px] rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)]
                        p-6 text-center" style={{ color: INK.mid }}>
                        No one has taken a side yet. The first position is what starts the price
                        moving.
                    </p>
                ) : (
                    <ul className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] overflow-hidden">
                        {market.positions.map((p, i) => {
                            const yes = sideOf(p.p) === YES;
                            const win = payoutFor(p.stake, p.p, p.price_at_entry, yes);
                            return (
                                <motion.li key={p.id}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    transition={{ delay: Math.min(0.2, i * 0.03) }}
                                    className={`px-4 py-3 ${i ? "border-t border-[var(--floor-edge)]" : ""}
                                        ${p.is_me ? "bg-[rgb(var(--floor-warn-rgb)/0.05)]" : ""}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black uppercase
                                            tracking-wide w-9 flex-shrink-0"
                                            style={{ color: yes ? INK.up : INK.down }}>
                                            {yes ? "Yes" : "No"}
                                        </span>
                                        <span className="flex-1 min-w-0 truncate text-[13px] font-bold"
                                            style={{ color: p.is_me ? INK.gold : INK.bright }}>
                                            {p.is_me ? "You" : firstName(p.user_name)}
                                            {p.is_friend && !p.is_me && (
                                                <span className="ml-1.5 text-[10px] font-bold"
                                                    style={{ color: INK.dim }}>friend</span>
                                            )}
                                        </span>
                                        <span className="text-[11px] tabular-nums flex-shrink-0"
                                            style={{ color: INK.mid }}>
                                            {p.stake} @ {priceLabel(p.price_at_entry)}
                                        </span>
                                        <span className="text-[11px] tabular-nums flex-shrink-0
                                            hidden sm:inline w-20 text-right"
                                            style={{ color: INK.dim }}>
                                            {p.settled_at
                                                ? `${Number(p.payout) > 0 ? "+" : ""}${Math.round(Number(p.payout) || 0)}`
                                                : `${win > 0 ? "+" : ""}${win} if right`}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 mt-1.5">
                                        <span className="text-[10px]" style={{ color: INK.dim }}>
                                            {when(p.created_date)}
                                        </span>
                                        <Reactions size="sm" marketId={market.id} positionId={p.id}
                                            counts={reactions.positions?.[p.id] || {}}
                                            mine={reactions.mine?.positions?.[p.id] || null} />
                                    </div>
                                </motion.li>
                            );
                        })}
                    </ul>
                )}

                {/* ── How it settles ───────────────────────────────── */}
                <p className="text-[11px] mt-4 leading-snug" style={{ color: INK.dim }}>
                    {market.resolves_note || kind.resolves}
                </p>
            </div>
        </Room>
    );
}
