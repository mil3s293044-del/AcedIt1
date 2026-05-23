import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock, BookOpen, Target, ChevronRight, ArrowRight,
    GraduationCap, Zap, Flame, Brain, FileQuestion,
    Sparkles, Trophy, Play, Layers, Timer, Users,
    Map, Swords, BarChart3, Star, CheckCircle2, AlertTriangle,
    TrendingUp, Crown, Medal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, differenceInDays, parseISO, isToday, isYesterday, formatDistanceToNow, subDays, isSameDay } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import HelpButton from "@/components/shared/HelpButton";
import StudyIntentModal from "@/components/dashboard/StudyIntentModal";
import EmptyState from "@/components/shared/EmptyState";
import { reconcileUserXP } from "@/lib/reconcileXP";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60);
    const mm = Math.round(m % 60);
    if (h === 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
};

const fmtXP = (n) => (n || 0).toLocaleString();

function getStreakMultiplier(days) {
    if (days >= 30) return "2.5×";
    if (days >= 21) return "2.0×";
    if (days >= 14) return "1.75×";
    if (days >= 7)  return "1.5×";
    if (days >= 3)  return "1.2×";
    return "1.0×";
}

function getNextStreakMilestone(days) {
    const tiers = [
        { at: 3,   mult: "1.2×" },
        { at: 7,   mult: "1.5×" },
        { at: 14,  mult: "1.75×" },
        { at: 21,  mult: "2.0×" },
        { at: 30,  mult: "2.5×" },
    ];
    for (const t of tiers) if (days < t.at) return { ...t, away: t.at - days };
    return null;
}

// Coach voice — chill, supportive, motivational. Specific not generic.
function getCoachLine({ name, hour, streakDays, todayMins, studiedYesterday, dueFlashcards, urgentDays }) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";

    if (urgentDays !== null && urgentDays === 0) {
        return `${period}, ${name}. You've got something due today — let's tackle it.`;
    }
    if (streakDays >= 30 && todayMins > 0) {
        return `${period}, ${name}. ${streakDays} days deep and still showing up. Keep cooking.`;
    }
    if (streakDays >= 7 && todayMins === 0 && hour >= 17) {
        return `${period}, ${name}. Quick session keeps your ${streakDays}-day streak going.`;
    }
    if (streakDays >= 30) {
        return `${period}, ${name}. ${streakDays} days deep. You're built different now.`;
    }
    if (streakDays === 0 && todayMins === 0 && !studiedYesterday) {
        return `${period}, ${name}. Today's a great day to start a streak.`;
    }
    if (todayMins >= 90) {
        return `${period}, ${name}. ${fmtTime(todayMins)} in already. Big day shaping up.`;
    }
    if (todayMins >= 30) {
        return `${period}, ${name}. ${fmtTime(todayMins)} down. Want to stack another?`;
    }
    if (todayMins > 0) {
        return `${period}, ${name}. Nice start — keep building.`;
    }
    if (hour >= 17) {
        return `${period}, ${name}. Even 25 minutes makes today count.`;
    }
    if (dueFlashcards >= 10) {
        return `${period}, ${name}. ${dueFlashcards} flashcards waiting — quick review wins the day.`;
    }
    return `${period}, ${name}. Let's make today count.`;
}

function getStreakBlurb(streakDays) {
    if (streakDays === 0) return null;
    if (streakDays === 1) return "First day down. The next one is the test.";
    if (streakDays < 7)   return `${streakDays} days strong. Almost at your XP boost.`;
    if (streakDays < 14)  return `${streakDays} days in. You're past the dabblers.`;
    if (streakDays < 30)  return `${streakDays}-day streak. Top 5% of users this month.`;
    if (streakDays < 100) return `${streakDays} days deep. This is who you are now.`;
    return `${streakDays} days. Different breed.`;
}

