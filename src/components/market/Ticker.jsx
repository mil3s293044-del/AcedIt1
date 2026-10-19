/**
 * Ticker — the floor's calls, running across the top.
 *
 * ─── THE ROOM SHOULD FEEL OCCUPIED ──────────────────────────────────────────
 * The tape sits in a sidebar, which on a phone is below every card on the
 * floor. So a student could open Compete, see a still board, and leave without
 * learning that six people had called the slate in the last hour — the one
 * fact that makes a market feel like somewhere people are. The ticker is that
 * fact at the top of the page, read on the way past.
 *
 * It carries the SAME rows as the tape (built once, in Competitions), so the
 * two can never tell different stories about the same hour.
 *
 * ─── A CALL, NEVER A STAKE ──────────────────────────────────────────────────
 * Each entry is a person and the call they made. How much they committed is
 * deliberately not on it: a ticker scrolling amounts is a betting shop's
 * window, and the amount is the least interesting thing about a call.
 *
 * ─── MOTION IS OPTIONAL ─────────────────────────────────────────────────────
 * It runs on a CSS animation (`.floor-ticker-run`) so it costs no renders, it
 * pauses while a pointer is on it so a name can be read, and under reduced
 * motion it simply stands still with the newest few on screen.
 */
import React from "react";
import { YES } from "@/lib/market";

/** Seconds a single entry takes to cross. The track's speed, not a duration. */
const PER_ENTRY_S = 5;
const MAX = 14;

export default function Ticker({ rows = [] }) {
    const items = rows.filter((r) => !r.resolved).slice(0, MAX);
    if (items.length < 2) return null;
    const run = [...items, ...items];
    return (
        <div data-floor-ticker
            className="relative overflow-hidden rounded-xl border-2 border-[var(--floor-edge)]
                bg-[var(--floor-card)] floor-ticker" aria-label="Recent calls">
            <div className="flex w-max floor-ticker-run"
                style={{ animationDuration: `${items.length * PER_ENTRY_S}s` }}>
                {run.map((r, i) => (
                    <span key={`${r.id}-${i}`} aria-hidden={i >= items.length}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] whitespace-nowrap
                            border-r border-[var(--floor-edge)]">
                        <span className={`w-1.5 h-1.5 rounded-full ${r.side === YES
                            ? "bg-[var(--floor-yes)]" : "bg-[var(--floor-no)]"}`} />
                        <span className="font-bold text-[var(--floor-ink)]">{r.who}</span>
                        <span className={`font-bold ${r.side === YES
                            ? "text-[var(--floor-yes-ink)]" : "text-[var(--floor-no-ink)]"}`}>
                            {r.sideWord}
                        </span>
                        <span className="text-[var(--floor-muted-2)] max-w-[18rem] truncate">{r.subject}</span>
                        <span className="text-[10px] text-[var(--floor-dimmest)] tabular-nums">{r.when}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}
