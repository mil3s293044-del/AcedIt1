import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StudyTechnique, UserProfile, User, UserSubject } from "@/entities/all";
import { motion } from "framer-motion";
import {
    Clock,
    Brain,
    RefreshCw,
    PenTool,
    AlertTriangle,
    GraduationCap,
    BookOpen,
    Flame,
    Sparkles,
    Timer,
    Layers,
    Swords,
    Network
} from "lucide-react";
import { useStakes } from "@/components/arena/useStakes";
import { METRICS as DUEL_METRICS, firstName as rivalFirstName } from "@/components/arena/arenaMeta";
import { Button } from "@/components/ui/button";
import { format, isToday, startOfWeek, parseISO, differenceInDays } from "date-fns";

import PomodoroTimer from "../components/study/PomodoroTimer";
import { fireXPFeedback } from "../components/ranked/XPFeedback";
import { base44 } from "@/api/base44Client";
import SpacedRepetition from "../components/study/SpacedRepetition";
import ActiveRecall from "../components/study/ActiveRecall";
import BlurtingMethod from "../components/study/BlurtingMethod";
import ExamMode from "../components/study/ExamMode";
import MindMaps from "../components/study/MindMaps";
import HelpButton from "@/components/shared/HelpButton";
import NeuroPanel from "../components/study/NeuroPanel";
import { todaysIntent } from "@/lib/studyIntent";
import { isDue } from "@/lib/due";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60);
    const mm = Math.round(m % 60);
    if (h === 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
};

// Per-technique accent (icon-only). Static class strings so JIT picks them up.
const TECHNIQUES = [
    { id: "pomodoro",          name: "Pomodoro",          icon: Clock,         tile: "bg-primary/10",  text: "text-primary",  accent: "primary",  blurb: "Focused 25-min sprints with planned breaks.",                                  goodFor: "Deep focus on one topic without burning out." },
    { id: "spaced_repetition", name: "Spaced Repetition", icon: RefreshCw,     tile: "bg-chart-3/10",  text: "text-chart-3",  accent: "chart-3",  blurb: "Flashcards on a schedule that hits memory at the right moment.",               goodFor: "Locking facts in for the long haul." },
    { id: "active_recall",     name: "Active Recall",     icon: Brain,         tile: "bg-chart-4/10",  text: "text-chart-4",  accent: "chart-4",  blurb: "Quiz yourself instead of re-reading notes.",                                   goodFor: "Testing what you actually know vs. what feels familiar." },
    { id: "blurting",          name: "Blurting",          icon: PenTool,       tile: "bg-xp/10",       text: "text-xp",       accent: "xp",       blurb: "Brain-dump everything you remember on a topic, then check.",                   goodFor: "Spotting blind spots before exams hit them first." },
    { id: "exam",              name: "Revision Mode",     icon: GraduationCap, tile: "bg-streak/10",   text: "text-streak",   accent: "streak",   blurb: "A timed mock exam built from your own cards and quizzes.",                     goodFor: "Building exam stamina and timing under real conditions." },
    { id: "mind_map",          name: "Mind Maps",         icon: Network,       tile: "bg-map/10",      text: "text-map",      accent: "map",      blurb: "Map a topic from memory, then get interrogated on the gaps.",                  goodFor: "Seeing how ideas connect — and finding the links you can't explain." },
];

