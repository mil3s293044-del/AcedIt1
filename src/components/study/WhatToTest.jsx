/**
 * WhatToTest — the panel that replaced "Start with Default Questions".
 *
 * Default questions for an unspecified topic can only be generic, and the good
 * path was gated behind finding and uploading a PDF. This offers the three or
 * four topics the student's own data says are worth testing, each naming the
 * evidence, and starts a session in one click.
 *
 * Shared by Active Recall and Blurting because the question "what should I
 * work on" has the same answer in both.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Target, ArrowRight, Layers, Network } from "lucide-react";
import { suggestTopics, ownMaterial, SUGGESTION_KIND } from "@/lib/recallSuggest";

const KIND_STYLE = {
    weak:       "bg-streak/20",
    assessment: "bg-xp/25",
    slipped:    "bg-chart-4/20",
    recent:     "bg-secondary",
};

export default function WhatToTest({
    flashcards = [], assessments = [], techniques = [], maps = [],
    onPick, limit = 4, verb = "Test",
}) {
    const suggestions = useMemo(
        () => suggestTopics({ flashcards, assessments, techniques, limit }),
        [flashcards, assessments, techniques, limit]);

    // What the app can build a session from RIGHT NOW, per suggestion — shown
    // before they commit, so nobody starts a session and finds it empty.
    const withMaterial = useMemo(() => suggestions.map(s => ({
        ...s,
        material: ownMaterial({ flashcards, maps, subject: s.subject, topic: s.topic }),
    })), [suggestions, flashcards, maps]);

    if (!withMaterial.length) return null;

    return (
        <div className="card-soft p-5">
            <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-display font-extrabold text-foreground text-base">What should I test?</h3>
                    <p className="text-xs text-muted-foreground">
                        From what you've actually logged — pick one and go
                    </p>
                </div>
            </div>

            <ul className="space-y-2">
                {withMaterial.map((s, i) => (
                    <motion.li key={`${s.subject}-${s.topic}`}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.05, 0.25) }}>
                        <button onClick={() => onPick?.(s)}
                            className="w-full text-left rounded-2xl border-2 border-border p-3.5 hover:border-primary/50 hover:bg-secondary/30 transition-colors group">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                        <span className="text-sm font-bold text-foreground">{s.topic}</span>
                                        {s.subject && (
                                            <span className="text-[11px] text-muted-foreground">{s.subject}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-snug mt-1">
                                        <span className={`pill mr-1.5 ${KIND_STYLE[s.kind.id] || "bg-secondary"} text-foreground`}>
                                            {s.kind.label}
                                        </span>
                                        {s.why}
                                    </p>
                                    {/* What it can run on without an upload. Saying
                                        this up front is the difference between a
                                        suggestion and a promise. */}
                                    {s.material.total > 0 && (
                                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
                                            {s.material.cards.length > 0 && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Layers className="w-3 h-3" />
                                                    <span className="font-bold text-foreground">{s.material.cards.length}</span> of your cards
                                                </span>
                                            )}
                                            {s.material.fromMap.length > 0 && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Network className="w-3 h-3" />
                                                    <span className="font-bold text-foreground">{s.material.fromMap.length}</span> from your map
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground flex-shrink-0 mt-0.5">
                                    {verb} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </span>
                            </div>
                        </button>
                    </motion.li>
                ))}
            </ul>
        </div>
    );
}

export { SUGGESTION_KIND };
