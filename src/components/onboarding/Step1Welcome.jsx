import React from "react";
import { Button } from "@/components/ui/button";

const stats = [
    {
        stat: "70%",
        label: "of what you study today is forgotten within 24 hours",
        source: "Ebbinghaus Forgetting Curve (1885), replicated across hundreds of modern studies"
    },
    {
        stat: "60%",
        label: "of Year 12 students experience burnout symptoms",
        source: "Systematic review of 25 studies, Preprints.org 2025"
    },
    {
        stat: "80%",
        label: "retention after one week using active recall vs 34% for re-reading",
        source: "Roediger & Karpicke, Psychological Science (2006)"
    },
    {
        stat: "200–400%",
        label: "better long-term retention with spaced repetition vs cramming",
        source: "Cognitive psychology research consensus, reviewed 2026"
    }
];

export default function Step1Welcome({ onNext }) {
    const smallStats = stats.slice(0, 3);
    const bigStat = stats[3];

    return (
        <div className="max-w-2xl mx-auto px-6 py-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground leading-tight mb-3">
                    Before we set up your account — here's why most students work harder than they need to.
                </h1>
                <p className="text-muted-foreground text-base">
                    VCE is one of the most demanding academic experiences in the world. The research shows the problem isn't effort — it's method.
                </p>
            </div>

            {/* Dominant stat card */}
            <div className="rounded-2xl p-6 mb-4" style={{ backgroundColor: "#3D3399" }}>
                <div className="text-5xl font-extrabold text-white mb-2">{bigStat.stat}</div>
                <p className="text-base font-bold text-purple-100 mb-2">{bigStat.label}</p>
                <p className="text-xs text-purple-300 leading-snug">{bigStat.source}</p>
            </div>

            {/* Smaller stat cards */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                {smallStats.map((s, i) => (
                    <div key={i} className="border border-border rounded-xl p-3 bg-secondary/50">
                        <div className="text-2xl font-extrabold mb-1" style={{ color: "#534AB7" }}>{s.stat}</div>
                        <p className="text-xs font-semibold text-foreground mb-1">{s.label}</p>
                        <p className="text-xs text-muted-foreground/60 leading-snug">{s.source}</p>
                    </div>
                ))}
            </div>

            <p className="text-sm text-muted-foreground mb-8 text-center">
                AcedIt is built entirely on these four findings. Every feature exists to make sure your study time actually sticks.
            </p>

            <Button
                onClick={onNext}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: "#534AB7" }}
            >
                Let's set up your account →
            </Button>
        </div>
    );
}