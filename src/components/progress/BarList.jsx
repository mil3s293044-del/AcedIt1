/**
 * BarList — one ranked list of things with a figure, drawn to ONE scale, and
 * every row that has somewhere to go IS a link.
 *
 * Four tabs needed the same object (subjects by average, techniques by minutes,
 * command terms by marks lost, mastery bands by card count) and four hand-rolled
 * versions is the copy this codebase keeps deleting.
 *
 * ─── A BAR WITH NO WAY THROUGH IS A DIAGNOSIS ───────────────────────────────
 * Ranked's own lesson about its ATAR components, met again on the page that
 * carries more bars than any other. Every row here names something the app has
 * a screen for: a subject has a hub, a command term has a tool, a technique IS
 * a tab on /Study. None of them was pressable, so a student reading "Evaluate
 * 71%" had to work out for themselves which of twenty-four screens moves it.
 *
 * ─── AND A ROW IS A DOOR ONLY WHERE THE DESTINATION IS EXACT ────────────────
 * `to` is per row rather than per list, deliberately. A technique row opens
 * THAT technique and a subject row opens THAT subject, which is a promise the
 * link keeps. The deck's strength bands have no such destination — there is no
 * review session filtered to "shaky", and sending somebody to the whole deck
 * under a row that says 7 cards is the half-wired shape this app keeps
 * meeting. Those rows stay flat, and that is the refuse-rather-than-guess rule
 * rather than an omission.
 *
 * ─── THE SCALE IS THE BIGGEST ROW, NEVER THE TOTAL ──────────────────────────
 * `SubjectSplit` records the same call: against the total, six subjects all
 * draw as slivers and the comparison the panel exists for is invisible. Against
 * the biggest row the shortest bar still has a readable length, which is what a
 * reader is actually comparing.
 *
 * ─── A BAR IS NEVER THE ONLY CHANNEL ────────────────────────────────────────
 * The figure is printed beside every row, so the list survives greyscale and a
 * row whose value is tiny is still legible. `MIN_FILL` keeps a near-zero bar
 * visible for the same reason `MIN_SHARE` does on the floor's price bar: a row
 * that has nearly nothing is still a row somebody can act on.
 */
import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const MIN_FILL = 3;

export default function BarList({ rows = [], tone = "bg-primary", empty = null, max: given }) {
    if (!rows.length) return empty;
    const max = given ?? Math.max(...rows.map((r) => Math.abs(Number(r.value) || 0)), 1);

    return (
        <ul className="-mx-2">
            {rows.map((r) => {
                const n = Math.abs(Number(r.value) || 0);
                const pct = max > 0 ? Math.max(MIN_FILL, Math.round((n / max) * 100)) : MIN_FILL;
                const body = (
                    <>
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                            <span className="text-sm font-bold text-foreground truncate min-w-0 flex items-center gap-1">
                                {r.label}
                                {r.to && (
                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0
                                        opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                                )}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                                {r.display}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${r.tone || tone}`} style={{ width: `${pct}%` }} />
                        </div>
                        {r.hint && (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.hint}</p>
                        )}
                    </>
                );
                return (
                    <li key={r.key || r.label}>
                        {r.to ? (
                            <Link to={r.to} aria-label={r.aria || `${r.label} — ${r.display}`}
                                className="group block rounded-lg px-2 py-1.5 -my-0.5
                                    hover:bg-secondary/60 transition-colors">
                                {body}
                            </Link>
                        ) : (
                            <div className="px-2 py-1.5 -my-0.5">{body}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
