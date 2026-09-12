/**
 * WeeklyBoard — the week's standings, drawn as a race rather than a list.
 *
 * ─── The gap is the information ─────────────────────────────────────────────
 * A ranked list tells a student they are 7th. What makes 7th worth acting on
 * is how far 6th is, so every row carries its gap to the place above, drawn to
 * ONE scale across the board — the same call RankedBoard made, and for the
 * same reason: before it, the only gap anybody could see was their own.
 *
 * The scale is the MEDIAN gap doubled, not the largest. One student sitting
 * 400 points clear would otherwise set the scale for everybody and every gap
 * people could actually close would draw as two invisible pixels. Past twice
 * the median the bar simply fills and the row is "far"; the number is printed
 * beside it either way.
 *
 * ─── Your row and its neighbours carry a rail ───────────────────────────────
 * Those three rows are the race you are in. Side-specific border utilities and
 * `border-t` rather than `divide-y`, because Tailwind's `divide-*` writes
 * border-color through a combinator that outranks a plain `border-primary` on
 * the child — which is how the first rail on Ranked came out the same grey as
 * the dividers.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Minus } from "lucide-react";
import { SLICES, SLICE_MAX } from "@/lib/league";

const median = (xs) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ── Only FIRST gets a colour ────────────────────────────────────────────────
// The first draft gave third place `streak` — which is the app's red, and red
// here means a lead slipping, a mark dropped, a bet lost. So a podium finish
// rendered as a warning, in a ring drawn directly beside the word "you". The
// glyph and the colour have to agree, the same rule ScalingMark exists for.
// There is no bronze token and inventing one for a single ring is not worth a
// new colour in the palette, so second and third simply read as top-three.
const MEDAL = {
    1: "bg-xp/15 text-xp border-xp/40",
    2: "bg-secondary text-foreground border-border",
    3: "bg-secondary text-foreground border-border",
};

/** The three slices, so a score is a thing you can act on rather than a total. */
function Breakdown({ breakdown }) {
    if (!breakdown) return null;
    return (
        <div className="flex items-center gap-2 mt-2">
            {SLICES.map((s) => {
                const v = Number(breakdown[s.key]) || 0;
                const pct = Math.min(100, (v / SLICE_MAX[s.key]) * 100);
                return (
                    <div key={s.key} className="flex-1 min-w-0" title={`${s.label}: ${s.hint}`}>
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground truncate">{s.label}</span>
                            <span className="text-[10px] font-black text-foreground tabular-nums">{v}</span>
                        </div>
                        <div className="h-1 bg-secondary rounded-full overflow-hidden mt-0.5">
                            <motion.div
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className={`h-full rounded-full ${s.bar}`} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function WeeklyBoard({ rows = [] }) {
    const myPos = rows.find((r) => r.is_me)?.position ?? -1;

    // Gaps to the place above, and the scale they are drawn to.
    const { gaps, scale } = useMemo(() => {
        const g = rows.map((r, i) =>
            i === 0 ? 0 : Math.max(0, rows[i - 1].compete_score - r.compete_score));
        const real = g.slice(1).filter((n) => n > 0);
        // A board where everybody is level has no scale to speak of; 1 keeps
        // the arithmetic safe and every bar reads as zero, which is true.
        return { gaps: g, scale: Math.max(1, median(real) * 2) };
    }, [rows]);

    if (!rows.length) {
        return (
            <div className="card-soft p-8 text-center">
                <p className="text-sm text-muted-foreground">
                    Nobody has studied yet this week. First session takes the lead.
                </p>
            </div>
        );
    }

    return (
        <div className="card-soft overflow-hidden">
            {rows.map((r, i) => {
                const near = Math.abs(r.position - myPos) <= 1;
                const gap = gaps[i];
                return (
                    <div
                        key={`${r.position}-${r.display_name}`}
                        className={`relative px-4 py-3 ${i > 0 ? "border-t border-border" : ""}
                            ${r.is_me ? "bg-primary/5" : ""}
                            ${near ? "border-l-4 border-l-primary" : "border-l-4 border-l-transparent"}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 flex-shrink-0 rounded-xl border-2 flex items-center justify-center
                                font-display font-black text-xs tabular-nums
                                ${MEDAL[r.position] || "bg-secondary text-muted-foreground border-transparent"}`}>
                                {r.position}
                            </span>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={`font-bold text-sm truncate
                                        ${r.is_me ? "text-primary" : "text-foreground"}`}>
                                        {r.display_name}
                                    </span>
                                    {r.is_me && (
                                        <span className="stat-label text-primary flex-shrink-0">you</span>
                                    )}
                                    {r.streak_days > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold
                                            text-streak flex-shrink-0">
                                            <Flame className="w-3 h-3" />{r.streak_days}
                                        </span>
                                    )}
                                </div>

                                {/* The gap, on the one scale. Row 1 has nothing
                                    above it, so it gets a dash rather than a
                                    zero — "0 behind" reads as a tie. */}
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden max-w-[140px]">
                                        {i > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (gap / scale) * 100)}%` }}
                                                transition={{ duration: 0.6, ease: "easeOut" }}
                                                className="h-full rounded-full bg-muted-foreground/40" />
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums flex-shrink-0">
                                        {i === 0
                                            ? <Minus className="w-3 h-3 inline" />
                                            : `${gap} behind`}
                                    </span>
                                </div>
                            </div>

                            <span className="font-display font-black text-lg text-foreground tabular-nums flex-shrink-0">
                                {r.compete_score}
                            </span>
                        </div>

                        {/* Only your own row opens up. Thirty expanded rows is a
                            wall, and nobody needs another student's effort
                            split — what they need is the gap, which is above. */}
                        {r.is_me && <Breakdown breakdown={r.score_breakdown} />}
                    </div>
                );
            })}
        </div>
    );
}