function getTodaysMove({ todayMins, streakDays, dueFlashcards, urgentDays, urgentTitle, hour }) {
    if (urgentDays !== null && urgentDays <= 3) {
        return {
            label: urgentDays === 0 ? "Today's deadline" : `In ${urgentDays} day${urgentDays === 1 ? '' : 's'}`,
            title: urgentTitle ? `${urgentTitle} is coming up` : "You've got a deadline incoming",
            sub: "Open the planner and let's get a plan together.",
            cta: "See planner",
            link: "Goals",
            accent: "streak",
            icon: AlertTriangle,
        };
    }
    if (dueFlashcards >= 10) {
        return {
            label: "Cards waiting",
            title: `${dueFlashcards} flashcards ready for review`,
            sub: "Quick session and you're back on track with spaced rep.",
            cta: "Review now",
            link: "Study",
            accent: "chart-3",
            icon: Layers,
        };
    }
    if (streakDays > 0 && todayMins === 0 && hour >= 18) {
        return {
            label: "Streak protection",
            title: `Quick session keeps your ${streakDays}-day streak alive`,
            sub: `${24 - hour} hours left — a Pomodoro is all it takes.`,
            cta: "Start a Pomodoro",
            link: "Study",
            accent: "streak",
            icon: Timer,
        };
    }
    if (todayMins === 0) {
        return {
            label: "Easiest start",
            title: "A 25-minute Pomodoro is the easiest win today",
            sub: "Show up, stay focused, walk away with momentum.",
            cta: "Start a Pomodoro",
            link: "Study",
            accent: "primary",
            icon: Timer,
        };
    }
    if (todayMins < 60) {
        return {
            label: "Lock it in",
            title: "Good start — let's test what you remember",
            sub: "Active recall locks in what passive reading misses.",
            cta: "Take a quiz",
            link: "Quizzes",
            accent: "xp",
            icon: Brain,
        };
    }
    return {
        label: "Stack the win",
        title: "You've got momentum — let's make it count",
        sub: "Generate exam questions or hit your weak topics.",
        cta: "Open AI tools",
        link: "AITools",
        accent: "chart-4",
        icon: Sparkles,
    };
}

const MOVE_THEME = {
    primary:   { bg: "bg-primary/10",   border: "border-primary/25",   iconBg: "bg-primary/15",   iconText: "text-primary"   },
    streak:    { bg: "bg-streak/10",    border: "border-streak/25",    iconBg: "bg-streak/15",    iconText: "text-streak"    },
    xp:        { bg: "bg-xp/10",        border: "border-xp/25",        iconBg: "bg-xp/15",        iconText: "text-xp"        },
    "chart-3": { bg: "bg-chart-3/10",   border: "border-chart-3/25",   iconBg: "bg-chart-3/15",   iconText: "text-chart-3"   },
    "chart-4": { bg: "bg-chart-4/10",   border: "border-chart-4/25",   iconBg: "bg-chart-4/15",   iconText: "text-chart-4"   },
};

const URGENCY = {
    today: { wrap: "bg-streak/10 border-streak/25 hover:bg-streak/15", iconBg: "bg-streak/20",  iconText: "text-streak",  badge: "bg-streak/20 text-streak"   },
    soon:  { wrap: "bg-xp/10 border-xp/25 hover:bg-xp/15",             iconBg: "bg-xp/20",      iconText: "text-xp",      badge: "bg-xp/20 text-xp"           },
    later: { wrap: "bg-secondary border-border hover:bg-secondary/70", iconBg: "bg-chart-3/15", iconText: "text-chart-3", badge: "bg-chart-3/15 text-chart-3" },
};
function urgencyKey(daysAway) {
    if (daysAway <= 1) return "today";
    if (daysAway <= 5) return "soon";
    return "later";
}

