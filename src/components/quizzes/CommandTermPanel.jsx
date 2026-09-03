/**
 * CommandTermPanel — what the VERB is costing you.
 *
 * Marks are lost on the command term as often as on the content: you knew it,
 * and you described where the question said evaluate. Nothing else in the app
 * looks at that, and the term is read off the stem so it needs no new field on
 * a question.
 *
 * ─── Why it lives on /MistakeBank ───────────────────────────────────────────
 * It used to sit in the rail beside the quiz list, where it was the second of
 * three panels competing to tell a student what to do next. But it is not a
 * next move — it is a DIAGNOSIS, and the thing to do about it ("write more
 * evaluate answers") happens on a different screen entirely. The mistake bank
 * is where the app already answers "what am I getting wrong, and am I fixing
 * it", and a verb you keep misreading is exactly that question at a different
 * altitude than a single dropped criterion.
 *
 * Extracted rather than moved as markup so both pages could show it if that
 * ever became the right call, and so this file owns its own empty state.
 */
import React, { useMemo } from "react";
import { Sparkles, Info } from "lucide-react";
import { commandTermStats, hasQuestionData } from "@/lib/quizInsight";

const TONE_BAR = {
    primary: "bg-primary", xp: "bg-xp", streak: "bg-streak",
    "chart-3": "bg-chart-3", "chart-4": "bg-chart-4", map: "bg-map",
};
const TONE_TEXT = {
    primary: "text-primary", xp: "text-xp", streak: "text-streak",
    "chart-3": "text-chart-3", "chart-4": "text-chart-4", map: "text-map",
};

export default function CommandTermPanel({ attempts = [], className = "" }) {
    const haveDetail = useMemo(() => hasQuestionData(attempts), [attempts]);
    const terms = useMemo(() => commandTermStats(attempts), [attempts]);

    // Nothing to say and nothing to apologise for. On a page that is already
    // about mistakes, an empty panel explaining why it is empty is one more
    // thing to read past.
    if (!haveDetail || terms.rows.length === 0) {
        return (
            <div className={`card-soft border-2 border-border p-4 ${className}`}>
                <p className="stat-label flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-chart-4" /> What the verb is costing you
                </p>
                <div className="flex items-start gap-2 rounded-xl bg-secondary/50 p-3 mt-2.5">
                    <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-snug">
                        Sit a couple of marked quizzes and this breaks your marks down by command
                        term &mdash; identify, explain, evaluate &mdash; so you can see whether
                        it&rsquo;s the content or the question style costing you.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`card-soft border-2 border-border p-4 ${className}`}>
            <p className="stat-label flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-chart-4" /> What the verb is costing you
            </p>

            {terms.hasGap && terms.weakest && terms.strongest && (
                <p className="text-xs text-foreground leading-snug mt-2.5">
                    You&rsquo;re at <span className="font-bold">{terms.strongest.pct}%</span> on{" "}
                    {terms.strongest.label.toLowerCase()} questions and{" "}
                    <span className="font-bold">{terms.weakest.pct}%</span> on{" "}
                    {terms.weakest.label.toLowerCase()} ones. That gap is the question style,
                    not the content.
                </p>
            )}

            <div className="space-y-2.5 mt-3">
                {terms.rows.map(r => (
                    <div key={r.id}>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-bold text-foreground">{r.label}</span>
                            <span className={`text-xs font-bold tabular-nums ${TONE_TEXT[r.tone]}`}>
                                {r.pct}%
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary mt-1 overflow-hidden">
                            <div className={`h-full rounded-full ${TONE_BAR[r.tone]}`}
                                style={{ width: `${r.pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {r.terms.slice(0, 4).map(t => t.term).join(", ")} · {r.marks}/{r.max} marks
                        </p>
                    </div>
                ))}
            </div>

            <p className="text-[10px] text-muted-foreground leading-snug mt-3">
                Marks earned over marks available, grouped by the command term in the question.
            </p>
        </div>
    );
}
