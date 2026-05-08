import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Target, CalendarIcon, GraduationCap, TrendingUp, Edit2, Check, X,
    ChevronRight, Loader2, Trophy, Clock, AlertTriangle, ArrowRight,
    CheckCircle2, Sparkles
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { moderationPresets } from "@/components/shared/contentModeration";
import { useToast } from "@/components/ui/use-toast";
import { differenceInDays, parseISO, format } from "date-fns";

import GoalsList from "../components/goals/GoalsList";
import GoalCreationWizard from "../components/goals/GoalCreationWizard";
import GoalDetailView from "../components/goals/GoalDetailView";
import InteractiveCalendar from "../components/goals/InteractiveCalendar";
import HelpButton from "@/components/shared/HelpButton";

// ─── Coach voice helpers (chill + motivational) ──────────────────────────────
function getCoachLine({ name, hour, total, active, overdueCount, urgentTitle, urgentDays }) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";
    if (total === 0) return `${period}, ${name}. No goals yet — let's set your first one.`;
    if (active === 0) return `${period}, ${name}. Every goal complete. Time for what's next.`;
    if (overdueCount > 0) return `${period}, ${name}. ${overdueCount} goal${overdueCount === 1 ? '' : 's'} slipped past — let's reset.`;
    if (urgentTitle && urgentDays !== null && urgentDays <= 3) {
        return `${period}, ${name}. "${urgentTitle}" is due in ${urgentDays === 0 ? 'a few hours' : `${urgentDays} day${urgentDays === 1 ? '' : 's'}`}.`;
    }
    if (active === 1) return `${period}, ${name}. One goal in motion — keep at it.`;
    return `${period}, ${name}. ${active} goals in motion. Steady wins this.`;
}

