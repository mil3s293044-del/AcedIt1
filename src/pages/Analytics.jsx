import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    BarChart3, TrendingUp, Clock, Brain, Target, Calendar, Award,
    Zap, BookOpen, Activity, Flame,
    Layers, CheckCircle2, AlertTriangle,
    Sparkles, Star, FileQuestion
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
    StudyTechnique, QuizAttempt, Flashcard, ActiveRecallSession,
    BlurtingSession, UserSubject, UserProfile, StudySession
} from "@/entities/all";
import {
    format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval
} from "date-fns";
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from "recharts";
import AIPerformanceAnalyzer from "../components/analytics/AIPerformanceAnalyzer";
import AtarPanel from "../components/analytics/AtarPanel";
import WeakTopicsPanel from "../components/analytics/WeakTopicsPanel";
import AceRoam from "@/components/ace/AceRoam";
import CognitiveProfilePanel from "../components/analytics/CognitiveProfilePanel";
import MemoryPanel from "../components/analytics/MemoryPanel";
import AttentionPanel from "../components/analytics/AttentionPanel";
import HelpButton from "@/components/shared/HelpButton";
import { subjectColor } from "@/components/cards/cardIdentity";

const fmt = (mins) => {
    if (!mins) return "0m";
    const h = Math.floor(mins / 60), m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

// Design-system token HSL values used as literal Recharts color props.
const TOKEN_HSL = {
    primary: "hsl(95, 90%, 40%)",  // #58CC02
    xp:      "hsl(36, 100%, 50%)", // #FF9600
    streak:  "hsl(0, 100%, 65%)",  // #FF4B4B
    chart3:  "hsl(213, 76%, 51%)", // #217BE0
    chart4:  "hsl(282, 100%, 74%)",// #C77DFF
};

const TECHNIQUE_META = {
    pomodoro:          { label: "Pomodoro",      color: TOKEN_HSL.primary, bg: "bg-primary" },
    spaced_repetition: { label: "Spaced Rep.",   color: TOKEN_HSL.chart3,  bg: "bg-chart-3" },
    active_recall:     { label: "Active Recall", color: TOKEN_HSL.chart4,  bg: "bg-chart-4" },
    blurting:          { label: "Blurting",      color: TOKEN_HSL.xp,      bg: "bg-xp" },
    quizzes:           { label: "Quizzes",       color: TOKEN_HSL.streak,  bg: "bg-streak" },
};

// Pre-computed static lookup tables (avoid Tailwind JIT-killing dynamic interpolation).
const PRIORITY_PILL = {
    high:   "bg-streak/10 text-streak",
    medium: "bg-xp/10 text-xp",
    low:    "bg-secondary text-muted-foreground",
};

const INSIGHT_CARD = {
    good: { box: "bg-primary/10 border-primary/20",  iconBox: "bg-primary/15", iconColor: "text-primary",  Icon: CheckCircle2 },
    warn: { box: "bg-xp/10 border-xp/20",            iconBox: "bg-xp/15",      iconColor: "text-xp",       Icon: AlertTriangle },
    info: { box: "bg-chart-3/10 border-chart-3/20",  iconBox: "bg-chart-3/15", iconColor: "text-chart-3",  Icon: Zap },
};

const FC_KPI_THEME = {
    total:      "bg-secondary text-foreground",
    mastered:   "bg-primary/10 text-primary",
    due:        "bg-chart-3/10 text-chart-3",
    weak:       "bg-xp/10 text-xp",
    unreviewed: "bg-streak/10 text-streak",
};

// Featured insight panel theme tokens
const FEATURED_THEME = {
    primary:   { bg: "bg-primary/10",  border: "border-primary/25",  iconBg: "bg-primary/15",  iconText: "text-primary"  },
    xp:        { bg: "bg-xp/10",       border: "border-xp/25",       iconBg: "bg-xp/15",       iconText: "text-xp"       },
    "chart-3": { bg: "bg-chart-3/10",  border: "border-chart-3/25",  iconBg: "bg-chart-3/15",  iconText: "text-chart-3"  },
    "chart-4": { bg: "bg-chart-4/10",  border: "border-chart-4/25",  iconBg: "bg-chart-4/15",  iconText: "text-chart-4"  },
    streak:    { bg: "bg-streak/10",   border: "border-streak/25",   iconBg: "bg-streak/15",   iconText: "text-streak"   },
};

// ─── Coach voice (chill + motivational, trend-aware) ─────────────────────────
function getCoachLine({ name, hour, totalMins, totalSess, weekDelta, quizAvg, quizDelta, streakDays, bestSubject }) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";

    if (totalMins === 0 && totalSess === 0) {
        return `${period}, ${name}. Get studying — your insights show up here.`;
    }
    if (quizDelta != null && quizDelta >= 5) {
        return `${period}, ${name}. Your avg quiz score climbed from ${quizAvg - quizDelta}% to ${quizAvg}%.`;
    }
    if (streakDays >= 7) {
        return `${period}, ${name}. ${streakDays}-day streak shows up in every chart below.`;
    }
    if (weekDelta != null && weekDelta > 10) {
        return `${period}, ${name}. You're studying ${weekDelta}% more than last week.`;
    }
    if (weekDelta != null && weekDelta < -15) {
        return `${period}, ${name}. Last week eased off — let's pick the pace back up.`;
    }
    if (bestSubject) {
        return `${period}, ${name}. ${bestSubject} is leading the pack in your data.`;
    }
    if (totalSess >= 10) {
        return `${period}, ${name}. ${totalSess} sessions logged — patterns are forming.`;
    }
    return `${period}, ${name}. Steady habits. Insights below.`;
}

