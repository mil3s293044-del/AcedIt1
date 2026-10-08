/**
 * PeriodSwitch — the one control every tab reads.
 *
 * ─── IT IS QUIETER THAN THE TAB BAR ABOVE IT, DELIBERATELY ──────────────────
 * Two controls drawn identically, one inside the other, is how a student loses
 * track of which one they are using — Ranked's `BoardSwitch` records exactly
 * this, and the rule holds harder here because these two sit on consecutive
 * lines. The tabs are a filled pill on the foreground; this is inset on the
 * secondary ground with the live segment lifted onto the surface.
 *
 * ─── THE WINDOW IS STATED, NOT IMPLIED ──────────────────────────────────────
 * "Week" alone is a word two students would read as two different spans — the
 * `date-fns` Sunday default put five surfaces of this app a full week out of
 * step with nine others. The blurb under the switch says Monday, says 28 days,
 * and says what "All" means, so no figure on any tab is one a student cannot
 * argue with.
 */
import React from "react";
import { PERIODS } from "@/lib/progressReport";

export default function PeriodSwitch({ value, onChange }) {
    const live = PERIODS.find((p) => p.id === value) || PERIODS[0];
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div role="tablist" aria-label="Reporting period"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary">
                {PERIODS.map((p) => {
                    const on = p.id === live.id;
                    return (
                        <button key={p.id} type="button" role="tab" aria-selected={on}
                            onClick={() => onChange(p.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                                ${on ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}>
                            {p.label}
                        </button>
                    );
                })}
            </div>
            <span className="text-xs text-muted-foreground">{live.blurb}</span>
        </div>
    );
}
