import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, Zap, Star, Clock, Brain, Flame, Lock, CheckCircle2, Crown, Sparkles, BookOpen } from "lucide-react";
import { levelFromXP } from "@/components/shared/xpSystem";

// Static class lookup — Tailwind JIT can't see interpolated strings
// like `bg-${accent}/10`, so each token's classes must appear verbatim.
const ACCENT = {
    primary:   { tile10: 'bg-primary/10',   tile15: 'bg-primary/15',   text: 'text-primary',   border40: 'border-primary/40',   border20: 'border-primary/20',   ring20: 'ring-primary/20',   solid: 'bg-primary' },
    xp:        { tile10: 'bg-xp/10',        tile15: 'bg-xp/15',        text: 'text-xp',        border40: 'border-xp/40',        border20: 'border-xp/20',        ring20: 'ring-xp/20',        solid: 'bg-xp' },
    streak:    { tile10: 'bg-streak/10',    tile15: 'bg-streak/15',    text: 'text-streak',    border40: 'border-streak/40',    border20: 'border-streak/20',    ring20: 'ring-streak/20',    solid: 'bg-streak' },
    'chart-3': { tile10: 'bg-chart-3/10',   tile15: 'bg-chart-3/15',   text: 'text-chart-3',   border40: 'border-chart-3/40',   border20: 'border-chart-3/20',   ring20: 'ring-chart-3/20',   solid: 'bg-chart-3' },
    'chart-4': { tile10: 'bg-chart-4/10',   tile15: 'bg-chart-4/15',   text: 'text-chart-4',   border40: 'border-chart-4/40',   border20: 'border-chart-4/20',   ring20: 'ring-chart-4/20',   solid: 'bg-chart-4' },
};

const PERKS = [
    {
        id: "streak_shield",
        name: "Streak Shield",
        desc: "Protect your streak — miss a day without losing it",
        longDesc: "Automatically activates when you miss a day. Your streak is saved! Can be used once per week.",
        icon: Shield,
        accent: "chart-3",
        unlockLevel: 5,
        maxCharges: 2,
        cooldownDays: 7,
    },
    {
        id: "xp_booster",
        name: "XP Booster",
        desc: "2× XP for your next 30-minute study session",
        longDesc: "Activate before a study session to double all XP earned for 30 minutes. Show up and stack those gains.",
        icon: Zap,
        accent: "xp",
        unlockLevel: 10,
        maxCharges: 1,
        cooldownDays: 3,
    },
    {
        id: "flashcard_frenzy",
        name: "Flashcard Frenzy",
        desc: "+75% XP from flashcards for 24 hours",
        longDesc: "Supercharge your spaced repetition sessions. Earn 75% more XP from every flashcard reviewed for the next 24 hours.",
        icon: BookOpen,
        accent: "primary",
        unlockLevel: 8,
        maxCharges: 1,
        cooldownDays: 4,
    },
    {
        id: "quiz_retry",
        name: "Quiz Retry Pass",
        desc: "Retry any quiz and keep the higher score",
        longDesc: "Bombed a quiz? Activate this perk, retry it, and the higher of your two scores counts for XP. No penalty.",
        icon: Brain,
        accent: "chart-4",
        unlockLevel: 15,
        maxCharges: 1,
        cooldownDays: 5,
    },
    {
        id: "double_mission",
        name: "Mission Doubler",
        desc: "Double XP rewards from today's daily missions",
        longDesc: "Activate this perk before completing your daily missions to earn double XP from all mission rewards.",
        icon: Star,
        accent: "chart-4",
        unlockLevel: 20,
        maxCharges: 1,
        cooldownDays: 7,
    },
    {
        id: "study_surge",
        name: "Study Surge",
        desc: "+50% XP from focus sessions for 2 hours",
        longDesc: "All study session XP is boosted by 50% for the next 2 hours. Stack it with your peak study time.",
        icon: Clock,
        accent: "chart-3",
        unlockLevel: 25,
        maxCharges: 1,
        cooldownDays: 4,
    },
    {
        id: "streak_legend",
        name: "Streak Legend",
        desc: "Streak multiplier permanently +0.5×",
        longDesc: "Your streak XP multiplier gets a permanent +0.5× boost on top of your normal multiplier. Stackable.",
        icon: Flame,
        accent: "streak",
        unlockLevel: 35,
        maxCharges: null,
        cooldownDays: null,
        isPermanent: true,
    },
    {
        id: "prestige_aura",
        name: "Prestige Aura",
        desc: "Special golden badge on the leaderboard",
        longDesc: "A glowing golden aura appears next to your name on all leaderboards, showing your elite status to everyone.",
        icon: Crown,
        accent: "xp",
        unlockLevel: 50,
        maxCharges: null,
        cooldownDays: null,
        isPermanent: true,
    },
];

