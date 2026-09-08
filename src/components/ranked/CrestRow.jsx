/**
 * CrestRow — the rarest badges a student holds, beside their name.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * An achievement only its owner can see is a private checklist. The whole
 * reason to chase one is that somebody else notices, and until this the entire
 * system lived on a tab inside a tab on one page — twenty-four badges nobody
 * could show anybody.
 *
 * ─── Rarest only, and at most three ─────────────────────────────────────────
 * A student with twenty badges renders three, because a row of twenty is
 * wallpaper and the interesting fact is the best one. `showcase()` in
 * achievements.js owns that ordering so the board row and the profile cannot
 * disagree about which badge is a student's best.
 *
 * A common badge is NOT drawn here at all. Everyone has "add your first
 * subject"; a mark everybody carries distinguishes nobody, and the row would
 * become noise on every line of the board.
 */
import React from "react";
import * as Icons from "lucide-react";

const TONE = {
    rare:      "bg-chart-3/15 text-chart-3 border-chart-3/30",
    epic:      "bg-chart-4/15 text-chart-4 border-chart-4/30",
    legendary: "bg-xp/15 text-xp border-xp/40",
};

export default function CrestRow({ crests = [], size = "sm", className = "" }) {
    const worth = (crests || []).filter((c) => TONE[c?.rarity]);
    if (!worth.length) return null;

    const box = size === "md" ? "w-7 h-7" : "w-5 h-5";
    const glyph = size === "md" ? "w-4 h-4" : "w-3 h-3";

    return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
            {worth.slice(0, 3).map((c) => {
                const Icon = Icons[c.icon] || Icons.Award;
                return (
                    <span key={c.code}
                        title={`${c.name} — ${c.rarity}`}
                        className={`${box} rounded-md border flex items-center justify-center
                            flex-shrink-0 ${TONE[c.rarity]}`}>
                        <Icon className={glyph} strokeWidth={2.5} />
                    </span>
                );
            })}
        </span>
    );
}
