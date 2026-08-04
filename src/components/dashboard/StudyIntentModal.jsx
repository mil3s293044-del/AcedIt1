import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
    BookOpen, Zap, Brain, Clock, CheckCircle2,
    FileQuestion, Sparkles, Play, Map, Target, ChevronRight, X, Sprout
} from "lucide-react";

// Three intent modes — Lucide icons, tokenised colours via per-mode classes
// (static Tailwind classes only — JIT can't see template strings).
const MODES = [
    {
        id:      "homework",
        Icon:    BookOpen,
        label:   "Homework",
        desc:    "I've got assignments or tasks to finish",
        // Surfaces (Direction A — /5 tint, /15 border, shadow on hover)
        wrap:    "bg-chart-3/5 border-chart-3/15 hover:border-chart-3/30",
        iconWrap:"bg-chart-3/10 text-chart-3 border-chart-3/15",
    },
    {
        id:      "cramming",
        Icon:    Zap,
        label:   "Cramming",
        desc:    "Exam or SAC coming up — need to cover content fast",
        wrap:    "bg-xp/5 border-xp/15 hover:border-xp/30",
        iconWrap:"bg-xp/10 text-xp border-xp/15",
    },
    {
        id:      "free",
        Icon:    Sprout,
        label:   "Free study",
        desc:    "No pressure — building knowledge at my own pace",
        wrap:    "bg-primary/5 border-primary/15 hover:border-primary/30",
        iconWrap:"bg-primary/10 text-primary border-primary/15",
    },
];

const RECOMMENDATIONS = {
    homework: {
        title:    "Homework mode",
        subtitle: "Let's get it done efficiently.",
        durations:[25, 45, 60],
        defaultDuration: 45,
        steps: [
            { Icon: Target,        text: "List every task you need to complete before starting." },
            { Icon: Clock,         text: "Use the Pomodoro timer — 25 minutes work, 5 minutes break." },
            { Icon: CheckCircle2,  text: "Tick off tasks as you go to keep momentum." },
            { Icon: Sparkles,      text: "Open AI Tools if you get stuck on a concept." },
        ],
        cta:       { label: "Start Pomodoro timer", link: "Study",    Icon: Play },
        secondary: { label: "Open AI tools",        link: "AITools",  Icon: Sparkles },
    },
    cramming: {
        title:    "Cram mode",
        subtitle: "High intensity. Cover the most ground.",
        durations:[45, 60, 90],
        defaultDuration: 60,
        steps: [
            { Icon: Map,           text: "Open your planner and pick off the highest-priority topics first." },
            { Icon: Brain,         text: "Use active recall — test yourself, don't just re-read." },
            { Icon: FileQuestion,  text: "Do a practice quiz after each topic to lock in the knowledge." },
            { Icon: Clock,         text: "Take a 10-minute break every 50 minutes — your brain needs it." },
        ],
        cta:       { label: "Open my planner", link: "Goals", Icon: Map },
        secondary: { label: "Take a quiz",     link: "Quizzes",      Icon: FileQuestion },
    },
    free: {
        title:    "Free study",
        subtitle: "Low pressure. Explore and build.",
        durations:[15, 25, 45],
        defaultDuration: 25,
        steps: [
            { Icon: Brain,         text: "Review flashcards for subjects you haven't touched in a while." },
            { Icon: Sparkles,      text: "Use the Concept Explainer to dig into something you're curious about." },
            { Icon: FileQuestion,  text: "Try a low-stakes quiz on a topic you feel shaky on." },
            { Icon: BookOpen,      text: "Read a study guide — no pressure, just absorb." },
        ],
        cta:       { label: "Start study session", link: "Study",   Icon: Play },
        secondary: { label: "Browse AI tools",     link: "AITools", Icon: Sparkles },
    },
};

