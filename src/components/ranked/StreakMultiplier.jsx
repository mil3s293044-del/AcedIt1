import React from "react";
import { motion } from "framer-motion";
import { Flame, Zap, TrendingUp, Lock, Check, Crown, Shield } from "lucide-react";

// Pre-resolved Tailwind class strings — required so the JIT can detect them at build time.
const ACCENT_CLASSES = {
    "muted-foreground": {
        bg10:  "bg-secondary",
        bg15:  "bg-secondary",
        text:  "text-muted-foreground",
        border:"border-border",
        pillSolid: "bg-secondary text-muted-foreground",
    },
    xp: {
        bg10:  "bg-xp/10",
        bg15:  "bg-xp/15",
        text:  "text-xp",
        border:"border-xp/30",
        pillSolid: "bg-xp text-white",
    },
    streak: {
        bg10:  "bg-streak/10",
        bg15:  "bg-streak/15",
        text:  "text-streak",
        border:"border-streak/30",
        pillSolid: "bg-streak text-white",
    },
    "chart-4": {
        bg10:  "bg-chart-4/10",
        bg15:  "bg-chart-4/15",
        text:  "text-chart-4",
        border:"border-chart-4/30",
        pillSolid: "bg-chart-4 text-white",
    },
};

const STREAK_TIERS = [
    // Tiers mirror the real ladder in streakHelpers/server updateStreak —
    // what's shown here is exactly what awardXP applies (capped at 2.0×).
    { days: 0,  multiplier: 1.0,  label: "No Streak",    icon: Flame,  accent: "muted-foreground" },
    { days: 3,  multiplier: 1.1,  label: "Warming Up",   icon: Flame,  accent: "xp" },
    { days: 7,  multiplier: 1.25, label: "On Fire",      icon: Flame,  accent: "xp" },
    { days: 14, multiplier: 1.5,  label: "Blazing",      icon: Zap,    accent: "streak" },
    { days: 30, multiplier: 2.0,  label: "Legendary",    icon: Crown,  accent: "chart-4" },
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

export default function StreakMultiplier({ streakDays = 0, shields = 0, compact = false }) {
    const current = getCurrentTier(streakDays);
    const next = getNextTier(streakDays);
    const daysToNext = next ? next.days - streakDays : 0;
    const progressToNext = next ? ((streakDays - current.days) / (next.days - current.days)) * 100 : 100;

    if (compact) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-streak/10 border-2 border-streak/20">
                <Flame className="w-4 h-4 text-streak" />
                <span className="text-sm font-display font-extrabold text-foreground">{streakDays}d</span>
                <span className="text-xs text-muted-foreground">{current.multiplier}× XP</span>
            </div>
        );
    }

    const CurrentIcon = current.icon;
    const currentCls = ACCENT_CLASSES[current.accent];

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Main multiplier display */}
            <div className="card-soft p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${currentCls.bg10} flex items-center justify-center flex-shrink-0`}>
                            <CurrentIcon className={`w-6 h-6 ${currentCls.text}`} />
                        </div>
                        <div>
                            <p className="stat-label">Streak Multiplier</p>
                            <p className="font-display font-extrabold text-foreground text-base mt-0.5">{current.label}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="stat-num text-foreground">
                            {current.multiplier}<span className="text-2xl">×</span>
                        </p>
                        <p className="stat-label">XP Multiplier</p>
                    </div>
                </div>

                <div className="bg-secondary/50 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-streak" />
                        <span className="text-2xl font-display font-extrabold text-foreground">{streakDays}</span>
                        <span className="text-muted-foreground text-sm">day streak</span>
                    </div>
                    {current.multiplier > 1 && (
                        <span className="pill bg-streak/15 text-streak">
                            +{Math.round((current.multiplier - 1) * 100)}% XP bonus
                        </span>
                    )}
                </div>

                {/* Streak shields — insurance against one missed day */}
                <div className="mt-3 bg-chart-3/[0.07] border border-chart-3/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${shields > 0 ? 'text-chart-3' : 'text-muted-foreground/50'}`} />
                        <span className="text-sm font-bold text-foreground">
                            {shields} shield{shields === 1 ? '' : 's'}
                        </span>
                        <span className="flex items-center gap-1">
                            {[0, 1].map(i => (
                                <span key={i} className={`w-2 h-2 rounded-full ${i < shields ? 'bg-chart-3' : 'bg-secondary'}`} />
                            ))}
                        </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {shields >= 2 ? 'Bank full — you\'re covered' : 'Earn one each 7-day milestone'}
                    </span>
                </div>

                {next && (
                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="font-bold">{current.multiplier}×</span>
                            <span className="font-bold text-foreground">{daysToNext} days to {next.multiplier}×</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressToNext}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-streak rounded-full"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Tier ladder */}
            <div className="card-soft p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-streak/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-streak" />
                    </div>
                    <div>
                        <h4 className="font-display font-extrabold text-foreground text-base">Multiplier Tiers</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Higher streak = more XP per action.</p>
                    </div>
                </div>
                <div className="space-y-2">
                    {STREAK_TIERS.map((tier) => {
                        const isActive = current.days === tier.days;
                        const isPassed = streakDays >= tier.days && current.days !== tier.days;
                        const isLocked = streakDays < tier.days;
                        const TierIcon = tier.icon;
                        const cls = ACCENT_CLASSES[tier.accent];
                        return (
                            <div
                                key={tier.days}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                                    isActive
                                        ? `${cls.bg10} border-2 ${cls.border}`
                                        : isPassed
                                            ? 'bg-secondary/50 border-2 border-transparent'
                                            : 'bg-secondary/30 border-2 border-transparent opacity-50'
                                }`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    isActive ? cls.bg15 : isPassed ? 'bg-surface' : 'bg-secondary'
                                }`}>
                                    <TierIcon className={`w-4 h-4 ${
                                        isActive ? cls.text : isPassed ? 'text-foreground' : 'text-muted-foreground/60'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold ${
                                        isActive ? cls.text : isPassed ? 'text-foreground' : 'text-muted-foreground/60'
                                    }`}>{tier.label}</p>
                                    <p className="text-xs text-muted-foreground/60">{tier.days === 0 ? 'Start today' : `${tier.days}+ day streak`}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`pill ${
                                        isActive
                                            ? cls.pillSolid
                                            : isPassed
                                                ? 'bg-primary/15 text-primary'
                                                : 'bg-secondary text-muted-foreground'
                                    }`}>
                                        {tier.multiplier}× XP
                                    </span>
                                    {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />}
                                    {isPassed && <Check className="w-3.5 h-3.5 text-primary" />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tip box */}
            <div className="card-soft p-4 bg-streak/5 border-streak/30 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-streak/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-streak" />
                </div>
                <p className="text-xs text-foreground leading-relaxed">
                    <strong className="font-bold">Pro tip:</strong> A 30-day streak gives you 2.5× XP on everything — that's 150% more XP from quizzes, flashcards, focus sessions, and goals.
                </p>
            </div>
        </motion.div>
    );
}
