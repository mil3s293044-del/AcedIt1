/**
 * ScoreGuide — what the week measures, and what one more point costs.
 *
 * ─── A BOARD THAT WILL NOT EXPLAIN ITS NUMBER INVITES A GUESS ───────────────
 * The compete score was one figure out of 1000 with three unlabelled bars
 * under the student's own row, and the page closed with a sentence naming the
 * three slices in passing. So a student 40 points off third had no way to find
 * out whether 40 points was forty minutes, one quiz or a day — which is the
 * difference between a board you can play and a number that happens to you.
 * Ranked says what the ATAR is made of for exactly this reason.
 *
 * ─── EACH SLICE SAYS ITS RULE AND ITS PRICE ─────────────────────────────────
 * The rule is fixed and comes from `SLICES`; the price is theirs this week and
 * comes from `nextPoint`, which is the same arithmetic the score is computed
 * with rather than a second description of it. A FULL slice is never priced —
 * "study more" to somebody who has maxed effort is the app not reading its own
 * screen, which is `nextPoint`'s own rule and the reason it returns rows
 * rather than sentences for all three.
 *
 * The mastery price is explicitly an estimate, because it holds their current
 * average: it cannot know what they will score on the next one, and a flat
 * figure would be a promise this cannot keep.
 */
import React from "react";
import { SLICES, SLICE_MAX, nextPoint } from "@/lib/league";

export default function ScoreGuide({ breakdown, me = {} }) {
    const cs = breakdown || {};
    const prices = nextPoint(cs, {
        sits: me.board_sits ?? 0,
        activeDays: me.active_days ?? 0,
        avgAccuracy: me.avg_accuracy ?? 0,
    });
    const priceOf = (key) => prices.find((p) => p.key === key) || null;

    return (
        <div className="card-soft p-4 sm:p-5 space-y-4">
            {SLICES.map((s) => {
                const v = Number(cs[s.key]) || 0;
                const max = SLICE_MAX[s.key];
                const price = priceOf(s.key);
                return (
                    <div key={s.key}>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="font-display font-extrabold text-sm text-foreground">
                                {s.label}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                {v} <span className="font-medium">/ {max}</span>
                            </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1.5">
                            <div className={`h-full rounded-full ${s.bar}`}
                                style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{s.hint}</p>
                        {/* The price, only while there is one. A slice at its
                            ceiling says so by having nothing to add. */}
                        {price
                            ? <p className="text-xs font-bold text-foreground mt-0.5">{price.label}</p>
                            : <p className="text-xs font-bold text-primary mt-0.5">Full for the week.</p>}
                    </div>
                );
            })}
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                Everything here is this week only, and it resets Monday. Your streak pays
                everywhere else in the app — it is not a head start on the race.
            </p>
        </div>
    );
}
