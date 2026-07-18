/**
 * FriendsLeaderboard — season-XP ladder of you + your accepted friends.
 * Fresh build on the current design system (the pre-uplift friends/Leaderboard
 * was deleted). Reads the mirrored leaderboards rows per friend, so no
 * full-table fetches.
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Zap, Swords } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

// Static rank styles — Tailwind JIT can't see interpolated tokens.
const RANK_STYLES = [
    { badge: "bg-xp text-white",              row: "border-xp/40 bg-xp/[0.06]" },
    { badge: "bg-secondary text-foreground",  row: "border-border" },
    { badge: "bg-streak/15 text-streak",      row: "border-border" },
];
const rankStyle = (i) => RANK_STYLES[Math.min(i, RANK_STYLES.length - 1)];

function LadderSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="card-soft h-16 animate-pulse bg-secondary/50" />
            ))}
        </div>
    );
}

export default function FriendsLeaderboard({ friends, currentUserEmail, currentUserName }) {
    const [rows, setRows] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const members = [
                { email: currentUserEmail, name: currentUserName || "You", isMe: true },
                ...friends.map(f => ({ email: f.email, name: f.full_name, isMe: false })),
            ];
            const withStats = await Promise.all(members.map(async (m) => {
                try {
                    const entries = await base44.entities.Leaderboard.filter({ user_email: m.email });
                    const e = entries?.[0] || {};
                    return { ...m, season_xp: e.season_xp || 0, total_xp: e.total_xp || 0, streak_days: e.streak_days || 0 };
                } catch {
                    return { ...m, season_xp: 0, total_xp: 0, streak_days: 0 };
                }
            }));
            withStats.sort((a, b) => (b.season_xp - a.season_xp) || (b.total_xp - a.total_xp));
            if (!cancelled) setRows(withStats);
        };
        load();
        return () => { cancelled = true; };
    }, [friends, currentUserEmail, currentUserName]);

    if (rows === null) return <LadderSkeleton />;

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                {rows.map((row, i) => {
                    const style = rankStyle(i);
                    return (
                        <motion.div
                            key={row.email}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`card-soft flex items-center gap-4 p-4 border-2 ${style.row} ${row.isMe ? "ring-2 ring-chart-3/30" : ""}`}
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm flex-shrink-0 ${style.badge}`}>
                                {i === 0 ? <Trophy className="w-5 h-5" /> : i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground truncate">
                                    {row.name}{row.isMe ? <span className="text-muted-foreground font-semibold"> (you)</span> : ""}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                    {row.streak_days > 0 && (
                                        <span className="inline-flex items-center gap-1 text-streak font-semibold">
                                            <Flame className="w-3.5 h-3.5" /> {row.streak_days}d
                                        </span>
                                    )}
                                    <span>{row.total_xp.toLocaleString()} XP all-time</span>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="font-display font-extrabold text-foreground text-lg tabular-nums inline-flex items-center gap-1">
                                    <Zap className="w-4 h-4 text-xp" />
                                    {row.season_xp.toLocaleString()}
                                </p>
                                <p className="stat-label text-muted-foreground/60">season XP</p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Bridge into the Compete loop — beating friends pays real XP */}
            <Link to="/Competitions"
                className="card-soft flex items-center gap-3 p-4 border-2 border-chart-4/20 hover:border-chart-4/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                    <Swords className="w-5 h-5 text-chart-4" />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-foreground text-sm">Settle it in the arena</p>
                    <p className="text-xs text-muted-foreground">Win a study battle against friends for a +100 XP victory bonus.</p>
                </div>
                <span className="text-chart-4 font-bold text-sm group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
        </div>
    );
}
