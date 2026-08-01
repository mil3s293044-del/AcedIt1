/**
 * ExamQuestionsArtifact — the exam question set as a workable paper inside the
 * chat, rather than a wall of markdown with the answers dumped underneath.
 *
 * The old ExamQuestionGenerator returned structured questions: marks, MCQ
 * options with a correct index, a model answer, marking criteria, the common
 * mistakes and a study tip. Rendering that as prose meant the solutions sat in
 * plain view while you were still attempting the questions, and there was no
 * way to save the set. Both are back.
 *
 * Ported from ExamQuestionGenerator; the chat now owns generation, everything
 * after it behaves as before.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronRight, Check, Loader2, BookmarkPlus } from "lucide-react";
import MarkdownMath from "@/components/shared/MarkdownMath";

export default function ExamQuestionsArtifact({ questions, subject = "", title = "" }) {
    const [expanded, setExpanded] = useState(null);
    const [picked, setPicked] = useState({});   // qIndex -> option index
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const { toast } = useToast();

    if (!questions?.length) return null;

    const isMcq = (q) => Array.isArray(q.options) && q.options.length > 0;
    const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    const answered = Object.keys(picked).length;
    const correct = questions.reduce(
        (n, q, i) => n + (isMcq(q) && picked[i] === q.correct_answer_index ? 1 : 0), 0,
    );

    const saveAsQuiz = async () => {
        setSaving(true);
        try {
            const quizQuestions = questions.map((q) => {
                const mcq = isMcq(q);
                return {
                    type: mcq ? "mcq" : "short_answer",
                    question: q.question,
                    options: mcq ? (q.options || []) : [],
                    correct_answer: mcq ? (q.correct_answer_index ?? 0) : undefined,
                    model_answer: q.model_answer,
                    marks: q.marks,
                    explanation: q.marking_criteria,
                };
            });
            await base44.entities.Quiz.create({
                title: title || `${subject || "VCE"} — exam questions`,
                subject,
                questions: quizQuestions,
                difficulty: "exam_standard",
                category: "subject_content",
            });
            setSaved(true);
            toast({ title: "Saved as quiz", description: "Find it on your Quizzes page." });
        } catch (e) {
            toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-3 rounded-2xl border-2 border-border bg-surface overflow-hidden">
            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-secondary/40">
                <div className="flex-1 min-w-[140px]">
                    <p className="text-xs font-bold text-foreground">
                        {questions.length} question{questions.length === 1 ? "" : "s"} · {totalMarks} mark{totalMarks === 1 ? "" : "s"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {answered > 0
                            ? `${correct}/${answered} right so far — solutions stay hidden until you open them`
                            : "Attempt them first — solutions stay hidden until you open them"}
                    </p>
                </div>
                <Button size="sm" variant={saved ? "outline" : "default"} onClick={saveAsQuiz} disabled={saving || saved}
                    className="rounded-xl gap-1.5 text-xs font-semibold">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : saved ? <Check className="w-3.5 h-3.5" />
                        : <BookmarkPlus className="w-3.5 h-3.5" />}
                    {saved ? "Saved" : "Save as quiz"}
                </Button>
            </div>

            {/* ── Questions ────────────────────────────────────────────── */}
            <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                {questions.map((q, i) => {
                    const open = expanded === i;
                    const mcq = isMcq(q);
                    const choice = picked[i];
                    return (
                        <div key={i} className="px-4 py-3">
                            <div className="flex items-start gap-2.5">
                                <span className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center font-display font-black text-xs text-foreground flex-shrink-0 mt-0.5">
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-foreground leading-snug">
                                        <MarkdownMath>{q.question}</MarkdownMath>
                                    </div>
                                    {q.marks > 0 && (
                                        <span className="pill bg-secondary text-muted-foreground mt-1.5 inline-block text-[11px]">
                                            {q.marks} mark{q.marks === 1 ? "" : "s"}
                                        </span>
                                    )}

                                    {mcq && (
                                        <div className="mt-2 space-y-1">
                                            {q.options.map((opt, oi) => {
                                                const chosen = choice === oi;
                                                const isRight = oi === q.correct_answer_index;
                                                // Right/wrong only colours in once they've answered.
                                                const tone = choice == null ? "border-border"
                                                    : isRight ? "border-primary bg-primary/10"
                                                    : chosen ? "border-streak bg-streak/10"
                                                    : "border-border opacity-60";
                                                return (
                                                    <button key={oi}
                                                        onClick={() => setPicked((p) => ({ ...p, [i]: oi }))}
                                                        disabled={choice != null}
                                                        className={`w-full text-left flex items-start gap-2 rounded-xl border-2 px-2.5 py-1.5 text-sm transition-all disabled:cursor-default ${tone}`}>
                                                        <span className="font-bold text-muted-foreground flex-shrink-0">
                                                            {String.fromCharCode(65 + oi)}
                                                        </span>
                                                        <span className="min-w-0 text-foreground"><MarkdownMath>{opt}</MarkdownMath></span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <button onClick={() => setExpanded(open ? null : i)}
                                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                                        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        {open ? "Hide solution" : "Show solution"}
                                    </button>

                                    {open && (
                                        <div className="mt-2 space-y-2.5 rounded-xl bg-secondary/50 p-3">
                                            {q.model_answer && (
                                                <div>
                                                    <p className="stat-label mb-1">Model answer</p>
                                                    <div className="text-sm text-foreground"><MarkdownMath>{q.model_answer}</MarkdownMath></div>
                                                </div>
                                            )}
                                            {q.marking_criteria && (
                                                <div>
                                                    <p className="stat-label mb-1">Where the marks are</p>
                                                    <div className="text-sm text-foreground"><MarkdownMath>{q.marking_criteria}</MarkdownMath></div>
                                                </div>
                                            )}
                                            {q.common_mistakes && (
                                                <div>
                                                    <p className="stat-label mb-1">Common mistakes</p>
                                                    <div className="text-sm text-foreground"><MarkdownMath>{q.common_mistakes}</MarkdownMath></div>
                                                </div>
                                            )}
                                            {q.study_tip && (
                                                <div>
                                                    <p className="stat-label mb-1">Study tip</p>
                                                    <div className="text-sm text-foreground"><MarkdownMath>{q.study_tip}</MarkdownMath></div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
