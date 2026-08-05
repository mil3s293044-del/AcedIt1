/**
 * Planner — SAC-centred planning hub. Monday-anchored week board with
 * multi-week navigation, recurring sessions, launchable session chips
 * (each opens the right study tool), and a customisable AI week planner
 * that proposes sessions for review before anything is saved.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
    CalendarDays, Plus, Check, X, GraduationCap, Sparkles,
    Loader2, ArrowRight, Edit2, Flag, BookOpen, Trash2, ChevronLeft,
    ChevronRight, Repeat, GripVertical
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { format, differenceInDays, parseISO, addDays, startOfWeek, addWeeks } from "date-fns";
import HelpButton from "@/components/shared/HelpButton";

const TYPE_OPTIONS = [
    { value: "sac", label: "SAC" },
    { value: "exam", label: "Exam" },
    { value: "test", label: "Test" },
];

const HOUR_OPTIONS = [2, 5, 8, 12];
const TIME_PREFS = [
    { value: "after_school", label: "After school" },
    { value: "evenings", label: "Evenings" },
    { value: "weekends", label: "Weekend-heavy" },
];
const REPEAT_OPTIONS = [2, 4, 8, 12];
const MAX_WEEKS_AHEAD = 8;

// Daily intention presets — one line to aim the day at. Students can also
// write their own.
const PRESET_INTENTIONS = [
    "One focused session before dinner",
    "Start with the subject I avoid",
    "Beat yesterday by ten minutes",
    "Show up for 20 minutes, minimum",
    "Finish today's plan — then switch off",
];

// Session types — the prefix keeps sessionLink() routing to the right tool.
const SESSION_TYPES = [
    { value: "Flashcards", emoji: "🃏" },
    { value: "Active recall", emoji: "🧠" },
    { value: "Quiz", emoji: "❓" },
    { value: "Timed mock", emoji: "⏱️" },
    { value: "Blurting", emoji: "✍️" },
    { value: "Notes review", emoji: "📖" },
    { value: "Homework", emoji: "📚" },
    { value: "Other", emoji: "✨" },
];
const DURATION_OPTIONS = [25, 40, 60, 90];

// ─── Static class lookups (Tailwind JIT-safe) ───────────────────────────────
const countdownPill = (days) =>
    days <= 3 ? "bg-streak/15 text-streak" :
    days <= 7 ? "bg-xp/15 text-xp" : "bg-chart-3/10 text-chart-3";

// Subject → consistent token colour (same hash trick as Friends avatars).
const SUBJECT_CHIP = [
    "bg-chart-3/10 border-chart-3/30 text-chart-3",
    "bg-chart-4/10 border-chart-4/30 text-chart-4",
    "bg-primary/10 border-primary/30 text-primary",
    "bg-xp/10 border-xp/30 text-xp",
    "bg-streak/10 border-streak/30 text-streak",
];
const subjectChipClass = (name) => SUBJECT_CHIP[(name || "?").charCodeAt(0) % SUBJECT_CHIP.length];

function daysLabel(days) {
    if (days < 0) return "Past";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
}

// A planned session opens the tool it names — the plan is a launcher.
function sessionLink(title) {
    const t = (title || "").toLowerCase();
    if (/flash|card|spaced/.test(t)) return "/Study?tab=spaced_repetition";
    if (/mock|exam|paper|sac practice/.test(t)) return "/Study?tab=exam";
    if (/quiz/.test(t)) return "/Quizzes";
    if (/recall/.test(t)) return "/Study?tab=active_recall";
    if (/blurt/.test(t)) return "/Study?tab=blurting";
    return "/Study";
}

// Session metadata lives in `notes` as tags — the study_plans table 400s on
// unknown columns, so duration and free-text notes piggyback on the one text
// field that already exists: "[rec:abc123][dur:40] bring the formula sheet"
const REC_TAG = /\[rec:([a-z0-9-]+)\]/i;
const DUR_TAG = /\[dur:(\d+)\]/i;
const recIdOf = (plan) => plan.notes?.match(REC_TAG)?.[1] || null;
const durationOf = (plan) => {
    const m = plan.notes?.match(DUR_TAG);
    return m ? Number(m[1]) : null;
};
const noteTextOf = (plan) =>
    (plan.notes || "").replace(REC_TAG, "").replace(DUR_TAG, "").trim() || null;

// Rebuild the notes field from its parts, preserving the recurrence id so
// editing a session doesn't quietly orphan it from its series.
const buildNotes = (recId, duration, text) => {
    const tags = `${recId ? `[rec:${recId}]` : ""}${duration ? `[dur:${duration}]` : ""}`;
    const body = (text || "").trim();
    return `${tags}${body ? ` ${body}` : ""}` || null;
};

// ─── Time maths for dragging ────────────────────────────────────────────────
// Days render as time-ordered stacks, so where a session lands in the stack is
// a statement about when it happens. These turn a drop position into a clock
// time, under three rules the UI states out loud:
//   · into an empty day  → keeps its own time
//   · above everything   → ends where the first session starts
//   · after a session    → starts when that one finishes
const DEFAULT_DUR = 40;
const GAP = 10;          // minutes of breathing room between back-to-back sessions
const DAY_MIN = 6 * 60;  // don't schedule before 06:00
const DAY_MAX = 22 * 60; // or after 22:00

const toMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const toHHMM = (mins) => {
    const c = Math.max(DAY_MIN, Math.min(DAY_MAX, Math.round(mins / 5) * 5));
    return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};
const prettyTime = (hhmm) => {
    const mins = toMinutes(hhmm);
    if (mins == null) return null;
    const h = Math.floor(mins / 60), m = mins % 60;
    const suffix = h < 12 ? "am" : "pm";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
};

/**
 * Start time for a session dropped at `index` in `siblings` (the target day's
 * other sessions, already time-ordered). Returns null to mean "keep whatever
 * time it already had".
 */
