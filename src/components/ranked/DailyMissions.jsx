import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Target, Flame, Brain, BookOpen, Clock, Trophy, CheckCircle2, Star, RefreshCw, Gift } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fireXPFeedback } from "./XPFeedback";

// Pre-resolved Tailwind class strings — required so the JIT can detect them at build time.
const ACCENT_CLASSES = {
    primary:   { bg5: "bg-primary/5",   bg10: "bg-primary/10", border: "border-primary/30", text: "text-primary" },
    xp:        { bg5: "bg-xp/5",        bg10: "bg-xp/10",      border: "border-xp/30",      text: "text-xp" },
    streak:    { bg5: "bg-streak/5",    bg10: "bg-streak/10",  border: "border-streak/30",  text: "text-streak" },
    "chart-3": { bg5: "bg-chart-3/5",   bg10: "bg-chart-3/10", border: "border-chart-3/30", text: "text-chart-3" },
    "chart-4": { bg5: "bg-chart-4/5",   bg10: "bg-chart-4/10", border: "border-chart-4/30", text: "text-chart-4" },
};

const MISSION_TEMPLATES = [
    { id: "study_30",     icon: Clock,    label: "Study Session",    desc: "Study for 30 minutes",   xp: 50,  accent: "chart-3", check: (stats) => stats.todayStudyMins >= 30 },
    { id: "study_60",     icon: Clock,    label: "Deep Focus",       desc: "Study for 60 minutes",   xp: 100, accent: "chart-3", check: (stats) => stats.todayStudyMins >= 60 },
    { id: "flashcard_20", icon: BookOpen, label: "Flashcard Sprint", desc: "Review 20 flashcards",   xp: 40,  accent: "primary", check: (stats) => stats.todayFlashcards >= 20 },
    { id: "quiz_1",       icon: Brain,    label: "Quiz Warrior",     desc: "Complete any quiz",      xp: 45,  accent: "chart-4", check: (stats) => stats.todayQuizzes >= 1 },
    { id: "quiz_80",      icon: Star,     label: "Quiz Ace",         desc: "Score 80%+ on a quiz",   xp: 70,  accent: "chart-4", check: (stats) => stats.todayQuizScore >= 80 },
    { id: "streak",       icon: Flame,    label: "Streak Keeper",    desc: "Maintain your streak today", xp: 30, accent: "streak", check: (stats) => stats.streak >= 1 },
    { id: "goal_progress",icon: Target,   label: "Goal Grinder",     desc: "Complete a sub-goal",    xp: 60,  accent: "primary", check: (stats) => stats.todaySubGoals >= 1 },
    { id: "study_45",     icon: Clock,    label: "Study Block",      desc: "Study for 45 minutes",   xp: 75,  accent: "chart-3", check: (stats) => stats.todayStudyMins >= 45 },
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

export default function DailyMissions({ streakDays = 0 }) {
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
            const maxScore = todayQuizzes.length ? Math.max(...todayQuizzes.map(q => (q.adjusted_score ?? q.score) || 0)) : 0;
            setStats({
                todayStudyMins: todayMins,
                todayFlashcards: flashcards.filter(f => f.last_reviewed_date === today).length,
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
            <div className="card-soft p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                            <Target className="w-5 h-5 text-chart-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-display font-extrabold text-foreground text-base">Daily Missions</h3>
                                <span className="pill bg-chart-4/15 text-chart-4">{completedCount}/3</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Resets in {getTimeUntilReset()}.</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-display font-extrabold text-foreground">{totalXP}</p>
                        <p className="stat-label">XP available</p>
                    </div>
                </div>
                <Progress value={(completedCount / 3) * 100} className="h-2" />
            </div>

            {/* Missions */}
            <div className="space-y-2">
                {missionData.missions.map((mission, i) => {
                    const isComplete = mission.check(stats);
                    const isClaimed = mission.claimedXP;
                    const Icon = mission.icon;
                    const accent = mission.accent;
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

                    const cls = ACCENT_CLASSES[accent] || ACCENT_CLASSES.primary;
                    return (
                        <motion.div key={mission.id}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            className={`card-soft p-4 flex items-center gap-3 transition-all ${
                                isClaimed
                                    ? 'bg-primary/5 border-primary/30'
                                    : isComplete
                                        ? `${cls.bg5} ${cls.border}`
                                        : ''
                            }`}>
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isClaimed ? 'bg-primary/15' : cls.bg10
                            }`}>
                                {isClaimed
                                    ? <CheckCircle2 className="w-5 h-5 text-primary" />
                                    : <Icon className={`w-5 h-5 ${cls.text}`} />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className={`text-sm font-bold ${isClaimed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{mission.label}</p>
                                    <span className={`pill ${isClaimed ? 'bg-primary/15 text-primary' : 'bg-xp/15 text-xp'}`}>+{mission.xp} XP</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{mission.desc}</p>
                                {!isClaimed && (
                                    <div className="mt-2">
                                        <Progress value={progress} className="h-1.5" />
                                    </div>
                                )}
                            </div>
                            {!isClaimed && (
                                <Button
                                    size="sm"
                                    onClick={() => handleClaim(mission, i)}
                                    disabled={!isComplete || claimingId === mission.id}
                                    variant={isComplete ? 'default' : 'outline'}
                                    className="flex-shrink-0"
                                >
                                    {claimingId === mission.id
                                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        : isComplete ? 'Claim' : 'Locked'
                                    }
                                </Button>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Bonus Chest */}
            <AnimatePresence>
                {allComplete && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`card-soft p-5 ${missionData.bonusClaimed ? '' : 'bg-xp/5 border-xp/30'}`}
                    >
                        {missionData.bonusClaimed ? (
                            <div className="flex items-center justify-center gap-2">
                                <Gift className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground font-semibold">Daily bonus claimed. Come back tomorrow.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-xp/15 flex items-center justify-center flex-shrink-0">
                                        <Gift className="w-5 h-5 text-xp" />
                                    </div>
                                    <div>
                                        <p className="font-display font-extrabold text-foreground text-base">All missions complete</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Claim your completion bonus.</p>
                                    </div>
                                </div>
                                <Button onClick={handleBonusClaim} className="flex-shrink-0">
                                    <Trophy className="w-4 h-4" />
                                    Claim +150 XP
                                </Button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
