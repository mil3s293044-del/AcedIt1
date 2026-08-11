import React from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Zap, TrendingUp, Trophy, Lock, Crown, Flame, Check } from "lucide-react";
import {
    XP_RANKS, getRankFromXP, getRankProgress, xpToNextRank,
    levelFromXP, levelProgress, xpToNextLevel, xpForLevel,
} from "@/components/shared/xpSystem";
import AceTip from "@/components/ace/AceTip";

export default function XPLevelCard({ totalXP = 0, streakDays = 0, compact = false }) {
    const rank = getRankFromXP(totalXP);
    const nextRank = XP_RANKS[rank.tier] || null;
    const rankPct = getRankProgress(totalXP);
    const level = levelFromXP(totalXP);
    const lvlPct = levelProgress(totalXP);
    const xpNeeded = xpToNextLevel(level) - (totalXP - xpForLevel(level));

    if (compact) {
        return (
            <div className="card-soft p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-6 h-6 text-xp" />
                        </div>
                        <div>
                            <p className="font-display font-extrabold text-foreground text-sm">{rank.name}</p>
                            <p className="text-muted-foreground text-xs">Level {level}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-display font-extrabold text-foreground">{totalXP.toLocaleString()}</p>
                        <p className="stat-label inline-flex items-center gap-1">Total XP <AceTip term="xp" /></p>
                    </div>
                </div>
                <div className="mt-3">
                    <Progress value={lvlPct} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">{xpNeeded} XP to Level {level + 1}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Main rank card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="card-soft p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-8 h-8 text-xp" />
                        </div>
                        <div>
                            <p className="stat-label mb-1">Rank</p>
                            <h2 className="font-display text-2xl font-extrabold text-foreground leading-tight">{rank.name}</h2>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="pill bg-xp/15 text-xp">
                                    Level {level}
                                </span>
                                {streakDays >= 7 && (
                                    <span className="pill bg-streak/15 text-streak gap-1.5">
                                        <Flame className="w-3 h-3" />
                                        {streakDays}d streak
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="stat-num text-foreground">{totalXP.toLocaleString()}</p>
                        <p className="stat-label">Total XP</p>
                    </div>
                </div>

                {/* Rank progress */}
                <div className="mt-5 pt-5 border-t border-border">
                    {nextRank ? (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-bold text-foreground">
                                <span>{rank.name}</span>
                                <span className="text-muted-foreground">{nextRank.name}</span>
                            </div>
                            <div className="h-3 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${rankPct}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-xp rounded-full"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                {xpToNextRank(totalXP).toLocaleString()} XP to next rank
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <Crown className="w-4 h-4 text-chart-4" />
                            <p className="text-foreground font-bold text-sm">Max rank achieved</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Level card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="card-soft p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-5 h-5 text-xp" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display font-extrabold text-foreground text-base">Level Progress</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Climb levels by earning XP from any source.</p>
                    </div>
                    <span className="pill bg-xp/15 text-xp">Level {level}</span>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Level {level}</span>
                        <span className="font-bold text-foreground">{lvlPct}%</span>
                        <span>Level {level + 1}</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${lvlPct}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                            className="h-full bg-xp rounded-full"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">{xpNeeded.toLocaleString()} XP to Level {level + 1}</p>
                </div>
            </motion.div>

            {/* Rank ladder */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="card-soft p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-chart-4" />
                    </div>
                    <div>
                        <h3 className="font-display font-extrabold text-foreground text-base">Rank Ladder</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Long-term prestige tiers — never reset.</p>
                    </div>
                </div>
                <div className="space-y-2">
                    {XP_RANKS.map((r) => {
                        const isUnlocked = totalXP >= r.minXP;
                        const isCurrent = r.tier === rank.tier;
                        return (
                            <div
                                key={r.name}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                                    isCurrent
                                        ? 'bg-chart-4/10 border-2 border-chart-4/30'
                                        : isUnlocked
                                            ? 'bg-secondary/50 border-2 border-transparent'
                                            : 'bg-secondary/30 border-2 border-transparent opacity-50'
                                }`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    isCurrent ? 'bg-chart-4/15' : isUnlocked ? 'bg-surface' : 'bg-secondary'
                                }`}>
                                    <Trophy className={`w-4 h-4 ${
                                        isCurrent ? 'text-chart-4' : isUnlocked ? 'text-foreground' : 'text-muted-foreground/60'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold ${
                                        isCurrent ? 'text-chart-4' : isUnlocked ? 'text-foreground' : 'text-muted-foreground/60'
                                    }`}>{r.name}</p>
                                    <p className="text-xs text-muted-foreground/60">{r.minXP.toLocaleString()} XP{r.maxXP !== Infinity ? ` – ${r.maxXP.toLocaleString()}` : '+'}</p>
                                </div>
                                {isCurrent ? (
                                    <span className="pill bg-chart-4 text-white">Current</span>
                                ) : !isUnlocked ? (
                                    <Lock className="w-4 h-4 text-muted-foreground/60" />
                                ) : (
                                    <span className="pill bg-primary/15 text-primary">
                                        <Check className="w-3 h-3" />
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </motion.div>

            {/* XP Sources Guide */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="card-soft p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-chart-3" />
                    </div>
                    <div>
                        <h3 className="font-display font-extrabold text-foreground text-base">Earn XP From</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Daily caps prevent grinding — real effort wins.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                        ["AI Challenges", "28–104 XP"],
                        ["Sub-goals", "40–195 XP"],
                        ["Full Goals", "240–540 XP"],
                        ["Quizzes", "8–50 XP"],
                        ["Focus sessions", "1.6–96 XP/hr"],
                        ["Daily streak", "15–100 XP"],
                        ["Flashcards", "0.6–1.5 XP/card"],
                        ["Score wagers", "up to 3.5× bet"],
                    ].map(([label, xp]) => (
                        <div key={label} className="flex justify-between items-center bg-secondary/50 rounded-lg px-2.5 py-1.5">
                            <span className="text-foreground text-xs">{label}</span>
                            <span className="font-bold text-chart-3 text-xs">{xp}</span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">Difficulty &amp; accuracy multipliers reward real effort.</p>
            </motion.div>
        </div>
    );
}
