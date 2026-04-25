import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, Zap, Star, Clock, Brain, Flame, Lock, CheckCircle2, Crown, Sparkles, BookOpen } from "lucide-react";
import { levelFromXP } from "@/components/shared/xpSystem";

const PERKS = [
    {
        id: "streak_shield",
        name: "Streak Shield",
        desc: "Protect your streak — miss a day without losing it",
        longDesc: "Automatically activates when you miss a day. Your streak is saved! Can be used once per week.",
        icon: Shield,
        color: "from-blue-500 to-cyan-500",
        bg: "bg-blue-50 border-blue-200",
        unlockLevel: 5,
        maxCharges: 2,
        cooldownDays: 7,
        emoji: "🛡️",
    },
    {
        id: "xp_booster",
        name: "XP Booster",
        desc: "2× XP for your next 30-minute study session",
        longDesc: "Activate before a study session to double all XP earned for 30 minutes. Show up and stack those gains.",
        icon: Zap,
        color: "from-amber-500 to-orange-500",
        bg: "bg-amber-50 border-amber-200",
        unlockLevel: 10,
        maxCharges: 1,
        cooldownDays: 3,
        emoji: "⚡",
    },
    {
        id: "flashcard_frenzy",
        name: "Flashcard Frenzy",
        desc: "+75% XP from flashcards for 24 hours",
        longDesc: "Supercharge your spaced repetition sessions. Earn 75% more XP from every flashcard reviewed for the next 24 hours.",
        icon: BookOpen,
        color: "from-green-500 to-emerald-500",
        bg: "bg-green-50 border-green-200",
        unlockLevel: 8,
        maxCharges: 1,
        cooldownDays: 4,
        emoji: "🃏",
    },
    {
        id: "quiz_retry",
        name: "Quiz Retry Pass",
        desc: "Retry any quiz and keep the higher score",
        longDesc: "Bombed a quiz? Activate this perk, retry it, and the higher of your two scores counts for XP. No penalty.",
        icon: Brain,
        color: "from-purple-500 to-violet-500",
        bg: "bg-purple-50 border-purple-200",
        unlockLevel: 15,
        maxCharges: 1,
        cooldownDays: 5,
        emoji: "🧠",
    },
    {
        id: "double_mission",
        name: "Mission Doubler",
        desc: "Double XP rewards from today's daily missions",
        longDesc: "Activate this perk before completing your daily missions to earn double XP from all mission rewards.",
        icon: Star,
        color: "from-pink-500 to-rose-500",
        bg: "bg-pink-50 border-pink-200",
        unlockLevel: 20,
        maxCharges: 1,
        cooldownDays: 7,
        emoji: "⭐",
    },
    {
        id: "study_surge",
        name: "Study Surge",
        desc: "+50% XP from focus sessions for 2 hours",
        longDesc: "All study session XP is boosted by 50% for the next 2 hours. Stack it with your peak study time.",
        icon: Clock,
        color: "from-cyan-500 to-teal-500",
        bg: "bg-cyan-50 border-cyan-200",
        unlockLevel: 25,
        maxCharges: 1,
        cooldownDays: 4,
        emoji: "⏱️",
    },
    {
        id: "streak_legend",
        name: "Streak Legend",
        desc: "Streak multiplier permanently +0.5×",
        longDesc: "Your streak XP multiplier gets a permanent +0.5× boost on top of your normal multiplier. Stackable.",
        icon: Flame,
        color: "from-orange-500 to-red-500",
        bg: "bg-orange-50 border-orange-200",
        unlockLevel: 35,
        maxCharges: null,
        cooldownDays: null,
        emoji: "🔥",
        isPermanent: true,
    },
    {
        id: "prestige_aura",
        name: "Prestige Aura",
        desc: "Special golden badge on the leaderboard",
        longDesc: "A glowing golden aura appears next to your name on all leaderboards, showing your elite status to everyone.",
        icon: Crown,
        color: "from-yellow-400 to-amber-500",
        bg: "bg-yellow-50 border-yellow-200",
        unlockLevel: 50,
        maxCharges: null,
        cooldownDays: null,
        emoji: "👑",
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
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="font-black text-base">Perk System</h3>
                        </div>
                        <p className="text-white/70 text-xs mt-0.5">Unlock powerful study boosts as you level up</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black">{unlockedCount}/{PERKS.length}</p>
                        <p className="text-white/70 text-xs">Unlocked</p>
                    </div>
                </div>
                {activeCount > 0 && (
                    <div className="mt-3 bg-white/10 rounded-xl px-3 py-2">
                        <p className="text-xs font-bold text-white">⚡ {activeCount} perk{activeCount > 1 ? 's' : ''} active right now!</p>
                    </div>
                )}
            </div>

            {/* Perks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERKS.map((perk, i) => {
                    const unlocked = isUnlocked(perk);
                    const status = getActiveStatus(perk);
                    const Icon = perk.icon;

                    return (
                        <motion.button
                            key={perk.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => unlocked && setSelectedPerk(perk)}
                            className={`text-left p-4 rounded-2xl border-2 transition-all ${
                                !unlocked ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' :
                                status.active ? `${perk.bg} border-2 shadow-lg ring-2 ring-offset-1 ${perk.bg.includes('blue') ? 'ring-blue-300' : perk.bg.includes('amber') ? 'ring-amber-300' : 'ring-purple-300'}` :
                                perk.isPermanent && level >= perk.unlockLevel ? `${perk.bg} border-2` :
                                `${perk.bg} hover:shadow-md`
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-11 h-11 bg-gradient-to-br ${perk.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                                    {!unlocked ? <Lock className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-bold text-gray-900">{perk.name}</p>
                                        {status.active && <Badge className="bg-green-500 text-white border-0 text-xs animate-pulse">ACTIVE</Badge>}
                                        {perk.isPermanent && unlocked && <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 text-xs">PERMANENT</Badge>}
                                        {!unlocked && <Badge className="bg-gray-200 text-gray-600 border-0 text-xs">Lv.{perk.unlockLevel}</Badge>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{perk.desc}</p>
                                    {unlocked && !perk.isPermanent && (
                                        <div className="flex items-center gap-2 mt-1.5">
                                            {!perk.isPermanent && (
                                                <div className="flex gap-0.5">
                                                    {Array.from({ length: perk.maxCharges || 1 }).map((_, ci) => (
                                                        <div key={ci} className={`w-2.5 h-2.5 rounded-full ${ci < (status.charges || 0) ? `bg-gradient-to-br ${perk.color}` : 'bg-gray-200'}`} />
                                                    ))}
                                                </div>
                                            )}
                                            <span className="text-xs text-gray-400">{status.charges || 0}/{perk.maxCharges} charges</span>
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
                        const now = Date.now();
                        const timeLeft = status.activeUntil > now ? Math.ceil((status.activeUntil - now) / 60000) : 0;
                        const cooldownLeft = status.cooldownUntil > now ? Math.ceil((status.cooldownUntil - now) / 3600000) : 0;
                        const canActivate = !status.active && !status.onCooldown && (status.charges > 0) && !selectedPerk.isPermanent;

                        return (
                            <>
                                <DialogHeader>
                                    <div className={`w-16 h-16 bg-gradient-to-br ${selectedPerk.color} rounded-2xl flex items-center justify-center mb-3 shadow-xl mx-auto`}>
                                        <Icon className="w-8 h-8 text-white" />
                                    </div>
                                    <DialogTitle className="text-center text-xl">{selectedPerk.name}</DialogTitle>
                                    <DialogDescription className="text-center">{selectedPerk.longDesc}</DialogDescription>
                                </DialogHeader>

                                <div className="space-y-3 mt-2">
                                    {status.active && (
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                            <p className="text-green-700 font-bold text-sm">✅ Currently Active!</p>
                                            <p className="text-green-600 text-xs">{timeLeft} minutes remaining</p>
                                        </div>
                                    )}
                                    {status.onCooldown && !status.active && (
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                                            <p className="text-gray-600 font-bold text-sm">⏳ On Cooldown</p>
                                            <p className="text-gray-400 text-xs">{cooldownLeft}h remaining</p>
                                        </div>
                                    )}
                                    {selectedPerk.isPermanent && (
                                        <div className={`${selectedPerk.bg} border rounded-xl p-3 text-center`}>
                                            <p className="font-bold text-sm text-gray-800">✨ Permanently Active</p>
                                            <p className="text-xs text-gray-500">This perk is always on at your level</p>
                                        </div>
                                    )}
                                    {!selectedPerk.isPermanent && (
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                                <p className="text-2xl font-black text-gray-900">{status.charges}/{selectedPerk.maxCharges}</p>
                                                <p className="text-xs text-gray-500">Charges left</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                                <p className="text-2xl font-black text-gray-900">{selectedPerk.cooldownDays}d</p>
                                                <p className="text-xs text-gray-500">Cooldown</p>
                                            </div>
                                        </div>
                                    )}
                                    {canActivate && (
                                        <Button onClick={() => activatePerk(selectedPerk)} disabled={activating === selectedPerk.id}
                                            className={`w-full h-12 font-black text-base bg-gradient-to-r ${selectedPerk.color} hover:opacity-90 shadow-lg`}>
                                            {activating === selectedPerk.id ? '⚡ Activating...' : `⚡ Activate ${selectedPerk.name}`}
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