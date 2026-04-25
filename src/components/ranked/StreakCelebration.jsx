/**
 * StreakCelebration — fullscreen animated overlay shown when a user's streak ticks up.
 * Triggered by window event 'streak_updated' with detail { streak_days, is_consecutive, hit_milestone }.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';

const MILESTONE_MESSAGES = {
    3:   { msg: "3 Day Streak!", sub: "You're building a habit 🌱" },
    7:   { msg: "1 Week Streak! 🔥", sub: "1.25× XP multiplier unlocked!" },
    14:  { msg: "2 Week Streak! ⚡", sub: "1.5× XP multiplier unlocked!" },
    30:  { msg: "30 Day Streak! 👑", sub: "DOUBLE XP unlocked! Incredible!" },
    60:  { msg: "60 Days! 🏆", sub: "You're a studying machine!" },
    100: { msg: "100 DAY LEGEND! 🌟", sub: "2× XP — You are unstoppable!" },
    150: { msg: "150 Days! 💎", sub: "VCE royalty status achieved." },
    200: { msg: "200 Days! 🚀", sub: "200 consecutive days of greatness." },
    365: { msg: "365 DAYS! 👑🔥", sub: "A FULL YEAR. You are a legend." },
};

function getFlameSize(days) {
    if (days >= 100) return 'text-9xl';
    if (days >= 30)  return 'text-8xl';
    if (days >= 7)   return 'text-7xl';
    return 'text-6xl';
}

function getGradient(days) {
    if (days >= 100) return 'from-yellow-400 via-orange-500 to-red-600';
    if (days >= 30)  return 'from-orange-400 via-red-500 to-pink-600';
    if (days >= 14)  return 'from-amber-400 via-orange-500 to-red-500';
    if (days >= 7)   return 'from-yellow-400 via-amber-500 to-orange-500';
    if (days >= 3)   return 'from-lime-400 via-green-500 to-emerald-500';
    return 'from-orange-400 to-red-500';
}

// Floating ember particle
const Ember = ({ style }) => (
    <motion.div
        className="absolute w-2 h-2 rounded-full bg-orange-400 opacity-80"
        style={style}
        animate={{
            y: [-20, -120, -200],
            x: [0, (Math.random() - 0.5) * 80],
            opacity: [0.8, 0.6, 0],
            scale: [1, 0.8, 0.2],
        }}
        transition={{ duration: 1.5 + Math.random(), ease: 'easeOut' }}
    />
);

export default function StreakCelebration() {
    const [event, setEvent] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            const d = e.detail;
            if (d?.streak_days >= 1) setEvent(d);
        };
        window.addEventListener('streak_updated', handler);
        return () => window.removeEventListener('streak_updated', handler);
    }, []);

    useEffect(() => {
        if (!event) return;
        const t = setTimeout(() => setEvent(null), event.hit_milestone ? 4000 : 2500);
        return () => clearTimeout(t);
    }, [event]);

    if (!event) return null;

    const days = event.streak_days;
    const milestone = MILESTONE_MESSAGES[days];
    const gradient = getGradient(days);
    const flameSize = getFlameSize(days);

    const embers = Array.from({ length: 12 }, (_, i) => ({
        left: `${10 + i * 7}%`,
        bottom: '30%',
    }));

    return (
        <AnimatePresence>
            {event && (
                <motion.div
                    className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Dim backdrop for milestones only */}
                    {milestone && (
                        <motion.div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                    )}

                    {/* Embers */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {embers.map((s, i) => <Ember key={i} style={s} />)}
                    </div>

                    {/* Main card */}
                    <motion.div
                        className={`relative z-10 flex flex-col items-center gap-4 px-10 py-8 rounded-3xl shadow-2xl bg-gradient-to-br ${gradient} text-white`}
                        initial={{ scale: 0.3, opacity: 0, y: 60 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: -40 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                        {/* Flame icon with pulse */}
                        <motion.div
                            animate={{
                                scale: [1, 1.15, 1, 1.1, 1],
                                rotate: [0, -8, 8, -4, 0],
                            }}
                            transition={{ duration: 0.8, repeat: 2 }}
                            className={flameSize}
                        >
                            🔥
                        </motion.div>

                        {/* Day count */}
                        <motion.div
                            className="text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="font-black text-6xl drop-shadow-lg leading-none">
                                {days}
                            </div>
                            <div className="text-xl font-bold opacity-90 mt-1">
                                {days === 1 ? 'Day Streak!' : 'Day Streak!'}
                            </div>
                        </motion.div>

                        {/* Milestone message */}
                        {milestone && (
                            <motion.div
                                className="text-center"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                <div className="font-bold text-lg">{milestone.msg}</div>
                                <div className="text-sm opacity-80 mt-0.5">{milestone.sub}</div>
                            </motion.div>
                        )}

                        {/* Multiplier badge */}
                        {event.multiplier > 1.0 && (
                            <motion.div
                                className="flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5 text-sm font-bold"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <Flame className="w-4 h-4" />
                                {event.multiplier}× XP Multiplier Active
                            </motion.div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}