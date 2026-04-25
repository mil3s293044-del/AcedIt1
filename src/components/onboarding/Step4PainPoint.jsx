import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const OPTIONS = [
    { id: "forget", emoji: "😵", label: "I study for hours but forget everything" },
    { id: "time", emoji: "⏰", label: "I never have enough time before SACs" },
    { id: "weak", emoji: "📉", label: "I don't know what I'm actually weak at" },
    { id: "motivated", emoji: "😔", label: "I struggle to stay motivated" },
    { id: "writing", emoji: "📝", label: "I don't know how to write strong responses" },
    { id: "burnout", emoji: "😰", label: "Exam pressure and burnout are getting to me" },
];

const STATS = {
    forget: "Active recall produces 50% better retention than re-reading in the same time — Dunlosky et al. (2013)",
    time: "Students using spaced repetition spend 30% less time on review while retaining more — Cepeda et al. (2006)",
    weak: "Most students overestimate their knowledge — the illusion of competence is a well-documented cognitive bias (Dunning-Kruger effect)",
    motivated: "Gamified learning increases daily engagement by up to 40% in student populations — Hamari et al. (2014)",
    writing: "Deliberate practice with immediate feedback is the most effective method for skill development — Ericsson et al. (1993)",
    burnout: "Students with structured study systems report significantly lower stress despite the same workload — Preprints.org (2025)",
};

export default function Step4PainPoint({ data, onNext, onBack, saving }) {
    const initialSelected = data.primary_challenge
        ? (Array.isArray(data.primary_challenge) ? data.primary_challenge : [data.primary_challenge])
        : [];
    const [selected, setSelected] = useState(new Set(initialSelected));

    const toggle = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else if (next.size < 3) {
                next.add(id);
            }
            return next;
        });
    };

    return (
        <div className="max-w-2xl mx-auto px-6 py-10">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">What's your biggest study challenge right now?</h2>
            <p className="text-gray-500 text-sm mb-1">Be honest — this helps us show you the features that'll make the biggest difference.</p>
            <p className="text-xs text-purple-600 font-medium mb-6">Pick up to 3 — we'll personalise everything around these.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
                {OPTIONS.map(opt => {
                    const isSelected = selected.has(opt.id);
                    return (
                        <button
                            key={opt.id}
                            onClick={() => toggle(opt.id)}
                            className="p-4 rounded-xl border-2 text-left transition-all"
                            style={{
                                borderColor: isSelected ? "#534AB7" : "#E5E7EB",
                                backgroundColor: isSelected ? "#F0EEFF" : "white",
                                transform: isSelected ? "scale(1.03)" : "scale(1)",
                                transition: "all 0.15s ease"
                            }}
                        >
                            <span className="text-2xl block mb-2">{opt.emoji}</span>
                            <span className="text-sm font-semibold text-gray-800">{opt.label}</span>
                        </button>
                    );
                })}
            </div>

            {selected.size > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                    {Array.from(selected).map(id => (
                        <p key={id} className="text-xs text-blue-700 leading-relaxed mb-1">📊 {STATS[id]}</p>
                    ))}
                </div>
            )}

            <Button
                onClick={() => onNext({ primary_challenge: Array.from(selected) })}
                disabled={selected.size === 0 || saving}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: selected.size > 0 ? "#534AB7" : undefined }}
            >
                {saving ? "Saving..." : selected.size > 0 ? `Next → ${selected.size} selected` : "Next →"}
            </Button>
        </div>
    );
}