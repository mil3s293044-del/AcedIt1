/**
 * BarList — one ranked list of things with a figure, drawn to ONE scale.
 *
 * Four tabs needed the same object (subjects by average, techniques by minutes,
 * command terms by marks lost, mastery bands by card count) and four hand-rolled
 * versions is the copy this codebase keeps deleting.
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

const MIN_FILL = 3;

export default function BarList({ rows = [], tone = "bg-primary", empty = null, max: given }) {
    if (!rows.length) return empty;
    const max = given ?? Math.max(...rows.map((r) => Math.abs(Number(r.value) || 0)), 1);

    return (
        <ul className="space-y-2.5">
            {rows.map((r) => {
                const n = Math.abs(Number(r.value) || 0);
                const pct = max > 0 ? Math.max(MIN_FILL, Math.round((n / max) * 100)) : MIN_FILL;
                return (
                    <li key={r.key || r.label}>
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                            <span className="text-sm font-bold text-foreground truncate min-w-0">{r.label}</span>
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
                    </li>
                );
            })}
        </ul>
    );
}
