import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Target, ArrowRight,
    GraduationCap, Zap, Flame, Brain, FileQuestion,
    Sparkles, Trophy, Play, Layers, Timer, Users,
    Map, Swords, BarChart3, Star, CheckCircle2, AlertTriangle,
    TrendingUp, Crown, Medal, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, differenceInDays, parseISO, isToday, isYesterday } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import HelpButton from "@/components/shared/HelpButton";
import StudyIntentModal from "@/components/dashboard/StudyIntentModal";
import { reconcileUserXP } from "@/lib/reconcileXP";
import { getStreakMultiplier as getStreakMultiplierValue } from "@/components/shared/streakHelpers";

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

// Mirrors the real ladder in streakHelpers/server — what's shown is exactly
// what awardXP applies (capped at 2.0×).
function getStreakMultiplier(days) {
    return `${getStreakMultiplierValue(days)}×`;
}

function getNextStreakMilestone(days) {
    const tiers = [
        { at: 3,   mult: "1.1×" },
        { at: 7,   mult: "1.25×" },
        { at: 14,  mult: "1.5×" },
        { at: 30,  mult: "2.0×" },
    ];
    for (const t of tiers) if (days < t.at) return { ...t, away: t.at - days };
    return null;
}

// Daily XP goal — the daily loop. 100 XP is roughly one solid session.
const DAILY_XP_GOAL = 100;

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
            sub: "Open the planner and get the week mapped out.",
            cta: "Open planner",
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

// Direction A — softer tints, lighter borders, shadow for depth.
const MOVE_THEME = {
    primary:   { bg: "bg-primary/5",   border: "border-primary/15",   iconBg: "bg-primary/10",   iconText: "text-primary"   },
    streak:    { bg: "bg-streak/5",    border: "border-streak/15",    iconBg: "bg-streak/10",    iconText: "text-streak"    },
    xp:        { bg: "bg-xp/5",        border: "border-xp/15",        iconBg: "bg-xp/10",        iconText: "text-xp"        },
    "chart-3": { bg: "bg-chart-3/5",   border: "border-chart-3/15",   iconBg: "bg-chart-3/10",   iconText: "text-chart-3"   },
    "chart-4": { bg: "bg-chart-4/5",   border: "border-chart-4/15",   iconBg: "bg-chart-4/10",   iconText: "text-chart-4"   },
};

