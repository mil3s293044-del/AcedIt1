/**
 * WeakTopicsPanel — the topics costing a student marks, each with a way to act.
 *
 * Analytics already counted weak cards ("You have 7 weak-spot flashcards") but
 * never said which topics they were in, and offered nothing to do about it. The
 * app advertises "Weak Topic Detection" on the paywall and in the onboarding
 * tour; this is the first place it actually appears.
 *
 * Replaces the orphaned WeakTopics.jsx, which was pre-uplift UI (Card/Progress/
 * Badge) and imported by nothing.
 */
import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { TrendingDown, ArrowRight } from "lucide-react";
import { weakTopicsFrom } from "@/lib/weakTopics";

export default function WeakTopicsPanel({ flashcards = [] }) {
    const topics = weakTopicsFrom(flashcards);

    /**
     * ─── NOTHING STANDING OUT IS NOT A PANEL ────────────────────────────────
     * This used to draw a bordered card reading "Nothing is standing out yet"
     * — 94 measured pixels of a panel saying it has nothing to say, which on
     * a first-week account is one of four such boxes in a row. A panel whose
     * content is an absence is not drawn at all now, the refusal every builder
     * in `studyQueue.js` makes about a zero row.
     */
    if (!topics.length) return null;

    return (
        <div className="card-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <p className="stat-label mb-0.5">Weak topics</p>
                    <p className="text-xs text-muted-foreground">What's costing you marks, worst first.</p>
                </div>
                {/* Revision Mode already weights papers toward flagged-weak
                    material — this just aims it at one topic. */}
                <Link to={`${createPageUrl("Study")}?tab=exam`}>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-chart-3 hover:underline whitespace-nowrap">
                        Sit a full paper <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                </Link>
            </div>

            <div className="divide-y divide-border">
                {topics.map((t) => (
                    <div key={`${t.subject}:${t.topic}`} className="px-6 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-streak/10 flex items-center justify-center flex-shrink-0">
                            <TrendingDown className="w-4 h-4 text-streak" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground text-sm truncate">{t.topic}</p>
                            <p className="text-xs text-muted-foreground">
                                {t.subject}
                                {t.weakCards > 0 && <> · {t.weakCards} flagged card{t.weakCards === 1 ? "" : "s"}</>}
                                {t.missRate != null && <> · {t.missRate}% of reviews missed</>}
                            </p>
                        </div>
                        <Link
                            to={`${createPageUrl("Study")}?tab=exam&subject=${encodeURIComponent(t.subject)}&topic=${encodeURIComponent(t.topic)}`}
                            className="flex-shrink-0"
                        >
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/70 transition-colors">
                                Drill it <ArrowRight className="w-3 h-3" />
                            </span>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Re-exported so existing imports keep resolving.
export { weakTopicsFrom };
