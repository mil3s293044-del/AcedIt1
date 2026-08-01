import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

// Names and claims here have to match what the app actually ships. The Roadmap
// was folded into the Planner, and Ranked's season tiers were retired in favour
// of AcedIt ATAR bands — promising either by its old name sends a new student
// looking for a page that isn't there.
const ALL_FEATURES = {
    "Spaced Repetition Flashcards": { accent: "bg-chart-4/15", emoji: "🃏", desc: "Reviews each card at the exact moment you're about to forget it — not before, not after.", badge: "Ebbinghaus spacing effect" },
    "Active Recall": { accent: "bg-chart-3/15", emoji: "🧠", desc: "AI generates questions from your own notes so you retrieve knowledge rather than just recognise it.", badge: "Roediger & Karpicke (2006)" },
    "Blurting Method": { accent: "bg-primary/15", emoji: "✍️", desc: "Write everything you know from memory, then check gaps — one of the most powerful retrieval techniques.", badge: "Retrieval practice" },
    "Line Memoriser": { accent: "bg-streak/15", emoji: "🔁", desc: "Drills quotes and passages line by line, chaining each onto the last until you can recite the whole thing.", badge: "Chaining" },
    "Pomodoro Timer": { accent: "bg-streak/15", emoji: "⏱️", desc: "Structured 25-minute focus sessions with earned XP — makes consistent daily study a habit.", badge: "Habit loop theory" },
    "Planner": { accent: "bg-xp/15", emoji: "📅", desc: "Builds your week around upcoming SACs — plan sessions ahead and your AcedIt ATAR rewards you for keeping them.", badge: "Implementation intention" },
    "Weak Topic Detection": { accent: "bg-streak/15", emoji: "📉", desc: "Analyses every quiz and flashcard attempt to surface the specific topics you keep getting wrong.", badge: "Metacognitive monitoring" },
    "Analytics": { accent: "bg-chart-3/15", emoji: "📊", desc: "Full performance dashboard showing your progress, weak spots and study trends over time.", badge: "Data-driven learning" },
    "Exam Mode": { accent: "bg-chart-4/15", emoji: "📝", desc: "Timed exam simulations with AI marking — practice under real exam conditions.", badge: "Deliberate practice theory" },
    "AcedIt ATAR": { accent: "bg-chart-4/15", emoji: "🎓", desc: "One score out of 99.95 for how well you're studying — mastery, consistency, effort, breadth and planning, over your last 28 days.", badge: "Not a VCAA prediction" },
    "Ranked": { accent: "bg-xp/15", emoji: "🏅", desc: "Three boards — ATAR, XP and study time — against everyone, your friends, or your school.", badge: "Gamification research" },
    "Friend Competitions": { accent: "bg-chart-4/15", emoji: "🏆", desc: "Challenge classmates to goal races and score bets — social accountability improves follow-through.", badge: "Social motivation" },
    "Essay Planner": { accent: "bg-primary/15", emoji: "📋", desc: "AI scaffolds a full essay structure with arguments, evidence and analysis for any VCE prompt.", badge: "Deliberate practice" },
    "AI English Mentor": { accent: "bg-chart-3/15", emoji: "✒️", desc: "Get detailed writing feedback on structure, language and argument quality for English responses.", badge: "Expert feedback" },
    "AI Answer Marking": { accent: "bg-chart-4/15", emoji: "✅", desc: "Submit any VCE practice question and get instant detailed feedback with a full-marks model answer.", badge: "Deliberate practice theory" },
};

const CHALLENGE_MAP = {
    forget: ["Spaced Repetition Flashcards", "Active Recall", "Line Memoriser"],
    time: ["Planner", "Pomodoro Timer", "AcedIt ATAR"],
    weak: ["Weak Topic Detection", "Analytics", "Exam Mode"],
    motivated: ["AcedIt ATAR", "Ranked", "Friend Competitions"],
    writing: ["Essay Planner", "AI English Mentor", "AI Answer Marking"],
    burnout: ["Pomodoro Timer", "Planner", "Blurting Method"],
};

export default function Step6FeatureTour({ onNext, onBack, data }) {
    const challenges = data?.primary_challenge
        ? (Array.isArray(data.primary_challenge) ? data.primary_challenge : [data.primary_challenge])
        : [];

    const featureNames = challenges.length > 0
        ? [...new Set(challenges.flatMap(c => CHALLENGE_MAP[c] || []))]
        : Object.keys(ALL_FEATURES).slice(0, 6);

    const features = featureNames.map(name => ({ name, ...ALL_FEATURES[name] })).filter(Boolean);
    const name = data?.display_name ? data.display_name : "you";

    return (
        <div className="max-w-2xl mx-auto px-6 py-10">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground mb-6">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1">Here's exactly how AcedIt fixes what {name} just told us</h2>
            <p className="text-muted-foreground text-sm mb-8">Every feature is built on peer-reviewed learning science.</p>

            <div className="space-y-3 mb-8">
                {features.map((f, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-secondary/50">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${f.accent}`}>
                            {f.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm mb-0.5">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 mt-0.5 bg-primary/10 text-primary">
                            {f.badge}
                        </span>
                    </div>
                ))}
            </div>

            <Button
                onClick={onNext}
                className="w-full h-12 text-base font-semibold"
            >
                This is exactly what I need →
            </Button>
        </div>
    );
}