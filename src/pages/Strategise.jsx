/**
 * Strategise — plan the run-up to one assessment, on one screen.
 *
 * ─── IT WAS A QUESTIONNAIRE ABOUT THINGS THE APP ALREADY KNEW ───────────────
 * Four stages: pick the SAC, then four text boxes (what are you shaky on, which
 * topics, how did the last one go, what do you want), then one bordered card
 * per day, then the plan. And it was where the planner sends somebody the
 * moment it says "no prep planned" — so a student who had just been told the
 * runway was empty met a form asking them to type what their own flashcards,
 * mistake bank and marks already said.
 *
 * Now it opens ON the SAC (`?id=`, which the runway's "Plan its prep" passes),
 * already holding what the app knows (`strategyEvidence.js`, every chip naming
 * its source and untickable), with the run-up drawn as one strip of days the
 * student paints aims onto. The plan previews on that strip and in a ruled
 * list under it, and nothing leaves the screen until it is saved.
 *
 * ─── WHAT IT REFUSES ────────────────────────────────────────────────────────
 *   - It never builds on something the student was not shown. The prompt is
 *     `planBrief` over the chips that are TICKED and the days as PAINTED.
 *   - It never stacks a second plan on the first. A rebuild for the same SAC
 *     replaces what is still to come from the last one (`sessionsToReplace`)
 *     and says how many before the button is pressed; done and past stay.
 *   - It never lets a free account fill the screen in and THEN refuses. The
 *     lock and the price are in the footer from the first paint.
 *
 * The rules a drafted plan has to obey are unchanged — `applyRules` — except
 * that each day now keeps to its OWN minutes. See strategise.js.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Check, Plus, Lock, BookOpen, Brain, Zap, GraduationCap, Coffee, Flag, Clock,
    Lightbulb, Layers, PenLine, ListChecks, Timer, RotateCcw, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { fmtDate } from "@/lib/safeDate";
import { dayKey } from "@/lib/studyLog";
import { daysFrom } from "@/lib/termRunway";
import { stratIdOf, durationOf, buildNotes } from "@/lib/planTags";
import { activeStrategies } from "@/lib/strategyState";
import {
    TECHNIQUES, PRINCIPLES, runUpDays, applyRules, planSummary,
    AIMS, aimOf, MINUTE_STEPS, DEFAULT_MINUTES, CONFIDENCE, SAC_FORMATS,
    seedAims, paintDay, studyDays, runUpTotals, strategyIdFor, sessionsToReplace,
    existingByDay, otherSacsByDay, planBrief, PLAN_SCHEMA,
} from "@/lib/strategise";
import { evidenceFor, customChip, CUSTOM_LEN } from "@/lib/strategyEvidence";
import { canUseFeature, FEATURES } from "@/lib/tierAccess";
import { priceLabel } from "@/lib/chips";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { Segmented } from "@/components/shared/SetupControls";
import AceShuffle from "@/components/ace/AceShuffle";

// ─── Static class tables (the JIT cannot see an assembled class) ─────────────

/** Aim → fill, brush ring and icon. Shape (the icon) rides with the colour,
 *  because learn/drill/test in three hues is not readable under CVD alone. */
const AIM_STYLE = {
    learn: { fill: "bg-chart-3",              ink: "text-chart-3",           brush: "border-chart-3 bg-chart-3/10 text-chart-3", icon: BookOpen },
    drill: { fill: "bg-primary",              ink: "text-primary",           brush: "border-primary bg-primary/10 text-primary", icon: Brain },
    weak:  { fill: "bg-streak",               ink: "text-streak",            brush: "border-streak bg-streak/10 text-streak",    icon: Zap },
    test:  { fill: "bg-chart-4",              ink: "text-chart-4",           brush: "border-chart-4 bg-chart-4/10 text-chart-4", icon: GraduationCap },
    rest:  { fill: "bg-muted-foreground/20",  ink: "text-muted-foreground",  brush: "border-foreground/40 bg-secondary text-foreground", icon: Coffee },
};

const TECH_ICON = {
    pomodoro: Clock, concept_explainer: Lightbulb, spaced_repetition: Layers,
    active_recall: Brain, blurting: PenLine, quiz: ListChecks, exam: Timer,
};

