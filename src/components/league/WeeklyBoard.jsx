/**
 * WeeklyBoard — the week's standings, drawn as a race rather than a list.
 *
 * ─── The gap is the information ─────────────────────────────────────────────
 * A ranked list tells a student they are 7th. What makes 7th worth acting on
 * is how far 6th is, so every row carries its gap to the place above, drawn to
 * ONE scale across the board — the same call RankedBoard made, and for the
 * same reason: before it, the only gap anybody could see was their own.
 *
 * The scale is the MEDIAN gap doubled, not the largest (`gapScale`, the one
 * Ranked draws by too). One student sitting 400 points clear would otherwise
 * set the scale for everybody and every gap people could actually close would
 * draw as two invisible pixels. Past twice the median the bar simply fills
 * and the row is "far"; the number is printed beside it either way.
 *
 * ─── THE PAYLINE IS DRAWN, because it is the only edge on the board ────────
 * Three places pay and the other twenty-seven do not. The top three are on the
 * table above (`Podium`), so this ledger starts at fourth, and the rule across
 * its top edge names what is on the other side of it — which is what turns
 * "I'm 4th" into something worth one more session on a Thursday. It is drawn
 * only when there is somebody below it: a line over an empty ledger claims a
 * cut-off that does not exist. On a board too small for a podium the ledger
 * holds everybody and there is no line at all.
 *
 * Rows, the race to new places and your row following you are the shared kit
 * (`src/components/boards/`), the same three things Ranked draws with.
 *
 * ─── Your row and its neighbours carry a rail ───────────────────────────────
 * Those three rows are the race you are in. Side-specific border utilities and
 * `border-t` rather than `divide-y`, because Tailwind's `divide-*` writes
 * border-color through a combinator that outranks a plain `border-primary` on
 * the child — which is how the first rail on Ranked came out the same grey as
 * the dividers.
 */
import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";
import Crest from "@/components/shared/Crest";
import LedgerRow from "@/components/boards/LedgerRow";
import BoardAvatar from "@/components/boards/BoardAvatar";
import LiveFigure from "@/components/boards/LiveFigure";
import MyRowDock, { useDockSide } from "@/components/boards/MyRowDock";
import useArrival from "@/components/boards/useArrival";
import { SLICES, SLICE_MAX, PODIUM, ordinal } from "@/lib/league";
import { gapsOf, gapScale, gapPct, REVEAL_MS } from "@/lib/boardKit";

const plain = (v) => Math.round(Number(v) || 0).toLocaleString();

/** The three slices, so a score is a thing you can act on rather than a total. */
function Breakdown({ breakdown }) {
    if (!breakdown) return null;
    return (
        /* Indented to the name, so the split reads as part of this row rather
           than as a strip across the board. On a phone it takes the full
           width, because three labelled slices need it more than the indent. */
        <div className="flex items-center gap-2 mt-2 sm:pl-[5.875rem]">
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

/**
 * `from` is where the ledger starts: PODIUM when the table above is holding
 * the top three, 0 when the board is too small to have one.
 */
export default function WeeklyBoard({ rows = [], from = 0 }) {
    const arriving = useArrival(REVEAL_MS);
    const [flash, setFlash] = useState(0);
    const myPos = rows.find((r) => r.is_me)?.position ?? -1;

    // Gaps to the place above, and the scale they are drawn to — computed over
    // the WHOLE board, so fourth's bar is its gap to third on the table.
    const { gaps, scale } = useMemo(() => {
        const g = gapsOf(rows.map((r) => r.compete_score));
        return { gaps: g, scale: gapScale(g) };
    }, [rows]);

    const shown = rows.slice(from);
    const meIndex = rows.findIndex((r) => r.is_me);
    const meRow = meIndex >= from ? rows[meIndex] : null;
    const myRowRef = useRef(null);
    const side = useDockSide(myRowRef, `${from}|${rows.length}|${meIndex}`);

    if (!rows.length) {
        return (
            <div className="card-soft p-8 text-center">
                <p className="text-sm text-muted-foreground">
                    Nobody has studied yet this week. First session takes the lead.
                </p>
            </div>
        );
    }
    if (!shown.length) return null;

    const payline = from >= PODIUM;

    return (
        <>
        <div className="card-soft">
            {payline && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-xp/5 border-b border-xp/30 rounded-t-2xl">
                    <span className="stat-label text-xp">Podium</span>
                    <div className="flex-1 h-px bg-xp/30" />
                    <span className="text-[11px] font-bold text-muted-foreground">
                        Top 3 on Monday
                    </span>
                </div>
            )}
            <div className="relative [&>*:first-child]:border-t-0">
                <AnimatePresence mode="popLayout">
                    {shown.map((r, i) => {
                        const idx = i + from;
                        const gap = gaps[idx];
                        const pct = gapPct(gap, scale);
                        return (
                            <LedgerRow key={r.display_name} rowRef={r.is_me ? myRowRef : undefined}
                                person={r.display_name} layoutScope="league" moveLane={false}
                                edges={payline ? "bottom" : "both"}
                                place={r.position} name={r.display_name}
                                isMe={!!r.is_me} near={!r.is_me && Math.abs(r.position - myPos) <= 1}
                                index={i} arriving={arriving} flash={r.is_me ? flash : 0}
                                figure={{ value: r.compete_score, format: plain, quantity: "compete" }}
                                gap={pct == null ? null : { pct, label: plain(gap) }}
                                badges={
                                    <>
                                        {r.is_me && <span className="stat-label text-primary flex-shrink-0">you</span>}
                                        {/* Last week's finish, worn for one week,
                                            and otherwise whatever they bought. The
                                            EARNED mark outranks the bought one: it
                                            is the one with information in it, and
                                            the only reward on this board other
                                            students can see. */}
                                        {(r.crest || r.crest_skin) && (
                                            <Crest podium={r.crest} skin={r.crest ? null : r.crest_skin} />
                                        )}
                                        {r.streak_days > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold
                                                text-streak flex-shrink-0">
                                                <Flame className="w-3 h-3" />{r.streak_days}
                                            </span>
                                        )}
                                    </>
                                }
                                /* Only your own row opens up. Thirty expanded rows
                                   is a wall, and nobody needs another student's
                                   effort split — what they need is the gap. */
                                extra={r.is_me ? <Breakdown breakdown={r.score_breakdown} /> : null} />
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>

        {/* Your row, holding on at the edge it left by. */}
        <MyRowDock side={meRow ? side : null} label="Back to your place this week"
            onReturn={() => {
                myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                setFlash((n) => n + 1);
            }}>
            {meRow && (
                <>
                    <span className="font-display font-black tabular-nums text-lg leading-none text-primary flex-shrink-0 w-7 text-center">
                        {meRow.position}
                    </span>
                    <BoardAvatar name={meRow.display_name} size={32} ring="ring-2 ring-primary/40" />
                    <span className="flex-1 min-w-0">
                        <span className="block text-xs font-black text-primary truncate">
                            {ordinal(meRow.position)} this week
                        </span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                            {gaps[meIndex] != null ? `${plain(gaps[meIndex])} behind ${ordinal(meRow.position - 1)}` : "Top of the league"}
                        </span>
                    </span>
                    <span className="font-display font-extrabold flex-shrink-0">
                        <LiveFigure value={meRow.compete_score} format={plain} quantity="compete" />
                    </span>
                </>
            )}
        </MyRowDock>
        </>
    );
}