// ─── Featured insight detection ──────────────────────────────────────────────
function getFeaturedInsight({ metrics, techBreakdown, subjectData, quizDelta, weekDelta, streakDays }) {
    // Priority order: biggest signal first
    if (metrics.totalMins === 0) {
        return {
            label: "Get going",
            title: "Keep logging sessions — patterns will emerge.",
            sub: "Once you've logged a few sessions, your strongest subject and best technique surface here.",
            accent: "chart-3",
            icon: Sparkles,
        };
    }
    if (quizDelta != null && quizDelta >= 5) {
        return {
            label: "Quiz scores climbing",
            title: `Your quiz scores are up ${quizDelta}% this fortnight. Keep doing what you're doing.`,
            sub: `Avg sits at ${metrics.quizAvg}% — the gains are real.`,
            accent: "primary",
            icon: TrendingUp,
        };
    }
    const best = subjectData.find(s => s.quizAvg !== null && s.quizAvg >= 80);
    if (best) {
        return {
            label: "Strongest subject",
            title: `${best.name} is your strongest — ${best.quizAvg}% avg. Lean into it.`,
            sub: `${fmt(best.totalMins)} logged across ${best.uniqueDays} days.`,
            accent: "primary",
            icon: Award,
        };
    }
    const lagging = subjectData.find(s => s.quizAvg !== null && s.quizAvg < 60);
    if (lagging) {
        return {
            label: "Needs more time",
            title: `${lagging.name} is at ${lagging.quizAvg}% — needs more time.`,
            sub: `Only ${fmt(lagging.totalMins)} logged this period. A focused session moves the needle.`,
            accent: "xp",
            icon: AlertTriangle,
        };
    }
    if (streakDays >= 7) {
        const topTech = techBreakdown.slice().sort((a, b) => b.mins - a.mins)[0];
        return {
            label: `${streakDays}-day streak`,
            title: `${streakDays}-day streak — your most-used technique is ${topTech?.label || 'study'}.`,
            sub: `${fmt(topTech?.mins || 0)} on ${topTech?.label || 'sessions'} this period.`,
            accent: "primary",
            icon: Flame,
        };
    }
    const dominant = techBreakdown.find(t => metrics.totalMins > 0 && (t.mins / metrics.totalMins) > 0.6);
    if (dominant && techBreakdown.length > 1) {
        return {
            label: "Technique mix",
            title: `You've leaned hard on ${dominant.label} this month.`,
            sub: `${Math.round((dominant.mins / metrics.totalMins) * 100)}% of your study time. Mix in another technique for retention.`,
            accent: "chart-4",
            icon: Layers,
        };
    }
    if (weekDelta != null && weekDelta > 15) {
        return {
            label: "Trending up",
            title: `You're studying ${weekDelta}% more than last week.`,
            sub: "Momentum like this is when habits stick.",
            accent: "primary",
            icon: TrendingUp,
        };
    }
    if (metrics.consistency >= 70) {
        return {
            label: "Consistent",
            title: `${metrics.uniqueDays} of ${metrics.rangedays} days studied. That's the work.`,
            sub: "Consistency outranks any single big session.",
            accent: "chart-3",
            icon: CheckCircle2,
        };
    }
    return {
        label: "Building",
        title: "Keep logging sessions — patterns will emerge.",
        sub: "A few more sessions and your strongest signals will surface here.",
        accent: "chart-3",
        icon: Sparkles,
    };
}