const ACCENT_THEME = {
    primary:   { bg: "bg-primary/10",  border: "border-primary/25",  iconBg: "bg-primary/15",  iconText: "text-primary",  divider: "border-primary/15",  pillBg: "bg-primary/15",  pillText: "text-primary"  },
    "chart-3": { bg: "bg-chart-3/10",  border: "border-chart-3/25",  iconBg: "bg-chart-3/15",  iconText: "text-chart-3",  divider: "border-chart-3/15",  pillBg: "bg-chart-3/15",  pillText: "text-chart-3"  },
    "chart-4": { bg: "bg-chart-4/10",  border: "border-chart-4/25",  iconBg: "bg-chart-4/15",  iconText: "text-chart-4",  divider: "border-chart-4/15",  pillBg: "bg-chart-4/15",  pillText: "text-chart-4"  },
    xp:        { bg: "bg-xp/10",       border: "border-xp/25",       iconBg: "bg-xp/15",       iconText: "text-xp",       divider: "border-xp/15",       pillBg: "bg-xp/15",       pillText: "text-xp"       },
    streak:    { bg: "bg-streak/10",   border: "border-streak/25",   iconBg: "bg-streak/15",   iconText: "text-streak",   divider: "border-streak/15",   pillBg: "bg-streak/15",   pillText: "text-streak"   },
    map:       { bg: "bg-map/10",      border: "border-map/25",      iconBg: "bg-map/15",      iconText: "text-map",      divider: "border-map/15",      pillBg: "bg-map/15",      pillText: "text-map"      },
};

// Coach voice — chill, supportive, motivational. Specific not generic.
function getCoachLine({ name, hour, todayMins, weekMins, streakDays, hasStudiedAnything, dueFlashcards, urgentDays }) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";

    if (!hasStudiedAnything) {
        return `${period}, ${name}. Six techniques to make studying actually work.`;
    }
    if (urgentDays !== null && urgentDays !== undefined && urgentDays <= 3 && todayMins === 0) {
        return `${period}, ${name}. Exam in ${urgentDays === 0 ? 'a few hours' : `${urgentDays} day${urgentDays === 1 ? '' : 's'}`} — let's lock in.`;
    }
    if (streakDays >= 7 && todayMins === 0) {
        return `${period}, ${name}. Quick session keeps your ${streakDays}-day streak going.`;
    }
    if (todayMins >= 90) {
        return `${period}, ${name}. ${fmtTime(todayMins)} deep — great day shaping up.`;
    }
    if (todayMins >= 30) {
        return `${period}, ${name}. ${fmtTime(todayMins)} in. Solid start.`;
    }
    if (todayMins > 0) {
        return `${period}, ${name}. Nice start — keep building.`;
    }
    if (dueFlashcards >= 10) {
        return `${period}, ${name}. ${dueFlashcards} flashcards waiting for a quick review.`;
    }
    if (weekMins >= 300) {
        return `${period}, ${name}. Strong week so far — let's get a session in.`;
    }
    return `${period}, ${name}. Let's get a session in.`;
}

