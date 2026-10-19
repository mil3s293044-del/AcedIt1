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
 * ─── THE PRICE IS PRINTED AS A PERCENTAGE AND DRAWN AS A LINE ──────────────
 * The sparkline is why the card is worth opening: a market that has swung
 * twenty points this week is an argument, and a flat one is a question nobody
 * has bothered with. Neither is visible in a single number.
 *
 * There are no odds on this card. It carried a return multiple per side and a
 * pool figure ("300 in") — honest numbers, and together they were a betting
 * slip. What a call is worth in credits is said once, in the commit sheet,
 * against a commitment the student has actually chosen.
 *
 * ─── LAST CALL, THEN LOCKED ─────────────────────────────────────────────────
 * The clock counts to LAST CALL, not to the close: a weekly question stops
 * taking calls on Friday evening, before the boards give its answer away (see
 * slate.js). After that the card stays up, locked, so the room can watch it
 * resolve — a question that vanished at last call would look like it had been
 * withdrawn.
 *
 * ─── THE COMMIT LANDS ON THE CARD ───────────────────────────────────────────
 * The sheet shows where the room will move before the press, as a tick on this
 * card's bar. After it, the bar moves there (PriceTick) and the call STAMPS
 * onto the card — once, the moment it lands, never on a reload.
 *
 * ─── The crowd is drawn as PEOPLE, not just a price ─────────────────────────
 * "8 backing yes · 3 no" with names on hover. A market where you cannot see
 * who is on which side is a private bet, which is exactly what the old
 * wagering layer was and why nothing about it felt social.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import * as Icons from "lucide-react";
import { Clock, Lock } from "lucide-react";
import PriceBar from "./PriceBar";
import PriceChart from "./PriceChart";
import TakeSide from "./TakeSide";
import { createPageUrl } from "@/utils";
import {
    KINDS, sideOf, YES, priceLabel, payoutFor, priceHistory, sideLabels,
} from "@/lib/market";
import { lastCallOf, isLocked } from "@/lib/slate";

/** "2d 4h" to a time, or null. Never the epoch: a missing time is no clock. */
export function untilLabel(t) {
    const ms0 = typeof t === "number" ? t : t ? new Date(t).getTime() : NaN;
    if (!Number.isFinite(ms0)) return null;
    const ms = ms0 - Date.now();
    if (ms <= 0) return "closed";
    const mins = Math.floor(ms / 60000);
    const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60);
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return `${h}h`;
    return `${mins}m`;
}

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";

/**
 * The card's clock: last call while calls are open, "locked" after it. Shared
 * with EventCard so the two shapes of card can never count to different times.
 */
export function useCallClock(market) {
    const locked = isLocked(market);
    const lc = lastCallOf(market);
    const left = locked ? null : untilLabel(lc);
    return { locked, left, closing: !!left && /^\d+[mh]$/.test(left) };
}

/**
 * True for the few seconds after YOUR call lands on a card, and never on the
 * first paint: a stamp that played on every reload would announce an old call
 * as news, the rule PriceTick keeps about prices.
 */
export function useJustCalled(call) {
    const had = useRef(call ? call.id || true : null);
    const [fresh, setFresh] = useState(false);
    useEffect(() => {
        const id = call ? call.id || true : null;
        if (id && !had.current) {
            setFresh(true);
            const t = setTimeout(() => setFresh(false), 2600);
            had.current = id;
            return () => clearTimeout(t);
        }
        had.current = id;
        return undefined;
    }, [call]);
    return fresh;
}

/** The stamp a call leaves on its card. */
export function CallStamp({ show, text }) {
    const reduce = useReducedMotion();
    return (
        <AnimatePresence>
            {show && (
                <motion.span data-call-stamp
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.8, rotate: -18 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -7 }}
                    exit={{ opacity: 0, transition: { duration: 0.4 } }}
                    transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 18 }}
                    className="pointer-events-none absolute right-3 top-9 z-10 rounded-lg border-2
                        border-[var(--floor-accent-ink)] bg-[var(--floor-card)] px-2.5 py-1
                        font-display font-black text-[12px] uppercase tracking-widest
                        text-[var(--floor-accent-ink)] shadow-lg">
                    {text}
                </motion.span>
            )}
        </AnimatePresence>
    );
}