export default function StudyIntentModal({ firstName, onDismiss, onPick, suggested }) {
    const [selected, setSelected] = useState(null);
    const [duration, setDuration] = useState(null);
    const [step, setStep]         = useState("pick"); // "pick" | "plan"

    const rec = selected ? RECOMMENDATIONS[selected.id] : null;

    // The app usually already knows what today is about — a SAC two days out,
    // sessions blocked in for this morning, or simply what this student always
    // picks. Float that one to the top rather than asking from a blank slate.
    const orderedModes = suggested?.mode
        ? [...MODES].sort((a, b) => (a.id === suggested.mode ? -1 : b.id === suggested.mode ? 1 : 0))
        : MODES;

    // Report the intent the moment it's chosen rather than on the CTA — closing
    // the modal after picking still means they told us what today is for.
    const handleModeSelect = (mode) => {
        setSelected(mode);
        const r = RECOMMENDATIONS[mode.id];
        setDuration(r.defaultDuration);
        setStep("plan");
        onPick?.({ mode: mode.id, duration: r.defaultDuration });
    };

    const handleDuration = (d) => {
        setDuration(d);
        if (selected) onPick?.({ mode: selected.id, duration: d });
    };

    const fmtDuration = (d) => (d < 60 ? `${d}m` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}m`);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1,  y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="bg-surface rounded-2xl border border-border/60 shadow-soft-lg w-full max-w-lg overflow-hidden"
            >
                {/* Header — Direction A: subtle, not gradient-heavy */}
                <div className="relative px-6 pt-6 pb-5 border-b border-border/60">
                    <button
                        onClick={onDismiss}
                        aria-label="Close"
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <p className="stat-label text-muted-foreground mb-1.5">
                        {step === "pick" ? `Hey ${firstName}` : "Plan for today"}
                    </p>
                    <h2 className="font-display font-extrabold text-foreground text-2xl tracking-tight leading-tight">
                        {step === "pick" ? "What are we studying today?" : rec?.title}
                    </h2>
                    {step === "plan" && (
                        <p className="text-muted-foreground text-sm mt-1.5">{rec?.subtitle}</p>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {step === "pick" && (
                        <motion.div
                            key="pick"
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            className="p-5 space-y-2.5"
                        >
                            {orderedModes.map((mode) => {
                                const isSuggested = suggested?.mode === mode.id;
                                return (
                                    <button
                                        key={mode.id}
                                        onClick={() => handleModeSelect(mode)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border shadow-soft transition-all duration-200 text-left group ${mode.wrap} ${isSuggested ? "ring-2 ring-primary/30" : ""}`}
                                    >
                                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${mode.iconWrap}`}>
                                            <mode.Icon className="w-5 h-5" strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-display font-extrabold text-foreground text-base">{mode.label}</p>
                                            <p className="text-sm text-muted-foreground leading-snug mt-0.5">{mode.desc}</p>
                                            {isSuggested && suggested.reason && (
                                                <span className="inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                    {suggested.reason}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-foreground transition-colors flex-shrink-0" />
                                    </button>
                                );
                            })}
                            <button
                                onClick={onDismiss}
                                className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground pt-2 transition-colors"
                            >
                                Skip for now
                            </button>
                        </motion.div>
                    )}

                    {step === "plan" && rec && (
                        <motion.div
                            key="plan"
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            className="p-5 space-y-5"
                        >
                            {/* Duration picker */}
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">How long?</p>
                                <div className="flex flex-wrap gap-2">
                                    {rec.durations.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => handleDuration(d)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold border shadow-soft transition-colors ${
                                                duration === d
                                                    ? "bg-primary border-primary text-primary-foreground"
                                                    : "bg-surface border-border/60 text-foreground hover:border-primary/40"
                                            }`}
                                        >
                                            {fmtDuration(d)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Steps */}
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Your plan</p>
                                <div className="space-y-2">
                                    {rec.steps.map((s, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                                            <div className="w-7 h-7 rounded-lg bg-surface border border-border/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <s.Icon className="w-3.5 h-3.5 text-foreground" strokeWidth={2.5} />
                                            </div>
                                            <p className="text-sm text-foreground leading-snug">{s.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* CTAs */}
                            <div className="flex flex-col gap-2 pt-1">
                                <Link to={createPageUrl(rec.cta.link)} onClick={onDismiss} className="w-full">
                                    <Button className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary gap-2 h-12 text-base">
                                        <rec.cta.Icon className="w-5 h-5" />
                                        {rec.cta.label}
                                        {duration && (
                                            <span className="ml-1 bg-primary-foreground/20 rounded-md px-2 py-0.5 text-xs font-bold">
                                                {fmtDuration(duration)}
                                            </span>
                                        )}
                                    </Button>
                                </Link>
                                <Link to={createPageUrl(rec.secondary.link)} onClick={onDismiss} className="w-full">
                                    <Button variant="outline" className="w-full gap-2 border-border/60">
                                        <rec.secondary.Icon className="w-4 h-4" />
                                        {rec.secondary.label}
                                    </Button>
                                </Link>
                                <button
                                    onClick={() => setStep("pick")}
                                    className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors text-center pt-1"
                                >
                                    ← Change mode
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}
