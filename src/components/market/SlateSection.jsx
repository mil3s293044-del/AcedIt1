/**
 * SlateSection — this week's shared card, at the top of the floor.
 *
 * The slate is the same questions for everybody, so it is the one place on
 * the floor where "how did I do" has an answer measured against the whole
 * room. It leads the floor for that reason: the board underneath is the open
 * market, and this is the competition.
 *
 * ─── WHAT THE HEADER SAYS, AND ONLY THAT ────────────────────────────────────
 *   · How much of it you have called — one pip per card, filled when called,
 *     because "5 of 11" is a number and eleven pips are a hand to finish.
 *   · When last call is. After it, that the slate is locked and when it
 *     settles, rather than a clock counting to nothing.
 *   · When the Wednesday drop lands, while it has not — the reason to come
 *     back midweek, stated as a fact rather than a notification.
 *
 * The two drops are drawn as two bands, so a card that arrived on Wednesday
 * is visibly new without a badge on every one of them.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, Lock, CalendarPlus } from "lucide-react";
import EventCard from "./EventCard";
import MarketCard, { untilLabel } from "./MarketCard";
import { slateOf, slateProgress, isLocked, WAVES } from "@/lib/slate";

function Band({ label, note }) {
    return (
        <div className="flex items-center gap-3 mb-2.5">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--floor-muted)]">{label}</h3>
            {note && <span className="text-[11px] font-bold text-[var(--floor-dim)]">{note}</span>}
            <span className="flex-1 h-px bg-[var(--floor-edge)]" aria-hidden="true" />
        </div>
    );
}

export default function SlateSection({ board = [], balance, busy, onTake, onReport, lastCall = null, nextDrop = null }) {
    const reduce = useReducedMotion();
    const entries = slateOf(board);
    if (!entries.length) return null;
    const { called, total, done } = slateProgress(entries);
    const locked = entries.every((e) => isLocked(e.rows[0]));
    const left = locked ? null : untilLabel(lastCall);
    const drop = nextDrop ? untilLabel(nextDrop) : null;
    const waves = WAVES.map((w) => ({ ...w, entries: entries.filter((e) => e.wave === w.id) }))
        .filter((w) => w.entries.length);

    return (
        <section data-slate className="space-y-4">
            <div className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="font-display font-black text-[var(--floor-ink)] text-xl leading-tight">
                            This week&apos;s slate
                        </h2>
                        <p className="text-[12px] text-[var(--floor-muted-2)] mt-0.5">
                            The same questions for everybody, ranked on who reads them best.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        {locked ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[var(--floor-edge)]
                                px-2 py-1 text-[var(--floor-muted-2)]">
                                <Lock className="w-3 h-3" /> Locked · results when the week ends
                            </span>
                        ) : left && (
                            <span className="inline-flex items-center gap-1 rounded-lg border-2
                                border-[rgb(var(--floor-warn-rgb)/0.45)] px-2 py-1 text-[var(--floor-warn-ink)] tabular-nums">
                                <Clock className="w-3 h-3" /> Last call Friday evening · {left}
                            </span>
                        )}
                        {drop && !locked && (
                            <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[var(--floor-edge)]
                                px-2 py-1 text-[var(--floor-muted-2)] tabular-nums">
                                <CalendarPlus className="w-3 h-3" /> Wednesday drop in {drop}
                            </span>
                        )}
                    </div>
                </div>

                {/* One pip per card. */}
                <div className="mt-3 flex items-center gap-3">
                    <div className="flex flex-wrap gap-1" role="img"
                        aria-label={`${called} of ${total} slate questions called`}>
                        {entries.map((e, i) => {
                            const on = e.rows.some((r) => r.mine);
                            return (
                                <motion.span key={e.id}
                                    className={`h-2 w-5 rounded-full ${on ? "bg-[var(--floor-accent)]" : "bg-[var(--floor-edge)]"}`}
                                    initial={reduce ? false : { scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ delay: reduce ? 0 : 0.05 * i, duration: 0.25 }} />
                            );
                        })}
                    </div>
                    <span className="text-[12px] font-bold tabular-nums text-[var(--floor-muted)]">
                        {done ? "All called" : `${called} of ${total} called`}
                    </span>
                </div>
            </div>

            {waves.map((w) => (
                <div key={w.id}>
                    <Band label={w.label} note={w.id === 2 ? "built from Monday and Tuesday" : null} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        {w.entries.map((e) => (e.kind === "group"
                            ? <EventCard key={e.id} entry={e} balance={balance} busy={busy} onTake={onTake} />
                            : <MarketCard key={e.id} market={e.rows[0]} balance={balance} busy={busy}
                                onTake={onTake} onReport={onReport} />))}
                    </div>
                </div>
            ))}
        </section>
    );
}
