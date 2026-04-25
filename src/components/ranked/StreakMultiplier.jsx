import React from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Zap, TrendingUp, Lock } from "lucide-react";

const STREAK_TIERS = [
    { days: 0,  multiplier: 1.0,  label: "No Streak",    color: "text-gray-400",   bg: "bg-gray-100",  emoji: "💤" },
    { days: 3,  multiplier: 1.2,  label: "Warming Up",   color: "text-orange-400", bg: "bg-orange-50", emoji: "🌱" },
    { days: 7,  multiplier: 1.5,  label: "On Fire",      color: "text-orange-500", bg: "bg-orange-100", emoji: "🔥" },
    { days: 14, multiplier: 1.75, label: "Blazing",      color: "text-red-500",    bg: "bg-red-100",   emoji: "💥" },
    { days: 21, multiplier: 2.0,  label: "Unstoppable",  color: "text-rose-600",   bg: "bg-rose-100",  emoji: "⚡" },
    { days: 30, multiplier: 2.5,  label: "Legendary",    color: "text-purple-600", bg: "bg-purple-100", emoji: "👑" },
    { days: 60, multiplier: 3.0,  label: "God Mode",     color: "text-amber-500",  bg: "bg-amber-50",  emoji: "🌟" },
];

function getCurrentTier(days) {
    let tier = STREAK_TIERS[0];
    for (const t of STREAK_TIERS) {
        if (days >= t.days) tier = t;
    }
    return tier;
}

function getNextTier(days) {
    return STREAK_TIERS.find(t => t.days > days) || null;
}

export default function StreakMultiplier({ streakDays = 0, compact = false }) {
    const current = getCurrentTier(streakDays);
    const next = getNextTier(streakDays);
    const daysToNext = next ? next.days - streakDays : 0;
    const progressToNext = next ? ((streakDays - current.days) / (next.days - current.days)) * 100 : 100;

    if (compact) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${current.bg} border border-current/20`}>
                <Flame className="w-4 h-4 text-orange-500" />
                <span className={`text-sm font-black ${current.color}`}>{streakDays}d</span>
                <span className="text-xs text-gray-500">{current.multiplier}× XP</span>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Main multiplier display */}
            <div className={`relative overflow-hidden rounded-2xl p-5 ${
                streakDays >= 30 ? 'bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600' :
                streakDays >= 14 ? 'bg-gradient-to-br from-red-500 via-rose-500 to-pink-600' :
                streakDays >= 7 ? 'bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500' :
                streakDays >= 3 ? 'bg-gradient-to-br from-orange-400 to-amber-500' :
                'bg-gradient-to-br from-gray-400 to-slate-500'
            } text-white shadow-xl`}>
                {/* Animated flame effect for high streaks */}
                {streakDays >= 7 && (
                    <div className="absolute top-0 right-0 text-6xl opacity-20 -mr-2 -mt-2 animate-bounce">🔥</div>
                )}
                <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <Flame className="w-5 h-5" />
                                <p className="font-black text-sm uppercase tracking-wider">Streak Multiplier</p>
                            </div>
                            <p className="text-white/70 text-xs mt-0.5">{current.label}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-5xl font-black leading-none">{current.multiplier}<span className="text-2xl">×</span></p>
                            <p className="text-white/70 text-xs">XP Multiplier</p>
                        </div>
                    </div>

                    <div className="bg-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Flame className="w-5 h-5 text-amber-300" />
                            <span className="text-2xl font-black">{streakDays}</span>
                            <span className="text-white/70 text-sm">day streak</span>
                        </div>
                        {current.multiplier > 1 && (
                            <Badge className="bg-white/20 text-white border-0 font-bold">
                                +{Math.round((current.multiplier - 1) * 100)}% XP bonus
                            </Badge>
                        )}
                    </div>

                    {next && (
                        <div className="mt-3 space-y-1.5">
                            <div className="flex justify-between text-xs text-white/80">
                                <span>{current.emoji} {current.multiplier}×</span>
                                <span className="font-bold">{daysToNext} days to {next.emoji} {next.multiplier}×</span>
                            </div>
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressToNext}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-white/70 rounded-full"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tier ladder */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    <h4 className="font-bold text-gray-900 text-sm">Multiplier Tiers</h4>
                    <p className="text-xs text-gray-400 ml-auto">Higher streak = more XP per action</p>
                </div>
                <div className="space-y-2">
                    {STREAK_TIERS.map((tier, i) => {
                        const isActive = current.days === tier.days;
                        const isPassed = streakDays >= tier.days && current.days !== tier.days;
                        const isLocked = streakDays < tier.days;
                        return (
                            <div key={tier.days} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                                isActive ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300' :
                                isPassed ? 'bg-gray-50' : 'opacity-50'
                            }`}>
                                <span className="text-lg w-8 text-center">{tier.emoji}</span>
                                <div className="flex-1">
                                    <p className={`text-sm font-bold ${isActive ? 'text-orange-700' : isPassed ? 'text-gray-700' : 'text-gray-400'}`}>{tier.label}</p>
                                    <p className="text-xs text-gray-400">{tier.days === 0 ? 'Start today' : `${tier.days}+ day streak`}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className={`font-black text-xs border-0 ${
                                        isActive ? 'bg-orange-500 text-white' :
                                        isPassed ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>
                                        {tier.multiplier}× XP
                                    </Badge>
                                    {isLocked && <Lock className="w-3.5 h-3.5 text-gray-300" />}
                                    {isPassed && <span className="text-green-500 text-xs font-bold">✓</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tip box */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 flex items-start gap-2">
                <Zap className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-800">
                    <strong>Pro tip:</strong> A 30-day streak gives you 2.5× XP on everything — that's 150% more XP from quizzes, flashcards, focus sessions, and goals!
                </p>
            </div>
        </motion.div>
    );
}