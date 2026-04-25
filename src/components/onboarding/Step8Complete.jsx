import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const CHECKLIST = [
    "Create your first flashcard deck for a subject",
    "Upload a PDF and generate your first AI quiz",
    "Run one 25-minute Pomodoro session today",
    "Invite one friend to compete with you",
];

export default function Step8Complete({ data, onComplete, saving }) {
    const [checked, setChecked] = useState(new Set());

    const toggle = (i) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    };

    return (
        <div className="max-w-lg mx-auto px-6 py-12 text-center">
            <div className="text-6xl mb-6">🎓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                You're all set{data.display_name ? `, ${data.display_name}` : ""}.
            </h2>
            <p className="text-gray-500 text-sm mb-10">
                Your profile is live. Your subjects are loaded. Your goal is set. Your trial has started. Let's get to work.
            </p>

            {/* Checklist */}
            <div className="text-left mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Getting started checklist</p>
                <div className="space-y-2">
                    {CHECKLIST.map((item, i) => (
                        <button
                            key={i}
                            onClick={() => toggle(i)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all text-left"
                        >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked.has(i) ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                                {checked.has(i) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-sm ${checked.has(i) ? "line-through text-gray-400" : "text-gray-700"}`}>{item}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Info card */}
            <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left">
                <p className="text-xs text-gray-500 leading-relaxed">Students who complete these 4 actions in their first session are 3× more likely to maintain consistent study habits — based on onboarding activation research (Userpilot, 2024)</p>
            </div>

            <Button
                onClick={() => onComplete({})}
                disabled={saving}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: "#534AB7" }}
            >
                {saving ? "Setting up..." : "Go to my dashboard →"}
            </Button>
        </div>
    );
}