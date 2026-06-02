// ════════════════════════════════════════════════════════════════════════════
// Pre-signup onboarding wizard
//
// Flow: Landing → /onboarding (this) → Google OAuth → Dashboard (personalised)
//
// 8 steps, ~90 seconds:
//   1. Year level
//   2. Subjects
//   3. ATAR target (optional)
//   4. Course / uni (optional)
//   5. Personalised plan reveal      ← marketing
//   6. Cost comparison               ← marketing
//   7. Premium value stack           ← marketing
//   8. Sign in → trial / free
//
// Wizard answers are saved to localStorage on every change. After Google
// OAuth completes, AuthContext reads them back and writes to user_profile
// + user_subjects (see authPostSignupApply in AuthContext.jsx).
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
    ChevronLeft, ChevronRight, ArrowRight, Check, X, Search, Plus,
    GraduationCap, BookOpen, Target, MapPin, Sparkles, Crown, Zap,
    Brain, Layers, Trophy, BarChart3, FileQuestion, Clock, Map as MapIcon, Info,
    Mail, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

const TOTAL_STEPS = 8;
const STORAGE_KEY = "acedit_onboarding_v1";

const YEAR_LEVELS = [
    { value: "Year 7",            label: "Year 7",   sub: "Junior secondary" },
    { value: "Year 8",            label: "Year 8",   sub: "Junior secondary" },
    { value: "Year 9",            label: "Year 9",   sub: "Junior secondary" },
    { value: "Year 10",           label: "Year 10",  sub: "Senior foundation" },
    { value: "Year 11 Units 1&2", label: "Year 11",  sub: "VCE Units 1 & 2" },
    { value: "Year 12 Units 3&4", label: "Year 12",  sub: "VCE Units 3 & 4 — counts toward ATAR" },
];

// Younger years (Year 7-10) won't see most of their subjects in the VCE catalog.
// We show a hint nudging them toward the custom-subject flow.
function isPreVceYear(yearLevel) {
    return yearLevel && (yearLevel.startsWith("Year 7") || yearLevel.startsWith("Year 8") || yearLevel.startsWith("Year 9"));
}

// Pricing snapshot (AUD per week) — verifiable industry numbers as of 2026.
// All sources documented in the marketing copy of step 6.
const PRICING = {
    tutor:      { label: "Private VCE tutor",  weekly: 80,  note: "1 hour per week, Melbourne median" },
    edroloOne:  { label: "Edrolo (per subject)",weekly: 6,  note: "≈ $300/year per subject" },
    chatgpt:    { label: "ChatGPT Plus",       weekly: 7,  note: "USD $20/month, not VCE-specific" },
    acedit:     { label: "AcedIt Premium",     weekly: 5,  note: "All AI tools, every subject" },
};

// ─── Wizard state ────────────────────────────────────────────────────────────
const DEFAULT_ANSWERS = {
    yearLevel:       null,
    subjects:        [],         // [{ name, code, id }]
    goalAtar:        null,
    goalCourseName:  "",
    goalUniversity:  "",
    intent:          null,       // "premium" | "free" — set on step 8
    completedAt:     null,
    email:           null,       // set on email+password path only — used as
                                 // the AuthContext email-match guard so the
                                 // 7-day storage window can't leak to a
                                 // different user on a shared browser.
};

function loadAnswers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_ANSWERS };
        return { ...DEFAULT_ANSWERS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_ANSWERS };
    }
}

