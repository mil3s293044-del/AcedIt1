import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
    BookOpen, Zap, Brain, Clock, CheckCircle2, ArrowRight,
    FileQuestion, Sparkles, Play, Map, Target, ChevronRight, X
} from "lucide-react";

const MODES = [
    {
        id: "homework",
        emoji: "📚",
        label: "Homework",
        desc: "I've got assignments or tasks to finish",
        color: "from-blue-500 to-indigo-600",
        bg: "bg-blue-50 border-blue-200 hover:bg-blue-100",
        selectedBg: "bg-blue-500 border-blue-600",
        tag: "bg-blue-100 text-blue-700",
    },
    {
        id: "cramming",
        emoji: "⚡",
        label: "Cramming",
        desc: "Exam or SAC coming up — need to cover content fast",
        color: "from-orange-500 to-red-500",
        bg: "bg-orange-50 border-orange-200 hover:bg-orange-100",
        selectedBg: "bg-orange-500 border-orange-600",
        tag: "bg-orange-100 text-orange-700",
    },
    {
        id: "free",
        emoji: "🌱",
        label: "Free Study",
        desc: "No pressure — building knowledge at my own pace",
        color: "from-emerald-500 to-teal-500",
        bg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
        selectedBg: "bg-emerald-500 border-emerald-600",
        tag: "bg-emerald-100 text-emerald-700",
    },
];

const DURATION_OPTIONS = [15, 25, 45, 60, 90];

const RECOMMENDATIONS = {
    homework: {
        title: "Homework Mode 📚",
        subtitle: "Let's get it done efficiently.",
        durations: [25, 45, 60],
        defaultDuration: 45,
        steps: [
            { icon: Target, text: "List every task you need to complete before starting", color: "text-blue-600", bg: "bg-blue-50" },
            { icon: Clock, text: "Use the Pomodoro timer — 25 min work, 5 min break", color: "text-indigo-600", bg: "bg-indigo-50" },
            { icon: CheckCircle2, text: "Tick off tasks as you go to keep momentum", color: "text-emerald-600", bg: "bg-emerald-50" },
            { icon: Sparkles, text: "Use AI Tools if you're stuck on a concept", color: "text-pink-600", bg: "bg-pink-50" },
        ],
        cta: { label: "Start Pomodoro Timer", link: "Study", icon: Play },
        secondary: { label: "Open AI Tools", link: "AITools", icon: Sparkles },
    },
    cramming: {
        title: "Cram Mode ⚡",
        subtitle: "High intensity. Cover the most ground.",
        durations: [45, 60, 90],
        defaultDuration: 60,
        steps: [
            { icon: Map, text: "Open your Study Roadmap to identify the highest priority topics", color: "text-orange-600", bg: "bg-orange-50" },
            { icon: Brain, text: "Use Active Recall — don't just re-read, test yourself", color: "text-red-600", bg: "bg-red-50" },
            { icon: FileQuestion, text: "Do a practice quiz after each topic to lock in the knowledge", color: "text-purple-600", bg: "bg-purple-50" },
            { icon: Clock, text: "Take a 10 min break every 50 min — your brain needs it", color: "text-blue-600", bg: "bg-blue-50" },
        ],
        cta: { label: "View My Roadmap", link: "StudyRoadmap", icon: Map },
        secondary: { label: "Take a Quiz", link: "Quizzes", icon: FileQuestion },
    },
    free: {
        title: "Free Study 🌱",
        subtitle: "Low pressure. Explore and build.",
        durations: [15, 25, 45],
        defaultDuration: 25,
        steps: [
            { icon: Brain, text: "Review flashcards for subjects you haven't touched recently", color: "text-violet-600", bg: "bg-violet-50" },
            { icon: Sparkles, text: "Use the Concept Explainer to explore something you're curious about", color: "text-pink-600", bg: "bg-pink-50" },
            { icon: FileQuestion, text: "Try a low-stakes quiz on a topic you feel shaky on", color: "text-indigo-600", bg: "bg-indigo-50" },
            { icon: BookOpen, text: "Read a Study Guide — no pressure, just absorb", color: "text-emerald-600", bg: "bg-emerald-50" },
        ],
        cta: { label: "Start Study Session", link: "Study", icon: Play },
        secondary: { label: "Browse AI Tools", link: "AITools", icon: Sparkles },
    },
};

