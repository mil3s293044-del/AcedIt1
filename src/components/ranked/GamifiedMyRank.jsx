import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Clock, Flame, Target, Trophy, Zap, TrendingUp, Crown, Star, Sword, Gamepad2 } from "lucide-react";
import { startOfWeek } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import XPLevelCard from "./XPLevelCard";
import StreakMultiplier from "./StreakMultiplier";
import DailyMissions from "./DailyMissions";

const StatCard = ({ icon, value, label, color, delay, sub }) => {
    const Icon = icon;
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} flex-shrink-0`}>
                    <Icon className="w-4.5 h-4.5 text-white" />
                </div>
            </div>
            <p className="text-xl font-black text-gray-900 leading-none">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </motion.div>
    );
};

const AchievementBadge = ({ emoji, label, desc, xp, unlocked }) => (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center relative ${unlocked ? 'bg-white border-amber-300 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
        <span className={`text-2xl ${unlocked ? '' : 'grayscale'}`}>{emoji}</span>
        <p className={`text-xs font-bold leading-tight ${unlocked ? 'text-gray-800' : 'text-gray-400'}`}>{label}</p>
        <p className="text-xs text-gray-400 leading-tight">{desc}</p>
        <div className={`text-xs font-black mt-0.5 ${unlocked ? 'text-amber-600' : 'text-gray-300'}`}>+{xp} XP</div>
        {unlocked && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
    </div>
);

export default function GamifiedMyRank() {
    const [userProfile, setUserProfile] = useState(null);
    const [studyStats, setStudyStats] = useState({ totalStudyTime: 0, weeklyStudyTime: 0 });
    const [completedGoals, setCompletedGoals] = useState(0);
    const [quizStats, setQuizStats] = useState({ total: 0, avgScore: 0 });
    const [flashcardStats, setFlashcardStats] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const user = await base44.auth.me();
            const [profile, studySessions, goals, quizAttempts, flashcards] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: user.email }).then(d => d[0] || null),
                base44.entities.StudyTechnique.filter({ created_by: user.email }),
                base44.entities.Goal.filter({ created_by: user.email, is_completed: true }),
                base44.entities.QuizAttempt.filter({ created_by: user.email }),
                base44.entities.Flashcard.filter({ created_by: user.email }),
            ]);
            setUserProfile(profile);
            setCompletedGoals(goals.length);
            setFlashcardStats(flashcards.length);

            const now = new Date();
            const weekStart = startOfWeek(now);
            let total = 0, weekly = 0;
            studySessions.forEach(s => {
                const mins = s.session_duration || 0;
                total += mins;
                const d = new Date(s.date || s.created_date);
                if (d >= weekStart) weekly += mins;
            });
            setStudyStats({ totalStudyTime: total, weeklyStudyTime: weekly });

            if (quizAttempts.length) {
                const avg = quizAttempts.reduce((a, q) => a + (q.score || 0), 0) / quizAttempts.length;
                setQuizStats({ total: quizAttempts.length, avgScore: Math.round(avg) });
            }
        } catch (e) {
            console.error("Error loading rank data:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const fmt = (m) => {
        if (!m) return "0m";
        if (m < 60) return `${m}m`;
        return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="bg-gray-200 rounded-2xl animate-pulse h-44" />
                <div className="grid grid-cols-2 gap-3">
                    {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-20" />)}
                </div>
            </div>
        );
    }

    const totalXP = userProfile?.total_xp || 0;
    const seasonXP = userProfile?.season_xp || 0;
    const streakDays = userProfile?.streak_days || 0;

    const achievements = [
        { emoji: "🔥", label: "Streak Starter",    desc: "7-day streak",     xp: 200,  unlocked: streakDays >= 7 },
        { emoji: "💥", label: "Streak Hunter",     desc: "30-day streak",    xp: 750,  unlocked: streakDays >= 30 },
        { emoji: "👑", label: "Streak Legend",     desc: "100-day streak",   xp: 3000, unlocked: streakDays >= 100 },
        { emoji: "🧠", label: "Quiz Machine",      desc: "100 quizzes done", xp: 500,  unlocked: quizStats.total >= 100 },
        { emoji: "⚡", label: "Quiz Master",       desc: "Avg score 95%+",   xp: 1000, unlocked: quizStats.avgScore >= 95 },
        { emoji: "🃏", label: "Card Collector",    desc: "500 flashcards",   xp: 400,  unlocked: flashcardStats >= 500 },
        { emoji: "🎯", label: "Goal Crusher",      desc: "20 goals done",    xp: 600,  unlocked: completedGoals >= 20 },
        { emoji: "⏱️", label: "Iron Student",      desc: "500hrs of study",  xp: 2000, unlocked: studyStats.totalStudyTime >= 30000 },
        { emoji: "🏆", label: "Elite Scholar",     desc: "10,000 total XP",  xp: 1500, unlocked: totalXP >= 10000 },
        { emoji: "🚀", label: "Study Rocket",      desc: "50hrs in a week",  xp: 800,  unlocked: studyStats.weeklyStudyTime >= 3000 },
        { emoji: "💎", label: "Diamond Mind",      desc: "Reach Level 50",   xp: 5000, unlocked: (userProfile?.current_level || 0) >= 50 },
        { emoji: "🌟", label: "Century Quizzes",   desc: "200 quizzes done", xp: 2500, unlocked: quizStats.total >= 200 },
    ];

    return (
        <div className="space-y-5">
            {/* XP Card */}
            <XPLevelCard totalXP={totalXP} seasonXP={seasonXP} streakDays={streakDays} />

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon={Zap}      value={totalXP.toLocaleString()}           label="Total XP"           color="bg-amber-500"   delay={0.04} />
                <StatCard icon={Flame}    value={`${streakDays}d`}                    label="Study Streak"       color="bg-orange-500"  delay={0.08}
                    sub={streakDays >= 7 ? `${streakDays >= 30 ? '2.5' : streakDays >= 21 ? '2.0' : streakDays >= 14 ? '1.75' : '1.5'}× XP mult.` : 'Keep going!'} />
                <StatCard icon={Target}   value={completedGoals}                      label="Goals Completed"    color="bg-emerald-500" delay={0.16} />
                <StatCard icon={Clock}    value={fmt(studyStats.totalStudyTime)}      label="Total Study Time"   color="bg-blue-500"    delay={0.2} />
                <StatCard icon={TrendingUp} value={fmt(studyStats.weeklyStudyTime)}   label="This Week"          color="bg-pink-500"    delay={0.24} />
            </div>

            {/* Achievements */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-gray-900 text-sm">Achievements</h3>
                    <Badge className="bg-amber-100 text-amber-700 border-0 text-xs ml-auto">
                        {achievements.filter(a => a.unlocked).length}/{achievements.length} unlocked
                    </Badge>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {achievements.map((a, i) => <AchievementBadge key={i} {...a} />)}
                </div>
            </motion.div>

            {/* Daily Missions */}
            <DailyMissions streakDays={streakDays} userProfile={userProfile} />

            {/* Streak Multiplier */}
            <StreakMultiplier streakDays={streakDays} />

            {/* XP Sources */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Gamepad2 className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-gray-900 text-sm">How to Earn XP</h3>
                    <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs ml-auto">Streak mult. applies to all</Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    {[
                        ["⏱️ Study sessions", "1 XP/min"],
                        ["🃏 Flashcards", "0.5 XP/card"],
                        ["📝 Quizzes", "2 XP/mark"],
                        ["🎯 Sub-goals", "40–195 XP"],
                        ["🏆 Full goals", "240–540 XP"],
                        ["💰 Score wagers", "up to 3.5×"],
                        ["🔥 Daily streak", "15–100 XP"],
                        ["🏫 Competitions", "Bonus XP"],
                    ].map(([label, xp]) => (
                        <div key={label} className="flex justify-between items-center bg-white/70 rounded-xl px-3 py-2">
                            <span className="text-gray-700 text-xs">{label}</span>
                            <span className="font-black text-indigo-700 text-xs">{xp}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}