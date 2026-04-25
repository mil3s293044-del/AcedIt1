import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BarChart3, TrendingUp, Clock, Brain, Target, Calendar, Award,
    Zap, BookOpen, Activity, Flame, ChevronRight, ArrowUpRight,
    ArrowDownRight, Minus, Layers, CheckCircle2, AlertTriangle,
    Sparkles, RotateCcw, Star
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
    StudyTechnique, QuizAttempt, Flashcard, ActiveRecallSession,
    BlurtingSession, UserSubject, UserProfile, StudySession
} from "@/entities/all";
import {
    format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, differenceInDays
} from "date-fns";
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import AIPerformanceAnalyzer from "../components/analytics/AIPerformanceAnalyzer";
import HelpButton from "@/components/shared/HelpButton";

const fmt = (mins) => {
    if (!mins) return "0m";
    const h = Math.floor(mins / 60), m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const TECHNIQUE_META = {
    pomodoro:          { label: "Pomodoro",         color: "#10B981", bg: "bg-emerald-500" },
    spaced_repetition: { label: "Spaced Rep.",       color: "#6366F1", bg: "bg-indigo-500" },
    active_recall:     { label: "Active Recall",     color: "#8B5CF6", bg: "bg-violet-500" },
    blurting:          { label: "Blurting",          color: "#F59E0B", bg: "bg-amber-500" },
    quizzes:           { label: "Quizzes",           color: "#EC4899", bg: "bg-pink-500" },
};

const StatPill = ({ value, prev }) => {
    if (prev === null || prev === undefined) return null;
    const diff = value - prev;
    if (diff === 0) return <span className="flex items-center gap-0.5 text-xs text-slate-400"><Minus className="w-3 h-3" /> same</span>;
    if (diff > 0) return <span className="flex items-center gap-0.5 text-xs text-emerald-500"><ArrowUpRight className="w-3 h-3" /> {diff > 0 ? "+" : ""}{typeof diff === "number" && diff % 1 !== 0 ? diff.toFixed(1) : diff}</span>;
    return <span className="flex items-center gap-0.5 text-xs text-rose-500"><ArrowDownRight className="w-3 h-3" /> {typeof diff === "number" && diff % 1 !== 0 ? diff.toFixed(1) : diff}</span>;
};

export default function Analytics() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
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
        const quizAvg     = data.quizzes.length > 0 ? Math.round(data.quizzes.reduce((s,q)=>s+q.score,0)/data.quizzes.length) : 0;
        const fcMastery   = data.flashcards.length > 0 ? Math.round((data.flashcards.filter(f=>(f.successfulReviews||0)>2).length/data.flashcards.length)*100) : 0;
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
            n: `#${i+1}`, score: q.score, date: q.date
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
            const mastered = cards.filter(f=>(f.successfulReviews||0)>=3).length;
            const weak     = cards.filter(f=>f.is_weak_spot).length;
            const quizzes  = data.quizzes.filter(q=>q.quiz_title?.toLowerCase().includes(sub.subject_name.toLowerCase()));
            const quizAvg  = quizzes.length > 0 ? Math.round(quizzes.reduce((s,q)=>s+q.score,0)/quizzes.length) : null;
            const uniqueDays = new Set([
                ...data.techniques.filter(t=>t.subject===sub.subject_name).map(t=>t.date),
                ...data.activeRecall.filter(t=>t.subject_name===sub.subject_name).map(t=>t.date),
            ].filter(Boolean)).size;
            return {
                name: sub.subject_name, code: sub.subject_code, color: sub.color || '#6366F1',
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
        const due     = data.flashcards.filter(f=>(f.session_skip_count||0)===0).length;
        const unreviewed = data.flashcards.filter(f=>(f.totalReviews||0)===0).length;
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

    const tabs = [
        { id: "overview",  label: "Overview",   icon: BarChart3 },
        { id: "subjects",  label: "Subjects",   icon: BookOpen },
        { id: "flashcards",label: "Flashcards", icon: Layers },
        { id: "ai",        label: "AI Coach",   icon: Sparkles },
    ];

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg animate-pulse">
                    <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-slate-500">Loading your analytics...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen">
            <div className="px-4 lg:px-8 py-6 w-full max-w-[1800px] mx-auto space-y-6">

                {/* ── Header ── */}
                <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Study Analytics</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Your complete performance picture</p>
                        </div>
                        <HelpButton page="Analytics" />
                    </div>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-44 bg-white border-slate-200 shadow-sm rounded-xl">
                            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
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
                    {[
                        { label: "Study Time",    val: fmt(metrics.totalMins),     icon: Clock,       accent: "from-blue-500 to-cyan-500" },
                        { label: "Sessions",      val: metrics.totalSess,           icon: Activity,    accent: "from-violet-500 to-purple-500" },
                        { label: "Consistency",   val: `${metrics.consistency}%`,   icon: Flame,       accent: metrics.consistency>=60?"from-emerald-500 to-teal-500":"from-orange-500 to-rose-500" },
                        { label: "Quiz Avg",      val: `${metrics.quizAvg}%`,       icon: Award,       accent: metrics.quizAvg>=70?"from-green-500 to-emerald-500":"from-amber-500 to-orange-500" },
                        { label: "FC Mastery",    val: `${metrics.fcMastery}%`,     icon: Brain,       accent: "from-indigo-500 to-violet-500" },
                        { label: "Days Studied",  val: metrics.uniqueDays,          icon: Calendar,    accent: "from-pink-500 to-rose-500" },
                    ].map(({ label, val, icon: Icon, accent }) => (
                        <motion.div key={label} initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-sm`}>
                                <Icon className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900 leading-none">{val}</p>
                            <p className="text-xs text-slate-500 font-medium">{label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* ── Insight Cards ── */}
                {insights.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {insights.map((ins, i) => (
                            <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.05 }}
                                className={`rounded-2xl p-4 flex items-start gap-3 border ${
                                    ins.type==='good' ? 'bg-emerald-50 border-emerald-100' :
                                    ins.type==='warn' ? 'bg-amber-50 border-amber-100' :
                                    'bg-blue-50 border-blue-100'
                                }`}>
                                <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    ins.type==='good' ? 'bg-emerald-100' :
                                    ins.type==='warn' ? 'bg-amber-100' : 'bg-blue-100'
                                }`}>
                                    {ins.type==='good'?<CheckCircle2 className="w-4 h-4 text-emerald-600"/>:ins.type==='warn'?<AlertTriangle className="w-4 h-4 text-amber-600"/>:<Zap className="w-4 h-4 text-blue-600"/>}
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{ins.text}</p>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* ── Tabs ── */}
                <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm w-fit">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                activeTab === id
                                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>

                {/* ══ OVERVIEW TAB ══ */}
                {activeTab === "overview" && (
                    <div className="space-y-5">
                        {/* Daily Study Chart */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h2 className="font-bold text-slate-900">Daily Study Time</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Hours per day across all techniques</p>
                                </div>
                                <Badge className="bg-slate-100 text-slate-600 border-0">{fmt(metrics.totalMins)} total</Badge>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={dailyData} margin={{ top:5, right:10, bottom:0, left:-10 }}>
                                    <defs>
                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.25}/>
                                            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                    <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}h`} />
                                    <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #E2E8F0', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}
                                        formatter={v=>[fmt(v*60), 'Study Time']} />
                                    <Area type="monotone" dataKey="hours" stroke="#7C3AED" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r:4, fill:'#7C3AED' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Technique breakdown */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 mb-1">Technique Breakdown</h2>
                                <p className="text-xs text-slate-400 mb-5">How you distribute your study time</p>
                                {techBreakdown.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-8">No study sessions recorded yet</p>
                                ) : (
                                    <div className="space-y-3">
                                        {techBreakdown.sort((a,b)=>b.mins-a.mins).map(t => {
                                            const pct = metrics.totalMins > 0 ? Math.round((t.mins/metrics.totalMins)*100) : 0;
                                            return (
                                                <div key={t.key}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                                            <span className="text-sm font-medium text-slate-700">{t.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs text-slate-400">{t.sessions} sessions</span>
                                                            <span className="text-sm font-bold text-slate-800">{fmt(t.mins)}</span>
                                                            <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <div className="flex items-center justify-between mb-1">
                                    <h2 className="font-bold text-slate-900">Quiz Performance</h2>
                                    {data.quizzes.length > 0 && <Badge className="bg-violet-50 text-violet-700 border-0">{data.quizzes.length} quizzes</Badge>}
                                </div>
                                <p className="text-xs text-slate-400 mb-5">Score trend over time</p>
                                {quizTrend.length < 2 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                                        <Target className="w-10 h-10 text-slate-200" />
                                        <p className="text-sm text-slate-400">Complete at least 2 quizzes to see your trend</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={quizTrend} margin={{ top:5, right:10, bottom:0, left:-10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis dataKey="n" tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                                            <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #E2E8F0' }} formatter={v=>[`${v}%`, 'Score']} />
                                            <Line type="monotone" dataKey="score" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r:3, fill:'#8B5CF6' }} activeDot={{ r:5 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                                {data.quizzes.length > 0 && (
                                    <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
                                        <div>
                                            <p className="text-xl font-bold text-slate-900">{metrics.quizAvg}%</p>
                                            <p className="text-xs text-slate-400">Average</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-slate-900">{Math.max(...data.quizzes.map(q=>q.score))}%</p>
                                            <p className="text-xs text-slate-400">Best</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-slate-900">{Math.min(...data.quizzes.map(q=>q.score))}%</p>
                                            <p className="text-xs text-slate-400">Lowest</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-slate-900">{data.quizzes.length}</p>
                                            <p className="text-xs text-slate-400">Total</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subject time chart */}
                        {subjectData.some(s=>s.totalMins>0) && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 mb-1">Time Per Subject</h2>
                                <p className="text-xs text-slate-400 mb-5">Minutes studied across your enrolled subjects</p>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={subjectData.filter(s=>s.totalMins>0)} margin={{ top:0, right:10, bottom:0, left:-10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                        <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false}
                                            tickFormatter={n => n.length>8?n.slice(0,8)+'…':n} />
                                        <YAxis tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/60)}h`} />
                                        <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #E2E8F0' }} formatter={v=>[fmt(v),'Study Time']} />
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

                {/* ══ SUBJECTS TAB ══ */}
                {activeTab === "subjects" && (
                    <div className="space-y-4">
                        {subjectData.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                                <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                <p className="font-semibold text-slate-700">No subjects added yet</p>
                                <p className="text-sm text-slate-400 mt-1">Add subjects in the Subjects page</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {subjectData.map(sub => {
                                        const fcPct = sub.cards > 0 ? Math.round((sub.mastered/sub.cards)*100) : 0;
                                        return (
                                            <motion.div key={sub.name} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                                                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                                <div className="h-1.5" style={{ backgroundColor: sub.color }} />
                                                <div className="p-5 space-y-4">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h3 className="font-bold text-slate-900">{sub.name}</h3>
                                                            {sub.target && <p className="text-xs text-slate-400 mt-0.5">Target: {sub.target}/50</p>}
                                                        </div>
                                                        <Badge className={`text-xs border-0 ${
                                                            sub.priority==='high' ? 'bg-rose-50 text-rose-600' :
                                                            sub.priority==='medium' ? 'bg-amber-50 text-amber-600' :
                                                            'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            {sub.priority || 'medium'}
                                                        </Badge>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div className="bg-slate-50 rounded-xl p-2.5">
                                                            <p className="text-base font-bold text-slate-900">{fmt(sub.totalMins)}</p>
                                                            <p className="text-xs text-slate-400">Study</p>
                                                        </div>
                                                        <div className="bg-slate-50 rounded-xl p-2.5">
                                                            <p className="text-base font-bold text-slate-900">{sub.uniqueDays}d</p>
                                                            <p className="text-xs text-slate-400">Days</p>
                                                        </div>
                                                        <div className={`rounded-xl p-2.5 ${sub.quizAvg === null ? 'bg-slate-50' : sub.quizAvg>=70?'bg-emerald-50':'bg-rose-50'}`}>
                                                            <p className={`text-base font-bold ${sub.quizAvg===null?'text-slate-400':sub.quizAvg>=70?'text-emerald-700':'text-rose-600'}`}>
                                                                {sub.quizAvg !== null ? `${sub.quizAvg}%` : '—'}
                                                            </p>
                                                            <p className="text-xs text-slate-400">Quiz</p>
                                                        </div>
                                                    </div>
                                                    {sub.cards > 0 && (
                                                        <div>
                                                            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                                                <span>Flashcard mastery</span>
                                                                <span className="font-semibold">{sub.mastered}/{sub.cards} ({fcPct}%)</span>
                                                            </div>
                                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                <motion.div initial={{ width:0 }} animate={{ width:`${fcPct}%` }} transition={{ duration:0.8 }}
                                                                    className="h-full rounded-full" style={{ backgroundColor: sub.color }} />
                                                            </div>
                                                            {sub.weak > 0 && (
                                                                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" /> {sub.weak} weak-spot cards need review
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {sub.totalMins === 0 && (
                                                        <p className="text-xs text-rose-500 flex items-center gap-1">
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
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                        <h2 className="font-bold text-slate-900 mb-1">Quiz Avg by Subject</h2>
                                        <p className="text-xs text-slate-400 mb-5">Compare average quiz performance across subjects</p>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={subjectData.filter(s=>s.quizAvg!==null)} margin={{ top:0, right:10, bottom:0, left:-10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                                <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false}
                                                    tickFormatter={n=>n.length>8?n.slice(0,8)+'…':n} />
                                                <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                                                <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #E2E8F0' }} formatter={v=>[`${v}%`,'Quiz Avg']} />
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
                                { label:"Total Cards",   val:fcHealth.total,      color:"bg-slate-100 text-slate-800" },
                                { label:"Mastered",      val:fcHealth.mastered,   color:"bg-emerald-50 text-emerald-700" },
                                { label:"Due Today",     val:fcHealth.due,        color:"bg-blue-50 text-blue-700" },
                                { label:"Weak Spots",    val:fcHealth.weak,       color:"bg-amber-50 text-amber-700" },
                                { label:"Never Reviewed",val:fcHealth.unreviewed, color:"bg-rose-50 text-rose-700" },
                            ].map(k => (
                                <div key={k.label} className={`rounded-2xl p-4 ${k.color}`}>
                                    <p className="text-2xl font-bold">{k.val}</p>
                                    <p className="text-xs font-medium mt-0.5 opacity-70">{k.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Mastery per subject */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h2 className="font-bold text-slate-900 mb-1">Mastery by Subject</h2>
                            <p className="text-xs text-slate-400 mb-5">How well you know your flashcards in each subject</p>
                            {subjectData.filter(s=>s.cards>0).length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8">No flashcards created yet</p>
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
                                                        <span className="text-sm font-semibold text-slate-800">{sub.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        {sub.weak > 0 && <span className="text-amber-600">⚠ {sub.weak} weak</span>}
                                                        <span className="font-bold text-slate-700">{pct}% mastered</span>
                                                        <span>{sub.mastered}/{sub.cards}</span>
                                                    </div>
                                                </div>
                                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                                                    <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:0.8 }}
                                                        className="h-full rounded-full absolute left-0" style={{ backgroundColor:sub.color }} />
                                                    {sub.weak > 0 && (
                                                        <motion.div initial={{ width:0 }} animate={{ width:`${weakPct}%` }} transition={{ duration:0.8, delay:0.1 }}
                                                            className="h-full rounded-full absolute right-0 bg-amber-400 opacity-60" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Rating distribution */}
                        {data.flashcards.some(f => (f.totalReviews||0)>0) && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 mb-1">Rating Distribution</h2>
                                <p className="text-xs text-slate-400 mb-5">Cumulative ratings across all cards</p>
                                {(() => {
                                    const again = data.flashcards.reduce((s,f)=>s+(f.review_count_again||0),0);
                                    const hard  = data.flashcards.reduce((s,f)=>s+(f.review_count_hard||0),0);
                                    const good  = data.flashcards.reduce((s,f)=>s+(f.review_count_good||0),0);
                                    const easy  = data.flashcards.reduce((s,f)=>s+(f.review_count_easy||0),0);
                                    const total = again+hard+good+easy;
                                    if (total===0) return <p className="text-sm text-slate-400">No reviews yet</p>;
                                    return (
                                        <div className="space-y-3">
                                            {[
                                                { label:"Again", count:again, color:"#EF4444" },
                                                { label:"Hard",  count:hard,  color:"#F97316" },
                                                { label:"Good",  count:good,  color:"#6366F1" },
                                                { label:"Easy",  count:easy,  color:"#10B981" },
                                            ].map(r => (
                                                <div key={r.label}>
                                                    <div className="flex justify-between text-sm mb-1.5">
                                                        <span className="font-medium text-slate-700">{r.label}</span>
                                                        <span className="text-slate-500">{r.count} ({Math.round((r.count/total)*100)}%)</span>
                                                    </div>
                                                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <motion.div initial={{ width:0 }} animate={{ width:`${Math.round((r.count/total)*100)}%` }} transition={{ duration:0.8 }}
                                                            className="h-full rounded-full" style={{ backgroundColor:r.color }} />
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="pt-3 border-t border-slate-100 flex gap-6 text-sm">
                                                <div><span className="font-bold text-slate-900">{total}</span> <span className="text-slate-400">total reviews</span></div>
                                                <div><span className="font-bold text-emerald-600">{Math.round(((good+easy)/total)*100)}%</span> <span className="text-slate-400">success rate</span></div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Advice */}
                        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-6 space-y-3">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Star className="w-4 h-4 text-violet-500" /> Flashcard Recommendations</h2>
                            {fcHealth.due > 20 && <p className="text-sm text-slate-700">• You have <strong>{fcHealth.due}</strong> cards due — schedule a review session today to stay on top of spaced repetition.</p>}
                            {fcHealth.weak > 0 && <p className="text-sm text-slate-700">• Focus your next session on the <strong>{fcHealth.weak} weak-spot cards</strong> — these are the ones you keep getting wrong.</p>}
                            {fcHealth.unreviewed > 0 && <p className="text-sm text-slate-700">• <strong>{fcHealth.unreviewed} cards</strong> have never been reviewed. Start activating them before they pile up.</p>}
                            {fcHealth.mastered > 0 && fcHealth.mastered === fcHealth.total && <p className="text-sm text-emerald-700 font-medium">• 🎉 You've mastered all your flashcards! Consider adding more from your notes.</p>}
                            {fcHealth.total === 0 && <p className="text-sm text-slate-500">No flashcards yet. Use AI Generate in the Study page to create a full deck from your notes.</p>}
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