/**
 * PortfolioPanel — your own book, drawn the way a book is drawn.
 *
 * ═══ Why the floor needed a second tab ══════════════════════════════════════
 * The board answers "what can I take a side on". It has no way to answer "how
 * am I doing", and that is the question that brings somebody back midweek. The
 * cred figure in the header is not an answer: it moves for two unrelated
 * reasons — the Monday grant and your own calls — so a student watching it
 * cannot tell which just happened, and a number that goes up when you did
 * nothing teaches that the number means nothing.
 *
 * ═══ IT HAD EVERYTHING EXCEPT A HIERARCHY ═══════════════════════════════════
 * The content was already right — value, exposure, calibration, equity, open
 * and settled. What made it read as a form rather than as a trading screen was
 * that NOTHING LED. Four identically-sized tiles sat in a row with no first
 * number among them; the equity curve, which is the whole story of somebody's
 * week, was in a 190px box in the second column; and the positions were plain
 * text lines where the one figure that matters was a 14px column on the right.
 *
 * Every broker app opens the same way and it is not decoration: ONE value,
 * large, with what you made under it, and the chart of that number filling the
 * width beneath. That ordering is the argument — this is what you have, this is
 * what you did to get it, here is the path. The rest is detail and is drawn as
 * detail.
 *
 * ═══ THE HERO IS A BALANCE AND THE DELTA IS THE PART YOU EARNED ═════════════
 * Value is `cred + at stake`: what is in your hand plus what is escrowed in
 * open questions, both of which are real cred you hold. Under it, `realised` —
 * what your own calls have paid, which is exactly what the curve draws. That
 * split is what fixes the complaint the top of this file has always carried:
 * the big number is allowed to include the grant because it is a BALANCE, and
 * the number attributed to the student is the one they actually earned.
 *
 * **EXPECTED IS NOT IN THE HERO.** There is no way to close a position early
 * here, so the open book's EV is not something you could take — folding it into
 * a headline balance would be the same overreach as calling it unrealised P/L,
 * which this file has refused since it was written. It is a line of its own.
 *
 * ═══ THE DRIFT BAR IS ON ONE SCALE, or it is not a comparison ═══════════════
 * A position row's job is "has the room come toward me", and "+11 pts" is that
 * fact printed rather than drawn. The obvious drawing — a track spanning THIS
 * row's entry and current price — is worse than the text: every row gets its
 * own scale, so a 2-point drift and a 30-point drift render identically and the
 * column becomes actively misleading. It is a signed bar from a shared centre
 * on a fixed ±`DRIFT_FULL` scale instead, so row against row is a real
 * comparison, with the number still printed beside it for anything past the end.
 *
 * ═══ A BAND, NEVER A POSITION ══════════════════════════════════════════════
 * The standing says "ahead of 68% of traders" and nothing else. "4th of 31" is
 * a leaderboard and Compete already has one; a second on the page that exists
 * to answer "how am I doing" turns a private screen into a public one. The
 * server sends bare figures with no addresses attached, `standingOf` refuses
 * under `RANK_MIN_CALLS`, and there is nothing in the payload to put a name to.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { takeFn } from "@/lib/fnResult";
import {
    bookOf, equityCurve, calibration, outcomeOf, exposureOf, standingOf,
} from "@/lib/holdings";
import { priceLabel, sideOf, YES, KINDS } from "@/lib/market";
import CalibrationCurve from "./CalibrationCurve";
import EquityCurve from "./EquityCurve";
import AceShuffle from "@/components/ace/AceShuffle";
import LiveNumber from "@/components/shared/LiveNumber";

const INK = { dim: "var(--floor-dim)", mid: "var(--floor-muted)", bright: "var(--floor-ink)",
    up: "var(--floor-yes-ink)", down: "var(--floor-no-ink)", gold: "var(--floor-warn-ink)" };

const signed = (n) => `${n > 0 ? "+" : ""}${Math.round(n).toLocaleString()}`;
const toneOf = (n) => (n > 0 ? INK.up : n < 0 ? INK.down : INK.mid);

/** How far the room can move before the drift bar is simply full. */
const DRIFT_FULL = 25;

/**
 * The windows the curve can be read over.
 *
 * ALL is first in the data and LAST in the row, because it is the default and a
 * selector whose default sits in the middle reads as a filter somebody applied.
 */
