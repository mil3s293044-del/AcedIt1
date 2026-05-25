// ════════════════════════════════════════════════════════════════════════════
// LeagueView — Duolingo-style weekly leagues, head-on view.
//
// 6 tiers: Bronze → Silver → Gold → Platinum → Diamond → Master
// Groups of 30 · Top 5 promote · Middle 20 stay · Bottom 5 demote
// Resets Monday 00:00 UTC
//
// Data via POST /local-ai/fn/getLeagueStanding
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Shield, Award, Crown, Gem, Star, Flame, TrendingUp, TrendingDown, Eye, EyeOff, Trophy, ChevronUp, ChevronDown,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";

// ─── Tier visual config ─────────────────────────────────────────────────────
// Each tier has a distinct crest (Lucide icon) + an accent token. Tokens
// are static Tailwind strings (JIT can see them — no template strings).
const TIER_CONFIG = {
    bronze: {
        label:       "Bronze",
        order:       1,
        Icon:        Shield,
        crestBg:     "bg-gradient-to-br from-amber-700/20 to-amber-900/10",
        crestBorder: "border-amber-700/30",
        crestIcon:   "text-amber-700",
        eyebrow:     "text-amber-700/80",
        chip:        "bg-amber-700/10 text-amber-700",
    },
    silver: {
        label:       "Silver",
        order:       2,
        Icon:        Award,
        crestBg:     "bg-gradient-to-br from-slate-400/25 to-slate-600/10",
        crestBorder: "border-slate-400/40",
        crestIcon:   "text-slate-500",
        eyebrow:     "text-slate-500",
        chip:        "bg-slate-200 text-slate-700",
    },
    gold: {
        label:       "Gold",
        order:       3,
        Icon:        Trophy,
        crestBg:     "bg-gradient-to-br from-xp/25 to-xp/5",
        crestBorder: "border-xp/35",
        crestIcon:   "text-xp",
        eyebrow:     "text-xp/80",
        chip:        "bg-xp/15 text-xp",
    },
    platinum: {
        label:       "Platinum",
        order:       4,
        Icon:        Star,
        crestBg:     "bg-gradient-to-br from-chart-3/20 to-chart-3/5",
        crestBorder: "border-chart-3/30",
        crestIcon:   "text-chart-3",
        eyebrow:     "text-chart-3/80",
        chip:        "bg-chart-3/15 text-chart-3",
    },
    diamond: {
        label:       "Diamond",
        order:       5,
        Icon:        Gem,
        crestBg:     "bg-gradient-to-br from-cyan-500/25 to-cyan-700/5",
        crestBorder: "border-cyan-400/40",
        crestIcon:   "text-cyan-600",
        eyebrow:     "text-cyan-600",
        chip:        "bg-cyan-100 text-cyan-700",
    },
    master: {
        label:       "Master",
        order:       6,
        Icon:        Crown,
        crestBg:     "bg-gradient-to-br from-chart-4/30 to-chart-4/10",
        crestBorder: "border-chart-4/40",
        crestIcon:   "text-chart-4",
        eyebrow:     "text-chart-4/80",
        chip:        "bg-chart-4/15 text-chart-4",
    },
};

function getTier(name) { return TIER_CONFIG[name] || TIER_CONFIG.bronze; }

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
    const [tick, setTick] = useState(0);

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
            if (!r.ok) throw new Error(j.error || "Failed to load league");
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
                <p className="text-muted-foreground text-sm">{error || "Could not load league standing."}</p>
                <button
                    onClick={load}
                    className="mt-3 text-sm font-bold text-primary hover:underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return <LeagueViewRendered data={data} onAnonymityChange={load} tick={tick} />;
}

