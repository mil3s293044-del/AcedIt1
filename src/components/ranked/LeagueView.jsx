// ════════════════════════════════════════════════════════════════════════════
// LeagueView — Weekly leaderboard (condensed, single-group mode).
//
// At current scale, all users compete in a single weekly leaderboard.
// Resets Monday 00:00 UTC. When the user base grows, we'll re-enable the
// 6-tier promote/demote system from the server-side schema.
//
// Data via POST /local-ai/fn/getLeagueStanding
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Flame, Eye, EyeOff, Trophy, ChevronUp, ChevronDown, Clock,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";

function fmtCountdown(targetIso) {
    if (!targetIso) return "—";
    const ms = new Date(targetIso) - new Date();
    if (ms <= 0) return "now";
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function LeagueView() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [, setTick] = useState(0);

    // Re-render every 30s to update the countdown.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Not signed in");
            const r = await fetch("/local-ai/fn/getLeagueStanding", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({}),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || "Failed to load leaderboard");
            setData(j);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading) {
        return (
            <div className="card-soft p-8 text-center">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
        );
    }
    if (error || !data) {
        return (
            <div className="card-soft p-8 text-center">
                <p className="text-muted-foreground text-sm">{error || "Could not load weekly leaderboard."}</p>
                <button
                    onClick={load}
                    className="mt-3 text-sm font-bold text-primary hover:underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return <LeagueViewRendered data={data} onChange={load} />;
}

// ─── Render ──────────────────────────────────────────────────────────────────
function LeagueViewRendered({ data, onChange }) {
    const myPosition = data.me.position;
    const totalMembers = data.rows.length;

    const catchTarget = useMemo(() => {
        if (myPosition == null || myPosition === 1) return null;
        const above = data.rows[myPosition - 2]; // 0-indexed
        if (!above) return null;
        return { ...above, gap: above.weekly_xp - data.me.weekly_xp };
    }, [data, myPosition]);

    const chaser = useMemo(() => {
        if (myPosition == null || myPosition >= totalMembers) return null;
        const below = data.rows[myPosition];
        if (!below) return null;
        return { ...below, gap: data.me.weekly_xp - below.weekly_xp };
    }, [data, myPosition, totalMembers]);

    const toggleAnon = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;
            await fetch("/local-ai/fn/setLeagueAnonymity", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ is_anonymous: !data.me.is_anonymous }),
            });
            onChange?.();
        } catch {}
    };

    return (
        <div className="space-y-5">
            {/* ─── HEADLINE: position + week XP + reset countdown ─── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-xp/8 via-xp/4 to-surface border border-xp/15 shadow-soft p-6 lg:p-7"
            >
                <Trophy className="absolute -top-4 -right-4 w-32 h-32 text-xp/[0.06] pointer-events-none" />
                <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-surface rounded-xl border border-border/60 shadow-soft p-4 text-center">
                        <p className="stat-label text-muted-foreground">Your position</p>
                        <p className="font-display font-extrabold text-foreground leading-none mt-1.5 tabular-nums" style={{ fontSize: 'clamp(2.5rem, 7vw, 3.5rem)' }}>
                            #{myPosition ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">of {totalMembers} this week</p>
                    </div>
                    <div className="bg-surface rounded-xl border border-border/60 shadow-soft p-4 text-center">
                        <p className="stat-label text-muted-foreground">Week XP</p>
                        <p className="font-display font-extrabold text-foreground leading-none mt-1.5 tabular-nums" style={{ fontSize: 'clamp(2.5rem, 7vw, 3.5rem)' }}>
                            {(data.me.weekly_xp ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">earned since Monday</p>
                    </div>
                    <div className="bg-surface rounded-xl border border-border/60 shadow-soft p-4 text-center">
                        <p className="stat-label text-muted-foreground flex items-center justify-center gap-1.5">
                            <Clock className="w-3 h-3" /> Resets in
                        </p>
                        <p className="font-display font-extrabold text-foreground leading-none mt-1.5" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>
                            {fmtCountdown(data.group.resets_at)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Monday UTC</p>
                    </div>
                </div>

                {/* Anonymity toggle strip */}
                <div className="mt-5 rounded-xl border border-border/60 bg-surface/60 px-4 py-2.5 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                        Showing as <span className="text-foreground font-bold">{data.me.is_anonymous ? "Anonymous" : "Your username"}</span>
                    </p>
                    <button
                        onClick={toggleAnon}
                        className="flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors"
                    >
                        {data.me.is_anonymous ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {data.me.is_anonymous ? "Show name" : "Go anonymous"}
                    </button>
                </div>
            </motion.div>

            {/* ─── CATCH / DEFEND callouts (only when relevant) ──── */}
            {(catchTarget || chaser) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catchTarget && (
                        <div className="card-soft p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                                <ChevronUp className="w-5 h-5 text-primary" strokeWidth={3} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="stat-label text-primary/80 mb-0.5">Catch them</p>
                                <p className="font-display font-extrabold text-foreground text-sm truncate">
                                    {catchTarget.display_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-bold text-foreground">{catchTarget.gap.toLocaleString()} XP</span> ahead · #{catchTarget.position}
                                </p>
                            </div>
                        </div>
                    )}
                    {chaser && (
                        <div className="card-soft p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-streak/10 border border-streak/15 flex items-center justify-center flex-shrink-0">
                                <ChevronDown className="w-5 h-5 text-streak" strokeWidth={3} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="stat-label text-streak/80 mb-0.5">Defend</p>
                                <p className="font-display font-extrabold text-foreground text-sm truncate">
                                    {chaser.display_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-bold text-foreground">{chaser.gap.toLocaleString()} XP</span> behind · #{chaser.position}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── FULL WEEKLY LEADERBOARD ──────────────────────── */}
            <div className="card-soft overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                    <div>
                        <p className="stat-label text-muted-foreground">This week</p>
                        <p className="font-display font-extrabold text-foreground text-base">
                            {totalMembers} {totalMembers === 1 ? "player" : "players"} competing
                        </p>
                    </div>
                </div>
                {totalMembers === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">No one's earned XP yet this week. Be the first.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {data.rows.map((row, i) => {
                            const rowTone = row.is_me
                                ? "bg-primary/5 ring-1 ring-primary/40"
                                : "hover:bg-muted/40";
                            const positionColor = row.is_me ? "text-primary" : row.position <= 3 ? "text-xp" : "text-muted-foreground";
                            return (
                                <div key={i} className={`flex items-center gap-3 px-5 py-3 transition-colors ${rowTone}`}>
                                    <div className={`w-9 text-center font-display font-extrabold text-base tabular-nums ${positionColor}`}>
                                        {row.position}
                                    </div>
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${row.is_me ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                        {(row.display_name || "?").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`font-bold text-sm truncate ${row.is_me ? "text-primary" : "text-foreground"}`}>
                                                {row.is_me ? `${row.display_name} (you)` : row.display_name}
                                            </p>
                                            {row.streak_days > 0 && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-streak flex-shrink-0">
                                                    <Flame className="w-2.5 h-2.5" /> {row.streak_days}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {row.total_xp ? `${row.total_xp.toLocaleString()} lifetime XP` : "—"}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-display font-extrabold text-foreground text-sm tabular-nums">
                                            {(row.weekly_xp ?? 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">XP this week</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
