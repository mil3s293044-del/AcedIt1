import React from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Trophy, Lock } from "lucide-react";
import {
    XP_RANKS, getRankFromXP, getRankProgress, xpToNextRank,
    levelFromXP, levelProgress, xpToNextLevel, xpForLevel,
} from "@/components/shared/xpSystem";

export default function XPLevelCard({ totalXP = 0, seasonXP = 0, streakDays = 0, compact = false }) {
    const rank = getRankFromXP(totalXP);
    const nextRank = XP_RANKS[rank.tier] || null;
    const rankPct = getRankProgress(totalXP);
    const level = levelFromXP(totalXP);
    const lvlPct = levelProgress(totalXP);
    const xpNeeded = xpToNextLevel(level) - (totalXP - xpForLevel(level));

    if (compact) {
        return (
            <div className={`bg-gradient-to-r ${rank.gradient} rounded-2xl p-4 text-white`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{rank.emoji}</span>
                        <div>
                            <p className="font-black text-sm">{rank.name}</p>
                            <p className="text-white/80 text-xs">Level {level}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black">{totalXP.toLocaleString()}</p>
                        <p className="text-white/80 text-xs">Total XP</p>
                    </div>
                </div>
                <div className="mt-3">
                    <Progress value={lvlPct} className="h-1.5 bg-white/30" />
                    <p className="text-xs text-white/70 mt-1">{xpNeeded} XP to Level {level + 1}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Main rank card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-gradient-to-br ${rank.gradient} rounded-2xl overflow-hidden shadow-xl`}>
                <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-5xl shadow-inner">
                                {rank.emoji}
                            </div>
                            <div>
                                <p className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-1">Rank</p>
                                <h2 className="text-2xl font-black text-white leading-tight">{rank.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-white/20 text-white border-0 text-xs font-bold">
                                        Level {level}
                                    </Badge>
                                    {streakDays >= 7 && (
                                        <Badge className="bg-white/20 text-white border-0 text-xs font-bold">
                                            🔥 {streakDays}d streak
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-4xl font-black text-white">{totalXP.toLocaleString()}</p>
                            <p className="text-white/80 text-sm font-medium">Total XP</p>
                        </div>
                    </div>
                </div>

                {/* Rank progress */}
                <div className="bg-black/20 px-6 py-4">
                    {nextRank ? (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-white/90 font-medium">
                                <span>{rank.name}</span>
                                <span>{nextRank.name}</span>
                            </div>
                            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${rankPct}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-white/80 rounded-full"
                                />
                            </div>
                            <p className="text-white/70 text-xs text-center">
                                {xpToNextRank(totalXP).toLocaleString()} XP to next rank
                            </p>
                        </div>
                    ) : (
                        <p className="text-white/90 text-center font-bold text-sm">👑 Max rank achieved</p>
                    )}
                </div>
            </motion.div>

            {/* Level card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        <h3 className="font-bold text-gray-900">Level Progress</h3>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 font-bold">Level {level}</Badge>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Level {level}</span>
                        <span className="font-semibold text-gray-900">{lvlPct}%</span>
                        <span>Level {level + 1}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${lvlPct}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                        />
                    </div>
                    <p className="text-xs text-gray-500 text-center">{xpNeeded.toLocaleString()} XP to Level {level + 1}</p>
                </div>
            </motion.div>

            {/* Rank ladder */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-purple-500" />
                    <h3 className="font-bold text-gray-900">Rank Ladder</h3>
                </div>
                <div className="space-y-2">
                    {XP_RANKS.map((r, idx) => {
                        const isUnlocked = totalXP >= r.minXP;
                        const isCurrent = r.tier === rank.tier;
                        return (
                            <div key={r.name} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${isCurrent ? "bg-purple-50 border-2 border-purple-300" : isUnlocked ? "bg-gray-50" : "opacity-40"}`}>
                                <span className="text-xl w-8 text-center">{r.emoji}</span>
                                <div className="flex-1">
                                    <p className={`text-sm font-semibold ${isCurrent ? "text-purple-800" : isUnlocked ? "text-gray-800" : "text-gray-400"}`}>{r.name}</p>
                                    <p className="text-xs text-gray-400">{r.minXP.toLocaleString()} XP{r.maxXP !== Infinity ? ` – ${r.maxXP.toLocaleString()}` : '+'}</p>
                                </div>
                                {isCurrent ? (
                                    <Badge className="bg-purple-500 text-white text-xs">Current</Badge>
                                ) : !isUnlocked ? (
                                    <Lock className="w-4 h-4 text-gray-300" />
                                ) : (
                                    <Badge className="bg-green-100 text-green-700 text-xs">✓</Badge>
                                )}
                            </div>
                        );
                    })}
                </div>
            </motion.div>

            {/* XP Sources Guide */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-gray-900">Earn XP From</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                        ["⚡ AI Challenges", "28–104 XP"],
                        ["🎯 Sub-goals", "40–195 XP"],
                        ["🏆 Full Goals", "240–540 XP"],
                        ["📝 Quizzes", "8–50 XP"],
                        ["⏱️ Focus sessions", "1.6–96 XP/hr"],
                        ["🔥 Daily streak", "15–100 XP"],
                        ["🃏 Flashcards", "0.6–1.5 XP/card"],
                        ["💰 Score wagers", "up to 3.5× bet"],
                    ].map(([label, xp]) => (
                        <div key={label} className="flex justify-between items-center bg-white/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-700 text-xs">{label}</span>
                            <span className="font-bold text-indigo-700 text-xs">{xp}</span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">Daily caps prevent grinding. Difficulty & accuracy multipliers reward real effort.</p>
            </motion.div>
        </div>
    );
}