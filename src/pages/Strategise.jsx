/**
 * Strategise — a full page for planning the run-up to one assessment.
 *
 * This started as a modal wizard, which was the wrong shape: the interesting
 * part is walking the days between now and the SAC and deciding what each one
 * is for, and that doesn't fit in a dialog. As a page it can show the whole
 * run-up at once, so the student sees the shape of their fortnight while
 * they're choosing, rather than answering questions into the dark.
 *
 * Flow: pick the assessment → say where you're starting from → walk each day
 * and set its aim → the model drafts the sessions → strategise.js constrains
 * the draft → save to the planner.
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import {
    Sparkles, ArrowRight, ArrowLeft, Loader2, Check, Target, Flag, Info, BookOpen, Brain, Zap, Coffee, GraduationCap,
} from "lucide-react";
import { TECHNIQUES, TECHNIQUE_IDS, PRINCIPLES, runUpDays, applyRules, planSummary } from "@/lib/strategise";
import { fmtDate } from "@/lib/safeDate";
import AceShuffle from "@/components/ace/AceShuffle";

const CONFIDENCE = [
    { v: 1, label: "Barely started", hint: "Most of it is new to me" },
    { v: 2, label: "Shaky", hint: "I've seen it, it hasn't stuck" },
    { v: 3, label: "Getting there", hint: "Solid on some topics, not others" },
    { v: 4, label: "Pretty solid", hint: "Mostly just need practice" },
];

/**
 * What a day can be for. The student picks one per day; the model then decides
 * which technique and topic serves that aim. Keeping the choice at this level
 * means they're saying what they want to achieve, not picking features.
 */
export const DAY_AIMS = [
    { id: "learn",  label: "Learn new content",  icon: BookOpen,       hint: "Cover something I don't know yet", accent: "chart-3" },
    { id: "drill",  label: "Drill what I know",  icon: Brain,          hint: "Flashcards, recall, make it stick", accent: "primary" },
    { id: "weak",   label: "Fix a weak spot",    icon: Zap,            hint: "Attack a topic I keep losing marks on", accent: "streak" },
    { id: "test",   label: "Test myself",        icon: GraduationCap,  hint: "Questions or a timed run under pressure", accent: "chart-4" },
    { id: "rest",   label: "Rest day",           icon: Coffee,         hint: "No study — protect it", accent: "muted" },
];
const AIM_BY_ID = Object.fromEntries(DAY_AIMS.map(a => [a.id, a]));

// Static class strings — never build these from template literals.
const AIM_CLASS = {
    "chart-3": { on: "border-chart-3 bg-chart-3/10 text-chart-3", icon: "text-chart-3" },
    primary:   { on: "border-primary bg-primary/10 text-primary", icon: "text-primary" },
    streak:    { on: "border-streak bg-streak/10 text-streak",     icon: "text-streak" },
    "chart-4": { on: "border-chart-4 bg-chart-4/10 text-chart-4", icon: "text-chart-4" },
    muted:     { on: "border-border bg-secondary text-muted-foreground", icon: "text-muted-foreground" },
};

const MINUTES = [20, 30, 45, 60, 90];

// Transfer-appropriate processing: practice should look like the assessment.
const SAC_FORMATS = [
    { id: "extended", label: "Extended response", prompt: "extended written responses — they need writing practice under time, not just recall" },
    { id: "short",    label: "Short answer",      prompt: "short-answer questions — precise recall and clear definitions matter most" },
    { id: "mcq",      label: "Multiple choice",   prompt: "multiple choice — discrimination between close alternatives matters most" },
    { id: "prac",     label: "Practical / data",  prompt: "practical or data analysis — interpreting results and applying method matters most" },
    { id: "mixed",    label: "A mix",             prompt: "a mix of question types" },
];