/** Where the chip came from → its little source ink. */
const SOURCE_INK = {
    weak: "text-primary", repeat: "text-streak", open: "text-streak", terms: "text-chart-4",
    untouched: "text-chart-3", mark: "text-xp", target: "text-xp", custom: "text-muted-foreground",
};

const BAR_MAX = 90;       // the tallest minutes step fills the bar
const BAR_H = 88;         // px — the bar's full height in a day cell

// ─── Small pieces ────────────────────────────────────────────────────────────

/** A section heading with a rule to the end of the row — the planner's idiom. */
function Band({ title, aside = null, children }) {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3 min-h-9">
                <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl whitespace-nowrap">{title}</h2>
                <span className="flex-1 h-px bg-border" aria-hidden />
                {aside}
            </div>
            {children}
        </section>
    );
}

/** One piece of evidence. A bordered box because it is something you press. */
function EvidenceChip({ chip, on, onToggle }) {
    return (
        <button type="button" onClick={onToggle} aria-pressed={on}
            className={`group w-full text-left rounded-xl border-2 px-3.5 py-2.5 flex items-start gap-3 transition-colors ${
                on ? "border-chart-4/45 bg-chart-4/[0.06]" : "border-border hover:border-muted-foreground/40"}`}>
            <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                on ? "bg-chart-4 border-chart-4 text-white" : "border-muted-foreground/40"}`} aria-hidden>
                {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </span>
            <span className={`min-w-0 flex-1 ${on ? "" : "opacity-60"}`}>
                <span className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-foreground text-sm leading-snug">{chip.label}</span>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${SOURCE_INK[chip.kind] || "text-muted-foreground"}`}>
                        {chip.source}
                    </span>
                </span>
                <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{chip.detail}</span>
            </span>
        </button>
    );
}

/**
 * One day of the run-up. The bar's HEIGHT is the minutes and its colour and
 * glyph are the aim, so the strip reads as the load across the fortnight
 * before a word is read.
 */
