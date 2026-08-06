/**
 * BattleRow — one line per competition in the unified list.
 *
 * Duels and group battles used to live in separate tabs with separate card
 * designs. As a student you don't have "duels" and "battles", you have things
 * you're currently racing in, so they're one list now and one row shape: who
 * against who, the score, the odds, what's at stake and how long is left.
 */
import React from "react";
import { motion } from "framer-motion";
import { Swords, Trophy, Coins, Clock, Users, ChevronRight, TrendingUp } from "lucide-react";

function timeLeftLabel(endsAt) {
    if (!endsAt) return null;
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return "Time's up";
    const h = Math.floor(ms / 3600000);
    if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
    if (h < 48) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

export default function BattleRow({ battle, onClick }) {
    const { odds, sides, potXP, endsAt, status, unit, momentum, kind } = battle;
    const settled = status === "settled";
    const ranked = [...sides].sort((a, b) => b.score - a.score);
    const me = battle.me;
    const top = ranked[0];
    const rival = ranked.find((s) => !s.isMe) || null;
    const urgentMs = 12 * 3600 * 1000;
    const urgent = endsAt && !settled && new Date(endsAt).getTime() - Date.now() < urgentMs;

    const oddsTone = odds == null ? "text-muted-foreground"
        : odds >= 60 ? "text-primary" : odds >= 40 ? "text-xp" : "text-streak";
    const oddsBar = odds == null ? "bg-muted-foreground/30"
        : odds >= 60 ? "bg-primary" : odds >= 40 ? "bg-xp" : "bg-streak";

    return (
        <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`group w-full text-left card-soft p-4 lg:p-5 border-2 transition-all hover:shadow-soft ${
                settled ? "border-border bg-secondary/25"
                    : urgent ? "border-streak/40" : "border-border hover:border-chart-3/40"
            }`}
        >
            {/* Line 1 — what kind, and the state */}
            <div className="flex items-center gap-2 mb-2.5">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    kind === "duel" ? "bg-chart-4/15 text-chart-4" : "bg-chart-3/15 text-chart-3"}`}>
                    {kind === "duel" ? <Swords className="w-3.5 h-3.5" /> : <Trophy className="w-3.5 h-3.5" />}
                </span>
                <span className="font-display font-extrabold text-foreground text-sm truncate flex-1 min-w-0">
                    {battle.title}
                </span>
                {!settled && (
                    <span className={`inline-flex items-center gap-1 text-xs font-extrabold flex-shrink-0 ${
                        urgent ? "text-streak" : "text-primary"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-soft-pulse ${urgent ? "bg-streak" : "bg-primary"}`} />
                        Live
                    </span>
                )}
                {settled && <span className="pill bg-chart-4/15 text-chart-4 flex-shrink-0"><Trophy className="w-3 h-3" /> Settled</span>}
            </div>

            {/* Line 2 — the head-to-head. With nobody else in it there is no
                head to head: rendering "VS — 0 pts" against an empty seat made
                a battle look broken rather than unjoined. */}
            {!rival ? (
                <div className="mb-2.5">
                    <p className="font-display font-black text-lg leading-none tabular-nums text-foreground">
                        {(me?.score ?? 0).toLocaleString()}
                        <span className="text-[11px] font-bold text-muted-foreground ml-1">{unit}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {settled ? "Finished unopposed." : "Waiting for someone to join — share the invite code."}
                    </p>
                </div>
            ) : (
            <div className="flex items-center gap-3 mb-2.5">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-muted-foreground truncate">
                        {me ? "You" : (top?.name || "").split(" ")[0]}
                    </p>
                    <p className={`font-display font-black text-lg leading-none tabular-nums ${
                        (me?.score ?? 0) >= (rival?.score ?? 0) ? "text-foreground" : "text-muted-foreground"}`}>
                        {(me?.score ?? top?.score ?? 0).toLocaleString()}
                        <span className="text-[11px] font-bold text-muted-foreground ml-1">{unit}</span>
                    </p>
                </div>
                <span className="text-[11px] font-black text-muted-foreground/50 flex-shrink-0">VS</span>
                <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs font-bold text-muted-foreground truncate">
                        {sides.length > 2 ? `${(rival?.name || "").split(" ")[0]} +${sides.length - 2}` : (rival?.name || "—").split(" ")[0]}
                    </p>
                    <p className={`font-display font-black text-lg leading-none tabular-nums ${
                        (rival?.score ?? 0) > (me?.score ?? 0) ? "text-foreground" : "text-muted-foreground"}`}>
                        {(rival?.score ?? 0).toLocaleString()}
                        <span className="text-[11px] font-bold text-muted-foreground ml-1">{unit}</span>
                    </p>
                </div>
            </div>
            )}

            {/* Line 3 — the market read */}
            {!settled && odds != null && (
                <div className="mb-2.5">
                    <div className="flex items-baseline justify-between mb-1">
                        <span className="stat-label">Your chance</span>
                        <span className={`font-display font-black text-base tabular-nums ${oddsTone}`}>{odds}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${odds}%` }}
                            transition={{ duration: 0.8 }} className={`h-full rounded-full ${oddsBar}`} />
                    </div>
                </div>
            )}

            {/* Line 4 — stakes and clock */}
            <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                {potXP > 0 && (
                    <span className="inline-flex items-center gap-1 text-xp">
                        <Coins className="w-3 h-3" /> {potXP.toLocaleString()} XP
                    </span>
                )}
                {sides.length > 2 && (
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {sides.length}</span>
                )}
                {momentum > 0 && (
                    <span className="inline-flex items-center gap-1 text-primary">
                        <TrendingUp className="w-3 h-3" /> +{momentum} today
                    </span>
                )}
                {endsAt && !settled && (
                    <span className={`inline-flex items-center gap-1 ml-auto ${urgent ? "text-streak" : ""}`}>
                        <Clock className="w-3 h-3" /> {timeLeftLabel(endsAt)} left
                    </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors ml-auto" />
            </div>
        </motion.button>
    );
}
