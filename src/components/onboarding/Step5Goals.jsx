import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";

const PRESET_GOALS = [
    "Get into my dream course at uni and feel in control of my study all year",
    "Improve my study scores across all subjects and stop cramming before SACs",
    "Beat burnout — study smarter so I still have a life outside of school",
    "Get a 90+ ATAR and prove to myself I can do this",
    "Understand my subjects deeply, not just memorise for exams",
    "Build a consistent study routine and actually stick to it this year",
    "Stop feeling behind and get on top of every subject before it's too late",
    "Make Year 12 worth it — strong results without sacrificing my mental health",
];

export default function Step5Goals({ data, onNext, onBack, saving }) {
    const [qualitative_goal, setGoal] = useState(data.qualitative_goal || "");
    const [dream_course, setDreamCourse] = useState(data.dream_course || "");

    const canProceed = qualitative_goal.trim().length >= 20;

    return (
        <div className="max-w-lg mx-auto px-6 py-10">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground mb-6">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1">What does success look like for you this year?</h2>
            <p className="text-muted-foreground text-sm mb-6">Write your own or choose one that fits — the more specific, the more it will drive you.</p>

            {/* Preset goals */}
            <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quick select</p>
                <div className="flex flex-wrap gap-2">
                    {PRESET_GOALS.map((g, i) => (
                        <button
                            key={i}
                            onClick={() => setGoal(g)}
                            className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 hover:border-purple-300 hover:bg-purple-50 text-muted-foreground hover:text-purple-700 transition-all text-left"
                        >
                            {g.length > 50 ? g.slice(0, 50) + "…" : g}
                        </button>
                    ))}
                </div>
            </div>

            {/* Goal text area */}
            <div className="mb-4">
                <Label className="text-sm font-medium text-muted-foreground">Your goal (edit or write your own) <span className="text-red-500">*</span></Label>
                <Textarea
                    className="mt-1.5 min-h-[100px]"
                    placeholder="e.g. I want to get into nursing at Melbourne Uni, improve my Biology study score, and feel in control of my study instead of always stressed"
                    value={qualitative_goal}
                    onChange={e => setGoal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground/60 mt-1">{qualitative_goal.length}/20 characters minimum</p>
            </div>

            {/* Research callout */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-6 flex gap-2">
                <span className="text-sm">📌</span>
                <p className="text-xs text-purple-700 leading-relaxed">Students who write specific, personal goals are significantly more likely to follow through. This is called implementation intention — documented by Gollwitzer (1999) across 94 independent studies.</p>
            </div>

            {/* Dream course */}
            <div className="mb-8">
                <Label className="text-sm font-medium text-muted-foreground">Dream course or career (optional)</Label>
                <Input
                    className="mt-1.5"
                    placeholder="e.g. Bachelor of Commerce at Monash, or Physiotherapist"
                    value={dream_course}
                    onChange={e => setDreamCourse(e.target.value)}
                />
                <p className="text-xs text-muted-foreground/60 mt-1">This appears on your dashboard every time you open the app.</p>
            </div>

            <Button
                onClick={() => onNext({ qualitative_goal: qualitative_goal.trim(), dream_course: dream_course.trim() })}
                disabled={!canProceed || saving}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: canProceed ? "#534AB7" : undefined }}
            >
                {saving ? "Saving..." : "Next →"}
            </Button>
        </div>
    );
}