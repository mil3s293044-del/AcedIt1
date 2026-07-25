import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Clock, Loader2, Flame, Crown } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Global rankings by total XP and study hours — podium for the top three,
 * rich rows below (initial avatars, streaks, levels, relative progress bars),
 * mock ATAR badges throughout. Reads the public leaderboards table.
 */

// Initials avatar colour — hashed to a token class (JIT-safe static list).
const AVATAR_TONES = [
    "bg-chart-3/15 text-chart-3",
    "bg-chart-4/15 text-chart-4",
    "bg-primary/15 text-primary",
    "bg-xp/15 text-xp",
    "bg-streak/15 text-streak",
];
const toneOf = (name) => AVATAR_TONES[(name || "?").charCodeAt(0) % AVATAR_TONES.length];
const initialsOf = (name) => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

function hoursLabel(minutes) {
    const h = Math.floor((minutes || 0) / 60);
    const m = Math.round((minutes || 0) % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function displayName(r) {
    return r.is_anonymous ? "Anonymous" : (r.username || r.user_name || "Student");
}

function AtarBadge({ value, className = "" }) {
    if (value == null) return null;
    return (
        <span className={`pill bg-chart-4/10 text-chart-4 flex-shrink-0 ${className}`}
            title="Mock ATAR — a game score from practice in AcedIt, not a real prediction">
            {Number(value).toFixed(2)}
        </span>
    );
}

export default function GlobalLeaderboard() {
    const [metric, setMetric] = useState("xp"); // xp | hours
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myEmail, setMyEmail] = useState(null);

    useEffect(() => {
        base44.auth.me().then((u) => setMyEmail(u?.email || null)).catch(() => {});
    }, []);

    useEffect(() => {
        let on = true;
        setLoading(true);
        const sortField = metric === "xp" ? "-total_xp" : "-total_study_time";
        base44.entities.Leaderboard.filter({}, sortField, 50)
            .then((list) => { if (on) setRows(list || []); })
            .catch(() => { if (on) setRows([]); })
            .finally(() => { if (on) setLoading(false); });
        return () => { on = false; };
    }, [metric]);

    const valueOf = (r) => metric === "xp" ? (r.total_xp || 0) : (r.total_study_time || 0);
    const valueLabel = (r) => metric === "xp" ? `${(r.total_xp || 0).toLocaleString()} XP` : hoursLabel(r.total_study_time);
    const topValue = valueOf(rows[0] || {}) || 1;

    const podium = rows.slice(0, 3);
    const rest = rows.slice(3);
    // Podium display order: 2nd · 1st · 3rd
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);

    // JIT-safe podium styling per actual rank
    const PODIUM_STYLE = {
        1: { card: "bg-gradient-to-b from-xp/15 to-surface border-xp/40", ring: "ring-2 ring-xp/50", h: "pt-6 pb-5", medal: "🥇" },
        2: { card: "bg-gradient-to-b from-chart-3/10 to-surface border-chart-3/30", ring: "ring-1 ring-chart-3/30", h: "pt-4 pb-4 mt-5", medal: "🥈" },
        3: { card: "bg-gradient-to-b from-streak/10 to-surface border-streak/25", ring: "ring-1 ring-streak/25", h: "pt-4 pb-4 mt-8", medal: "🥉" },
    };

    return (
        <div className="space-y-4">
            {/* Metric toggle */}
            <div className="flex gap-2">
                <button onClick={() => setMetric("xp")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${
                        metric === "xp" ? "bg-xp border-xp text-white shadow-soft" : "bg-surface border-border text-muted-foreground hover:border-xp/40"
                    }`}>
                    <Zap className="w-4 h-4" /> Total XP
                </button>
                <button onClick={() => setMetric("hours")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${
                        metric === "hours" ? "bg-chart-3 border-chart-3 text-white shadow-soft" : "bg-surface border-border text-muted-foreground hover:border-chart-3/40"
                    }`}>
                    <Clock className="w-4 h-4" /> Study hours
                </button>
            </div>

            {loading ? (
                <div className="card-soft p-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading rankings…
                </div>
            ) : rows.length === 0 ? (
                <div className="card-soft p-10 text-center text-sm text-muted-foreground">
                    No rankings yet — do a study session and claim the top spot.
                </div>
            ) : (
                <>
                    {/* ── Podium ── */}
                    {podium.length >= 1 && (
                        <div className="grid grid-cols-3 gap-2.5 items-end">
                            {podiumOrder.map((r) => {
                                const rank = rows.indexOf(r) + 1;
                                const st = PODIUM_STYLE[rank];
                                const name = displayName(r);
                                const isMe = r.user_email === myEmail;
                                return (
                                    <motion.div key={r.id || r.user_email}
                                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.06 }}
                                        className={`relative rounded-2xl border-2 text-center px-2 ${st.h} ${st.card} ${isMe ? "outline outline-2 outline-primary/50" : ""}`}>
                                        {rank === 1 && <Crown className="w-5 h-5 text-xp absolute -top-2.5 left-1/2 -translate-x-1/2" fill="currentColor" />}
                                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center font-display font-extrabold text-base ${toneOf(name)} ${st.ring}`}>
                                            {r.is_anonymous ? "?" : initialsOf(name)}
                                        </div>
                                        <p className="text-lg mt-1 leading-none">{st.medal}</p>
                                        <p className="font-bold text-foreground text-xs truncate mt-1 px-1">
                                            {name}{isMe && <span className="text-primary"> · you</span>}
                                        </p>
                                        <p className="font-display font-extrabold text-sm text-foreground mt-0.5 tabular-nums">{valueLabel(r)}</p>
                                        <div className="flex justify-center mt-1.5">
                                            <AtarBadge value={r.mock_atar} className="text-[10px] py-0.5" />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Rows 4+ ── */}
                    {rest.length > 0 && (
                        <div className="card-soft overflow-hidden divide-y divide-border/50">
                            {rest.map((r, i) => {
                                const rank = i + 4;
                                const isMe = r.user_email === myEmail;
                                const name = displayName(r);
                                const pct = Math.max(2, Math.round((valueOf(r) / topValue) * 100));
                                return (
                                    <motion.div key={r.id || r.user_email}
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                        className={`relative px-4 pt-2.5 pb-3 ${isMe ? "bg-primary/5" : ""}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 text-center font-display font-extrabold text-xs text-muted-foreground/60 flex-shrink-0">{rank}</span>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-extrabold text-[11px] flex-shrink-0 ${toneOf(name)}`}>
                                                {r.is_anonymous ? "?" : initialsOf(name)}
                                            </div>
                                            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                                <p className={`text-sm font-bold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                                                    {name}{isMe && <span className="text-[10px] text-primary/70 ml-1">you</span>}
                                                </p>
                                                {(r.streak_days || 0) >= 3 && (
                                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-streak flex-shrink-0">
                                                        <Flame className="w-3 h-3" fill="currentColor" />{r.streak_days}
                                                    </span>
                                                )}
                                                {(r.level || 1) > 1 && (
                                                    <span className="pill bg-secondary text-muted-foreground text-[10px] py-0 flex-shrink-0 hidden sm:inline-block">
                                                        Lv {r.level}
                                                    </span>
                                                )}
                                            </div>
                                            <AtarBadge value={r.mock_atar} className="text-[10px] py-0.5" />
                                            <span className="font-display font-extrabold text-sm text-foreground flex-shrink-0 tabular-nums">
                                                {valueLabel(r)}
                                            </span>
                                        </div>
                                        {/* Relative progress vs #1 */}
                                        <div className="ml-[68px] mt-1.5 h-1 rounded-full bg-secondary/70 overflow-hidden">
                                            <div className={`h-full rounded-full ${metric === "xp" ? "bg-xp/50" : "bg-chart-3/50"}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <p className="text-[11px] text-muted-foreground/60 text-center">
                Mock ATAR badges are game scores from practice in AcedIt — not real predictions.
            </p>
        </div>
    );
}
