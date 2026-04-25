import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Target, Flame, Brain, BookOpen, Clock, Trophy, CheckCircle2, Star, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fireXPFeedback } from "./XPFeedback";

const MISSION_TEMPLATES = [
    { id: "study_30", icon: Clock, label: "Study Session", desc: "Study for 30 minutes", xp: 50, color: "bg-blue-500", check: (stats) => stats.todayStudyMins >= 30 },
    { id: "study_60", icon: Clock, label: "Deep Focus", desc: "Study for 60 minutes", xp: 100, color: "bg-blue-600", check: (stats) => stats.todayStudyMins >= 60 },
    { id: "flashcard_20", icon: BookOpen, label: "Flashcard Sprint", desc: "Review 20 flashcards", xp: 40, color: "bg-green-500", check: (stats) => stats.todayFlashcards >= 20 },
    { id: "quiz_1", icon: Brain, label: "Quiz Warrior", desc: "Complete any quiz", xp: 45, color: "bg-purple-500", check: (stats) => stats.todayQuizzes >= 1 },
    { id: "quiz_80", icon: Star, label: "Quiz Ace", desc: "Score 80%+ on a quiz", xp: 70, color: "bg-indigo-500", check: (stats) => stats.todayQuizScore >= 80 },
    { id: "streak", icon: Flame, label: "Streak Keeper", desc: "Maintain your streak today", xp: 30, color: "bg-orange-500", check: (stats) => stats.streak >= 1 },
    { id: "goal_progress", icon: Target, label: "Goal Grinder", desc: "Complete a sub-goal", xp: 60, color: "bg-emerald-500", check: (stats) => stats.todaySubGoals >= 1 },
    { id: "study_45", icon: Clock, label: "Study Block", desc: "Study for 45 minutes", xp: 75, color: "bg-cyan-500", check: (stats) => stats.todayStudyMins >= 45 },
];

function getDailyMissions() {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('dailyMissions');
    if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
            // Re-attach check functions from templates (lost on JSON serialization)
            parsed.missions = parsed.missions.map(m => {
                const template = MISSION_TEMPLATES.find(t => t.id === m.id);
                return template ? { ...m, ...template, completed: m.completed, claimedXP: m.claimedXP } : m;
            });
            return parsed;
        }
    }
    // Pick 3 random missions
    const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
    const missions = shuffled.slice(0, 3).map(m => ({ ...m, completed: false, claimedXP: false }));
    const data = { date: today, missions, bonusClaimed: false };
    localStorage.setItem('dailyMissions', JSON.stringify(data));
    return data;
}

function saveMissions(data) {
    localStorage.setItem('dailyMissions', JSON.stringify(data));
}

function getTimeUntilReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
}