export default function Strategise() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [, setUser] = useState(null);
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [stage, setStage] = useState("pick");   // pick → setup → days → plan
    const [sacId, setSacId] = useState(null);
    const [confidence, setConfidence] = useState(3);
    const [shaky, setShaky] = useState("");
    const [goal, setGoal] = useState("");
    const [sacFormat, setSacFormat] = useState("mixed");
    const [topics, setTopics] = useState("");
    const [lastMark, setLastMark] = useState("");
    const [dayPlan, setDayPlan] = useState({});   // date → { aim, minutes }
    const [busy, setBusy] = useState(false);
    const [plan, setPlan] = useState(null);

    useEffect(() => {
        base44.auth.me().then(async (u) => {
            setUser(u);
            const a = await base44.entities.SubjectAssessment
                .filter({ created_by: u.email, is_completed: false }, "due_date", 20).catch(() => []);
            setAssessments(a || []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const sac = useMemo(() => assessments.find(a => a.id === sacId) || null, [assessments, sacId]);
    const days = useMemo(() => (sac?.due_date ? runUpDays(sac.due_date) : []), [sac]);

    // Sensible opening shape: learn early, drill through the middle, test late.
    const seedDays = (list) => {
        const seeded = {};
        list.forEach((d, i) => {
            const pos = i / Math.max(1, list.length - 1);
            const aim = pos < 0.35 ? "learn" : pos < 0.75 ? "drill" : "test";
            seeded[d] = { aim, minutes: 45 };
        });
        setDayPlan(seeded);
    };

    const chosen = useMemo(
        () => days.filter(d => dayPlan[d] && dayPlan[d].aim !== "rest"),
        [days, dayPlan],
    );
    const totalMins = chosen.reduce((s, d) => s + (dayPlan[d]?.minutes || 0), 0);

    const generate = async () => {
        if (!sac || chosen.length === 0) return;
        setBusy(true);
        try {
            const brief = chosen.map(d =>
                `${d} — aim: ${AIM_BY_ID[dayPlan[d].aim]?.label} (${dayPlan[d].minutes} min)`).join("\n");
            const res = await base44.integrations.Core.InvokeLLM({
                feature: "roadmap_ai_gen",
                prompt: `Turn a student's day-by-day aims into concrete study sessions for one assessment.

ASSESSMENT: ${sac.title || "Assessment"} — ${sac.subject_name || "their subject"} (${(sac.assessment_type || "SAC").toUpperCase()})
DATE: ${sac.due_date}
HOW WELL THEY KNOW IT: ${CONFIDENCE.find(c => c.v === confidence)?.label} — ${CONFIDENCE.find(c => c.v === confidence)?.hint}
SHAKY ON: ${shaky.trim() || "they didn't name specific topics"}
WHAT THEY WANT: ${goal.trim() || "to do well"}
FORMAT OF THE ASSESSMENT: ${SAC_FORMATS.find(f => f.id === sacFormat)?.prompt}
TOPICS IT COVERS: ${topics.trim() || "not listed — infer from the subject"}
HOW THEY DID LAST TIME: ${lastMark.trim() || "not said"}

THE DAYS THEY'VE PLANNED, AND WHAT EACH IS FOR:
${brief}

For each of those dates produce one session (two only if the minutes allow and it genuinely helps).
Honour the aim they chose for that day — it's their decision, not yours to override.
Pick the technique that serves it:
${TECHNIQUE_IDS.map(id => `- ${id}: ${TECHNIQUES[id].blurb}`).join("\n")}

Rules:
- Never schedule a date that isn't listed above.
- Never exceed that day's stated minutes.
- Name a specific topic per session, using what they said is shaky where you can.
- "why" is one short sentence to the student about what that session buys them.
- Interleave the topics they listed rather than blocking one topic for days.
- Match the practice to the format above — an extended-response SAC needs writing practice, not just recall.`,
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
            // The rules use the tightest daily budget the student set, so a
            // generous day can't be used to justify overrunning a short one.
            const minPerDay = Math.min(...chosen.map(d => dayPlan[d].minutes));
            setPlan(applyRules(raw, {
                days, availableDays: chosen, minutesPerDay: minPerDay, confidence,
            }));
            setStage("plan");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e) {
            toast({ title: "Couldn't build the plan", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const save = async () => {
        if (!plan?.sessions?.length) return;
        setBusy(true);
        try {
            const stratId = (crypto.randomUUID?.() || String(Date.now())).slice(0, 8);
            // One insert. A strategy through to a SAC three weeks out is
            // twenty-odd sessions, and every one of them was its own request.
            await base44.entities.StudyPlan.bulkCreate(plan.sessions.map(s => ({
                title: `${TECHNIQUES[s.technique].label}: ${s.topic}`,
                subject_name: sac.subject_name || null,
                date: s.date,
                start_time: null,
                is_completed: false,
                notes: `[str:${stratId}][dur:${s.duration}] ${s.why}`,
            })));
            toast({
                variant: "success",
                title: "Strategy locked in",
                description: `${plan.sessions.length} sessions through to ${fmtDate(sac.due_date, "EEE d MMM")}.`,
            });
            navigate(createPageUrl("Goals"));
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    // Date-to-date, not date-to-now: `new Date()` carries a time of day, so
    // comparing it against a midnight due date truncates and reports a SAC as
    // one day nearer than it is. Needs two clear days — one is the SAC itself
    // and one is today, which leaves nothing to plan.
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const daysUntil = (due) => differenceInDays(parseISO(due), parseISO(todayKey));
    const upcoming = assessments.filter(a => a.due_date && daysUntil(a.due_date) >= 2);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <AceShuffle size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6">
                <button onClick={() => navigate(createPageUrl("Goals"))}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Planner
                </button>

                <div>
                    <p className="stat-label text-chart-4 mb-1.5">Strategise</p>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {stage === "pick" ? "Which assessment are we beating?"
                            : stage === "setup" ? "Where are you starting from?"
                            : stage === "days" ? `${days.length} days until ${sac ? fmtDate(sac.due_date, "EEE d MMM") : "it"}`
                            : "Here's the run-up"}
                    </h1>
                    {stage === "days" && (
                        <p className="text-sm text-muted-foreground mt-2">
                            Say what each day is for. You're choosing what you want out of the day —
                            AcedIt picks the technique that gets you there.
                        </p>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {/* ── Pick the assessment ─────────────────────────────── */}
                    {stage === "pick" && (
                        <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                            {upcoming.length === 0 ? (
                                <div className="card-soft p-8 text-center">
                                    <Flag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                                    <p className="font-bold text-foreground">No upcoming assessments logged</p>
                                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                                        Strategise plans the run-up to a specific SAC, so it needs one on the board first.
                                    </p>
                                    <Button onClick={() => navigate(createPageUrl("Goals"))} className="gap-1.5">
                                        Add one on the Planner <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : upcoming.map(a => {
                                const d = daysUntil(a.due_date);
                                return (
                                    <button key={a.id}
                                        onClick={() => {
                                            setSacId(a.id);
                                            seedDays(runUpDays(a.due_date));
                                            setStage("setup");
                                        }}
                                        className="w-full text-left card-soft p-5 border-2 border-border hover:border-chart-4/50 transition-all group">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-display font-extrabold text-foreground">{a.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {a.subject_name} · {(a.assessment_type || "SAC").toUpperCase()} · {fmtDate(a.due_date, "EEE d MMM")}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className={`font-display font-black text-2xl leading-none ${d <= 3 ? "text-streak" : "text-chart-4"}`}>{d}</p>
                                                <p className="stat-label">days</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}

                    {/* ── Where you're starting ───────────────────────────── */}
                    {stage === "setup" && (
                        <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                            <div className="card-soft p-5">
                                <p className="stat-label mb-3 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> How well do you know it already?</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {CONFIDENCE.map(c => (
                                        <button key={c.v} onClick={() => setConfidence(c.v)}
                                            className={`text-left px-4 py-3 rounded-2xl border-2 transition-all ${
                                                confidence === c.v ? "border-chart-4 bg-chart-4/5" : "border-border hover:border-muted-foreground/40"}`}>
                                            <span className="block text-sm font-bold text-foreground">{c.label}</span>
                                            <span className="block text-xs text-muted-foreground leading-snug">{c.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="card-soft p-5">
                                <p className="stat-label mb-1">What sort of assessment is it?</p>
                                <p className="text-[11px] text-muted-foreground mb-3">
                                    Practice works best when it looks like the real thing, so this changes what gets scheduled.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {SAC_FORMATS.map(f => (
                                        <button key={f.id} onClick={() => setSacFormat(f.id)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                                sacFormat === f.id ? "bg-chart-4 border-chart-4 text-white" : "border-border text-muted-foreground hover:border-chart-4/40"}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="card-soft p-5 space-y-4">
                                <div>
                                    <p className="stat-label mb-1.5">Anything specific you're shaky on?</p>
                                    <Input value={shaky} onChange={e => setShaky(e.target.value)} maxLength={200}
                                        placeholder="e.g. titrations, and I always lose marks on graphs" />
                                    <p className="text-[11px] text-muted-foreground mt-1">Optional — but it's what makes the plan yours rather than generic.</p>
                                </div>
                                <div>
                                    <p className="stat-label mb-1.5 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> What do you want out of this?</p>
                                    <Input value={goal} onChange={e => setGoal(e.target.value)} maxLength={140}
                                        placeholder="e.g. top of the class, or just not blank on the extended response" />
                                </div>
                                <div>
                                    <p className="stat-label mb-1.5">Which topics does it cover?</p>
                                    <Input value={topics} onChange={e => setTopics(e.target.value)} maxLength={240}
                                        placeholder="e.g. redox, galvanic cells, electrolysis" />
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Listing them lets the plan interleave topics rather than block one at a time — mixing transfers better.
                                    </p>
                                </div>
                                <div>
                                    <p className="stat-label mb-1.5">How did the last one go?</p>
                                    <Input value={lastMark} onChange={e => setLastMark(e.target.value)} maxLength={80}
                                        placeholder="e.g. 68% — lost most of it on the extended response" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStage("pick")} className="rounded-xl gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</Button>
                                <Button onClick={() => setStage("days")} className="ml-auto gap-1.5">Plan the days <ArrowRight className="w-4 h-4" /></Button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Day by day ──────────────────────────────────────── */}
                    {stage === "days" && (
                        <motion.div key="days" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                            {days.map((d, i) => {
                                const cur = dayPlan[d] || { aim: "rest", minutes: 45 };
                                const isLast = i === days.length - 1;
                                return (
                                    <div key={d} className={`card-soft p-4 border-2 ${cur.aim === "rest" ? "border-border opacity-70" : "border-border"}`}>
                                        <div className="flex items-baseline justify-between mb-3">
                                            <p className="font-display font-extrabold text-foreground text-sm">
                                                {fmtDate(d, "EEEE d MMM")}
                                                {isLast && <span className="pill bg-streak/15 text-streak ml-2">day before</span>}
                                            </p>
                                            {cur.aim !== "rest" && (
                                                <span className="text-xs font-bold text-muted-foreground tabular-nums">{cur.minutes} min</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {DAY_AIMS.map(a => {
                                                const on = cur.aim === a.id;
                                                const cls = AIM_CLASS[a.accent];
                                                return (
                                                    <button key={a.id}
                                                        onClick={() => setDayPlan(p => ({ ...p, [d]: { ...cur, aim: a.id } }))}
                                                        title={a.hint}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                                            on ? cls.on : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                                        <a.icon className={`w-3.5 h-3.5 ${on ? "" : cls.icon}`} />
                                                        {a.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {cur.aim !== "rest" && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {MINUTES.map(m => (
                                                    <button key={m}
                                                        onClick={() => setDayPlan(p => ({ ...p, [d]: { ...cur, minutes: m } }))}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border-2 transition-all ${
                                                            cur.minutes === m ? "bg-foreground border-foreground text-background" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                                        {m}m
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Stacks on narrow screens — side by side, the running
                                total got squeezed to one word per line. */}
                            <div className="sticky bottom-4 card-soft p-4 border-2 border-chart-4/30 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground">
                                        {chosen.length} study day{chosen.length === 1 ? "" : "s"} · {Math.round(totalMins / 60 * 10) / 10}h total
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {days.length - chosen.length} rest day{days.length - chosen.length === 1 ? "" : "s"}.
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <Button variant="ghost" onClick={() => setStage("setup")} className="rounded-xl">Back</Button>
                                    <Button onClick={generate} disabled={busy || chosen.length === 0} className="flex-1 sm:flex-none gap-1.5">
                                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Build my plan
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── The plan ────────────────────────────────────────── */}
                    {stage === "plan" && plan && (
                        <motion.div key="plan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            {(() => { const s = planSummary(plan.sessions); return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[["Sessions", s.sessions], ["Days", s.days], ["Total", `${Math.round(s.totalMinutes / 60)}h`], ["Techniques", s.kinds]].map(([k, v]) => (
                                        <div key={k} className="card-soft p-4">
                                            <p className="font-display font-black text-2xl leading-none text-foreground tabular-nums">{v}</p>
                                            <p className="stat-label mt-1.5">{k}</p>
                                        </div>
                                    ))}
                                </div>
                            ); })()}

                            {plan.fixes.length > 0 && (
                                <div className="card-soft p-4">
                                    <p className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5" /> Adjusted to keep the plan sound
                                    </p>
                                    {plan.fixes.map((f, i) => <p key={i} className="text-xs text-muted-foreground leading-snug">· {f}</p>)}
                                </div>
                            )}

                            {/* The reasoning, named and sourced. A plan that says
                                "trust me" is indistinguishable from a guess. */}
                            <details className="card-soft p-4">
                                <summary className="text-sm font-bold text-foreground cursor-pointer">
                                    Why this plan looks like this
                                </summary>
                                <div className="mt-3 space-y-2.5">
                                    {/* `metacognition` is always shown — it isn't tied to any one
                                        session, it's the reason none of them are "read your notes". */}
                                    {["metacognition", ...new Set(plan.sessions.map(x => x.principle))]
                                        .filter((k, i, all) => PRINCIPLES[k] && all.indexOf(k) === i)
                                        .map(k => (
                                            <div key={k}>
                                                <p className="text-xs font-bold text-foreground">{PRINCIPLES[k].name}</p>
                                                <p className="text-xs text-muted-foreground leading-snug">{PRINCIPLES[k].claim}</p>
                                                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{PRINCIPLES[k].source}</p>
                                            </div>
                                        ))}
                                </div>
                            </details>

                            <div className="space-y-2">
                                {plan.sessions.map((s, i) => (
                                    <div key={i} className="card-soft p-4">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <p className="text-xs font-bold text-chart-4">{fmtDate(s.date, "EEE d MMM")}</p>
                                            <p className="text-[11px] text-muted-foreground">{TECHNIQUES[s.technique].label} · {s.duration}m</p>
                                        </div>
                                        <p className="font-bold text-foreground mt-0.5">{s.topic}</p>
                                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{s.why}</p>
                                        {PRINCIPLES[s.principle] && (
                                            <span className="pill bg-secondary text-muted-foreground mt-2" title={PRINCIPLES[s.principle].claim}>
                                                {PRINCIPLES[s.principle].name}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="sticky bottom-4 card-soft p-4 border-2 border-chart-4/30 flex flex-wrap gap-2">
                                <Button variant="ghost" onClick={() => setStage("days")} className="rounded-xl">Change the days</Button>
                                <Button onClick={save} disabled={busy} className="ml-auto gap-1.5">
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add to my planner
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
