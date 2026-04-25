import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Flame } from "lucide-react";

const LEVELS = [
    { value: 1, label: "Too Easy", emoji: "😴", color: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200" },
    { value: 2, label: "Easy", emoji: "🙂", color: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200" },
    { value: 3, label: "Just Right", emoji: "😊", color: "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200" },
    { value: 4, label: "Hard", emoji: "😤", color: "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200" },
    { value: 5, label: "Too Hard", emoji: "🤯", color: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200" },
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
                <span className="text-2xl">✅</span>
                <p className="text-sm font-semibold text-emerald-700">Difficulty saved! Your future quizzes will be adjusted.</p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-semibold text-gray-800">How difficult was this for you?</p>
            </div>
            <div className="flex flex-wrap gap-2">
                {LEVELS.map((lvl) => (
                    <button key={lvl.value} onClick={() => setSelected(lvl.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${selected === lvl.value ? lvl.color + " ring-2 ring-offset-1 ring-current scale-105" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
                        <span>{lvl.emoji}</span> {lvl.label}
                    </button>
                ))}
            </div>
            <AnimatePresence>
                {selected && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Button size="sm" onClick={handleSave} disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs">
                            {saving ? "Saving..." : "Save Rating"}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}