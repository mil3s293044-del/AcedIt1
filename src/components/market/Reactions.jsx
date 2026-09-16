/**
 * Reactions — one tap, a fixed set of glyphs, and NO FREE TEXT.
 *
 * ─── The decision this keeps ────────────────────────────────────────────────
 * Migration 0034 ruled out a text box on Compete in its own words: "These are
 * 16-year-olds competing with each other and sometimes losing in front of the
 * group; a text box on that is a moderation problem this app has no way to
 * staff." That reasoning got STRONGER when markets started being auto-minted
 * about named students — a comment thread under "Will Maya study 5+ days this
 * week?" is an unmoderated public thread about a named minor, on a page her
 * whole school can open.
 *
 * What replaces it is already here: the position tape. "Maya took no at 71¢
 * with 300 cred" is a statement with a name and money behind it, and it needs
 * no moderation because the only vocabulary is a price. The glyphs are the
 * rest — one tap is the smallest possible way to say "I saw that", and it is
 * the difference between a timeline and a log file.
 *
 * ─── The key is DERIVED on the server, never sent ───────────────────────────
 * The component posts a market id (and optionally a position id) and the server
 * builds the event key. A client that could name its own key could park a
 * reaction on any string it liked, and the contest path's membership check —
 * the thing that guards the feed's client-supplied keys — does not exist for a
 * market, whose audience is the whole board.
 */
import React, { useCallback, useState } from "react";
import { base44 } from "@/api/base44Client";

const GLYPHS = ["👀", "🔥", "😮", "👏", "🧊"];

export default function Reactions({
    marketId, positionId = null, counts = {}, mine = null, size = "md",
}) {
    // Optimistic and LOCAL: the server owns the truth, but a glyph that waits
    // for a round trip before it lights up feels broken, and this is the one
    // interaction on the page with no consequence worth guarding.
    const [local, setLocal] = useState({ counts, mine });
    const [busy, setBusy] = useState(false);

    const tap = useCallback(async (emoji) => {
        if (busy) return;
        setBusy(true);
        const was = local.mine;
        const next = { ...local.counts };
        if (was) next[was] = Math.max(0, (next[was] || 1) - 1);
        const mineNext = was === emoji ? null : emoji;
        if (mineNext) next[mineNext] = (next[mineNext] || 0) + 1;
        setLocal({ counts: next, mine: mineNext });
        try {
            await base44.functions.invoke("reactToEvent", {
                market_id: marketId,
                position_id: positionId || undefined,
                emoji: mineNext || emoji,
            });
        } catch {
            setLocal({ counts, mine });      // put it back rather than lie
        } finally {
            setBusy(false);
        }
    }, [busy, local, marketId, positionId, counts, mine]);

    const small = size === "sm";
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {GLYPHS.map((g) => {
                const n = local.counts[g] || 0;
                const on = local.mine === g;
                // An untapped glyph with no count is an INVITATION and stays
                // visible; hiding the empty ones would leave nothing to press.
                return (
                    <button key={g} type="button" onClick={() => tap(g)} disabled={busy}
                        aria-pressed={on}
                        aria-label={`React ${g}${n ? `, ${n} so far` : ""}`}
                        className={`inline-flex items-center gap-1 rounded-lg border transition-colors
                            ${small ? "px-1.5 py-0.5 text-[12px]" : "px-2 py-1 text-[15px]"}
                            ${on ? "border-[var(--floor-warn-ink)] bg-[rgb(var(--floor-warn-rgb)/0.1)]"
                                : "border-[var(--floor-edge)] hover:border-[var(--floor-edge-hover)]"}`}>
                        <span>{g}</span>
                        {n > 0 && (
                            <span className={`font-bold tabular-nums
                                ${small ? "text-[10px]" : "text-[11px]"}
                                ${on ? "text-[var(--floor-warn-ink)]" : "text-[var(--floor-muted-2)]"}`}>{n}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
