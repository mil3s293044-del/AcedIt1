import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import {
    Wand2, Loader2, Calendar, Plus, Trash2, Zap, ChevronDown, ChevronUp,
    Clock, BookOpen, AlertTriangle, Star, Dumbbell, Music, Theater,
    Bus, Trophy, Heart, Users, Pencil, GraduationCap, FileText,
    CheckCircle2, ArrowRight, Lightbulb, Target, Flame, Coffee
} from 'lucide-react';
import AILoadingProgress from '../shared/AILoadingProgress';

const EVENT_TYPES = [
    { value: 'SAC', label: 'SAC', icon: '📋', color: 'bg-red-100 text-red-700 border-red-200', description: 'School Assessed Coursework' },
    { value: 'Exam', label: 'Exam', icon: '📝', color: 'bg-purple-100 text-purple-700 border-purple-200', description: 'End-of-year / mid-year exam' },
    { value: 'Test', label: 'Test / Quiz', icon: '✏️', color: 'bg-orange-100 text-orange-700 border-orange-200', description: 'In-class test or quiz' },
    { value: 'Assignment', label: 'Assignment', icon: '📄', color: 'bg-blue-100 text-blue-700 border-blue-200', description: 'Take-home assignment' },
    { value: 'Project', label: 'Project', icon: '🔬', color: 'bg-teal-100 text-teal-700 border-teal-200', description: 'Research or group project' },
    { value: 'Oral', label: 'Oral / Presentation', icon: '🎤', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', description: 'Oral presentation or speech' },
    { value: 'Folio', label: 'Folio / Portfolio', icon: '🗂️', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', description: 'Art, music, or design folio' },
    { value: 'Performance', label: 'Performance', icon: '🎭', color: 'bg-pink-100 text-pink-700 border-pink-200', description: 'Music recital, drama, dance' },
    { value: 'Sport', label: 'Sport / Training', icon: '🏅', color: 'bg-green-100 text-green-700 border-green-200', description: 'Sport event or rep training' },
    { value: 'Excursion', label: 'Excursion', icon: '🚌', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', description: 'School excursion / camp' },
    { value: 'Wellbeing', label: 'Wellbeing Day', icon: '🧘', color: 'bg-rose-100 text-rose-700 border-rose-200', description: 'Rest / mental health day' },
    { value: 'Other', label: 'Other', icon: '📌', color: 'bg-gray-100 text-gray-700 border-gray-200', description: 'Other school commitment' },
];

const PRIORITY_OPTIONS = [
    { value: 'Critical', label: '🔴 Critical', desc: 'Cannot miss, highest stakes' },
    { value: 'High', label: '🟠 High', desc: 'Important, significant weighting' },
    { value: 'Medium', label: '🟡 Medium', desc: 'Moderate importance' },
    { value: 'Low', label: '🟢 Low', desc: 'Low stakes, good to do' },
];

const STRESS_LEVELS = [
    { value: 'Very stressed', emoji: '😰', label: 'Very stressed' },
    { value: 'A bit anxious', emoji: '😟', label: 'A bit anxious' },
    { value: 'Mostly okay', emoji: '😐', label: 'Mostly okay' },
    { value: 'Feeling good', emoji: '😊', label: 'Feeling good' },
    { value: 'Super confident', emoji: '😄', label: 'Super confident' },
];

const STUDY_STYLES = [
    { value: 'Intensive sprints (Pomodoro)', icon: '⚡', desc: '25-min focus blocks' },
    { value: 'Steady daily progress', icon: '📈', desc: 'Consistent every day' },
    { value: 'Weekend-heavy', icon: '📅', desc: 'Lighter weekdays, intense weekends' },
    { value: 'Mixed approach', icon: '🔀', desc: 'Flexible based on energy' },
    { value: 'Last-minute crammer', icon: '🚀', desc: 'Intense sessions close to deadlines' },
];

const SLEEP_OPTIONS = ['< 6 hours', '6–7 hours', '7–8 hours', '8+ hours'];
const HOURS_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8];

const eventTypeInfo = (type) => EVENT_TYPES.find(e => e.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];

function EventTypeIcon({ type, size = 'sm' }) {
    const info = eventTypeInfo(type);
    return <span className={size === 'lg' ? 'text-2xl' : 'text-base'}>{info.icon}</span>;
}

function PlanSection({ title, icon, children, accentColor = 'emerald', defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    const colors = {
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        blue: 'bg-blue-50 border-blue-200 text-blue-800',
        purple: 'bg-purple-50 border-purple-200 text-purple-800',
        amber: 'bg-amber-50 border-amber-200 text-amber-800',
        rose: 'bg-rose-50 border-rose-200 text-rose-800',
        teal: 'bg-teal-50 border-teal-200 text-teal-800',
    };
    return (
        <div className={`rounded-xl border ${colors[accentColor]} overflow-hidden`}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-2 font-bold text-sm">
                    <span>{icon}</span> {title}
                </div>
                {open ? <ChevronUp className="w-4 h-4 opacity-60" /> : <ChevronDown className="w-4 h-4 opacity-60" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <div className="px-4 pb-4">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function DayCard({ day }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-900 text-sm">{day.day}</span>
                {day.date && <span className="text-xs text-gray-400">{day.date}</span>}
            </div>
            {day.focus && <p className="text-xs font-semibold text-emerald-700 mb-1">🎯 {day.focus}</p>}
            <ul className="space-y-1">
                {(day.tasks || []).map((task, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 text-[10px]">{i + 1}</span>
                        {task}
                    </li>
                ))}
            </ul>
            {day.hours && <p className="mt-2 text-xs text-gray-400">⏱ {day.hours}</p>}
        </div>
    );
}

function AssessmentRow({ a, idx, total, onRemove, onUpdate, userSubjects }) {
    const typeInfo = eventTypeInfo(a.type);
    return (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{typeInfo.icon}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Event {idx + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeInfo.color}`}>{typeInfo.label}</span>
                </div>
                {total > 1 && (
                    <button onClick={() => onRemove(idx)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Type selector row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EVENT_TYPES.slice(0, 6).map(t => (
                    <button key={t.value} onClick={() => onUpdate(idx, 'type', t.value)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${a.type === t.value ? t.color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>
                        <span>{t.icon}</span>{t.label}
                    </button>
                ))}
                {EVENT_TYPES.slice(6).map(t => (
                    <button key={t.value} onClick={() => onUpdate(idx, 'type', t.value)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${a.type === t.value ? t.color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>
                        <span>{t.icon}</span>{t.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Subject */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Subject / Activity</label>
                    {userSubjects.length > 0 ? (
                        <Select value={a.subject} onValueChange={v => onUpdate(idx, 'subject', v)}>
                            <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200">
                                <SelectValue placeholder="Select subject..." />
                            </SelectTrigger>
                            <SelectContent>
                                {userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name} className="text-xs">{s.subject_name}</SelectItem>)}
                                <SelectItem value="__custom__" className="text-xs text-gray-400">+ Type custom...</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : null}
                    {(userSubjects.length === 0 || a.subject === '__custom__') && (
                        <Input placeholder="e.g., English, Sport, Music" value={a.subject === '__custom__' ? '' : a.subject}
                            onChange={e => onUpdate(idx, 'subject', e.target.value)}
                            className="h-9 text-xs bg-gray-50 border-gray-200" />
                    )}
                </div>

                {/* Title */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Title / Description</label>
                    <Input placeholder="e.g., Unit 3 SAC 1, Drama performance..." value={a.title}
                        onChange={e => onUpdate(idx, 'title', e.target.value)}
                        className="h-9 text-xs bg-gray-50 border-gray-200" />
                </div>

                {/* Date */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Date</label>
                    <Input type="date" value={a.date} onChange={e => onUpdate(idx, 'date', e.target.value)}
                        className="h-9 text-xs bg-gray-50 border-gray-200" />
                </div>

                {/* Priority */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Priority</label>
                    <Select value={a.priority} onValueChange={v => onUpdate(idx, 'priority', v)}>
                        <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Notes / Concerns <span className="font-normal text-gray-400">(optional)</span></label>
                <Input placeholder="e.g., Really struggling with this topic, worth 25% of grade..."
                    value={a.notes || ''} onChange={e => onUpdate(idx, 'notes', e.target.value)}
                    className="h-9 text-xs bg-gray-50 border-gray-200" />
            </div>
        </motion.div>
    );
}

export default function StudyPlanner() {
    const [step, setStep] = useState(1); // 1 = events, 2 = context, 3 = plan
    const [events, setEvents] = useState([{ subject: '', title: '', date: '', type: 'SAC', priority: 'High', notes: '' }]);
    const [hoursPerDay, setHoursPerDay] = useState(3);
    const [studyStyle, setStudyStyle] = useState('Steady daily progress');
    const [stressLevel, setStressLevel] = useState('Mostly okay');
    const [weakAreas, setWeakAreas] = useState('');
    const [extraContext, setExtraContext] = useState('');
    const [sleepHours, setSleepHours] = useState('7–8 hours');
    const [hasExtracurriculars, setHasExtracurriculars] = useState('');
    const [plan, setPlan] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [userSubjects, setUserSubjects] = useState([]);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const user = await base44.auth.me();
            const subjects = await base44.entities.UserSubject.filter({ created_by: user.email, is_active: true }).catch(() => []);
            setUserSubjects(subjects);
        };
        init();
    }, []);

    const addEvent = () => setEvents(prev => [...prev, { subject: '', title: '', date: '', type: 'SAC', priority: 'High', notes: '' }]);
    const removeEvent = (idx) => setEvents(prev => prev.filter((_, i) => i !== idx));
    const updateEvent = (idx, field, value) => setEvents(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));

    const validEvents = events.filter(e => e.subject && e.title && e.date);

    const handleGenerate = async () => {
        if (validEvents.length === 0) {
            toast({ title: 'Please add at least one event with a subject, title and date.', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        setPlan(null);

        const today = new Date().toISOString().split('T')[0];

        try {
            const response = await base44.integrations.Core.InvokeLLM({
                model: 'claude_sonnet_4_6',
                prompt: `You are an expert VCE student life coach and study strategist. Create a deeply personalised, actionable study and life plan for this student.

TODAY: ${today}

UPCOMING EVENTS (sorted by date):
${validEvents.sort((a, b) => a.date.localeCompare(b.date)).map((e, i) =>
    `${i + 1}. [${e.type}] ${e.subject} — "${e.title}" — Due: ${e.date} — Priority: ${e.priority}${e.notes ? ` — Notes: "${e.notes}"` : ''}`
).join('\n')}

STUDENT CONTEXT:
- Available study hours/day: ${hoursPerDay} hours
- Preferred study style: ${studyStyle}
- Current stress level: ${stressLevel}
- Sleep: ${sleepHours} per night
- Weak areas / concerns: ${weakAreas || 'None specified'}
- Extracurriculars / other commitments: ${hasExtracurriculars || 'None specified'}
- Extra context: ${extraContext || 'None'}

Generate a structured JSON plan with these exact sections:

1. **priority_ranking**: Array of events ranked by urgency (most urgent first). For each: { rank, event_label, reason, days_until, urgency_level (critical/high/medium/low) }

2. **weekly_schedule**: Array of day objects for the NEXT 14 DAYS from today. Each: { day (e.g. "Mon 18 Mar"), date (YYYY-MM-DD), focus (one-line theme), tasks (array of 2-4 specific tasks with time e.g. "30 min: Biology flashcards (Spaced Repetition)"), hours (total study time e.g. "2.5 hrs"), is_rest_day (boolean) }

3. **subject_strategies**: Object keyed by subject name, each with { technique (best AcedIt tool), why, quick_tips (array of 3 bullet points specific to that assessment type) }

4. **key_milestones**: Array of { milestone, target_date, description } — important checkpoints in the lead-up

5. **stress_and_wellbeing**: { current_assessment (honest 1-2 sentence assessment of their situation), daily_routine_tip, burnout_warning_signs (array of 3), recovery_strategies (array of 3) }

6. **emergency_tips**: Array of events that are within 7 days, each with { event_label, days_left, cramming_strategy (3-4 specific steps) } — only include if applicable

7. **motivational_message**: A brief, genuine, personalised motivational message (2-3 sentences) based on their stress level and what's coming up. Be real, not cheesy.

8. **smart_insights**: Array of 3-4 clever observations the student may not have considered (e.g. overlapping deadlines, need for sleep, pacing advice).

Respond ONLY with valid JSON matching this structure exactly.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        priority_ranking: { type: 'array', items: { type: 'object', properties: { rank: { type: 'number' }, event_label: { type: 'string' }, reason: { type: 'string' }, days_until: { type: 'number' }, urgency_level: { type: 'string' } }, required: ['rank', 'event_label', 'reason', 'days_until', 'urgency_level'] } },
                        weekly_schedule: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, date: { type: 'string' }, focus: { type: 'string' }, tasks: { type: 'array', items: { type: 'string' } }, hours: { type: 'string' }, is_rest_day: { type: 'boolean' } }, required: ['day', 'tasks'] } },
                        subject_strategies: { type: 'object' },
                        key_milestones: { type: 'array', items: { type: 'object', properties: { milestone: { type: 'string' }, target_date: { type: 'string' }, description: { type: 'string' } }, required: ['milestone', 'description'] } },
                        stress_and_wellbeing: { type: 'object', properties: { current_assessment: { type: 'string' }, daily_routine_tip: { type: 'string' }, burnout_warning_signs: { type: 'array', items: { type: 'string' } }, recovery_strategies: { type: 'array', items: { type: 'string' } } } },
                        emergency_tips: { type: 'array', items: { type: 'object', properties: { event_label: { type: 'string' }, days_left: { type: 'number' }, cramming_strategy: { type: 'array', items: { type: 'string' } } }, required: ['event_label', 'days_left', 'cramming_strategy'] } },
                        motivational_message: { type: 'string' },
                        smart_insights: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['priority_ranking', 'weekly_schedule', 'subject_strategies', 'key_milestones', 'stress_and_wellbeing', 'motivational_message', 'smart_insights']
                }
            });

            setPlan(response);
            setStep(3);
        } catch (err) {
            toast({ title: 'Failed to generate plan. Please try again.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!plan) return;
        await base44.entities.AISavedResult.create({
            tool_type: 'note_summarizer',
            title: `Study Plan — ${new Date().toLocaleDateString()}`,
            subject_name: 'Study Planning',
            topic: 'Personalised Study Plan',
            content: JSON.stringify(plan, null, 2),
            input_data: { events, hoursPerDay, studyStyle, stressLevel, weakAreas },
            date_created: new Date().toISOString().split('T')[0]
        });
        toast({ title: '✅ Study plan saved!', description: 'Find it in AI Tools History.' });
    };

    const urgencyColors = { critical: 'bg-red-100 text-red-700 border-red-200', high: 'bg-orange-100 text-orange-700 border-orange-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', low: 'bg-green-100 text-green-700 border-green-200' };

    return (
        <div className="space-y-5 max-w-4xl pb-10">
            {isGenerating && <AILoadingProgress stage="generating" message="AI is crafting your personalised study plan..." estimatedTime={30} />}

            {/* Step indicator */}
            <div className="flex items-center gap-2">
                {[{ n: 1, label: 'Events' }, { n: 2, label: 'Context' }, { n: 3, label: 'Your Plan' }].map(({ n, label }, i) => (
                    <React.Fragment key={n}>
                        <button onClick={() => (n < step || plan) && setStep(n)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${step === n ? 'bg-emerald-600 text-white shadow-md' : n < step ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 cursor-default'}`}>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === n ? 'bg-white/30' : 'bg-white/60'}`}>{n < step ? '✓' : n}</span>
                            {label}
                        </button>
                        {i < 2 && <ArrowRight className={`w-3 h-3 ${step > n ? 'text-emerald-500' : 'text-gray-300'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {/* STEP 1: Events */}
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
                            <div className="flex items-center gap-3 mb-1">
                                <Calendar className="w-5 h-5" />
                                <h2 className="font-bold text-lg">Add Your Upcoming Events</h2>
                            </div>
                            <p className="text-white/70 text-sm">Include everything — assessments, performances, sport, excursions. The more complete, the better your plan.</p>
                        </div>

                        <AnimatePresence>
                            {events.map((e, idx) => (
                                <AssessmentRow key={idx} a={e} idx={idx} total={events.length} onRemove={removeEvent} onUpdate={updateEvent} userSubjects={userSubjects} />
                            ))}
                        </AnimatePresence>

                        <Button variant="outline" onClick={addEvent} className="w-full border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-2xl h-11">
                            <Plus className="w-4 h-4 mr-2" /> Add Another Event
                        </Button>

                        <div className="flex justify-between items-center pt-2">
                            <p className="text-xs text-gray-400">{validEvents.length} event{validEvents.length !== 1 ? 's' : ''} ready</p>
                            <Button onClick={() => setStep(2)} disabled={validEvents.length === 0}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg px-8">
                                Next: My Context <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 2: Context */}
                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                        <div className="bg-gradient-to-br from-teal-600 to-cyan-600 rounded-2xl p-5 text-white">
                            <div className="flex items-center gap-3 mb-1">
                                <Target className="w-5 h-5" />
                                <h2 className="font-bold text-lg">Tell Us About Yourself</h2>
                            </div>
                            <p className="text-white/70 text-sm">This helps the AI personalise your plan to your actual life — not just a generic schedule.</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                            {/* Stress level */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">How stressed are you feeling right now?</label>
                                <div className="flex flex-wrap gap-2">
                                    {STRESS_LEVELS.map(s => (
                                        <button key={s.value} onClick={() => setStressLevel(s.value)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all ${stressLevel === s.value ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold ring-2 ring-emerald-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                            <span>{s.emoji}</span> {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Study hours + sleep */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Daily study hours available</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {HOURS_OPTIONS.map(h => (
                                            <button key={h} onClick={() => setHoursPerDay(h)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${hoursPerDay === h ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                                {h}h
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Average sleep per night</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {SLEEP_OPTIONS.map(s => (
                                            <button key={s} onClick={() => setSleepHours(s)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${sleepHours === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Study style */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Your study style</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {STUDY_STYLES.map(s => (
                                        <button key={s.value} onClick={() => setStudyStyle(s.value)}
                                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm border text-left transition-all ${studyStyle === s.value ? 'bg-teal-50 border-teal-400 text-teal-800 font-semibold ring-2 ring-teal-200' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                            <span className="text-xl">{s.icon}</span>
                                            <div>
                                                <p className="font-medium text-xs">{s.value}</p>
                                                <p className="text-xs text-gray-400">{s.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Weak areas */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Weak areas or specific concerns <span className="font-normal text-gray-400">(optional)</span></label>
                                <Textarea placeholder="e.g., I struggle with calculus in Methods, I haven't started my English essay, I'm behind on Biology notes..."
                                    value={weakAreas} onChange={e => setWeakAreas(e.target.value)} rows={2}
                                    className="bg-gray-50 border-gray-200 text-sm resize-none" />
                            </div>

                            {/* Extracurriculars */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Extracurriculars / other commitments <span className="font-normal text-gray-400">(optional)</span></label>
                                <Input placeholder="e.g., footy training Tues & Thurs, part-time job Sat, music practice daily..."
                                    value={hasExtracurriculars} onChange={e => setHasExtracurriculars(e.target.value)}
                                    className="bg-gray-50 border-gray-200 text-sm" />
                            </div>

                            {/* Extra context */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Anything else for the AI to know? <span className="font-normal text-gray-400">(optional)</span></label>
                                <Textarea placeholder="e.g., I work better in the mornings, I have a family event next weekend, I'm aiming for a 90+ ATAR..."
                                    value={extraContext} onChange={e => setExtraContext(e.target.value)} rows={2}
                                    className="bg-gray-50 border-gray-200 text-sm resize-none" />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep(1)} className="border-gray-200">
                                ← Back
                            </Button>
                            <Button onClick={handleGenerate} disabled={isGenerating}
                                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg h-12 font-semibold text-base">
                                {isGenerating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Building your plan...</> : <><Wand2 className="w-5 h-5 mr-2" />Generate My Personalised Plan</>}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 3: Plan */}
                {step === 3 && plan && (
                    <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        {/* Header */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-xl">
                            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <p className="text-white/70 text-sm">Generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        <h2 className="text-2xl font-black mt-0.5">Your Study Plan 📅</h2>
                                        <p className="text-white/80 text-sm mt-1">{validEvents.length} event{validEvents.length !== 1 ? 's' : ''} · {hoursPerDay}h/day · {studyStyle.split(' ')[0]}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setStep(1)} className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs">Edit Events</Button>
                                        <Button size="sm" onClick={handleSave} className="bg-white text-emerald-700 hover:bg-white/90 text-xs font-bold">Save Plan</Button>
                                    </div>
                                </div>

                                {/* Motivational message */}
                                {plan.motivational_message && (
                                    <div className="mt-4 bg-white/15 rounded-xl px-4 py-3 text-sm text-white/90 italic border border-white/20">
                                        💬 {plan.motivational_message}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Smart Insights */}
                        {plan.smart_insights?.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm font-bold text-amber-800">Smart Insights</span>
                                </div>
                                <div className="space-y-2">
                                    {plan.smart_insights.map((insight, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-amber-900">
                                            <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span> {insight}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Emergency Tips */}
                        {plan.emergency_tips?.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    <span className="text-sm font-bold text-red-800">🚨 Urgent — Due Within 7 Days</span>
                                </div>
                                <div className="space-y-3">
                                    {plan.emergency_tips.map((tip, i) => (
                                        <div key={i} className="bg-white rounded-xl p-3 border border-red-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className="bg-red-100 text-red-700 border-0 text-xs">{tip.days_left}d left</Badge>
                                                <span className="text-sm font-bold text-gray-900">{tip.event_label}</span>
                                            </div>
                                            <ul className="space-y-1">
                                                {tip.cramming_strategy.map((s, j) => (
                                                    <li key={j} className="flex items-start gap-1.5 text-xs text-gray-700">
                                                        <span className="font-bold text-red-500 flex-shrink-0">{j + 1}.</span> {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Priority Ranking */}
                        <PlanSection title="Priority Order" icon="🎯" accentColor="blue">
                            <div className="space-y-2">
                                {(plan.priority_ranking || []).map((item, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-blue-100">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-orange-400 text-white' : i === 2 ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                            {item.rank}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <span className="text-sm font-bold text-gray-900">{item.event_label}</span>
                                                <Badge className={`text-xs border ${urgencyColors[item.urgency_level] || urgencyColors.low}`}>{item.urgency_level}</Badge>
                                                {item.days_until !== undefined && <span className="text-xs text-gray-400">{item.days_until}d away</span>}
                                            </div>
                                            <p className="text-xs text-gray-500">{item.reason}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </PlanSection>

                        {/* 14-Day Schedule */}
                        <PlanSection title="14-Day Schedule" icon="📅" accentColor="emerald">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(plan.weekly_schedule || []).map((day, i) => (
                                    <div key={i} className={`bg-white rounded-xl border p-3 ${day.is_rest_day ? 'border-rose-100 opacity-80' : 'border-gray-100'} shadow-sm`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 text-sm">{day.day}</span>
                                                {day.is_rest_day && <Badge className="bg-rose-100 text-rose-600 border-0 text-xs">Rest 🌙</Badge>}
                                            </div>
                                            {day.hours && !day.is_rest_day && <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">⏱ {day.hours}</span>}
                                        </div>
                                        {day.focus && !day.is_rest_day && <p className="text-xs font-semibold text-emerald-700 mb-1.5">🎯 {day.focus}</p>}
                                        {day.is_rest_day ? (
                                            <p className="text-xs text-gray-400">Take it easy. Light review only if needed.</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {(day.tasks || []).map((task, j) => (
                                                    <li key={j} className="flex items-start gap-1.5 text-xs text-gray-600">
                                                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">{j + 1}</span>
                                                        {task}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </PlanSection>

                        {/* Subject Strategies */}
                        {plan.subject_strategies && Object.keys(plan.subject_strategies).length > 0 && (
                            <PlanSection title="Subject Strategies" icon="📚" accentColor="purple" defaultOpen={false}>
                                <div className="space-y-3">
                                    {Object.entries(plan.subject_strategies).map(([subject, strat]) => (
                                        <div key={subject} className="bg-white rounded-xl border border-purple-100 p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-gray-900 text-sm">{subject}</span>
                                                {strat.technique && <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">🛠 {strat.technique}</Badge>}
                                            </div>
                                            {strat.why && <p className="text-xs text-gray-500 mb-2 italic">{strat.why}</p>}
                                            {strat.quick_tips?.length > 0 && (
                                                <ul className="space-y-1">
                                                    {strat.quick_tips.map((tip, i) => (
                                                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                                            <CheckCircle2 className="w-3 h-3 text-purple-500 flex-shrink-0 mt-0.5" /> {tip}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </PlanSection>
                        )}

                        {/* Key Milestones */}
                        {plan.key_milestones?.length > 0 && (
                            <PlanSection title="Key Milestones" icon="🏁" accentColor="teal" defaultOpen={false}>
                                <div className="space-y-2">
                                    {plan.key_milestones.map((m, i) => (
                                        <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-teal-100">
                                            <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{m.milestone}</p>
                                                {m.target_date && <p className="text-xs text-teal-600 font-medium">📅 {m.target_date}</p>}
                                                <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </PlanSection>
                        )}

                        {/* Wellbeing */}
                        {plan.stress_and_wellbeing && (
                            <PlanSection title="Wellbeing & Burnout Prevention" icon="❤️" accentColor="rose" defaultOpen={false}>
                                <div className="space-y-3">
                                    {plan.stress_and_wellbeing.current_assessment && (
                                        <div className="bg-white rounded-xl p-3 border border-rose-100 text-sm text-gray-700">
                                            <p className="font-semibold text-rose-700 text-xs mb-1">🔍 Current Situation</p>
                                            {plan.stress_and_wellbeing.current_assessment}
                                        </div>
                                    )}
                                    {plan.stress_and_wellbeing.daily_routine_tip && (
                                        <div className="bg-white rounded-xl p-3 border border-rose-100">
                                            <p className="font-semibold text-rose-700 text-xs mb-1">☀️ Daily Routine Tip</p>
                                            <p className="text-sm text-gray-700">{plan.stress_and_wellbeing.daily_routine_tip}</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        {plan.stress_and_wellbeing.burnout_warning_signs?.length > 0 && (
                                            <div className="bg-white rounded-xl p-3 border border-rose-100">
                                                <p className="font-semibold text-rose-700 text-xs mb-2">⚠️ Warning Signs</p>
                                                <ul className="space-y-1">{plan.stress_and_wellbeing.burnout_warning_signs.map((s, i) => <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-rose-400">•</span>{s}</li>)}</ul>
                                            </div>
                                        )}
                                        {plan.stress_and_wellbeing.recovery_strategies?.length > 0 && (
                                            <div className="bg-white rounded-xl p-3 border border-rose-100">
                                                <p className="font-semibold text-emerald-700 text-xs mb-2">💚 Recovery Tips</p>
                                                <ul className="space-y-1">{plan.stress_and_wellbeing.recovery_strategies.map((s, i) => <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-emerald-400">•</span>{s}</li>)}</ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </PlanSection>
                        )}

                        {/* Regenerate */}
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => { setStep(2); }} className="border-gray-200 text-gray-600">← Adjust & Redo</Button>
                            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
                                <Zap className="w-4 h-4 mr-2" /> Save Plan
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}