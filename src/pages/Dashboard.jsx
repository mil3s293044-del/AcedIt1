import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock, BookOpen, Target, TrendingUp, ChevronRight,
    GraduationCap, Award, Zap, Flame, Brain, FileQuestion,
    Sparkles, Trophy, Calendar, AlertCircle, Play,
    BarChart3, CheckCircle2, Star, ArrowRight, Swords,
    Map, Users, LayoutDashboard
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, differenceInDays, parseISO } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import XPLevelCard from "@/components/ranked/XPLevelCard";
import HelpButton from "@/components/shared/HelpButton";
import StudyIntentModal from "@/components/dashboard/StudyIntentModal";

const formatStudyTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

// Hub sections — each with a clear purpose and visual hierarchy
const HUB_SECTIONS = [
    {
        id: "study",
        title: "Study",
        subtitle: "Start a session and build your skills",
        color: "from-emerald-500 to-teal-600",
        lightBg: "bg-emerald-50",
        border: "border-emerald-100",
        icon: Brain,
        actions: [
            { label: "Pomodoro Timer", desc: "25-min focus sessions", icon: Clock, link: "Study", emoji: "⏱️" },
            { label: "Flashcards", desc: "Spaced repetition", icon: Brain, link: "Study", emoji: "🃏" },
            { label: "Active Recall", desc: "Test your memory", icon: Zap, link: "Study", emoji: "💡" },
            { label: "Blurting", desc: "Brain dump method", icon: BookOpen, link: "Study", emoji: "✍️" },
        ]
    },
    {
        id: "test",
        title: "Test Yourself",
        subtitle: "Quizzes, AI questions & past papers",
        color: "from-indigo-500 to-purple-600",
        lightBg: "bg-indigo-50",
        border: "border-indigo-100",
        icon: FileQuestion,
        actions: [
            { label: "Take a Quiz", desc: "Multiple choice", icon: FileQuestion, link: "Quizzes", emoji: "🧠" },
            { label: "AI Tools", desc: "Generate questions", icon: Sparkles, link: "AITools", emoji: "⚡" },
            { label: "Study Roadmap", desc: "AI exam prep plan", icon: Map, link: "StudyRoadmap", emoji: "🗺️" },
        ]
    },
    {
        id: "track",
        title: "Track Progress",
        subtitle: "Goals, rank, and analytics",
        color: "from-amber-500 to-orange-600",
        lightBg: "bg-amber-50",
        border: "border-amber-100",
        icon: Trophy,
        actions: [
            { label: "My Goals", desc: "ATAR & milestones", icon: Target, link: "Goals", emoji: "🎯" },
            { label: "Ranked", desc: "XP & leaderboard", icon: Trophy, link: "Ranked", emoji: "🏆" },
            { label: "Analytics", desc: "Study insights", icon: BarChart3, link: "Analytics", emoji: "📊" },
        ]
    },
    {
        id: "social",
        title: "Compete & Connect",
        subtitle: "Challenge friends, climb rankings",
        color: "from-pink-500 to-rose-600",
        lightBg: "bg-pink-50",
        border: "border-pink-100",
        icon: Swords,
        actions: [
            { label: "Friends", desc: "Find & add friends", icon: Users, link: "Friends", emoji: "👥" },
            { label: "Compete", desc: "Score wagers & battles", icon: Swords, link: "Competitions", emoji: "⚔️" },
        ]
    }
];

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [studySessions, setStudySessions] = useState([]);
    const [studyTechniques, setStudyTechniques] = useState([]);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [flashcardReminders, setFlashcardReminders] = useState([]);
    const [plannerReminders, setPlannerReminders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showStudyIntent, setShowStudyIntent] = useState(false);

    const loadData = useCallback(async (userEmail) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const in14 = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
            const [profileData, sessionsData, techniquesData, quizData, assessmentData, flashcardData, plannerData] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: userEmail }).catch(() => []),
                base44.entities.StudySession.filter({ created_by: userEmail }, "-date", 30).catch(() => []),
                base44.entities.StudyTechnique.filter({ created_by: userEmail }, "-date").catch(() => []),
                base44.entities.QuizAttempt.filter({ created_by: userEmail }, "-date", 10).catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: userEmail, is_completed: false }, "due_date", 10).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: userEmail, is_active: true }, "nextReviewDate").catch(() => []),
                base44.entities.StudyPlan.filter({ created_by: userEmail, is_completed: false, date: { $gte: today, $lte: in14 } }, "date", 8).catch(() => []),
            ]);

            let profile = profileData[0] || null;
            if (!profile) {
                profile = await base44.entities.UserProfile.create({
                    onboarding_tasks: { username_set: false, subjects_selected: false, goals_set: false },
                    onboarding_completed: false
                }).catch(() => null);
            }

            setUserProfile(profile);
            setStudySessions(sessionsData || []);
            setStudyTechniques(techniquesData || []);
            setQuizAttempts(quizData || []);

            const upcoming = (assessmentData || []).filter(a => {
                const days = differenceInDays(parseISO(a.due_date), new Date());
                return days >= 0 && days <= 30;
            });
            setAssessments(upcoming);

            const urgentTypes = ['SAC', 'Exam', 'Test', 'Assignment', 'Oral', 'Folio', 'Performance'];
            const plannerEvents = (plannerData || [])
                .filter(e => urgentTypes.includes(e.event_type) || differenceInDays(parseISO(e.date), new Date()) <= 3)
                .slice(0, 5);
            setPlannerReminders(plannerEvents);

            const dueCards = (flashcardData || []).filter(c => c.nextReviewDate <= today);
            const deckMap = {};
            dueCards.forEach(card => {
                const key = card.deck_id || `${card.subject_name}_${card.topic}`;
                if (!deckMap[key]) deckMap[key] = { subject: card.subject_name, topic: card.topic, count: 0 };
                deckMap[key].count++;
            });
            setFlashcardReminders(Object.values(deckMap).slice(0, 3));
        } catch (err) {
            console.error("Dashboard load error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                await loadData(currentUser.email);
                const intentKey = `studyIntent_${format(new Date(), 'yyyy-MM-dd')}_${currentUser.email}`;
                if (!sessionStorage.getItem(intentKey)) {
                    setShowStudyIntent(true);
                    sessionStorage.setItem(intentKey, '1');
                }
            } catch {
                base44.auth.redirectToLogin(window.location.pathname);
            }
        };
        init();
    }, [loadData]);

    useEffect(() => {
        if (!user?.email) return;
        const unsub = base44.entities.StudySession.subscribe((event) => {
            if (event.data?.created_by !== user.email) return;
            setStudySessions(prev => {
                if (event.type === 'create') return [event.data, ...prev];
                if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                return prev;
            });
        });
        return unsub;
    }, [user]);

    const todaysStudyTime = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const s = studySessions.filter(s => s.date && format(new Date(s.date), 'yyyy-MM-dd') === today).reduce((a, s) => a + (s.duration_minutes || 0), 0);
        const t = studyTechniques.filter(s => s.date && format(new Date(s.date), 'yyyy-MM-dd') === today).reduce((a, s) => a + (s.session_duration || 0), 0);
        return s + t;
    }, [studySessions, studyTechniques]);

    const weeklyStudyTime = useMemo(() => {
        const weekStart = startOfWeek(new Date());
        const s = studySessions.filter(s => s.date && new Date(s.date) >= weekStart).reduce((a, s) => a + (s.duration_minutes || 0), 0);
        const t = studyTechniques.filter(s => s.date && new Date(s.date) >= weekStart).reduce((a, s) => a + (s.session_duration || 0), 0);
        return s + t;
    }, [studySessions, studyTechniques]);

    const avgQuizScore = useMemo(() => {
        if (!quizAttempts.length) return null;
        const recent = quizAttempts.slice(0, 5);
        return Math.round(recent.reduce((a, q) => a + (q.score || 0), 0) / recent.length);
    }, [quizAttempts]);

    const totalReminders = assessments.length + flashcardReminders.length + plannerReminders.length;
    const xp = userProfile?.total_xp || 0;
    const streakDays = userProfile?.streak_days || 0;
    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'there';
    const goalHours = userProfile?.weekly_study_goal_hours || 20;
    const weeklyPct = Math.min(100, Math.round((weeklyStudyTime / (goalHours * 60)) * 100));

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <AnimatePresence>
                {showStudyIntent && (
                    <StudyIntentModal
                        firstName={firstName}
                        onDismiss={() => setShowStudyIntent(false)}
                    />
                )}
            </AnimatePresence>

            <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-[1800px] mx-auto">

                {/* ── HERO ──────────────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-5 lg:p-8 shadow-xl border border-slate-700/50">
                    <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-slate-600/30 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <p className="text-white/60 text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
                            <HelpButton page="Dashboard" className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white" />
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight mb-1.5">
                            {getGreeting()}, {firstName} 👋
                        </h1>
                        <p className="text-white/75 text-sm mb-4">
                            {todaysStudyTime > 0
                                ? `You've studied ${formatStudyTime(todaysStudyTime)} today — keep the momentum going!`
                                : "What are you studying today? Pick a section below to get started."}
                        </p>

                        {/* Stat pills */}
                        <div className="flex flex-wrap gap-3">
                            {streakDays > 0 && (
                                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-2">
                                    <Flame className="w-4 h-4 text-orange-300" />
                                    <span className="text-white font-bold text-sm">{streakDays}d streak</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-2">
                                <Clock className="w-4 h-4 text-emerald-300" />
                                <span className="text-white font-bold text-sm">{todaysStudyTime > 0 ? formatStudyTime(todaysStudyTime) : "0m"} today</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-2">
                                <Zap className="w-4 h-4 text-yellow-300" />
                                <span className="text-white font-bold text-sm">{xp.toLocaleString()} XP</span>
                            </div>
                            {avgQuizScore != null && (
                                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-2">
                                    <BarChart3 className="w-4 h-4 text-pink-300" />
                                    <span className="text-white font-bold text-sm">Avg Quiz: {avgQuizScore}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* ── ALERTS / REMINDERS ────────────────────────────────────── */}
                {totalReminders > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertCircle className="w-5 h-5 text-orange-500" />
                                <h2 className="font-bold text-gray-900">Needs your attention</h2>
                                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs ml-1">{totalReminders}</Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {flashcardReminders.map((deck, i) => (
                                    <Link key={i} to={createPageUrl("Study")}>
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors cursor-pointer border border-violet-100">
                                            <span className="text-lg">🃏</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{deck.subject}</p>
                                                <p className="text-xs text-violet-600">{deck.count} flashcards due</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                        </div>
                                    </Link>
                                ))}
                                {plannerReminders.map((ev, i) => {
                                    const days = differenceInDays(parseISO(ev.date), new Date());
                                    const EVENT_EMOJIS = { SAC: '📋', Exam: '📝', Test: '✏️', Assignment: '📄', Oral: '🎤', Folio: '🗂️', Performance: '🎭' };
                                    return (
                                        <Link key={`plan-${ev.id}`} to={createPageUrl("Goals")}>
                                            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${days <= 1 ? 'bg-red-50 border-red-100 hover:bg-red-100' : 'bg-orange-50 border-orange-100 hover:bg-orange-100'}`}>
                                                <span className="text-lg">{EVENT_EMOJIS[ev.event_type] || '📌'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-gray-900 truncate">{ev.title}</p>
                                                    <p className="text-xs text-gray-500">{ev.event_type}</p>
                                                </div>
                                                <Badge className={`border-0 text-xs font-bold flex-shrink-0 ${days === 0 ? 'bg-red-600 text-white' : days <= 1 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                                                </Badge>
                                            </div>
                                        </Link>
                                    );
                                })}
                                {assessments.slice(0, 3).map((a) => {
                                    const days = differenceInDays(parseISO(a.due_date), new Date());
                                    return (
                                        <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${days <= 1 ? 'bg-red-50 border-red-100' : days <= 5 ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                                            <span className="text-lg">📅</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{a.title}</p>
                                                <p className="text-xs text-gray-500">{a.subject_name}</p>
                                            </div>
                                            <Badge className={`border-0 text-xs font-bold flex-shrink-0 ${days <= 1 ? 'bg-red-100 text-red-700' : days <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {days === 0 ? 'Today' : `${days}d`}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── HUB SECTIONS ──────────────────────────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {HUB_SECTIONS.map((section, sIdx) => (
                        <motion.div
                            key={section.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 + sIdx * 0.06 }}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                        >
                            {/* Section header */}
                            <div className={`flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r ${section.color}`}>
                                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                                    <section.icon className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white text-sm leading-tight">{section.title}</h2>
                                    <p className="text-white/70 text-xs hidden sm:block">{section.subtitle}</p>
                                </div>
                            </div>

                            {/* Action rows */}
                            <div className="p-3 space-y-1.5">
                                {section.actions.map((action, aIdx) => (
                                    <Link key={aIdx} to={createPageUrl(action.link)}>
                                        <motion.div
                                            whileHover={{ x: 2 }}
                                            whileTap={{ scale: 0.99 }}
                                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl ${section.lightBg} border ${section.border} hover:shadow-sm transition-all duration-150 cursor-pointer`}
                                        >
                                            <span className="text-lg leading-none">{action.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 text-sm leading-tight">{action.label}</p>
                                                <p className="text-gray-500 text-xs">{action.desc}</p>
                                            </div>
                                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </motion.div>
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* ── PROGRESS ROW ──────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                        {/* XP / Level */}
                        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-500" />
                                    <h2 className="font-bold text-gray-900">Rank & XP</h2>
                                </div>
                                <Link to={createPageUrl("Ranked")}>
                                    <Button variant="ghost" size="sm" className="text-purple-600 text-xs gap-1 rounded-xl">
                                        Full Rank <ArrowRight className="w-3 h-3" />
                                    </Button>
                                </Link>
                            </div>
                            <XPLevelCard totalXP={xp} streakDays={streakDays} compact />
                        </div>

                        {/* Weekly goal */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-5 h-5 text-amber-500" />
                                <h2 className="font-bold text-gray-900">Weekly Goal</h2>
                            </div>
                            <div>
                                <div className="flex items-end justify-between mb-2">
                                    <span className="text-2xl font-black text-gray-900">{formatStudyTime(weeklyStudyTime)}</span>
                                    <span className="text-sm text-gray-400">/ {goalHours}h</span>
                                </div>
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${weeklyPct}%` }}
                                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                                        className={`h-full rounded-full ${weeklyPct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                                    />
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-gray-400">{weeklyPct}% done</span>
                                    {weeklyPct >= 100 && <span className="text-xs text-emerald-600 font-bold">🎉 Goal hit!</span>}
                                </div>
                            </div>
                            <Link to={createPageUrl("Study")} className="mt-4">
                                <Button size="sm" className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 rounded-xl text-xs font-bold">
                                    <Play className="w-3.5 h-3.5 mr-1" /> Study Now
                                </Button>
                            </Link>
                        </div>
                    </div>
                </motion.div>

                {/* ── GOAL SNAPSHOT + RECENT SESSIONS ───────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        {/* ATAR / Goal */}
                        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-indigo-600" />
                                    <h2 className="font-bold text-gray-900">Your Goal</h2>
                                </div>
                                <Link to={createPageUrl("Goals")}>
                                    <Button variant="ghost" size="sm" className="text-indigo-600 text-xs gap-1 rounded-xl">
                                        Manage <ChevronRight className="w-3 h-3" />
                                    </Button>
                                </Link>
                            </div>
                            {userProfile?.goal_atar || userProfile?.goal_course_name ? (
                                <div className="space-y-3">
                                    {userProfile.goal_atar && (
                                        <div className="flex items-center gap-3 bg-white/70 rounded-xl p-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Award className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">Target ATAR</p>
                                                <p className="text-2xl font-black text-gray-900">{userProfile.goal_atar}</p>
                                            </div>
                                        </div>
                                    )}
                                    {userProfile.goal_course_name && (
                                        <div className="flex items-center gap-3 bg-white/70 rounded-xl p-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <GraduationCap className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-500 font-medium">Dream Course</p>
                                                <p className="font-bold text-gray-900 text-sm truncate">{userProfile.goal_course_name}</p>
                                                {userProfile.goal_university && <p className="text-xs text-gray-500 truncate">{userProfile.goal_university}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <Target className="w-12 h-12 text-indigo-200 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm mb-3">Set your ATAR target and dream course to stay motivated</p>
                                    <Link to={createPageUrl("Goals")}>
                                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs">Set Your Goal</Button>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Recent sessions */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-emerald-600" />
                                    <h2 className="font-bold text-gray-900">Recent Sessions</h2>
                                </div>
                                <Link to={createPageUrl("Study")}>
                                    <Button variant="ghost" size="sm" className="text-emerald-600 text-xs gap-1 rounded-xl">
                                        Study <ArrowRight className="w-3 h-3" />
                                    </Button>
                                </Link>
                            </div>
                            {studySessions.length === 0 ? (
                                <div className="text-center py-8">
                                    <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm mb-3">No sessions yet. Start studying!</p>
                                    <Link to={createPageUrl("Study")}>
                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs">
                                            <Play className="w-3.5 h-3.5 mr-1" /> Start Session
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {studySessions.slice(0, 4).map((session) => (
                                        <div key={session.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <BookOpen className="w-4 h-4 text-emerald-700" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 text-sm truncate">{session.subject}</p>
                                                <p className="text-xs text-gray-400">{session.duration_minutes}min · {format(new Date(session.date), 'MMM d')}</p>
                                            </div>
                                            {session.productivity_rating && (
                                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                                    {Array.from({ length: session.productivity_rating }).map((_, j) => (
                                                        <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* ── SETUP CHECKLIST (onboarding) ──────────────────────────── */}
                {userProfile && !userProfile.onboarding_completed && !(userProfile.onboarding_tasks?.username_set && userProfile.onboarding_tasks?.subjects_selected && userProfile.onboarding_tasks?.goals_set) && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Star className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-amber-900">Finish setting up your account</h3>
                                    <p className="text-amber-700 text-sm">Complete these to unlock the full experience</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {!userProfile.onboarding_tasks?.username_set && (
                                    <Link to={createPageUrl("Settings")}>
                                        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Set username
                                        </Button>
                                    </Link>
                                )}
                                {!userProfile.onboarding_tasks?.subjects_selected && (
                                    <Link to={createPageUrl("Subjects")}>
                                        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Add subjects
                                        </Button>
                                    </Link>
                                )}
                                {!userProfile.onboarding_tasks?.goals_set && (
                                    <Link to={createPageUrl("Goals")}>
                                        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Set goals
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

            </div>
        </div>
    );
}