function saveAnswers(answers) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); }
    catch { /* localStorage full or disabled — silent */ }
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Onboarding() {
    const [step, setStep] = useState(1);
    const [answers, setAnswers] = useState(() => loadAnswers());
    const navigate = useNavigate();

    // Persist on every change.
    useEffect(() => { saveAnswers(answers); }, [answers]);

    // Already signed in? Skip the wizard entirely.
    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (data?.session?.user) navigate("/", { replace: true });
            } catch { /* ignore */ }
        })();
    }, [navigate]);

    const update = (patch) => setAnswers((a) => ({ ...a, ...patch }));
    const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    const goBack = () => setStep((s) => Math.max(1, s - 1));

    const canContinueByStep = {
        1: !!answers.yearLevel,
        2: answers.subjects.length > 0,
        3: true,
        4: true,
        5: true,
        6: true,
        7: true,
        8: !!answers.intent,
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Progress strip */}
            <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60">
                <div className="max-w-2xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
                    {step > 1 && (
                        <button
                            type="button"
                            onClick={goBack}
                            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                            aria-label="Back"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="flex-1 flex items-center gap-1">
                        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                            <div
                                key={n}
                                className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`}
                            />
                        ))}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground tabular-nums w-10 text-right">{step}/{TOTAL_STEPS}</span>
                </div>
            </header>

            {/* Step content */}
            <main className="flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                        className="flex-1 flex flex-col"
                    >
                        {step === 1 && <Step1Year answers={answers} update={update} onNext={goNext} />}
                        {step === 2 && <Step2Subjects answers={answers} update={update} onNext={goNext} canContinue={canContinueByStep[2]} />}
                        {step === 3 && <Step3Atar answers={answers} update={update} onNext={goNext} />}
                        {step === 4 && <Step4Course answers={answers} update={update} onNext={goNext} />}
                        {step === 5 && <Step5PlanReveal answers={answers} onNext={goNext} />}
                        {step === 6 && <Step6Comparison answers={answers} onNext={goNext} />}
                        {step === 7 && <Step7Premium onNext={goNext} />}
                        {step === 8 && <Step8Signin answers={answers} update={update} />}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}

// ─── Shared layout helpers ───────────────────────────────────────────────────
function StepShell({ eyebrow, title, subtitle, children, footer }) {
    return (
        <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
            <div className="mb-6 lg:mb-8">
                {eyebrow && <p className="stat-label text-primary mb-2">{eyebrow}</p>}
                <h1 className="font-display font-extrabold text-foreground text-3xl lg:text-4xl tracking-tight leading-[1.1]">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-muted-foreground text-base lg:text-lg mt-2 leading-relaxed">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className="flex-1">{children}</div>
            {footer && <div className="mt-6 lg:mt-8">{footer}</div>}
        </div>
    );
}

function PrimaryCTA({ children, disabled, onClick, fullWidth = true }) {
    return (
        <Button
            onClick={onClick}
            disabled={disabled}
            className={`btn-3d bg-primary text-primary-foreground hover:bg-primary h-12 text-base ${fullWidth ? "w-full" : ""}`}
        >
            {children}
        </Button>
    );
}

function SkipLink({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mx-auto block py-2"
        >
            Skip for now
        </button>
    );
}

// ═══ STEP 1 — Year level ════════════════════════════════════════════════════
function Step1Year({ answers, update, onNext }) {
    return (
        <StepShell
            eyebrow="About you · 1 of 4"
            title="What year are you in?"
            subtitle="This shapes the recommendations you'll get."
        >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {YEAR_LEVELS.map((yl) => {
                    const selected = answers.yearLevel === yl.value;
                    return (
                        <button
                            key={yl.value}
                            onClick={() => { update({ yearLevel: yl.value }); setTimeout(onNext, 200); }}
                            className={`text-left p-4 sm:p-5 rounded-2xl border shadow-soft transition-all ${
                                selected
                                    ? "bg-primary/10 border-primary/40 ring-2 ring-primary/40"
                                    : "bg-surface border-border/60 hover:border-primary/30"
                            }`}
                        >
                            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-3">
                                <GraduationCap className="w-4 h-4 text-primary" strokeWidth={2.5} />
                            </div>
                            <p className="font-display font-extrabold text-foreground text-base sm:text-lg">{yl.label}</p>
                            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-snug">{yl.sub}</p>
                        </button>
                    );
                })}
            </div>
        </StepShell>
    );
}

// ═══ STEP 2 — Subjects ══════════════════════════════════════════════════════
function Step2Subjects({ answers, update, onNext, canContinue }) {
    const [query, setQuery] = useState("");
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customName, setCustomName] = useState("");
    const [customCode, setCustomCode] = useState("");

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return VCE_SUBJECTS;
        return VCE_SUBJECTS.filter(s =>
            s.name.toLowerCase().includes(q) || (s.code || "").toLowerCase().includes(q)
        );
    }, [query]);

    const toggle = (sub) => {
        const exists = answers.subjects.find(x => x.code === sub.code);
        if (exists) {
            update({ subjects: answers.subjects.filter(x => x.code !== sub.code) });
        } else {
            update({ subjects: [...answers.subjects, { id: sub.id, name: sub.name, code: sub.code, is_custom: !!sub.is_custom }] });
        }
    };

    const addCustom = () => {
        const name = customName.trim();
        const code = (customCode.trim() || name.slice(0, 12).replace(/\s+/g, "_")).toUpperCase();
        if (!name) return;
        // Avoid duplicate codes with existing picks.
        const exists = answers.subjects.find(x => x.code === code);
        if (exists) {
            setCustomName(""); setCustomCode(""); setShowCustomForm(false);
            return;
        }
        update({
            subjects: [
                ...answers.subjects,
                { id: `custom_${Date.now()}`, name, code, is_custom: true },
            ],
        });
        setCustomName(""); setCustomCode(""); setShowCustomForm(false);
    };

    const youngerYear = isPreVceYear(answers.yearLevel);
    const customsPicked = answers.subjects.filter(s => s.is_custom);

    return (
        <StepShell
            eyebrow="About you · 2 of 4"
            title="What subjects are you taking?"
            subtitle="Pick what you study. You can change these later."
            footer={
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-foreground">
                            {answers.subjects.length} selected
                            {customsPicked.length > 0 && (
                                <span className="text-muted-foreground font-medium ml-1">· {customsPicked.length} custom</span>
                            )}
                        </span>
                        {answers.subjects.length > 0 && (
                            <button
                                onClick={() => update({ subjects: [] })}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                    <PrimaryCTA onClick={onNext} disabled={!canContinue}>
                        Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </PrimaryCTA>
                </div>
            }
        >
            {/* Contextual hint for pre-VCE years */}
            {youngerYear && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-chart-3/5 border border-chart-3/15 p-3">
                    <Info className="w-4 h-4 text-chart-3 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <p className="text-xs text-foreground leading-relaxed">
                        Below are VCE subjects — most Year 7–10 subjects aren't here.
                        Use <span className="font-bold">“Add your own”</span> for things like Maths, English, Science, History, Geography, etc.
                    </p>
                </div>
            )}

            <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${VCE_SUBJECTS.length} VCE subjects…`}
                    className="pl-9 h-11"
                />
            </div>

            {/* Custom subjects the user has added — pinned at top so they're visible */}
            {customsPicked.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {customsPicked.map((sub) => (
                        <button
                            key={sub.id}
                            onClick={() => toggle(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-chart-4/10 border border-chart-4/20 text-chart-4 text-xs font-bold hover:bg-chart-4/15 transition-colors"
                        >
                            <span>{sub.name}</span>
                            <X className="w-3 h-3" strokeWidth={3} />
                        </button>
                    ))}
                </div>
            )}

            {/* Inline custom-add form */}
            {showCustomForm && (
                <div className="mb-3 rounded-xl bg-chart-4/5 border border-chart-4/15 p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        <Input
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Subject name (e.g. Year 9 Science)"
                            className="col-span-2 h-10 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && addCustom()}
                        />
                        <Input
                            value={customCode}
                            onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                            placeholder="CODE (optional)"
                            className="h-10 text-sm uppercase"
                            maxLength={16}
                            onKeyDown={(e) => e.key === "Enter" && addCustom()}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={addCustom}
                            disabled={!customName.trim()}
                            size="sm"
                            className="bg-chart-4 hover:bg-chart-4/90 text-white"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add
                        </Button>
                        <button
                            type="button"
                            onClick={() => { setShowCustomForm(false); setCustomName(""); setCustomCode(""); }}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[340px] overflow-y-auto pr-1">
                {/* "Add your own" tile sits first so it's discoverable */}
                {!showCustomForm && (
                    <button
                        onClick={() => setShowCustomForm(true)}
                        className="text-left p-3 rounded-xl border border-dashed border-chart-4/40 bg-chart-4/5 hover:bg-chart-4/10 transition-all flex items-center gap-2"
                    >
                        <div className="w-7 h-7 rounded-lg bg-chart-4/15 border border-chart-4/25 flex items-center justify-center flex-shrink-0">
                            <Plus className="w-4 h-4 text-chart-4" strokeWidth={3} />
                        </div>
                        <p className="font-bold text-chart-4 text-sm leading-tight">Add your own</p>
                    </button>
                )}

                {filtered.map((sub) => {
                    const selected = !!answers.subjects.find(x => x.code === sub.code);
                    return (
                        <button
                            key={sub.id}
                            onClick={() => toggle(sub)}
                            className={`text-left p-3 rounded-xl border shadow-soft transition-all ${
                                selected
                                    ? "bg-primary/10 border-primary/40"
                                    : "bg-surface border-border/60 hover:border-primary/30"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-foreground text-sm leading-tight">{sub.name}</p>
                                {selected && <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={3} />}
                            </div>
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <p className="col-span-full text-sm text-muted-foreground py-6 text-center">
                        No VCE subjects match "{query}". Try <span className="font-bold text-chart-4">Add your own</span> above.
                    </p>
                )}
            </div>
        </StepShell>
    );
}

// ═══ STEP 3 — ATAR target ═══════════════════════════════════════════════════
function Step3Atar({ answers, update, onNext }) {
    const value = answers.goalAtar ?? 85;
    return (
        <StepShell
            eyebrow="About you · 3 of 4"
            title="What ATAR are you aiming for?"
            subtitle="Plant a flag. You can change it any time."
            footer={
                <div className="space-y-2">
                    <PrimaryCTA onClick={onNext}>
                        Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </PrimaryCTA>
                    <SkipLink onClick={() => { update({ goalAtar: null }); onNext(); }} />
                </div>
            }
        >
            <div className="card-soft p-6 lg:p-8 text-center">
                <p className="stat-label text-primary/80 mb-2">My target</p>
                <div className="font-display font-extrabold text-primary leading-none mb-6"
                     style={{ fontSize: 'clamp(4rem, 14vw, 7rem)' }}>
                    {value.toFixed(value % 1 === 0 ? 0 : 2)}
                </div>
                <input
                    type="range"
                    min={50}
                    max={99.95}
                    step={0.05}
                    value={value}
                    onChange={(e) => update({ goalAtar: parseFloat(e.target.value) })}
                    className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-semibold mt-2">
                    <span>50</span>
                    <span>75</span>
                    <span>99.95</span>
                </div>
            </div>
        </StepShell>
    );
}

// ═══ STEP 4 — Course / uni ══════════════════════════════════════════════════
function Step4Course({ answers, update, onNext }) {
    return (
        <StepShell
            eyebrow="About you · 4 of 4"
            title="Got a dream course?"
            subtitle="Optional — just plants a flag on your dashboard."
            footer={
                <div className="space-y-2">
                    <PrimaryCTA onClick={onNext}>
                        Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </PrimaryCTA>
                    <SkipLink onClick={() => { update({ goalCourseName: "", goalUniversity: "" }); onNext(); }} />
                </div>
            }
        >
            <div className="card-soft p-6 space-y-5">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" /> Course
                    </label>
                    <Input
                        value={answers.goalCourseName}
                        onChange={(e) => update({ goalCourseName: e.target.value })}
                        placeholder="e.g. Bachelor of Commerce"
                        className="h-11"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" /> University
                    </label>
                    <Input
                        value={answers.goalUniversity}
                        onChange={(e) => update({ goalUniversity: e.target.value })}
                        placeholder="e.g. University of Melbourne"
                        className="h-11"
                    />
                </div>
            </div>
        </StepShell>
    );
}

// ═══ STEP 5 — Personalised plan reveal ══════════════════════════════════════
function Step5PlanReveal({ answers, onNext }) {
    const subjectsCount = answers.subjects.length;
    const personalLine = [
        answers.yearLevel || "VCE",
        `${subjectsCount} subject${subjectsCount === 1 ? "" : "s"}`,
        answers.goalAtar ? `ATAR ${answers.goalAtar.toFixed(answers.goalAtar % 1 === 0 ? 0 : 2)}` : null,
        answers.goalCourseName ? `${answers.goalCourseName}${answers.goalUniversity ? ` at ${answers.goalUniversity}` : ""}` : null,
    ].filter(Boolean).join(" · ");

    const planItems = [
        { Icon: Brain,         text: `Daily AI quizzes tailored to your ${subjectsCount > 0 ? subjectsCount : ""} subject${subjectsCount === 1 ? "" : "s"}`.replace("  ", " ").trim() },
        { Icon: Layers,        text: "AI quiz marking with VCAA-aligned feedback" },
        { Icon: MapIcon,       text: answers.goalAtar ? `Personalised study roadmap to ATAR ${answers.goalAtar.toFixed(answers.goalAtar % 1 === 0 ? 0 : 2)}` : "Personalised study roadmap to your target" },
        { Icon: Sparkles,      text: "All 10 AI study tools (Essay Planner, Math Tutor, Concept Explainer, more)" },
    ];

    return (
        <StepShell
            eyebrow="Your plan is ready"
            title="Your AcedIt plan, ready to go"
            subtitle={personalLine}
            footer={
                <PrimaryCTA onClick={onNext}>
                    See what's included <ArrowRight className="w-4 h-4 ml-1" />
                </PrimaryCTA>
            }
        >
            <div className="card-soft p-6 lg:p-7 space-y-3">
                {planItems.map((item, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.08 }}
                        className="flex items-start gap-3"
                    >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                            <item.Icon className="w-5 h-5 text-primary" strokeWidth={2.5} />
                        </div>
                        <p className="text-foreground text-sm lg:text-base leading-snug mt-1.5 font-medium">
                            {item.text}
                        </p>
                    </motion.div>
                ))}
            </div>
        </StepShell>
    );
}

// ═══ STEP 6 — Cost comparison ═══════════════════════════════════════════════
function Step6Comparison({ answers, onNext }) {
    const subjectsCount = Math.max(1, answers.subjects.length);
    const edroloTotal = Math.round(PRICING.edroloOne.weekly * subjectsCount);

    const bars = [
        { label: PRICING.tutor.label,    weekly: PRICING.tutor.weekly,    note: PRICING.tutor.note,   tone: "warn"   },
        { label: `Edrolo (${subjectsCount} subject${subjectsCount === 1 ? "" : "s"})`, weekly: edroloTotal, note: `${PRICING.edroloOne.note}`, tone: "warn" },
        { label: PRICING.chatgpt.label,  weekly: PRICING.chatgpt.weekly,  note: PRICING.chatgpt.note, tone: "warn"   },
        { label: PRICING.acedit.label,   weekly: PRICING.acedit.weekly,   note: PRICING.acedit.note,  tone: "good"   },
    ];
    const maxWeekly = Math.max(...bars.map(b => b.weekly));

    const tutorWeeks = Math.round(PRICING.tutor.weekly / PRICING.acedit.weekly);

    return (
        <StepShell
            eyebrow="Honest comparison"
            title="What VCE help usually costs"
            subtitle="Real industry numbers, all weekly · AUD."
            footer={
                <PrimaryCTA onClick={onNext}>
                    See what's in Premium <ArrowRight className="w-4 h-4 ml-1" />
                </PrimaryCTA>
            }
        >
            <div className="card-soft p-5 lg:p-6 space-y-4">
                {bars.map((b, i) => {
                    const pct = Math.max(4, (b.weekly / maxWeekly) * 100);
                    const isGood = b.tone === "good";
                    return (
                        <motion.div
                            key={b.label}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.05 + i * 0.06 }}
                        >
                            <div className="flex items-baseline justify-between mb-1.5">
                                <div className="min-w-0 pr-3">
                                    <p className={`font-display font-extrabold text-sm leading-tight ${isGood ? "text-primary" : "text-foreground"}`}>
                                        {b.label}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground leading-snug">{b.note}</p>
                                </div>
                                <p className={`font-display font-extrabold text-lg tabular-nums flex-shrink-0 ${isGood ? "text-primary" : "text-foreground"}`}>
                                    ${b.weekly}<span className="text-xs text-muted-foreground font-bold">/wk</span>
                                </p>
                            </div>
                            <div className="h-3 bg-muted/60 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                                    className={`h-full rounded-full ${isGood ? "bg-primary" : "bg-xp"}`}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
            <div className="mt-5 p-4 rounded-2xl bg-primary/5 border border-primary/15">
                <p className="font-display font-extrabold text-foreground text-lg leading-tight">
                    One hour with a tutor pays for <span className="text-primary">{tutorWeeks} weeks</span> of AcedIt.
                </p>
            </div>
        </StepShell>
    );
}

// ═══ STEP 7 — Premium value stack ═══════════════════════════════════════════
function Step7Premium({ onNext }) {
    const FREE_FEATURES = [
        "Pomodoro timer & study sessions",
        "Manual quizzes & flashcards (unlimited)",
        "XP, streaks, friends, leaderboards",
        "5 AI-generated quizzes (lifetime)",
        "5 AI-generated flashcard sets (lifetime)",
        "5 AI tool uses (lifetime)",
    ];
    const PREMIUM_FEATURES = [
        "Everything in Free",
        "Daily AI-generated quizzes",
        "AI quiz marking with VCAA feedback",
        "All 10 AI study tools (unlimited daily)",
        "Goal & Roadmap AI generation",
        "Spaced repetition (SM-2 algorithm)",
        "Blurting & Active Recall with AI marking",
        "Advanced analytics & performance coach",
        "Priority support",
    ];
    return (
        <StepShell
            eyebrow="The unlock"
            title="Two ways to use AcedIt"
            subtitle="Try Premium for $5/week — less than a coffee."
            footer={
                <PrimaryCTA onClick={onNext}>
                    Sign in to start <ArrowRight className="w-4 h-4 ml-1" />
                </PrimaryCTA>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Free column — visually de-emphasised */}
                <div className="card-soft p-5 lg:p-6 opacity-95">
                    <p className="stat-label text-muted-foreground mb-1">Free</p>
                    <p className="font-display font-extrabold text-foreground text-3xl mb-1">$0</p>
                    <p className="text-xs text-muted-foreground mb-4">per week</p>
                    <ul className="space-y-2">
                        {FREE_FEATURES.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <Check className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <span className="text-foreground leading-snug">{f}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                {/* Premium column — highlighted */}
                <div className="relative rounded-2xl bg-primary/5 border-2 border-primary shadow-soft p-5 lg:p-6">
                    <span className="absolute -top-3 right-4 pill bg-primary text-primary-foreground text-[10px] px-3 py-1">
                        <Crown className="w-3 h-3" /> RECOMMENDED
                    </span>
                    <p className="stat-label text-primary mb-1">Premium</p>
                    <p className="font-display font-extrabold text-foreground text-3xl mb-1">
                        $5<span className="text-base text-muted-foreground font-bold">/wk</span>
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">Cancel anytime</p>
                    <ul className="space-y-2">
                        {PREMIUM_FEATURES.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={3} />
                                <span className="text-foreground leading-snug font-medium">{f}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </StepShell>
    );
}

// ═══ STEP 8 — Sign in ═══════════════════════════════════════════════════════
// Two separate decisions, made in this order:
//   1. Plan picker — Premium (default-selected, highlighted) vs Free
//   2. Auth method — Continue with Google OR Continue with email
// Picking the email button reveals an inline form below the choice; the plan
// already chosen carries through, so the form has a single submit button.
function Step8Signin({ answers, update }) {
    const { signUpWithPassword } = useAuth();
    const [isStarting, setIsStarting] = useState(false);

    // Plan: "premium" (default) | "free"
    const [selectedPlan, setSelectedPlan] = useState(answers.intent || "premium");

    // Auth method: null (chooser visible) | "email" (form visible)
    // Google has no in-page form — clicking it redirects out, so we don't need
    // a "google" mode state.
    const [authMode, setAuthMode] = useState(null);

    // Email path form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [emailError, setEmailError] = useState(null);
    const [emailSent, setEmailSent] = useState(false);

    const personalLine = [
        answers.yearLevel,
        answers.subjects.length > 0 ? `${answers.subjects.length} subject${answers.subjects.length === 1 ? "" : "s"}` : null,
        answers.goalAtar ? `ATAR ${answers.goalAtar.toFixed(answers.goalAtar % 1 === 0 ? 0 : 2)}` : null,
        answers.goalCourseName || null,
    ].filter(Boolean).join(" · ");

    // ─── Google OAuth path ──────────────────────────────────────────────────
    const startGoogleSignIn = async () => {
        const completedAt = new Date().toISOString();
        update({ intent: selectedPlan, completedAt });
        saveAnswers({ ...answers, intent: selectedPlan, completedAt });
        setIsStarting(true);
        try {
            const redirectTo = `${window.location.origin}/`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo },
            });
            if (error) throw error;
            // Browser navigates away — code below doesn't run.
        } catch (e) {
            console.error("[onboarding] OAuth error:", e);
            setIsStarting(false);
        }
    };

    // ─── Email + password path ──────────────────────────────────────────────
    const submitEmailSignup = async () => {
        setEmailError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setEmailError("Enter a valid email address.");
            return;
        }
        if (password.length < 8) {
            setEmailError("Password needs to be at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setEmailError("Passwords don't match.");
            return;
        }

        // Stash the typed email in storage so the post-verify apply only fires
        // for THIS user (email-match guard in AuthContext).
        const completedAt = new Date().toISOString();
        const nextAnswers = { ...answers, intent: selectedPlan, completedAt, email: trimmedEmail };
        update({ intent: selectedPlan, completedAt, email: trimmedEmail });
        saveAnswers(nextAnswers);

        setIsStarting(true);
        const { ok, error } = await signUpWithPassword({
            email: trimmedEmail,
            password,
            fullName: fullName.trim() || undefined,
        });
        setIsStarting(false);

        if (!ok) {
            const msg = error?.message || "Sign-up failed. Try again in a moment.";
            // Be specific about which error we got. Surface Supabase's real
            // message for anything we don't recognise — generic "try again"
            // hides whether the SMTP / quota / email-format is actually broken.
            if (/already registered|exists/i.test(msg)) {
                setEmailError("This email already has an account. Try signing in instead.");
            } else if (/email rate limit|rate limit exceeded/i.test(msg)) {
                // This is the Supabase free-tier 3-emails-per-hour cap. Once we
                // wire Resend SMTP this should never fire in practice.
                setEmailError("Hit Supabase's email rate limit (3/hour on built-in SMTP). Wait an hour, or have Miles set up Resend SMTP.");
            } else if (/for security purposes/i.test(msg)) {
                // Supabase per-email-address cooldown: 60s between sends to same email
                setEmailError("Too soon to resend to this email — wait about a minute and try again.");
            } else if (/invalid.*email|unable to validate/i.test(msg)) {
                setEmailError("Supabase rejected that email address. Try a different one.");
            } else {
                setEmailError(msg);
            }
            return;
        }
        setEmailSent(true);
    };

    // ─── Success state: verify-email instructions ──────────────────────────
    if (emailSent) {
        return (
            <StepShell
                eyebrow="One more step"
                title="Check your inbox"
                subtitle={`We sent a verification link to ${email}. Click it to finish signing up and start studying.`}
            >
                <div className="card-soft p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-5 h-5 text-primary" strokeWidth={2.5} />
                        </div>
                        <div className="text-sm text-foreground leading-relaxed">
                            <p className="font-bold mb-1">Almost there.</p>
                            <p className="text-muted-foreground">
                                Open the email from AcedIt and tap the verification link.
                                Your subjects, goals, and plan will be ready when you land back here.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-xl bg-chart-3/5 border border-chart-3/15 p-3 text-xs text-foreground leading-relaxed">
                        <p>
                            <span className="font-bold">Already have an AcedIt account with Google?</span>{" "}
                            You won't get an email — close this tab and{" "}
                            <Link to="/login" className="text-primary font-bold hover:underline">sign in with Google</Link> instead.
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-center pt-2">
                        Can't find the email? Check spam, or{" "}
                        <button
                            type="button"
                            onClick={() => setEmailSent(false)}
                            className="font-bold text-primary hover:underline"
                        >
                            try a different email
                        </button>.
                    </p>
                </div>
            </StepShell>
        );
    }

    // ─── Default state: plan picker + auth method buttons ──────────────────
    const planSubLabel = selectedPlan === "premium"
        ? "Cancel anytime · Less than a coffee"
        : "Limited AI use · Upgrade any time";

    return (
        <StepShell
            eyebrow="Last step"
            title="Save your plan, start studying"
            subtitle="Pick your plan, then sign in to keep everything."
        >
            {/* Personal plan recap */}
            <div className="card-soft p-5 lg:p-6 mb-5">
                <p className="stat-label text-muted-foreground mb-2">Your plan</p>
                <p className="font-display font-extrabold text-foreground text-base lg:text-lg leading-tight">
                    {personalLine || "VCE student"}
                </p>
            </div>

            {/* ─── 1. Plan picker ──────────────────────────────────────────── */}
            <div className="mb-5">
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2.5">
                    Choose your plan
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {/* Premium */}
                    <button
                        type="button"
                        onClick={() => setSelectedPlan("premium")}
                        disabled={isStarting}
                        className={`relative text-left p-4 rounded-2xl border-2 shadow-soft transition-all ${
                            selectedPlan === "premium"
                                ? "bg-primary/10 border-primary"
                                : "bg-surface border-border/60 hover:border-primary/30"
                        }`}
                    >
                        {selectedPlan === "premium" && (
                            <span className="absolute -top-2 right-3 pill bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                                <Crown className="w-3 h-3" /> PICK
                            </span>
                        )}
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Crown className={`w-3.5 h-3.5 ${selectedPlan === "premium" ? "text-primary" : "text-muted-foreground"}`} strokeWidth={2.5} />
                            <span className={`text-[11px] uppercase tracking-wider font-bold ${selectedPlan === "premium" ? "text-primary" : "text-muted-foreground"}`}>
                                Premium
                            </span>
                        </div>
                        <p className="font-display font-extrabold text-foreground text-2xl leading-none">
                            $5<span className="text-sm text-muted-foreground font-bold">/wk</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">All AI tools, every subject</p>
                    </button>

                    {/* Free */}
                    <button
                        type="button"
                        onClick={() => setSelectedPlan("free")}
                        disabled={isStarting}
                        className={`text-left p-4 rounded-2xl border-2 shadow-soft transition-all ${
                            selectedPlan === "free"
                                ? "bg-foreground/[0.04] border-foreground/40"
                                : "bg-surface border-border/60 hover:border-foreground/20"
                        }`}
                    >
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`text-[11px] uppercase tracking-wider font-bold ${selectedPlan === "free" ? "text-foreground" : "text-muted-foreground"}`}>
                                Free
                            </span>
                        </div>
                        <p className="font-display font-extrabold text-foreground text-2xl leading-none">
                            $0<span className="text-sm text-muted-foreground font-bold">/wk</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">Limited AI, basic tools</p>
                    </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">{planSubLabel}</p>
            </div>

            {/* ─── 2. Auth method ──────────────────────────────────────────── */}
            {authMode === null ? (
                <div>
                    <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2.5">
                        Sign in to start
                    </p>
                    <div className="space-y-2.5">
                        {/* Google */}
                        <button
                            type="button"
                            onClick={startGoogleSignIn}
                            disabled={isStarting}
                            className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary rounded-xl px-5 h-14 flex items-center justify-center gap-2.5 font-display font-extrabold text-base disabled:opacity-60"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                                <path fill="#fff" opacity="0.95" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#fff" opacity="0.95" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
                                <path fill="#fff" opacity="0.95" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a10.99 10.99 0 0 0 0 9.86l3.66-2.84z"/>
                                <path fill="#fff" opacity="0.95" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                            </svg>
                            Continue with Google
                        </button>

                        {/* Email */}
                        <button
                            type="button"
                            onClick={() => { setAuthMode("email"); setEmailError(null); }}
                            disabled={isStarting}
                            className="w-full rounded-xl border-2 border-border bg-surface hover:bg-muted/40 px-5 h-14 flex items-center justify-center gap-2.5 font-display font-extrabold text-base text-foreground transition-colors disabled:opacity-60"
                        >
                            <Mail className="w-5 h-5" />
                            Continue with email
                        </button>
                    </div>

                    <Link
                        to="/login"
                        className="block mx-auto text-xs font-semibold text-muted-foreground hover:text-foreground pt-4 text-center"
                    >
                        Already have an account? <span className="text-primary">Sign in</span>
                    </Link>
                </div>
            ) : (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                            Sign up with email
                        </p>
                        <button
                            type="button"
                            onClick={() => { setAuthMode(null); setEmailError(null); }}
                            disabled={isStarting}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                            ← Back
                        </button>
                    </div>
                    <div className="card-soft p-4 space-y-3">
                        <div>
                            <label className="text-xs font-bold text-foreground mb-1.5 block">Full name (optional)</label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="e.g. Sienna L"
                                autoComplete="name"
                                className="h-11"
                                disabled={isStarting}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-foreground mb-1.5 block">Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                className="h-11"
                                disabled={isStarting}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-foreground mb-1.5 block">Password</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                autoComplete="new-password"
                                className="h-11"
                                disabled={isStarting}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-foreground mb-1.5 block">Confirm password</label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Type it again"
                                autoComplete="new-password"
                                className="h-11"
                                disabled={isStarting}
                            />
                        </div>
                        {emailError && (
                            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium">
                                {emailError}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={submitEmailSignup}
                        disabled={isStarting}
                        className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary rounded-xl px-5 h-14 flex items-center justify-center gap-2.5 font-display font-extrabold text-base disabled:opacity-60 mt-4"
                    >
                        {isStarting ? "Creating account…" : (
                            <>
                                {selectedPlan === "premium" ? <Crown className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                                Create account & start {selectedPlan === "premium" ? "Premium" : "Free"}
                            </>
                        )}
                    </button>

                    <Link
                        to="/login"
                        className="block mx-auto text-xs font-semibold text-muted-foreground hover:text-foreground pt-4 text-center"
                    >
                        Already have an account? <span className="text-primary">Sign in</span>
                    </Link>
                </div>
            )}
        </StepShell>
    );
}
