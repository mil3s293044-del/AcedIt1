/**
 * PortfolioPanel — your own book.
 *
 * ─── Why the floor needed a second tab ──────────────────────────────────────
 * The board answers "what can I take a side on". It has no way to answer "how
 * am I doing", and that is the question that brings somebody back midweek. The
 * cred figure in the header is not an answer: it moves for two unrelated
 * reasons — the Monday grant and your own calls — so a student watching it
 * cannot tell which just happened, and a number that goes up when you did
 * nothing teaches that the number means nothing.
 *
 * ─── The order is deliberate ────────────────────────────────────────────────
 * Money first because it is what they came for, then CALIBRATION, then the
 * equity curve, then the positions. Calibration sits above the curve on
 * purpose: the curve is the score and calibration is the skill, and a student
 * who only ever reads the score learns nothing they can carry into the next
 * call. It is also the only thing here that a betting app could not show them.
 *
 * ─── EXPECTED IS NOT UNREALISED, and the label says so ──────────────────────
 * There is no way to close a position early on this board, so there is no exit
 * value and nothing is "unrealised" in the sense a trading screen means it.
 * What the tile holds is the expected payout at today's prices, which will keep
 * moving until the questions settle. Calling that unrealised P/L would imply a
 * sell button that does not exist.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {  } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { takeFn } from "@/lib/fnResult";
import { bookOf, equityCurve, calibration, outcomeOf } from "@/lib/holdings";
import { priceLabel, sideOf, YES, KINDS } from "@/lib/market";
import CalibrationCurve from "./CalibrationCurve";
import EquityCurve from "./EquityCurve";
import AceShuffle from "@/components/ace/AceShuffle";

const INK = { dim: "var(--floor-dim)", mid: "var(--floor-muted)", bright: "var(--floor-ink)",
    up: "var(--floor-yes-ink)", down: "var(--floor-no-ink)", gold: "var(--floor-warn-ink)" };

function Tile({ label, value, tone, note }) {
    return (
        <div className="rounded-xl bg-[var(--floor-card)] border-2 border-[var(--floor-edge)] px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--floor-dim)]">
                {label}
            </p>
            <p className="font-display font-black text-xl leading-none tabular-nums mt-1"
                style={{ color: tone || INK.bright }}>{value}</p>
            {note && <p className="text-[10px] mt-1 leading-snug" style={{ color: INK.dim }}>{note}</p>}
        </div>
    );
}

function Heading({ label, note }) {
    return (
        <div className="flex items-center gap-3 mb-2.5">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--floor-muted)]">
                {label}
            </h2>
            {note && <span className="text-[11px] font-bold text-[var(--floor-dim)]">{note}</span>}
            <span className="flex-1 h-px bg-[var(--floor-edge)]" aria-hidden="true" />
        </div>
    );
}

const signed = (n) => `${n > 0 ? "+" : ""}${Math.round(n).toLocaleString()}`;

export default function PortfolioPanel({ onOpenMarket }) {
    const [state, setState] = useState({ loading: true });

    const load = useCallback(async () => {
        try {
            const data = await takeFn(await base44.functions.invoke("getPortfolio", {}));
            setState({ loading: false, data });
        } catch (err) {
            setState({ loading: false, error: err?.message || String(err) });
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const holdings = state.data?.holdings || [];
    const book = useMemo(() => bookOf(holdings), [holdings]);
    const curve = useMemo(() => equityCurve(holdings), [holdings]);
    const cal = useMemo(() => calibration(holdings), [holdings]);

    if (state.loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <AceShuffle size="lg" label="Loading your book" ink="floor" />
            </div>
        );
    }
    if (state.error || state.data?.available === false) {
        return (
            <div className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] p-8 text-center">
                <p className="text-sm text-[var(--floor-muted)]">
                    {state.data?.reason || "Couldn't load your book just now."}
                </p>
            </div>
        );
    }
    if (!holdings.length) {
        return (
            <div className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] p-8 text-center">
                <p className="font-display font-black text-[var(--floor-ink)] text-base">
                    You haven&apos;t taken a side yet.
                </p>
                <p className="text-[13px] text-[var(--floor-muted)] mt-1.5 leading-snug max-w-sm mx-auto">
                    Once you do, this is where the results land — what you&apos;re holding, how
                    it&apos;s going, and whether your confidence matches your hit rate.
                </p>
            </div>
        );
    }

    const me = state.data?.me || {};
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Tile label="Cred" value={(me.cred ?? 0).toLocaleString()} />
                <Tile label="At stake" value={book.atStake.toLocaleString()}
                    note={`${book.open.length} open`} />
                <Tile label="Expected" value={signed(book.expected)}
                    tone={book.expected > 0 ? INK.up : book.expected < 0 ? INK.down : undefined}
                    note="at today's prices" />
                <Tile label="Settled" value={signed(book.realised)}
                    tone={book.realised > 0 ? INK.up : book.realised < 0 ? INK.down : undefined}
                    note={`${book.record.won}W · ${book.record.lost}L`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-5 items-start">
                <section>
                    <Heading label="Your calibration"
                        note={cal.ready && cal.bias != null
                            ? (Math.abs(cal.bias) < 0.05 ? "on the line"
                                : cal.bias > 0 ? `${Math.round(cal.bias * 100)} pts overconfident`
                                    : `${Math.round(Math.abs(cal.bias) * 100)} pts under`)
                            : null} />
                    <CalibrationCurve data={cal} />
                </section>

                <section>
                    <Heading label="Cred from your calls" />
                    {/* Matched to the calibration plot beside it. Two charts of
                        different heights in one row leaves a hole under the
                        shorter one, and the eye reads that as something that
                        failed to load rather than as the end of a section. */}
                    <EquityCurve curve={curve} height={190} />

                    {book.decided > 0 && (
                        <div className="flex items-center gap-4 mt-3 text-[11px]">
                            <span className="font-bold" style={{ color: INK.mid }}>
                                Hit rate <span className="tabular-nums"
                                    style={{ color: INK.bright }}>
                                    {Math.round(book.hitRate * 100)}%
                                </span>
                            </span>
                            {book.streak > 1 && (
                                <span className="font-bold" style={{ color: INK.up }}>
                                    {book.streak} in a row
                                </span>
                            )}
                            {/* Levels and voids are printed, never folded into
                                losses: "restating the price pays nothing" is the
                                property the whole board rests on. */}
                            {(book.record.level > 0 || book.record.void > 0) && (
                                <span style={{ color: INK.dim }}>
                                    {book.record.level > 0 && `${book.record.level} level`}
                                    {book.record.level > 0 && book.record.void > 0 && " · "}
                                    {book.record.void > 0 && `${book.record.void} void`}
                                </span>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {book.open.length > 0 && (
                <section>
                    <Heading label="Open" note={`${book.open.length}`} />
                    <div className="rounded-xl border-2 border-[var(--floor-edge)] overflow-hidden">
                        {book.open.map((h, i) => {
                            const side = sideOf(h.p) === YES;
                            const now = h.market?.price;
                            const drift = now != null
                                ? Math.round((now - h.price_at_entry) * 100) : null;
                            // Toward you if the room has come around to your side.
                            const toward = drift == null ? 0 : (side ? drift : -drift);
                            return (
                                <button key={h.id} type="button"
                                    onClick={() => onOpenMarket?.(h.market_id)}
                                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5
                                        hover:bg-[var(--floor-inset)] transition-colors
                                        ${i ? "border-t border-[var(--floor-edge)]" : ""}`}>
                                    <span className="text-[10px] font-black uppercase tracking-wide
                                        w-8 flex-shrink-0"
                                        style={{ color: side ? INK.up : INK.down }}>
                                        {side ? "Yes" : "No"}
                                    </span>
                                    <span className="flex-1 min-w-0 truncate text-[12px] font-bold
                                        text-[var(--floor-ink)]">
                                        {h.market?.title || "—"}
                                    </span>
                                    <span className="text-[11px] tabular-nums flex-shrink-0"
                                        style={{ color: INK.dim }}>
                                        {h.stake} @ {priceLabel(h.price_at_entry)}
                                    </span>
                                    <span className="text-[11px] font-bold tabular-nums w-14
                                        text-right flex-shrink-0"
                                        style={{ color: toward > 0 ? INK.up : toward < 0 ? INK.down : INK.dim }}>
                                        {drift == null ? "—"
                                            : `${toward > 0 ? "+" : ""}${toward} pts`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] mt-1.5 leading-snug" style={{ color: INK.dim }}>
                        Points are how far the room has come toward your side since you took it.
                    </p>
                </section>
            )}

            {book.closed.length > 0 && (
                <section>
                    <Heading label="Settled" note={`${book.closed.length}`} />
                    <div className="rounded-xl border-2 border-[var(--floor-edge)] overflow-hidden">
                        {[...book.closed].reverse().slice(0, 12).map((h, i) => {
                            const o = outcomeOf(h);
                            const payout = Math.round(Number(h.payout) || 0);
                            const tone = o === "won" ? INK.up : o === "lost" ? INK.down : INK.mid;
                            return (
                                <button key={h.id} type="button"
                                    onClick={() => onOpenMarket?.(h.market_id)}
                                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5
                                        hover:bg-[var(--floor-inset)] transition-colors
                                        ${i ? "border-t border-[var(--floor-edge)]" : ""}`}>
                                    <span className="text-[9px] font-black uppercase tracking-widest
                                        w-10 flex-shrink-0" style={{ color: tone }}>
                                        {o === "void" ? "void" : o}
                                    </span>
                                    <span className="flex-1 min-w-0 truncate text-[12px] font-bold
                                        text-[var(--floor-ink)]">
                                        {h.market?.title || "—"}
                                    </span>
                                    <span className="text-[10px] flex-shrink-0 hidden sm:inline"
                                        style={{ color: INK.dim }}>
                                        {KINDS[h.market?.kind]?.label || ""}
                                    </span>
                                    <span className="text-[11px] font-black tabular-nums w-14
                                        text-right flex-shrink-0" style={{ color: tone }}>
                                        {o === "void" ? "—" : signed(payout)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
