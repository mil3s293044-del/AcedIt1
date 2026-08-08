/**
 * QuizInsightRail — the three panels that fill the space beside the quiz list.
 *
 * Ordered by how actionable they are, not by how clever they look:
 *
 *   1. Where you're losing marks — the questions that keep catching you, with
 *      a button that builds a drill from those exact questions. The only panel
 *      here that changes what you do next rather than just telling you
 *      something.
 *   2. Command terms — accuracy per VCAA verb. Marks get lost on the verb as
 *      often as on the content, and nothing in the app was looking at it.
 *   3. Retrieval strength — an estimate of what you'd still have right now,
 *      so the quiz list has an order to work through.
 *
 * Panels 1 and 2 need per-question results, which only exist on attempts taken
 * since the player started recording them. They say that plainly rather than
 * rendering an empty chart that looks like a bug or, worse, like a real zero.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
    Target, Loader2, Zap, Clock, AlertTriangle, Info, Sparkles,
} from "lucide-react";
import {
    weakSpots, commandTermStats, retrievalStrength, buildDrillQuestions, hasQuestionData,
} from "@/lib/quizInsight";

const TONE_BAR = {
    primary: "bg-primary", xp: "bg-xp", streak: "bg-streak",
    "chart-3": "bg-chart-3", "chart-4": "bg-chart-4", map: "bg-map",
};
const TONE_TEXT = {
    primary: "text-primary", xp: "text-xp", streak: "text-streak",
    "chart-3": "text-chart-3", "chart-4": "text-chart-4", map: "text-map",
};

const strengthTone = (v) => (v >= 70 ? "primary" : v >= 40 ? "xp" : "streak");

/** Shown where a panel needs data the student hasn't generated yet. */
function NotYet({ children }) {
    return (
        <div className="flex items-start gap-2 rounded-xl bg-secondary/50 p-3">
            <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">{children}</p>
        </div>
    );
}

export default function QuizInsightRail({ quizzes = [], attempts = [], onDrill, onOpenQuiz }) {
    const [drilling, setDrilling] = useState(false);

    const haveDetail = useMemo(() => hasQuestionData(attempts), [attempts]);
    const spots = useMemo(() => weakSpots(attempts), [attempts]);
    const terms = useMemo(() => commandTermStats(attempts), [attempts]);
    const strength = useMemo(() => retrievalStrength(quizzes, attempts), [quizzes, attempts]);

    const drill = async () => {
        const questions = buildDrillQuestions(spots, quizzes);
        if (!questions.length) return;
        setDrilling(true);
        try { await onDrill?.(questions, spots); } finally { setDrilling(false); }
    };

    return (
        <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid gap-3 items-start md:grid-cols-2 xl:grid-cols-1"
            aria-label="What your quiz history says"
        >
            {/* ── 1. Where you're losing marks ───────────────────────────── */}
            <div className="card-soft p-4 border-2 border-border space-y-3">
                <p className="stat-label flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-streak" /> Where you're losing marks
                </p>

                {!haveDetail ? (
                    <NotYet>
                        This fills in from your next quiz. Older attempts didn't record which
                        individual questions you missed, so there's nothing to read yet.
                    </NotYet>
                ) : spots.length === 0 ? (
                    <NotYet>
                        Nothing has caught you out twice yet. A question needs two misses before it
                        shows up here — one is noise.
                    </NotYet>
                ) : (
                    <>
                        <p className="text-xs text-muted-foreground leading-snug">
                            {spots.length} question{spots.length === 1 ? " has" : "s have"} caught you out
                            more than once, and {spots.length === 1 ? "it's" : "they're"} still wrong.
                        </p>
                        <ul className="space-y-2">
                            {spots.slice(0, 4).map(s => (
                                <li key={s.key} className="rounded-xl border border-border p-2.5">
                                    <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                                        {s.question}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {s.quizTitle} · missed {s.missed} of {s.seen}
                                        {s.commandTerm && <> · <span className="capitalize">{s.commandTerm.term}</span></>}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        {spots.length > 4 && (
                            <p className="text-[11px] text-muted-foreground">+ {spots.length - 4} more</p>
                        )}
                        <Button size="sm" onClick={drill} disabled={drilling}
                            className="w-full rounded-xl gap-1.5 text-xs h-9 btn-3d">
                            {drilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            Drill just these {spots.length}
                        </Button>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                            Builds a quiz from these exact questions — no AI, no waiting.
                        </p>
                    </>
                )}
            </div>

            {/* ── 2. Command terms ───────────────────────────────────────── */}
            <div className="card-soft p-4 border-2 border-border space-y-3">
                <p className="stat-label flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-chart-4" /> What the verb is costing you
                </p>

                {!haveDetail || terms.rows.length === 0 ? (
                    <NotYet>
                        Take a couple of quizzes and this breaks your marks down by command term —
                        identify, explain, evaluate — so you can see whether it's the content or the
                        question style costing you.
                    </NotYet>
                ) : (
                    <>
                        {terms.hasGap && terms.weakest && terms.strongest && (
                            <p className="text-xs text-foreground leading-snug">
                                You're at <span className="font-bold">{terms.strongest.pct}%</span> on{" "}
                                {terms.strongest.label.toLowerCase()} questions and{" "}
                                <span className="font-bold">{terms.weakest.pct}%</span> on{" "}
                                {terms.weakest.label.toLowerCase()} ones. That gap is the question style,
                                not the content.
                            </p>
                        )}
                        <div className="space-y-2.5">
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
                        <p className="text-[10px] text-muted-foreground leading-snug">
                            Marks earned over marks available, grouped by the command term in the question.
                        </p>
                    </>
                )}
            </div>

            {/* ── 3. Retrieval strength ──────────────────────────────────── */}
            <div className="card-soft p-4 border-2 border-border space-y-3">
                <p className="stat-label flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-chart-3" /> Fading fastest
                </p>

                {strength.length === 0 ? (
                    <NotYet>Sit a quiz and this starts tracking which ones are going stale.</NotYet>
                ) : (
                    <>
                        <ul className="space-y-2.5">
                            {strength.slice(0, 5).map(s => (
                                <li key={s.key}>
                                    <button onClick={() => onOpenQuiz?.(s.quizId)}
                                        disabled={!s.quizId}
                                        className="w-full text-left group disabled:cursor-default">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs font-bold text-foreground truncate group-enabled:group-hover:underline">
                                                {s.title}
                                            </span>
                                            <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${TONE_TEXT[strengthTone(s.strength)]}`}>
                                                {s.strength}%
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-secondary mt-1 overflow-hidden">
                                            <div className={`h-full rounded-full ${TONE_BAR[strengthTone(s.strength)]}`}
                                                style={{ width: `${Math.max(3, s.strength)}%` }} />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {s.lastScore}% · {s.daysSince === 0 ? "today" : `${s.daysSince}d ago`}
                                            {s.overdue
                                                ? <span className="text-streak font-bold"> · retake now</span>
                                                : <> · retake in {s.dueInDays}d</>}
                                        </p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="flex items-start gap-2 pt-1 border-t border-border">
                            <AlertTriangle className="w-3 h-3 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-muted-foreground/80 leading-snug">
                                An estimate, not a measurement — worked out from your last score and how
                                long it's been. Treat it as an order to work through, not a fact about
                                your memory.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </motion.aside>
    );
}
