import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

// Three study days is what unlocks the AcedIt ATAR, so the first-session
// checklist points at getting there rather than at four unrelated features.
const CHECKLIST = [
    "Run one 25-minute session today — day one of three",
    "Upload a set of notes and generate your first AI quiz",
    "Block out tomorrow's session in the Planner",
    "Create a flashcard deck for the subject you're weakest at",
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
            <h2 className="text-2xl font-bold text-foreground mb-3">
                You're all set{data.display_name ? `, ${data.display_name}` : ""}.
            </h2>
            <p className="text-muted-foreground text-sm mb-10">
                Your profile is live, your subjects are loaded and your trial has started.
                {data.goal_atar ? ` You're aiming at ${data.goal_atar} — ` : " "}
                three study days puts you on the board and unlocks your AcedIt ATAR.
            </p>

            {/* Checklist */}
            <div className="text-left mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Getting started checklist</p>
                <div className="space-y-2">
                    {CHECKLIST.map((item, i) => (
                        <button
                            key={i}
                            onClick={() => toggle(i)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50 transition-all text-left"
                        >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked.has(i) ? "border-primary bg-primary" : "border-border"}`}>
                                {checked.has(i) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-sm ${checked.has(i) ? "line-through text-muted-foreground/60" : "text-muted-foreground"}`}>{item}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Info card */}
            <div className="bg-secondary/50 rounded-xl p-4 mb-8 text-left">
                <p className="text-xs text-muted-foreground leading-relaxed">Students who complete these 4 actions in their first session are 3× more likely to maintain consistent study habits — based on onboarding activation research (Userpilot, 2024)</p>
            </div>

            <Button
                onClick={() => onComplete({})}
                disabled={saving}
                className="w-full h-12 text-base font-semibold"
            >
                {saving ? "Setting up..." : "Go to my dashboard →"}
            </Button>
        </div>
    );
}