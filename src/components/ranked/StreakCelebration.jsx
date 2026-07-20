/**
 * StreakCelebration — animated overlay shown when a user's streak ticks up.
 * Triggered by window event 'streak_updated' with detail { streak_days, multiplier, hit_milestone }.
 *
 * On-brand: uses the streak (red) → xp (orange) design tokens, a glowing Lucide
 * Flame, pulsing halo rings and soft embers — no rainbow gradients or emoji.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Shield, ShieldCheck } from 'lucide-react';

const MILESTONE_MESSAGES = {
    3:   { msg: "3 day streak", sub: "You're building a habit." },
    7:   { msg: "1 week streak", sub: "1.25× XP multiplier unlocked." },
    14:  { msg: "2 week streak", sub: "1.5× XP multiplier unlocked." },
    30:  { msg: "30 day streak", sub: "Double XP unlocked — incredible." },
    60:  { msg: "60 days", sub: "You're a studying machine." },
    100: { msg: "100 day legend", sub: "2× XP — you are unstoppable." },
    150: { msg: "150 days", sub: "VCE royalty status achieved." },
    200: { msg: "200 days", sub: "200 consecutive days of greatness." },
    365: { msg: "365 days", sub: "A full year. You are a legend." },
};

function getFlameSize(days) {
    if (days >= 100) return 'w-24 h-24';
    if (days >= 30)  return 'w-20 h-20';
    if (days >= 7)   return 'w-16 h-16';
    return 'w-14 h-14';
}

// Soft ember rising from the flame — brand orange/red, gentle drift.
const Ember = ({ delay, left, color }) => (
    <motion.div
        className={`absolute bottom-0 w-1.5 h-1.5 rounded-full ${color}`}
        style={{ left }}
        initial={{ y: 0, opacity: 0, scale: 1 }}
        animate={{ y: [-10, -90, -150], x: [0, (Math.random() - 0.5) * 50], opacity: [0, 0.9, 0], scale: [1, 0.7, 0.2] }}
        transition={{ duration: 1.8, ease: 'easeOut', repeat: Infinity, delay }}
    />
);

export default function StreakCelebration() {
    const [event, setEvent] = useState(null);

    useEffect(() => {
        const handler = (e) => { if (e.detail?.streak_days >= 1) setEvent(e.detail); };
        window.addEventListener('streak_updated', handler);
        return () => window.removeEventListener('streak_updated', handler);
    }, []);

    useEffect(() => {
        if (!event) return;
        const t = setTimeout(() => setEvent(null), (event.hit_milestone || event.shield_used || event.shield_earned) ? 4000 : 2600);
        return () => clearTimeout(t);
    }, [event]);

    if (!event) return null;

    const days = event.streak_days;
    const milestone = MILESTONE_MESSAGES[days];
    const flameSize = getFlameSize(days);

    const embers = [
        { left: '20%', delay: 0,   color: 'bg-xp' },
        { left: '38%', delay: 0.5, color: 'bg-streak' },
        { left: '55%', delay: 0.25, color: 'bg-xp/90' },
        { left: '70%', delay: 0.75, color: 'bg-streak/80' },
        { left: '46%', delay: 1.0, color: 'bg-xp' },
        { left: '30%', delay: 1.3, color: 'bg-streak/70' },
    ];

    return (
        <AnimatePresence>
            {event && (
                <motion.div
                    className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop — subtle for daily, stronger for milestones */}
                    <motion.div
                        className={`absolute inset-0 ${milestone ? 'bg-foreground/40 backdrop-blur-sm' : 'bg-foreground/10'}`}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    />

                    {/* Main card — brand streak→xp gradient */}
                    <motion.div
                        className="relative z-10 flex flex-col items-center gap-3 px-10 py-9 rounded-3xl shadow-2xl bg-gradient-to-br from-streak to-xp text-white overflow-hidden"
                        initial={{ scale: 0.4, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: -30 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                    >
                        {/* Embers rising behind the flame */}
                        <div className="absolute inset-x-0 bottom-1/3 h-32 pointer-events-none">
                            {embers.map((e, i) => <Ember key={i} {...e} />)}
                        </div>

                        {/* Flame with glow + pulsing halo rings */}
                        <div className="relative flex items-center justify-center mb-1">
                            {[0, 1].map((i) => (
                                <motion.span
                                    key={i}
                                    className="absolute rounded-full bg-surface/30"
                                    style={{ width: 80, height: 80 }}
                                    initial={{ scale: 0.6, opacity: 0.5 }}
                                    animate={{ scale: [0.6, 1.8], opacity: [0.5, 0] }}
                                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
                                />
                            ))}
                            <motion.div
                                animate={{ scale: [1, 1.12, 1, 1.08, 1], rotate: [0, -6, 6, -3, 0] }}
                                transition={{ duration: 1.1, repeat: 1 }}
                                className="relative drop-shadow-[0_4px_18px_rgba(255,255,255,0.45)]"
                            >
                                <Flame className={`${flameSize} text-white`} fill="currentColor" strokeWidth={1.5} />
                            </motion.div>
                        </div>

                        {/* Day count */}
                        <motion.div
                            className="text-center"
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        >
                            <div className="font-display font-black text-6xl drop-shadow-md leading-none tabular-nums">{days}</div>
                            <div className="text-base font-extrabold uppercase tracking-wider opacity-90 mt-1.5">
                                Day Streak
                            </div>
                        </motion.div>

                        {/* Milestone message */}
                        {milestone && (
                            <motion.div
                                className="text-center mt-1"
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
                            >
                                <div className="font-bold text-lg">{milestone.msg}</div>
                                <div className="text-sm opacity-85 mt-0.5">{milestone.sub}</div>
                            </motion.div>
                        )}

                        {/* Shield used — the streak survived a missed day */}
                        {event.shield_used && (
                            <motion.div
                                className="flex items-center gap-1.5 bg-surface/25 rounded-full px-4 py-1.5 text-sm font-bold mt-1"
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Shield used — your streak survived
                            </motion.div>
                        )}

                        {/* Weekly bonus XP — every 7th consecutive day */}
                        {event.weekly_bonus_xp > 0 && (
                            <motion.div
                                className="flex items-center gap-1.5 bg-surface/25 rounded-full px-4 py-1.5 text-sm font-bold mt-1"
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                            >
                                +{event.weekly_bonus_xp} XP weekly streak bonus
                            </motion.div>
                        )}

                        {/* Shield earned at a 7-day milestone */}
                        {event.shield_earned && (
                            <motion.div
                                className="flex items-center gap-1.5 bg-surface/25 rounded-full px-4 py-1.5 text-sm font-bold mt-1"
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}
                            >
                                <Shield className="w-4 h-4" />
                                Streak Shield earned — covers one missed day
                            </motion.div>
                        )}

                        {/* Multiplier badge */}
                        {event.multiplier > 1.0 && (
                            <motion.div
                                className="flex items-center gap-1.5 bg-surface/20 rounded-full px-4 py-1.5 text-sm font-bold mt-1"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                            >
                                <Flame className="w-4 h-4" fill="currentColor" />
                                {event.multiplier}× XP active
                            </motion.div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
