/**
 * ReportHead — the four things every Progress tab opens with.
 *
 * One headline figure · how it moved against the student's OWN previous period
 * · a sentence saying what that means · the supporting figures. Identical on
 * all four feature tabs, which is the whole reason the report reads faster than
 * the one long scroll it replaced: the shape is learned once and then every
 * other tab is read at a glance.
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

const TONE = {
    good: "text-primary",
    watch: "text-streak",
    flat: "text-muted-foreground",
};

/** The movement chip, or nothing. */
function Delta({ delta, suffix = "", display, invert = false }) {
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

export default function ReportHead({
    value, suffix = "", label, delta, deltaSuffix = "", deltaDisplay, note, verdict, stats = [], action,
}) {
    return (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="card-soft on-table p-5 sm:p-6">

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                        <p className="font-display font-extrabold text-foreground text-4xl sm:text-5xl
                            leading-none tabular-nums">
                            {value}<span className="text-2xl sm:text-3xl">{suffix}</span>
                        </p>
                        <Delta delta={delta} suffix={deltaSuffix} display={deltaDisplay} />
                    </div>
                    <p className="stat-label mt-2">{label}</p>
                </div>
                {action}
            </div>

            {/* THE SENTENCE, and it is allowed to be absent. Padding it to
                always say something is how a page teaches a student that its
                words are decoration. */}
            {verdict?.line && (
                <p className={`mt-4 text-sm leading-snug font-semibold ${TONE[verdict.tone] || TONE.flat}`}>
                    {verdict.line}
                </p>
            )}
            {!verdict?.line && note && (
                <p className="mt-4 text-sm text-muted-foreground leading-snug">{note}</p>
            )}

            {/* The supporting figures, on fixed columns so they share a
                baseline — the difference between a table somebody designed and
                a row of divs, which is the Ranked board's own lesson. */}
            {stats.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                    {stats.map((s) => (
                        <div key={s.label} className="min-w-0">
                            <p className="font-display font-extrabold text-foreground text-xl leading-none tabular-nums">
                                {s.value}
                            </p>
                            <p className="stat-label mt-1 truncate">{s.label}</p>
                            {s.hint && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.hint}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </motion.section>
    );
}