export default function Study() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [studySessions, setStudySessions] = useState([]);
    const [flashcards, setFlashcards] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [activeTab, setActiveTab] = useState("pomodoro");

    // Deep links: /Study?tab=spaced_repetition etc. — duel shortcuts land on
    // the exact technique that scores their yardstick.
    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get('tab');
        if (t && TECHNIQUES.some(x => x.id === t)) setActiveTab(t);
    }, []);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState(false);
    // Today's intent picks the opening technique once per visit, not on every
    // refresh — see loadData.
    const intentAppliedRef = useRef(false);

    const loadData = useCallback(async (userEmail) => {
        if (!userEmail) return;

        setIsLoading(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const [profileData, sessionsData, subjectsData, studySessionsData, flashcardData, assessmentData] = await Promise.all([
                UserProfile.filter({ created_by: userEmail }).then(data => data[0] || null),
                StudyTechnique.filter({ created_by: userEmail }, "-created_date", 50),
                UserSubject.filter({ created_by: userEmail, is_active: true }),
                base44.entities.StudySession.filter({ created_by: userEmail }, "-date", 50).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: userEmail, is_active: true }, "next_review_date").catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: userEmail, is_completed: false }, "due_date", 10).catch(() => []),
            ]);
            setUserProfile(profileData);
            // What they said this morning picks the technique — but only on the
            // first load. loadData also runs after every saved session and on
            // entity subscriptions, and it was re-applying the intent each
            // time: finishing a pomodoro yanked you to Active Recall mid-reset,
            // and any background refresh flashed the page across to it. Steer
            // once, then leave the student wherever they've navigated to.
            if (!intentAppliedRef.current) {
                intentAppliedRef.current = true;
                // Read the URL rather than state — loadData's closure would
                // still hold the pre-effect value on the first run.
                const deepLink = new URLSearchParams(window.location.search).get("tab");
                // A running pomodoro outranks the intent. Reloading mid-session
                // used to drop you on Active Recall with the timer still
                // counting somewhere behind you.
                let timerLive = false;
                try {
                    const t = JSON.parse(localStorage.getItem("pomodoroTimerState") || "null");
                    timerLive = !!t?.isRunning && (t.timeLeft || 0) > 0;
                } catch { /* corrupt state isn't a running timer */ }
                const intent = todaysIntent(profileData);
                if (timerLive) setActiveTab("pomodoro");
                else if (intent && !deepLink) setActiveTab(intent.plan.technique);
            }
            setRecentSessions(sessionsData || []);
            setUserSubjects(subjectsData || []);
            setStudySessions(studySessionsData || []);
            // Genuinely due, which is not the same as "has a date in the past".
            // A card nobody has opened yet is new material; see lib/due.js.
            setFlashcards((flashcardData || []).filter(c => isDue(c, today)));
            setAssessments(assessmentData || []);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                setAuthError(false);
                loadData(currentUser.email);
            } catch (error) {
                console.error("Authentication error:", error);
                setAuthError(true);
                setIsLoading(false);
            }
        };
        init();
    }, [loadData]);

    useEffect(() => {
        const handleStartReview = (event) => {
            if (event.detail && event.detail.deckId) {
                setActiveTab("spaced_repetition");
                setTimeout(() => {
                    const reviewEvent = new CustomEvent('triggerDeckReview', {
                        detail: { deckId: event.detail.deckId }
                    });
                    window.dispatchEvent(reviewEvent);
                }, 300);
            }
        };

        window.addEventListener('startFlashcardReview', handleStartReview);
        return () => window.removeEventListener('startFlashcardReview', handleStartReview);
    }, []);

    useEffect(() => {
        const event = new CustomEvent('studyTechniqueChanged', {
            detail: { technique: activeTab }
        });
        window.dispatchEvent(event);
    }, [activeTab]);

    // Real-time updates
    useEffect(() => {
        if (!user?.email) return;

        const unsubscribeTechnique = StudyTechnique.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                setRecentSessions(prev => {
                    if (event.type === 'create') return [event.data, ...prev].slice(0, 50);
                    if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                    if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                    return prev;
                });
            }
        });

        const unsubscribeSubjects = UserSubject.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                setUserSubjects(prev => {
                    if (event.type === 'create') return [...prev, event.data];
                    if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                    if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                    return prev;
                });
            }
        });

        return () => {
            unsubscribeTechnique();
            unsubscribeSubjects();
        };
    }, [user]);

    const handleSessionComplete = async (sessionData) => {
        if (!user) return;
        try {
            await StudyTechnique.create({ ...sessionData });
            loadData(user.email);

            // Award XP by the minute studied. The rate per source lives on the
            // server (calcStudySessionXP and friends); a one-minute floor here
            // so a genuine minute isn't silently dropped.
            const mins = sessionData.session_duration || 0;
            if (mins >= 1) {
                const technique = sessionData.technique_name; // pomodoro, active_recall, blurting
                const sourceMap = {
                    pomodoro: 'study_session',
                    active_recall: 'active_recall',
                    blurting: 'blurting',
                };
                const source = sourceMap[technique] || 'study_session';
                const eventKey = `${source}_${user.email}_${Date.now()}`;
                const res = await base44.functions.invoke('awardXP', {
                    source,
                    event_key: eventKey,
                    duration_minutes: mins,
                });
                fireXPFeedback(res?.data ?? res, source);
            }
        } catch (error) {
            console.error("Error saving session:", error);
        }
    };

    const techniqueComponents = {
        pomodoro: (
            <PomodoroTimer
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
            />
        ),
        spaced_repetition: (
            <SpacedRepetition
                userSubjects={userSubjects}
            />
        ),
        active_recall: (
            <ActiveRecall
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
            />
        ),
        blurting: (
            <BlurtingMethod
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
            />
        ),
        exam: (
            <ExamMode
                userSubjects={userSubjects}
            />
        ),
        mind_map: (
            <MindMaps
                user={user}
                subjects={userSubjects}
            />
        )
    };

    const currentTechnique = TECHNIQUES.find(t => t.id === activeTab) || TECHNIQUES[0];
    const CurrentIcon = currentTechnique.icon;
    const currentTheme = ACCENT_THEME[currentTechnique.accent];

    // ─── Derived stats ─────────────────────────────────────────────────────────
    const todayMins = useMemo(() => {
        const sumKey = (arr, key) => arr
            .filter(s => s.date && isToday(new Date(s.date)))
            .reduce((a, s) => a + (s[key] || 0), 0);
        const techToday = recentSessions
            .filter(s => s.created_date && isToday(new Date(s.created_date)))
            .reduce((a, s) => a + (s.session_duration || 0), 0);
        return sumKey(studySessions, 'duration_minutes') + techToday;
    }, [studySessions, recentSessions]);

    const weekMins = useMemo(() => {
        const weekStart = startOfWeek(new Date());
        const sumKey = (arr, key, dateField) => arr
            .filter(s => s[dateField] && new Date(s[dateField]) >= weekStart)
            .reduce((a, s) => a + (s[key] || 0), 0);
        return sumKey(studySessions, 'duration_minutes', 'date')
            + sumKey(recentSessions, 'session_duration', 'created_date');
    }, [studySessions, recentSessions]);

    const sessionsThisWeek = useMemo(() => {
        const weekStart = startOfWeek(new Date());
        const ss = studySessions.filter(s => s.date && new Date(s.date) >= weekStart).length;
        const ts = recentSessions.filter(s => s.created_date && new Date(s.created_date) >= weekStart).length;
        return ss + ts;
    }, [studySessions, recentSessions]);

    const bestTechnique = useMemo(() => {
        if (!recentSessions.length) return null;
        const totals = {};
        recentSessions.forEach(s => {
            const key = s.technique_name || 'pomodoro';
            totals[key] = (totals[key] || 0) + (s.session_duration || 0);
        });
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return null;
        const [name, mins] = sorted[0];
        const meta = TECHNIQUES.find(t => t.id === name);
        return meta ? { id: name, name: meta.name, mins } : null;
    }, [recentSessions]);

    const dominantRecentTechnique = useMemo(() => {
        // Last 7 days — if 70%+ of sessions are one technique, flag it
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recent = recentSessions.filter(s => s.created_date && new Date(s.created_date) >= weekAgo);
        if (recent.length < 4) return null;
        const counts = {};
        recent.forEach(s => {
            const k = s.technique_name || 'pomodoro';
            counts[k] = (counts[k] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return null;
        const [name, count] = sorted[0];
        return (count / recent.length) >= 0.7 ? name : null;
    }, [recentSessions]);

    const nextDeadline = useMemo(() => {
        const upcoming = (assessments || [])
            .filter(a => a.due_date)
            .map(a => ({ days: differenceInDays(parseISO(a.due_date), new Date()), title: a.title }))
            .filter(x => x.days >= 0)
            .sort((a, b) => a.days - b.days);
        return upcoming[0] || null;
    }, [assessments]);

    const dueFlashcardCount = flashcards.length;
    const streakDays = userProfile?.streak_days || 0;
    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const hour = new Date().getHours();
    const hasStudiedAnything = recentSessions.length > 0 || studySessions.length > 0;

    const baseCoachLine = getCoachLine({
        name: firstName,
        hour,
        todayMins,
        weekMins,
        streakDays,
        hasStudiedAnything,
        dueFlashcards: dueFlashcardCount,
        urgentDays: nextDeadline?.days ?? null,
    });

    // ─── Live stakes feed the coach ────────────────────────────────────────────
    // When a duel is in its final 24 hours, the coach talks stakes — the most
    // urgent duel wins the mic.
    const { stakes } = useStakes();
    const duelUrgency = useMemo(() => {
        const me = stakes?.me;
        if (!me) return null;
        const info = (stakes.duels || [])
            .filter(d => d.status === "active" && d.live_scores)
            .map(d => {
                const isChallenger = d.challenger_email === me;
                const rivalEmail = isChallenger ? d.opponent_email : d.challenger_email;
                const mine = d.live_scores[me] || 0;
                const theirs = d.live_scores[rivalEmail] || 0;
                return {
                    duel: d,
                    rival: rivalFirstName(isChallenger ? d.opponent_name : d.challenger_name),
                    mine, theirs,
                    gap: Math.abs(mine - theirs),
                    unit: DUEL_METRICS[d.metric]?.unit || "XP",
                    hoursLeft: Math.max(0, Math.round((new Date(d.ends_at) - Date.now()) / 3600000)),
                };
            })
            .sort((a, b) => a.hoursLeft - b.hoursLeft);
        return info[0] || null;
    }, [stakes]);

    let duelCoachLine = null;
    if (duelUrgency && duelUrgency.hoursLeft <= 24) {
        const { rival, mine, theirs, gap, unit, hoursLeft } = duelUrgency;
        const hrs = hoursLeft <= 1 ? "under an hour" : `${hoursLeft}h`;
        if (mine < theirs) duelCoachLine = `${rival} leads by ${gap} ${unit} with ${hrs} left — one good session flips it.`;
        else if (mine === theirs) duelCoachLine = `Dead level with ${rival}, ${hrs} on the clock — the next session decides it.`;
        else duelCoachLine = `You lead ${rival} by ${gap} ${unit} with ${hrs} left — keep the pot in sight.`;
    }
    const coachLine = duelCoachLine || baseCoachLine;

    // ─── Featured "Suggested today" panel ──────────────────────────────────────
    const featured = useMemo(() => {
        // A duel entering its final day outranks everything except an exam —
        // and it points at the technique that actually scores its yardstick.
        const duelTab = { flashcards: "spaced_repetition", study_minutes: "pomodoro", xp: "pomodoro" };
        if (duelUrgency && duelUrgency.hoursLeft <= 24 && duelUrgency.mine <= duelUrgency.theirs
            && duelTab[duelUrgency.duel.metric] && !(nextDeadline && nextDeadline.days <= 1)) {
            return {
                label: "Duel on the line",
                title: `Your duel with ${duelUrgency.rival} ends in ${duelUrgency.hoursLeft <= 1 ? "under an hour" : `${duelUrgency.hoursLeft}h`}.`,
                sub: duelUrgency.mine === duelUrgency.theirs
                    ? "It's dead level. The next session takes the pot."
                    : `${duelUrgency.gap} ${duelUrgency.unit} between you and the pot.`,
                cta: "Defend your ante",
                tab: duelTab[duelUrgency.duel.metric],
                accent: "chart-4",
                icon: Swords,
            };
        }
        if (nextDeadline && nextDeadline.days <= 7) {
            return {
                label: nextDeadline.days === 0 ? "Exam today" : `Exam in ${nextDeadline.days} day${nextDeadline.days === 1 ? '' : 's'}`,
                title: `${nextDeadline.title} is coming up`,
                sub: "Open Revision Mode and run a timed mock from your own material.",
                cta: "Open Revision Mode",
                tab: "exam",
                accent: "streak",
                icon: GraduationCap,
            };
        }
        if (dueFlashcardCount >= 5) {
            return {
                label: "Cards waiting",
                title: `${dueFlashcardCount} flashcards waiting.`,
                sub: "A short Spaced Repetition session clears the queue.",
                cta: "Open Spaced Rep",
                tab: "spaced_repetition",
                accent: "chart-3",
                icon: Layers,
            };
        }
        if (todayMins === 0) {
            return {
                label: "Easiest start",
                title: "A 25-minute Pomodoro is the easiest start.",
                sub: "Show up, stay focused, walk away with momentum.",
                cta: "Start a Pomodoro",
                tab: "pomodoro",
                accent: "primary",
                icon: Timer,
            };
        }
        if (dominantRecentTechnique && dominantRecentTechnique !== "active_recall") {
            return {
                label: "Switch it up",
                title: "Switch it up — try Active Recall.",
                sub: "Testing what you remember locks it in deeper than re-reading.",
                cta: "Open Active Recall",
                tab: "active_recall",
                accent: "chart-4",
                icon: Brain,
            };
        }
        if (todayMins > 0 && todayMins < 60) {
            return {
                label: "Stack the win",
                title: "Good start — stack another short block.",
                sub: "One more Pomodoro and today becomes a real session.",
                cta: "Start a Pomodoro",
                tab: "pomodoro",
                accent: "xp",
                icon: Sparkles,
            };
        }
        return {
            label: "Pick a path",
            title: "Pick a technique above and let's work.",
            sub: "Each one suits a different kind of study — try the one that fits today.",
            cta: "Start a Pomodoro",
            tab: "pomodoro",
            accent: "primary",
            icon: Sparkles,
        };
    }, [nextDeadline, dueFlashcardCount, todayMins, dominantRecentTechnique, duelUrgency]);

    // Diverse "suggested today" options — one per technique, each with a
    // dynamic, context-aware one-liner. The smart top pick (featured.tab) gets
    // a badge; every tool is offered so the student has varied options.
    const suggestionSub = (id) => {
        switch (id) {
            case "pomodoro":          return todayMins === 0 ? "Easiest way to start today." : "Stack another focused block.";
            case "spaced_repetition": return dueFlashcardCount > 0 ? `${dueFlashcardCount} cards due now.` : "Keep your flashcards fresh.";
            case "active_recall":     return "Quiz yourself — beats re-reading.";
            case "blurting":          return "Brain-dump a topic, spot the gaps.";
            case "exam":              return nextDeadline && nextDeadline.days <= 14 ? `Exam in ${nextDeadline.days}d — run a timed mock.` : "Practice under exam conditions.";
            case "mind_map":          return "Map a topic blind, find the gaps.";
            default:                  return "";
        }
    };

    if (authError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="card-soft p-8 max-w-md w-full text-center">
                    <div className="w-14 h-14 rounded-2xl bg-streak/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-7 h-7 text-streak" />
                    </div>
                    <h2 className="font-display font-extrabold text-foreground text-xl mb-2">Connection issue</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        Unable to connect. Please check your internet and try again.
                    </p>
                    <Button onClick={() => window.location.reload()} className="w-full">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (userSubjects.length === 0 && !isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        <div className="flex items-start justify-between mb-1">
                            <p className="text-sm text-muted-foreground font-medium">Practice</p>
                            <HelpButton page="Study" />
                        </div>
                        <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                            Study
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm lg:text-base">
                            Five evidence-based techniques to make your study time count.
                        </p>
                    </motion.section>

                    <div className="card-soft p-8 max-w-2xl mx-auto text-center">
                        <div className="w-14 h-14 rounded-2xl bg-chart-3/10 flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-7 h-7 text-chart-3" />
                        </div>
                        <h2 className="font-display font-extrabold text-foreground text-xl mb-2">
                            Add subjects first
                        </h2>
                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                            Pick the subjects you're studying so we can tailor sessions, flashcards, and exam practice to them.
                        </p>
                        <Button onClick={() => window.location.href = '/Subjects'}>
                            Go to subjects
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">

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
                            {todayMins > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-primary">
                                        <Clock className="w-3.5 h-3.5" /> {fmtTime(todayMins)} today
                                    </span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Study" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── HERO ROW: Technique panel (3/5) + Today stats (2/5) ── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    {/* Technique panel */}
                    <div className="md:col-span-3">
                        <div className={`relative overflow-hidden rounded-3xl ${currentTheme.bg} border-2 ${currentTheme.border} p-6 lg:p-8 h-full transition-colors`}>
                            <CurrentIcon className={`absolute -top-6 -right-6 w-32 h-32 ${currentTheme.iconText} opacity-10 pointer-events-none`} />
                            <div className="relative">
                                <p className={`stat-label ${currentTheme.iconText}/80 mb-2`}>Selected technique</p>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-12 h-12 rounded-2xl ${currentTheme.iconBg} flex items-center justify-center flex-shrink-0`}>
                                        <CurrentIcon className={`w-6 h-6 ${currentTheme.iconText}`} />
                                    </div>
                                    <h2
                                        className="font-display font-extrabold text-foreground leading-none"
                                        style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)' }}
                                    >
                                        {currentTechnique.name}
                                    </h2>
                                </div>
                                <p className="text-foreground text-sm lg:text-base font-medium leading-snug max-w-md mb-3">
                                    {currentTechnique.blurb}
                                </p>
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${currentTheme.pillBg} ${currentTheme.pillText}`}>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span className="text-xs font-bold">Good for: {currentTechnique.goodFor}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Today stats panel — colour-matched to the selected technique */}
                    <div className="md:col-span-2">
                        <div className={`rounded-3xl ${currentTheme.bg} border-2 ${currentTheme.border} p-6 h-full flex flex-col transition-colors`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className={`w-4 h-4 ${currentTheme.iconText}`} />
                                <p className={`stat-label ${currentTheme.iconText}/80`}>Today</p>
                            </div>
                            <p className="font-display font-extrabold text-foreground leading-none" style={{ fontSize: 'clamp(2.25rem, 5.5vw, 3rem)' }}>
                                {fmtTime(todayMins)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 leading-snug">
                                {todayMins === 0
                                    ? "Nothing logged yet — let's change that."
                                    : todayMins >= 90
                                        ? "Solid day so far. Keep cooking."
                                        : todayMins >= 30
                                            ? "Good start — stack another?"
                                            : "Just getting started."}
                            </p>
                            <div className={`space-y-2.5 mt-4 pt-4 border-t-2 ${currentTheme.divider}`}>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">This week</p>
                                    <p className="text-xs font-bold text-foreground">{fmtTime(weekMins)}</p>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">Sessions</p>
                                    <p className="text-xs font-bold text-foreground">{sessionsThisWeek}</p>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">Top technique</p>
                                    <p className="text-xs font-bold text-foreground truncate ml-2">
                                        {bestTechnique ? bestTechnique.name : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SUGGESTED TODAY — diverse, colour-coded per technique ── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-muted-foreground" />
                        <p className="stat-label">Suggested today</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {TECHNIQUES.map((t) => {
                            const th = ACCENT_THEME[t.accent];
                            const Icon = t.icon;
                            const isTop = featured?.tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    data-run-target={t.id === "active_recall" ? "active_recall" : undefined}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`relative text-left rounded-2xl border-2 p-4 transition-all hover:-translate-y-0.5 ${th.bg} ${th.border} ${isTop ? 'shadow-soft' : ''}`}
                                >
                                    {isTop && (
                                        <span className={`absolute top-2.5 right-2.5 pill ${th.pillBg} ${th.pillText}`}>Top pick</span>
                                    )}
                                    <div className={`w-10 h-10 rounded-xl ${th.iconBg} flex items-center justify-center mb-2.5`}>
                                        <Icon className={`w-5 h-5 ${th.iconText}`} />
                                    </div>
                                    <p className="font-display font-extrabold text-foreground text-sm leading-tight">{t.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{suggestionSub(t.id)}</p>
                                </button>
                            );
                        })}
                    </div>
                </motion.section>

                {/* ── ACTIVE TOOL + THE SCIENCE ─────────────────────────── */}
                {/* Tool switching happens via the colour-coded suggestion grid
                    above and the selected-technique panel — the old tab bar was
                    redundant, so it's removed.

                    The tool sits left and the evidence rail fills the space that
                    used to be dead margin. It only splits at xl: below that the
                    rail would squeeze the tool, so it stacks underneath — still
                    read, just after the thing the student came for. */}
                <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="min-w-0"
                    >
                        {techniqueComponents[activeTab]}
                    </motion.div>

                    <div className="xl:sticky xl:top-6">
                        <NeuroPanel
                            techniqueId={activeTab}
                            techniqueName={(TECHNIQUES.find(t => t.id === activeTab) || {}).name || "this"}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
