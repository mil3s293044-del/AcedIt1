/**
 * ReportStrip — the figure, how it moved, what it means, and what it is made
 * of. One compact block at the top of every feature tab.
 *
 * ─── IT REPLACED A 252px CARD, AND THE HEIGHT WAS THE POINT ─────────────────
 * `ReportHead` stacked a 48px display number, a label under it, a sentence
 * under that and then a bordered four-column grid of supporting figures — 252
 * measured pixels per tab to carry one number, a chip and three stats, with
 * the stats row alone taking 90 of them. Four tabs, so a quarter of the whole
 * report was the same block drawn four times, and on a phone the grid went
 * 2-up and it grew. The figure, the chip and the label share a baseline now
 * and the stats are an inline run, which is about 110px for the same content.
 *
 * ─── AND IT IS NO LONGER A CARD ─────────────────────────────────────────────
 * A bordered, elevated box on this page now means ONE thing: something you
 * press. The strip is the headline reading, so it sits on the page ground
 * with the band behind it doing the separating — see `Panel`, which made the
 * same move for the same reason.
 *
 * ─── THE LINE IS THE HEADLINE'S OWN QUANTITY ────────────────────────────────
 * `series` plots exactly the figure printed beside it, out of `dailySeries`,
 * so the two cannot disagree. `percent` is what tells the sparkline the value
 * is an AVERAGE rather than a count — which decides whether a day with no
 * rows is a zero or a gap. Mistakes passes neither: nothing records WHEN a
 * mistake became fixed, so that tab has no honest line and draws none.
 *
 * ─── THE ACTION IS NOT IN HERE ANY MORE ─────────────────────────────────────
 * It used to carry a `Door` in its top-right corner, which is the smallest and
 * least pressable form a primary action can take. The work this feature is
 * asking for leads the tab now, as real queue rows with the button ON the row
 * — so the door here is the FALLBACK, drawn only when there is no outstanding
 * work to lead with. Two ways to the same place, one above the other, is the
 * duplication this codebase keeps deleting.
 *
 * ─── THE DELTA IS A FACT OR IT IS ABSENT ────────────────────────────────────
 * Null under the minimum-N floor and null on "All", where there is no previous
 * period to compare against — never a 0, which means "holding steady" and must
 * not double as "I do not know yet". When it is absent the NOTE says why, so
 * the gap reads as a refusal rather than as something that failed to load.
 *
 * ─── DIRECTION IS SHAPE AND COLOUR, NEVER COLOUR ALONE ──────────────────────
 * The brand green and the streak red sit at ΔE 7.0 under deuteranopia — the
 * floor's step-dot lesson and the Ranked board's movement lane, met a third
 * time. An arrow against an arrow is what makes this readable; the hue is the
 * second channel and the signed number is the third.
 */
import React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Spark from "@/components/progress/Spark";

const TONE = {
    good: "text-primary",
    watch: "text-streak",
    flat: "text-muted-foreground",
};

/** The movement chip, or nothing. */
export function Delta({ delta, suffix = "", display, invert = false }) {
    if (!delta) return null;
    const up = delta.value > 0;
    const good = invert ? !delta.better : delta.better;
    const Icon = delta.flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
    const ink = delta.flat ? "text-muted-foreground bg-muted"
        : good ? "text-primary bg-primary/10" : "text-streak bg-streak/10";
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${ink}`}>
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {/* THE CHIP SPEAKS THE HEADLINE'S UNIT. "3h 10m" with "+125 min"
                beside it is two units for one quantity, and the reader has to
                convert one of them to know whether the chip is big. */}
            {delta.flat ? "level" : `${up ? "+" : "−"}${display || `${Math.abs(delta.value)}${suffix}`}`}
        </span>
    );
}

export default function ReportStrip({
    value, suffix = "", label, delta, deltaSuffix = "", deltaDisplay, note, verdict, stats = [], action,
    series = null, percent = false, tone = "primary",
}) {
    return (
        <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="pb-1">

            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    {/* ONE BASELINE. The figure, the movement and what it is a
                        figure OF are one sentence, so they are set as one line
                        rather than as a number with a caption under it. */}
                    <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-1">
                        <p className="font-display font-extrabold text-foreground text-3xl sm:text-4xl
                            leading-none tabular-nums">
                            {value}<span className="text-xl sm:text-2xl">{suffix}</span>
                        </p>
                        <Delta delta={delta} suffix={deltaSuffix} display={deltaDisplay} />
                        <p className="stat-label">{label}</p>
                    </div>

                    {/* THE SENTENCE, and it is allowed to be absent. Padding it
                        to always say something is how a page teaches a student
                        that its words are decoration. */}
                    {verdict?.line && (
                        <p className={`mt-2 text-sm leading-snug font-semibold ${TONE[verdict.tone] || TONE.flat}`}>
                            {verdict.line}
                        </p>
                    )}
                    {!verdict?.line && note && (
                        <p className="mt-2 text-sm text-muted-foreground leading-snug">{note}</p>
                    )}

                    {/* The supporting figures, as a RUN rather than a grid.
                        Three numbers do not need four columns and a rule above
                        them; read left to right they are the one line that says
                        what the headline is made of. */}
                    {stats.length > 0 && (
                        <p className="mt-3 flex flex-wrap items-baseline gap-x-3.5 gap-y-1
                            text-xs text-muted-foreground">
                            {stats.map((s) => (
                                <span key={s.label}>
                                    <span className="font-display font-extrabold text-foreground text-sm tabular-nums">
                                        {s.value}
                                    </span>{" "}
                                    {s.label}
                                    {s.hint && <span className="opacity-70"> ({s.hint})</span>}
                                </span>
                            ))}
                        </p>
                    )}
                </div>
                {/* ─── THE LINE SITS BESIDE THE FIGURE ───────────────────
                    Not under it: a sparkline below the number reads as a
                    second row of content and pushes the supporting figures
                    down, and the whole point of this strip is that it is 131px
                    rather than 252. Beside, it uses the air the old card had
                    to the right of a four-character number, so it costs no
                    height at all. Hidden below `sm`, where a phone column has
                    no air to spend and the figure has to lead alone. */}
                {series?.length > 0 && (
                    <div className="hidden sm:block flex-shrink-0 w-32 lg:w-44 self-start mt-1.5">
                        <Spark series={series} percent={percent} tone={tone} />
                    </div>
                )}
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>
        </motion.section>
    );
}
