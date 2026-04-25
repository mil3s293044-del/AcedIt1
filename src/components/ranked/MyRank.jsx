import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Clock, Flame, Target, Trophy, Zap, TrendingUp } from "lucide-react";
import { startOfWeek } from 'date-fns';
import XPLevelCard from "./XPLevelCard";

const StatPill = ({ icon, value, label, color, delay }) => {
    const Icon = icon;
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
            className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
        </motion.div>
    );
};

export default function MyRank() {
    const [userProfile, setUserProfile] = useState(null);
    const [studyStats, setStudyStats] = useState({ totalStudyTime: 0, weeklyStudyTime: 0 });
    const [completedGoals, setCompletedGoals] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const user = await base44.auth.me();
            const [profile, studySessions, goals] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: user.email }).then(d => d[0] || null),
                base44.entities.StudyTechnique.filter({ created_by: user.email }),
                base44.entities.Goal.filter({ created_by: user.email, is_completed: true }),
            ]);
            setUserProfile(profile);
            setCompletedGoals(goals.length);

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
        } catch (e) {
            console.error("Error loading rank data:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const fmt = (m) => {
        if (!m) return "0m";
        if (m < 60) return `${m}m`;
        return `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ''}`.trim();
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="bg-gray-200 rounded-2xl animate-pulse h-44" />
                <div className="grid grid-cols-2 gap-3">
                    {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-16" />)}
                </div>
            </div>
        );
    }

    const totalXP = userProfile?.total_xp || 0;
    const seasonXP = userProfile?.season_xp || 0;
    const streakDays = userProfile?.streak_days || 0;

    return (
        <div className="space-y-5">
            <XPLevelCard totalXP={totalXP} seasonXP={seasonXP} streakDays={streakDays} />

            <div className="grid grid-cols-2 gap-3">
                <StatPill icon={Zap}      value={totalXP.toLocaleString()}           label="Total XP"         color="bg-amber-500"   delay={0.05} />
                <StatPill icon={Flame}    value={`${streakDays}d`}                    label="Study Streak"     color="bg-orange-500"  delay={0.1} />
                <StatPill icon={Target}   value={completedGoals}                      label="Goals Completed"  color="bg-emerald-500" delay={0.2} />
                <StatPill icon={Clock}    value={fmt(studyStats.totalStudyTime)}      label="Total Study Time" color="bg-blue-500"    delay={0.25} />
                <StatPill icon={TrendingUp} value={fmt(studyStats.weeklyStudyTime)}  label="This Week"        color="bg-pink-500"    delay={0.3} />
            </div>

            {/* XP Sources */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-gray-900 text-sm">How to Earn XP</h3>
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
                        <div key={label} className="flex justify-between items-center bg-white/70 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-700 text-xs">{label}</span>
                            <span className="font-bold text-indigo-700 text-xs">{xp}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}