function timeForSlot(siblings, index, movingDuration) {
    const dur = movingDuration || DEFAULT_DUR;
    const prev = siblings[index - 1];
    const next = siblings[index];

    if (prev) {
        const prevStart = toMinutes(prev.start_time);
        if (prevStart != null) return toHHMM(prevStart + (durationOf(prev) || DEFAULT_DUR) + GAP);
    }
    if (next) {
        const nextStart = toMinutes(next.start_time);
        if (nextStart != null) return toHHMM(nextStart - GAP - dur);
    }
    return null; // empty day, or neighbours with no times of their own
}

export default function Planner() {
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [plans, setPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Week navigation — Monday-anchored, -1 (last week) .. +8.
    const [weekOffset, setWeekOffset] = useState(0);

    // Add-SAC form
    const [sacTitle, setSacTitle] = useState("");
    const [sacSubject, setSacSubject] = useState("");
    const [sacType, setSacType] = useState("sac");
    const [sacDate, setSacDate] = useState("");
    const [savingSac, setSavingSac] = useState(false);

    // Add/edit-session dialog (type + details + recurrence). `editingPlan`
    // switches the same dialog from create to update.
    const [planDay, setPlanDay] = useState(null);
    const [editingPlan, setEditingPlan] = useState(null);
    const [planType, setPlanType] = useState("");
    const [planTitle, setPlanTitle] = useState("");
    const [planSubject, setPlanSubject] = useState("");
    const [planTime, setPlanTime] = useState("16:00");
    const [planDuration, setPlanDuration] = useState(40);
    const [planNote, setPlanNote] = useState("");
    const [repeatWeekly, setRepeatWeekly] = useState(false);
    const [repeatWeeks, setRepeatWeeks] = useState(4);
    const [savingPlan, setSavingPlan] = useState(false);

    // Recurring delete choice
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Daily intention card
    const [editingIntention, setEditingIntention] = useState(false);
    const [intentionDraft, setIntentionDraft] = useState("");
    const [savingIntention, setSavingIntention] = useState(false);

    // AI planning dialog
    const [aiOpen, setAiOpen] = useState(false);
    const [aiHours, setAiHours] = useState(5);
    const [aiFocus, setAiFocus] = useState([]);
    const [aiTimes, setAiTimes] = useState("after_school");
    const [aiNotes, setAiNotes] = useState("");
    const [aiProposals, setAiProposals] = useState(null); // [{...session, include}]
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiSacSubject, setAiSacSubject] = useState("");
    const [aiSacTitle, setAiSacTitle] = useState("");
    const [aiSacDate, setAiSacDate] = useState("");

    const loadData = useCallback(async (email) => {
        try {
            const rangeStart = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), -1), "yyyy-MM-dd");
            const rangeEnd = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), MAX_WEEKS_AHEAD + 1), "yyyy-MM-dd");
            const [profileData, subjectData, assessmentData, planData] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: email }).catch(() => []),
                base44.entities.UserSubject.filter({ created_by: email, is_active: true }).catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: email }, "due_date", 50).catch(() => []),
                base44.entities.StudyPlan.filter({ created_by: email, date: { $gte: rangeStart, $lte: rangeEnd } }, "date", 200).catch(() => []),
            ]);
            const p = profileData[0] || null;
            setProfile(p);
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

    // Visible week (Mon–Sun).
    const weekStart = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), [weekOffset]);
    const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        const key = format(d, "yyyy-MM-dd");
        return {
            key,
            dayName: format(d, "EEE"),
            dayNum: format(d, "d"),
            isToday: key === todayStr,
            isPast: key < todayStr,
            plans: plans.filter(p => p.date === key).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
            sacs: upcoming.filter(a => a.due_date === key),
        };
    }), [weekStart, plans, upcoming, todayStr]);

    const weekLabel = weekOffset === 0 ? "This week"
        : weekOffset === 1 ? "Next week"
        : `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM")}`;
    const plannedThisWeek = week.reduce((n, d) => n + d.plans.length, 0);
    const doneThisWeek = week.reduce((n, d) => n + d.plans.filter(p => p.is_completed).length, 0);
    const weekPct = plannedThisWeek > 0 ? Math.round((doneThisWeek / plannedThisWeek) * 100) : 0;

    const coachLine = !nextSac
        ? "No SACs tracked yet — add the next one and the whole app plans around it."
        : nextSacDays === 0
            ? `${nextSac.subject_name} ${nextSac.title} is today. You've prepared — go show it.`
            : nextSacDays <= 3
                ? `${nextSac.subject_name} in ${daysLabel(nextSacDays).toLowerCase()} — every session now counts double.`
                : `${daysLabel(nextSacDays)} until ${nextSac.subject_name} ${nextSac.title}. Plenty of runway — let's use it.`;

    // ─── SAC actions ───────────────────────────────────────────────────────────
    const addSac = async (subject = sacSubject, title = sacTitle, type = sacType, date = sacDate) => {
        if (!title.trim() || !subject || !date) {
            toast({ title: "Almost there", description: "Subject, name and date make a SAC trackable." });
            return false;
        }
        try {
            await base44.entities.SubjectAssessment.create({
                title: title.trim(), subject_name: subject, assessment_type: type,
                due_date: date, is_completed: false,
            });
            toast({ title: "SAC tracked 🎯", description: "Study, Revision Mode and your Dashboard now plan around it." });
            loadData(user.email);
            return true;
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
            return false;
        }
    };

    const handleAddSac = async () => {
        setSavingSac(true);
        const ok = await addSac();
        if (ok) { setSacTitle(""); setSacDate(""); }
        setSavingSac(false);
    };

    const toggleSacDone = async (a) => {
        try {
            await base44.entities.SubjectAssessment.update(a.id, { is_completed: !a.is_completed });
            loadData(user.email);
        } catch { toast({ title: "Couldn't update", variant: "destructive" }); }
    };

    const deleteSac = async (a) => {
        try {
            await base44.entities.SubjectAssessment.delete(a.id);
            loadData(user.email);
        } catch { toast({ title: "Couldn't remove", variant: "destructive" }); }
    };

    // ─── Session actions ───────────────────────────────────────────────────────
    const addPlan = async () => {
        if (!planTitle.trim() || !planDay) return;
        setSavingPlan(true);
        try {
            const recId = repeatWeekly ? (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : `${Date.now()}`) : null;
            const weeks = repeatWeekly ? repeatWeeks : 1;
            // Type prefix keeps sessionLink() routing to the right study tool
            // ("Flashcards: gene regulation" → spaced repetition, etc.).
            const alreadyPrefixed = planTitle.includes(":");
            const finalTitle = planType && planType !== "Other" && !alreadyPrefixed
                ? `${planType}: ${planTitle.trim()}`
                : planTitle.trim();
            const tags = `${recId ? `[rec:${recId}]` : ""}${planDuration ? `[dur:${planDuration}]` : ""}`;
            const notes = `${tags}${planNote.trim() ? ` ${planNote.trim()}` : ""}` || null;
            for (let i = 0; i < weeks; i++) {
                await base44.entities.StudyPlan.create({
                    title: finalTitle,
                    subject_name: planSubject || null,
                    date: format(addDays(parseISO(planDay), i * 7), "yyyy-MM-dd"),
                    start_time: planTime || null,
                    is_completed: false,
                    notes,
                });
            }
            if (repeatWeekly) toast({ title: `🔁 Weekly for ${weeks} weeks`, description: "The series is on the board — delete any one to trim it." });
            setPlanDay(null); setPlanTitle(""); setPlanType(""); setPlanNote(""); setRepeatWeekly(false);
            loadData(user.email);
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setSavingPlan(false);
        }
    };

    // ─── Editing an existing session ──────────────────────────────────────────
    // The add dialog already collects everything a session has, so editing
    // reuses it rather than growing a second form that drifts out of sync.
    const openAddPlan = (dayKey) => {
        setEditingPlan(null);
        setPlanDay(dayKey);
        setPlanTitle(""); setPlanType(""); setPlanNote(""); setRepeatWeekly(false);
    };

    const openEditPlan = (p) => {
        const known = SESSION_TYPES.find(t => p.title?.startsWith(`${t.value}: `));
        setEditingPlan(p);
        setPlanDay(p.date);
        setPlanType(known?.value || "");
        setPlanTitle(known ? p.title.slice(known.value.length + 2) : (p.title || ""));
        setPlanSubject(p.subject_name || "");
        setPlanTime(p.start_time || "16:00");
        setPlanDuration(durationOf(p) || DEFAULT_DUR);
        setPlanNote(noteTextOf(p) || "");
        setRepeatWeekly(false);
    };

    const closePlanDialog = () => { setPlanDay(null); setEditingPlan(null); };

    const savePlanEdits = async () => {
        if (!editingPlan || !planTitle.trim() || !planDay) return;
        setSavingPlan(true);
        const alreadyPrefixed = planTitle.includes(":");
        const finalTitle = planType && planType !== "Other" && !alreadyPrefixed
            ? `${planType}: ${planTitle.trim()}`
            : planTitle.trim();
        const patch = {
            title: finalTitle,
            subject_name: planSubject || null,
            date: planDay,
            start_time: planTime || null,
            notes: buildNotes(recIdOf(editingPlan), planDuration, planNote),
        };
        try {
            await base44.entities.StudyPlan.update(editingPlan.id, patch);
            setPlans(prev => prev.map(x => x.id === editingPlan.id ? { ...x, ...patch } : x));
            closePlanDialog();
            toast({ title: "Session updated" });
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setSavingPlan(false);
        }
    };

    // ─── Dragging a session to another day / time ─────────────────────────────
    const movePlan = async (planId, toDate, toIndex) => {
        const plan = plans.find(p => p.id === planId);
        if (!plan) return;

        const siblings = plans
            .filter(p => p.date === toDate && p.id !== planId)
            .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
        const newTime = timeForSlot(siblings, toIndex, durationOf(plan)) || plan.start_time;

        if (plan.date === toDate && plan.start_time === newTime) return;

        const before = { date: plan.date, start_time: plan.start_time };
        const patch = { date: toDate, start_time: newTime };
        // Optimistic — the board should follow your finger, not the network.
        setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...patch } : p));

        const revert = async () => {
            setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...before } : p));
            try { await base44.entities.StudyPlan.update(planId, before); } catch { /* board is already back */ }
        };

        try {
            await base44.entities.StudyPlan.update(planId, patch);
            toast({
                title: `Moved to ${format(parseISO(toDate), "EEE d MMM")}`,
                description: newTime ? `Now starts ${prettyTime(newTime)}.` : undefined,
                action: <ToastAction altText="Undo the move" onClick={revert}>Undo</ToastAction>,
            });
        } catch (e) {
            setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...before } : p));
            toast({ title: "Couldn't move it", description: e.message, variant: "destructive" });
        }
    };

    const onDragEnd = (result) => {
        const { draggableId, source, destination } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;
        movePlan(draggableId, destination.droppableId, destination.index);
    };

    const togglePlanDone = async (p) => {
        try {
            await base44.entities.StudyPlan.update(p.id, { is_completed: !p.is_completed });
            setPlans(prev => prev.map(x => x.id === p.id ? { ...x, is_completed: !p.is_completed } : x));
        } catch { toast({ title: "Couldn't update", variant: "destructive" }); }
    };

    const requestDeletePlan = (p) => {
        if (recIdOf(p)) setDeleteTarget(p);
        else deletePlans([p]);
    };

    const deletePlans = async (list) => {
        try {
            for (const p of list) await base44.entities.StudyPlan.delete(p.id);
            setPlans(prev => prev.filter(x => !list.some(d => d.id === x.id)));
            setDeleteTarget(null);
        } catch { toast({ title: "Couldn't remove", variant: "destructive" }); }
    };

    const deleteFuture = () => {
        const rid = recIdOf(deleteTarget);
        deletePlans(plans.filter(p => recIdOf(p) === rid && p.date >= deleteTarget.date));
    };

    // ─── Daily intention ───────────────────────────────────────────────────────
    // One line for today, stored in profile.extra (merged, never overwritten —
    // extra also carries year_level / attribution / xp boosts).
    const todayIntention = profile?.extra?.daily_intention?.date === todayStr
        ? profile.extra.daily_intention.text
        : null;

    const saveIntention = async (text) => {
        const t = (text || "").trim();
        if (!t || !profile) return;
        setSavingIntention(true);
        try {
            const extra = { ...(profile.extra || {}), daily_intention: { date: todayStr, text: t.slice(0, 80) } };
            await base44.entities.UserProfile.update(profile.id, { extra });
            setProfile(prev => ({ ...prev, extra }));
            setEditingIntention(false);
            setIntentionDraft("");
            toast({ title: "Intention set 🌱" });
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setSavingIntention(false);
        }
    };

    // ─── AI planning ───────────────────────────────────────────────────────────
    const openAiPlanner = () => {
        const soon = new Set(upcoming.filter(a => differenceInDays(parseISO(a.due_date), parseISO(todayStr)) <= 14).map(a => a.subject_name));
        setAiFocus(soon.size ? [...soon] : subjects.slice(0, 2).map(s => s.subject_name));
        setAiProposals(null);
        setAiOpen(true);
    };

    const toggleFocus = (name) =>
        setAiFocus(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    const generatePlan = async () => {
        setAiGenerating(true);
        try {
            const planStart = weekStart < new Date() ? todayStr : format(weekStart, "yyyy-MM-dd");
            const planEnd = format(addDays(weekStart, 6), "yyyy-MM-dd");
            const timeHint = aiTimes === "after_school" ? "16:00-18:00 on school days"
                : aiTimes === "evenings" ? "19:00-21:30"
                : "mostly Saturday and Sunday, 10:00-17:00";
            const response = await base44.integrations.Core.InvokeLLM({
                feature: "ai_tool",
                prompt: `You are a VCE study coach planning one week of study sessions. Today is ${todayStr}.
Plan for dates ${planStart} to ${planEnd} only.
Total study budget: about ${aiHours} hours for the week (each session 25-60 min; derive the session count from the budget).
Focus subjects: ${aiFocus.join(", ") || "any of the student's subjects"}.
All subjects: ${subjects.map(s => s.subject_name).join(", ") || "not set"}.
Upcoming assessments: ${upcoming.slice(0, 8).map(a => `${a.subject_name} ${a.title} (${a.assessment_type}) on ${a.due_date}`).join("; ") || "none tracked"}.
Preferred study times: ${timeHint}.
Existing sessions (avoid clashing): ${plans.filter(p => p.date >= planStart && p.date <= planEnd).map(p => `${p.date} ${p.start_time || ""} ${p.title}`).join("; ") || "none"}.
Student notes: ${aiNotes || "none"}.

Rules: weight sessions toward the nearest assessments; at most 2 sessions per day; vary techniques (flashcards, active recall, quiz, timed mock, blurting, pomodoro notes review); every title starts with the technique, e.g. "Flashcards: gene regulation", "Timed mock: Methods tech-free", "Active recall: AOS2 key knowledge". Give each a date within range and a start_time (HH:MM) respecting the preferred times. Also give duration_minutes (25-60).`,
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
                                    duration_minutes: { type: "number" },
                                },
                                required: ["title", "date"],
                            },
                        },
                    },
                    required: ["sessions"],
                },
            });
            const proposals = (response?.sessions || [])
                .filter(s => s.date >= planStart && s.date <= planEnd)
                .slice(0, 12)
                .map(s => ({ ...s, include: true }));
            if (!proposals.length) throw new Error("The coach came back empty-handed — try again.");
            setAiProposals(proposals);
        } catch (e) {
            toast({ title: "Planning unavailable", description: e.message, variant: "destructive" });
        } finally {
            setAiGenerating(false);
        }
    };

    const saveProposals = async () => {
        const chosen = (aiProposals || []).filter(p => p.include);
        if (!chosen.length) { setAiOpen(false); return; }
        setAiSaving(true);
        try {
            for (const s of chosen) {
                await base44.entities.StudyPlan.create({
                    title: s.title, subject_name: s.subject_name || null,
                    date: s.date, start_time: s.start_time || null, is_completed: false,
                    notes: s.duration_minutes ? `[dur:${Math.round(s.duration_minutes)}]` : null,
                });
            }
            toast({ title: `✨ ${chosen.length} sessions on the board`, description: "Adjust anything that clashes — it's your week." });
            setAiOpen(false);
            loadData(user.email);
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setAiSaving(false);
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
            <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">

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
                        </div>
                        <HelpButton page="Planner" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── HERO: countdown banner + target ─────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2">
                        {nextSac ? (
                            <div className={`relative overflow-hidden rounded-3xl p-6 lg:p-8 text-white shadow-soft h-full ${
                                nextSacDays <= 3 ? "bg-gradient-to-br from-streak to-xp" : "bg-gradient-to-br from-chart-3 to-chart-4"
                            }`}>
                                <Flag className="absolute -top-8 -right-8 w-44 h-44 text-white/10 pointer-events-none" />
                                <div className="relative">
                                    <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
                                        {nextSacDays <= 3 ? "Crunch time" : "Next assessment"}
                                    </p>
                                    <div className="flex items-end gap-4 flex-wrap">
                                        <p className="font-display font-black leading-none" style={{ fontSize: "clamp(3rem, 8vw, 5rem)" }}>
                                            {daysLabel(nextSacDays)}
                                        </p>
                                        <div className="mb-2 min-w-0">
                                            <p className="font-extrabold text-white truncate text-lg">{nextSac.subject_name} — {nextSac.title}</p>
                                            <p className="text-sm text-white/75">{format(parseISO(nextSac.due_date), "EEEE d MMMM")}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-5 flex-wrap">
                                        <Link to="/Study?tab=exam"
                                            className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2 text-sm font-bold transition-colors">
                                            <GraduationCap className="w-4 h-4" /> Run a timed mock
                                        </Link>
                                        <Link to="/Study?tab=spaced_repetition"
                                            className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2 text-sm font-bold transition-colors">
                                            <BookOpen className="w-4 h-4" /> Review cards
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-3xl bg-surface border border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center shadow-soft">
                                <div className="w-14 h-14 rounded-2xl bg-chart-3/10 flex items-center justify-center mb-3">
                                    <Flag className="w-7 h-7 text-chart-3" />
                                </div>
                                <h2 className="font-display font-extrabold text-foreground text-lg mb-1">What's your next SAC?</h2>
                                <p className="text-muted-foreground text-sm max-w-sm">
                                    Add it below — Study, Revision Mode and your Dashboard all start counting down with you.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Daily intention card */}
                    <div className="rounded-3xl bg-chart-4/5 border border-chart-4/15 shadow-soft p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <p className="stat-label text-chart-4/80">Today's intention</p>
                            {todayIntention && !editingIntention && (
                                <button onClick={() => { setIntentionDraft(todayIntention); setEditingIntention(true); }} aria-label="Change intention"
                                    className="text-muted-foreground/60 hover:text-foreground transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                            {editingIntention && (
                                <button onClick={() => { setEditingIntention(false); setIntentionDraft(""); }} aria-label="Cancel"
                                    className="text-muted-foreground/60 hover:text-foreground transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {todayIntention && !editingIntention ? (
                            <div className="flex-1 flex flex-col">
                                <p className="font-display font-extrabold text-chart-4 leading-snug text-2xl lg:text-[1.7rem]">
                                    “{todayIntention}”
                                </p>
                                <p className="text-xs text-muted-foreground mt-auto pt-3">
                                    One line, one day. Tomorrow you set a fresh one.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground mb-1">Pick one — or write your own:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {PRESET_INTENTIONS.map(p => (
                                        <button key={p} onClick={() => saveIntention(p)} disabled={savingIntention}
                                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 border-chart-4/25 bg-surface text-chart-4 hover:bg-chart-4/10 transition-colors text-left">
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-1.5 pt-1">
                                    <Input value={intentionDraft} onChange={e => setIntentionDraft(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") saveIntention(intentionDraft); }}
                                        placeholder="Write your own…" maxLength={80} className="h-9 text-sm" />
                                    <Button size="sm" onClick={() => saveIntention(intentionDraft)}
                                        disabled={savingIntention || !intentionDraft.trim()} className="h-9 gap-1 flex-shrink-0">
                                        {savingIntention ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Set
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* ── UPCOMING SACS ───────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl mb-3 flex items-center gap-2">
                        <Flag className="w-5 h-5 text-chart-3" /> Upcoming SACs
                    </h2>

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
                            <Button onClick={handleAddSac} disabled={savingSac} className="gap-1.5">
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
                                                className="w-6 h-6 rounded-lg border-2 border-border hover:border-primary flex items-center justify-center flex-shrink-0 transition-colors" />
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

                {/* ── WEEK BOARD ──────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl flex items-center gap-2">
                                <CalendarDays className="w-5 h-5 text-primary" /> {weekLabel}
                            </h2>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setWeekOffset(o => Math.max(-1, o - 1))} disabled={weekOffset <= -1}
                                    aria-label="Previous week"
                                    className="w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-30 transition-all">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setWeekOffset(o => Math.min(MAX_WEEKS_AHEAD, o + 1))} disabled={weekOffset >= MAX_WEEKS_AHEAD}
                                    aria-label="Next week"
                                    className="w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-30 transition-all">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                {weekOffset !== 0 && (
                                    <button onClick={() => setWeekOffset(0)}
                                        className="ml-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                        Today
                                    </button>
                                )}
                            </div>
                        </div>
                        <Button onClick={openAiPlanner} size="sm" variant="outline" className="gap-1.5 border-2 border-chart-4/30 text-chart-4 hover:bg-chart-4/5">
                            <Sparkles className="w-3.5 h-3.5" /> Plan this week for me
                        </Button>
                    </div>

                    {/* Planned vs done scoreboard */}
                    {plannedThisWeek > 0 && (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                <motion.div animate={{ width: `${weekPct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
                                    className={`h-full rounded-full ${weekPct >= 100 ? "bg-primary" : "bg-xp"}`} />
                            </div>
                            <p className="text-xs font-bold text-muted-foreground whitespace-nowrap">{doneThisWeek}/{plannedThisWeek} done</p>
                        </div>
                    )}

                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                            {week.map(day => (
                                <Droppable droppableId={day.key} key={day.key}>
                                    {(dropProvided, dropSnapshot) => (
                                        <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}
                                            className={`rounded-2xl border-2 p-3 min-h-[240px] flex flex-col gap-2 transition-colors ${
                                                dropSnapshot.isDraggingOver ? "bg-chart-3/10 border-chart-3 border-dashed"
                                                    : day.isToday ? "bg-primary/5 border-primary/40"
                                                    : day.isPast ? "bg-secondary/30 border-border/60 opacity-70"
                                                    : "bg-surface border-border"
                                            }`}>
                                            <div className="flex items-center justify-between px-0.5 mb-0.5">
                                                <div className="flex items-baseline gap-1.5">
                                                    <p className={`text-xs font-black uppercase tracking-wide ${day.isToday ? "text-primary" : "text-muted-foreground/70"}`}>{day.dayName}</p>
                                                    <p className={`font-display font-extrabold text-lg ${day.isToday ? "text-primary" : "text-muted-foreground/50"}`}>{day.dayNum}</p>
                                                </div>
                                                {!day.isPast && (
                                                    <button onClick={() => openAddPlan(day.key)} aria-label={`Add session on ${day.dayName} ${day.dayNum}`}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all">
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            {day.sacs.map(a => (
                                                <div key={a.id} className="rounded-xl bg-streak text-white px-2.5 py-2 shadow-soft">
                                                    <p className="text-xs font-black leading-tight">🚩 {a.subject_name}</p>
                                                    <p className="text-[11px] font-bold text-white/80 leading-tight">{(a.assessment_type || "SAC").toUpperCase()} · {a.title}</p>
                                                </div>
                                            ))}

                                            {day.plans.map((p, i) => {
                                                const dur = durationOf(p);
                                                const note = noteTextOf(p);
                                                // disableInteractiveElementBlocking is what makes the whole
                                                // bubble grabbable. By default the library refuses to lift a
                                                // drag that starts on a link or button, which is most of this
                                                // card — with it off, a tap still opens the tool (a lift needs
                                                // movement first) but click-and-hold picks the session up from
                                                // anywhere on it.
                                                return (
                                                    <Draggable draggableId={p.id} index={i} key={p.id} disableInteractiveElementBlocking>
                                                        {(dragProvided, dragSnapshot) => (
                                                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                                                aria-label={`${p.title}. Press space to pick this session up, then the arrow keys to move it.`}
                                                                className={`group relative rounded-xl border pl-2 pr-2 py-2 transition-shadow cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-chart-3 ${
                                                                    dragSnapshot.isDragging ? "shadow-lg ring-2 ring-chart-3 rotate-1" : ""
                                                                } ${
                                                                    p.is_completed ? "bg-primary/5 border-primary/20" : subjectChipClass(p.subject_name || p.title)
                                                                }`}>
                                                                {/* Edit and remove float over the card rather than sitting
                                                                    in the row — at seven columns a day is ~150px wide and
                                                                    an action column costs the title a whole line. */}
                                                                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-10">
                                                                    <button onClick={() => openEditPlan(p)} aria-label={`Edit ${p.title}`}
                                                                        className="w-5 h-5 rounded-md bg-surface/90 shadow-sm flex items-center justify-center text-muted-foreground/60 hover:text-chart-3">
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                    <button onClick={() => requestDeletePlan(p)} aria-label={`Remove ${p.title}`}
                                                                        className="w-5 h-5 rounded-md bg-surface/90 shadow-sm flex items-center justify-center text-muted-foreground/60 hover:text-streak">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>

                                                                <div className="flex items-start gap-1.5">
                                                                    <GripVertical className="w-3 h-3 -ml-1.5 mt-0.5 text-muted-foreground/25 group-hover:text-muted-foreground/60 flex-shrink-0 transition-colors" />
                                                                    <button onClick={() => togglePlanDone(p)} aria-label="Toggle session done"
                                                                        className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                                                            p.is_completed ? "bg-primary border-primary text-white" : "border-current/40 hover:border-current"
                                                                        }`}>
                                                                        {p.is_completed && <Check className="w-3 h-3" />}
                                                                    </button>
                                                                    <Link to={sessionLink(p.title)} className="min-w-0 flex-1" title={note || undefined}>
                                                                        <p className={`text-xs font-bold leading-tight ${p.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                                                            {p.title}
                                                                            {recIdOf(p) && <Repeat className="w-2.5 h-2.5 inline ml-1 opacity-50" />}
                                                                        </p>
                                                                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                                                            {[prettyTime(p.start_time), dur ? `${dur}m` : null, p.subject_name].filter(Boolean).join(" · ")}
                                                                        </p>
                                                                        {note && <p className="text-[11px] text-muted-foreground/70 italic leading-tight mt-0.5 truncate">{note}</p>}
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {dropProvided.placeholder}

                                            {day.plans.length === 0 && day.sacs.length === 0 && !day.isPast && !dropSnapshot.isDraggingOver && (
                                                <button onClick={() => openAddPlan(day.key)}
                                                    className="flex-1 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground/40 hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                                                    + plan
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            ))}
                        </div>
                    </DragDropContext>

                    <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Tap a session to open the right tool. Drag one to another day to move it — dropping it under
                        another session starts it when that one finishes, and dropping it on top puts it first.
                    </p>
                </motion.section>

                {/* ── Add-session dialog (with recurrence) ─────────────── */}
                <Dialog open={!!planDay} onOpenChange={(o) => !o && closePlanDialog()}>
                    <DialogContent className="max-w-md rounded-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="font-display">
                                {editingPlan ? "Edit session" : "Plan a session"}
                                {planDay ? ` — ${format(parseISO(planDay), "EEE d MMM")}` : ""}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3.5">
                            {/* Session type — picks the tool the chip will launch */}
                            <div>
                                <p className="stat-label mb-1.5">Session type</p>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {SESSION_TYPES.map(t => (
                                        <button key={t.value} onClick={() => setPlanType(prev => prev === t.value ? "" : t.value)}
                                            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${
                                                planType === t.value ? "bg-primary/10 border-primary/50 text-primary" : "bg-surface border-border text-muted-foreground hover:border-muted-foreground/40"
                                            }`}>
                                            <span className="text-base leading-none">{t.emoji}</span>
                                            {t.value}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="stat-label mb-1.5">Topic</p>
                                <Input placeholder={planType && planType !== "Other" ? `e.g. "gene regulation" — saves as "${planType}: …"` : 'e.g. "Flashcards: gene regulation"'}
                                    value={planTitle} onChange={e => setPlanTitle(e.target.value)} maxLength={80} autoFocus />
                            </div>

                            <div>
                                <p className="stat-label mb-1.5">Subject</p>
                                <Select value={planSubject} onValueChange={setPlanSubject}>
                                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                                    <SelectContent>
                                        {subjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Day and time together — dragging is the quick way to move a
                                session, this is the exact way, and the only way on a
                                keyboard-free-hands day when you know precisely when. */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <p className="stat-label mb-1.5">Day</p>
                                    <Input type="date" value={planDay || ""} onChange={e => e.target.value && setPlanDay(e.target.value)} />
                                </div>
                                <div>
                                    <p className="stat-label mb-1.5">Start time</p>
                                    <Input type="time" value={planTime} onChange={e => setPlanTime(e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <p className="stat-label mb-1.5">How long</p>
                                <div className="flex gap-1.5">
                                    {DURATION_OPTIONS.map(d => (
                                        <button key={d} onClick={() => setPlanDuration(d)}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                                planDuration === d ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-muted-foreground hover:border-muted-foreground/40"
                                            }`}>
                                            {d}m
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="stat-label mb-1.5">Note to self</p>
                                <Input placeholder='Optional — e.g. "focus on q4-style problems"' value={planNote} onChange={e => setPlanNote(e.target.value)} maxLength={120} />
                            </div>

                            {/* Recurrence — creation only. Editing one occurrence of a
                                series changes that occurrence, which is said out loud
                                below rather than left for the student to discover. */}
                            {editingPlan ? (
                                recIdOf(editingPlan) && (
                                    <p className="text-xs text-muted-foreground flex items-start gap-1.5 bg-secondary/50 rounded-xl p-2.5 border border-border">
                                        <Repeat className="w-3.5 h-3.5 text-chart-3 flex-shrink-0 mt-0.5" />
                                        This one repeats weekly. Your changes apply to this session only — the rest of the series stays as it is.
                                    </p>
                                )
                            ) : (
                            <div className={`rounded-2xl border-2 p-3 transition-colors ${repeatWeekly ? "border-chart-3/40 bg-chart-3/5" : "border-border"}`}>
                                <button onClick={() => setRepeatWeekly(r => !r)} className="flex items-center gap-2 w-full">
                                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${repeatWeekly ? "bg-chart-3 border-chart-3 text-white" : "border-border"}`}>
                                        {repeatWeekly && <Check className="w-3 h-3" />}
                                    </span>
                                    <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                        <Repeat className="w-3.5 h-3.5 text-chart-3" /> Repeat weekly
                                    </span>
                                </button>
                                {repeatWeekly && (
                                    <div className="flex gap-1.5 mt-2.5">
                                        {REPEAT_OPTIONS.map(w => (
                                            <button key={w} onClick={() => setRepeatWeeks(w)}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${repeatWeeks === w ? "bg-chart-3 border-chart-3 text-white" : "bg-surface border-border text-muted-foreground"}`}>
                                                {w} wks
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            )}

                            <Button onClick={editingPlan ? savePlanEdits : addPlan} disabled={savingPlan || !planTitle.trim()} className="w-full gap-1.5">
                                {savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPlan ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {editingPlan ? "Save changes" : repeatWeekly ? `Add ${repeatWeeks} weekly sessions` : "Add to plan"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ── Recurring-delete choice ──────────────────────────── */}
                <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                    <DialogContent className="max-w-xs rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="font-display text-base">Remove repeating session?</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Button onClick={() => deletePlans([deleteTarget])} variant="outline" className="w-full border-2">Just this one</Button>
                            <Button onClick={deleteFuture} className="w-full bg-streak hover:bg-streak/90 text-white">This and all future</Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ── AI week planner dialog ───────────────────────────── */}
                <Dialog open={aiOpen} onOpenChange={setAiOpen}>
                    <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="font-display flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-chart-4" /> Plan {weekLabel.toLowerCase()} for me
                            </DialogTitle>
                        </DialogHeader>

                        {!aiProposals ? (
                            <div className="space-y-4">
                                <div>
                                    <p className="stat-label mb-2">Hours this week</p>
                                    <div className="flex gap-2">
                                        {HOUR_OPTIONS.map(h => (
                                            <button key={h} onClick={() => setAiHours(h)}
                                                className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${aiHours === h ? "bg-chart-4 border-chart-4 text-white shadow-soft" : "bg-surface border-border text-foreground hover:border-chart-4/40"}`}>
                                                {h}h
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="stat-label mb-2">Focus subjects</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {subjects.map(s => (
                                            <button key={s.id} onClick={() => toggleFocus(s.subject_name)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${aiFocus.includes(s.subject_name) ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-muted-foreground hover:border-muted-foreground"}`}>
                                                {s.subject_name}
                                            </button>
                                        ))}
                                        {subjects.length === 0 && <p className="text-xs text-muted-foreground">Add subjects in Settings first.</p>}
                                    </div>
                                </div>

                                <div>
                                    <p className="stat-label mb-2">When you study</p>
                                    <div className="flex gap-2">
                                        {TIME_PREFS.map(t => (
                                            <button key={t.value} onClick={() => setAiTimes(t.value)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${aiTimes === t.value ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-muted-foreground hover:border-muted-foreground"}`}>
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Assessments in scope + quick add */}
                                <div>
                                    <p className="stat-label mb-2">Assessments it plans around</p>
                                    {upcoming.length > 0 ? (
                                        <div className="space-y-1.5 mb-2">
                                            {upcoming.slice(0, 4).map(a => (
                                                <div key={a.id} className="flex items-center gap-2 text-xs">
                                                    <Flag className="w-3 h-3 text-chart-3 flex-shrink-0" />
                                                    <span className="font-bold text-foreground truncate">{a.subject_name} — {a.title}</span>
                                                    <span className="text-muted-foreground whitespace-nowrap ml-auto">{format(parseISO(a.due_date), "d MMM")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground mb-2">None tracked — add one so the plan has a target:</p>
                                    )}
                                    <div className="grid grid-cols-[1fr,1fr,auto,auto] gap-1.5 items-center">
                                        <Select value={aiSacSubject} onValueChange={setAiSacSubject}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
                                            <SelectContent>
                                                {subjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Input className="h-8 text-xs" placeholder="SAC name" value={aiSacTitle} onChange={e => setAiSacTitle(e.target.value)} />
                                        <Input className="h-8 text-xs w-auto" type="date" min={todayStr} value={aiSacDate} onChange={e => setAiSacDate(e.target.value)} />
                                        <Button size="sm" variant="outline" className="h-8 border-2 px-2"
                                            onClick={async () => {
                                                const ok = await addSac(aiSacSubject, aiSacTitle, "sac", aiSacDate);
                                                if (ok) { setAiSacTitle(""); setAiSacDate(""); }
                                            }}>
                                            <Plus className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <p className="stat-label mb-2">Anything else?</p>
                                    <Textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)} rows={2}
                                        placeholder='e.g. "short sessions", "heavy on Methods", "nothing Friday night"' className="text-sm" />
                                </div>

                                <Button onClick={generatePlan} disabled={aiGenerating} className="w-full bg-chart-4 hover:bg-chart-4/90 text-white font-bold rounded-xl py-5 btn-3d">
                                    {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                                    {aiGenerating ? "Planning…" : "Draft my week"}
                                </Button>
                            </div>
                        ) : (
                            /* Proposal review — nothing saves until approved */
                            <div className="space-y-3">
                                <p className="text-xs text-muted-foreground">Untick anything that clashes, then add the rest. Nothing is saved yet.</p>
                                <div className="space-y-1.5">
                                    {aiProposals.map((s, i) => (
                                        <button key={i}
                                            onClick={() => setAiProposals(prev => prev.map((x, xi) => xi === i ? { ...x, include: !x.include } : x))}
                                            className={`w-full flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all ${s.include ? "border-chart-4/40 bg-chart-4/5" : "border-border opacity-50"}`}>
                                            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${s.include ? "bg-chart-4 border-chart-4 text-white" : "border-border"}`}>
                                                {s.include && <Check className="w-3 h-3" />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-bold text-foreground leading-tight">{s.title}</span>
                                                <span className="block text-xs text-muted-foreground mt-0.5">
                                                    {format(parseISO(s.date), "EEE d MMM")}{s.start_time ? ` · ${s.start_time}` : ""}{s.subject_name ? ` · ${s.subject_name}` : ""}{s.duration_minutes ? ` · ${s.duration_minutes}m` : ""}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => setAiProposals(null)} variant="outline" className="border-2">Adjust</Button>
                                    <Button onClick={saveProposals} disabled={aiSaving} className="flex-1 bg-chart-4 hover:bg-chart-4/90 text-white font-bold">
                                        {aiSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                                        Add {(aiProposals || []).filter(p => p.include).length} session{(aiProposals || []).filter(p => p.include).length === 1 ? "" : "s"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