function getPerkState() {
    const stored = localStorage.getItem('perksState');
    return stored ? JSON.parse(stored) : {};
}
function savePerkState(state) {
    localStorage.setItem('perksState', JSON.stringify(state));
}

export default function PerksSystem({ totalXP = 0 }) {
    const level = levelFromXP(totalXP);
    const [perkState, setPerkState] = useState(getPerkState());
    const [selectedPerk, setSelectedPerk] = useState(null);
    const [activating, setActivating] = useState(null);

    const isUnlocked = (perk) => level >= perk.unlockLevel;

    const getActiveStatus = (perk) => {
        const state = perkState[perk.id];
        if (!state) return { active: false, charges: perk.maxCharges || 0, onCooldown: false };
        const now = Date.now();
        const active = state.activeUntil && state.activeUntil > now;
        const onCooldown = state.cooldownUntil && state.cooldownUntil > now && !active;
        const charges = state.charges ?? perk.maxCharges ?? 0;
        return { active, charges, onCooldown, activeUntil: state.activeUntil, cooldownUntil: state.cooldownUntil };
    };

    const activatePerk = async (perk) => {
        if (!isUnlocked(perk) || perk.isPermanent) return;
        const status = getActiveStatus(perk);
        if (status.active || status.onCooldown || status.charges <= 0) return;
        setActivating(perk.id);
        await new Promise(r => setTimeout(r, 500));
        const now = Date.now();
        const durMs = perk.id === 'xp_booster' ? 30 * 60000
            : perk.id === 'flashcard_frenzy' ? 24 * 3600000
            : perk.id === 'study_surge' ? 2 * 3600000
            : perk.id === 'quiz_retry' ? 24 * 3600000
            : perk.id === 'double_mission' ? 24 * 3600000
            : perk.id === 'streak_shield' ? 24 * 3600000 * 7
            : 24 * 3600000;
        const newState = {
            ...perkState,
            [perk.id]: {
                charges: (status.charges || perk.maxCharges) - 1,
                activeUntil: now + durMs,
                cooldownUntil: now + durMs + (perk.cooldownDays || 3) * 86400000,
                activatedAt: now,
            }
        };
        savePerkState(newState);
        setPerkState(newState);
        setActivating(null);
        setSelectedPerk(null);
        window.dispatchEvent(new CustomEvent('perk_activated', { detail: { perkId: perk.id } }));
    };

    const unlockedCount = PERKS.filter(p => isUnlocked(p)).length;
    const activeCount = PERKS.filter(p => getActiveStatus(p).active).length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="card-soft p-5"
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-chart-4" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-display font-extrabold text-foreground text-base">Perk System</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Unlock powerful study boosts as you level up.</p>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="stat-num text-foreground">{unlockedCount}<span className="text-muted-foreground/60 text-2xl">/{PERKS.length}</span></p>
                        <p className="stat-label">Unlocked</p>
                    </div>
                </div>
                {activeCount > 0 && (
                    <div className="mt-4 inline-flex items-center gap-2.5 bg-primary/10 border-2 border-primary/20 rounded-xl px-4 py-2.5">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">
                            {activeCount} perk{activeCount > 1 ? 's' : ''} active right now
                        </span>
                    </div>
                )}
            </motion.div>

            {/* Perks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PERKS.map((perk, i) => {
                    const unlocked = isUnlocked(perk);
                    const status = getActiveStatus(perk);
                    const Icon = perk.icon;
                    const accent = perk.accent;
                    const cls = ACCENT[accent] || ACCENT.primary;

                    return (
                        <motion.button
                            key={perk.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => unlocked && setSelectedPerk(perk)}
                            disabled={!unlocked}
                            className={`card-soft p-5 text-left transition-all ${
                                !unlocked
                                    ? 'opacity-60 cursor-not-allowed'
                                    : status.active
                                        ? `${cls.border40} ring-2 ${cls.ring20} cursor-pointer`
                                        : 'card-soft-hover cursor-pointer'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`relative w-11 h-11 rounded-xl ${cls.tile10} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-5 h-5 ${cls.text}`} />
                                    {!unlocked && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center">
                                            <Lock className="w-3 h-3 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-display font-extrabold text-foreground text-sm">{perk.name}</p>
                                        {status.active && (
                                            <span className="pill bg-primary/15 text-primary animate-soft-pulse">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Active
                                            </span>
                                        )}
                                        {perk.isPermanent && unlocked && (
                                            <span className={`pill ${cls.tile15} ${cls.text}`}>
                                                <Sparkles className="w-3 h-3" />
                                                Permanent
                                            </span>
                                        )}
                                        {!unlocked && (
                                            <span className="pill bg-secondary text-muted-foreground">
                                                Lv.{perk.unlockLevel}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{perk.desc}</p>
                                    {unlocked && !perk.isPermanent && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="flex gap-1">
                                                {Array.from({ length: perk.maxCharges || 1 }).map((_, ci) => (
                                                    <div
                                                        key={ci}
                                                        className={`w-2.5 h-2.5 rounded-full ${
                                                            ci < (status.charges || 0)
                                                                ? cls.solid
                                                                : 'bg-secondary border border-border'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-muted-foreground/80 font-medium">
                                                {status.charges || 0}/{perk.maxCharges} charges
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Perk Detail Dialog */}
            <Dialog open={!!selectedPerk} onOpenChange={() => setSelectedPerk(null)}>
                <DialogContent>
                    {selectedPerk && (() => {
                        const status = getActiveStatus(selectedPerk);
                        const Icon = selectedPerk.icon;
                        const accent = selectedPerk.accent;
                        const cls = ACCENT[accent] || ACCENT.primary;
                        const now = Date.now();
                        const timeLeft = status.activeUntil > now ? Math.ceil((status.activeUntil - now) / 60000) : 0;
                        const cooldownLeft = status.cooldownUntil > now ? Math.ceil((status.cooldownUntil - now) / 3600000) : 0;
                        const canActivate = !status.active && !status.onCooldown && (status.charges > 0) && !selectedPerk.isPermanent;

                        return (
                            <>
                                <DialogHeader>
                                    <div className={`w-16 h-16 rounded-2xl ${cls.tile10} flex items-center justify-center mb-3 mx-auto`}>
                                        <Icon className={`w-8 h-8 ${cls.text}`} />
                                    </div>
                                    <DialogTitle className="text-center font-display font-extrabold text-foreground text-xl">
                                        {selectedPerk.name}
                                    </DialogTitle>
                                    <DialogDescription className="text-center text-muted-foreground">
                                        {selectedPerk.longDesc}
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-3 mt-2">
                                    {status.active && (
                                        <div className="rounded-xl bg-primary/10 border-2 border-primary/20 p-3 text-center">
                                            <p className="font-display font-extrabold text-primary text-sm flex items-center justify-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Currently Active
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{timeLeft} minutes remaining</p>
                                        </div>
                                    )}
                                    {status.onCooldown && !status.active && (
                                        <div className="rounded-xl bg-secondary border-2 border-border p-3 text-center">
                                            <p className="font-display font-extrabold text-foreground text-sm flex items-center justify-center gap-1.5">
                                                <Clock className="w-4 h-4 text-muted-foreground" />
                                                On Cooldown
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{cooldownLeft}h remaining</p>
                                        </div>
                                    )}
                                    {selectedPerk.isPermanent && (
                                        <div className={`rounded-xl ${cls.tile10} border-2 ${cls.border20} p-3 text-center`}>
                                            <p className={`font-display font-extrabold ${cls.text} text-sm flex items-center justify-center gap-1.5`}>
                                                <Sparkles className="w-4 h-4" />
                                                Permanently Active
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">This perk is always on at your level</p>
                                        </div>
                                    )}
                                    {!selectedPerk.isPermanent && (
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div className="card-soft p-3">
                                                <p className="stat-num text-foreground">{status.charges}<span className="text-muted-foreground/60 text-xl">/{selectedPerk.maxCharges}</span></p>
                                                <p className="stat-label">Charges left</p>
                                            </div>
                                            <div className="card-soft p-3">
                                                <p className="stat-num text-foreground">{selectedPerk.cooldownDays}<span className="text-muted-foreground/60 text-xl">d</span></p>
                                                <p className="stat-label">Cooldown</p>
                                            </div>
                                        </div>
                                    )}
                                    {canActivate && (
                                        <Button
                                            onClick={() => activatePerk(selectedPerk)}
                                            disabled={activating === selectedPerk.id}
                                            className="w-full"
                                        >
                                            {activating === selectedPerk.id ? (
                                                <>
                                                    <Zap className="w-4 h-4 animate-pulse" />
                                                    Activating…
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-4 h-4" />
                                                    Activate {selectedPerk.name}
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