export default function DailyMissions({ streakDays = 0, userProfile }) {
    const [missionData, setMissionData] = useState(null);
    const [stats, setStats] = useState({});
    const [claimingId, setClaimingId] = useState(null);

    useEffect(() => {
        const data = getDailyMissions();
        setMissionData(data);
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const user = await base44.auth.me();
            const today = new Date().toISOString().split('T')[0];
            const [sessions, flashcards, quizAttempts, subGoals] = await Promise.all([
                base44.entities.StudyTechnique.filter({ created_by: user.email }).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: user.email }).catch(() => []),
                base44.entities.QuizAttempt.filter({ created_by: user.email }).catch(() => []),
                base44.entities.Goal.filter({ created_by: user.email }).catch(() => []),
            ]);
            const todaySessions = sessions.filter(s => (s.date || s.created_date?.split('T')[0]) === today);
            const todayMins = todaySessions.reduce((a, s) => a + (s.session_duration || 0), 0);
            const todayQuizzes = quizAttempts.filter(a => (a.date || a.created_date?.split('T')[0]) === today);
            const maxScore = todayQuizzes.length ? Math.max(...todayQuizzes.map(q => q.score || 0)) : 0;
            setStats({
                todayStudyMins: todayMins,
                todayFlashcards: flashcards.filter(f => f.lastReviewedDate === today).length,
                todayQuizzes: todayQuizzes.length,
                todayQuizScore: maxScore,
                streak: streakDays,
                todaySubGoals: 0
            });
        } catch {}
    };

    const handleClaim = async (mission, index) => {
        if (!mission.check(stats) || mission.claimedXP) return;
        setClaimingId(mission.id);
        try {
            const challengeTypeMap = {
                study_30: 'focus_session', study_45: 'focus_session', study_60: 'focus_session',
                flashcard_20: 'flashcard_sprint', quiz_1: 'mini_test', quiz_80: 'mini_test',
                streak: 'focus_session', goal_progress: 'focus_session',
            };
            const eventKey = `daily_mission_${mission.id}_${new Date().toDateString().replace(/\s/g, '_')}`;
            const res = await base44.functions.invoke('awardXP', {
                source: 'challenge',
                event_key: eventKey,
                challenge_type: challengeTypeMap[mission.id] || 'focus_session',
                difficulty: 'proficient',
            });
            const awarded = res?.data?.xp_awarded || mission.xp;
            fireXPFeedback({ xp_awarded: awarded, source: 'challenge' }, 'challenge');
            const newData = { ...missionData };
            newData.missions[index].claimedXP = true;
            newData.missions[index].completed = true;
            const allDone = newData.missions.every(m => m.claimedXP);
            if (allDone && !newData.bonusClaimed) {
                newData.bonusClaimed = false; // will prompt
            }
            saveMissions(newData);
            setMissionData({ ...newData });
        } catch {}
        finally { setClaimingId(null); }
    };

    const handleBonusClaim = async () => {
        if (missionData.bonusClaimed) return;
        try {
            const eventKey = `daily_bonus_${new Date().toDateString().replace(/\s/g, '_')}`;
            await base44.functions.invoke('awardXP', {
                source: 'challenge',
                event_key: eventKey,
                challenge_type: 'focus_session',
                difficulty: 'advanced',
            });
            fireXPFeedback({ xp_awarded: 150, source: 'challenge' }, 'challenge');
            const newData = { ...missionData, bonusClaimed: true };
            saveMissions(newData);
            setMissionData(newData);
        } catch {}
    };

    if (!missionData) return null;

    const completedCount = missionData.missions.filter(m => m.claimedXP).length;
    const allComplete = completedCount === 3;
    const totalXP = missionData.missions.reduce((a, m) => a + m.xp, 0) + 150;

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            <h3 className="font-black text-base">Daily Missions</h3>
                            <Badge className="bg-white/20 text-white border-0 text-xs">{completedCount}/3</Badge>
                        </div>
                        <p className="text-white/70 text-xs mt-0.5">Resets in {getTimeUntilReset()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black">{totalXP}</p>
                        <p className="text-white/70 text-xs">XP available</p>
                    </div>
                </div>
                <Progress value={(completedCount / 3) * 100} className="h-2 bg-white/20" />
            </div>

            {/* Missions */}
            <div className="space-y-2">
                {missionData.missions.map((mission, i) => {
                    const isComplete = mission.check(stats);
                    const isClaimed = mission.claimedXP;
                    const Icon = mission.icon;
                    const progress = Math.min(100, (() => {
                        if (mission.id === 'study_30') return Math.min(100, (stats.todayStudyMins || 0) / 30 * 100);
                        if (mission.id === 'study_45') return Math.min(100, (stats.todayStudyMins || 0) / 45 * 100);
                        if (mission.id === 'study_60') return Math.min(100, (stats.todayStudyMins || 0) / 60 * 100);
                        if (mission.id === 'flashcard_20') return Math.min(100, (stats.todayFlashcards || 0) / 20 * 100);
                        if (mission.id === 'quiz_1') return stats.todayQuizzes > 0 ? 100 : 0;
                        if (mission.id === 'quiz_80') return Math.min(100, (stats.todayQuizScore || 0) / 80 * 100);
                        if (mission.id === 'streak') return stats.streak > 0 ? 100 : 0;
                        return 0;
                    })());

                    return (
                        <motion.div key={mission.id}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            className={`bg-white rounded-2xl border-2 p-4 flex items-center gap-3 transition-all ${
                                isClaimed ? 'border-green-200 bg-green-50' : isComplete ? 'border-violet-300 bg-violet-50 shadow-md' : 'border-gray-100'
                            }`}>
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isClaimed ? 'bg-green-500' : mission.color}`}>
                                {isClaimed ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Icon className="w-5 h-5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className={`text-sm font-bold ${isClaimed ? 'text-green-700 line-through opacity-60' : 'text-gray-900'}`}>{mission.label}</p>
                                    <Badge className={`text-xs border-0 ${isClaimed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>+{mission.xp} XP</Badge>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{mission.desc}</p>
                                {!isClaimed && (
                                    <div className="mt-1.5">
                                        <Progress value={progress} className="h-1.5" />
                                    </div>
                                )}
                            </div>
                            {!isClaimed && (
                                <Button size="sm" onClick={() => handleClaim(mission, i)}
                                    disabled={!isComplete || claimingId === mission.id}
                                    className={`h-8 text-xs flex-shrink-0 ${isComplete ? 'bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                    {claimingId === mission.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : isComplete ? 'Claim!' : 'Locked'}
                                </Button>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Bonus Chest */}
            <AnimatePresence>
                {allComplete && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className={`rounded-2xl p-4 text-center border-2 ${missionData.bonusClaimed ? 'bg-gray-50 border-gray-200' : 'bg-gradient-to-r from-amber-400 to-orange-500 border-amber-300'}`}>
                        {missionData.bonusClaimed ? (
                            <p className="text-sm text-gray-500 font-semibold">🎁 Daily bonus claimed! Come back tomorrow.</p>
                        ) : (
                            <>
                                <p className="text-white font-black text-base mb-1">🎁 All Missions Complete!</p>
                                <p className="text-white/80 text-xs mb-3">Claim your completion bonus</p>
                                <Button onClick={handleBonusClaim} className="bg-white text-amber-700 hover:bg-amber-50 font-black text-sm shadow-lg">
                                    <Trophy className="w-4 h-4 mr-1.5" />Claim +150 XP Bonus
                                </Button>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}