export default function StudyIntentModal({ firstName, onDismiss }) {
    const [selected, setSelected] = useState(null);
    const [duration, setDuration] = useState(null);
    const [step, setStep] = useState("pick"); // "pick" | "plan"

    const rec = selected ? RECOMMENDATIONS[selected.id] : null;

    const handleModeSelect = (mode) => {
        setSelected(mode);
        const r = RECOMMENDATIONS[mode.id];
        setDuration(r.defaultDuration);
        setStep("plan");
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
                {/* Header */}
                <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 pb-5">
                    <button onClick={onDismiss} className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                        <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <p className="text-white/70 text-sm font-medium mb-1">Hey {firstName} 👋</p>
                    <h2 className="text-2xl font-black text-white leading-tight">
                        {step === "pick" ? "What are we studying today?" : rec?.title}
                    </h2>
                    {step === "plan" && (
                        <p className="text-white/80 text-sm mt-1">{rec?.subtitle}</p>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {step === "pick" && (
                        <motion.div
                            key="pick"
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 16 }}
                            className="p-5 space-y-3"
                        >
                            {MODES.map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => handleModeSelect(mode)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 text-left group hover:scale-[1.01] hover:shadow-md ${mode.bg}`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-2xl shadow-md flex-shrink-0`}>
                                        {mode.emoji}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 text-base">{mode.label}</p>
                                        <p className="text-sm text-gray-500 mt-0.5">{mode.desc}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                                </button>
                            ))}
                            <button onClick={onDismiss} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 pt-1 transition-colors">
                                Skip for now
                            </button>
                        </motion.div>
                    )}

                    {step === "plan" && rec && (
                        <motion.div
                            key="plan"
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -16 }}
                            className="p-5 space-y-4"
                        >
                            {/* Duration picker */}
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">How long do you want to study?</p>
                                <div className="flex flex-wrap gap-2">
                                    {rec.durations.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDuration(d)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                                duration === d
                                                    ? "bg-violet-600 border-violet-600 text-white shadow-md scale-105"
                                                    : "bg-white border-gray-200 text-gray-700 hover:border-violet-400"
                                            }`}
                                        >
                                            {d < 60 ? `${d}m` : d === 60 ? "1h" : `${d / 60}h ${d % 60 > 0 ? `${d % 60}m` : ""}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Steps */}
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Your plan for success:</p>
                                <div className="space-y-2">
                                    {rec.steps.map((step, i) => (
                                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${step.bg}`}>
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${step.bg}`}>
                                                <step.icon className={`w-4 h-4 ${step.color}`} />
                                            </div>
                                            <p className="text-sm text-gray-700 leading-snug">{step.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* CTAs */}
                            <div className="flex flex-col gap-2 pt-1">
                                <Link to={createPageUrl(rec.cta.link)} onClick={onDismiss} className="w-full">
                                    <Button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl py-3 font-bold text-base shadow-lg shadow-violet-500/30 gap-2">
                                        <rec.cta.icon className="w-5 h-5" />
                                        {rec.cta.label}
                                        {duration && <span className="ml-1 bg-white/20 rounded-lg px-2 py-0.5 text-sm">{duration}m</span>}
                                    </Button>
                                </Link>
                                <Link to={createPageUrl(rec.secondary.link)} onClick={onDismiss} className="w-full">
                                    <Button variant="outline" className="w-full rounded-2xl gap-2 text-gray-700 border-gray-200">
                                        <rec.secondary.icon className="w-4 h-4" />
                                        {rec.secondary.label}
                                    </Button>
                                </Link>
                                <button
                                    onClick={() => setStep("pick")}
                                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center pt-1"
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