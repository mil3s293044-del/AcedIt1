import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const ALL_FEATURES = {
    "Spaced Repetition Flashcards": { color: "#534AB7", emoji: "🃏", desc: "Reviews each card at the exact moment you're about to forget it — not before, not after.", badge: "Ebbinghaus spacing effect" },
    "Active Recall": { color: "#0EA5E9", emoji: "🧠", desc: "AI generates questions from your own notes so you retrieve knowledge rather than just recognise it.", badge: "Roediger & Karpicke (2006)" },
    "Blurting Method": { color: "#10B981", emoji: "✍️", desc: "Write everything you know from memory, then check gaps — one of the most powerful retrieval techniques.", badge: "Retrieval practice" },
    "Study Roadmap": { color: "#8B5CF6", emoji: "🗺️", desc: "AI builds a day-by-day study plan from today to your SAC, automatically adjusting as you progress.", badge: "Spaced scheduling" },
    "Pomodoro Timer": { color: "#EC4899", emoji: "⏱️", desc: "Structured 25-minute focus sessions with earned XP — makes consistent daily study a habit.", badge: "Habit loop theory" },
    "Study Planner": { color: "#F59E0B", emoji: "📅", desc: "Plan your week around upcoming SACs and exams so you never fall behind.", badge: "Implementation intention" },
    "Weak Topic Detection": { color: "#EF4444", emoji: "📉", desc: "Analyses every quiz and flashcard attempt to surface the specific topics you keep getting wrong.", badge: "Metacognitive monitoring" },
    "Analytics": { color: "#06B6D4", emoji: "📊", desc: "Full performance dashboard showing your progress, weak spots and study trends over time.", badge: "Data-driven learning" },
    "Exam Mode": { color: "#7C3AED", emoji: "📝", desc: "Timed exam simulations with AI marking — practice under real exam conditions.", badge: "Deliberate practice theory" },
    "Ranked": { color: "#F59E0B", emoji: "🏅", desc: "Earn XP, climb leaderboards and track your season rank — study becomes competitive and motivating.", badge: "Gamification research" },
    "Friend Competitions": { color: "#8B5CF6", emoji: "🏆", desc: "Challenge classmates to goal races and score bets — social accountability improves follow-through.", badge: "Social motivation" },
    "Pomodoro XP system": { color: "#EC4899", emoji: "⭐", desc: "Earn XP for every study session completed — turns daily habits into a reward system.", badge: "Habit loop theory" },
    "Essay Planner": { color: "#10B981", emoji: "📋", desc: "AI scaffolds a full essay structure with arguments, evidence and analysis for any VCE prompt.", badge: "Deliberate practice" },
    "AI English Mentor": { color: "#0EA5E9", emoji: "✒️", desc: "Get detailed writing feedback on structure, language and argument quality for English responses.", badge: "Expert feedback" },
    "AI Answer Marking": { color: "#534AB7", emoji: "✅", desc: "Submit any VCE practice question and get instant detailed feedback with a full-marks model answer.", badge: "Deliberate practice theory" },
};

const CHALLENGE_MAP = {
    forget: ["Spaced Repetition Flashcards", "Active Recall", "Blurting Method"],
    time: ["Study Roadmap", "Pomodoro Timer", "Study Planner"],
    weak: ["Weak Topic Detection", "Analytics", "Exam Mode"],
    motivated: ["Ranked", "Friend Competitions", "Pomodoro XP system"],
    writing: ["Essay Planner", "AI English Mentor", "AI Answer Marking"],
    burnout: ["Pomodoro Timer", "Study Planner", "Study Roadmap"],
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
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: f.color + "20" }}>
                            {f.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm mb-0.5">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: "#F0EEFF", color: "#534AB7" }}>
                            {f.badge}
                        </span>
                    </div>
                ))}
            </div>

            <Button
                onClick={onNext}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: "#534AB7" }}
            >
                This is exactly what I need →
            </Button>
        </div>
    );
}