/**
 * RankedBoard — a ladder you can see yourself climbing.
 *
 * ─── What a leaderboard has to do ───────────────────────────────────────────
 * Make a position look worth taking. A flat list of rank, name and number does
 * the opposite: it reads as a fact about other people, arranged in an order
 * nobody in the middle of it can imagine changing. Three things fix that, and
 * all three are about the SPACE BETWEEN rows rather than the rows themselves.
 *
 *   THE GAP, ON EVERY ROW. Not just yours. Each row says what it would take to
 *   pass the person above it, and a bar draws that gap to a scale shared by
 *   the whole board — so a short bar is genuinely a short reach and the eye
 *   can find the tight parts of the ladder without reading a single number.
 *   This is the change that makes a position look takeable: before it, the
 *   only person who could see a gap was you, and only your own.
 *
 *   THE CONTEST, BRACKETED. Your row and the two either side are drawn as one
 *   group with a rail down the side, because those three rows are the race you
 *   are actually in. Everything else on the board is weather.
 *
 *   THE PODIUM. Top three read as a result rather than as rows 1–3 of 50,
 *   with the winner raised and crowned.
 *
 * ─── The bar is a real quantity, drawn to one scale ─────────────────────────
 * Bar length is that row's gap to the row above, against a scale shared by the
 * whole board — so every bar is comparable with every other and nothing had to
 * be invented to draw it. The obvious alternative, value over the value above,
 * is useless on the ATAR board where every ratio lands between 0.95 and 1.
 *
 * THE SCALE IS THE MEDIAN GAP, NOT THE LARGEST. Dividing by the largest looked
 * principled and was unreadable: one student sitting 27 points clear of the
 * field set the scale for everybody, so the nine gaps that actually matter —
 * the 0.3s and 0.7s people can close this week — all drew as two invisible
 * pixels. A median-based scale gives the typical gap a legible mid-length bar,
 * which is the whole point of drawing it. Anything at or past twice the median
 * fills the bar and is simply "far"; the exact number is printed beside it, so
 * the cap loses nothing a student needed.
 *
 * And if you're outside the visible list your row is pinned to the bottom
 * anyway. Being 200th and unable to find yourself is how a leaderboard stops
 * being motivating.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Crown, Medal, ChevronUp } from "lucide-react";
import { avatarHue, initialsOf, rowFlex, BAND_TONE } from "@/lib/ranked";

const TONE_PILL = {
    muted: "bg-secondary text-muted-foreground", xp: "bg-xp/15 text-xp",
    "chart-3": "bg-chart-3/15 text-chart-3", "chart-4": "bg-chart-4/15 text-chart-4",
    primary: "bg-primary/15 text-primary", streak: "bg-streak/15 text-streak",
};
const PODIUM = [
    { ring: "border-xp",        bg: "bg-xp/10",       text: "text-xp",              icon: Crown, label: "1st" },
    { ring: "border-border",    bg: "bg-secondary",   text: "text-muted-foreground", icon: Medal, label: "2nd" },
    { ring: "border-xp/40",     bg: "bg-xp/5",        text: "text-xp/80",           icon: Medal, label: "3rd" },
];

function Avatar({ name, size = 40, ring = "" }) {
    const hue = avatarHue(name);
    return (
        <div className={`rounded-2xl flex items-center justify-center font-display font-black flex-shrink-0 ${ring}`}
            style={{
                width: size, height: size,
                backgroundColor: `hsl(${hue} 70% 92%)`,
                color: `hsl(${hue} 70% 28%)`,
                fontSize: size * 0.36,
            }}
            aria-hidden="true">
            {initialsOf(name)}
        </div>
    );
}

function Title({ title }) {
    if (!title) return null;
    return (
        <span className={`pill text-[10px] ${TONE_PILL[title.tone] || TONE_PILL.primary}`} title={title.blurb}>
            {title.label}
        </span>
    );
}

function Row({ row, place, isMe, boardMeta, title, name, gap, gapScale, near }) {
    const flex = rowFlex(row, boardMeta.id);
    const band = boardMeta.id === "atar" ? row.band : null;
    // A gap of zero is a genuine tie, not a missing value, so it still draws —
    // at the floor width, which reads as "level with them".
    const pct = gap != null && gapScale > 0
        ? Math.max(4, Math.min(100, (gap / gapScale) * 100))
        : null;

    return (
        <div data-row={isMe ? "me" : undefined}
            /* The rail is what makes three rows read as one group. A tint
               alone did not: at the strength a leaderboard can carry without
               looking striped, "slightly warmer grey" is invisible next to
               white, and the contest you are actually in has to be findable
               without hunting for your own name.

               SIDE-SPECIFIC colour utilities, and the list separates itself
               with `border-t` rather than `divide-y`. Tailwind's divide-*
               writes `border-color` on every child through a combinator, which
               outranks a plain `border-primary` on the child itself — so the
               first version of this rail came out the same grey as the
               dividers, on every row, and looked like nothing had changed. */
            className={`pl-3 pr-4 py-2 border-t border-t-border border-l-4 transition-colors ${
                isMe ? "bg-primary/[0.07] border-l-primary"
                    : near ? "bg-primary/[0.03] border-l-primary/30"
                    : "border-l-transparent"}`}>
            <div className="flex items-center gap-3">
                <span className={`w-7 text-center font-display font-black text-sm flex-shrink-0 tabular-nums ${
                    isMe ? "text-primary" : "text-muted-foreground"}`}>
                    {place}
                </span>
                <Avatar name={name} size={36} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm truncate ${isMe ? "font-black text-primary" : "font-bold text-foreground"}`}>
                            {name}
                        </p>
                        <Title title={title} />
                        {band && (
                            <span className={`pill text-[10px] ${TONE_PILL[BAND_TONE[band]] || TONE_PILL.muted}`}>{band}</span>
                        )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{flex || " "}</p>
                </div>
                {row.streak_days > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-streak flex-shrink-0">
                        <Flame className={row.streak_days >= 30 ? "w-4 h-4" : "w-3 h-3"} /> {row.streak_days}
                    </span>
                )}
                <span className="font-display font-extrabold text-foreground tabular-nums flex-shrink-0">
                    {boardMeta.fmt(boardMeta.value(row))}
                </span>
            </div>

            {/* The reach to the row above, right-aligned under the score it
                is a difference from. Short and fixed-width rather than
                stretched across the row: a hairline spanning the full width
                read as a divider that had gone wrong, and the length is the
                information — it needs a bar you can compare against the one
                above it, not a bigger one. */}
            {pct != null && (
                <div className="flex items-center justify-end gap-1.5 mt-1">
                    <span className={`inline-flex items-center text-[10px] font-bold tabular-nums ${
                        isMe ? "text-primary" : "text-muted-foreground"}`}>
                        <ChevronUp className="w-2.5 h-2.5" />{boardMeta.gapShort
                            ? boardMeta.gapShort(gap) : gap.toFixed(2)}
                    </span>
                    <div className="h-1.5 w-14 sm:w-20 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                        <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`h-full rounded-full ${isMe ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RankedBoard({ rows = [], me, boardMeta, titles = new Map(), nameOf, myStanding }) {
    const top = rows.slice(0, 3);
    const rest = rows.slice(3);
    const meIndex = rows.findIndex(r => r.user_email === me);
    const meVisible = meIndex >= 0;

    // Every adjacent gap on the visible board, and the biggest of them — the
    // one scale all the bars are drawn against.
    const { gaps, gapScale } = useMemo(() => {
        const g = rows.map((r, i) => (i === 0 ? null
            : Math.max(0, (boardMeta.value(rows[i - 1]) || 0) - (boardMeta.value(r) || 0))));
        const finite = g.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
        if (!finite.length) return { gaps: g, gapScale: 0 };
        const median = finite[Math.floor(finite.length / 2)];
        // A board where everyone is level has a median of 0 and no scale to
        // draw against; fall back to the largest so the bars still mean
        // something rather than dividing by zero.
        return { gaps: g, gapScale: median > 0 ? median * 2 : finite[finite.length - 1] };
    }, [rows, boardMeta]);

    if (!rows.length) return null;

    return (
        <div className="space-y-3">
            {/* ── Podium ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
                {[1, 0, 2].map(slot => {
                    const r = top[slot];
                    if (!r) return <div key={slot} />;
                    const p = PODIUM[slot];
                    const Icon = p.icon;
                    const name = nameOf(r);
                    const isMe = r.user_email === me;
                    return (
                        <motion.div key={r.user_email}
                            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * slot, duration: 0.35 }}
                            data-podium={slot + 1}
                            className={`rounded-2xl border-2 ${p.ring} ${p.bg} p-3 text-center ${
                                slot === 0 ? "sm:pb-5" : ""} ${isMe ? "ring-2 ring-primary" : ""}`}>
                            <Icon className={`w-4 h-4 mx-auto mb-1.5 ${p.text}`} />
                            <div className="flex justify-center mb-1.5">
                                <Avatar name={name} size={slot === 0 ? 52 : 42} />
                            </div>
                            <p className={`text-xs truncate ${isMe ? "font-black text-primary" : "font-bold text-foreground"}`}>
                                {name}
                            </p>
                            <p className="font-display font-black text-foreground tabular-nums mt-0.5"
                                style={{ fontSize: slot === 0 ? "1.35rem" : "1.1rem" }}>
                                {boardMeta.fmt(boardMeta.value(r))}
                            </p>
                            <div className="flex justify-center mt-1">
                                <Title title={titles.get(r.user_email)} />
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── The rest ───────────────────────────────────────────────── */}
            {rest.length > 0 && (
                <div className="card-soft overflow-hidden [&>*:first-child]:border-t-0">
                    {rest.map((r, i) => {
                        const idx = i + 3;
                        // Your row and the two either side: the race you are
                        // actually in, marked as one group.
                        const near = meVisible && Math.abs(idx - meIndex) === 1;
                        return (
                            <Row key={r.user_email} row={r} place={idx + 1}
                                isMe={r.user_email === me} near={near}
                                boardMeta={boardMeta} title={titles.get(r.user_email)} name={nameOf(r)}
                                gap={gaps[idx]} gapScale={gapScale} />
                        );
                    })}
                </div>
            )}

            {rest.length > 0 && (
                <p className="text-[11px] text-muted-foreground px-1">
                    The bar on each row is the gap to the place above it, drawn to one scale across
                    the board — a short bar is a spot you could take this week.
                </p>
            )}

            {/* Outside the visible list — pinned, so you can always find yourself. */}
            {!meVisible && myStanding?.rank && (
                <div className="card-soft overflow-hidden border-2 border-primary/30">
                    <p className="px-4 pt-2.5 text-[11px] text-muted-foreground">Outside the top {rows.length}</p>
                    <Row row={myStanding.row} place={myStanding.rank} isMe boardMeta={boardMeta}
                        title={titles.get(me)} name={nameOf(myStanding.row)}
                        gap={myStanding.above?.gap ?? null} gapScale={gapScale} />
                </div>
            )}
        </div>
    );
}