export default function MarketCard({ market, balance, busy, onTake, onReport }) {
    const [open, setOpen] = useState(false);
    const [preview, setPreview] = useState(null);
    const kind = KINDS[market.kind] || KINDS.streak;
    // A head-to-head is between two people, so its sides are those two people.
    const labels = sideLabels(market);
    const KindIcon = Icons[kind.icon] || Icons.CircleDot;
    const { locked, left, closing } = useCallClock(market);
    const mine = market.mine;
    const justCalled = useJustCalled(mine);
    const names = (market.positions || [])
        .map((p) => firstName(p.user_name)).slice(0, 3);

    // Replayed from the positions the card already holds — no query, no stored
    // history, and it cannot disagree with the price printed beside it.
    const history = useMemo(() => priceHistory(market), [market]);
    const myEntry = useMemo(() => {
        if (!mine?.created_date) return null;
        const t = new Date(mine.created_date).getTime();
        return Number.isFinite(t) ? { t, price: Number(mine.price_at_entry) } : null;
    }, [mine]);

    return (
        <motion.article
            layout
            data-market-card
            // A market about YOU is marked by its border and its own line, not
            // by a different ground: tinting the panel came out a muddy olive
            // that read as a rendering fault rather than as emphasis, and the
            // room only works while every panel sits on the same ink.
            className={`relative rounded-2xl border-2 p-4 transition-colors bg-[var(--floor-card)]
                ${market.subject_is_me
                    ? "border-[rgb(var(--floor-warn-rgb)/0.6)]"
                    : "border-[var(--floor-edge)] hover:border-[var(--floor-edge-hover)]"}`}
        >
            {/* ── Kicker: what kind, and the clock ──────────────────── */}
            <div className="flex items-center justify-between gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black
                    uppercase tracking-widest text-[var(--floor-muted-2)]">
                    <KindIcon className="w-3.5 h-3.5" /> {kind.label}
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
                text={mine ? `Called · ${sideOf(mine.p) === YES ? labels.yes : labels.no}` : ""} />

            {/* ── The question ─────────────────────────────────────── */}
            {/* THE TITLE IS THE WAY IN, not the whole card. Making the card
                itself a link would swallow the take-side sheet inside it, and
                the primary action on a board card is taking a side — the detail
                page is the second thing you want, so it gets the second-biggest
                target rather than the first. */}
            <h3 className="font-display font-extrabold text-base leading-snug mb-3">
                <a href={`${createPageUrl("Market")}?id=${encodeURIComponent(market.id)}`}
                    className="text-[var(--floor-ink)] hover:text-[var(--floor-accent-ink)] transition-colors">
                    {market.title}
                </a>
            </h3>

            {/* ── IT'S ABOUT YOU ───────────────────────────────────── */}
            {/* THE NOUN FOLLOWS THE KIND. Every market about a student used to
                be "your week", which is right for a streak or an hours line and
                simply wrong on a SAC — the one market where what is being
                traded is a mark, and the sentence naming it is the whole
                payoff the subject gets in place of a stake. */}
            {market.subject_is_me && market.traders > 0 && (
                <p className="text-[13px] font-bold text-[var(--floor-warn-ink)] mb-3 leading-snug">
                    {market.traders === 1
                        ? `Someone has called your ${market.kind === "sac" ? "mark" : "week"}.`
                        : `${market.traders} people are calling your `
                            + `${market.kind === "sac" ? "mark" : "week"}.`}
                </p>
            )}

            {/* ── The price, its split, and the tape under it ───────── */}
            {/* THE PRICE LEADS. It used to be the smallest figure in this
                block, in a 62px gutter beside two payout ceilings drawn at
                20px — which is a conditional on a call nobody has made
                outranking the market's actual state. PriceBar is the one
                object now: the figure, the split drawn, and who is calling
                each end. */}
            <div className="rounded-xl bg-[var(--floor-well)] px-3 py-2.5">
                <PriceBar price={market.price} labels={labels}
                    counts={{ yes: market.yesCount, no: market.noCount }} preview={preview}
                    change={history.change} trades={history.trades} />

                {/* A MARKET WITH NO TRADES HAS NO TAPE. The compact chart draws
                    a dashed rule edge to edge for it, which reads as a divider
                    rather than as a price — the full chart carries a sentence
                    saying so and there is no room for one here. The crowd row
                    below already says nobody has taken a side. */}
                {history.trades > 0 && (
                    <div className="mt-2">
                        <PriceChart labels={labels} history={history} compact myEntry={myEntry} />
                    </div>
                )}
            </div>

            {/* A market with no base rate SAYS SO. Printing a confident 50¢ off
                nothing is the "100% — from your last 1" failure the forecast
                panel already refuses, and the line above is flat for the same
                reason rather than because the market is quiet. */}
            {market.meta?.thin && (
                <p className="text-[10px] text-[var(--floor-muted-2)] mt-1.5">
                    No base rate yet — this one opened at even.
                </p>
            )}

            {/* ── The crowd, as people ─────────────────────────────── */}
            {/* The counts per side are on the bar; this row is WHO. A market
                where you cannot see who has called it is a private bet, which
                is what the old wagering layer was. No pool figure — "300 in"
                was a pot, and a pot is a betting word. */}
            <p className="mt-2.5 text-[11px] font-bold text-[var(--floor-muted-2)] min-w-0 truncate">
                {market.traders === 0
                    ? <span className="text-[var(--floor-dim)]">No calls yet</span>
                    : <>
                        {names.join(", ")}
                        {market.traders > names.length ? ` and ${market.traders - names.length} more` : ""}
                        <span className="text-[var(--floor-dim)]">
                            {market.traders === 1 ? " has called this" : " have called this"}
                        </span>
                    </>}
            </p>

            {/* ── Your side ────────────────────────────────────────── */}
            {mine && (() => {
                const isYes = sideOf(mine.p) === YES;
                // A SIDE IS NOT A POSITION HERE. Taking no at 55% into a market
                // already pricing no at 80¢ puts you further from no than the
                // price is, so the rule pays you when YES lands — and this row
                // printed that as "−2 if right" in the WINNING green, a negative
                // number under a positive claim in the colour of money coming
                // in. TakeSide's tiles were rebuilt for exactly this; the board
                // card kept the hard-coded ink. The colour follows the sign.
                const w = payoutFor(mine.stake, mine.p, mine.price_at_entry, isYes);
                return (
                    <div className="flex items-center justify-between gap-3 mt-3 rounded-xl
                        bg-[var(--floor-well)] px-3 py-2">
                        <span className="text-[11px] font-bold text-[var(--floor-muted)] min-w-0 truncate">
                            You called{" "}
                            <span className={isYes ? "text-[var(--floor-yes-ink)]" : "text-[var(--floor-no-ink)]"}>
                                {/* A NAME IS NOT SHOUTED. "yes"/"no" are the
                                    model's two outcomes; "PRIYANKA" in caps is
                                    a fifteen-year-old's name in caps. */}
                                {labels.named ? (isYes ? labels.yes : labels.no)
                                    : (isYes ? "yes" : "no")}
                            </span>
                            <span className="text-[var(--floor-dim)]">
                                {" "}at {priceLabel(mine.price_at_entry)} · {mine.stake} committed
                            </span>
                        </span>
                        <span className={`text-[11px] font-black tabular-nums
                            ${w > 0 ? "text-[var(--floor-yes-ink)]"
                                : w < 0 ? "text-[var(--floor-no-ink)]" : "text-[var(--floor-muted-2)]"}`}>
                            {w > 0 ? "+" : ""}{w} if {isYes ? labels.yes : labels.no}
                        </span>
                    </div>
                );
            })()}

            {/* ── The way in ───────────────────────────────────────── */}
            {open && !locked ? (
                <TakeSide
                    market={market}
                    price={market.price} balance={balance} busy={busy}
                    history={history} myEntry={myEntry}
                    onPreview={setPreview}
                    onCancel={() => setOpen(false)}
                    onTake={async (pick) => { await onTake?.(market, pick); setOpen(false); }}
                />
            ) : mine ? null : locked ? (
                <p className="flex items-start gap-1.5 mt-3 text-[11px] text-[var(--floor-muted-2)] leading-snug">
                    <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    Calls closed before the answer could show. It settles when the week ends.
                </p>
            ) : market.blocked ? (
                // A refusal SAYS WHY. A greyed-out button with no reason is the
                // "disabled button that says nothing" paper-cut this project
                // already fixed once on the Study page.
                <p className="flex items-start gap-1.5 mt-3 text-[11px] text-[var(--floor-muted-2)] leading-snug">
                    <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" /> {market.blocked}
                </p>
            ) : (
                <button type="button" onClick={() => setOpen(true)}
                    className="w-full mt-3 py-2.5 rounded-xl border-2 border-[var(--floor-edge-strong)]
                        text-[var(--floor-ink)] font-display font-black text-sm
                        hover:border-[var(--floor-accent-ink)] hover:bg-[rgb(var(--floor-accent-rgb)/0.1)] transition-colors">
                    Take a position
                </button>
            )}

            {/* ── Your own mark ────────────────────────────────────── */}
            {/* THREE GOLDS WERE TWO TOO MANY. The ring, the sentence and a
                full-strength gold slab all landed on one card, and the slab was
                the loudest thing on a board whose primary gesture is taking a
                side — which this student is the one person who may not do. It
                is an outline now: still the card's own action, no longer the
                first thing the eye lands on. The sentence keeps its weight,
                because it is the whole payoff the subject gets in place of a
                stake. */}
            {/* This opened a `window.prompt` asking for a number out of 100 —
                a SECOND place to type a mark, while the column built to hold
                it stayed null on every row. It goes to the planner now, where
                the SAC already is, and settling reads the mark back off that
                row. One mark, one place. */}
            {market.kind === "sac" && market.subject_is_me && onReport && (
                <button type="button" onClick={() => onReport(market)}
                    className="w-full mt-2.5 py-2.5 rounded-xl border-2 border-[rgb(var(--floor-warn-rgb)/0.5)]
                        text-[var(--floor-warn-ink)] font-display font-black text-sm
                        hover:bg-[rgb(var(--floor-warn-rgb)/0.12)] hover:border-[var(--floor-warn-ink)]
                        transition-colors">
                    Enter your mark on the planner
                </button>
            )}

            {/* THE KIND'S OWN LINE IS WRITTEN AS A CONTINUATION — "from their
                study log, both tables" — and the card printed it bare, so the
                footer read as a lowercase fragment somebody had left behind. A
                `resolves_note` is a whole sentence and is not prefixed. */}
            <p className="text-[10px] text-[var(--floor-dim)] mt-3 leading-snug">
                {market.resolves_note || `Settles ${kind.resolves}`}
            </p>
        </motion.article>
    );
}