// ─── ATAR Banner ──────────────────────────────────────────────────────────────
function ATARPoster({ userProfile, onSaved }) {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({
        goal_atar: userProfile?.goal_atar || "",
        goal_course_name: userProfile?.goal_course_name || "",
        goal_university: userProfile?.goal_university || "",
    });
    const [saving, setSaving] = useState(false);

    const hasGoal = userProfile?.goal_atar || userProfile?.goal_course_name;

    const handleSave = async () => {
        setSaving(true);
        try {
            const modResult = await moderationPresets.goal(form.goal_course_name || '', form.goal_university || '');
            if (!modResult.isAllowed) {
                toast({ title: "Content Policy Violation", variant: "destructive" });
                return;
            }
            const data = {
                goal_atar: parseFloat(form.goal_atar) || null,
                goal_course_name: form.goal_course_name || null,
                goal_university: form.goal_university || null,
                onboarding_tasks: { ...(userProfile?.onboarding_tasks || {}), goals_set: true },
            };
            if (userProfile?.id) {
                await base44.entities.UserProfile.update(userProfile.id, data);
            } else {
                await base44.entities.UserProfile.create(data);
            }
            onSaved({ ...(userProfile || {}), ...data });
            setIsEditing(false);
            toast({ title: "Goals saved!" });
        } catch (e) {
            toast({ title: "Could not save", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div className="card-soft p-6 h-full">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-chart-3/15 flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-chart-3" />
                        </div>
                        <p className="font-display font-extrabold text-foreground text-base">Your big goal</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Target ATAR</Label>
                        <Input type="number" min="30" max="99.95" step="0.05" placeholder="e.g. 95.00"
                            value={form.goal_atar} onChange={e => setForm(p => ({ ...p, goal_atar: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Target Course</Label>
                        <Input placeholder="e.g. Bachelor of Medicine"
                            value={form.goal_course_name} onChange={e => setForm(p => ({ ...p, goal_course_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">University</Label>
                        <Input placeholder="e.g. University of Melbourne"
                            value={form.goal_university} onChange={e => setForm(p => ({ ...p, goal_university: e.target.value }))} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                    </Button>
                </div>
            </div>
        );
    }

    if (!hasGoal) {
        return (
            <div className="rounded-3xl bg-secondary/30 border-2 border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center">
                <GraduationCap className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <h3 className="font-display font-extrabold text-foreground text-lg lg:text-xl mb-2">
                    What ATAR are you chasing?
                </h3>
                <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                    Set your target — we'll help you build a plan to get there.
                </p>
                <Button onClick={() => setIsEditing(true)}>Set your big goal</Button>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-3xl bg-chart-3/10 border-2 border-chart-3/25 p-6 lg:p-8 h-full">
            <GraduationCap className="absolute -top-4 -right-4 w-32 h-32 text-chart-3/10 pointer-events-none" />
            <div className="relative">
                <div className="flex items-start justify-between mb-2">
                    <p className="stat-label text-chart-3/80">Your shot at</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-chart-3 hover:bg-chart-3/15 -mr-2 -mt-1"
                        onClick={() => setIsEditing(true)}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
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
            </div>
        </div>
    );
}

// ─── Goals Stats Panel ────────────────────────────────────────────────────────
function StatsPanel({ active, completed, total, overallProgress, nextDeadline }) {
    return (
        <div className="rounded-3xl bg-primary/10 border-2 border-primary/25 p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-primary" />
                <p className="stat-label text-primary/80">Goal progress</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-auto">
                <div>
                    <p className="font-display font-extrabold text-foreground leading-none text-3xl lg:text-4xl">
                        {active}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground mt-1">Active</p>
                </div>
                <div>
                    <p className="font-display font-extrabold text-foreground leading-none text-3xl lg:text-4xl">
                        {completed}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground mt-1">Done</p>
                </div>
            </div>
            {total > 0 && (
                <div className="mt-5 pt-4 border-t-2 border-primary/15">
                    <div className="flex items-baseline justify-between mb-1.5">
                        <p className="text-xs font-bold text-muted-foreground">Overall progress</p>
                        <p className="text-xs font-bold text-foreground">{overallProgress}%</p>
                    </div>
                    <div className="h-1.5 bg-primary/15 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${overallProgress}%` }}
                            transition={{ duration: 0.9, delay: 0.3 }}
                            className="h-full rounded-full bg-primary"
                        />
                    </div>
                </div>
            )}
            {nextDeadline && (
                <div className="mt-3 flex items-baseline justify-between">
                    <p className="text-xs font-bold text-muted-foreground">Next deadline</p>
                    <p className="text-xs font-bold text-foreground">
                        {nextDeadline.days === 0 ? 'Today' : nextDeadline.days === 1 ? 'Tomorrow' : `${nextDeadline.days} days`}
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Goals() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [allGoals, setAllGoals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [goalsView, setGoalsView] = useState("list");
    const [selectedGoal, setSelectedGoal] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                const [profile, subjects, goals] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: currentUser.email }).then(d => d[0] || null),
                    base44.entities.UserSubject.filter({ created_by: currentUser.email }),
                    base44.entities.Goal.filter({ created_by: currentUser.email }, "-created_date", 100).catch(() => []),
                ]);
                setUserProfile(profile);
                setUserSubjects(subjects || []);
                setAllGoals(goals || []);
            } catch (e) {
                console.error("Init error:", e);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!user?.email) return;
        const unsub = base44.entities.Goal.subscribe((event) => {
            if (event.data?.created_by !== user.email) return;
            setAllGoals(prev => {
                if (event.type === 'create') return [event.data, ...prev];
                if (event.type === 'update') return prev.map(g => g.id === event.id ? event.data : g);
                if (event.type === 'delete') return prev.filter(g => g.id !== event.id);
                return prev;
            });
            if (event.type === 'update' && event.id === selectedGoal?.id) {
                setSelectedGoal(event.data);
            }
        });
        return () => unsub();
    }, [user, selectedGoal?.id]);

    // ─── Derived stats ────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const active = allGoals.filter(g => !g.is_completed);
        const completed = allGoals.filter(g => g.is_completed);
        const today = new Date();

        const overdue = active.filter(g => {
            if (!g.target_date) return false;
            return differenceInDays(parseISO(g.target_date), today) < 0;
        });

        const upcomingActive = active
            .filter(g => g.target_date && differenceInDays(parseISO(g.target_date), today) >= 0)
            .map(g => ({ ...g, days: differenceInDays(parseISO(g.target_date), today) }))
            .sort((a, b) => a.days - b.days);

        const nextDeadline = upcomingActive[0] || null;

        const overallProgress = active.length > 0
            ? Math.round(active.reduce((sum, g) => sum + (g.progress || 0), 0) / active.length)
            : 0;

        return {
            total: allGoals.length,
            active: active.length,
            completed: completed.length,
            overdueCount: overdue.length,
            nextDeadline,
            overallProgress,
            upcomingActive,
        };
    }, [allGoals]);

    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const hour = new Date().getHours();
    const coachLine = getCoachLine({
        name: firstName,
        hour,
        total: stats.total,
        active: stats.active,
        overdueCount: stats.overdueCount,
        urgentTitle: stats.nextDeadline?.title,
        urgentDays: stats.nextDeadline?.days ?? null,
    });

    // Featured "Today's focus" — most-pressing active goal
    const focus = useMemo(() => {
        if (stats.overdueCount > 0) {
            const overdue = allGoals.filter(g => !g.is_completed && g.target_date && differenceInDays(parseISO(g.target_date), new Date()) < 0)
                .sort((a, b) => differenceInDays(parseISO(a.target_date), new Date()) - differenceInDays(parseISO(b.target_date), new Date()))[0];
            return overdue ? {
                label: "Past deadline",
                title: overdue.title,
                sub: `Was due ${Math.abs(differenceInDays(parseISO(overdue.target_date), new Date()))} days ago — let's salvage it.`,
                cta: "Open goal",
                accent: "streak",
                icon: AlertTriangle,
                goal: overdue,
            } : null;
        }
        if (stats.nextDeadline) {
            const g = stats.nextDeadline;
            return {
                label: g.days === 0 ? "Due today" : g.days === 1 ? "Due tomorrow" : `${g.days} days out`,
                title: g.title,
                sub: g.progress >= 75
                    ? `${g.progress}% done — push it over the line.`
                    : g.progress >= 25
                        ? `${g.progress}% done — keep building.`
                        : `${g.progress}% done — let's get a strong start.`,
                cta: "Open goal",
                accent: g.days <= 3 ? "xp" : "chart-3",
                icon: Target,
                goal: g,
            };
        }
        if (stats.active > 0) {
            const oldest = allGoals.filter(g => !g.is_completed)[0];
            return oldest ? {
                label: "Active goal",
                title: oldest.title,
                sub: `${oldest.progress || 0}% done — keep chipping away.`,
                cta: "Open goal",
                accent: "primary",
                icon: Target,
                goal: oldest,
            } : null;
        }
        return null;
    }, [allGoals, stats]);

    const FOCUS_THEME = {
        primary:   { bg: "bg-primary/10",  border: "border-primary/25",  iconBg: "bg-primary/15",  iconText: "text-primary"  },
        xp:        { bg: "bg-xp/10",       border: "border-xp/25",       iconBg: "bg-xp/15",       iconText: "text-xp"       },
        streak:    { bg: "bg-streak/10",   border: "border-streak/25",   iconBg: "bg-streak/15",   iconText: "text-streak"   },
        "chart-3": { bg: "bg-chart-3/10",  border: "border-chart-3/25",  iconBg: "bg-chart-3/15",  iconText: "text-chart-3"  },
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Loading…</p>
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
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">Plan</span>
                            {stats.active > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-3">
                                        <Target className="w-3.5 h-3.5" /> {stats.active} active
                                    </span>
                                </>
                            )}
                            {stats.completed > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-primary">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {stats.completed} done
                                    </span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Goals" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── HERO ROW: ATAR poster (3/5) + Stats panel (2/5) ── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    <div className="md:col-span-3">
                        <ATARPoster userProfile={userProfile} onSaved={setUserProfile} />
                    </div>
                    <div className="md:col-span-2">
                        <StatsPanel
                            active={stats.active}
                            completed={stats.completed}
                            total={stats.total}
                            overallProgress={stats.overallProgress}
                            nextDeadline={stats.nextDeadline ? { days: stats.nextDeadline.days } : null}
                        />
                    </div>
                </motion.section>

                {/* ── FOCUS PANEL ─────────────────────────────────────── */}
                {focus && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className={`rounded-2xl ${FOCUS_THEME[focus.accent].bg} border-2 ${FOCUS_THEME[focus.accent].border} p-5 lg:p-6`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl ${FOCUS_THEME[focus.accent].iconBg} flex items-center justify-center flex-shrink-0`}>
                                    <focus.icon className={`w-6 h-6 ${FOCUS_THEME[focus.accent].iconText}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="stat-label mb-1">Today's focus · {focus.label}</p>
                                    <h2 className="font-display font-extrabold text-foreground text-base lg:text-lg leading-snug">
                                        {focus.title}
                                    </h2>
                                    <p className="text-muted-foreground text-sm mt-0.5">{focus.sub}</p>
                                </div>
                                <Button
                                    onClick={() => { setSelectedGoal(focus.goal); setGoalsView("detail"); }}
                                    className="w-full sm:w-auto flex-shrink-0"
                                >
                                    {focus.cta} <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* ── TABS ────────────────────────────────────────────── */}
                <Tabs defaultValue="goals" className="space-y-5">
                    <TabsList className="grid w-full grid-cols-2 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        <TabsTrigger
                            value="goals"
                            onClick={() => { if (goalsView !== "list" && goalsView !== "create" && goalsView !== "detail") setGoalsView("list"); }}
                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all"
                        >
                            <Target className="w-4 h-4" /> Goals
                        </TabsTrigger>
                        <TabsTrigger
                            value="planner"
                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all"
                        >
                            <CalendarIcon className="w-4 h-4" /> Study planner
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="goals" className="space-y-4">
                        <AnimatePresence mode="wait">
                            {goalsView === "list" && (
                                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <GoalsList
                                        userSubjects={userSubjects}
                                        onSelectGoal={(goal) => { setSelectedGoal(goal); setGoalsView("detail"); }}
                                        onCreateGoal={() => setGoalsView("create")}
                                    />
                                </motion.div>
                            )}

                            {goalsView === "create" && (
                                <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                                    <div className="card-soft p-6">
                                        <GoalCreationWizard
                                            userSubjects={userSubjects}
                                            onGoalCreated={(goal) => { setSelectedGoal(goal); setGoalsView("detail"); }}
                                            onCancel={() => setGoalsView("list")}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {goalsView === "detail" && selectedGoal && (
                                <motion.div key="detail" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                                    <div className="card-soft p-6">
                                        <GoalDetailView
                                            goal={selectedGoal}
                                            onBack={() => setGoalsView("list")}
                                            onGoalUpdated={(updated) => setSelectedGoal(updated)}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </TabsContent>

                    <TabsContent value="planner">
                        <InteractiveCalendar user={user} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
