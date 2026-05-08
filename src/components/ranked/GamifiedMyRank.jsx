import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
    Clock, Flame, Target, Trophy, Zap, TrendingUp, Crown, Star, Gamepad2,
    Brain, Layers, Rocket, Gem, Medal, Check
} from "lucide-react";
import { startOfWeek } from 'date-fns';
import XPLevelCard from "./XPLevelCard";
import StreakMultiplier from "./StreakMultiplier";
import DailyMissions from "./DailyMissions";

// Pre-resolved Tailwind class strings — required so the JIT can detect them at build time.
const ACCENT_CLASSES = {
    primary:   { bg10: "bg-primary/10",  text: "text-primary" },
    xp:        { bg10: "bg-xp/10",       text: "text-xp" },
    streak:    { bg10: "bg-streak/10",   text: "text-streak" },
    "chart-3": { bg10: "bg-chart-3/10",  text: "text-chart-3" },
    "chart-4": { bg10: "bg-chart-4/10",  text: "text-chart-4" },
};

const StatCard = ({ icon, value, label, accent, delay, sub }) => {
    const Icon = icon;
    const cls = ACCENT_CLASSES[accent] || ACCENT_CLASSES.primary;
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="card-soft card-soft-hover p-4"
        >
            <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${cls.bg10} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${cls.text}`} />
                </div>
            </div>
            <p className="text-2xl font-display font-extrabold text-foreground leading-none">{value}</p>
            <p className="stat-label mt-1">{label}</p>
            {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
        </motion.div>
    );
};

const AchievementBadge = ({ icon, label, desc, xp, unlocked }) => {
    const Icon = icon;
    return (
        <div
            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                unlocked
                    ? 'bg-xp/5 border-xp/30'
                    : 'bg-secondary/50 border-transparent opacity-50'
            }`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                unlocked ? 'bg-xp/15' : 'bg-secondary'
            }`}>
                <Icon className={`w-5 h-5 ${unlocked ? 'text-xp' : 'text-muted-foreground/60'}`} />
            </div>
            <p className={`text-xs font-bold leading-tight ${unlocked ? 'text-foreground' : 'text-muted-foreground/60'}`}>{label}</p>
            <p className="text-[11px] text-muted-foreground/60 leading-tight">{desc}</p>
            <div className={`text-xs font-display font-extrabold mt-0.5 ${unlocked ? 'text-xp' : 'text-muted-foreground/60'}`}>+{xp} XP</div>
            {unlocked && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-xp rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            )}
        </div>
    );
};

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
                <div className="card-soft animate-pulse h-44" />
                <div className="grid grid-cols-2 gap-3">
                    {[1,2,3,4].map(i => <div key={i} className="card-soft p-4 animate-pulse h-20" />)}
                </div>
            </div>
        );
    }

    const totalXP = userProfile?.total_xp || 0;
    const seasonXP = userProfile?.season_xp || 0;
    const streakDays = userProfile?.streak_days || 0;

    const achievements = [
        { icon: Flame,   label: "Streak Starter", desc: "7-day streak",     xp: 200,  unlocked: streakDays >= 7 },
        { icon: Zap,     label: "Streak Hunter",  desc: "30-day streak",    xp: 750,  unlocked: streakDays >= 30 },
        { icon: Crown,   label: "Streak Legend",  desc: "100-day streak",   xp: 3000, unlocked: streakDays >= 100 },
        { icon: Brain,   label: "Quiz Machine",   desc: "100 quizzes done", xp: 500,  unlocked: quizStats.total >= 100 },
        { icon: Zap,     label: "Quiz Master",    desc: "Avg score 95%+",   xp: 1000, unlocked: quizStats.avgScore >= 95 },
        { icon: Layers,  label: "Card Collector", desc: "500 flashcards",   xp: 400,  unlocked: flashcardStats >= 500 },
        { icon: Target,  label: "Goal Crusher",   desc: "20 goals done",    xp: 600,  unlocked: completedGoals >= 20 },
        { icon: Clock,   label: "Iron Student",   desc: "500hrs of study",  xp: 2000, unlocked: studyStats.totalStudyTime >= 30000 },
        { icon: Trophy,  label: "Elite Scholar",  desc: "10,000 total XP",  xp: 1500, unlocked: totalXP >= 10000 },
        { icon: Rocket,  label: "Study Rocket",   desc: "50hrs in a week",  xp: 800,  unlocked: studyStats.weeklyStudyTime >= 3000 },
        { icon: Gem,     label: "Diamond Mind",   desc: "Reach Level 50",   xp: 5000, unlocked: (userProfile?.current_level || 0) >= 50 },
        { icon: Medal,   label: "Century Quizzes",desc: "200 quizzes done", xp: 2500, unlocked: quizStats.total >= 200 },
    ];

    return (
        <div className="space-y-5">
            {/* XP Card */}
            <XPLevelCard totalXP={totalXP} seasonXP={seasonXP} streakDays={streakDays} />

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon={Zap}        value={totalXP.toLocaleString()}         label="Total XP"         accent="xp"      delay={0.04} />
                <StatCard icon={Flame}      value={`${streakDays}d`}                 label="Study Streak"     accent="streak"  delay={0.08}
                    sub={streakDays >= 7 ? `${streakDays >= 30 ? '2.5' : streakDays >= 21 ? '2.0' : streakDays >= 14 ? '1.75' : '1.5'}× XP mult.` : 'Keep going!'} />
                <StatCard icon={Target}     value={completedGoals}                   label="Goals Completed"  accent="primary" delay={0.16} />
                <StatCard icon={Clock}      value={fmt(studyStats.totalStudyTime)}   label="Total Study Time" accent="chart-3" delay={0.2} />
                <StatCard icon={TrendingUp} value={fmt(studyStats.weeklyStudyTime)}  label="This Week"        accent="chart-4" delay={0.24} />
            </div>

            {/* Achievements */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                className="card-soft p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                        <Star className="w-5 h-5 text-xp" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display font-extrabold text-foreground text-base">Achievements</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Long-term milestones across every system.</p>
                    </div>
                    <span className="pill bg-xp/15 text-xp">
                        {achievements.filter(a => a.unlocked).length}/{achievements.length}
                    </span>
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
                className="card-soft p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                        <Gamepad2 className="w-5 h-5 text-chart-3" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display font-extrabold text-foreground text-base">How to Earn XP</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Streak multiplier applies to everything.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        ["Study sessions", "1 XP/min"],
                        ["Flashcards", "0.5 XP/card"],
                        ["Quizzes", "2 XP/mark"],
                        ["Sub-goals", "40–195 XP"],
                        ["Full goals", "240–540 XP"],
                        ["Score wagers", "up to 3.5×"],
                        ["Daily streak", "15–100 XP"],
                        ["Competitions", "Bonus XP"],
                    ].map(([label, xp]) => (
                        <div key={label} className="flex justify-between items-center bg-secondary/50 rounded-lg px-3 py-2">
                            <span className="text-foreground text-xs">{label}</span>
                            <span className="font-bold text-chart-3 text-xs">{xp}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