// ─── Render ──────────────────────────────────────────────────────────────────
function LeagueViewRendered({ data, onAnonymityChange, tick }) {
    const tier = getTier(data.group.tier);
    const TierIcon = tier.Icon;
    const myPosition = data.me.position;
    const totalMembers = data.rows.length;
    const promoteAt = data.group.promote_count;
    const demoteAt = totalMembers - data.group.demote_count;

    const catchTarget = useMemo(() => {
        if (myPosition == null || myPosition === 1) return null;
        const above = data.rows[myPosition - 2]; // 0-indexed
        if (!above) return null;
        return { ...above, gap: above.weekly_xp - data.me.weekly_xp };
    }, [data, myPosition]);

    const chaser = useMemo(() => {
        if (myPosition == null || myPosition >= totalMembers) return null;
        const below = data.rows[myPosition]; // 0-indexed (1-indexed myPosition → index myPosition)
        if (!below) return null;
        return { ...below, gap: data.me.weekly_xp - below.weekly_xp };
    }, [data, myPosition, totalMembers]);

    const inPromoteZone = myPosition != null && myPosition <= promoteAt;
    const inDemoteZone  = myPosition != null && myPosition > demoteAt;

    const myZoneLabel = inPromoteZone
        ? "Promotion zone — finish here to advance"
        : inDemoteZone
            ? "Demotion zone — climb to stay"
            : "Hold position to stay in this tier";

    const myZoneTone = inPromoteZone ? "bg-primary/5 border-primary/15 text-primary"
                     : inDemoteZone  ? "bg-streak/5 border-streak/15 text-streak"
                     :                 "bg-muted/40 border-border/60 text-muted-foreground";

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
            onAnonymityChange?.();
        } catch {}
    };

    return (
        <div className="space-y-5">
            {/* ─── HEADLINE: crest + standing ─────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-2xl border ${tier.crestBorder} ${tier.crestBg} shadow-soft p-6 lg:p-7`}
            >
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 items-center">
                    {/* Crest */}
                    <div className="sm:col-span-2 flex sm:flex-col items-center sm:items-start gap-4">
                        <div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl ${tier.crestBg} border-2 ${tier.crestBorder} flex items-center justify-center flex-shrink-0`}>
                            <TierIcon className={`w-10 h-10 lg:w-12 lg:h-12 ${tier.crestIcon}`} strokeWidth={2} />
                        </div>
                        <div>
                            <p className={`stat-label ${tier.eyebrow} mb-1`}>Your league</p>
                            <h2 className="font-display font-extrabold text-foreground text-3xl lg:text-4xl tracking-tight leading-none">
                                {tier.label}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1.5 font-semibold">
                                Resets in <span className="text-foreground">{fmtCountdown(data.group.resets_at)}</span>
                            </p>
                        </div>
                    </div>

                    {/* Stats trio */}
                    <div className="sm:col-span-3 grid grid-cols-3 gap-2 lg:gap-3">
                        <div className="bg-surface rounded-xl border border-border/60 shadow-soft p-3 text-center">
                            <p className="stat-label text-muted-foreground">Position</p>
                            <p className="font-display font-extrabold text-foreground text-2xl lg:text-3xl leading-none mt-1 tabular-nums">
                                #{myPosition ?? "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">of {totalMembers}</p>
                        </div>
                        <div className="bg-surface rounded-xl border border-border/60 shadow-soft p-3 text-center">
                            <p className="stat-label text-muted-foreground">Week XP</p>
                            <p className="font-display font-extrabold text-foreground text-2xl lg:text-3xl leading-none mt-1 tabular-nums">
                                {(data.me.weekly_xp ?? 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">earned this week</p>
                        </div>
                        <div className="bg-surface rounded-xl border border-border/60 shadow-soft p-3 text-center">
                            <p className="stat-label text-muted-foreground">Lifetime</p>
                            <p className="font-display font-extrabold text-foreground text-2xl lg:text-3xl leading-none mt-1 tabular-nums">
                                {data.me.lifetime_promotes ?? 0}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">promotes</p>
                        </div>
                    </div>
                </div>

                {/* Zone status strip */}
                <div className={`mt-5 rounded-xl border ${myZoneTone} px-4 py-2.5 flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-2 text-xs font-bold">
                        {inPromoteZone ? <TrendingUp className="w-4 h-4" /> : inDemoteZone ? <TrendingDown className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        {myZoneLabel}
                    </div>
                    <button
                        onClick={toggleAnon}
                        title={data.me.is_anonymous ? "Show your name" : "Go anonymous"}
                        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {data.me.is_anonymous ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {data.me.is_anonymous ? "Anonymous" : "Visible"}
                    </button>
                </div>
            </motion.div>

            {/* ─── CATCH / DEFEND callouts ─────────────────────────── */}
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

            {/* ─── FULL LEAGUE LEADERBOARD ──────────────────────────── */}
            <div className="card-soft overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                    <div>
                        <p className="stat-label text-muted-foreground">Full league</p>
                        <p className="font-display font-extrabold text-foreground text-base">
                            {totalMembers} players · top {promoteAt} promote · bottom {data.group.demote_count} demote
                        </p>
                    </div>
                </div>
                <div className="divide-y divide-border/40">
                    {data.rows.map((row, i) => {
                        const isPromote = row.position <= promoteAt;
                        const isDemote  = row.position > demoteAt;
                        const rowTone = row.is_me
                            ? "bg-primary/5 ring-1 ring-primary/40"
                            : isPromote ? "bg-primary/[0.02] hover:bg-primary/5"
                            : isDemote  ? "bg-streak/[0.02] hover:bg-streak/5"
                            : "hover:bg-muted/40";
                        const positionColor = row.is_me ? "text-primary"
                            : isPromote ? "text-primary"
                            : isDemote  ? "text-streak"
                            :              "text-muted-foreground";
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
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="text-right">
                                        <p className="font-display font-extrabold text-foreground text-sm tabular-nums">
                                            {(row.weekly_xp ?? 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">XP/wk</p>
                                    </div>
                                    {isPromote && <span className="pill bg-primary/10 text-primary text-[9px] px-2 py-0.5">PROMOTE</span>}
                                    {isDemote  && <span className="pill bg-streak/10 text-streak text-[9px] px-2 py-0.5">DEMOTE</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── ALL TIERS LADDER ─────────────────────────────────── */}
            <div className="card-soft p-5">
                <p className="stat-label text-muted-foreground mb-3">League ladder</p>
                <div className="grid grid-cols-6 gap-2">
                    {Object.entries(TIER_CONFIG).sort((a, b) => a[1].order - b[1].order).map(([key, t]) => {
                        const TIcon = t.Icon;
                        const isMe = key === data.group.tier;
                        return (
                            <div
                                key={key}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                                    isMe ? `${t.crestBg} ${t.crestBorder} ring-2 ring-current ${t.crestIcon}` : "bg-surface border-border/40 opacity-60"
                                }`}
                            >
                                <TIcon className={`w-5 h-5 ${t.crestIcon}`} strokeWidth={2} />
                                <p className={`text-[10px] font-bold ${isMe ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
