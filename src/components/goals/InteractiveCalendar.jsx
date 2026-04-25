import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Calendar, Plus, Edit, Trash2, Clock, CheckCircle2, Circle,
    ChevronLeft, ChevronRight, Loader2, Repeat, Target, Bell,
    BookOpen, Dumbbell, Music, Bus, Trophy, GraduationCap,
    FileText, Mic, Folder, Zap, Info, X, AlertTriangle
} from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, parseISO, differenceInDays, addMonths, subMonths } from "date-fns";
import { base44 } from "@/api/base44Client";
import { moderationPresets } from "@/components/shared/contentModeration";
import TimePicker from "@/components/shared/TimePicker";

// ── Event type config ──────────────────────────────────────────────────────────
const EVENT_TYPES = [
    { value: 'SAC',         label: 'SAC',            icon: FileText,      color: '#EF4444', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    emoji: '📋' },
    { value: 'Exam',        label: 'Exam',           icon: GraduationCap, color: '#7C3AED', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', emoji: '📝' },
    { value: 'Test',        label: 'Test / Quiz',    icon: FileText,      color: '#F97316', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', emoji: '✏️' },
    { value: 'Assignment',  label: 'Assignment',     icon: FileText,      color: '#3B82F6', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   emoji: '📄' },
    { value: 'Oral',        label: 'Oral / Pres.',   icon: Mic,           color: '#EAB308', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', emoji: '🎤' },
    { value: 'Folio',       label: 'Folio',          icon: Folder,        color: '#6366F1', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', emoji: '🗂️' },
    { value: 'Performance', label: 'Performance',    icon: Music,         color: '#EC4899', bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300',   emoji: '🎭' },
    { value: 'Sport',       label: 'Sport / Fitness',icon: Dumbbell,      color: '#10B981', bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-300',emoji: '🏅' },
    { value: 'Excursion',   label: 'Excursion / Camp',icon: Bus,          color: '#06B6D4', bg: 'bg-cyan-100',   text: 'text-cyan-700',   border: 'border-cyan-300',   emoji: '🚌' },
    { value: 'Study',       label: 'Study Session',  icon: BookOpen,      color: '#14B8A6', bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300',   emoji: '📚' },
    { value: 'Other',       label: 'Other',          icon: Target,        color: '#6B7280', bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   emoji: '📌' },
];

const REPEAT_OPTIONS = [
    { value: 'never', label: 'No repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'every_2_days', label: 'Every 2 days' },
    { value: 'every_3_days', label: 'Every 3 days' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'fortnightly', label: 'Fortnightly' },
    { value: 'monthly', label: 'Monthly' },
];

const getEventType = (type) => EVENT_TYPES.find(e => e.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];

const PRIORITY_COLORS = {
    Critical: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
    High:     { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
    Medium:   { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
    Low:      { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
};

// ── Urgency helpers ────────────────────────────────────────────────────────────
function urgencyLabel(daysUntil) {
    if (daysUntil < 0) return { label: 'Overdue', color: 'bg-gray-100 text-gray-500' };
    if (daysUntil === 0) return { label: 'Today!', color: 'bg-red-600 text-white' };
    if (daysUntil === 1) return { label: 'Tomorrow', color: 'bg-red-100 text-red-700' };
    if (daysUntil <= 3) return { label: `${daysUntil}d`, color: 'bg-orange-100 text-orange-700' };
    if (daysUntil <= 7) return { label: `${daysUntil}d`, color: 'bg-amber-100 text-amber-700' };
    return { label: `${daysUntil}d`, color: 'bg-blue-100 text-blue-700' };
}

// ── Blank event template ───────────────────────────────────────────────────────
const blankEvent = (date) => ({
    title: '',
    subject_name: '',
    event_type: 'Study',
    date: date || format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
    notes: '',
    priority: 'Medium',
    repeat_frequency: 'never',
    repeat_end_date: '',
    is_completed: false,
});

// ── EventForm ─────────────────────────────────────────────────────────────────
function EventForm({ event, onChange, subjects }) {
    const selected = getEventType(event.event_type);

    return (
        <div className="space-y-4">
            {/* Event type pills */}
            <div>
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Event Type</Label>
                <div className="flex flex-wrap gap-1.5">
                    {EVENT_TYPES.map(t => (
                        <button key={t.value} type="button"
                            onClick={() => onChange({ ...event, event_type: t.value })}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${event.event_type === t.value ? `${t.bg} ${t.text} ${t.border} ring-2 ring-offset-1 ring-current` : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                            <span>{t.emoji}</span> {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Title */}
            <div>
                <Label className="text-xs font-bold text-gray-700 mb-1 block">Title *</Label>
                <Input value={event.title} onChange={e => onChange({ ...event, title: e.target.value })}
                    placeholder={`e.g., ${selected.emoji} ${event.event_type === 'SAC' ? 'Chemistry Unit 3 SAC 1' : event.event_type === 'Exam' ? 'English Exam' : 'Biology Study Session'}`}
                    className="h-10 text-sm" />
            </div>

            {/* Subject + Priority row */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs font-bold text-gray-700 mb-1 block">Subject</Label>
                    {subjects.length > 0 ? (
                        <Select value={event.subject_name} onValueChange={v => onChange({ ...event, subject_name: v })}>
                            <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select subject..." />
                            </SelectTrigger>
                            <SelectContent>
                                {subjects.map(s => <SelectItem key={s.id} value={s.subject_name} className="text-xs">{s.subject_name}</SelectItem>)}
                                <SelectItem value={null} className="text-xs text-gray-400">None / Other</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input value={event.subject_name} onChange={e => onChange({ ...event, subject_name: e.target.value })}
                            placeholder="e.g., English" className="h-10 text-sm" />
                    )}
                </div>
                <div>
                    <Label className="text-xs font-bold text-gray-700 mb-1 block">Priority</Label>
                    <Select value={event.priority || 'Medium'} onValueChange={v => onChange({ ...event, priority: v })}>
                        <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Critical" className="text-xs">🔴 Critical</SelectItem>
                            <SelectItem value="High" className="text-xs">🟠 High</SelectItem>
                            <SelectItem value="Medium" className="text-xs">🟡 Medium</SelectItem>
                            <SelectItem value="Low" className="text-xs">🟢 Low</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Date + Times row */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <Label className="text-xs font-bold text-gray-700 mb-1 block">Date *</Label>
                    <Input type="date" value={event.date} onChange={e => onChange({ ...event, date: e.target.value })} className="h-10 text-sm" />
                </div>
                <div>
                    <Label className="text-xs font-bold text-gray-700 mb-1 block">Start</Label>
                    <TimePicker value={event.start_time} onChange={t => onChange({ ...event, start_time: t })} />
                </div>
                <div>
                    <Label className="text-xs font-bold text-gray-700 mb-1 block">End</Label>
                    <TimePicker value={event.end_time} onChange={t => onChange({ ...event, end_time: t })} />
                </div>
            </div>

            {/* Notes */}
            <div>
                <Label className="text-xs font-bold text-gray-700 mb-1 block">Notes <span className="font-normal text-gray-400">(optional)</span></Label>
                <Textarea value={event.notes} onChange={e => onChange({ ...event, notes: e.target.value })}
                    placeholder="Any extra details, topics covered, resources needed..." rows={2} className="resize-none text-sm" />
            </div>

            {/* Repeat */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-blue-600" />
                    <Label className="text-xs font-bold text-blue-800">Recurring Event</Label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {REPEAT_OPTIONS.map(o => (
                        <button key={o.value} type="button"
                            onClick={() => onChange({ ...event, repeat_frequency: o.value })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${event.repeat_frequency === o.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50'}`}>
                            {o.label}
                        </button>
                    ))}
                </div>
                {event.repeat_frequency !== 'never' && (
                    <div>
                        <Label className="text-xs font-semibold text-blue-800 mb-1 block">Repeat until</Label>
                        <Input type="date" value={event.repeat_end_date} onChange={e => onChange({ ...event, repeat_end_date: e.target.value })}
                            className="h-9 text-sm" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InteractiveCalendar({ user }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [newEvent, setNewEvent] = useState(blankEvent());
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    const [view, setView] = useState('month'); // 'month' | 'upcoming'
    const { toast } = useToast();

    // ── Load data ──────────────────────────────────────────────────────────────
    const loadData = async () => {
        if (!user?.email) return;
        setIsLoading(true);
        try {
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);
            const [monthEvents, allSubjects] = await Promise.all([
                base44.entities.StudyPlan.filter({
                    created_by: user.email,
                    date: { $gte: format(monthStart, 'yyyy-MM-dd'), $lte: format(monthEnd, 'yyyy-MM-dd') }
                }),
                base44.entities.UserSubject.filter({ created_by: user.email, is_active: true })
            ]);
            setEvents(monthEvents || []);
            setSubjects(allSubjects || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { if (user?.email) loadData(); }, [user, currentMonth]);

    // ── Derived data ───────────────────────────────────────────────────────────
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const paddingDays = (() => { const d = monthStart.getDay(); return d === 0 ? 6 : d - 1; })();

    const getEventsForDate = (date) => events.filter(e => e.date === format(date, 'yyyy-MM-dd'));
    const selectedDateEvents = events
        .filter(e => e.date === format(selectedDate, 'yyyy-MM-dd'))
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    // ── Upcoming events across next 30d ────────────────────────────────────────
    const upcomingEvents = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const in30 = format(addDays(new Date(), 30), 'yyyy-MM-dd');
        return [...events]
            .filter(e => e.date >= today && e.date <= in30 && !e.is_completed)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [events]);

    // Stats
    const totalThisMonth = events.length;
    const completedThisMonth = events.filter(e => e.is_completed).length;
    const urgentCount = upcomingEvents.filter(e => differenceInDays(parseISO(e.date), new Date()) <= 3).length;

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!newEvent.title || !newEvent.date || !newEvent.start_time || !newEvent.end_time) {
            toast({ title: 'Please fill in all required fields.', variant: 'destructive' }); return;
        }
        if (newEvent.repeat_frequency !== 'never' && !newEvent.repeat_end_date) {
            toast({ title: 'Please set an end date for recurring events.', variant: 'destructive' }); return;
        }
        try {
            await moderationPresets.note(`${newEvent.title} ${newEvent.notes || ''}`);
        } catch {}
        try {
            if (newEvent.repeat_frequency === 'never') {
                await base44.entities.StudyPlan.create({ ...newEvent, created_by: user.email });
            } else {
                const seriesId = `series-${Date.now()}`;
                const dayInc = { daily: 1, every_2_days: 2, every_3_days: 3, weekly: 7, fortnightly: 14, monthly: 30 }[newEvent.repeat_frequency] || 1;
                const dates = [];
                let cur = parseISO(newEvent.date);
                const end = parseISO(newEvent.repeat_end_date);
                while (cur <= end && dates.length < 365) { dates.push(format(cur, 'yyyy-MM-dd')); cur = addDays(cur, dayInc); }
                await base44.entities.StudyPlan.bulkCreate(dates.map(d => ({ ...newEvent, date: d, series_id: seriesId })));
                toast({ title: `✅ ${dates.length} events created!` });
            }
            setShowAdd(false);
            setNewEvent(blankEvent(format(selectedDate, 'yyyy-MM-dd')));
            await loadData();
        } catch (e) {
            toast({ title: 'Error adding event.', variant: 'destructive' });
        }
    };

    const handleUpdate = async () => {
        if (!editingEvent) return;
        try {
            await base44.entities.StudyPlan.update(editingEvent.id, editingEvent);
            toast({ title: 'Event updated ✅' });
            setEditingEvent(null);
            await loadData();
        } catch {
            toast({ title: 'Error updating event.', variant: 'destructive' });
        }
    };

    const handleToggle = async (event) => {
        await base44.entities.StudyPlan.update(event.id, { is_completed: !event.is_completed });
        await loadData();
    };

    const handleDeleteClick = (event) => {
        if (event.series_id) { setEventToDelete(event); setShowDeleteDialog(true); }
        else if (confirm('Delete this event?')) {
            base44.entities.StudyPlan.delete(event.id).then(() => { toast({ title: 'Deleted' }); loadData(); });
        }
    };

    const handleDeleteSingle = async () => {
        await base44.entities.StudyPlan.delete(eventToDelete.id).catch(() => {});
        setShowDeleteDialog(false); setEventToDelete(null);
        toast({ title: 'Event deleted' }); await loadData();
    };

    const handleDeleteSeries = async () => {
        const sid = eventToDelete.series_id;
        setShowDeleteDialog(false); setEventToDelete(null);
        let total = 0, hasMore = true;
        while (hasMore) {
            const batch = await base44.entities.StudyPlan.filter({ created_by: user.email, series_id: sid }, undefined, 50);
            if (!batch?.length) { hasMore = false; break; }
            for (const ev of batch) { await base44.entities.StudyPlan.delete(ev.id).catch(() => {}); total++; }
        }
        toast({ title: `${total} events deleted` }); await loadData();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm font-medium">Loading your planner...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button onClick={() => setView('month')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'month' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        📅 Month
                    </button>
                    <button onClick={() => setView('upcoming')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all relative ${view === 'upcoming' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        ⚡ Upcoming
                        {urgentCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{urgentCount}</span>}
                    </button>
                </div>
                <Button onClick={() => { setNewEvent(blankEvent(format(selectedDate, 'yyyy-MM-dd'))); setShowAdd(true); }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md rounded-xl">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Event
                </Button>
            </div>

            {/* ── Stats row ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'This Month', value: totalThisMonth, icon: '📅', color: 'from-blue-50 to-indigo-50 border-blue-100' },
                    { label: 'Completed', value: completedThisMonth, icon: '✅', color: 'from-emerald-50 to-teal-50 border-emerald-100' },
                    { label: 'Urgent (3d)', value: urgentCount, icon: '🔥', color: urgentCount > 0 ? 'from-red-50 to-orange-50 border-red-200' : 'from-gray-50 to-gray-50 border-gray-100' },
                ].map(s => (
                    <div key={s.label} className={`bg-gradient-to-br ${s.color} border rounded-2xl p-3 text-center`}>
                        <p className="text-xl">{s.icon}</p>
                        <p className="text-2xl font-black text-gray-900">{s.value}</p>
                        <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {view === 'month' ? (
                    <motion.div key="month" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        {/* Calendar card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Month nav header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                                </button>
                                <div className="text-center">
                                    <h2 className="text-xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                        {format(currentMonth, 'MMMM yyyy')}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}
                                        className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                                        Today
                                    </button>
                                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Weekday labels */}
                            <div className="grid grid-cols-7 border-b border-gray-50">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="py-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">{d}</div>
                                ))}
                            </div>

                            {/* Day cells */}
                            <div className="grid grid-cols-7">
                                {Array.from({ length: paddingDays }).map((_, i) => (
                                    <div key={`p${i}`} className="aspect-square border-r border-b border-gray-50/80 last:border-r-0" />
                                ))}
                                {calendarDays.map((day, idx) => {
                                    const dayEvents = getEventsForDate(day);
                                    const isSelected = isSameDay(day, selectedDate);
                                    const isCurrent = isToday(day);
                                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                    const hasUrgent = dayEvents.some(e => {
                                        const t = EVENT_TYPES.find(et => et.value === e.event_type);
                                        return ['SAC', 'Exam', 'Test'].includes(e.event_type);
                                    });

                                    return (
                                        <motion.button key={day.toISOString()}
                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                            onClick={() => setSelectedDate(day)}
                                            className={`aspect-square p-1 flex flex-col items-center border-r border-b border-gray-50/80 transition-all duration-150 relative
                                                ${(idx + paddingDays + 1) % 7 === 0 ? 'border-r-0' : ''}
                                                ${isSelected ? 'bg-emerald-500 shadow-inner' : isCurrent ? 'bg-blue-50' : isWeekend ? 'bg-gray-50/60' : 'hover:bg-emerald-50/40'}
                                            `}>
                                            <span className={`text-xs sm:text-sm font-bold leading-none mt-1 ${isSelected ? 'text-white' : isCurrent ? 'text-blue-700' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                                                {format(day, 'd')}
                                            </span>
                                            {/* Event dots */}
                                            {dayEvents.length > 0 && (
                                                <div className="flex gap-0.5 flex-wrap justify-center mt-1 max-w-full">
                                                    {dayEvents.slice(0, 4).map((ev, i) => {
                                                        const t = getEventType(ev.event_type);
                                                        return <div key={i} className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-white/70' : ''}`}
                                                            style={{ backgroundColor: isSelected ? undefined : t.color }} />;
                                                    })}
                                                    {dayEvents.length > 4 && <span className={`text-[8px] font-bold ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>+{dayEvents.length - 4}</span>}
                                                </div>
                                            )}
                                            {isCurrent && !isSelected && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected day events */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-900">{format(selectedDate, 'EEEE, MMMM d')}</h3>
                                    <p className="text-xs text-gray-400">{selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}</p>
                                </div>
                                <Button size="sm" onClick={() => { setNewEvent(blankEvent(format(selectedDate, 'yyyy-MM-dd'))); setShowAdd(true); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs h-8 gap-1">
                                    <Plus className="w-3.5 h-3.5" /> Add
                                </Button>
                            </div>

                            {selectedDateEvents.length === 0 ? (
                                <div className="text-center py-8">
                                    <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                    <p className="text-gray-400 text-sm">Nothing planned for this day</p>
                                    <p className="text-gray-300 text-xs">Click "Add" to schedule something</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedDateEvents.map((ev, i) => <EventCard key={ev.id} event={ev} subjects={subjects} onToggle={handleToggle} onEdit={setEditingEvent} onDelete={handleDeleteClick} />)}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    // ── UPCOMING VIEW ──────────────────────────────────────────
                    <motion.div key="upcoming" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                        {upcomingEvents.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                                <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">You're all clear for the next 30 days!</p>
                                <p className="text-gray-400 text-sm mt-1">Add events to start planning</p>
                            </div>
                        ) : (
                            upcomingEvents.map((ev) => {
                                const daysUntil = differenceInDays(parseISO(ev.date), new Date());
                                const urg = urgencyLabel(daysUntil);
                                const typeInfo = getEventType(ev.event_type);
                                const subjectColor = subjects.find(s => s.subject_name === ev.subject_name)?.color;

                                return (
                                    <motion.div key={ev.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3"
                                            style={{ borderLeftColor: typeInfo.color, borderLeftWidth: 4 }}>
                                            <span className="text-2xl flex-shrink-0 mt-0.5">{typeInfo.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="font-bold text-gray-900 text-sm">{ev.title}</span>
                                                    <Badge className={`text-[10px] px-1.5 py-0.5 border-0 ${urg.color}`}>{urg.label}</Badge>
                                                    {ev.priority && ev.priority !== 'Medium' && (
                                                        <Badge className={`text-[10px] px-1.5 py-0.5 border-0 ${PRIORITY_COLORS[ev.priority]?.badge || ''}`}>{ev.priority}</Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(parseISO(ev.date), 'EEE d MMM')}</span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ev.start_time} – {ev.end_time}</span>
                                                    {ev.subject_name && <span style={{ color: subjectColor || '#6B7280' }} className="font-semibold">{ev.subject_name}</span>}
                                                </div>
                                                {ev.notes && <p className="text-xs text-gray-400 mt-1 truncate">{ev.notes}</p>}
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button onClick={() => handleToggle(ev)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-500 transition-colors">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setEditingEvent(ev)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors">
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteClick(ev)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Event type legend ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Event Types</p>
                <div className="flex flex-wrap gap-2">
                    {EVENT_TYPES.map(t => (
                        <div key={t.value} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold ${t.bg} ${t.text} border ${t.border}`}>
                            <span>{t.emoji}</span> {t.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Add Event Dialog ──────────────────────────────────────────── */}
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                                <Plus className="w-4 h-4 text-white" />
                            </div>
                            Add Event
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 pr-2">
                        <div className="py-2">
                            <EventForm event={newEvent} onChange={setNewEvent} subjects={subjects} />
                        </div>
                    </ScrollArea>
                    <DialogFooter className="border-t pt-3 mt-2">
                        <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button onClick={handleAdd} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                            <Plus className="w-4 h-4 mr-1.5" /> Add Event
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit Dialog ───────────────────────────────────────────────── */}
            <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                <Edit className="w-4 h-4 text-white" />
                            </div>
                            Edit Event
                        </DialogTitle>
                    </DialogHeader>
                    {editingEvent && (
                        <ScrollArea className="flex-1 pr-2">
                            <div className="py-2">
                                <EventForm event={editingEvent} onChange={setEditingEvent} subjects={subjects} />
                            </div>
                        </ScrollArea>
                    )}
                    <DialogFooter className="border-t pt-3 mt-2">
                        <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancel</Button>
                        <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700">
                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Recurring Dialog ───────────────────────────────────── */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-red-600" /> Delete Recurring Event
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600 py-2">This event is part of a series. What would you like to delete?</p>
                    <div className="space-y-2">
                        <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={handleDeleteSingle}>
                            <div className="text-left">
                                <div className="font-semibold text-sm">Just this event</div>
                                <div className="text-xs text-gray-400">Other events in the series remain</div>
                            </div>
                        </Button>
                        <Button variant="outline" className="w-full justify-start h-auto py-3 border-red-200 hover:bg-red-50" onClick={handleDeleteSeries}>
                            <div className="text-left">
                                <div className="font-semibold text-sm text-red-600">All events in series</div>
                                <div className="text-xs text-gray-400">Removes every occurrence</div>
                            </div>
                        </Button>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── EventCard sub-component ───────────────────────────────────────────────────
function EventCard({ event, subjects, onToggle, onEdit, onDelete }) {
    const typeInfo = getEventType(event.event_type);
    const subjectColor = subjects.find(s => s.subject_name === event.subject_name)?.color || typeInfo.color;
    const daysUntil = differenceInDays(parseISO(event.date), new Date());
    const urg = urgencyLabel(daysUntil);

    return (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${event.is_completed ? 'opacity-50 bg-gray-50' : 'bg-white hover:shadow-sm'}`}
            style={{ borderLeftColor: typeInfo.color, borderLeftWidth: 3 }}>
            <button onClick={() => onToggle(event)} className="mt-0.5 flex-shrink-0">
                {event.is_completed
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : <Circle className="w-5 h-5 text-gray-300 hover:text-emerald-500 transition-colors" />}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-sm">{typeInfo.emoji}</span>
                    <span className={`font-semibold text-sm text-gray-900 ${event.is_completed ? 'line-through' : ''}`}>{event.title}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 border-0 ${urg.color}`}>{urg.label}</Badge>
                    {event.priority && event.priority !== 'Medium' && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[event.priority]?.badge || ''}`}>{event.priority}</span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{event.start_time} – {event.end_time}</span>
                    {event.subject_name && <span style={{ color: subjectColor }} className="font-semibold">{event.subject_name}</span>}
                </div>
                {event.notes && <p className="text-xs text-gray-400 mt-1 truncate">{event.notes}</p>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => onEdit(event)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors">
                    <Edit className="w-3 h-3" />
                </button>
                <button onClick={() => onDelete(event)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    );
}