/**
 * StakesStrip — the always-on stakes bar. Lives in the global layout so your
 * live duels and back-yourself bets follow you onto every screen. Also hosts
 * the lead-change flashes and the "while you were away" report.
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Swords, Target, Crown } from "lucide-react";
import { useStakes } from "./useStakes";
import { METRICS, timeLeft, firstName } from "./arenaMeta";

function DuelChip({ duel, me }) {
    const isChallenger = duel.challenger_email === me;
    const rivalName = isChallenger ? duel.opponent_name : duel.challenger_name;
    const mine = duel.live_scores?.[me] || 0;
    const theirs = duel.live_scores?.[isChallenger ? duel.opponent_email : duel.challenger_email] || 0;
    const leading = mine > theirs;
    const tied = mine === theirs;
    const t = timeLeft(duel.ends_at);
    const metric = METRICS[duel.metric] || METRICS.xp;

    return (
        <Link to="/Competitions"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 flex-shrink-0 transition-all hover:scale-[1.02] ${
                leading ? "bg-primary/10 border-primary/30" : tied ? "bg-secondary border-border" : "bg-streak/10 border-streak/30"
            }`}>
            <Swords className={`w-3.5 h-3.5 flex-shrink-0 ${leading ? "text-primary" : tied ? "text-muted-foreground" : "text-streak"}`} />
            <span className="text-xs font-bold text-foreground whitespace-nowrap">
                vs {firstName(rivalName)}
                <span className={`ml-1.5 tabular-nums ${leading ? "text-primary" : tied ? "text-muted-foreground" : "text-streak"}`}>
                    {mine.toLocaleString()}:{theirs.toLocaleString()}
                </span>
            </span>
            <span className={`text-xs font-semibold whitespace-nowrap ${t.urgent ? "text-streak" : "text-muted-foreground/70"}`}>
                {metric.unit} · {t.label}
            </span>
        </Link>
    );
}

function BetChip({ bet }) {
    const metric = METRICS[bet.metric] || METRICS.xp;
    const progress = bet.progress || 0;
    const pct = Math.min(100, Math.round((progress / bet.target) * 100));
    const t = timeLeft(bet.ends_at);
    return (
        <Link to="/Competitions"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 bg-xp/10 border-xp/25 flex-shrink-0 transition-all hover:scale-[1.02]">
            <Target className="w-3.5 h-3.5 text-xp flex-shrink-0" />
            <span className="text-xs font-bold text-foreground whitespace-nowrap tabular-nums">
                {progress.toLocaleString()}/{bet.target.toLocaleString()} {metric.unit}
            </span>
            <span className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                <span className={`block h-full rounded-full ${pct >= 100 ? "bg-primary" : "bg-xp"}`} style={{ width: `${pct}%` }} />
            </span>
            <span className={`text-xs font-semibold whitespace-nowrap ${t.urgent ? "text-streak" : "text-muted-foreground/70"}`}>{t.label}</span>
        </Link>
    );
}

export default function StakesStrip() {
    const { stakes } = useStakes();
    const [flash, setFlash] = useState(null);
    const [awayReport, setAwayReport] = useState(null);

    // Lead-change flashes + away report arrive as window events from useStakes.
    useEffect(() => {
        const onLead = (e) => {
            setFlash(e.detail);
            setTimeout(() => setFlash(null), 5000);
        };
        const onAway = (e) => {
            setAwayReport(e.detail.items[0]);
            setTimeout(() => setAwayReport(null), 8000);
        };
        window.addEventListener("duel_lead_change", onLead);
        window.addEventListener("arena_away_report", onAway);
        return () => {
            window.removeEventListener("duel_lead_change", onLead);
            window.removeEventListener("arena_away_report", onAway);
        };
    }, []);

    const me = stakes?.me;
    const activeDuels = (stakes?.duels || []).filter(d => d.status === "active");
    const activeBets = stakes?.bets || [];
    if (!me || (activeDuels.length === 0 && activeBets.length === 0 && !flash && !awayReport)) return null;

    return (
        <div className="sticky top-0 z-40">
            {/* Lead change flash */}
            <AnimatePresence>
                {flash && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                        className={`px-4 py-2.5 text-center text-sm font-black text-white ${flash.nowLeading ? "bg-primary" : "bg-streak"}`}>
                        {flash.nowLeading
                            ? <span className="inline-flex items-center gap-1.5"><Crown className="w-4 h-4" /> You've taken the lead vs {firstName(flash.rivalName)}! 🔥</span>
                            : `${firstName(flash.rivalName)} just went in front — down by ${flash.gap}. Your move.`}
                    </motion.div>
                )}
                {!flash && awayReport && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                        className="px-4 py-2.5 text-center text-sm font-bold text-white bg-chart-4">
                        While you were away: {firstName(awayReport.rivalName)} put up +{awayReport.gained} — time to answer back.
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chips */}
            {(activeDuels.length > 0 || activeBets.length > 0) && (
                <div className="bg-surface/95 backdrop-blur border-b border-border shadow-soft">
                    <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto">
                        {activeDuels.map(d => <DuelChip key={d.id} duel={d} me={me} />)}
                        {activeBets.map(b => <BetChip key={b.id} bet={b} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
