/**
 * StrategiseWizard — the conference that turns a logged SAC into a schedule.
 *
 * Replaces "Plan this week for me", which asked for an hours budget and
 * returned generic sessions with no idea what the student was preparing for.
 * This starts from one assessment and works backwards from its date: what do
 * you already know, what are you aiming for, which days are you free, how long
 * can you sit down for. The model drafts from those answers; strategise.js then
 * constrains the draft so the sequencing is defensible.
 */
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";
import {
    Sparkles, ArrowRight, ArrowLeft, Loader2, Check, Clock, Target, Flag, CalendarDays, Info,
} from "lucide-react";
import { TECHNIQUES, TECHNIQUE_IDS, runUpDays, applyRules, planSummary } from "@/lib/strategise";

const CONFIDENCE = [
    { v: 1, label: "Barely started", hint: "Most of it is new to me" },
    { v: 2, label: "Shaky",          hint: "I've seen it, it hasn't stuck" },
    { v: 3, label: "Getting there",  hint: "Solid on some topics, not others" },
    { v: 4, label: "Pretty solid",   hint: "Mostly just need practice" },
];
const MINUTES = [30, 45, 60, 90, 120];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StrategiseWizard({ open, onOpenChange, assessments, userEmail, onSaved }) {
    const { toast } = useToast();
    const [step, setStep] = useState(0);
    const [sacId, setSacId] = useState(null);
    const [confidence, setConfidence] = useState(3);
    const [shaky, setShaky] = useState("");
    const [goal, setGoal] = useState("");
    const [minutesPerDay, setMinutesPerDay] = useState(60);
    const [skipDays, setSkipDays] = useState([]);      // weekday numbers they can't study
    const [busy, setBusy] = useState(false);
    const [plan, setPlan] = useState(null);            // { sessions, fixes }

    const sac = useMemo(() => assessments.find(a => a.id === sacId) || null, [assessments, sacId]);
    const days = useMemo(() => (sac?.due_date ? runUpDays(sac.due_date) : []), [sac]);
    const availableDays = useMemo(
        () => days.filter(d => !skipDays.includes(new Date(d).getDay())),
        [days, skipDays],
    );

    const reset = () => { setStep(0); setSacId(null); setPlan(null); setShaky(""); setGoal(""); };
    const close = () => { onOpenChange(false); setTimeout(reset, 250); };

    const generate = async () => {
        if (!sac) return;
        setBusy(true);
        try {
            const daysLeft = days.length;
            const res = await base44.integrations.Core.InvokeLLM({
                feature: "roadmap_ai_gen",
                prompt: `Plan a student's study for one assessment, day by day.

ASSESSMENT: ${sac.title || "Assessment"} — ${sac.subject_name || "their subject"} (${(sac.assessment_type || "SAC").toUpperCase()})
DATE: ${sac.due_date} — ${daysLeft} study day${daysLeft === 1 ? "" : "s"} available before it.
HOW WELL THEY KNOW IT: ${CONFIDENCE.find(c => c.v === confidence)?.label} — ${CONFIDENCE.find(c => c.v === confidence)?.hint}
WHAT THEY SAY IS SHAKY: ${shaky.trim() || "they didn't name specific topics"}
WHAT THEY WANT: ${goal.trim() || "to do well"}
TIME PER DAY: up to ${minutesPerDay} minutes
DAYS THEY CAN STUDY: ${availableDays.join(", ") || "none"}

Schedule sessions ONLY on the dates listed above. Each session picks exactly one technique:
${TECHNIQUE_IDS.map(id => `- ${id}: ${TECHNIQUES[id].blurb}`).join("\n")}

Rules you must follow:
- Learn content before testing on it. Spread retrieval across days rather than stacking it.
- Name a specific topic per session, drawn from what they said is shaky where you can.
- "why" is one short sentence to the student explaining what that session buys them.
- Never exceed ${minutesPerDay} minutes total on a single date.
- Finish with a timed paper in the last few days, not on the final day.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        sessions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    date: { type: "string" },
                                    technique: { type: "string", enum: TECHNIQUE_IDS },
                                    topic: { type: "string" },
                                    duration: { type: "number" },
                                    why: { type: "string" },
                                },
                                required: ["date", "technique", "topic", "duration", "why"],
                            },
                        },
                    },
                    required: ["sessions"],
                },
            });
            const raw = (res?.data ?? res)?.sessions || [];
            // The model drafts; the rules decide what ships.
            setPlan(applyRules(raw, { days, availableDays, minutesPerDay, confidence }));
            setStep(4);
        } catch (e) {
            toast({ title: "Couldn't build the plan", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const save = async () => {
        if (!plan?.sessions?.length) return;
        setBusy(true);
        try {
            const stratId = (crypto.randomUUID?.() || String(Date.now())).slice(0, 8);
            for (const s of plan.sessions) {
                const t = TECHNIQUES[s.technique];
                await base44.entities.StudyPlan.create({
                    title: `${t.label}: ${s.topic}`,
                    subject_name: sac.subject_name || null,
                    date: s.date,
                    start_time: null,
                    is_completed: false,
                    // Same tag convention the planner already reads, plus a
                    // strategy id so a plan can be found and revised later.
                    notes: `[str:${stratId}][dur:${s.duration}] ${s.why}`,
                });
            }
            toast({
                title: "Strategy locked in",
                description: `${plan.sessions.length} sessions on your planner, through to ${format(parseISO(sac.due_date), "EEE d MMM")}.`,
            });
            onSaved?.();
            close();
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const upcoming = assessments.filter(a => !a.is_completed && a.due_date && differenceInDays(parseISO(a.due_date), new Date()) >= 1);

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
            <DialogContent className="max-w-lg rounded-3xl max-h-[88vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-chart-4" /> Strategise
                    </DialogTitle>
                </DialogHeader>

                {/* Progress */}
                <div className="flex gap-1.5 mb-1">
                    {[0, 1, 2, 3, 4].map(i => (
                        <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-chart-4" : "bg-secondary"}`} />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {/* 0 — which assessment */}
                    {step === 0 && (
                        <motion.div key="s0" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-3">
                            <p className="text-sm text-muted-foreground">Which assessment are we preparing for?</p>
                            {upcoming.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                                    <p className="text-sm font-bold text-foreground">No upcoming assessments logged</p>
                                    <p className="text-xs text-muted-foreground mt-1">Add one above and Strategise can plan the run-up to it.</p>
                                </div>
                            ) : upcoming.map(a => {
                                const d = differenceInDays(parseISO(a.due_date), new Date());
                                return (
                                    <button key={a.id} onClick={() => { setSacId(a.id); setStep(1); }}
                                        className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                                            sacId === a.id ? "border-chart-4 bg-chart-4/5" : "border-border hover:border-chart-4/40"}`}>
                                        <p className="font-bold text-foreground text-sm">{a.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {a.subject_name} · {(a.assessment_type || "SAC").toUpperCase()} · {format(parseISO(a.due_date), "EEE d MMM")}
                                            <span className={`ml-1.5 font-bold ${d <= 3 ? "text-streak" : "text-chart-4"}`}>{d} day{d === 1 ? "" : "s"} away</span>
                                        </p>
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}

                    {/* 1 — what do you know */}
                    {step === 1 && (
                        <motion.div key="s1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                            <div>
                                <p className="stat-label mb-2 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> How well do you know this already?</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {CONFIDENCE.map(c => (
                                        <button key={c.v} onClick={() => setConfidence(c.v)}
                                            className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                                                confidence === c.v ? "border-chart-4 bg-chart-4/5" : "border-border hover:border-muted-foreground/40"}`}>
                                            <span className="block text-sm font-bold text-foreground">{c.label}</span>
                                            <span className="block text-[11px] text-muted-foreground leading-snug">{c.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="stat-label mb-1.5">Anything specific you're shaky on?</p>
                                <Input value={shaky} onChange={e => setShaky(e.target.value)} maxLength={200}
                                    placeholder="e.g. titrations, and I always lose marks on graphs" />
                                <p className="text-[11px] text-muted-foreground mt-1">Optional — but it's what makes the plan yours rather than generic.</p>
                            </div>
                        </motion.div>
                    )}

                    {/* 2 — what are you aiming for */}
                    {step === 2 && (
                        <motion.div key="s2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                            <div>
                                <p className="stat-label mb-1.5 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> What do you want out of this SAC?</p>
                                <Input value={goal} onChange={e => setGoal(e.target.value)} maxLength={140}
                                    placeholder="e.g. top 10% of the class, or just not blank on the extended response" />
                            </div>
                            <div>
                                <p className="stat-label mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> How long can you study a day?</p>
                                <div className="flex flex-wrap gap-2">
                                    {MINUTES.map(m => (
                                        <button key={m} onClick={() => setMinutesPerDay(m)}
                                            className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                                minutesPerDay === m ? "bg-chart-4 border-chart-4 text-white" : "border-border text-muted-foreground hover:border-chart-4/40"}`}>
                                            {m >= 60 ? `${m / 60}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* 3 — when are you free */}
                    {step === 3 && (
                        <motion.div key="s3" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                            <div>
                                <p className="stat-label mb-2 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Any days you can't study?</p>
                                <div className="flex flex-wrap gap-2">
                                    {DAY_LABEL.map((d, i) => (
                                        <button key={d} onClick={() => setSkipDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                                skipDays.includes(i) ? "bg-secondary border-border text-muted-foreground line-through" : "border-chart-4/40 text-foreground"}`}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2">
                                    {availableDays.length} study day{availableDays.length === 1 ? "" : "s"} before {sac ? format(parseISO(sac.due_date), "EEE d MMM") : "it"} ·
                                    up to {Math.round((availableDays.length * minutesPerDay) / 60)}h in total.
                                </p>
                            </div>
                            {availableDays.length === 0 && (
                                <p className="text-xs text-streak font-bold">There's no day left to study on — free up a day or the plan has nowhere to go.</p>
                            )}
                        </motion.div>
                    )}

                    {/* 4 — the plan */}
                    {step === 4 && plan && (
                        <motion.div key="s4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                            {(() => { const s = planSummary(plan.sessions); return (
                                <div className="rounded-2xl bg-chart-4/5 border border-chart-4/20 p-4 flex flex-wrap gap-x-6 gap-y-2">
                                    {[["Sessions", s.sessions], ["Days", s.days], ["Total", `${Math.round(s.totalMinutes / 60)}h`], ["Techniques", s.kinds]].map(([k, v]) => (
                                        <div key={k}>
                                            <p className="font-display font-black text-lg leading-none text-foreground tabular-nums">{v}</p>
                                            <p className="stat-label">{k}</p>
                                        </div>
                                    ))}
                                </div>
                            ); })()}

                            {plan.fixes.length > 0 && (
                                <div className="rounded-xl bg-secondary/60 border border-border p-3">
                                    <p className="text-[11px] font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                                        <Info className="w-3 h-3" /> Adjusted to keep the plan sound
                                    </p>
                                    {plan.fixes.map((f, i) => <p key={i} className="text-[11px] text-muted-foreground leading-snug">· {f}</p>)}
                                </div>
                            )}

                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {plan.sessions.map((s, i) => (
                                    <div key={i} className="rounded-xl border border-border p-3">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <p className="text-xs font-bold text-chart-4">{format(parseISO(s.date), "EEE d MMM")}</p>
                                            <p className="text-[11px] text-muted-foreground">{TECHNIQUES[s.technique].label} · {s.duration}m</p>
                                        </div>
                                        <p className="text-sm font-bold text-foreground mt-0.5">{s.topic}</p>
                                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.why}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Nav */}
                <div className="flex items-center gap-2 pt-2">
                    {step > 0 && step < 4 && (
                        <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="rounded-xl gap-1.5">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </Button>
                    )}
                    {step >= 1 && step <= 2 && (
                        <Button onClick={() => setStep(s => s + 1)} className="ml-auto gap-1.5">Next <ArrowRight className="w-4 h-4" /></Button>
                    )}
                    {step === 3 && (
                        <Button onClick={generate} disabled={busy || availableDays.length === 0} className="ml-auto gap-1.5">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Build my plan
                        </Button>
                    )}
                    {step === 4 && (
                        <>
                            <Button variant="ghost" onClick={() => setStep(3)} className="rounded-xl">Redo</Button>
                            <Button onClick={save} disabled={busy} className="ml-auto gap-1.5">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add to my planner
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
