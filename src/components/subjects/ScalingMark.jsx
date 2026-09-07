/**
 * ScalingMark — how a subject scales, drawn so the direction is unmistakable.
 *
 * ─── The bug this exists to kill ────────────────────────────────────────────
 * Browse printed every scaling factor in one pill: a `TrendingUp` arrow, in
 * `text-primary` green, whatever the number was. So Further Maths at −4 and
 * Specialist at +13 both got a green arrow pointing up, on the single number
 * VCE students most want off this page. The sign was there in the text and
 * every other signal on the pill contradicted it.
 *
 * Direction now drives the glyph and the colour together, and the two cannot
 * disagree because they come off the same comparison.
 *
 * ─── Unknown is drawn as unknown ────────────────────────────────────────────
 * One subject in the catalogue carries "+N", which is a placeholder, not a
 * number. It renders as a dash in muted ink rather than as a zero — "scales
 * neutrally" and "we do not have this" are different claims and a student
 * choosing a subject deserves to be told which one they are getting.
 */
import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { scalingOf } from "@/lib/subjectBrowse";

const SIZES = {
    // On a browse card, where it is the headline.
    lg: { wrap: "text-2xl", icon: "w-4 h-4", sub: "text-[10px]" },
    // Inline beside a title.
    sm: { wrap: "text-sm", icon: "w-3 h-3", sub: "text-[10px]" },
};

export default function ScalingMark({ subject, size = "lg", showLabel = true }) {
    const n = scalingOf(subject);
    const s = SIZES[size] || SIZES.lg;

    if (n == null) {
        return (
            <span className="inline-flex flex-col items-end">
                <span className={`inline-flex items-center gap-1 font-display font-extrabold
                    text-muted-foreground/50 leading-none ${s.wrap}`}>
                    <Minus className={s.icon} aria-hidden="true" />
                </span>
                {showLabel && (
                    <span className={`text-muted-foreground/60 ${s.sub}`}>no data</span>
                )}
            </span>
        );
    }

    // Static classes, both branches spelled out — the JIT cannot see a colour
    // assembled from a template string.
    const up = n > 0;
    const flat = n === 0;
    const tone = flat ? "text-muted-foreground" : up ? "text-primary" : "text-streak";
    const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;

    return (
        <span className="inline-flex flex-col items-end">
            <span className={`inline-flex items-center gap-0.5 font-display font-extrabold
                leading-none tabular-nums ${tone} ${s.wrap}`}>
                <Icon className={s.icon} aria-hidden="true" />
                {n > 0 ? `+${n}` : n}
            </span>
            {showLabel && (
                <span className={`text-muted-foreground/70 ${s.sub}`}>
                    {up ? "scales up" : flat ? "neutral" : "scales down"}
                </span>
            )}
        </span>
    );
}
