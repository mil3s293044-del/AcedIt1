/**
 * Planner — the simplified successor to Goals + Roadmap. One holistic page:
 * upcoming SACs drive everything (Study urgency, Revision Mode picks, coach
 * lines, Dashboard reminders all read subject_assessments), and a light
 * 7-day session plan (study_plans) keeps the week honest. The old goal
 * trees, mountains and AI roadmaps are gone — track the dates, plan the
 * sessions, go study.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    CalendarDays, Plus, Check, X, GraduationCap, AlertTriangle, Sparkles,
    Loader2, ArrowRight, Edit2, Flag, BookOpen, Trash2
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { format, differenceInDays, parseISO, addDays } from "date-fns";
import HelpButton from "@/components/shared/HelpButton";

const TYPE_OPTIONS = [
    { value: "sac", label: "SAC" },
    { value: "exam", label: "Exam" },
    { value: "test", label: "Test" },
];

// Static countdown pill classes (Tailwind JIT-safe).
const countdownPill = (days) =>
    days <= 3 ? "bg-streak/15 text-streak" :
    days <= 7 ? "bg-xp/15 text-xp" : "bg-chart-3/10 text-chart-3";

function daysLabel(days) {
    if (days < 0) return "Past";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
}

export default function Planner() {
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [plans, setPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Add-SAC form
    const [sacTitle, setSacTitle] = useState("");
    const [sacSubject, setSacSubject] = useState("");
    const [sacType, setSacType] = useState("sac");
    const [sacDate, setSacDate] = useState("");
    const [savingSac, setSavingSac] = useState(false);

    // Add-session dialog
    const [planDay, setPlanDay] = useState(null);
    const [planTitle, setPlanTitle] = useState("");
    const [planSubject, setPlanSubject] = useState("");
    const [planTime, setPlanTime] = useState("16:00");
    const [savingPlan, setSavingPlan] = useState(false);

    // Target card editing
    const [editingTarget, setEditingTarget] = useState(false);
    const [targetAtar, setTargetAtar] = useState("");
    const [targetCourse, setTargetCourse] = useState("");
    const [targetUni, setTargetUni] = useState("");

    const [aiPlanning, setAiPlanning] = useState(false);

    const loadData = useCallback(async (email) => {
        try {
            const [profileData, subjectData, assessmentData, planData] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: email }).catch(() => []),
                base44.entities.UserSubject.filter({ created_by: email, is_active: true }).catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: email }, "due_date", 50).catch(() => []),
                base44.entities.StudyPlan.filter({ created_by: email }, "date", 60).catch(() => []),
            ]);
            const p = profileData[0] || null;
            setProfile(p);
            setTargetAtar(p?.goal_atar || "");
            setTargetCourse(p?.goal_course_name || "");
            setTargetUni(p?.goal_university || "");
            const seen = new Set();
            setSubjects((subjectData || []).filter(s => !seen.has(s.subject_name) && seen.add(s.subject_name)));
            setAssessments(assessmentData || []);
            setPlans(planData || []);
        } catch (e) {
            console.error("Planner load error:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        base44.auth.me().then(u => { setUser(u); if (u?.email) loadData(u.email); }).catch(() => setIsLoading(false));
    }, [loadData]);

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const upcoming = useMemo(() =>
        assessments
            .filter(a => !a.is_completed && a.due_date && a.due_date >= todayStr)
            .sort((a, b) => a.due_date.localeCompare(b.due_date)),
        [assessments, todayStr]);
    const nextSac = upcoming[0] || null;
    const nextSacDays = nextSac ? differenceInDays(parseISO(nextSac.due_date), parseISO(todayStr)) : null;

    // Next 7 days for the week board.
    const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = addDays(new Date(), i);
        const key = format(d, "yyyy-MM-dd");
        return {
            key,
            label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE d"),
            plans: plans.filter(p => p.date === key).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
            sacs: upcoming.filter(a => a.due_date === key),
        };
    }), [plans, upcoming]);

    const plannedThisWeek = week.reduce((n, d) => n + d.plans.length, 0);
    const doneThisWeek = week.reduce((n, d) => n + d.plans.filter(p => p.is_completed).length, 0);

    const coachLine = !nextSac
        ? "No SACs tracked yet — add the next one and the whole app plans around it."
        : nextSacDays === 0
            ? `${nextSac.subject_name} ${nextSac.title} is today. You've prepared — go show it.`
            : nextSacDays <= 3
                ? `${nextSac.subject_name} in ${daysLabel(nextSacDays).toLowerCase()} — every session now counts double.`
                : `${daysLabel(nextSacDays)} until ${nextSac.subject_name} ${nextSac.title}. Plenty of runway — let's use it.`;

    // ─── Actions ───────────────────────────────────────────────────────────────
    const addSac = async () => {
        if (!sacTitle.trim() || !sacSubject || !sacDate) {
            toast({ title: "Almost there", description: "Subject, name and date make a SAC trackable." });
            return;
        }
        setSavingSac(true);
        try {
            await base44.entities.SubjectAssessment.create({
                title: sacTitle.trim(),
                subject_name: sacSubject,
                assessment_type: sacType,
                due_date: sacDate,
                is_completed: false,
            });
            toast({ title: "SAC tracked 🎯", description: "Study, Revision Mode and your Dashboard now plan around it." });
            setSacTitle(""); setSacDate("");
            loadData(user.email);
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setSavingSac(false);
        }
    };

    const toggleSacDone = async (a) => {
        try {
            await base44.entities.SubjectAssessment.update(a.id, { is_completed: !a.is_completed });
            loadData(user.email);
        } catch (e) { toast({ title: "Couldn't update", variant: "destructive" }); }
    };

    const deleteSac = async (a) => {
        try {
            await base44.entities.SubjectAssessment.delete(a.id);
            loadData(user.email);
        } catch (e) { toast({ title: "Couldn't remove", variant: "destructive" }); }
    };

    const addPlan = async () => {
        if (!planTitle.trim() || !planDay) return;
        setSavingPlan(true);
        try {
            await base44.entities.StudyPlan.create({
                title: planTitle.trim(),
                subject_name: planSubject || null,
                date: planDay,
                start_time: planTime || null,
                is_completed: false,
            });
            setPlanDay(null); setPlanTitle("");
            loadData(user.email);
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setSavingPlan(false);
        }
    };

    const togglePlanDone = async (p) => {
        try {
            await base44.entities.StudyPlan.update(p.id, { is_completed: !p.is_completed });
            setPlans(prev => prev.map(x => x.id === p.id ? { ...x, is_completed: !p.is_completed } : x));
        } catch (e) { toast({ title: "Couldn't update", variant: "destructive" }); }
    };

    const deletePlan = async (p) => {
        try {
            await base44.entities.StudyPlan.delete(p.id);
            setPlans(prev => prev.filter(x => x.id !== p.id));
        } catch (e) { toast({ title: "Couldn't remove", variant: "destructive" }); }
    };

    const saveTarget = async () => {
        try {
            await base44.entities.UserProfile.update(profile.id, {
                goal_atar: targetAtar || null,
                goal_course_name: targetCourse || null,
                goal_university: targetUni || null,
            });
            setEditingTarget(false);
            loadData(user.email);
            toast({ title: "Target locked in 🎓" });
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        }
    };

    // AI: fill the week with sessions weighted toward the nearest SACs.
    const planMyWeek = async () => {
        setAiPlanning(true);
        try {
            const response = await base44.integrations.Core.InvokeLLM({
                feature: "ai_tool",
                prompt: `You are a VCE study coach. Today is ${todayStr}.
Student's subjects: ${subjects.map(s => s.subject_name).join(", ") || "not set"}.
Upcoming assessments: ${upcoming.slice(0, 6).map(a => `${a.subject_name} ${a.title} (${a.assessment_type}) on ${a.due_date}`).join("; ") || "none tracked"}.
Existing planned sessions (skip these slots): ${week.flatMap(d => d.plans.map(p => `${p.date} ${p.start_time || ""} ${p.title}`)).join("; ") || "none"}.

Create 4-6 focused study sessions across the next 7 days (dates ${todayStr} to ${format(addDays(new Date(), 6), "yyyy-MM-dd")}). Weight sessions toward the nearest assessments. At most 2 per day. Each session: a short specific title naming the technique (e.g. "Flashcards: cell transport", "Timed mock: Methods CAS-free", "Active recall: Unit 3 AOS2"), the subject, a date, and an afternoon/evening start_time (HH:MM).`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        sessions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    subject_name: { type: "string" },
                                    date: { type: "string" },
                                    start_time: { type: "string" },
                                },
                                required: ["title", "date"],
                            },
                        },
                    },
                    required: ["sessions"],
                },
            });
            const sessions = (response?.sessions || []).filter(s => s.date >= todayStr).slice(0, 6);
            for (const s of sessions) {
                await base44.entities.StudyPlan.create({
                    title: s.title, subject_name: s.subject_name || null,
                    date: s.date, start_time: s.start_time || null, is_completed: false,
                });
            }
            toast({ title: `✨ ${sessions.length} sessions planned`, description: "Weighted toward your nearest SACs. Adjust anything that clashes." });
            loadData(user.email);
        } catch (e) {
            toast({ title: "Planning unavailable", description: e.message, variant: "destructive" });
        } finally {
            setAiPlanning(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="card-soft h-28 animate-pulse bg-secondary/50" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">Planner</span>
                            {upcoming.length > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-3">
                                        <Flag className="w-3.5 h-3.5" /> {upcoming.length} tracked
                                    </span>
                                </>
                            )}
                            {plannedThisWeek > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="font-extrabold text-primary">{doneThisWeek}/{plannedThisWeek} done this week</span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Planner" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── HERO: next SAC + target ─────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Next SAC countdown */}
                    <div className="lg:col-span-2">
                        {nextSac ? (
                            <div className={`relative overflow-hidden rounded-2xl border shadow-soft p-6 lg:p-7 h-full ${nextSacDays <= 3 ? "bg-streak/5 border-streak/20" : "bg-chart-3/5 border-chart-3/15"}`}>
                                <AlertTriangle className={`absolute -top-5 -right-5 w-28 h-28 pointer-events-none ${nextSacDays <= 3 ? "text-streak/[0.07]" : "text-chart-3/[0.07]"}`} />
                                <p className="stat-label mb-1">{nextSacDays <= 3 ? "Crunch time" : "Next up"}</p>
                                <div className="flex items-end gap-4 flex-wrap">
                                    <p className="font-display font-extrabold text-foreground leading-none" style={{ fontSize: "clamp(2.5rem, 7vw, 4rem)" }}>
                                        {daysLabel(nextSacDays)}
                                    </p>
                                    <div className="mb-1.5 min-w-0">
                                        <p className="font-bold text-foreground truncate">{nextSac.subject_name} — {nextSac.title}</p>
                                        <p className="text-xs text-muted-foreground">{format(parseISO(nextSac.due_date), "EEEE d MMMM")}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4 flex-wrap">
                                    <Link to="/Study?tab=exam">
                                        <Button size="sm" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Run a timed mock</Button>
                                    </Link>
                                    <Link to="/Study?tab=spaced_repetition">
                                        <Button size="sm" variant="outline" className="gap-1.5 border-2"><BookOpen className="w-3.5 h-3.5" /> Review cards</Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-surface border border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center shadow-soft">
                                <Flag className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                <h2 className="font-display font-extrabold text-foreground text-lg mb-1">What's your next SAC?</h2>
                                <p className="text-muted-foreground text-sm max-w-sm">
                                    Add it below — Study, Revision Mode and your Dashboard all start counting down with you.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Target card — the one bit of Goals worth keeping */}
                    <div className="rounded-2xl bg-chart-4/5 border border-chart-4/15 shadow-soft p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <p className="stat-label text-chart-4/80">Your target</p>
                            <button onClick={() => setEditingTarget(e => !e)} aria-label="Edit target"
                                className="text-muted-foreground/60 hover:text-foreground transition-colors">
                                {editingTarget ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            </button>
                        </div>
                        {editingTarget ? (
                            <div className="space-y-2.5">
                                <Input value={targetAtar} onChange={e => setTargetAtar(e.target.value)} placeholder="ATAR goal — e.g. 92.5" />
                                <Input value={targetCourse} onChange={e => setTargetCourse(e.target.value)} placeholder="Dream course" />
                                <Input value={targetUni} onChange={e => setTargetUni(e.target.value)} placeholder="University" />
                                <Button size="sm" onClick={saveTarget} className="w-full gap-1.5"><Check className="w-3.5 h-3.5" /> Save</Button>
                            </div>
                        ) : (
                            <>
                                <p className="font-display font-extrabold text-chart-4 leading-none" style={{ fontSize: "clamp(2.5rem, 6vw, 3.75rem)" }}>
                                    {profile?.goal_atar || "—"}
                                </p>
                                <div className="mt-2 space-y-0.5">
                                    {profile?.goal_course_name && <p className="font-bold text-foreground text-sm">{profile.goal_course_name}</p>}
                                    {profile?.goal_university && <p className="text-xs text-muted-foreground">at {profile.goal_university}</p>}
                                    {!profile?.goal_atar && <p className="text-xs text-muted-foreground">Set the number you're chasing — it shows on your Dashboard too.</p>}
                                </div>
                            </>
                        )}
                    </div>
                </motion.section>

                {/* ── UPCOMING SACS ───────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl mb-3 flex items-center gap-2">
                        <Flag className="w-5 h-5 text-chart-3" /> Upcoming SACs
                    </h2>

                    {/* Add form — deliberately one line, zero friction */}
                    <div className="card-soft p-4 mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto,auto,auto] gap-2 items-center">
                            <Select value={sacSubject} onValueChange={setSacSubject}>
                                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                                <SelectContent>
                                    {subjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input placeholder='Name — e.g. "Unit 3 AOS1 SAC"' value={sacTitle} onChange={e => setSacTitle(e.target.value)} maxLength={80} />
                            <div className="flex gap-1.5">
                                {TYPE_OPTIONS.map(t => (
                                    <button key={t.value} onClick={() => setSacType(t.value)}
                                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border-2 transition-all ${sacType === t.value ? "bg-chart-3 border-chart-3 text-white" : "bg-surface border-border text-muted-foreground hover:border-chart-3/40"}`}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <Input type="date" value={sacDate} min={todayStr} onChange={e => setSacDate(e.target.value)} className="w-auto" />
                            <Button onClick={addSac} disabled={savingSac} className="gap-1.5">
                                {savingSac ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Track it
                            </Button>
                        </div>
                    </div>

                    {upcoming.length > 0 && (
                        <div className="space-y-2">
                            <AnimatePresence>
                                {upcoming.map(a => {
                                    const d = differenceInDays(parseISO(a.due_date), parseISO(todayStr));
                                    return (
                                        <motion.div key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                                            className="card-soft flex items-center gap-3 p-3.5">
                                            <button onClick={() => toggleSacDone(a)} aria-label="Mark assessment done"
                                                className="w-6 h-6 rounded-lg border-2 border-border hover:border-primary flex items-center justify-center flex-shrink-0 transition-colors">
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground text-sm truncate">{a.subject_name} — {a.title}</p>
                                                <p className="text-xs text-muted-foreground">{format(parseISO(a.due_date), "EEE d MMM")} · {(a.assessment_type || "sac").toUpperCase()}</p>
                                            </div>
                                            <span className={`pill flex-shrink-0 ${countdownPill(d)}`}>{daysLabel(d)}</span>
                                            <button onClick={() => deleteSac(a)} aria-label="Remove assessment"
                                                className="text-muted-foreground/40 hover:text-streak transition-colors flex-shrink-0">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.section>

                {/* ── THIS WEEK ───────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                        <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-primary" /> This week
                        </h2>
                        <Button onClick={planMyWeek} disabled={aiPlanning} size="sm" variant="outline" className="gap-1.5 border-2 border-chart-4/30 text-chart-4 hover:bg-chart-4/5">
                            {aiPlanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {aiPlanning ? "Planning…" : "Plan my week for me"}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                        {week.map(day => (
                            <div key={day.key} className={`rounded-2xl border p-2.5 min-h-[120px] flex flex-col gap-1.5 ${day.label === "Today" ? "bg-primary/5 border-primary/25" : "bg-surface border-border"}`}>
                                <div className="flex items-center justify-between px-0.5">
                                    <p className={`text-xs font-black uppercase tracking-wide ${day.label === "Today" ? "text-primary" : "text-muted-foreground/70"}`}>{day.label}</p>
                                    <button onClick={() => { setPlanDay(day.key); setPlanTitle(""); }} aria-label={`Add session on ${day.label}`}
                                        className="text-muted-foreground/50 hover:text-primary transition-colors">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {day.sacs.map(a => (
                                    <div key={a.id} className="rounded-lg bg-streak/10 border border-streak/25 px-2 py-1.5">
                                        <p className="text-[11px] font-black text-streak leading-tight">🚩 {a.subject_name} {(a.assessment_type || "SAC").toUpperCase()}</p>
                                    </div>
                                ))}
                                {day.plans.map(p => (
                                    <div key={p.id} className={`group rounded-lg border px-2 py-1.5 ${p.is_completed ? "bg-primary/5 border-primary/20" : "bg-secondary/50 border-border"}`}>
                                        <div className="flex items-start gap-1.5">
                                            <button onClick={() => togglePlanDone(p)} aria-label="Toggle session done"
                                                className={`w-3.5 h-3.5 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${p.is_completed ? "bg-primary border-primary text-white" : "border-muted-foreground/40 hover:border-primary"}`}>
                                                {p.is_completed && <Check className="w-2.5 h-2.5" />}
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-[11px] font-bold leading-tight ${p.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{p.title}</p>
                                                <p className="text-[10px] text-muted-foreground">{p.subject_name || ""}{p.start_time ? ` · ${p.start_time}` : ""}</p>
                                            </div>
                                            <button onClick={() => deletePlan(p)} aria-label="Remove session"
                                                className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-streak transition-all flex-shrink-0">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {day.plans.length === 0 && day.sacs.length === 0 && (
                                    <button onClick={() => { setPlanDay(day.key); setPlanTitle(""); }}
                                        className="flex-1 rounded-lg border border-dashed border-border/60 text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                                        + plan
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Planned sessions show up as Dashboard reminders — and studying them feeds your streak, duels and bets automatically.
                    </p>
                </motion.section>

                {/* Add-session dialog */}
                <Dialog open={!!planDay} onOpenChange={(o) => !o && setPlanDay(null)}>
                    <DialogContent className="max-w-sm rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="font-display">
                                Plan a session{planDay ? ` — ${format(parseISO(planDay), "EEE d MMM")}` : ""}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <Input placeholder='What — e.g. "Flashcards: gene regulation"' value={planTitle} onChange={e => setPlanTitle(e.target.value)} maxLength={80} autoFocus />
                            <Select value={planSubject} onValueChange={setPlanSubject}>
                                <SelectTrigger><SelectValue placeholder="Subject (optional)" /></SelectTrigger>
                                <SelectContent>
                                    {subjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input type="time" value={planTime} onChange={e => setPlanTime(e.target.value)} />
                            <Button onClick={addPlan} disabled={savingPlan || !planTitle.trim()} className="w-full gap-1.5">
                                {savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add to plan
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
