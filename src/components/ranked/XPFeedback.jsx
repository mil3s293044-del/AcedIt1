/**
 * XPFeedback v3 — Hyper-gamified XP popup, level-ups & rank-ups
 * Trigger: window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp, source, leveled_up, rank_up, alltime_rank, level_after, friend_comparison } }))
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Star, TrendingUp, Flame, Crown, Sparkles, Trophy, Target, ChevronUp, Timer, Layers, BrainCircuit, Lightbulb, PencilLine, Coins, Medal } from "lucide-react";

const SOURCE_LABELS = {
    study_session:      "Focus Session",
    focus_session:      "Focus Session",
    flashcard:          "Flashcards",
    quiz:               "Quiz",
    challenge:          "Challenge",
    sub_goal:           "Sub-Goal Done!",
    goal:               "Goal Complete!",
    streak:             "Streak Bonus",
    weekly_streak:      "Weekly Streak",
    wager:              "Wager Win",
    competition_bonus:  "Competition",
    active_recall:      "Active Recall",
    blurting:           "Blurting",
    migration:          "Legacy XP",
};

// Map each XP source to a Lucide icon component (replaces previous emoji map).
const SOURCE_ICONS = {
    study_session:     Timer,
    focus_session:     Timer,
    flashcard:         Layers,
    quiz:              BrainCircuit,
    challenge:         Zap,
    sub_goal:          Target,
    goal:              Trophy,
    streak:            Flame,
    weekly_streak:     Flame,
    wager:             Coins,
    competition_bonus: Medal,
    active_recall:     Lightbulb,
    blurting:          PencilLine,
};

// Fun taunt messages to stoke competitiveness
const TAUNT_MESSAGES = [
    "Pulling ahead of your friends! 😤",
    "They can't catch you now! 🚀",
    "The leaderboard is watching 👀",
    "Gap widening! 📈",
    "On a heater! 🔥",
    "Untouchable! ⚡",
    "This is your moment! 💪",
    "Climbing the ranks! 🏔️",
    "Your friends are shaking 😅",
    "No days off! 💎",
];

function getRandomTaunt() {
    return TAUNT_MESSAGES[Math.floor(Math.random() * TAUNT_MESSAGES.length)];
}

// Lightweight confetti burst using DOM
function spawnConfetti(count = 18) {
    const colors = ['#a855f7', '#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6'];
    const container = document.getElementById('xp-confetti-root');
    if (!container) return;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 6 + Math.random() * 8;
        const startX = window.innerWidth - 150 + (Math.random() - 0.5) * 120;
        const startY = window.innerHeight - 200;
        el.style.cssText = `
            position:fixed;left:${startX}px;top:${startY}px;
            width:${size}px;height:${size}px;
            background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events:none;z-index:9999;
            transform:rotate(${Math.random() * 360}deg);
        `;
        container.appendChild(el);

        const angle = -90 + (Math.random() - 0.5) * 160;
        const velocity = 120 + Math.random() * 200;
        const rad = (angle * Math.PI) / 180;
        const vx = Math.cos(rad) * velocity;
        const vy = Math.sin(rad) * velocity;
        let x = 0, y = 0, vy2 = vy, t = 0;

        const animate = () => {
            t += 0.016;
            vy2 += 9.8 * 0.016 * 20; // gravity
            x += vx * 0.016;
            y += vy2 * 0.016;
            el.style.transform = `translate(${x}px,${y}px) rotate(${t * 360}deg)`;
            el.style.opacity = String(Math.max(0, 1 - t / 1.2));
            if (t < 1.4) requestAnimationFrame(animate);
            else el.remove();
        };
        requestAnimationFrame(animate);
    }
}

let nextId = 0;

export default function XPFeedback() {
    const [popups, setPopups] = useState([]);

    const addPopup = useCallback((detail) => {
        const id = ++nextId;
        const isSpecial = detail.leveled_up || detail.rank_up;
        const duration = isSpecial ? 5000 : detail.xp >= 100 ? 3500 : 2800;

        // Fire confetti on level-up or large XP
        if (detail.leveled_up || (detail.xp && detail.xp >= 150)) {
            setTimeout(() => spawnConfetti(detail.leveled_up ? 40 : 20), 50);
        }

        setPopups(p => [...p.slice(-4), {
            id,
            taunt: detail.xp >= 30 ? getRandomTaunt() : null,
            ...detail,
            ts: Date.now()
        }]);
        setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), duration);
    }, []);

    useEffect(() => {
        const handler = (e) => addPopup(e.detail);
        window.addEventListener('xp_awarded', handler);
        return () => window.removeEventListener('xp_awarded', handler);
    }, [addPopup]);

    return (
        <>
            {/* Confetti mount point */}
            <div id="xp-confetti-root" className="pointer-events-none" />

            {/* Popup stack */}
            <div
                className="fixed bottom-24 right-4 z-[200] flex flex-col-reverse gap-2 pointer-events-none"
                style={{ maxWidth: 270 }}
            >
                <AnimatePresence>
                    {popups.map(p => (
                        <motion.div
                            key={p.id}
                            initial={{ opacity: 0, x: 90, scale: 0.5, rotate: 8 }}
                            animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, x: 70, scale: 0.85, y: -8 }}
                            transition={{ type: "spring", stiffness: 500, damping: 28 }}
                        >
                            {p.leveled_up ? (
                                <LevelUpBanner level={p.level_after} rankUp={p.rank_up} rank={p.alltime_rank} />
                            ) : p.rank_up ? (
                                <RankUpBanner rank={p.alltime_rank} />
                            ) : (
                                <XPPopup xp={p.xp} source={p.source} streak={p.streak} taunt={p.taunt} />
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </>
    );
}

function XPPopup({ xp, source, streak, taunt }) {
    if (!xp || xp <= 0) return null;
    const huge = xp >= 200;
    const big = xp >= 80;
    const Icon = SOURCE_ICONS[source] || Zap;

    return (
        <div className={`rounded-2xl shadow-2xl border overflow-hidden backdrop-blur-sm ${
            huge
                ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 border-amber-300'
                : big
                ? 'bg-gradient-to-r from-violet-500 via-purple-600 to-indigo-600 border-violet-400'
                : 'bg-white border-gray-200'
        }`}>
            {/* Shimmer overlay */}
            {(huge || big) && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-pulse" />
            )}

            <div className="relative flex items-center gap-2.5 px-3.5 py-2.5">
                {/* Icon */}
                <motion.div
                    animate={{ scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 0.45, delay: 0.1 }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        huge || big ? 'bg-white/20' : 'bg-primary/10'
                    }`}
                >
                    <Icon className={`w-5 h-5 ${huge || big ? 'text-white' : 'text-primary'}`} strokeWidth={2.5} />
                </motion.div>

                <div className="min-w-0 flex-1">
                    <motion.p
                        initial={{ scale: 0.7 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 600, damping: 20 }}
                        className={`font-black leading-tight ${
                            huge ? 'text-white text-xl' : big ? 'text-white text-lg' : 'text-indigo-700 text-base'
                        }`}
                    >
                        +{xp.toLocaleString()} XP
                    </motion.p>
                    <p className={`text-xs truncate font-medium ${huge || big ? 'text-white/80' : 'text-gray-500'}`}>
                        {SOURCE_LABELS[source] || source}
                    </p>
                    {taunt && (
                        <p className={`text-xs font-semibold mt-0.5 truncate ${huge || big ? 'text-white/90' : 'text-purple-600'}`}>
                            {taunt}
                        </p>
                    )}
                </div>

                {/* Streak multiplier */}
                {streak > 1 && (
                    <div className={`flex items-center gap-0.5 flex-shrink-0 ${huge || big ? 'text-white' : 'text-orange-500'}`}>
                        <Flame className="w-4 h-4" />
                        <span className="text-sm font-black">×{streak}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function LevelUpBanner({ level, rankUp, rank }) {
    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-purple-400">
            {/* Animated rays */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -top-6 -right-6 w-20 h-20 bg-white/5 rounded-full"
            />
            <div className="relative flex items-center gap-3">
                <motion.div
                    animate={{ rotate: [0, -15, 15, -8, 8, 0], scale: [1, 1.3, 1.1, 1.2, 1] }}
                    transition={{ duration: 0.7 }}
                    className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0"
                >
                    <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                </motion.div>
                <div>
                    <p className="font-black text-lg leading-tight">Level Up! 🎉</p>
                    <p className="text-purple-200 text-sm font-bold">→ Level {level}</p>
                    {rankUp && rank && <p className="text-yellow-300 text-xs font-semibold">{rank.emoji} {rank.name}</p>}
                    <p className="text-purple-300 text-xs mt-0.5">Keep crushing it! 🚀</p>
                </div>
            </div>
        </div>
    );
}

function RankUpBanner({ rank }) {
    if (!rank) return null;
    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-amber-400">
            <div className="relative flex items-center gap-3">
                <motion.div
                    animate={{ scale: [1, 1.4, 0.9, 1.15, 1], rotate: [0, 20, -15, 8, 0] }}
                    transition={{ duration: 0.7 }}
                    className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                >
                    {rank.emoji}
                </motion.div>
                <div>
                    <p className="font-black text-lg leading-tight">Rank Up! 🚀</p>
                    <p className="text-amber-100 text-sm font-bold">{rank.name}</p>
                    <p className="text-amber-200 text-xs mt-0.5">Your friends won't know what hit them 😤</p>
                </div>
            </div>
        </div>
    );
}

/**
 * Helper — call after any awardXP response to fire the popup.
 */
export function fireXPFeedback(res, source) {
    if (!res || !res.xp_awarded || res.xp_awarded <= 0) return;
    window.dispatchEvent(new CustomEvent('xp_awarded', {
        detail: {
            xp: res.xp_awarded,
            source: source || res.source,
            leveled_up: res.leveled_up,
            rank_up: res.rank_up || res.season_rank_up,
            alltime_rank: res.alltime_rank,
            season_rank: res.season_rank,
            level_after: res.current_level,
        }
    }));
}