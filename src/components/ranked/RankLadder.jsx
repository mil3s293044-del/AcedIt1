/**
 * RankLadder — the whole climb, laid along the page.
 *
 * ─── Why horizontal ───────────────────────────────────────────────────────
 * Ten tiers is the only thing on this tab that is inherently LONG, and it was
 * the one thing squeezed into a three-row window with the rest hidden behind a
 * toggle — while a third of a wide screen sat empty beside it. A ladder read
 * left to right is also simply how a ladder of ten reads: you can see where
 * you started, where you are and how much is left in one glance, which is the
 * entire reason a rank ladder exists.
 *
 * ─── The rail is the progress, and it is continuous ─────────────────────────
 * The filled part runs from the first crest to YOUR crest plus the fraction of
 * the way you are through your current tier — so the bar moves every time XP
 * lands, not once every few months when a tier flips. A track that only
 * changes on a tier boundary is a progress bar that is wrong almost all the
 * time.
 *
 * ─── It scrolls rather than shrinks ─────────────────────────────────────────
 * Ten crests with names under them do not fit a phone, and the two ways to
 * pretend otherwise are both worse than scrolling: shrink them until the
 * numerals are unreadable, or drop the names and lose what the ladder is FOR.
 * The current tier is scrolled into view on mount, so a student opening this on
 * a phone starts looking at themselves.
 */
import React, { useEffect, useRef } from "react";
import { Check, Lock } from "lucide-react";
import RankCrest from "./RankCrest";

export default function RankLadder({ ranks = [], currentTier, totalXP = 0, pct = 0 }) {
    const scroller = useRef(null);
    const mine = useRef(null);

    // Start on the student. `nearest` rather than `center` so a rank near
    // either end does not get scrolled into a half-empty track.
    useEffect(() => {
        if (!mine.current || !scroller.current) return;
        const box = scroller.current;
        if (box.scrollWidth <= box.clientWidth) return;      // it all fits; leave it
        mine.current.scrollIntoView({ block: "nearest", inline: "center" });
    }, [currentTier]);

    if (!ranks.length) return null;
    const n = ranks.length;
    const at = Math.max(0, ranks.findIndex((r) => r.tier === currentTier));
    // Crest i sits at (i + 0.5)/n across the track, so the rail starts half a
    // cell in — at the first crest — and ends at the current crest PLUS
    // however far through that tier the student is.
    //
    // The +0.5 is not decoration. Without it the fill stops one half-cell
    // short, which puts the end of the bar just behind the crest it is
    // supposed to have reached — a progress bar that visibly has not got to
    // where the number above it says you are.
    const railLeft = (0.5 / n) * 100;
    const railEnd = ((at + 0.5 + Math.min(1, Math.max(0, pct / 100))) / n) * 100;
    const railFill = Math.max(0, railEnd - railLeft);

    return (
        <div ref={scroller} className="overflow-x-auto -mx-1 px-1 pb-1">
            <div className="relative flex min-w-[760px] sm:min-w-0 pt-1">
                {/* The rail, behind the crests. `top` lands on the crest's
                    vertical centre — 44px tall, so 22px down from the row top
                    plus the 4px of padding above it. */}
                <span aria-hidden="true"
                    className="absolute top-[26px] h-1 rounded-full bg-border"
                    style={{ left: `${railLeft}%`, right: `${railLeft}%` }} />
                <span aria-hidden="true"
                    className="absolute top-[26px] h-1 rounded-full bg-primary"
                    style={{ left: `${railLeft}%`, width: `${railFill}%` }} />

                {ranks.map((r, i) => {
                    const done = i < at;
                    const current = i === at;
                    const locked = i > at;
                    return (
                        <div key={r.name} ref={current ? mine : null}
                            className="relative flex-1 min-w-0 flex flex-col items-center px-1 text-center">
                            <span className={`relative rounded-full ${
                                current ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""}`}>
                                <RankCrest rank={r} size={44} showRing={false}
                                    className={locked ? "opacity-30" : ""} />
                                {done && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary
                                        border-2 border-surface flex items-center justify-center">
                                        <Check className="w-2 h-2 text-primary-foreground" strokeWidth={4} />
                                    </span>
                                )}
                                {locked && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-secondary
                                        border-2 border-surface flex items-center justify-center">
                                        <Lock className="w-2 h-2 text-muted-foreground" strokeWidth={3} />
                                    </span>
                                )}
                            </span>

                            <span className={`block text-[10px] leading-tight mt-2 ${
                                current ? "font-black text-foreground"
                                    : done ? "font-bold text-muted-foreground"
                                    : "font-bold text-muted-foreground/50"}`}>
                                {r.name}
                            </span>
                            <span className="block text-[10px] text-muted-foreground/60 tabular-nums leading-tight mt-0.5">
                                {r.minXP >= 1000 ? `${Math.round(r.minXP / 1000)}k` : r.minXP}
                                {r.maxXP === Infinity ? "+" : ""}
                            </span>
                            {current && (
                                <span className="pill bg-foreground text-background text-[9px] mt-1 px-2 py-0 whitespace-nowrap">
                                    {totalXP.toLocaleString()} XP
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