function DayCell({ day, cur, existing, others, sessions, plans, isLast, onPress, onPaintStart, onPaintOver, highlight }) {
    const st = AIM_STYLE[cur?.aim] || AIM_STYLE.rest;
    const rest = !cur || cur.aim === "rest";
    const h = rest ? 0 : Math.max(18, Math.round(((cur.minutes || DEFAULT_MINUTES) / BAR_MAX) * BAR_H));
    const Icon = st.icon;
    const date = new Date(`${day}T00:00:00`);
    const firstOfMonth = date.getDate() === 1;
    return (
        <button type="button"
            data-day={day}
            onPointerDown={onPaintStart}
            onPointerEnter={onPaintOver}
            onClick={onPress}
            aria-label={`${fmtDate(day, "EEEE d MMMM")}: ${aimOf(cur?.aim).long}${rest ? "" : `, ${cur.minutes} minutes`}`}
            className={`relative flex-1 min-w-[46px] sm:min-w-[52px] flex flex-col items-center gap-1 rounded-xl px-1 pt-1.5 pb-2 transition-colors select-none
                ${highlight ? "bg-chart-4/10" : "hover:bg-secondary/70"}`}>
            <span className={`text-[10px] font-extrabold uppercase tracking-wide ${firstOfMonth ? "text-foreground" : "text-muted-foreground"}`}>
                {firstOfMonth ? fmtDate(day, "MMM") : fmtDate(day, "EEEEE")}
            </span>
            <span className="font-display font-extrabold text-sm text-foreground tabular-nums leading-none">{fmtDate(day, "d")}</span>
            {/* Another assessment that day: a diamond, so it is a shape and not
                only a colour. */}
            <span className="h-3.5 flex items-center" aria-hidden>
                {others?.length > 0 && (
                    <span className="w-2.5 h-2.5 rotate-45 bg-xp rounded-[2px]" title={others.map((a) => `${a.subject_name}: ${a.title}`).join(", ")} />
                )}
            </span>
            {/* A TRACK behind the bar, or a bar alone reads as a blob: the
                height only means something against the height it could be. */}
            <span className="relative w-[46%] max-w-[26px] rounded-lg bg-secondary flex items-end overflow-hidden" style={{ height: BAR_H }}>
                <motion.span
                    initial={false}
                    animate={{ height: h }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={`w-full rounded-lg ${st.fill} flex items-start justify-center`}>
                    {!rest && h >= 18 && <Icon className="w-3 h-3 mt-1 text-white/90" strokeWidth={2.75} />}
                </motion.span>
            </span>
            <span className={`text-[11px] font-bold tabular-nums ${rest ? "text-muted-foreground/60" : "text-foreground"}`}>
                {rest ? "rest" : `${cur.minutes}m`}
            </span>
            {/* What is already planned that day, as dots — the reason a day is
                short is visible on the day. */}
            <span className="h-1.5 flex items-center gap-0.5" aria-hidden>
                {(existing || []).slice(0, 4).map((s) => (
                    <span key={s.id} className={`w-1.5 h-1.5 rounded-full ${s.done ? "bg-primary" : "bg-muted-foreground/45"}`} />
                ))}
            </span>
            {/* Once built, what the plan put on this day — a glyph per session,
                in the technique's own shape. */}
            {plans != null && (
                <span className="h-4 flex items-center gap-0.5 text-chart-4" aria-hidden>
                    {(sessions || []).slice(0, 2).map((s, i) => {
                        const T = TECH_ICON[s.technique] || Clock;
                        return <T key={i} className="w-3.5 h-3.5" strokeWidth={2.5} />;
                    })}
                </span>
            )}
            {isLast && <span className="sr-only">Day before the assessment</span>}
        </button>
    );
}

// ─── The page ────────────────────────────────────────────────────────────────

export default function Strategise() {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const today = dayKey(new Date());

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState({
        profile: null, assessments: [], plans: [], flashcards: [], quizzes: [], attempts: [], userSubjects: [],
    });

    const [sacId, setSacId] = useState(() => new URLSearchParams(location.search).get("id"));
    const [offIds, setOffIds] = useState(() => new Set());
    const [custom, setCustom] = useState([]);
    const [draft, setDraft] = useState("");
    const [confidence, setConfidence] = useState(3);
    const [format, setFormat] = useState("mixed");
    const [dayPlan, setDayPlan] = useState({});
    const [brush, setBrush] = useState({ aim: "drill", minutes: DEFAULT_MINUTES });
    const [busy, setBusy] = useState(false);
    const [plan, setPlan] = useState(null);
    const [focusDay, setFocusDay] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const me = await base44.auth.me();
                const fail = () => [];
                const [profiles, assessments, plans, flashcards, quizzes, attempts, userSubjects] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: me.email }).catch(fail),
                    base44.entities.SubjectAssessment.filter({ created_by: me.email }, "due_date").catch(fail),
                    base44.entities.StudyPlan.filter({ created_by: me.email }).catch(fail),
                    base44.entities.Flashcard.filter({ created_by: me.email, is_active: true }).catch(fail),
                    base44.entities.Quiz.filter({ created_by: me.email }).catch(fail),
                    base44.entities.QuizAttempt.filter({ created_by: me.email }).catch(fail),
                    base44.entities.UserSubject.filter({ created_by: me.email, is_active: true }).catch(fail),
                ]);
                if (cancelled) return;
                setRows({
                    profile: profiles?.[0] || null,
                    assessments: assessments || [], plans: plans || [], flashcards: flashcards || [],
                    quizzes: quizzes || [], attempts: attempts || [], userSubjects: userSubjects || [],
                });
            } catch (err) {
                console.error("Strategise load error:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Two clear days at least: one is the SAC and one is today, which leaves
    // nothing to plan.
    const upcoming = useMemo(() => rows.assessments
        .filter((a) => !a.is_completed && a.due_date && daysFrom(today, String(a.due_date).slice(0, 10)) >= 2)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))), [rows.assessments, today]);

    // Land on the SAC the link named; otherwise the soonest. A stale id (a SAC
    // since completed or deleted) falls back rather than drawing nothing.
    const sac = useMemo(
        () => upcoming.find((a) => a.id === sacId) || upcoming[0] || null,
        [upcoming, sacId]);

    const days = useMemo(() => (sac ? runUpDays(String(sac.due_date).slice(0, 10), new Date()) : []), [sac]);
    const others = useMemo(() => otherSacsByDay(rows.assessments, days, sac?.id), [rows.assessments, days, sac]);

    const keySkills = useMemo(() => {
        const name = String(sac?.subject_name || "").toLowerCase();
        return VCE_SUBJECTS.find((s) => String(s.name).toLowerCase() === name)?.key_skills || [];
    }, [sac]);

    const evidence = useMemo(() => evidenceFor({
        subject: sac?.subject_name,
        flashcards: rows.flashcards, attempts: rows.attempts, quizzes: rows.quizzes,
        assessments: rows.assessments, keySkills, sacId: sac?.id,
        userSubject: rows.userSubjects.find((u) =>
            String(u.subject_name).toLowerCase() === String(sac?.subject_name || "").toLowerCase()) || null,
    }), [sac, rows, keySkills]);

    const chips = useMemo(
        () => [...evidence, ...custom].map((c) => ({ ...c, on: !offIds.has(c.id) })),
        [evidence, custom, offIds]);

    // Reseed the strip whenever the SAC changes. A weak-spot day is only
    // offered when there is a weak spot on file to aim it at.
    const seededFor = useRef(null);
    useEffect(() => {
        if (!sac || seededFor.current === sac.id) return;
        seededFor.current = sac.id;
        const hasWeak = evidence.some((c) => ["weak", "repeat", "open", "terms"].includes(c.kind));
        setDayPlan(seedAims(days, { hasWeak, blocked: Object.keys(others) }));
        setOffIds(new Set());
        setCustom([]);
        setPlan(null);
        setFocusDay(null);
    }, [sac, days, others, evidence]);

    const legacy = useMemo(() => activeStrategies(rows.plans, rows.assessments, today), [rows.plans, rows.assessments, today]);
    const replacing = useMemo(
        () => sessionsToReplace(rows.plans, sac?.id, { today, legacy, stratIdOf }),
        [rows.plans, sac, today, legacy]);
    const existing = useMemo(
        () => existingByDay(rows.plans, days, { exclude: replacing, minutesOf: durationOf }),
        [rows.plans, days, replacing]);

    const totals = runUpTotals(days, dayPlan);
    const access = canUseFeature(rows.profile, FEATURES.ROADMAP_AI_GEN);

    // What the plan was built from. A change after building leaves the plan on
    // screen and says so, rather than throwing away chips the student spent.
    const signature = JSON.stringify([sac?.id, confidence, format, dayPlan,
        chips.filter((c) => c.on).map((c) => c.id)]);
    const stale = !!plan && plan.signature !== signature;

    // ─── Painting ────────────────────────────────────────────────────────
    const painting = useRef(false);
    const lastPointer = useRef(null);
    useEffect(() => {
        const stop = () => { painting.current = false; };
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        return () => {
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
        };
    }, []);
    const paint = useCallback((d) => setDayPlan((p) => paintDay(p, d, brush)), [brush]);

    // A mouse paints on press and while dragged across. A finger paints on
    // TAP only — a drag on a phone is the strip scrolling, and painting every
    // day a thumb passed over would be the strip arguing with the scroll.
    const cellHandlers = (d) => ({
        onPaintStart: (e) => {
            lastPointer.current = e.pointerType;
            if (e.pointerType !== "mouse" || e.button !== 0) return;
            painting.current = true;
            paint(d);
        },
        onPaintOver: () => { if (painting.current) paint(d); },
        onPress: () => {
            if (plan) setFocusDay(d);
            if (lastPointer.current === "mouse") { lastPointer.current = null; return; }
            lastPointer.current = null;
            paint(d);
        },
    });

    const toggle = (id) => setOffIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const addCustom = () => {
        const chip = customChip(draft, chips);
        if (!chip) {
            if (draft.trim()) toast({ title: "Couldn't add that", description: "It's already on the list, too long, or you've added four already." });
            return;
        }
        setCustom((c) => [...c, chip]);
        setDraft("");
    };

    // ─── Building and saving ─────────────────────────────────────────────
    const build = async () => {
        if (!sac || !totals.studyDays || busy) return;
        if (!access.allowed) return;
        setBusy(true);
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: "roadmap_ai_gen",
                prompt: planBrief({ sac, confidence, format, evidence: chips, days, plan: dayPlan, existing }),
                response_json_schema: PLAN_SCHEMA,
            });
            const raw = (res?.data ?? res)?.sessions || [];
            const chosen = studyDays(days, dayPlan);
            const minutesByDay = Object.fromEntries(chosen.map((d) => [d, dayPlan[d].minutes]));
            const ruled = applyRules(raw, { days, availableDays: chosen, minutesByDay, confidence });
            if (!ruled.sessions.length) throw new Error("The plan came back empty. Nothing was spent on a plan you can't use — try again.");
            setPlan({ ...ruled, signature });
            setFocusDay(null);
        } catch (e) {
            toast({ title: "Couldn't build the plan", description: e.message, variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        if (!plan?.sessions?.length || busy) return;
        setBusy(true);
        try {
            const stratId = strategyIdFor(sac.id);
            // One insert. A strategy to a SAC three weeks out is twenty-odd
            // sessions, and every one of them used to be its own request.
            await base44.entities.StudyPlan.bulkCreate(plan.sessions.map((s) => ({
                title: `${TECHNIQUES[s.technique].label}: ${s.topic}`,
                subject_name: sac.subject_name || null,
                date: s.date,
                start_time: null,
                is_completed: false,
                notes: buildNotes(null, s.duration, s.why, stratId),
            })));
            // The old plan goes only AFTER the new one has landed, so a failed
            // write leaves the student with the plan they had rather than none.
            const gone = await Promise.allSettled(replacing.map((p) => base44.entities.StudyPlan.delete(p.id)));
            const kept = gone.filter((g) => g.status === "rejected").length;
            toast({
                variant: "success",
                title: "Plan added to your planner",
                description: `${plan.sessions.length} sessions through to ${fmtDate(sac.due_date, "EEE d MMM")}.`
                    + (kept ? ` ${kept} from your last plan couldn't be removed — clear them on the planner.` : ""),
            });
            navigate(createPageUrl("Goals"));
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    const sessionsByDay = useMemo(() => {
        const out = {};
        for (const s of plan?.sessions || []) (out[s.date] ||= []).push(s);
        return out;
    }, [plan]);

    // A tapped day in plan mode brings its sessions into view.
    useEffect(() => {
        if (!focusDay) return;
        document.querySelector(`[data-plan-day="${focusDay}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [focusDay]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <AceShuffle size="lg" />
            </div>
        );
    }

    const back = (
        <Link to={createPageUrl("Goals")}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Planner
        </Link>
    );

    if (!sac) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
                    {back}
                    <div className="max-w-xl">
                        <p className="stat-label text-chart-4 mb-1.5">Strategise</p>
                        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                            Strategise plans the run-up to one assessment
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            Track a SAC on the planner at least two days out and it will be here, with what your own
                            cards, mistakes and marks say about it.
                        </p>
                        <Button onClick={() => navigate(createPageUrl("Goals"))} className="mt-4 gap-1.5">
                            <Flag className="w-4 h-4" /> Track a SAC on the planner
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const until = daysFrom(today, String(sac.due_date).slice(0, 10));
    const topicChips = chips.filter((c) => !c.context);
    // "Built from your own work" is only true when something on the list IS
    // their own work — the course outline alone is the study design's.
    const ownWork = chips.some((c) => !["untouched", "custom"].includes(c.kind));
    const contextChips = chips.filter((c) => c.context);
    const summary = plan ? planSummary(plan.sessions) : null;
    const principles = plan
        ? ["metacognition", ...new Set(plan.sessions.map((s) => s.principle))]
            .filter((k, i, all) => PRINCIPLES[k] && all.indexOf(k) === i)
        : [];

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8">
                {back}

                {/* ── The assessment ─────────────────────────────────────── */}
                <header data-strategise-block="head">
                    <p className="stat-label text-chart-4 mb-1.5">Strategise</p>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1] text-balance">
                        {until} days to {sac.title || "your assessment"}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        {sac.subject_name} · {fmtDate(sac.due_date, "EEEE d MMMM")}
                    </p>
                    {upcoming.length > 1 && (
                        <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
                            <div className="flex gap-2 w-max">
                                {upcoming.map((a) => {
                                    const on = a.id === sac.id;
                                    return (
                                        <button key={a.id} type="button" onClick={() => setSacId(a.id)} aria-pressed={on}
                                            className={`rounded-xl border-2 px-3 py-1.5 text-left transition-colors ${
                                                on ? "border-chart-4 bg-chart-4/10" : "border-border hover:border-muted-foreground/40"}`}>
                                            <span className={`block text-xs font-extrabold ${on ? "text-chart-4" : "text-foreground"}`}>{a.subject_name}</span>
                                            <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                                                {a.title} · {daysFrom(today, String(a.due_date).slice(0, 10))}d
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </header>

                {/* ── What the app already knows ─────────────────────────── */}
                <Band title="What your work says">
                    <p className="text-sm text-muted-foreground -mt-2 max-w-2xl">
                        {ownWork
                            ? "Built from your own cards, mistakes, quizzes and marks in this subject. Untick anything that's wrong, and add what we can't see."
                            : topicChips.length
                                ? `Nothing of yours in ${sac.subject_name} is on file yet, so this is the study design's outline. Untick what you've covered in class, and add what you know is shaky.`
                                : `Nothing in ${sac.subject_name} is on file yet, so the plan will cover the course. Add anything you already know is shaky.`}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2" data-strategise-block="evidence">
                        {[...topicChips, ...contextChips].map((c) => (
                            <EvidenceChip key={c.id} chip={c} on={c.on} onToggle={() => toggle(c.id)} />
                        ))}
                        <form onSubmit={(e) => { e.preventDefault(); addCustom(); }}
                            className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-2 py-1.5">
                            <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={CUSTOM_LEN}
                                placeholder="Add your own — e.g. graphs in the extended response"
                                className="border-0 shadow-none focus-visible:ring-0 h-8 px-1.5 text-sm bg-transparent" />
                            <Button type="submit" size="sm" variant="ghost" disabled={!draft.trim()} className="gap-1 flex-shrink-0">
                                <Plus className="w-4 h-4" /> Add
                            </Button>
                        </form>
                    </div>
                    {/* Stacked, not side by side: at half the column, four
                        confidence cells truncated "Barely started" mid-word. */}
                    <div className="grid gap-5 pt-1 max-w-3xl">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">How well do you know it already?</p>
                            <Segmented tone="chart4" size="sm" value={confidence} onChange={setConfidence}
                                options={CONFIDENCE.map((c) => ({ value: c.v, label: c.label }))} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">What sort of assessment is it?</p>
                            <div className="flex flex-wrap gap-1.5">
                                {SAC_FORMATS.map((f) => (
                                    <button key={f.id} type="button" onClick={() => setFormat(f.id)} aria-pressed={format === f.id}
                                        className={`rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold transition-colors ${
                                            format === f.id ? "border-chart-4 bg-chart-4/10 text-chart-4"
                                                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"}`}>
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </Band>

                {/* ── The run-up ─────────────────────────────────────────── */}
                <Band title="The run-up"
                    aside={(
                        <button type="button"
                            onClick={() => setDayPlan(seedAims(days, {
                                hasWeak: evidence.some((c) => ["weak", "repeat", "open", "terms"].includes(c.kind)),
                                blocked: Object.keys(others),
                            }))}
                            className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground whitespace-nowrap">
                            <RotateCcw className="w-3.5 h-3.5" /> Start over
                        </button>
                    )}>
                    <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-6 -mt-1">
                        <div className="space-y-1.5 min-w-0">
                            <p className="text-xs font-bold text-muted-foreground">Pick what a day is for, then tap the days</p>
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Aim to paint">
                                {AIMS.map((a) => {
                                    const st = AIM_STYLE[a.id];
                                    const on = brush.aim === a.id;
                                    return (
                                        <button key={a.id} type="button" role="radio" aria-checked={on} title={a.hint}
                                            onClick={() => setBrush((b) => ({ ...b, aim: a.id }))}
                                            className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold transition-colors ${
                                                on ? st.brush : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"}`}>
                                            <span className={`w-2.5 h-2.5 rounded-[3px] ${st.fill}`} aria-hidden />
                                            {a.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-muted-foreground">For how long</p>
                            <div className={`flex gap-1.5 ${brush.aim === "rest" ? "opacity-40 pointer-events-none" : ""}`}>
                                {MINUTE_STEPS.map((m) => (
                                    <button key={m} type="button" onClick={() => setBrush((b) => ({ ...b, minutes: m }))}
                                        aria-pressed={brush.minutes === m}
                                        className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold tabular-nums transition-colors ${
                                            brush.minutes === m ? "bg-foreground border-foreground text-background"
                                                : "border-border text-muted-foreground hover:text-foreground"}`}>
                                        {m}m
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div data-strategise-block="strip"
                        className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto touch-pan-x">
                        <div className="flex items-stretch gap-0.5 min-w-full w-max sm:w-full">
                            {days.map((d, i) => (
                                <DayCell key={d} day={d} cur={dayPlan[d]} existing={existing[d]} others={others[d]}
                                    sessions={sessionsByDay[d]} plans={plan ? plan.sessions : null}
                                    isLast={i === days.length - 1}
                                    highlight={plan && focusDay === d}
                                    {...cellHandlers(d)} />
                            ))}
                            {/* The assessment itself closes the strip. */}
                            <div className="flex-1 min-w-[46px] sm:min-w-[52px] flex flex-col items-center gap-1 rounded-xl px-1 pt-1.5 pb-2 bg-chart-4/10">
                                <span className="text-[10px] font-extrabold uppercase tracking-wide text-chart-4">{fmtDate(sac.due_date, "EEEEE")}</span>
                                <span className="font-display font-extrabold text-sm text-chart-4 tabular-nums leading-none">{fmtDate(sac.due_date, "d")}</span>
                                <span className="h-3.5" />
                                <span className="flex items-end justify-center" style={{ height: BAR_H }}>
                                    <Flag className="w-5 h-5 text-chart-4 mb-1" />
                                </span>
                                <span className="text-[11px] font-extrabold text-chart-4">SAC</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/45" /> already on your planner</span>
                        {Object.keys(others).length > 0 && (
                            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rotate-45 bg-xp rounded-[2px]" /> another assessment — starts as rest</span>
                        )}
                        <span>Bar height is the minutes.</span>
                    </div>
                </Band>

                {/* ── The plan ───────────────────────────────────────────── */}
                <AnimatePresence initial={false}>
                    {plan && (
                        <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <Band title="Your plan"
                                aside={summary && (
                                    <span className="text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                                        {summary.sessions} sessions · {Math.round(summary.totalMinutes / 6) / 10}h · {summary.kinds} techniques
                                    </span>
                                )}>
                                {stale && (
                                    <p className="text-sm text-foreground flex items-start gap-2 -mt-1">
                                        <Info className="w-4 h-4 text-xp mt-0.5 flex-shrink-0" />
                                        You've changed things since this was built. Rebuild to fold them in, or add this one as it is.
                                    </p>
                                )}
                                {plan.fixes.length > 0 && (
                                    <div className="border-l-2 border-chart-4/40 pl-3 space-y-0.5">
                                        <p className="text-xs font-bold text-muted-foreground">Adjusted to keep the plan sound</p>
                                        {plan.fixes.map((f, i) => <p key={i} className="text-xs text-muted-foreground leading-snug">{f}</p>)}
                                    </div>
                                )}
                                <div className="divide-y divide-border border-y border-border" data-strategise-block="plan">
                                    {Object.entries(sessionsByDay).map(([d, list]) => (
                                        <div key={d} data-plan-day={d}
                                            className={`grid grid-cols-[4.5rem_1fr] sm:grid-cols-[6.5rem_1fr] gap-3 py-3 transition-colors ${focusDay === d ? "bg-chart-4/[0.06]" : ""}`}>
                                            <div>
                                                <p className="text-xs font-extrabold text-chart-4">{fmtDate(d, "EEE")}</p>
                                                <p className="font-display font-extrabold text-foreground text-sm">{fmtDate(d, "d MMM")}</p>
                                            </div>
                                            <div className="space-y-2.5 min-w-0">
                                                {list.map((s, i) => {
                                                    const TIcon = TECH_ICON[s.technique] || Clock;
                                                    return (
                                                        <div key={i} className="min-w-0">
                                                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                                <TIcon className="w-3.5 h-3.5" />
                                                                {TECHNIQUES[s.technique].label} · {s.duration}m
                                                                {PRINCIPLES[s.principle] && (
                                                                    <span className="pill bg-secondary text-muted-foreground ml-1" title={PRINCIPLES[s.principle].claim}>
                                                                        {PRINCIPLES[s.principle].name}
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="font-bold text-foreground mt-0.5 leading-snug">{s.topic}</p>
                                                            <p className="text-sm text-muted-foreground leading-snug">{s.why}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* The reasoning, named and sourced. A plan that says
                                    "trust me" is indistinguishable from a guess. */}
                                <details className="group">
                                    <summary className="text-sm font-bold text-foreground cursor-pointer list-none flex items-center gap-2">
                                        <span className="w-4 h-4 inline-flex items-center justify-center rounded border border-border text-[10px] group-open:rotate-90 transition-transform">›</span>
                                        Why the plan looks like this
                                    </summary>
                                    <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                                        {principles.map((k) => (
                                            <div key={k}>
                                                <p className="text-xs font-bold text-foreground">{PRINCIPLES[k].name}</p>
                                                <p className="text-xs text-muted-foreground leading-snug">{PRINCIPLES[k].claim}</p>
                                                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{PRINCIPLES[k].source}</p>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </Band>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── The footer: what this builds, what it costs ─────────────
                    `pr-24` below xl is the Ace launcher's corner. It is fixed
                    bottom-right and sat squarely on the Build button at every
                    width until the content column clears it at 1280. */}
                <div data-strategise-block="footer"
                    className="sticky bottom-[5.25rem] md:bottom-4 z-20 card-soft on-table p-3 sm:p-4 pr-24 xl:pr-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground tabular-nums">
                            {totals.studyDays} study day{totals.studyDays === 1 ? "" : "s"} · {Math.round(totals.minutes / 6) / 10}h
                            <span className="text-muted-foreground font-medium"> · {totals.restDays} rest</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                            {!access.allowed
                                ? "Strategise builds the plan with AI, which is part of Premium. Everything above is yours to look at either way."
                                : replacing.length > 0
                                    ? `Replaces the ${replacing.length} session${replacing.length === 1 ? "" : "s"} still to come from your last plan for this SAC. Done ones stay.`
                                    : plan ? "Nothing goes on your planner until you add it." : `Building costs ${priceLabel("roadmap_ai_gen")}.`}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                        {!access.allowed ? (
                            <Button asChild className="flex-1 sm:flex-none gap-1.5">
                                <Link to={createPageUrl("Subscription")}><Lock className="w-4 h-4" /> Unlock Strategise</Link>
                            </Button>
                        ) : plan ? (
                            <>
                                <Button variant="outline" onClick={build} disabled={busy || !totals.studyDays} className="rounded-xl gap-1.5">
                                    {busy ? <AceShuffle size="sm" /> : <RotateCcw className="w-4 h-4" />} Rebuild
                                </Button>
                                <Button onClick={save} disabled={busy} className="flex-1 sm:flex-none gap-1.5">
                                    <Check className="w-4 h-4" /> Add {plan.sessions.length}<span className="hidden sm:inline"> to my planner</span>
                                </Button>
                            </>
                        ) : (
                            <Button onClick={build} disabled={busy || !totals.studyDays} className="flex-1 sm:flex-none gap-1.5"
                                title={!totals.studyDays ? "Every day is rest — paint at least one study day." : undefined}>
                                {busy ? <AceShuffle size="sm" /> : null}
                                {totals.studyDays ? `Build my plan · ${priceLabel("roadmap_ai_gen")}` : "Paint a study day first"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