const SPANS = [
    { id: "1W", label: "1W", days: 7 },
    { id: "1M", label: "1M", days: 30 },
    { id: "ALL", label: "All", days: null },
];

/* ── Small parts ─────────────────────────────────────────────────────────── */

/** A figure and its label, inline. Detail, drawn as detail. */
function Stat({ label, value, tone, note }) {
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest truncate"
                style={{ color: INK.dim }}>{label}</p>
            <p className="font-display font-black text-base leading-none tabular-nums mt-1"
                style={{ color: tone || INK.bright }}>{value}</p>
            {note && <p className="text-[10px] mt-0.5 truncate" style={{ color: INK.dim }}>{note}</p>}
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

/**
 * How far the room has moved toward you since you took your side, on a scale
 * shared with every other row. See the header for why it is not a per-row track.
 */
function DriftBar({ pts }) {
    if (pts == null) return <span className="w-[72px] flex-shrink-0" />;
    const clamped = Math.max(-DRIFT_FULL, Math.min(DRIFT_FULL, pts));
    const frac = Math.abs(clamped) / DRIFT_FULL;
    const tone = pts > 0 ? INK.up : pts < 0 ? INK.down : INK.dim;
    return (
        <span className="w-[72px] flex-shrink-0 flex items-center gap-1.5">
            <span className="relative h-1.5 flex-1 rounded-full bg-[var(--floor-inset)]">
                {/* The centre is "the room has not moved", so the bar grows out
                    of it in the direction the price went rather than filling
                    from one end — which would draw a loss as a small win. */}
                <span aria-hidden="true" className="absolute top-0 bottom-0 w-px"
                    style={{ left: "50%", background: "var(--floor-edge-strong)" }} />
                <span aria-hidden="true" className="absolute top-0 bottom-0 rounded-full"
                    style={{
                        background: tone,
                        width: `${frac * 50}%`,
                        left: pts >= 0 ? "50%" : undefined,
                        right: pts < 0 ? "50%" : undefined,
                    }} />
            </span>
            <span className="text-[10px] font-bold tabular-nums w-7 text-right"
                style={{ color: tone }}>
                {pts > 0 ? "+" : ""}{pts}
            </span>
        </span>
    );
}

/** Where the open stake actually is. One bar, biggest slice first. */
function Exposure({ data }) {
    if (!data.total) return null;
    // The floor's own hues, in order, so two slices never share one.
    // Four hues the floor can actually tell apart, and one neutral for the
    // folded tail — which is why `exposureOf` caps the slices rather than the
    // legend doing it: a bar with more bands than distinguishable colours is a
    // bar that says the same thing twice.
    const BANDS = ["var(--floor-accent-ink)", "var(--floor-yes-ink)",
        "var(--floor-warn-ink)", "var(--floor-no-ink)", "var(--floor-muted-2)"];
    const nameOf = (s) => (s.kind === "other"
        ? `${s.folded} more` : (KINDS[s.kind]?.label || s.kind));
    return (
        <div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--floor-inset)]">
                {data.slices.map((s, i) => (
                    <span key={s.kind} title={`${nameOf(s)}: ${s.stake}`}
                        style={{ width: `${s.share * 100}%`, background: BANDS[i % BANDS.length] }} />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                {data.slices.map((s, i) => (
                    <span key={s.kind} className="inline-flex items-center gap-1.5 text-[11px]"
                        style={{ color: INK.mid }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: BANDS[i % BANDS.length] }} />
                        {nameOf(s)}
                        <span className="tabular-nums font-bold" style={{ color: INK.bright }}>
                            {Math.round(s.share * 100)}%
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Your best and worst call, side by side. Neither is a highlight reel alone. */
function Extremes({ best, worst, onOpen }) {
    const cards = [
        { h: best, label: "Best call", tone: INK.up },
        { h: worst, label: "Worst call", tone: INK.down },
    ].filter((c) => c.h && c.h.id !== undefined);
    // The same call cannot be both — with one settled result there is no
    // contrast to draw and the pair would print one row twice.
    if (cards.length < 2 || best?.id === worst?.id) return null;
    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
            {cards.map(({ h, label, tone }) => (
                <button key={label} type="button" onClick={() => onOpen?.(h.market_id)}
                    className="text-left rounded-xl border-2 border-[var(--floor-edge)]
                        bg-[var(--floor-card)] px-3 py-2.5 hover:border-[var(--floor-edge-hover)]
                        transition-colors">
                    <p className="text-[9px] font-black uppercase tracking-widest"
                        style={{ color: INK.dim }}>{label}</p>
                    <p className="text-[12px] font-bold text-[var(--floor-ink)] truncate mt-1">
                        {h.market?.title || "—"}
                    </p>
                    <p className="font-display font-black text-lg tabular-nums leading-none mt-1.5"
                        style={{ color: tone }}>
                        {signed(Math.round(Number(h.payout) || 0))}
                        <span className="text-[10px] font-bold ml-1.5" style={{ color: INK.dim }}>
                            from {h.stake} at {priceLabel(h.price_at_entry)}
                        </span>
                    </p>
                </button>
            ))}
        </div>
    );
}

/* ── The page ────────────────────────────────────────────────────────────── */

export default function PortfolioPanel({ onOpenMarket }) {
    const [state, setState] = useState({ loading: true });
    const [span, setSpan] = useState("ALL");

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
    const cal = useMemo(() => calibration(holdings), [holdings]);
    const exposure = useMemo(() => exposureOf(book.open), [book.open]);

    // The curve over the chosen window. Filtered on the HOLDINGS rather than on
    // the finished curve, so "1W" starts at zero on Monday and draws what this
    // week did — slicing the points instead would start the line wherever the
    // running total happened to be and call that week's work a windfall.
    const curve = useMemo(() => {
        const days = SPANS.find((s) => s.id === span)?.days;
        if (!days) return equityCurve(holdings);
        const from = Date.now() - days * 864e5;
        return equityCurve(holdings.filter(
            (h) => new Date(h.settled_at || 0).getTime() >= from));
    }, [holdings, span]);

    const standing = useMemo(
        () => standingOf(book.realised, state.data?.peers, { decided: book.decided }),
        [book.realised, book.decided, state.data]);

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
    const value = (me.cred ?? 0) + book.atStake;

    return (
        <div className="space-y-5">
            {/* ── THE HERO ─────────────────────────────────────────── */}
            <section className="rounded-2xl border-2 border-[var(--floor-edge)]
                bg-[var(--floor-card)] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: INK.dim }}>Your book</p>
                        <p className="font-display font-black text-4xl sm:text-5xl leading-none
                            tabular-nums mt-1.5 text-[var(--floor-ink)]">
                            <LiveNumber value={value} showDelta={false} />
                            <span className="text-base font-bold ml-2" style={{ color: INK.dim }}>
                                cred
                            </span>
                        </p>
                        {/* The part they earned, under the balance that includes
                            the grant. See the header. */}
                        <p className="text-[13px] font-bold mt-2 tabular-nums"
                            style={{ color: toneOf(book.realised) }}>
                            {book.realised > 0 ? "▲" : book.realised < 0 ? "▼" : "■"}{" "}
                            {signed(book.realised)}
                            <span className="font-medium" style={{ color: INK.mid }}>
                                {" "}from your calls
                                {span !== "ALL" && ` · last ${span === "1W" ? "week" : "month"}`}
                            </span>
                        </p>
                    </div>

                    {/* The window. Right-aligned, where a chart's controls go. */}
                    <div className="flex gap-1">
                        {SPANS.map((s) => (
                            <button key={s.id} type="button" onClick={() => setSpan(s.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-black
                                    tabular-nums transition-colors ${span === s.id
                                    ? "bg-[var(--floor-solid)] text-[var(--floor-on-solid)]"
                                    : "text-[var(--floor-dim)] hover:text-[var(--floor-ink)]"}`}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* The chart of the number above it, full width. */}
                <div className="mt-3">
                    <EquityCurve curve={curve} height={150} footer={false} />
                </div>

                {/* Detail, drawn as detail. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4
                    border-t border-[var(--floor-edge)]">
                    <Stat label="In hand" value={(me.cred ?? 0).toLocaleString()} />
                    <Stat label="At stake" value={book.atStake.toLocaleString()}
                        note={`${book.open.length} open`} />
                    <Stat label="Expected" value={signed(book.expected)}
                        tone={toneOf(book.expected)} note="at today's prices" />
                    <Stat label="Hit rate"
                        value={book.decided > 0 ? `${Math.round(book.hitRate * 100)}%` : "—"}
                        note={book.decided > 0
                            ? `${book.record.won}W · ${book.record.lost}L`
                            : "nothing settled"} />
                </div>

                {/* One line for the week and one for the room, both of which
                    refuse rather than print a zero. */}
                {(book.week || standing.ready || book.streak > 1) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px]">
                        {book.week && (
                            <span style={{ color: INK.mid }}>
                                This week{" "}
                                <span className="font-black tabular-nums"
                                    style={{ color: toneOf(book.week.cred) }}>
                                    {signed(book.week.cred)}
                                </span>
                                {" "}over {book.week.settled} settled
                            </span>
                        )}
                        {book.streak > 1 && (
                            <span className="font-bold" style={{ color: INK.up }}>
                                {book.streak} in a row
                            </span>
                        )}
                        {standing.ready ? (
                            <span style={{ color: INK.mid }}>
                                Ahead of{" "}
                                <span className="font-black tabular-nums"
                                    style={{ color: INK.bright }}>{standing.pct}%</span>
                                {" "}of {standing.peers} traders
                            </span>
                        ) : standing.reason === "calls" && (
                            <span style={{ color: INK.dim }}>
                                {standing.needs} more settled call{standing.needs === 1 ? "" : "s"}{" "}
                                and this says where you sit in the room
                            </span>
                        )}
                    </div>
                )}
            </section>

            {/* ── Where the cred is ────────────────────────────────── */}
            {exposure.total > 0 && (
                <section>
                    <Heading label="Exposure"
                        note={exposure.top && exposure.slices.length > 1
                            ? `${Math.round(exposure.top.share * 100)}% on ${
                                (KINDS[exposure.top.kind]?.label || exposure.top.kind).toLowerCase()}`
                            : null} />
                    <Exposure data={exposure} />
                </section>
            )}

            {/* ── Open positions ───────────────────────────────────── */}
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
                            const toward = drift == null ? null : (side ? drift : -drift);
                            return (
                                <button key={h.id} type="button"
                                    onClick={() => onOpenMarket?.(h.market_id)}
                                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5
                                        hover:bg-[var(--floor-inset)] transition-colors
                                        ${i ? "border-t border-[var(--floor-edge)]" : ""}`}>
                                    <span className="text-[9px] font-black uppercase tracking-wide
                                        px-1.5 py-0.5 rounded flex-shrink-0 w-9 text-center"
                                        style={{ background: side ? "var(--floor-yes)" : "var(--floor-no)",
                                            color: side ? "var(--floor-on-bright)" : "#fff" }}>
                                        {side ? "Yes" : "No"}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block truncate text-[12px] font-bold
                                            text-[var(--floor-ink)]">
                                            {h.market?.title || "—"}
                                        </span>
                                        <span className="block text-[10px] tabular-nums"
                                            style={{ color: INK.dim }}>
                                            {h.stake} at {priceLabel(h.price_at_entry)}
                                            {now != null && ` · room ${priceLabel(now)}`}
                                        </span>
                                    </span>
                                    <DriftBar pts={toward} />
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] mt-1.5 leading-snug" style={{ color: INK.dim }}>
                        The bar is how far the room has come toward your side since you took it.
                    </p>
                </section>
            )}

            {/* ── The skill, and the two extremes of it ────────────── */}
            {/* Paired on a wide screen because they answer one question from
                two ends: calibration is whether the confidence was earned, and
                the extremes are what it was worth. Alone, the curve is a
                `max-w-md` box with a third of the page empty beside it. */}
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
                {(book.best || book.worst) && (
                    <section>
                        <Heading label="Your two extremes" />
                        <Extremes best={book.best} worst={book.worst} onOpen={onOpenMarket} />
                    </section>
                )}
            </div>

            {/* ── Settled ──────────────────────────────────────────── */}
            {book.closed.length > 0 && (
                <section>
                    <Heading label="Settled" note={`${book.closed.length}`} />
                    <div className="rounded-xl border-2 border-[var(--floor-edge)] overflow-hidden">
                        {[...book.closed].reverse().slice(0, 12).map((h, i) => {
                            const o = outcomeOf(h);
                            const payout = Math.round(Number(h.payout) || 0);
                            const tone = o === "won" ? INK.up : o === "lost" ? INK.down : INK.mid;
                            return (
                                <motion.button key={h.id} type="button" layout
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
                                </motion.button>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
