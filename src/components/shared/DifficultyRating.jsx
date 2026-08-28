import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Flame } from "lucide-react";

// A five-step ramp, carried by colour rather than by five faces. It ran on raw
// Tailwind palette classes (bg-blue-100, bg-red-100) which are invisible to the
// theme and rendered as bright slabs in dark mode; these are design tokens, so
// the scale reads the same way in both. `dot` is the intensity, `on` is the
// selected state — the whole reason the emoji were there was to make the ends
// of the scale distinguishable, and a colour ramp does that better.
// A five-step ramp, carried by colour rather than by five faces. It ran on raw
// Tailwind palette classes (bg-blue-100, bg-red-100) which are invisible to the
// theme and rendered as bright slabs in dark mode; these are design tokens, so
// the scale reads the same way in both.
//
// `dim` matters as much as `dot`: with every unselected dot the same grey, the
// row was five identical pills and the SCALE — the thing the faces were
// actually communicating — only appeared once you'd already answered. Held at
// low opacity, the ramp runs cool-to-hot left to right before you touch it.
const LEVELS = [
    { value: 1, label: "Too Easy",   dot: "bg-chart-3", dim: "bg-chart-3/40", on: "bg-chart-3/10 text-chart-3 border-chart-3/40" },
    { value: 2, label: "Easy",       dot: "bg-primary", dim: "bg-primary/40", on: "bg-primary/10 text-primary border-primary/40" },
    { value: 3, label: "Just Right", dot: "bg-primary", dim: "bg-primary/40", on: "bg-primary/10 text-primary border-primary/40" },
    { value: 4, label: "Hard",       dot: "bg-xp",      dim: "bg-xp/40",      on: "bg-xp/10 text-xp border-xp/40" },
    { value: 5, label: "Too Hard",   dot: "bg-streak",  dim: "bg-streak/40",  on: "bg-streak/10 text-streak border-streak/40" },
];

// Maps difficulty rating to a suggested quiz difficulty level
function ratingToDifficulty(avg) {
    if (avg <= 1.5) return "beginner";
    if (avg <= 2.5) return "beginner";
    if (avg <= 3.5) return "intermediate";
    return "advanced";
}

export async function saveDifficultyRating(subjectName, rating) {
    try {
        const user = await base44.auth.me();
        const subjects = await base44.entities.UserSubject.filter({ created_by: user.email, subject_name: subjectName });
        if (subjects.length === 0) return;

        const subject = subjects[0];
        const existing = subject.difficulty_ratings || [];
        const updated = [...existing, rating].slice(-10); // keep last 10 ratings
        const avg = updated.reduce((a, b) => a + b, 0) / updated.length;
        const suggestedDifficulty = ratingToDifficulty(avg);

        await base44.entities.UserSubject.update(subject.id, {
            difficulty_ratings: updated,
            avg_difficulty_rating: Math.round(avg * 10) / 10,
            suggested_quiz_difficulty: suggestedDifficulty
        });
    } catch (e) {
        console.error("Failed to save difficulty rating", e);
    }
}

export default function DifficultyRating({ subjectName, onDone }) {
    const [selected, setSelected] = useState(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        await saveDifficultyRating(subjectName, selected);
        setSaved(true);
        setSaving(false);
        setTimeout(() => onDone?.(), 800);
    };

    if (saved) {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-1 py-2 text-center">
                <span className="text-2xl"></span>
                <p className="text-sm font-semibold text-emerald-700">Difficulty saved! Your future quizzes will be adjusted.</p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-xp" />
                <p className="text-sm font-semibold text-foreground">How difficult was this for you?</p>
            </div>
            <div className="flex flex-wrap gap-2">
                {LEVELS.map((lvl) => (
                    <button key={lvl.value} onClick={() => setSelected(lvl.value)}
                        aria-pressed={selected === lvl.value}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${
                            selected === lvl.value
                                ? `${lvl.on} scale-105`
                                : "border-border bg-surface text-muted-foreground hover:border-border"}`}>
                        <span className={`w-2 h-2 rounded-full ${
                            selected === lvl.value ? lvl.dot : lvl.dim}`} aria-hidden="true" />
                        {lvl.label}
                    </button>
                ))}
            </div>
            <AnimatePresence>
                {selected && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Button size="sm" onClick={handleSave} disabled={saving}
                            className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs">
                            {saving ? "Saving..." : "Save Rating"}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}