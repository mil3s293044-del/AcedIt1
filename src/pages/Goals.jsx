/**
 * Planner — SAC-centred planning hub. Monday-anchored week board with
 * multi-week navigation, recurring sessions, launchable session chips
 * (each opens the right study tool), drag-and-drop between days, and an
 * expanded day view for inspecting and rearranging a single day at a time.
 * SAC plans themselves are built on the Strategise page.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createPageUrl } from "@/utils";
import { fmtDate } from "@/lib/safeDate";

const TYPE_OPTIONS = [
    { value: "sac", label: "SAC" },
    { value: "exam", label: "Exam" },
    { value: "test", label: "Test" },
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
// Hashing on the first character alone collided constantly — Chemistry and
// Methods both landed on index 2, so two subjects wore the same colour on the
// same board. Sum the whole name instead.
const hashName = (name) => {
    const s = name || "?";
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
};
const subjectChipClass = (name) => SUBJECT_CHIP[hashName(name) % SUBJECT_CHIP.length];

// Board chips carry the subject as a solid left rail instead of tinting the
// whole card. Seven columns of tinted cards read as noise; a 3px rail colour-
// codes just as well and lets the title sit on plain surface.
const SUBJECT_RAIL = ["bg-chart-3", "bg-chart-4", "bg-primary", "bg-xp", "bg-streak"];
const subjectRailClass = (name) => SUBJECT_RAIL[hashName(name) % SUBJECT_RAIL.length];

// Sessions are stored as "Flashcards: Redox half-equations" so sessionLink()
// can route them. On a 150px column that prefix eats the line that should be
// showing the actual topic, so the board shows the emoji and drops the word.
const typeOf = (title) => SESSION_TYPES.find(t => (title || "").startsWith(`${t.value}: `)) || null;
const shortTitle = (title) => {
    const t = typeOf(title);
    return t ? (title.slice(t.value.length + 2) || t.value) : (title || "");
};

function daysLabel(days) {
    if (days < 0) return "Past";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
}

// A planned session opens the tool it names — the plan is a launcher. One
// table so the route and the name the detail card shows can't drift apart.
const SESSION_ROUTES = [
    { test: /flash|card|spaced/, to: "/Study?tab=spaced_repetition", label: "Flashcards" },
    { test: /mock|exam|paper|sac practice/, to: "/Study?tab=exam", label: "Revision Mode" },
    { test: /quiz/, to: "/Quizzes", label: "Quizzes" },
    { test: /recall/, to: "/Study?tab=active_recall", label: "Active recall" },
    { test: /blurt/, to: "/Study?tab=blurting", label: "Blurting" },
];
const routeFor = (title) =>
    SESSION_ROUTES.find(r => r.test.test((title || "").toLowerCase())) || { to: "/Study", label: "Study tools" };
const sessionLink = (title) => routeFor(title).to;

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
    const navigate = useNavigate();
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
    const [openDay, setOpenDay] = useState(null);       // yyyy-mm-dd of the expanded day
    const [returnToDay, setReturnToDay] = useState(null); // day view to restore after the form closes
    const [openSession, setOpenSession] = useState(null); // the session whose detail card is open
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
            setPlanTitle(""); setPlanType(""); setPlanNote(""); setRepeatWeekly(false);
            closePlanDialog();
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

    // Editing from inside the day view shouldn't dump you back on the week
    // board — stash the day so closing the form drops you where you were.
    const closePlanDialog = () => {
        setPlanDay(null);
        setEditingPlan(null);
        if (returnToDay) { setOpenDay(returnToDay); setReturnToDay(null); }
    };

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
            // Reordering inside a day isn't a move to another day — say what
            // actually changed, or the toast reads as a bug.
            const sameDay = before.date === toDate;
            toast({
                title: sameDay ? "Reordered" : `Moved to ${fmtDate(toDate, "EEE d MMM")}`,
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
                                {/* Centred, because the intention card next to it sets the
                                    row height and the banner was pooling all the slack in a
                                    dead block under the buttons. */}
                                <div className="relative h-full flex flex-col justify-center">
                                    <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
                                        {nextSacDays <= 3 ? "Crunch time" : "Next assessment"}
                                    </p>
                                    <div className="flex items-end gap-4 flex-wrap">
                                        <p className="font-display font-black leading-none" style={{ fontSize: "clamp(3rem, 8vw, 5rem)" }}>
                                            {daysLabel(nextSacDays)}
                                        </p>
                                        <div className="mb-2 min-w-0">
                                            <p className="font-extrabold text-white truncate text-lg">{nextSac.subject_name} — {nextSac.title}</p>
                                            <p className="text-sm text-white/75">{fmtDate(nextSac.due_date, "EEEE d MMMM")}</p>
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
                                                <p className="text-xs text-muted-foreground">{fmtDate(a.due_date, "EEE d MMM")} · {(a.assessment_type || "sac").toUpperCase()}</p>
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
                        {/* Strategise replaces "Plan this week for me", which asked
                            for an hours budget and returned generic sessions with no
                            idea what the student was preparing for. This starts from
                            a logged assessment and works backwards from its date. */}
                        <Button onClick={() => navigate(createPageUrl("Strategise"))} size="sm"
                            className="gap-1.5 bg-chart-4 hover:bg-chart-4/90 text-white btn-3d">
                            <Sparkles className="w-3.5 h-3.5" /> Strategise a SAC
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
                                        // The tall min-height is for the seven-column grid, where every
                                        // day needs a drop zone big enough to aim at. Stacked on a phone
                                        // it just made the board 2,400px of mostly-empty boxes.
                                        <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}
                                            className={`relative rounded-2xl border-2 p-2.5 min-h-[88px] sm:min-h-[220px] flex flex-col gap-1.5 transition-all ${
                                                dropSnapshot.isDraggingOver ? "bg-chart-3/10 border-chart-3 border-dashed scale-[1.01]"
                                                    : day.isToday ? "bg-primary/[0.06] border-primary/40 shadow-soft"
                                                    : day.isPast ? "bg-secondary/20 border-border/50"
                                                    : "bg-surface border-border/70 hover:border-border"
                                            }`}>
                                            {/* The column is only ~150px wide, so a busy day
                                                truncates everything. Opening it full-size is
                                                where you actually inspect and reorder it. */}
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <button onClick={() => setOpenDay(day.key)}
                                                    aria-label={`Open ${day.dayName} ${day.dayNum}`}
                                                    className="group/day flex items-baseline gap-1.5 min-w-0 rounded-lg px-1.5 py-0.5 -mx-1 hover:bg-secondary/70 transition-colors">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                        day.isToday ? "text-primary" : day.isPast ? "text-muted-foreground/40" : "text-muted-foreground/60"}`}>
                                                        {day.dayName}
                                                    </span>
                                                    <span className={`font-display font-black text-lg leading-none tabular-nums ${
                                                        day.isToday ? "text-primary" : day.isPast ? "text-muted-foreground/35" : "text-foreground/70"}`}>
                                                        {day.dayNum}
                                                    </span>
                                                    {day.plans.length > 0 && (
                                                        <span className={`text-[10px] font-bold tabular-nums px-1.5 rounded-full ${
                                                            day.plans.every(p => p.is_completed) ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                                                            {day.plans.filter(p => p.is_completed).length}/{day.plans.length}
                                                        </span>
                                                    )}
                                                </button>
                                                {!day.isPast && (
                                                    <button onClick={() => openAddPlan(day.key)} aria-label={`Add session on ${day.dayName} ${day.dayNum}`}
                                                        className="w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all">
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {day.sacs.map(a => (
                                                <div key={a.id} className="rounded-xl bg-gradient-to-br from-streak to-streak/80 text-white px-2.5 py-2 shadow-soft">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-white/70 leading-tight">
                                                        🚩 {(a.assessment_type || "SAC")}
                                                    </p>
                                                    <p className="text-xs font-black leading-tight mt-0.5 truncate">{a.subject_name}</p>
                                                    <p className="text-[11px] font-bold text-white/80 leading-tight truncate">{a.title}</p>
                                                </div>
                                            ))}

                                            {day.plans.map((p, i) => {
                                                const dur = durationOf(p);
                                                const t = typeOf(p.title);
                                                // Two lines, never more: the type emoji and the topic on
                                                // one, the clock time on the other. Everything else —
                                                // subject, note, duration, recurrence, the actions — lives
                                                // in the detail card a click away, because at seven columns
                                                // a chip that shows it all shows none of it legibly.
                                                //
                                                // disableInteractiveElementBlocking is what makes the whole
                                                // bubble grabbable. By default the library refuses to lift a
                                                // drag that starts on a button, which is most of this card —
                                                // with it off, a tap still opens the detail card (a lift
                                                // needs movement first) but click-and-hold picks it up from
                                                // anywhere on it.
                                                return (
                                                    <Draggable draggableId={p.id} index={i} key={p.id} disableInteractiveElementBlocking>
                                                        {(dragProvided, dragSnapshot) => (
                                                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                                                aria-label={`${p.title}. Press space to pick this session up, then the arrow keys to move it.`}
                                                                className={`group relative flex overflow-hidden rounded-xl border bg-surface transition-all cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-chart-3 ${
                                                                    dragSnapshot.isDragging
                                                                        ? "shadow-lg ring-2 ring-chart-3 rotate-1 border-transparent"
                                                                        : "border-border hover:border-muted-foreground/40 hover:shadow-soft"
                                                                } ${p.is_completed ? "opacity-60" : ""}`}>
                                                                {/* Subject as a rail, not a wash. */}
                                                                <span aria-hidden className={`w-1 flex-shrink-0 ${
                                                                    p.is_completed ? "bg-primary" : subjectRailClass(p.subject_name || p.title)}`} />

                                                                <button onClick={() => togglePlanDone(p)} aria-label={`Mark ${p.title} ${p.is_completed ? "not done" : "done"}`}
                                                                    className={`w-4 h-4 mt-2 ml-1.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                                                        p.is_completed ? "bg-primary border-primary text-white" : "border-border hover:border-primary"
                                                                    }`}>
                                                                    {p.is_completed && <Check className="w-3 h-3" />}
                                                                </button>

                                                                <button onClick={() => setOpenSession(p)} aria-label={`Open ${p.title}`}
                                                                    className="min-w-0 flex-1 text-left pl-1.5 pr-2 py-1.5">
                                                                    {/* Two lines max — one truncated at ~12 characters told
                                                                        you nothing, five lines was the problem to begin with. */}
                                                                    <p className={`text-xs font-bold leading-tight line-clamp-2 ${
                                                                        p.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                                                        {t && <span className="mr-1">{t.emoji}</span>}{shortTitle(p.title)}
                                                                    </p>
                                                                    <p className="text-[11px] text-muted-foreground/80 leading-tight mt-0.5 truncate">
                                                                        {[prettyTime(p.start_time), dur ? `${dur}m` : null].filter(Boolean).join(" · ") || "Anytime"}
                                                                        {recIdOf(p) && <Repeat className="w-2.5 h-2.5 inline ml-1 opacity-60" />}
                                                                    </p>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {dropProvided.placeholder}

                                            {day.plans.length === 0 && day.sacs.length === 0 && !day.isPast && !dropSnapshot.isDraggingOver && (
                                                <button onClick={() => openAddPlan(day.key)}
                                                    className="flex-1 min-h-[64px] rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground/35 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all">
                                                    <Plus className="w-4 h-4" />
                                                    <span className="text-[11px] font-bold">Plan something</span>
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
                        Tap a session for its details, or a date to open the whole day. Drag one to another day to move
                        it — dropping it under another session starts it when that one finishes, on top puts it first.
                    </p>
                </motion.section>

                {/* ── Add-session dialog (with recurrence) ─────────────── */}
                <Dialog open={!!planDay} onOpenChange={(o) => !o && closePlanDialog()}>
                    <DialogContent className="max-w-md rounded-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="font-display">
                                {editingPlan ? "Edit session" : "Plan a session"}
                                {planDay ? ` — ${fmtDate(planDay, "EEE d MMM")}` : ""}
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

                {/* ── Session detail ───────────────────────────────────── */}
                {/* The board chip is deliberately two lines. This is where the
                    rest of the session lives, and where you act on it. Reads
                    from `plans` rather than the captured row so toggling done
                    or editing updates the card underneath you. */}
                <Dialog open={!!openSession} onOpenChange={(o) => !o && setOpenSession(null)}>
                    <DialogContent className="max-w-sm rounded-3xl">
                        {(() => {
                            const s = openSession ? (plans.find(p => p.id === openSession.id) || openSession) : null;
                            if (!s) return null;
                            const t = typeOf(s.title);
                            const dur = durationOf(s);
                            const note = noteTextOf(s);
                            const started = prettyTime(s.start_time);
                            const finishes = toMinutes(s.start_time) != null
                                ? prettyTime(toHHMM(toMinutes(s.start_time) + (dur || DEFAULT_DUR))) : null;
                            return (
                                <>
                                    <DialogHeader>
                                        <DialogTitle className="font-display flex items-start gap-2 text-left pr-6">
                                            {t && <span className="text-xl leading-none mt-0.5">{t.emoji}</span>}
                                            <span className="min-w-0">{shortTitle(s.title)}</span>
                                        </DialogTitle>
                                    </DialogHeader>

                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {s.subject_name && (
                                                <span className={`pill border ${subjectChipClass(s.subject_name)}`}>{s.subject_name}</span>
                                            )}
                                            {t && <span className="pill bg-secondary text-muted-foreground">{t.value}</span>}
                                            {recIdOf(s) && (
                                                <span className="pill bg-chart-3/10 text-chart-3 inline-flex items-center gap-1">
                                                    <Repeat className="w-3 h-3" /> Weekly
                                                </span>
                                            )}
                                            {s.is_completed && (
                                                <span className="pill bg-primary/15 text-primary inline-flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Done
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {[["When", fmtDate(s.date, "EEE d MMM")],
                                              ["Time", started ? (finishes ? `${started}–${finishes}` : started) : "Anytime"],
                                              ["How long", dur ? `${dur} min` : `${DEFAULT_DUR} min`],
                                              ["Opens", routeFor(s.title).label]].map(([k, v]) => (
                                                <div key={k}>
                                                    <p className="stat-label">{k}</p>
                                                    <p className="text-sm font-bold text-foreground mt-0.5">{v}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {note && (
                                            <div className="rounded-xl bg-secondary/60 px-3 py-2">
                                                <p className="stat-label mb-0.5">Note to self</p>
                                                <p className="text-sm text-foreground">{note}</p>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Button onClick={() => { setOpenSession(null); setOpenDay(null); navigate(sessionLink(s.title)); }}
                                                className="w-full gap-1.5 btn-3d">
                                                Start this session <ArrowRight className="w-4 h-4" />
                                            </Button>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Button variant="outline" onClick={() => togglePlanDone(s)} className="border-2 gap-1.5 px-2">
                                                    <Check className="w-3.5 h-3.5" /> {s.is_completed ? "Undo" : "Done"}
                                                </Button>
                                                <Button variant="outline" onClick={() => { setOpenSession(null); openEditPlan(s); }} className="border-2 gap-1.5 px-2">
                                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                                </Button>
                                                <Button variant="outline" onClick={() => { setOpenSession(null); requestDeletePlan(s); }}
                                                    className="border-2 gap-1.5 px-2 text-streak hover:text-streak hover:bg-streak/10">
                                                    <Trash2 className="w-3.5 h-3.5" /> Remove
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </DialogContent>
                </Dialog>

                {/* ── Day view ─────────────────────────────────────────── */}
                {/* Everything the week board can't show at 150px wide: full
                    titles, notes, times, and room to drag sessions into the
                    order you actually want them. */}
                <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
                    <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="font-display">
                                {openDay ? fmtDate(openDay, "EEEE d MMMM") : ""}
                            </DialogTitle>
                        </DialogHeader>
                        {openDay && (() => {
                            const dayPlans = plans.filter(p => p.date === openDay)
                                .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
                            const daySacs = upcoming.filter(a => a.due_date === openDay);
                            const mins = dayPlans.reduce((n, p) => n + (durationOf(p) || DEFAULT_DUR), 0);
                            const done = dayPlans.filter(p => p.is_completed).length;

                            // One renderer for both the resting row and the drag clone.
                            // The clone matters: Radix centres the dialog with a CSS
                            // transform, which makes it the containing block for the
                            // library's `position: fixed` drag layer — dragging inside
                            // it sent the lifted card off-screen. Portalling the clone
                            // to <body> puts it back under your cursor.
                            const dayRow = (dg, snap, rubric) => {
                                const p = dayPlans.find(x => x.id === rubric.draggableId);
                                if (!p) return <div ref={dg.innerRef} {...dg.draggableProps} {...dg.dragHandleProps} />;
                                const dur = durationOf(p);
                                const note = noteTextOf(p);
                                const row = (
                                    <div ref={dg.innerRef} {...dg.draggableProps} {...dg.dragHandleProps}
                                        className={`rounded-2xl border-2 p-3 bg-surface cursor-grab active:cursor-grabbing ${
                                            snap.isDragging ? "ring-2 ring-chart-3 shadow-lg" : "border-border"}`}>
                                        <div className="flex items-start gap-2">
                                            <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                                            <button onClick={() => togglePlanDone(p)} aria-label="Toggle done"
                                                className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${
                                                    p.is_completed ? "bg-primary border-primary text-white" : "border-border"}`}>
                                                {p.is_completed && <Check className="w-3 h-3" />}
                                            </button>
                                            {/* Same launch behaviour as the board — inspecting a
                                                day shouldn't cost you the ability to start from it. */}
                                            <Link to={sessionLink(p.title)} className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold leading-snug ${p.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                                    {typeOf(p.title) && <span className="mr-1">{typeOf(p.title).emoji}</span>}
                                                    {shortTitle(p.title)}
                                                    {recIdOf(p) && <Repeat className="w-3 h-3 inline ml-1 opacity-50" />}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {[prettyTime(p.start_time), dur ? `${dur}m` : null, p.subject_name].filter(Boolean).join(" · ")}
                                                </p>
                                                {note && <p className="text-xs text-muted-foreground/70 italic mt-1">{note}</p>}
                                            </Link>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button onClick={() => { setReturnToDay(openDay); setOpenDay(null); openEditPlan(p); }} aria-label={`Edit ${p.title}`}
                                                    className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-chart-3">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => requestDeletePlan(p)} aria-label={`Remove ${p.title}`}
                                                    className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-streak">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                                // The wrapper only exists to lift the clone above the
                                // dialog overlay (z-50); it has no transform, so the
                                // clone's fixed coordinates stay viewport-relative.
                                return snap.isClone
                                    ? createPortal(<div className="fixed inset-0 z-[60] pointer-events-none">{row}</div>, document.body)
                                    : row;
                            };

                            return (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                                        {[["Sessions", dayPlans.length], ["Done", `${done}/${dayPlans.length || 0}`],
                                          ["Planned", mins >= 60 ? `${Math.round(mins / 6) / 10}h` : `${mins}m`]].map(([k, v]) => (
                                            <div key={k}>
                                                <p className="font-display font-black text-lg leading-none text-foreground tabular-nums">{v}</p>
                                                <p className="stat-label">{k}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {daySacs.map(a => (
                                        <div key={a.id} className="rounded-xl bg-streak/10 border border-streak/25 px-3 py-2">
                                            <p className="text-xs font-black text-streak">🚩 {a.subject_name} — {a.title}</p>
                                        </div>
                                    ))}

                                    {dayPlans.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Nothing planned. Add something below.</p>
                                    ) : (
                                        <DragDropContext onDragEnd={(r) => {
                                            if (!r.destination) return;
                                            movePlan(r.draggableId, openDay, r.destination.index);
                                        }}>
                                            <Droppable droppableId={openDay} renderClone={dayRow}>
                                                {(dp) => (
                                                    <div ref={dp.innerRef} {...dp.droppableProps} className="space-y-2">
                                                        {dayPlans.map((p, i) => (
                                                            <Draggable draggableId={p.id} index={i} key={p.id} disableInteractiveElementBlocking>
                                                                {(dg, snap) => dayRow(dg, snap, { draggableId: p.id })}
                                                            </Draggable>
                                                        ))}
                                                        {dp.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </DragDropContext>
                                    )}

                                    {dayPlans.length > 1 && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Drag to reorder — the order sets the times, same as the week board.
                                        </p>
                                    )}

                                    <Button onClick={() => { const d = openDay; setReturnToDay(d); setOpenDay(null); openAddPlan(d); }}
                                        className="w-full gap-1.5">
                                        <Plus className="w-4 h-4" /> Add a session
                                    </Button>
                                </div>
                            );
                        })()}
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
            </div>
        </div>
    );
}