export default function Analytics() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    // getRankedBoards forces a recompute, so opening Analytics shows a current
    // score rather than whatever was last written by an XP award.
    const [ranked, setRanked] = useState(null);
    const [timeRange, setTimeRange] = useState("month");
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [data, setData] = useState({
        techniques: [], quizzes: [], flashcards: [],
        activeRecall: [], blurting: [], subjects: [], studySessions: []
    });

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                await loadData(u.email);
            } catch (e) { console.error(e); }
            finally { setIsLoading(false); }
        };
        init();
    }, []);

    useEffect(() => {
        if (user?.email) loadData(user.email);
    }, [timeRange]);

    const getDateRange = (range) => {
        const today = new Date();
        switch (range) {
            case "week":   return { start: format(startOfWeek(today), 'yyyy-MM-dd'), end: format(endOfWeek(today), 'yyyy-MM-dd') };
            case "month":  return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
            case "3months":return { start: format(subDays(today, 90), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
            case "year":   return { start: format(subDays(today, 365), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
            default:       return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
        }
    };

    const loadData = async (email) => {
        setIsLoading(true);
        const dr = getDateRange(timeRange);
        try {
            const [profile, techniques, quizzes, flashcards, activeRecall, blurting, subjects, studySessions] = await Promise.all([
                UserProfile.filter({ created_by: email }).then(d => d[0] || null),
                StudyTechnique.filter({ created_by: email, date: { $gte: dr.start, $lte: dr.end } }),
                QuizAttempt.filter({ created_by: email, date: { $gte: dr.start, $lte: dr.end } }),
                Flashcard.filter({ created_by: email }),
                ActiveRecallSession.filter({ created_by: email, date: { $gte: dr.start, $lte: dr.end } }),
                BlurtingSession.filter({ created_by: email, date: { $gte: dr.start, $lte: dr.end } }),
                UserSubject.filter({ created_by: email, is_active: true }),
                StudySession.filter({ created_by: email, date: { $gte: dr.start, $lte: dr.end } })
            ]);
            setUserProfile(profile);
            base44.functions.invoke("getRankedBoards", {})
                .then(res => setRanked(res?.data ?? res))
                .catch(() => {});
            setData({ techniques: techniques||[], quizzes: quizzes||[], flashcards: flashcards||[], activeRecall: activeRecall||[], blurting: blurting||[], subjects: subjects||[], studySessions: studySessions||[] });
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    // ── Core Metrics ──────────────────────────────────────────────────────────
    const metrics = useMemo(() => {
        const techMins    = data.techniques.reduce((s, t) => s + (t.session_duration||0), 0);
        const arMins      = data.activeRecall.reduce((s, t) => s + (t.session_duration||0), 0);
        const blurtMins   = data.blurting.reduce((s, t) => s + (t.session_duration||0), 0);
        const quizMins    = Math.round(data.quizzes.reduce((s, q) => s + ((q.time_taken||0)/60), 0));
        const totalMins   = techMins + arMins + blurtMins + quizMins;
        const totalSess   = data.techniques.length + data.activeRecall.length + data.blurting.length + data.quizzes.length;
        const quizAvg     = data.quizzes.length > 0 ? Math.round(data.quizzes.reduce((s,q)=>s+(q.adjusted_score ?? q.score),0)/data.quizzes.length) : 0;
        const fcMastery   = data.flashcards.length > 0 ? Math.round((data.flashcards.filter(f=>((f.review_count_good||0)+(f.review_count_easy||0))>2).length/data.flashcards.length)*100) : 0;
        const uniqueDays  = new Set([
            ...data.techniques.map(t=>t.date),
            ...data.activeRecall.map(t=>t.date),
            ...data.blurting.map(t=>t.date),
        ].filter(Boolean)).size;
        const rangedays   = timeRange === "week" ? 7 : timeRange === "month" ? 30 : timeRange === "3months" ? 90 : 365;
        const consistency = Math.round((uniqueDays / rangedays) * 100);
        const weakCards   = data.flashcards.filter(f => f.is_weak_spot).length;
        return { totalMins, totalSess, quizAvg, fcMastery, uniqueDays, consistency, weakCards, quizMins, techMins, arMins, blurtMins, rangedays };
    }, [data, timeRange]);

    // ── Daily Chart Data ──────────────────────────────────────────────────────
    const dailyData = useMemo(() => {
        const today = new Date();
        const days = timeRange === "week" ? 7 : timeRange === "month" ? 30 : 30;
        const interval = eachDayOfInterval({ start: subDays(today, days - 1), end: today });
        return interval.map(date => {
            const ds = format(date, 'yyyy-MM-dd');
            const mins = [
                ...data.techniques.filter(s=>s.date===ds).map(s=>s.session_duration||0),
                ...data.activeRecall.filter(s=>s.date===ds).map(s=>s.session_duration||0),
                ...data.blurting.filter(s=>s.date===ds).map(s=>s.session_duration||0),
            ].reduce((a,b)=>a+b,0);
            const quizMins = Math.round(data.quizzes.filter(q=>q.date===ds).reduce((s,q)=>s+(q.time_taken||0)/60,0));
            return { date: format(date, 'MMM d'), mins: mins + quizMins, hours: Math.round((mins+quizMins)/60*10)/10 };
        });
    }, [data, timeRange]);

    // ── Quiz Trend ────────────────────────────────────────────────────────────
    const quizTrend = useMemo(() =>
        data.quizzes.slice().sort((a,b) => (a.date||'').localeCompare(b.date||'')).map((q,i) => ({
            n: `#${i+1}`, score: (q.adjusted_score ?? q.score), date: q.date
        })), [data.quizzes]);

    // ── Technique Breakdown ───────────────────────────────────────────────────
    const techBreakdown = useMemo(() => {
        const pomo  = data.techniques.filter(t=>t.technique_name==='pomodoro');
        const sr    = data.techniques.filter(t=>t.technique_name==='spaced_repetition');
        return [
            { key: 'pomodoro',          label: 'Pomodoro',       mins: pomo.reduce((s,t)=>s+(t.session_duration||0),0), sessions: pomo.length,                color: TECHNIQUE_META.pomodoro.color },
            { key: 'spaced_repetition', label: 'Spaced Rep.',    mins: sr.reduce((s,t)=>s+(t.session_duration||0),0),   sessions: sr.length,                  color: TECHNIQUE_META.spaced_repetition.color },
            { key: 'active_recall',     label: 'Active Recall',  mins: data.activeRecall.reduce((s,t)=>s+(t.session_duration||0),0), sessions: data.activeRecall.length, color: TECHNIQUE_META.active_recall.color },
            { key: 'blurting',          label: 'Blurting',       mins: data.blurting.reduce((s,t)=>s+(t.session_duration||0),0),    sessions: data.blurting.length,    color: TECHNIQUE_META.blurting.color },
            { key: 'quizzes',           label: 'Quizzes',        mins: metrics.quizMins,  sessions: data.quizzes.length,                        color: TECHNIQUE_META.quizzes.color },
        ].filter(t => t.mins > 0 || t.sessions > 0);
    }, [data, metrics]);

    // ── Subject Breakdown ─────────────────────────────────────────────────────
    const subjectData = useMemo(() => {
        return data.subjects.map(sub => {
            const techMins = data.techniques.filter(t=>t.subject===sub.subject_name).reduce((s,t)=>s+(t.session_duration||0),0);
            const arMins   = data.activeRecall.filter(t=>t.subject_name===sub.subject_name).reduce((s,t)=>s+(t.session_duration||0),0);
            const blMins   = data.blurting.filter(t=>t.subject_name===sub.subject_name).reduce((s,t)=>s+(t.session_duration||0),0);
            const totalMins = techMins + arMins + blMins;
            const cards    = data.flashcards.filter(f=>f.subject_name===sub.subject_name);
            const mastered = cards.filter(f=>((f.review_count_good||0)+(f.review_count_easy||0))>=3).length;
            const weak     = cards.filter(f=>f.is_weak_spot).length;
            const quizzes  = data.quizzes.filter(q=>q.quiz_title?.toLowerCase().includes(sub.subject_name.toLowerCase()));
            const quizAvg  = quizzes.length > 0 ? Math.round(quizzes.reduce((s,q)=>s+(q.adjusted_score ?? q.score),0)/quizzes.length) : null;
            const uniqueDays = new Set([
                ...data.techniques.filter(t=>t.subject===sub.subject_name).map(t=>t.date),
                ...data.activeRecall.filter(t=>t.subject_name===sub.subject_name).map(t=>t.date),
            ].filter(Boolean)).size;
            return {
                name: sub.subject_name, code: sub.subject_code, color: subjectColor(sub),
                target: sub.goal_study_score, priority: sub.priority,
                totalMins, quizAvg, cards: cards.length, mastered, weak,
                sessions: data.techniques.filter(t=>t.subject===sub.subject_name).length + data.activeRecall.filter(t=>t.subject_name===sub.subject_name).length,
                uniqueDays
            };
        }).sort((a,b) => b.totalMins - a.totalMins);
    }, [data]);

    // ── Flashcard Health ──────────────────────────────────────────────────────
    const fcHealth = useMemo(() => {
        const total   = data.flashcards.length;
        const mastered= data.flashcards.filter(f=>(f.review_count_good||0)+(f.review_count_easy||0)>=3&&!f.is_weak_spot).length;
        const weak    = data.flashcards.filter(f=>f.is_weak_spot).length;
        const today   = new Date().toISOString().split('T')[0];
        const due     = data.flashcards.filter(f=>!f.next_review_date || f.next_review_date <= today).length;
        const unreviewed = data.flashcards.filter(f=>(f.total_reviews||0)===0).length;
        return { total, mastered, weak, due, unreviewed };
    }, [data.flashcards]);

    // ── Insight Generator ─────────────────────────────────────────────────────
    const insights = useMemo(() => {
        const list = [];
        if (metrics.consistency < 30) list.push({ type: 'warn', text: `You only studied on ${metrics.uniqueDays} of ${metrics.rangedays} days. Aim for daily habits — even 20 minutes counts.` });
        else if (metrics.consistency >= 70) list.push({ type: 'good', text: `Excellent consistency! ${metrics.uniqueDays} study days recorded this period.` });
        if (metrics.quizAvg > 0 && metrics.quizAvg < 60) list.push({ type: 'warn', text: `Your quiz average is ${metrics.quizAvg}%. Review weak areas with Active Recall or targeted flashcards.` });
        else if (metrics.quizAvg >= 85) list.push({ type: 'good', text: `Outstanding quiz average of ${metrics.quizAvg}%! Keep reinforcing with spaced repetition.` });
        if (fcHealth.weak > 5) list.push({ type: 'warn', text: `You have ${fcHealth.weak} weak-spot flashcards. Prioritise these in your next review session.` });
        if (fcHealth.unreviewed > 10) list.push({ type: 'info', text: `${fcHealth.unreviewed} flashcards have never been reviewed. Start a session to activate them.` });
        const dominated = techBreakdown.find(t => metrics.totalMins > 0 && (t.mins/metrics.totalMins) > 0.7);
        if (dominated && techBreakdown.length > 1) list.push({ type: 'info', text: `${dominated.label} accounts for ${Math.round((dominated.mins/metrics.totalMins)*100)}% of your study time. Mix in other techniques for better retention.` });
        const neglectedSubject = subjectData.find(s => s.totalMins === 0);
        if (neglectedSubject) list.push({ type: 'warn', text: `No study sessions recorded for ${neglectedSubject.name} this period. Don't let it fall behind!` });
        if (metrics.totalMins === 0) list.push({ type: 'info', text: `No study data for this period yet. Start a session to see your analytics.` });
        return list.slice(0, 5);
    }, [metrics, fcHealth, techBreakdown, subjectData]);

    // ── Week-over-week derived stats (for hero + coach) ───────────────────────
    const weekStats = useMemo(() => {
        const today = new Date();
        const weekStart = startOfWeek(today);
        const lastWeekStart = subDays(weekStart, 7);
        const lastWeekEnd = subDays(weekStart, 1);

        const inRange = (s, start, end) => {
            if (!s.date) return false;
            const d = new Date(s.date);
            return d >= start && d <= end;
        };
        const sumMins = (arr, key, start, end) =>
            arr.filter(s => inRange(s, start, end)).reduce((a, s) => a + (s[key] || 0), 0);

        const thisWeekMins =
            sumMins(data.techniques, 'session_duration', weekStart, today) +
            sumMins(data.activeRecall, 'session_duration', weekStart, today) +
            sumMins(data.blurting, 'session_duration', weekStart, today) +
            sumMins(data.studySessions, 'duration_minutes', weekStart, today);

        const lastWeekMins =
            sumMins(data.techniques, 'session_duration', lastWeekStart, lastWeekEnd) +
            sumMins(data.activeRecall, 'session_duration', lastWeekStart, lastWeekEnd) +
            sumMins(data.blurting, 'session_duration', lastWeekStart, lastWeekEnd) +
            sumMins(data.studySessions, 'duration_minutes', lastWeekStart, lastWeekEnd);

        const thisWeekSess =
            data.techniques.filter(s => inRange(s, weekStart, today)).length +
            data.activeRecall.filter(s => inRange(s, weekStart, today)).length +
            data.blurting.filter(s => inRange(s, weekStart, today)).length +
            data.quizzes.filter(s => inRange(s, weekStart, today)).length;

        const weekDelta = lastWeekMins > 0
            ? Math.round(((thisWeekMins - lastWeekMins) / lastWeekMins) * 100)
            : (thisWeekMins > 0 ? null : null);

        return { thisWeekMins, lastWeekMins, thisWeekSess, weekDelta };
    }, [data]);

    // ── Quiz delta (recent half vs older half) ────────────────────────────────
    const quizDelta = useMemo(() => {
        if (data.quizzes.length < 4) return null;
        const sorted = data.quizzes.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const mid = Math.floor(sorted.length / 2);
        const older = sorted.slice(0, mid);
        const newer = sorted.slice(mid);
        const olderAvg = Math.round(older.reduce((s, q) => s + (q.adjusted_score ?? q.score), 0) / older.length);
        const newerAvg = Math.round(newer.reduce((s, q) => s + (q.adjusted_score ?? q.score), 0) / newer.length);
        return newerAvg - olderAvg;
    }, [data.quizzes]);

    // ── Best subject (highest quiz avg with study time) ───────────────────────
    const bestSubjectName = useMemo(() => {
        const candidate = subjectData.find(s => s.quizAvg !== null && s.quizAvg >= 75 && s.totalMins > 0);
        return candidate?.name || null;
    }, [subjectData]);

    const tabs = [
        { id: "overview",  label: "Overview",   icon: BarChart3 },
        // Everything else on this page answers "how much did I do". Cognition
        // answers "is any of it sticking", which is a different question and
        // the only one that predicts a result.
        { id: "cognition", label: "Cognition",  icon: Brain },
        { id: "subjects",  label: "Subjects",   icon: BookOpen },
        { id: "flashcards",label: "Flashcards", icon: Layers },
        { id: "ai",        label: "AI Coach",   icon: Sparkles },
    ];

    // KPI tile static lookup — avoids dynamic Tailwind class strings.
    const KPI_TILES = [
        { label: "Study Time",   val: fmt(metrics.totalMins),   icon: Clock,    iconBg: "bg-chart-3/10",  iconColor: "text-chart-3" },
        { label: "Sessions",     val: metrics.totalSess,         icon: Activity, iconBg: "bg-chart-4/10",  iconColor: "text-chart-4" },
        { label: "Consistency",  val: `${metrics.consistency}%`, icon: Flame,    iconBg: metrics.consistency>=60 ? "bg-primary/10" : "bg-streak/10", iconColor: metrics.consistency>=60 ? "text-primary" : "text-streak" },
        { label: "Quiz Avg",     val: `${metrics.quizAvg}%`,     icon: Award,    iconBg: metrics.quizAvg>=70    ? "bg-primary/10" : "bg-xp/10",     iconColor: metrics.quizAvg>=70    ? "text-primary" : "text-xp" },
        { label: "FC Mastery",   val: `${metrics.fcMastery}%`,   icon: Brain,    iconBg: "bg-chart-4/10",  iconColor: "text-chart-4" },
        { label: "Days Studied", val: metrics.uniqueDays,         icon: Calendar, iconBg: "bg-xp/10",       iconColor: "text-xp" },
    ];

    // ── Coach line + featured insight ─────────────────────────────────────────
    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const streakDays = userProfile?.streak_days || 0;
    const hour = new Date().getHours();
    const coachLine = getCoachLine({
        name: firstName,
        hour,
        totalMins: metrics.totalMins,
        totalSess: metrics.totalSess,
        weekDelta: weekStats.weekDelta,
        quizAvg: metrics.quizAvg,
        quizDelta,
        streakDays,
        bestSubject: bestSubjectName,
    });

    const featured = useMemo(() => getFeaturedInsight({
        metrics, techBreakdown, subjectData, quizDelta, weekDelta: weekStats.weekDelta, streakDays,
    }), [metrics, techBreakdown, subjectData, quizDelta, weekStats.weekDelta, streakDays]);
    const FeaturedIcon = featured.icon;
    const featuredTheme = FEATURED_THEME[featured.accent] || FEATURED_THEME["chart-3"];

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-chart-3/10 flex items-center justify-center shadow-soft animate-pulse">
                    <BarChart3 className="w-6 h-6 text-chart-3" />
                </div>
                <p className="text-sm text-muted-foreground">Loading your analytics...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">Insights</span>
                            {metrics.totalSess > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-3">
                                        <Activity className="w-3.5 h-3.5" /> {metrics.totalSess} sessions
                                    </span>
                                </>
                            )}
                            {streakDays > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-streak">
                                        <Flame className="w-3.5 h-3.5" /> {streakDays}d
                                    </span>
                                </>
                            )}
                            {metrics.quizAvg > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-primary">
                                        <Award className="w-3.5 h-3.5" /> {metrics.quizAvg}% avg
                                    </span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Analytics" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── ACEDIT ATAR ─────────────────────────────────────── */}
                {/* Everything below this measures inputs. This is the score they
                    all feed, and Analytics had no idea it existed. */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                    <AtarPanel
                        atar={ranked?.my_atar ?? (userProfile?.acedit_atar != null ? Number(userProfile.acedit_atar) : null)}
                        band={ranked?.my_band}
                        components={ranked?.my_components || userProfile?.atar_components}
                        history={userProfile?.extra?.atar_history || []}
                        goalAtar={userProfile?.goal_atar ? Number(userProfile.goal_atar) : null}
                    />
                </motion.section>

                {/* ── HERO ROW: Biggest insight (3/5) + This week stats (2/5) ── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    {/* Biggest insight */}
                    <div className="md:col-span-3">
                        <div className="relative overflow-hidden rounded-3xl bg-chart-3/10 border-2 border-chart-3/25 p-6 lg:p-8 h-full">
                            <BarChart3 className="absolute -top-4 -right-4 w-32 h-32 text-chart-3/10 pointer-events-none" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-chart-3/15 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-chart-3" />
                                    </div>
                                    <p className="stat-label text-chart-3/80">Biggest insight</p>
                                </div>
                                {bestSubjectName ? (
                                    <>
                                        <h2
                                            className="font-display font-extrabold text-foreground leading-[1.05] mb-3"
                                            style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)' }}
                                        >
                                            {bestSubjectName} is leading the pack
                                        </h2>
                                        <p className="text-foreground/80 text-sm lg:text-base font-medium leading-snug max-w-md">
                                            Your strongest subject by quiz score this period. Keep building on what's working.
                                        </p>
                                    </>
                                ) : metrics.totalSess === 0 ? (
                                    <>
                                        <h2
                                            className="font-display font-extrabold text-foreground leading-[1.05] mb-3"
                                            style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)' }}
                                        >
                                            No data yet — log a session to begin
                                        </h2>
                                        <p className="text-foreground/80 text-sm lg:text-base font-medium leading-snug max-w-md">
                                            Your strongest subject, top technique, and trend lines will surface here once you have a few sessions logged.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h2
                                            className="font-display font-extrabold text-foreground leading-[1.05] mb-3"
                                            style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)' }}
                                        >
                                            {metrics.uniqueDays} of {metrics.rangedays} days studied
                                        </h2>
                                        <p className="text-foreground/80 text-sm lg:text-base font-medium leading-snug max-w-md">
                                            {metrics.consistency >= 70
                                                ? "Consistency is your edge — keep showing up."
                                                : metrics.consistency >= 40
                                                    ? "Solid base — small steps compound."
                                                    : "More days, more signal. Even 20 minutes counts."}
                                        </p>
                                    </>
                                )}
                                <div className="flex flex-wrap gap-2 mt-5">
                                    <span className="pill bg-chart-3/15 text-chart-3">
                                        <Activity className="w-3 h-3" /> {metrics.totalSess} sessions
                                    </span>
                                    <span className="pill bg-chart-3/15 text-chart-3">
                                        <Clock className="w-3 h-3" /> {fmt(metrics.totalMins)}
                                    </span>
                                    {metrics.quizAvg > 0 && (
                                        <span className="pill bg-chart-3/15 text-chart-3">
                                            <Award className="w-3 h-3" /> {metrics.quizAvg}% avg
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* This week stats */}
                    <div className="md:col-span-2">
                        <div className="rounded-3xl bg-primary/10 border-2 border-primary/25 p-6 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <p className="stat-label text-primary/80">This week</p>
                            </div>
                            <p className="font-display font-extrabold text-foreground leading-none" style={{ fontSize: 'clamp(2.25rem, 5.5vw, 3rem)' }}>
                                {fmt(weekStats.thisWeekMins)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 leading-snug">
                                {weekStats.thisWeekMins === 0
                                    ? "Nothing logged this week yet."
                                    : weekStats.weekDelta == null
                                        ? "First week of data — keep it going."
                                        : weekStats.weekDelta > 0
                                            ? `Up ${weekStats.weekDelta}% vs last week.`
                                            : weekStats.weekDelta === 0
                                                ? "Same pace as last week."
                                                : `${Math.abs(weekStats.weekDelta)}% lighter than last week.`}
                            </p>
                            <div className="space-y-2.5 mt-4 pt-4 border-t-2 border-primary/15">
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">Sessions</p>
                                    <p className="text-xs font-bold text-foreground">{weekStats.thisWeekSess}</p>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">Last week</p>
                                    <p className="text-xs font-bold text-foreground">{fmt(weekStats.lastWeekMins)}</p>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground">Vs last week</p>
                                    <p className={`text-xs font-bold ${
                                        weekStats.weekDelta == null ? 'text-muted-foreground'
                                            : weekStats.weekDelta > 0 ? 'text-primary'
                                                : weekStats.weekDelta < 0 ? 'text-streak'
                                                    : 'text-foreground'
                                    }`}>
                                        {weekStats.weekDelta == null ? '—'
                                            : weekStats.weekDelta > 0 ? `+${weekStats.weekDelta}%`
                                                : `${weekStats.weekDelta}%`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── FEATURED INSIGHT PANEL ──────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className={`rounded-2xl ${featuredTheme.bg} border-2 ${featuredTheme.border} p-5 lg:p-6`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl ${featuredTheme.iconBg} flex items-center justify-center flex-shrink-0`}>
                                <FeaturedIcon className={`w-6 h-6 ${featuredTheme.iconText}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="stat-label mb-1">Today's signal · {featured.label}</p>
                                <h2 className="font-display font-extrabold text-foreground text-base lg:text-lg leading-snug">
                                    {featured.title}
                                </h2>
                                <p className="text-muted-foreground text-sm mt-0.5">{featured.sub}</p>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── WEAK TOPICS ─────────────────────────────────────── */}
                {/* The page counted weak cards and stopped there. Naming the
                    topics and handing each one a paper is the difference
                    between a statistic and a next action. */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                    data-ace-target="weak">
                    <WeakTopicsPanel flashcards={data.flashcards} />
                </motion.section>

                {/* Analytics is six charts deep and the only section that says
                    what to DO is this one. He walks to it, which is worth more
                    than another highlight colour. */}
                <AceRoam target="[data-ace-target='weak']" pose="point" />

                {/* ── Time range selector ── */}
                <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} className="flex justify-end">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-44 bg-surface border-border rounded-xl">
                            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="3months">Last 3 Months</SelectItem>
                            <SelectItem value="year">This Year</SelectItem>
                        </SelectContent>
                    </Select>
                </motion.div>

                {/* ── KPI Strip ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {KPI_TILES.map(({ label, val, icon: Icon, iconBg, iconColor }) => (
                        <motion.div key={label} initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
                            className="card-soft p-4 flex flex-col gap-2">
                            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
                                <Icon className={`w-4 h-4 ${iconColor}`} />
                            </div>
                            <p className="font-display font-extrabold text-2xl text-foreground leading-none">{val}</p>
                            <p className="stat-label">{label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* ── Insight Cards ── */}
                {insights.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {insights.map((ins, i) => {
                            const theme = INSIGHT_CARD[ins.type] || INSIGHT_CARD.info;
                            const ThemeIcon = theme.Icon;
                            return (
                                <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.05 }}
                                    className={`rounded-2xl p-4 flex items-start gap-3 border ${theme.box}`}>
                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${theme.iconBox}`}>
                                        <ThemeIcon className={`w-4 h-4 ${theme.iconColor}`} />
                                    </div>
                                    <p className="text-sm text-foreground leading-relaxed">{ins.text}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* ── Tabs ── */}
                {/* Scrolls rather than overflowing. Five tabs with icons and
                    labels is 480px of content in a 390px viewport, and w-fit on
                    a flex row simply pushed it off the right of the page. */}
                <div className="flex gap-1 card-soft p-1 w-fit max-w-full overflow-x-auto scrollbar-none">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
                                activeTab === id
                                    ? "bg-chart-3 text-white shadow-soft"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>

                {/* ══ OVERVIEW TAB ══ */}
                {activeTab === "overview" && (
                    <div className="space-y-5">
                        {/* Daily Study Chart */}
                        <div className="card-soft p-6">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                                        <TrendingUp className="w-5 h-5 text-chart-3" />
                                    </div>
                                    <div>
                                        <h2 className="font-display font-extrabold text-foreground text-base">Daily Study Time</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">Hours per day across all techniques</p>
                                    </div>
                                </div>
                                <span className="pill bg-secondary text-muted-foreground">{fmt(metrics.totalMins)} total</span>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={dailyData} margin={{ top:5, right:10, bottom:0, left:-10 }}>
                                    <defs>
                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={TOKEN_HSL.chart3} stopOpacity={0.25}/>
                                            <stop offset="95%" stopColor={TOKEN_HSL.chart3} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                                    <XAxis dataKey="date" tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}h`} />
                                    <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid hsl(220, 13%, 91%)', boxShadow:'0 4px 20px rgba(13,22,38,0.08)' }}
                                        formatter={v=>[fmt(v*60), 'Study Time']} />
                                    <Area type="monotone" dataKey="hours" stroke={TOKEN_HSL.chart3} strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r:4, fill:TOKEN_HSL.chart3 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Technique breakdown */}
                            <div className="card-soft p-6">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                                        <Layers className="w-5 h-5 text-chart-4" />
                                    </div>
                                    <div>
                                        <h2 className="font-display font-extrabold text-foreground text-base">Technique Breakdown</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">How you distribute your study time</p>
                                    </div>
                                </div>
                                {techBreakdown.length === 0 ? (
                                    <div className="flex flex-col items-center text-center gap-3 py-8">
                                        <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center">
                                            <Layers className="w-5 h-5 text-chart-4" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground text-sm">No technique data yet</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 max-w-[240px]">Try Pomodoro, Active Recall or Blurting — we'll track your mix here.</p>
                                        </div>
                                        <Link to={createPageUrl("Study")}>
                                            <Button size="sm" className="gap-1.5">
                                                <Brain className="w-3.5 h-3.5" />
                                                Pick a technique
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {techBreakdown.sort((a,b)=>b.mins-a.mins).map(t => {
                                            const pct = metrics.totalMins > 0 ? Math.round((t.mins/metrics.totalMins)*100) : 0;
                                            return (
                                                <div key={t.key}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                                            <span className="text-sm font-medium text-foreground">{t.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs text-muted-foreground">{t.sessions} sessions</span>
                                                            <span className="text-sm font-bold text-foreground">{fmt(t.mins)}</span>
                                                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:0.8, ease:"easeOut" }}
                                                            className="h-full rounded-full" style={{ backgroundColor: t.color }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Quiz trend */}
                            <div className="card-soft p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                                            <Target className="w-5 h-5 text-chart-3" />
                                        </div>
                                        <div>
                                            <h2 className="font-display font-extrabold text-foreground text-base">Quiz Performance</h2>
                                            <p className="text-xs text-muted-foreground mt-0.5">Score trend over time</p>
                                        </div>
                                    </div>
                                    {data.quizzes.length > 0 && <span className="pill bg-chart-3/10 text-chart-3">{data.quizzes.length} quizzes</span>}
                                </div>
                                {quizTrend.length < 2 ? (
                                    <div className="flex flex-col items-center text-center gap-3 py-8">
                                        <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
                                            <Target className="w-5 h-5 text-chart-3" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground text-sm">
                                                {quizTrend.length === 0 ? "No quizzes yet" : "One down, one to go"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5 max-w-[240px]">
                                                {quizTrend.length === 0
                                                    ? "Take a couple of quizzes and your score trend turns up here."
                                                    : "Take one more quiz to start your score trend."}
                                            </p>
                                        </div>
                                        <Link to={createPageUrl("Quizzes")}>
                                            <Button size="sm" className="gap-1.5">
                                                <FileQuestion className="w-3.5 h-3.5" />
                                                {quizTrend.length === 0 ? "Try a quiz" : "Take another"}
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={quizTrend} margin={{ top:5, right:10, bottom:0, left:-10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                                            <XAxis dataKey="n" tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                                            <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid hsl(220, 13%, 91%)' }} formatter={v=>[`${v}%`, 'Score']} />
                                            <Line type="monotone" dataKey="score" stroke={TOKEN_HSL.chart3} strokeWidth={2.5} dot={{ r:3, fill:TOKEN_HSL.chart3 }} activeDot={{ r:5 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                                {data.quizzes.length > 0 && (
                                    <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                                        <div>
                                            <p className="text-xl font-bold text-foreground">{metrics.quizAvg}%</p>
                                            <p className="text-xs text-muted-foreground">Average</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-foreground">{Math.max(...data.quizzes.map(q=>(q.adjusted_score ?? q.score)))}%</p>
                                            <p className="text-xs text-muted-foreground">Best</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-foreground">{Math.min(...data.quizzes.map(q=>(q.adjusted_score ?? q.score)))}%</p>
                                            <p className="text-xs text-muted-foreground">Lowest</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-foreground">{data.quizzes.length}</p>
                                            <p className="text-xs text-muted-foreground">Total</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subject time chart */}
                        {subjectData.some(s=>s.totalMins>0) && (
                            <div className="card-soft p-6">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                                        <BookOpen className="w-5 h-5 text-chart-3" />
                                    </div>
                                    <div>
                                        <h2 className="font-display font-extrabold text-foreground text-base">Time Per Subject</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">Minutes studied across your enrolled subjects</p>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={subjectData.filter(s=>s.totalMins>0)} margin={{ top:0, right:10, bottom:0, left:-10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                                        <XAxis dataKey="name" tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false}
                                            tickFormatter={n => n.length>8?n.slice(0,8)+'…':n} />
                                        <YAxis tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/60)}h`} />
                                        <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid hsl(220, 13%, 91%)' }} formatter={v=>[fmt(v),'Study Time']} />
                                        <Bar dataKey="totalMins" radius={[6,6,0,0]}>
                                            {subjectData.filter(s=>s.totalMins>0).map((s,i)=>(
                                                <Cell key={i} fill={s.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ COGNITION TAB ══ */}
                {/* Flashcards are deliberately NOT windowed by the range picker:
                    memory state is cumulative, and a card's interval is what it
                    is regardless of which month you're looking at. Techniques
                    and sessions are windowed, because "how you studied" is a
                    question about a period. */}
                {activeTab === "cognition" && (
                    <div className="space-y-5">
                        <CognitiveProfilePanel
                            techniques={data.techniques}
                            cards={data.flashcards}
                            sessions={data.studySessions}
                        />
                        <MemoryPanel techniques={data.techniques} cards={data.flashcards} />
                        <AttentionPanel techniques={data.techniques} sessions={data.studySessions} />
                    </div>
                )}

                {/* ══ SUBJECTS TAB ══ */}
                {activeTab === "subjects" && (
                    <div className="space-y-4">
                        {subjectData.length === 0 ? (
                            <div className="card-soft p-16 flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <BookOpen className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="font-display font-extrabold text-foreground">No subjects yet</p>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">Add the subjects you're studying so we can break your time, scores and streaks down by class.</p>
                                </div>
                                <Link to={createPageUrl("Subjects")}>
                                    <Button size="sm" className="gap-1.5">
                                        <BookOpen className="w-3.5 h-3.5" />
                                        Add subjects
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {subjectData.map(sub => {
                                        const fcPct = sub.cards > 0 ? Math.round((sub.mastered/sub.cards)*100) : 0;
                                        const priorityClass = PRIORITY_PILL[sub.priority] || PRIORITY_PILL.medium;
                                        const quizTileClass = sub.quizAvg === null
                                            ? "bg-secondary"
                                            : sub.quizAvg >= 70 ? "bg-primary/10" : "bg-streak/10";
                                        const quizTextClass = sub.quizAvg === null
                                            ? "text-muted-foreground/60"
                                            : sub.quizAvg >= 70 ? "text-primary" : "text-streak";
                                        return (
                                            <motion.div key={sub.name} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                                                className="card-soft overflow-hidden hover:shadow-soft transition-shadow">
                                                <div className="h-1.5" style={{ backgroundColor: sub.color }} />
                                                <div className="p-5 space-y-4">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h3 className="font-display font-extrabold text-foreground">{sub.name}</h3>
                                                            {sub.target && <p className="text-xs text-muted-foreground mt-0.5">Target: {sub.target}/50</p>}
                                                        </div>
                                                        <span className={`pill ${priorityClass}`}>
                                                            {sub.priority || 'medium'}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div className="bg-secondary/50 rounded-xl p-2.5">
                                                            <p className="text-base font-bold text-foreground">{fmt(sub.totalMins)}</p>
                                                            <p className="text-xs text-muted-foreground">Study</p>
                                                        </div>
                                                        <div className="bg-secondary/50 rounded-xl p-2.5">
                                                            <p className="text-base font-bold text-foreground">{sub.uniqueDays}d</p>
                                                            <p className="text-xs text-muted-foreground">Days</p>
                                                        </div>
                                                        <div className={`rounded-xl p-2.5 ${quizTileClass}`}>
                                                            <p className={`text-base font-bold ${quizTextClass}`}>
                                                                {sub.quizAvg !== null ? `${sub.quizAvg}%` : '—'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">Quiz</p>
                                                        </div>
                                                    </div>
                                                    {sub.cards > 0 && (
                                                        <div>
                                                            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                                                                <span>Flashcard mastery</span>
                                                                <span className="font-semibold">{sub.mastered}/{sub.cards} ({fcPct}%)</span>
                                                            </div>
                                                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                                <motion.div initial={{ width:0 }} animate={{ width:`${fcPct}%` }} transition={{ duration:0.8 }}
                                                                    className="h-full rounded-full" style={{ backgroundColor: sub.color }} />
                                                            </div>
                                                            {sub.weak > 0 && (
                                                                <p className="text-xs text-xp mt-1.5 flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" /> {sub.weak} weak-spot cards need review
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {sub.totalMins === 0 && (
                                                        <p className="text-xs text-streak flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" /> No study recorded this period
                                                        </p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Subject comparison chart */}
                                {subjectData.some(s=>s.quizAvg!==null) && (
                                    <div className="card-soft p-6">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                                                <Award className="w-5 h-5 text-chart-3" />
                                            </div>
                                            <div>
                                                <h2 className="font-display font-extrabold text-foreground text-base">Quiz Avg by Subject</h2>
                                                <p className="text-xs text-muted-foreground mt-0.5">Compare average quiz performance across subjects</p>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={subjectData.filter(s=>s.quizAvg!==null)} margin={{ top:0, right:10, bottom:0, left:-10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                                                <XAxis dataKey="name" tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false}
                                                    tickFormatter={n=>n.length>8?n.slice(0,8)+'…':n} />
                                                <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                                                <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid hsl(220, 13%, 91%)' }} formatter={v=>[`${v}%`,'Quiz Avg']} />
                                                <Bar dataKey="quizAvg" radius={[6,6,0,0]}>
                                                    {subjectData.filter(s=>s.quizAvg!==null).map((s,i)=>(
                                                        <Cell key={i} fill={s.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ══ FLASHCARDS TAB ══ */}
                {activeTab === "flashcards" && (
                    <div className="space-y-5">
                        {/* Health KPIs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {[
                                { key:"total",      label:"Total Cards",    val:fcHealth.total },
                                { key:"mastered",   label:"Mastered",       val:fcHealth.mastered },
                                { key:"due",        label:"Due Today",      val:fcHealth.due },
                                { key:"weak",       label:"Weak Spots",     val:fcHealth.weak },
                                { key:"unreviewed", label:"Never Reviewed", val:fcHealth.unreviewed },
                            ].map(k => (
                                <div key={k.label} className={`rounded-2xl p-4 ${FC_KPI_THEME[k.key]}`}>
                                    <p className="font-display font-extrabold text-2xl">{k.val}</p>
                                    <p className="text-xs font-medium mt-0.5 opacity-70">{k.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Mastery per subject */}
                        <div className="card-soft p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Brain className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="font-display font-extrabold text-foreground text-base">Mastery by Subject</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">How well you know your flashcards in each subject</p>
                                </div>
                            </div>
                            {subjectData.filter(s=>s.cards>0).length === 0 ? (
                                <div className="flex flex-col items-center text-center gap-3 py-8">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Layers className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground text-sm">No flashcards yet</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[240px]">Make a deck or let AI build one from your notes — mastery shows up here.</p>
                                    </div>
                                    <Link to={createPageUrl("Study")}>
                                        <Button size="sm" className="gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Make a deck
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {subjectData.filter(s=>s.cards>0).map(sub => {
                                        const pct = Math.round((sub.mastered/sub.cards)*100);
                                        const weakPct = Math.round((sub.weak/sub.cards)*100);
                                        return (
                                            <div key={sub.name}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:sub.color }} />
                                                        <span className="text-sm font-semibold text-foreground">{sub.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        {sub.weak > 0 && <span className="text-xp flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {sub.weak} weak</span>}
                                                        <span className="font-bold text-foreground">{pct}% mastered</span>
                                                        <span>{sub.mastered}/{sub.cards}</span>
                                                    </div>
                                                </div>
                                                <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
                                                    <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:0.8 }}
                                                        className="h-full rounded-full absolute left-0" style={{ backgroundColor:sub.color }} />
                                                    {sub.weak > 0 && (
                                                        <motion.div initial={{ width:0 }} animate={{ width:`${weakPct}%` }} transition={{ duration:0.8, delay:0.1 }}
                                                            className="h-full rounded-full absolute right-0 bg-xp opacity-60" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Rating distribution */}
                        {data.flashcards.some(f => (f.total_reviews||0)>0) && (
                            <div className="card-soft p-6">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                                        <Activity className="w-5 h-5 text-chart-4" />
                                    </div>
                                    <div>
                                        <h2 className="font-display font-extrabold text-foreground text-base">Rating Distribution</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">Cumulative ratings across all cards</p>
                                    </div>
                                </div>
                                {(() => {
                                    const again = data.flashcards.reduce((s,f)=>s+(f.review_count_again||0),0);
                                    const hard  = data.flashcards.reduce((s,f)=>s+(f.review_count_hard||0),0);
                                    const good  = data.flashcards.reduce((s,f)=>s+(f.review_count_good||0),0);
                                    const easy  = data.flashcards.reduce((s,f)=>s+(f.review_count_easy||0),0);
                                    const total = again+hard+good+easy;
                                    if (total===0) return <p className="text-sm text-muted-foreground/60">No reviews yet</p>;
                                    return (
                                        <div className="space-y-3">
                                            {[
                                                { label:"Again", count:again, color:TOKEN_HSL.streak },
                                                { label:"Hard",  count:hard,  color:TOKEN_HSL.xp },
                                                { label:"Good",  count:good,  color:TOKEN_HSL.chart3 },
                                                { label:"Easy",  count:easy,  color:TOKEN_HSL.primary },
                                            ].map(r => (
                                                <div key={r.label}>
                                                    <div className="flex justify-between text-sm mb-1.5">
                                                        <span className="font-medium text-foreground">{r.label}</span>
                                                        <span className="text-muted-foreground">{r.count} ({Math.round((r.count/total)*100)}%)</span>
                                                    </div>
                                                    <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                                                        <motion.div initial={{ width:0 }} animate={{ width:`${Math.round((r.count/total)*100)}%` }} transition={{ duration:0.8 }}
                                                            className="h-full rounded-full" style={{ backgroundColor:r.color }} />
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="pt-3 border-t border-border flex gap-6 text-sm">
                                                <div><span className="font-bold text-foreground">{total}</span> <span className="text-muted-foreground">total reviews</span></div>
                                                <div><span className="font-bold text-primary">{Math.round(((good+easy)/total)*100)}%</span> <span className="text-muted-foreground">success rate</span></div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Advice */}
                        <div className="card-soft p-6 bg-chart-4/5 border-chart-4/20 space-y-3">
                            <h2 className="font-display font-extrabold text-foreground flex items-center gap-2"><Star className="w-4 h-4 text-chart-4" /> Flashcard Recommendations</h2>
                            {fcHealth.due > 20 && <p className="text-sm text-foreground">• You have <strong>{fcHealth.due}</strong> cards due — schedule a review session today to stay on top of spaced repetition.</p>}
                            {fcHealth.weak > 0 && <p className="text-sm text-foreground">• Focus your next session on the <strong>{fcHealth.weak} weak-spot cards</strong> — these are the ones you keep getting wrong.</p>}
                            {fcHealth.unreviewed > 0 && <p className="text-sm text-foreground">• <strong>{fcHealth.unreviewed} cards</strong> have never been reviewed. Start activating them before they pile up.</p>}
                            {fcHealth.mastered > 0 && fcHealth.mastered === fcHealth.total && <p className="text-sm text-primary font-medium">• You've mastered all your flashcards! Consider adding more from your notes.</p>}
                            {fcHealth.total === 0 && <p className="text-sm text-muted-foreground">No flashcards yet. Use AI Generate in the Study page to create a full deck from your notes.</p>}
                        </div>
                    </div>
                )}

                {/* ══ AI COACH TAB ══ */}
                {activeTab === "ai" && (
                    <AIPerformanceAnalyzer data={data} userProfile={userProfile} />
                )}
            </div>
        </div>
    );
}