// Avatar token color, deterministic from name (matches Friends page)
const AVATAR_COLORS = ["bg-chart-3", "bg-chart-4", "bg-primary", "bg-xp", "bg-streak"];
function avatarColor(name) {
    const c = (name || "?").charCodeAt(0) || 0;
    return AVATAR_COLORS[c % AVATAR_COLORS.length];
}
function initials(name) {
    return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [studySessions, setStudySessions] = useState([]);
    const [studyTechniques, setStudyTechniques] = useState([]);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [flashcardReminders, setFlashcardReminders] = useState([]);
    const [plannerReminders, setPlannerReminders] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [userSubjects, setUserSubjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showStudyIntent, setShowStudyIntent] = useState(false);

    const loadData = useCallback(async (userEmail) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const in14 = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
            const [profileData, sessionsData, techniquesData, quizData, assessmentData, flashcardData, plannerData, lbData, subjectsData] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: userEmail }).catch(() => []),
                base44.entities.StudySession.filter({ created_by: userEmail }, "-date", 30).catch(() => []),
                base44.entities.StudyTechnique.filter({ created_by: userEmail }, "-date").catch(() => []),
                base44.entities.QuizAttempt.filter({ created_by: userEmail }, "-date", 10).catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: userEmail, is_completed: false }, "due_date", 10).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: userEmail, is_active: true }, "nextReviewDate").catch(() => []),
                base44.entities.StudyPlan.filter({ created_by: userEmail, is_completed: false, date: { $gte: today, $lte: in14 } }, "date", 8).catch(() => []),
                base44.entities.Leaderboard.list('-total_xp', 200).catch(() => []),
                base44.entities.UserSubject.filter({ created_by: userEmail }).catch(() => []),
            ]);
            setUserSubjects(subjectsData || []);

            let profile = profileData[0] || null;
            if (!profile) {
                profile = await base44.entities.UserProfile.create({
                    onboarding_tasks: { username_set: false, subjects_selected: false, goals_set: false },
                    onboarding_completed: false
                }).catch(() => null);
            }

            // Self-heal: if the leaderboard knows about more XP than the
            // profile (because the profile was wiped/corrupted), restore it.
            // XP is strictly additive — taking the max is always safe.
            if (profile) {
                const result = await reconcileUserXP({ email: userEmail }, profile).catch(() => null);
                if (result?.reconciled) {
                    profile = {
                        ...profile,
                        total_xp:  result.correctTotalXp,
                        season_xp: result.correctSeasonXp,
                    };
                }
            }

            setUserProfile(profile);
            setStudySessions(sessionsData || []);
            setStudyTechniques(techniquesData || []);
            setQuizAttempts(quizData || []);
            setLeaderboard((lbData || []).filter(e => (e.total_xp || 0) > 0));

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
        const sum = (arr, key) => arr
            .filter(s => s.date && isToday(new Date(s.date)))
            .reduce((a, s) => a + (s[key] || 0), 0);
        return sum(studySessions, 'duration_minutes') + sum(studyTechniques, 'session_duration');
    }, [studySessions, studyTechniques]);

    const studiedYesterday = useMemo(() => {
        return studySessions.some(s => s.date && isYesterday(new Date(s.date)))
            || studyTechniques.some(s => s.date && isYesterday(new Date(s.date)));
    }, [studySessions, studyTechniques]);

    const weeklyStudyTime = useMemo(() => {
        const weekStart = startOfWeek(new Date());
        const sum = (arr, key) => arr
            .filter(s => s.date && new Date(s.date) >= weekStart)
            .reduce((a, s) => a + (s[key] || 0), 0);
        return sum(studySessions, 'duration_minutes') + sum(studyTechniques, 'session_duration');
    }, [studySessions, studyTechniques]);

    const avgQuizScore = useMemo(() => {
        if (!quizAttempts.length) return null;
        const recent = quizAttempts.slice(0, 5);
        return Math.round(recent.reduce((a, q) => a + (q.score || 0), 0) / recent.length);
    }, [quizAttempts]);

    const dueFlashcardCount = useMemo(
        () => flashcardReminders.reduce((a, d) => a + d.count, 0),
        [flashcardReminders]
    );

    const nextDeadline = useMemo(() => {
        const all = [
            ...assessments.map(a => ({ days: differenceInDays(parseISO(a.due_date), new Date()), title: a.title })),
            ...plannerReminders.map(e => ({ days: differenceInDays(parseISO(e.date), new Date()), title: e.title })),
        ].filter(x => x.days >= 0).sort((a, b) => a.days - b.days);
        return all[0] || null;
    }, [assessments, plannerReminders]);

    // Most recent study session (across sessions + techniques) — drives the
    // "pick up where you left off" hero card.
    const lastSession = useMemo(() => {
        const all = [
            ...studySessions.map(s => ({
                id: s.id,
                subject: s.subject,
                date: s.date,
                duration: s.duration_minutes || 0,
                kind: 'session',
            })),
            ...studyTechniques.map(s => ({
                id: s.id,
                subject: s.subject_name || s.subject,
                date: s.date,
                duration: s.session_duration || 0,
                kind: 'technique',
            })),
        ].filter(s => s.date).sort((a, b) => new Date(b.date) - new Date(a.date));
        return all[0] || null;
    }, [studySessions, studyTechniques]);

    // Per-subject snapshot stats — minutes this week + last session ago.
    const subjectStats = useMemo(() => {
        const weekStart = startOfWeek(new Date());
        return userSubjects.map(sub => {
            const matchingSessions = studySessions.filter(s =>
                s.subject && sub.subject_name &&
                s.subject.toLowerCase() === sub.subject_name.toLowerCase()
            );
            const matchingTech = studyTechniques.filter(s =>
                (s.subject_name || s.subject) && sub.subject_name &&
                (s.subject_name || s.subject).toLowerCase() === sub.subject_name.toLowerCase()
            );
            const weekMins =
                matchingSessions
                    .filter(s => new Date(s.date) >= weekStart)
                    .reduce((a, s) => a + (s.duration_minutes || 0), 0) +
                matchingTech
                    .filter(s => new Date(s.date) >= weekStart)
                    .reduce((a, s) => a + (s.session_duration || 0), 0);

            const last = [...matchingSessions, ...matchingTech]
                .filter(s => s.date)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            return {
                id: sub.id,
                name: sub.subject_name,
                code: sub.subject_code,
                weekMins,
                lastDate: last?.date || null,
            };
        }).sort((a, b) => b.weekMins - a.weekMins); // most-studied first
    }, [userSubjects, studySessions, studyTechniques]);

    // Daily study totals for the last 7 days — drives the heatmap strip.
    // Values: array of { date: 'YYYY-MM-DD', minutes: N, label: 'Mon' }, oldest → today.
    const dailyHeatmap = useMemo(() => {
        const today = new Date();
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = subDays(today, i);
            const sessMins = studySessions
                .filter(s => s.date && isSameDay(new Date(s.date), d))
                .reduce((a, s) => a + (s.duration_minutes || 0), 0);
            const techMins = studyTechniques
                .filter(s => s.date && isSameDay(new Date(s.date), d))
                .reduce((a, s) => a + (s.session_duration || 0), 0);
            days.push({
                date: format(d, 'yyyy-MM-dd'),
                label: format(d, 'EEEEEE'), // M, T, W…
                minutes: sessMins + techMins,
                isToday: isSameDay(d, today),
            });
        }
        return days;
    }, [studySessions, studyTechniques]);

    // Rank computation: find position + 3 rivals above + 1 below for context
    const rankInfo = useMemo(() => {
        if (!leaderboard.length || !user) return null;
        const myIdx = leaderboard.findIndex(e => e.user_email === user.email);
        const myRank = myIdx >= 0 ? myIdx + 1 : null;
        const myEntry = myIdx >= 0 ? leaderboard[myIdx] : null;
        const myXP = myEntry?.total_xp || userProfile?.total_xp || 0;

        // Rivals above (closest 3)
        let rivals = [];
        if (myIdx > 0) {
            const start = Math.max(0, myIdx - 3);
            rivals = leaderboard.slice(start, myIdx).map((e, i) => ({
                ...e,
                rank: start + i + 1,
                gap: (e.total_xp || 0) - myXP,
            }));
        } else if (myIdx === -1 || myIdx >= 50) {
            // Not ranked or way down — show top 3 as aspirational
            rivals = leaderboard.slice(0, 3).map((e, i) => ({
                ...e,
                rank: i + 1,
                gap: (e.total_xp || 0) - myXP,
            }));
        }

        // One below for context
        const below = myIdx >= 0 && myIdx < leaderboard.length - 1
            ? { ...leaderboard[myIdx + 1], rank: myIdx + 2, gap: (leaderboard[myIdx + 1].total_xp || 0) - myXP }
            : null;

        return { myRank, myXP, myEntry, rivals, below, total: leaderboard.length };
    }, [leaderboard, user, userProfile]);

    const xp = userProfile?.total_xp || 0;
    const streakDays = userProfile?.streak_days || 0;
    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const goalHours = userProfile?.weekly_study_goal_hours || 20;
    const weeklyPct = Math.min(100, Math.round((weeklyStudyTime / (goalHours * 60)) * 100));
    const totalReminders = assessments.length + flashcardReminders.length + plannerReminders.length;

    const hour = new Date().getHours();
    const coachLine = getCoachLine({
        name: firstName,
        hour,
        streakDays,
        todayMins: todaysStudyTime,
        studiedYesterday,
        dueFlashcards: dueFlashcardCount,
        urgentDays: nextDeadline?.days ?? null,
    });
    const streakBlurb = getStreakBlurb(streakDays);
    const multiplier = getStreakMultiplier(streakDays);
    const milestone = getNextStreakMilestone(streakDays);
    const move = getTodaysMove({
        todayMins: todaysStudyTime,
        streakDays,
        dueFlashcards: dueFlashcardCount,
        urgentDays: nextDeadline?.days ?? null,
        urgentTitle: nextDeadline?.title ?? null,
        hour,
    });
    const moveTheme = MOVE_THEME[move.accent];
    const MoveIcon = move.icon;

    const hasGoal = !!(userProfile?.goal_atar || userProfile?.goal_course_name);
    const onboardingTasks = userProfile?.onboarding_tasks || {};
    const onboardingComplete = onboardingTasks.username_set && onboardingTasks.subjects_selected && onboardingTasks.goals_set;
    const showOnboarding = userProfile && !userProfile.onboarding_completed && !onboardingComplete;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium text-sm">Loading your dashboard…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <AnimatePresence>
                {showStudyIntent && (
                    <StudyIntentModal firstName={firstName} onDismiss={() => setShowStudyIntent(false)} />
                )}
            </AnimatePresence>

            <div className="w-full px-4 lg:px-8 py-6 lg:py-10 max-w-6xl mx-auto space-y-6 lg:space-y-8">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">{format(new Date(), 'EEE · MMM d')}</span>
                            {streakDays > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-streak">
                                        <Flame className="w-3.5 h-3.5" /> {streakDays}d streak
                                    </span>
                                </>
                            )}
                            {rankInfo?.myRank && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-xp">
                                        <Trophy className="w-3.5 h-3.5" /> #{rankInfo.myRank}
                                    </span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Dashboard" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── ONBOARDING NUDGE (only for new users) ──────────── */}
                {showOnboarding && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="rounded-3xl bg-primary/10 border-2 border-primary/25 p-6 lg:p-8"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-display font-extrabold text-foreground text-lg">
                                        Quick setup · Five minutes
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        Tell us who you are and what you're chasing — we'll tailor everything to you.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {!onboardingTasks.username_set && (
                                    <Link to={createPageUrl("Settings")}>
                                        <Button size="sm" variant="outline"><CheckCircle2 className="w-3.5 h-3.5" /> Username</Button>
                                    </Link>
                                )}
                                {!onboardingTasks.subjects_selected && (
                                    <Link to={createPageUrl("Subjects")}>
                                        <Button size="sm" variant="outline"><CheckCircle2 className="w-3.5 h-3.5" /> Subjects</Button>
                                    </Link>
                                )}
                                {!onboardingTasks.goals_set && (
                                    <Link to={createPageUrl("Goals")}>
                                        <Button size="sm" variant="outline"><CheckCircle2 className="w-3.5 h-3.5" /> Goals</Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* ── PICK UP WHERE YOU LEFT OFF (hero) ──────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.4 }}
                >
                    {lastSession ? (
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-surface border-2 border-primary/25 p-6 lg:p-8">
                            <Brain className="absolute -top-4 -right-4 w-32 h-32 text-primary/10 pointer-events-none" />
                            <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                                <div className="flex-1 min-w-0">
                                    <p className="stat-label text-primary/80 mb-1.5">Pick up where you left off</p>
                                    <h2
                                        className="font-display font-extrabold text-foreground leading-[1.05] mb-2"
                                        style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
                                    >
                                        {lastSession.subject || 'Your last study session'}
                                    </h2>
                                    <p className="text-muted-foreground text-sm sm:text-base">
                                        {lastSession.duration > 0 ? `${lastSession.duration}m session` : 'Session'}
                                        {' · '}
                                        {(() => {
                                            try { return formatDistanceToNow(new Date(lastSession.date), { addSuffix: true }); }
                                            catch { return 'recently'; }
                                        })()}
                                        {dueFlashcardCount > 0 && (
                                            <>
                                                {' · '}
                                                <span className="font-bold text-foreground">{dueFlashcardCount} flashcard{dueFlashcardCount === 1 ? '' : 's'} due</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                                <Link to={createPageUrl("Study")} className="w-full sm:w-auto flex-shrink-0">
                                    <Button className="w-full sm:w-auto btn-3d gap-1.5">
                                        <Play className="w-4 h-4" /> Resume
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            icon={Brain}
                            title="Ready to start your first session?"
                            description="A 25-minute Pomodoro is the easiest way in. Show up today and tomorrow's streak takes care of itself."
                            actionLabel="Start a session"
                            actionHref={createPageUrl("Study")}
                            className="rounded-3xl bg-secondary/30 border-2 border-dashed border-border"
                        />
                    )}
                </motion.section>

                {/* ── YOUR SUBJECTS strip ────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl">Your subjects</h2>
                        <Link to={createPageUrl("Subjects")} className="text-xs font-bold text-primary hover:underline">All subjects →</Link>
                    </div>
                    {subjectStats.length === 0 ? (
                        <div className="rounded-2xl bg-secondary/30 border-2 border-dashed border-border p-6 text-center">
                            <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="font-bold text-foreground text-sm mb-1">Add your VCE subjects</p>
                            <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                                We'll track time and progress per subject and surface what to focus on.
                            </p>
                            <Link to={createPageUrl("Subjects")}>
                                <Button size="sm">Add subjects</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none">
                            {subjectStats.map((sub) => {
                                const lastAgo = sub.lastDate
                                    ? (() => {
                                        try { return formatDistanceToNow(new Date(sub.lastDate), { addSuffix: true }); }
                                        catch { return null; }
                                    })()
                                    : null;
                                const cardColor = AVATAR_COLORS[(sub.name || '?').charCodeAt(0) % AVATAR_COLORS.length];
                                return (
                                    <Link
                                        key={sub.id}
                                        to={createPageUrl("Study")}
                                        className="snap-start flex-shrink-0 w-52 sm:w-56 card-soft card-soft-hover p-4 group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`w-9 h-9 rounded-xl ${cardColor} text-white flex items-center justify-center font-bold text-sm`}>
                                                {initials(sub.name)}
                                            </div>
                                            {sub.weekMins > 0 && (
                                                <span className="pill bg-primary/10 text-primary text-[10px]">
                                                    {fmtTime(sub.weekMins)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-display font-extrabold text-foreground text-sm leading-tight mb-1 line-clamp-2">
                                            {sub.name}
                                        </p>
                                        {sub.code && (
                                            <p className="text-xs text-muted-foreground mb-3">{sub.code}</p>
                                        )}
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">
                                                {lastAgo ? `Last: ${lastAgo}` : 'No sessions yet'}
                                            </span>
                                            <Play className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </motion.section>

                {/* ── TODAY'S PLAN + STATS SIDEBAR ───────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6"
                >
                    {/* Today's plan — 2/3 */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl">Today's plan</h2>
                            {totalReminders > 0 && (
                                <span className="text-xs font-bold text-muted-foreground">{totalReminders} item{totalReminders === 1 ? '' : 's'}</span>
                            )}
                        </div>
                        {totalReminders === 0 ? (
                            <div className="card-soft p-6 text-center">
                                <CheckCircle2 className="w-10 h-10 text-primary/40 mx-auto mb-2" />
                                <p className="font-bold text-foreground text-sm mb-1">Nothing pressing today</p>
                                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                    A quiet day — perfect time to stack a focused study session.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {assessments.slice(0, 3).map((a) => {
                                    const days = differenceInDays(parseISO(a.due_date), new Date());
                                    const u = URGENCY[urgencyKey(days)];
                                    return (
                                        <Link key={a.id} to={createPageUrl("Goals")}>
                                            <ReminderRow
                                                icon={Target}
                                                title={a.title}
                                                subtitle={a.subject_name}
                                                badge={days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                                                theme={u}
                                            />
                                        </Link>
                                    );
                                })}
                                {plannerReminders.slice(0, 3).map((ev) => {
                                    const days = differenceInDays(parseISO(ev.date), new Date());
                                    const u = URGENCY[urgencyKey(days)];
                                    return (
                                        <Link key={`pl-${ev.id}`} to={createPageUrl("Goals")}>
                                            <ReminderRow
                                                icon={FileQuestion}
                                                title={ev.title}
                                                subtitle={ev.event_type}
                                                badge={days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                                                theme={u}
                                            />
                                        </Link>
                                    );
                                })}
                                {flashcardReminders.map((deck, i) => (
                                    <Link key={`fc-${i}`} to={createPageUrl("Study")}>
                                        <ReminderRow
                                            icon={Layers}
                                            title={deck.subject || 'Flashcards'}
                                            subtitle={`${deck.count} cards due`}
                                            badge="Now"
                                            theme={URGENCY.soon}
                                        />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats sidebar — 1/3 */}
                    <div className="lg:col-span-1 space-y-3">
                        {/* Streak */}
                        <div className="card-soft p-4 flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-streak/15 flex items-center justify-center flex-shrink-0">
                                <Flame className="w-5 h-5 text-streak" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="stat-label text-streak/80">Streak</p>
                                <p className="font-display font-extrabold text-foreground text-xl leading-none mt-0.5">
                                    {streakDays}<span className="text-muted-foreground/60 text-sm font-bold ml-1">{streakDays === 1 ? 'day' : 'days'}</span>
                                </p>
                            </div>
                            <span className="pill bg-streak/15 text-streak text-[10px] flex-shrink-0">{multiplier}</span>
                        </div>

                        {/* Week progress */}
                        <div className="card-soft p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
                                <p className="stat-label text-primary/80">This week</p>
                            </div>
                            <div className="flex items-baseline justify-between mb-1.5">
                                <span className="font-display font-extrabold text-foreground text-xl leading-none">
                                    {fmtTime(weeklyStudyTime)}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground">/ {goalHours}h goal</span>
                            </div>
                            <div className="h-1.5 bg-primary/15 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${weeklyPct}%` }}
                                    transition={{ duration: 0.9, delay: 0.3 }}
                                    className={`h-full rounded-full ${weeklyPct >= 100 ? 'bg-primary' : 'bg-xp'}`}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                                {weeklyPct >= 100 ? 'Goal smashed.' : `${weeklyPct}% of goal`}
                            </p>
                        </div>

                        {/* Rank */}
                        {rankInfo?.myRank && (
                            <Link to={createPageUrl("Ranked")}>
                                <div className="card-soft card-soft-hover p-4 flex items-center gap-3 cursor-pointer">
                                    <div className="w-11 h-11 rounded-xl bg-xp/15 flex items-center justify-center flex-shrink-0">
                                        <Trophy className="w-5 h-5 text-xp" strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="stat-label text-xp/80">Global rank</p>
                                        <p className="font-display font-extrabold text-foreground text-xl leading-none mt-0.5">
                                            #{rankInfo.myRank}<span className="text-muted-foreground/60 text-sm font-bold ml-1">of {rankInfo.total.toLocaleString()}</span>
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                                </div>
                            </Link>
                        )}

                        {/* Avg quiz */}
                        {avgQuizScore != null && (
                            <div className="card-soft p-4 flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-chart-3/15 flex items-center justify-center flex-shrink-0">
                                    <Brain className="w-5 h-5 text-chart-3" strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="stat-label text-chart-3/80">Avg quiz</p>
                                    <p className="font-display font-extrabold text-foreground text-xl leading-none mt-0.5">{avgQuizScore}%</p>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* ── GOAL + WEEKLY HEATMAP ──────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    {/* Goal poster — 3/5 */}
                    <div className="md:col-span-3">
                        {hasGoal ? (
                            <div className="relative overflow-hidden rounded-3xl bg-chart-3/10 border-2 border-chart-3/25 p-6 lg:p-8 h-full">
                                <GraduationCap className="absolute -top-4 -right-4 w-32 h-32 text-chart-3/10 pointer-events-none" />
                                <p className="stat-label text-chart-3/80 mb-2">Your shot at</p>
                                <h2
                                    className="font-display font-extrabold text-foreground leading-none mb-4"
                                    style={{ fontSize: 'clamp(2.75rem, 7vw, 5rem)' }}
                                >
                                    {userProfile.goal_atar || '—'}
                                </h2>
                                <div className="space-y-1">
                                    {userProfile.goal_course_name && (
                                        <p className="font-bold text-foreground text-base">{userProfile.goal_course_name}</p>
                                    )}
                                    {userProfile.goal_university && (
                                        <p className="text-sm text-muted-foreground">at {userProfile.goal_university}</p>
                                    )}
                                </div>
                                <Link to={createPageUrl("Goals")} className="inline-flex items-center gap-1 text-sm font-bold text-chart-3 hover:underline mt-5">
                                    Edit goal <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        ) : (
                            <div className="rounded-3xl bg-secondary/30 border-2 border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center">
                                <Target className="w-12 h-12 text-muted-foreground/40 mb-3" />
                                <h3 className="font-display font-extrabold text-foreground text-lg lg:text-xl mb-2">
                                    What are you chasing?
                                </h3>
                                <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                                    Set your ATAR target and dream course — we'll help you get there.
                                </p>
                                <Link to={createPageUrl("Goals")}>
                                    <Button>Set your goal</Button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Weekly heatmap — 2/5 */}
                    <div className="md:col-span-2">
                        <div className="card-soft p-5 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display font-extrabold text-foreground text-base">Last 7 days</h3>
                                <span className="text-xs font-bold text-muted-foreground">
                                    {fmtTime(dailyHeatmap.reduce((a, d) => a + d.minutes, 0))}
                                </span>
                            </div>
                            <div className="flex-1 flex items-end justify-between gap-1.5">
                                {(() => {
                                    const max = Math.max(60, ...dailyHeatmap.map(d => d.minutes));
                                    return dailyHeatmap.map((d) => {
                                        const ratio = d.minutes / max;
                                        // Color intensity: empty / low / medium / high
                                        const colorClass = d.minutes === 0
                                            ? 'bg-secondary'
                                            : ratio < 0.33
                                                ? 'bg-primary/30'
                                                : ratio < 0.66
                                                    ? 'bg-primary/60'
                                                    : 'bg-primary';
                                        const heightPct = d.minutes === 0 ? 6 : Math.max(8, ratio * 100);
                                        return (
                                            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                                                <div
                                                    className="w-full rounded-md flex items-end justify-center relative group"
                                                    style={{ height: '100px' }}
                                                    title={`${d.label}: ${fmtTime(d.minutes)}`}
                                                >
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${heightPct}%` }}
                                                        transition={{ duration: 0.6, delay: 0.4 + dailyHeatmap.indexOf(d) * 0.04 }}
                                                        className={`w-full rounded-md ${colorClass} ${d.isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                                                    />
                                                </div>
                                                <span className={`text-[10px] font-bold ${d.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                                                    {d.label}
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 text-center leading-snug">
                                {dailyHeatmap.filter(d => d.minutes > 0).length}/7 days studied this week
                            </p>
                        </div>
                    </div>
                </motion.section>

                {/* ── JUMP-TO RAIL ────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="border-t-2 border-border pt-6"
                >
                    <p className="stat-label mb-3">Jump to</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: "Study",     icon: Brain,        link: "Study" },
                            { label: "Quizzes",   icon: FileQuestion, link: "Quizzes" },
                            { label: "AI Tools",  icon: Sparkles,     link: "AITools" },
                            { label: "Goals",     icon: Target,       link: "Goals" },
                            { label: "Ranked",    icon: Trophy,       link: "Ranked" },
                            { label: "Subjects",  icon: BookOpen,     link: "Subjects" },
                            { label: "Friends",   icon: Users,        link: "Friends" },
                            { label: "Roadmap",   icon: Map,          link: "StudyRoadmap" },
                            { label: "Compete",   icon: Swords,       link: "Competitions" },
                            { label: "Analytics", icon: BarChart3,    link: "Analytics" },
                        ].map((d) => (
                            <Link key={d.link} to={createPageUrl(d.link)}>
                                <div className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border-2 border-border hover:border-primary hover:bg-primary/5 transition-all">
                                    <d.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <span className="text-sm font-bold text-foreground">{d.label}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </motion.section>

            </div>
        </div>
    );
}

// ─── Inline components ────────────────────────────────────────────────────────
function ReminderRow({ icon: Icon, title, subtitle, badge, theme }) {
    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${theme.wrap}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${theme.iconBg}`}>
                <Icon className={`w-4 h-4 ${theme.iconText}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm truncate">{title}</p>
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            </div>
            {badge && <span className={`pill ${theme.badge} flex-shrink-0`}>{badge}</span>}
        </div>
    );
}

