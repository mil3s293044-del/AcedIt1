import React from "react";
import { Button } from "@/components/ui/button";
import AceBody from "@/components/ace/AceBody";

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
            {/* He introduces himself before the statistics do. A student's
                first screen in this product was four research citations and no
                sign of a person; meeting the guide first is what makes the
                rest of it feel like it's being explained TO you. */}
            <div className="flex items-end gap-3 mb-6">
                <AceBody className="w-20 sm:w-24 flex-shrink-0" pose="wave" title="Ace" />
                <div className="rounded-2xl bg-surface border-2 border-border shadow-soft px-4 py-3 mb-2">
                    <p className="font-display font-extrabold text-foreground leading-snug">
                        Hey — I'm Ace.
                    </p>
                    <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                        I'll be around the whole way. Let's get you set up.
                    </p>
                </div>
            </div>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground leading-tight mb-3">
                    Before we set up your account — here's why most students work harder than they need to.
                </h1>
                <p className="text-muted-foreground text-base">
                    VCE is one of the most demanding academic experiences in the world. The research shows the problem isn't effort — it's method.
                </p>
            </div>

            {/* Dominant stat card */}
            <div className="rounded-2xl p-6 mb-4 bg-foreground">
                <div className="text-5xl font-extrabold text-white mb-2">{bigStat.stat}</div>
                <p className="text-base font-bold text-white/85 mb-2">{bigStat.label}</p>
                <p className="text-xs text-white/60 leading-snug">{bigStat.source}</p>
            </div>

            {/* Smaller stat cards */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                {smallStats.map((s, i) => (
                    <div key={i} className="border border-border rounded-xl p-3 bg-secondary/50">
                        <div className="text-2xl font-extrabold mb-1 text-primary">{s.stat}</div>
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
            >
                Let's set up your account →
            </Button>
        </div>
    );
}