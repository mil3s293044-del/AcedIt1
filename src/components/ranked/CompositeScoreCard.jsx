import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, Zap, Target, Swords, Flame } from "lucide-react";
import {
    computeCompositeScore, getCompositeTier, getCompositeTierProgress,
    COMPOSITE_TIERS, getCurrentSeason, getDaysRemainingInSeason, getSeasonProgress, getTermFlavour,
} from "@/components/shared/rankingEngine";

const BreakdownBar = ({ label, score, max, pct, icon: Icon, color, delay }) => (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
        <div className="flex items-center gap-3 mb-1">
            <div className={`w-7 h-7 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700">{label}</span>
                    <span className="text-gray-500">{score} / {max} <span className="text-gray-400">({pct}% weight)</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((score / max) * 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: delay + 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500"
                    />
                </div>
            </div>
        </div>
    </motion.div>
);

export default function CompositeScoreCard({ userProfile, completedGoals = [], competitionsWon = 0, competitionsPlayed = 0, betsWon = 0 }) {
    const season = getCurrentSeason();
    const daysLeft = getDaysRemainingInSeason(season);
    const seasonPct = getSeasonProgress(season);
    const termFlavour = getTermFlavour(season);

    const totalXP = userProfile?.total_xp || 0;
    const streakDays = userProfile?.streak_days || 0;
    const seasonXP = userProfile?.season_xp || 0;

    const { composite, breakdown } = computeCompositeScore({
        totalXP,
        streakDays,
        peakStreak: userProfile?.peak_streak || streakDays,
        completedGoals,
        competitionsWon,
        competitionsPlayed,
        seasonXP,
        betsWon,
    });

    const tier = getCompositeTier(composite);
    const tierPct = getCompositeTierProgress(composite);
    const nextTier = COMPOSITE_TIERS.find(t => t.min > composite);

    return (
        <div className="space-y-4">
            {/* Main composite card */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-gradient-to-br ${tier.gradient} rounded-3xl overflow-hidden shadow-2xl`}
            >
                <div className="p-6 pb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Composite Rank</p>
                            <div className="flex items-center gap-3">
                                <span className="text-5xl">{tier.emoji}</span>
                                <div>
                                    <h2 className="text-3xl font-black text-white leading-none">{tier.name}</h2>
                                    <p className="text-white/70 text-sm mt-1">Score: <span className="font-black text-white">{composite}</span> / 1000</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="w-4 h-4 text-white/50 mb-2 ml-auto" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                        <p className="text-xs">Composite score combines Season XP (45%), Consistency (25%), Goal Quality (15%), and Competition/Bets (15%). Resets every school term — everyone starts fresh!</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            {season && (
                                <div className="text-right">
                                    <p className="text-white font-black text-xl">{daysLeft}d</p>
                                    <p className="text-white/70 text-xs">term left</p>
                                    {termFlavour && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${termFlavour.color}`}>{termFlavour.text}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tier progress bar */}
                <div className="bg-black/20 px-6 py-4">
                    {nextTier ? (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-semibold text-white/90">
                                <span>{tier.name}</span>
                                <span>{nextTier.name}</span>
                            </div>
                            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${tierPct}%` }}
                                    transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
                                    className="h-full bg-white/80 rounded-full"
                                />
                            </div>
                            <p className="text-white/60 text-xs text-center">
                                {nextTier.min - composite} pts to {nextTier.name} {nextTier.emoji}
                            </p>
                        </div>
                    ) : (
                        <p className="text-white/90 text-center font-bold text-sm">👑 Maximum rank achieved</p>
                    )}
                </div>
            </motion.div>

            {/* Season banner */}
            {season && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className={`rounded-2xl border-2 p-4 bg-gradient-to-r ${season.theme} text-white`}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-black text-base">{season.emoji} {season.name}</p>
                            <p className="text-white/70 text-xs">Term ends {new Date(season.end).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <div className="text-right">
                            <Badge className="bg-white/20 text-white border-0 font-bold">{daysLeft}d left</Badge>
                            <p className="text-white/70 text-xs mt-1">Season XP: <strong className="text-white">{seasonXP.toLocaleString()}</strong></p>
                        </div>
                    </div>
                    <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${seasonPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                            className="h-full rounded-full bg-white/80"
                        />
                    </div>
                    <p className="text-white/60 text-xs mt-1 text-center">{seasonPct}% through the term — composite resets next term!</p>
                </motion.div>
            )}

            {/* Score breakdown */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-gray-900 text-sm">Score Breakdown</h3>
                </div>
                <div className="space-y-3">
                    <BreakdownBar {...breakdown.xp}          icon={Zap}     color="bg-amber-500"   delay={0.2} />
                    <BreakdownBar {...breakdown.consistency} icon={Flame}   color="bg-orange-500"  delay={0.25} />
                    <BreakdownBar {...breakdown.goalQuality} icon={Target}  color="bg-green-600"   delay={0.3} />
                    <BreakdownBar {...breakdown.competition} icon={Swords}  color="bg-purple-600"  delay={0.35} />
                </div>
            </motion.div>

            {/* Tier ladder */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-1">Term Tier Ladder</h3>
                <p className="text-xs text-gray-400 mb-3">Resets every school term. Chase Term Legend! 👑</p>
                <div className="grid grid-cols-5 gap-2">
                    {COMPOSITE_TIERS.map((t) => {
                        const isCurrentTier = t.min === tier.min;
                        const isUnlocked = composite >= t.min;
                        return (
                            <div
                                key={t.name}
                                className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-all
                                    ${isCurrentTier ? "ring-2 ring-purple-400 bg-purple-50" : isUnlocked ? "bg-gray-50" : "opacity-35"}`}
                            >
                                <span className="text-2xl">{t.emoji}</span>
                                <p className={`text-xs font-semibold leading-tight ${isCurrentTier ? "text-purple-800" : "text-gray-700"}`}>{t.name}</p>
                                <p className="text-xs text-gray-400">{t.min}+</p>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}