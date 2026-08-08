/**
 * RankedBoard — the leaderboard, with someone actually on it.
 *
 * The old version was a flat list of rank, name, number. Three changes make it
 * a competition rather than a table:
 *
 *   • A podium. Top three read as a result, not as rows 1-3 of 50.
 *   • Identity. A colour and initials per person, a title where one is
 *     genuinely earned, and their other stats — so a name means something.
 *   • The gap. Your row says how far behind the person above you are, which
 *     is the only number on the page you can chase tonight.
 *
 * And if you're outside the visible list your row is pinned to the bottom
 * anyway. Being 200th and unable to find yourself is how a leaderboard stops
 * being motivating.
 */
import React from "react";
import { motion } from "framer-motion";
import { Flame, Crown, Medal } from "lucide-react";
import { avatarHue, initialsOf, rowFlex, BAND_TONE } from "@/lib/ranked";

const TONE_PILL = {
    muted: "bg-secondary text-muted-foreground", xp: "bg-xp/15 text-xp",
    "chart-3": "bg-chart-3/15 text-chart-3", "chart-4": "bg-chart-4/15 text-chart-4",
    primary: "bg-primary/15 text-primary", streak: "bg-streak/15 text-streak",
};
const PODIUM = [
    { ring: "border-xp",     bg: "bg-xp/10",     text: "text-xp",     icon: Crown, label: "1st" },
    { ring: "border-border", bg: "bg-secondary", text: "text-muted-foreground", icon: Medal, label: "2nd" },
    { ring: "border-xp/40",  bg: "bg-xp/5",      text: "text-xp/80",  icon: Medal, label: "3rd" },
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

function Row({ row, place, isMe, boardMeta, title, name, gapLabel }) {
    const flex = rowFlex(row, boardMeta.id);
    const band = boardMeta.id === "atar" ? row.band : null;
    return (
        <div data-row={isMe ? "me" : undefined}
            className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-primary/5" : ""}`}>
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
                <p className="text-[11px] text-muted-foreground truncate">
                    {isMe && gapLabel
                        ? <span className="text-foreground font-bold">{gapLabel}</span>
                        : flex || " "}
                </p>
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
    );
}

export default function RankedBoard({ rows = [], me, boardMeta, titles = new Map(), nameOf, myStanding, gapLabel }) {
    if (!rows.length) return null;
    const top = rows.slice(0, 3);
    const rest = rows.slice(3);
    const meIndex = rows.findIndex(r => r.user_email === me);
    const meVisible = meIndex >= 0;

    return (
        <div className="space-y-3">
            {/* ── Podium ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
                                slot === 0 ? "sm:-translate-y-3" : ""} ${isMe ? "ring-2 ring-primary" : ""}`}>
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
                <div className="card-soft divide-y divide-border overflow-hidden">
                    {rest.map((r, i) => (
                        <Row key={r.user_email} row={r} place={i + 4} isMe={r.user_email === me}
                            boardMeta={boardMeta} title={titles.get(r.user_email)} name={nameOf(r)}
                            gapLabel={r.user_email === me ? gapLabel : null} />
                    ))}
                </div>
            )}

            {/* Outside the visible list — pinned, so you can always find yourself. */}
            {!meVisible && myStanding?.rank && (
                <div className="card-soft overflow-hidden border-2 border-primary/30">
                    <p className="px-4 pt-2.5 text-[11px] text-muted-foreground">Outside the top {rows.length}</p>
                    <Row row={myStanding.row} place={myStanding.rank} isMe boardMeta={boardMeta}
                        title={titles.get(me)} name={nameOf(myStanding.row)} gapLabel={gapLabel} />
                </div>
            )}
        </div>
    );
}