const URGENCY = {
    today: { wrap: "bg-streak/5 border-streak/15 hover:bg-streak/10",   iconBg: "bg-streak/15",  iconText: "text-streak",  badge: "bg-streak/15 text-streak"   },
    soon:  { wrap: "bg-xp/5 border-xp/15 hover:bg-xp/10",               iconBg: "bg-xp/15",      iconText: "text-xp",      badge: "bg-xp/15 text-xp"           },
    later: { wrap: "bg-surface border-border/60 hover:bg-secondary/40", iconBg: "bg-chart-3/10", iconText: "text-chart-3", badge: "bg-chart-3/10 text-chart-3" },
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
    const [isLoading, setIsLoading] = useState(true);
    const [todayXP, setTodayXP] = useState(0);
    const [showStudyIntent, setShowStudyIntent] = useState(false);

    const loadData = useCallback(async (userEmail) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const in14 = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
            const [profileData, sessionsData, techniquesData, quizData, assessmentData, flashcardData, plannerData, lbData, xpEventsData] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: userEmail }).catch(() => []),
                base44.entities.StudySession.filter({ created_by: userEmail }, "-date", 30).catch(() => []),
                base44.entities.StudyTechnique.filter({ created_by: userEmail }, "-date").catch(() => []),
                base44.entities.QuizAttempt.filter({ created_by: userEmail }, "-date", 10).catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: userEmail, is_completed: false }, "due_date", 10).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: userEmail, is_active: true }, "next_review_date").catch(() => []),
                base44.entities.StudyPlan.filter({ created_by: userEmail, is_completed: false, date: { $gte: today, $lte: in14 } }, "date", 8).catch(() => []),
                base44.entities.Leaderboard.list('-total_xp', 200).catch(() => []),
                base44.entities.XPEvent.filter({ user_email: userEmail }, "-created_date", 100).catch(() => []),
            ]);

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
            // Today's earned XP — powers the daily goal ring. Positive events
            // only (escrow deductions shouldn't shrink the day's effort).
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            setTodayXP((xpEventsData || [])
                .filter(e => (e.xp_awarded || 0) > 0 && (e.created_date || '').slice(0, 10) === todayStr)
                .reduce((sum, e) => sum + e.xp_awarded, 0));
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

            const dueCards = (flashcardData || []).filter(c => c.next_review_date && c.next_review_date <= today);
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

    // Last 7 calendar days with a studied-or-not flag — feeds the streak hero.
    const last7Days = useMemo(() => {
        const studiedDates = new Set(
            [...studySessions, ...studyTechniques].map(s => (s.date || '').slice(0, 10)).filter(Boolean)
        );
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(Date.now() - (6 - i) * 24 * 3600 * 1000);
            const key = format(d, 'yyyy-MM-dd');
            return {
                label: format(d, 'EEEEE'),
                studied: studiedDates.has(key),
                isToday: i === 6,
            };
        });
    }, [studySessions, studyTechniques]);
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

            <div className="w-full px-4 lg:px-8 py-6 lg:py-10 max-w-6xl mx-auto space-y-8 lg:space-y-10">

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
                            {userProfile?.acedit_atar != null && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-4">
                                        <GraduationCap className="w-3.5 h-3.5" /> {Number(userProfile.acedit_atar).toFixed(2)} ATAR
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

                {/* ── HERO ROW: Streak (2/3) + Today snapshot (1/3) ──── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.4 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6"
                >
                    {/* Streak hero */}
                    <div className="lg:col-span-2">
                        {streakDays > 0 ? (
                            <div className="relative overflow-hidden rounded-2xl bg-streak/5 border border-streak/15 shadow-soft p-6 lg:p-8 h-full">
                                <Flame className="absolute -top-6 -right-6 w-32 h-32 text-streak/[0.08] pointer-events-none" />
                                <div className="relative grid grid-cols-1 sm:grid-cols-5 gap-5 items-center">
                                    <div className="sm:col-span-3">
                                        <p className="stat-label text-streak/80 mb-1">Day streak</p>
                                        <div className="flex items-baseline gap-3">
                                            <span
                                                className="font-display font-extrabold text-streak leading-none"
                                                style={{ fontSize: 'clamp(3.5rem, 10vw, 6rem)' }}
                                            >
                                                {streakDays}
                                            </span>
                                            <span className="font-display font-extrabold text-streak/50 text-2xl lg:text-3xl">
                                                {streakDays === 1 ? 'day' : 'days'}
                                            </span>
                                        </div>
                                        {streakBlurb && (
                                            <p className="text-foreground text-sm lg:text-base mt-2 max-w-md font-medium leading-snug">
                                                {streakBlurb}
                                            </p>
                                        )}

                                        {/* Last 7 days — did the flame get fed? */}
                                        <div className="flex items-center gap-1.5 mt-4">
                                            {last7Days.map((d, i) => (
                                                <div key={i} className="flex flex-col items-center gap-1">
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                                        d.studied ? 'bg-streak text-white' : d.isToday ? 'bg-surface border-2 border-dashed border-streak/40' : 'bg-streak/10'
                                                    }`}>
                                                        {d.studied ? <Flame className="w-3.5 h-3.5" fill="currentColor" /> : null}
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${d.isToday ? 'text-streak' : 'text-muted-foreground/50'}`}>{d.label}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Shields — insurance against one missed day */}
                                        <div className="inline-flex items-center gap-1.5 mt-3 bg-surface rounded-full px-3 py-1.5 border border-chart-3/20">
                                            <Shield className={`w-3.5 h-3.5 ${(userProfile?.streak_shields || 0) > 0 ? 'text-chart-3' : 'text-muted-foreground/40'}`} />
                                            <span className="text-xs font-bold text-foreground">
                                                {userProfile?.streak_shields || 0} shield{(userProfile?.streak_shields || 0) === 1 ? '' : 's'}
                                            </span>
                                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                                · earn one each 7-day milestone
                                            </span>
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-1 gap-3">
                                        <div className="bg-surface rounded-xl p-3 border border-streak/10 shadow-soft">
                                            <p className="stat-label">XP boost</p>
                                            <p className="font-display font-extrabold text-streak text-2xl mt-0.5 leading-none">{multiplier}</p>
                                        </div>
                                        {milestone ? (
                                            <div className="bg-surface rounded-xl p-3 border border-border/60 shadow-soft">
                                                <p className="stat-label">Next jump</p>
                                                <p className="font-bold text-foreground text-sm mt-0.5">
                                                    {milestone.away}d <span className="text-muted-foreground/60">→</span> {milestone.mult}
                                                </p>
                                                <div className="h-1 bg-secondary rounded-full mt-1.5 overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-streak rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${((milestone.at - milestone.away) / milestone.at) * 100}%` }}
                                                        transition={{ duration: 0.9, delay: 0.5 }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-surface rounded-xl p-3 border border-border/60 shadow-soft">
                                                <p className="stat-label">Status</p>
                                                <p className="font-bold text-streak text-sm mt-0.5">Maxed at 2.0×</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-surface border border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center shadow-soft">
                                <Flame className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                <h2 className="font-display font-extrabold text-foreground text-xl lg:text-2xl mb-2">
                                    Ready to start a streak?
                                </h2>
                                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
                                    A study session today gets you started. Show up tomorrow to keep it.
                                </p>
                                <Link to={createPageUrl("Study")}>
                                    <Button><Play className="w-4 h-4" /> Start your first session</Button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Today snapshot — the daily XP goal is the loop */}
                    <div className="lg:col-span-1">
                        <div className="rounded-2xl bg-primary/5 border border-primary/15 shadow-soft p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-primary" />
                                    <p className="stat-label text-primary/80">Daily goal</p>
                                </div>
                                {todayXP >= DAILY_XP_GOAL && (
                                    <span className="pill bg-primary/15 text-primary">Hit! 🎉</span>
                                )}
                            </div>

                            {/* XP goal ring */}
                            <div className="relative w-36 h-36 mx-auto">
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9"
                                        className="stroke-primary/10" />
                                    <motion.circle cx="50" cy="50" r="42" fill="none" strokeWidth="9"
                                        strokeLinecap="round"
                                        className={todayXP >= DAILY_XP_GOAL ? "stroke-primary" : "stroke-xp"}
                                        strokeDasharray={2 * Math.PI * 42}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                                        animate={{ strokeDashoffset: (2 * Math.PI * 42) * (1 - Math.min(1, todayXP / DAILY_XP_GOAL)) }}
                                        transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <p className="font-display font-extrabold text-foreground text-3xl leading-none tabular-nums">{fmtXP(todayXP)}</p>
                                    <p className="text-xs font-bold text-muted-foreground mt-1">/ {DAILY_XP_GOAL} XP</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center mt-2 leading-snug">
                                {todayXP >= DAILY_XP_GOAL
                                    ? "Goal smashed — everything from here is bonus."
                                    : todayXP > 0
                                        ? `${DAILY_XP_GOAL - todayXP} XP to go — one session covers it.`
                                        : "Nothing banked yet — let's change that."}
                            </p>

                            <div className="space-y-2.5 mt-4 pt-4 border-t border-primary/10">
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">Time today</p>
                                    <p className="text-xs font-bold text-foreground">{fmtTime(todaysStudyTime)}</p>
                                </div>
                                <div>
                                    <div className="flex items-baseline justify-between mb-1">
                                        <p className="text-xs font-bold text-muted-foreground">This week</p>
                                        <p className="text-xs font-bold text-foreground">{fmtTime(weeklyStudyTime)} <span className="text-muted-foreground/60">/ {goalHours}h</span></p>
                                    </div>
                                    <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${weeklyPct}%` }}
                                            transition={{ duration: 0.9, delay: 0.3 }}
                                            className={`h-full rounded-full ${weeklyPct >= 100 ? 'bg-primary' : 'bg-xp'}`}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">Avg quiz</p>
                                    <p className="text-xs font-bold text-foreground">{avgQuizScore != null ? `${avgQuizScore}%` : '—'}</p>
                                </div>
                            </div>
                            <Link to={createPageUrl("Study")} className="mt-4">
                                <Button size="sm" className="w-full"><Play className="w-3.5 h-3.5" /> Study now</Button>
                            </Link>
                        </div>
                    </div>
                </motion.section>

                {/* ── RANK & RIVALS ───────────────────────────────────── */}
                {rankInfo && (rankInfo.rivals.length > 0 || rankInfo.below) && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="rounded-2xl bg-xp/[0.04] border border-xp/15 shadow-soft p-6 lg:p-7"
                    >
                        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-5 h-5 text-xp" />
                                </div>
                                <div>
                                    <p className="stat-label text-xp/80 mb-0.5">Global rank</p>
                                    <h2 className="font-display font-extrabold text-foreground text-xl lg:text-2xl leading-tight">
                                        {rankInfo.myRank ? (
                                            <>
                                                #{rankInfo.myRank}
                                                <span className="text-muted-foreground/50 text-base font-bold ml-2">
                                                    of {rankInfo.total.toLocaleString()}
                                                </span>
                                            </>
                                        ) : (
                                            "Unranked — keep earning XP"
                                        )}
                                    </h2>
                                </div>
                            </div>
                            <Link to={createPageUrl("Ranked")}>
                                <Button variant="outline" size="sm">
                                    See full board <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                            </Link>
                        </div>

                        <div className="space-y-1.5">
                            {rankInfo.rivals.length > 0 && (
                                <p className="stat-label mb-2">
                                    {rankInfo.myRank && rankInfo.myRank <= 50 ? "Closest ahead of you" : "Top of the board"}
                                </p>
                            )}
                            {rankInfo.rivals.map((r, i) => (
                                <RankRow key={r.id || r.user_email || i} entry={r} isMe={false} userEmail={user?.email} />
                            ))}
                            {rankInfo.myEntry && (
                                <RankRow entry={{ ...rankInfo.myEntry, rank: rankInfo.myRank, gap: 0 }} isMe={true} userEmail={user?.email} />
                            )}
                            {rankInfo.below && (
                                <RankRow entry={rankInfo.below} isMe={false} userEmail={user?.email} below />
                            )}
                        </div>

                        {rankInfo.rivals.length > 0 && rankInfo.rivals[rankInfo.rivals.length - 1] && rankInfo.myRank && rankInfo.myRank <= 50 && (
                            <p className="text-sm text-muted-foreground mt-4 leading-snug">
                                <span className="font-bold text-foreground">{fmtXP(rankInfo.rivals[rankInfo.rivals.length - 1].gap)} XP</span> from passing{' '}
                                <span className="font-bold text-foreground">
                                    {rankInfo.rivals[rankInfo.rivals.length - 1].is_anonymous && rankInfo.rivals[rankInfo.rivals.length - 1].user_email !== user?.email
                                        ? `Anon #${(rankInfo.rivals[rankInfo.rivals.length - 1].id || '').slice(-4)}`
                                        : (rankInfo.rivals[rankInfo.rivals.length - 1].username || rankInfo.rivals[rankInfo.rivals.length - 1].user_name || 'Student')}
                                </span>.
                            </p>
                        )}
                    </motion.section>
                )}

                {/* ── ONBOARDING NUDGE ────────────────────────────────── */}
                {showOnboarding && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl bg-primary/5 border border-primary/15 shadow-soft p-5 lg:p-6"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-display font-extrabold text-foreground text-base">
                                        Quick setup. Five minutes.
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
                                        <Button size="sm" variant="outline"><CheckCircle2 className="w-3.5 h-3.5" /> Plan</Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* ── REMINDERS ───────────────────────────────────────── */}
                {totalReminders > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl mb-3">
                            On your radar
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
                            {plannerReminders.map((ev) => {
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
                    </motion.section>
                )}

                {/* ── TODAY'S MOVE (compact, single row) ──────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className={`rounded-2xl ${moveTheme.bg} border ${moveTheme.border} shadow-soft p-5 lg:p-6`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl ${moveTheme.iconBg} flex items-center justify-center flex-shrink-0`}>
                                <MoveIcon className={`w-6 h-6 ${moveTheme.iconText}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="stat-label mb-1">Today's move · {move.label}</p>
                                <h2 className="font-display font-extrabold text-foreground text-base lg:text-lg leading-snug">
                                    {move.title}
                                </h2>
                                <p className="text-muted-foreground text-sm mt-0.5">{move.sub}</p>
                            </div>
                            <Link to={createPageUrl(move.link)} className="w-full sm:w-auto flex-shrink-0">
                                <Button className="w-full sm:w-auto">
                                    {move.cta} <ArrowRight className="w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </motion.section>

                {/* ── GOAL POSTER + RECENT (3:2) ──────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    <div className="md:col-span-3">
                        {hasGoal ? (
                            <div className="relative overflow-hidden rounded-2xl bg-chart-3/5 border border-chart-3/15 shadow-soft p-6 lg:p-8 h-full">
                                <GraduationCap className="absolute -top-4 -right-4 w-32 h-32 text-chart-3/[0.08] pointer-events-none" />
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
                            <div className="rounded-2xl bg-surface border border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center shadow-soft">
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

                    <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-display font-extrabold text-foreground text-lg lg:text-xl">Last sessions</h3>
                            <Link to={createPageUrl("Study")} className="text-xs font-bold text-primary hover:underline">View all</Link>
                        </div>
                        {studySessions.length === 0 ? (
                            <div className="flex flex-col items-center text-center gap-3 py-6">
                                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                                    <Brain className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground text-sm">No sessions yet</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px]">Knock out a quick session — it'll show up right here.</p>
                                </div>
                                <Link to={createPageUrl("Study")}>
                                    <Button size="sm" className="gap-1.5">
                                        <Brain className="w-3.5 h-3.5" />
                                        Start a session
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {studySessions.slice(0, 4).map((s) => (
                                    <li key={s.id} className="flex items-baseline justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground text-sm truncate">{s.subject || 'Study'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(s.date), 'MMM d')} · {s.duration_minutes || 0}m
                                            </p>
                                        </div>
                                        {s.productivity_rating && (
                                            <div className="flex gap-0.5 flex-shrink-0">
                                                {Array.from({ length: s.productivity_rating }).map((_, j) => (
                                                    <Star key={j} className="w-3 h-3 fill-xp text-xp" />
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </motion.section>

                {/* ── JUMP-TO RAIL ────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="border-t border-border/60 pt-6"
                >
                    <p className="stat-label mb-3">Jump to</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: "Study",     icon: Brain,        link: "Study" },
                            { label: "Quizzes",   icon: FileQuestion, link: "Quizzes" },
                            { label: "AI Tools",  icon: Sparkles,     link: "AITools" },
                            { label: "Ranked",    icon: Trophy,       link: "Ranked" },
                            { label: "Subjects",  icon: BookOpen,     link: "Subjects" },
                            { label: "Friends",   icon: Users,        link: "Friends" },
                            { label: "Planner",   icon: Map,          link: "Goals" },
                            { label: "Compete",   icon: Swords,       link: "Competitions" },
                            { label: "Analytics", icon: BarChart3,    link: "Analytics" },
                        ].map((d) => (
                            <Link key={d.link} to={createPageUrl(d.link)}>
                                <div className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border/60 shadow-soft hover:border-primary/40 hover:bg-primary/5 transition-all">
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
        <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-soft transition-all cursor-pointer ${theme.wrap}`}>
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

function RankRow({ entry, isMe, userEmail, below }) {
    const display = entry.is_anonymous && entry.user_email !== userEmail
        ? `Anon #${(entry.id || '').slice(-4)}`
        : (entry.username || entry.user_name || 'Student');
    const xpDisplay = fmtXP(entry.total_xp || 0);
    const gapStr = entry.gap > 0
        ? `+${fmtXP(entry.gap)}`
        : entry.gap < 0
            ? `${fmtXP(Math.abs(entry.gap))} below`
            : 'You';

    const RankIcon = entry.rank === 1 ? Crown : entry.rank === 2 ? Medal : entry.rank === 3 ? Medal : null;
    const rankIconColor = entry.rank === 1 ? 'text-xp' : entry.rank === 2 ? 'text-muted-foreground' : entry.rank === 3 ? 'text-streak' : '';

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-soft transition-colors ${
            isMe
                ? 'bg-primary/5 border-primary/40'
                : below
                    ? 'bg-surface border-border/60 opacity-70'
                    : 'bg-surface border-border/60 hover:border-xp/30'
        }`}>
            <div className={`flex items-center justify-center flex-shrink-0 w-10 ${isMe ? 'text-primary' : 'text-muted-foreground'} font-display font-extrabold text-lg`}>
                #{entry.rank}
            </div>
            <div className={`w-9 h-9 rounded-lg ${avatarColor(display)} text-white flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                {RankIcon ? <RankIcon className={`w-4 h-4 ${rankIconColor === 'text-muted-foreground' ? 'text-white' : ''}`} /> : initials(display)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                        {isMe ? `${display} (you)` : display}
                    </p>
                    {entry.streak_days > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-streak flex-shrink-0">
                            <Flame className="w-3 h-3" /> {entry.streak_days}
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{xpDisplay} XP</p>
            </div>
            {!isMe && entry.gap !== undefined && entry.gap !== 0 && (
                <span className={`pill flex-shrink-0 ${entry.gap > 0 ? 'bg-xp/15 text-xp' : 'bg-secondary text-muted-foreground'}`}>
                    <TrendingUp className="w-3 h-3" />
                    {gapStr}
                </span>
            )}
        </div>
    );
}
