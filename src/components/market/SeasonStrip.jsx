/**
 * SeasonStrip — where you stand this season, and what you have to play with.
 *
 * ─── SKILL LEADS, CREDITS FOLLOW ────────────────────────────────────────────
 * The header used to lead with the credit balance, in coin-gold, as the
 * biggest number on the floor. A balance that leads is a bankroll, and a
 * bankroll is the one thing a forecasting competition must not look like. The
 * DIVISION leads now: a card whose rank is how well you have read the room
 * this season, with the distance to the next one drawn as a bar. Credits are
 * what you commit with — real, printed, and second.
 *
 * ─── THE DIVISION IS A CARD ─────────────────────────────────────────────────
 * Rank is how strong a thing is everywhere in this app and an Ace is always
 * earned, so the top division is the Ace and nobody is dealt it. White stock
 * in both themes (`theme-locked-light`), the onboarding table's rule: a card
 * that changes what it is printed on between themes is two objects.
 *
 * ─── NO NUMBER HERE IS INVENTED ─────────────────────────────────────────────
 * Points are read points (slate.js) summed off settled calls the server
 * holds; the bar is `divisionOf`, the same thresholds the server awards on.
 * With no settled call this season the strip says how a division is earned
 * rather than drawing an empty bar at zero.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CircleDot } from "lucide-react";
import { SuitPip } from "@/components/cards/PlayingCard";
import LiveNumber from "@/components/shared/LiveNumber";
import { divisionOf, DIVISIONS } from "@/lib/slate";

const RED = { heart: true, diamond: true };

/**
 * A division as a small playing card, shared with the Sunday results. Drawn
 * as the card's FACE VALUE — the rank large and the suit under it — rather
 * than through PlayingCard, whose corner index is a fraction of the card and
 * is three pixels tall at this size: the one thing this mark exists to say
 * would be the one thing it could not print.
 */
export function DivisionMark({ division, size = 52 }) {
    const d = DIVISIONS.find((x) => x.id === division) || DIVISIONS[0];
    const top = d.id === "oracle";
    return (
        <span data-division-mark
            className={`theme-locked-light relative inline-flex flex-col items-center justify-center flex-shrink-0
                rounded-[0.7rem] border-2 bg-surface aspect-[2.5/3.5]
                ${top ? "border-xp shadow-[0_0_18px_-2px_rgba(245,158,11,0.55)]" : "border-border"}`}
            style={{ width: size }}
            role="img" aria-label={`${d.label} division`} title={`${d.label} division`}>
            <span className={`font-display font-black leading-none ${RED[d.suit] ? "text-destructive" : "text-foreground"}`}
                style={{ fontSize: size * 0.42 }}>
                {d.rank}
            </span>
            {/* SuitPip takes a class and nothing else (a style would reach
                three suits and not the spade), so the size is on a wrapper. */}
            <span className="mt-0.5 block" style={{ width: size * 0.26, height: size * 0.26 }}>
                <SuitPip suit={d.suit} className="w-full h-full" />
            </span>
        </span>
    );
}

export default function SeasonStrip({ season, credits = 0, committed = 0 }) {
    const reduce = useReducedMotion();
    const div = divisionOf(season?.points ?? 0);
    const calls = season?.calls ?? 0;
    const lastWon = season?.last?.division
        ? DIVISIONS.find((d) => d.id === season.last.division) : null;

    return (
        <section data-season-strip
            className="rounded-2xl border-2 border-[var(--floor-edge)] bg-[var(--floor-card)] p-3 sm:p-4
                flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-3 min-w-0 flex-1 basis-[16rem]">
                <DivisionMark division={div.id} />
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]">
                        {season ? `Season ${season.number} · week ${season.week} of ${season.weeks}` : "This season"}
                    </p>
                    <p className="font-display font-black text-[var(--floor-ink)] text-xl leading-tight">
                        {div.label}
                        <span className="ml-2 text-[13px] font-bold text-[var(--floor-muted-2)] tabular-nums">
                            {div.points} read {Math.abs(div.points) === 1 ? "point" : "points"}
                        </span>
                    </p>
                    {div.next ? (
                        <div className="mt-1.5">
                            <div className="h-1.5 rounded-full bg-[var(--floor-edge)] overflow-hidden" aria-hidden="true">
                                <motion.span className="block h-full rounded-full bg-[var(--floor-accent)]"
                                    initial={reduce ? false : { width: 0 }}
                                    animate={{ width: `${Math.round(div.progress * 100)}%` }}
                                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
                            </div>
                            <p className="mt-1 text-[11px] text-[var(--floor-muted-2)]">
                                {calls === 0
                                    ? "Points come from calls that beat the room. Agreeing with it earns nothing."
                                    : <>
                                        <span className="font-bold tabular-nums text-[var(--floor-ink)]">{div.toNext}</span>
                                        {` to ${div.next.label}`}
                                        <span className="text-[var(--floor-dim)]"> · {calls} settled {calls === 1 ? "call" : "calls"}</span>
                                    </>}
                            </p>
                        </div>
                    ) : (
                        <p className="mt-1 text-[11px] font-bold text-[var(--floor-accent-ink)]">
                            The top division. The Oracle back is yours at season end.
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-end gap-5">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]">Credits</p>
                    <p className="font-display font-black text-[var(--floor-ink)] text-xl tabular-nums
                        inline-flex items-center gap-1.5">
                        <CircleDot className="w-3.5 h-3.5 text-[var(--floor-muted-2)]" aria-hidden="true" />
                        {/* It rolls: credits move for two reasons, the Monday
                            grant and your own calls, and a figure that jumps
                            between paints cannot tell them apart. */}
                        <LiveNumber value={credits} showDelta={false} />
                    </p>
                </div>
                {committed > 0 && (
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]">Committed</p>
                        <p className="font-display font-black text-[var(--floor-ink)] text-xl tabular-nums">
                            {committed.toLocaleString()}
                        </p>
                    </div>
                )}
            </div>

            {lastWon && (
                <p className="basis-full text-[11px] text-[var(--floor-muted-2)] -mt-1">
                    Last season you finished {lastWon.label}
                    {season.last.division === "oracle" ? ", and the Oracle card back is in your store." : "."}
                </p>
            )}
        </section>
    );
}
