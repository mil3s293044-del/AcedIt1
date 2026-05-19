import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Lightbulb, ChevronRight, Check, X, Loader2, Sparkles, Target, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MathText from "@/components/shared/LatexRenderer";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { getLatexRules } from "@/lib/subjectExaminerPrompts";

// Static lookup for MCQ option styling — keeps Tailwind JIT happy.
const OPTION_STYLES = {
    default: "border-border bg-surface hover:border-chart-4/40 hover:bg-chart-4/5",
    correct: "border-primary bg-primary/10",
    wrong: "border-streak/40 bg-streak/10",
    dim: "border-border bg-secondary/50 opacity-50",
    selected: "border-chart-4 bg-chart-4 text-white shadow-soft",
};

const NAV_TILE_STYLES = {
    current: "bg-chart-4 text-white ring-2 ring-chart-4/30",
    correct: "bg-primary/15 text-primary",
    wrong: "bg-streak/15 text-streak",
    idle: "bg-secondary text-muted-foreground hover:bg-secondary/70",
};

export default function AdaptiveReview({ quiz, wrongQuestions, aiFeedback, onComplete, onExit }) {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const [hints, setHints] = useState({});
    const [loadingHint, setLoadingHint] = useState({});
    const [selectedOption, setSelectedOption] = useState({});
    const [isSubmitted, setIsSubmitted] = useState({});
    const [isCorrectMap, setIsCorrectMap] = useState({});
    const [finished, setFinished] = useState(false);

    const current = wrongQuestions[currentIdx];
    const totalWrong = wrongQuestions.length;
    const completedCount = Object.keys(isSubmitted).length;

    const loadHint = async (qIdx) => {
        if (hints[qIdx] || loadingHint[qIdx]) return;
        setLoadingHint(p => ({ ...p, [qIdx]: true }));
        const q = wrongQuestions[qIdx];
        const feedback = aiFeedback[q.originalIndex];
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: "quiz_ai_mark",
                prompt: `${getLatexRules()}

Give a helpful hint for this ${quiz.subject} question. Don't reveal the answer directly.

Question: ${q.question.question}
${q.question.type === 'mcq' ? `Options: ${q.question.options?.map((o, i) => `${i + 1}. ${o}`).join(', ')}` : ''}
${feedback?.student_error_analysis ? `The student's mistake last time: ${feedback.student_error_analysis}` : ''}

Give ONE short, directed hint (2-3 sentences max) that steers them toward the right thinking WITHOUT giving the answer away. Be warm and encouraging.`
            });
            setHints(p => ({ ...p, [qIdx]: res }));
        } catch {
            setHints(p => ({ ...p, [qIdx]: "Think carefully about the key concepts in this topic. Review what you know and approach it step by step." }));
        } finally {
            setLoadingHint(p => ({ ...p, [qIdx]: false }));
        }
    };

    const handleSubmit = (qIdx) => {
        const q = wrongQuestions[qIdx];
        if (q.question.type === 'mcq') {
            const sel = selectedOption[qIdx];
            if (sel === undefined) return;
            const correct = parseInt(sel) === q.question.correct_answer;
            setIsCorrectMap(p => ({ ...p, [qIdx]: correct }));
        }
        setIsSubmitted(p => ({ ...p, [qIdx]: true }));
    };

    const mcqWrong = wrongQuestions.filter(q => q.question.type === 'mcq');
    const mcqCorrectOnRetry = Object.entries(isCorrectMap).filter(([k, v]) => v && wrongQuestions[parseInt(k)]?.question.type === 'mcq').length;
    const shortWrong = wrongQuestions.filter(q => q.question.type !== 'mcq');

    if (finished) {
        return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
                <div className="card-soft bg-chart-4/10 border-chart-4/20 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-chart-4/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-chart-4/15 flex items-center justify-center mx-auto mb-3">
                            <Target className="w-7 h-7 text-chart-4" />
                        </div>
                        <h2 className="text-2xl font-black mb-1 text-foreground">Review Complete!</h2>
                        <p className="text-muted-foreground text-sm mb-6">You pushed through {totalWrong} previously wrong question{totalWrong !== 1 ? 's' : ''}</p>
                        <div className="grid grid-cols-2 gap-3">
                            {mcqWrong.length > 0 && (
                                <div className="card-soft bg-surface p-4">
                                    <p className="stat-num text-chart-4">{mcqCorrectOnRetry}/{mcqWrong.length}</p>
                                    <p className="stat-label mt-1">MCQ correct on retry</p>
                                </div>
                            )}
                            {shortWrong.length > 0 && (
                                <div className="card-soft bg-surface p-4">
                                    <p className="stat-num text-chart-4">{shortWrong.length}</p>
                                    <p className="stat-label mt-1">Short answers reviewed</p>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-5">Great work pushing through the tough ones 💪</p>
                    </div>
                </div>
                <Button onClick={onComplete} className="w-full bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl h-12 font-bold text-base">
                    Done
                </Button>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-3">
            {/* Header */}
            <div className="card-soft bg-chart-4/10 border-chart-4/20 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={onExit} className="w-8 h-8 bg-chart-4/15 hover:bg-chart-4/25 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                        <ArrowLeft className="w-4 h-4 text-chart-4" />
                    </button>
                    <div className="min-w-0">
                        <p className="text-foreground font-bold text-sm flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5 text-chart-4" /> Adaptive Review
                        </p>
                        <p className="text-muted-foreground text-xs">{quiz.title} · {completedCount}/{totalWrong} done</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Target className="w-3.5 h-3.5 text-chart-4" />
                    <span className="text-foreground text-xs font-bold">{totalWrong} to review</span>
                </div>
            </div>

            {/* Progress */}
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div className="h-full bg-chart-4 rounded-full" animate={{ width: `${(completedCount / totalWrong) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>

            {/* Hint banner */}
            <AnimatePresence>
                {hints[currentIdx] && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="card-soft bg-xp/10 border-xp/20 p-4 flex items-start gap-3">
                        <Lightbulb className="w-4 h-4 text-xp flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-xp mb-1 uppercase tracking-wide">Hint</p>
                            <div className="text-sm text-foreground leading-relaxed"><MarkdownMath>{hints[currentIdx]}</MarkdownMath></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Question card */}
            <AnimatePresence mode="wait">
                <motion.div key={currentIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                    className="card-soft overflow-hidden">

                    <div className="px-6 pt-5 pb-4 bg-chart-4/5 border-b border-border">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="pill bg-chart-4/15 text-chart-4">
                                    {current.question.type === 'mcq' ? 'Multiple Choice' : `Short Answer · ${current.question.marks || 5} marks`}
                                </span>
                                <span className="pill bg-streak/15 text-streak">Previously Wrong</span>
                            </div>
                            <span className="text-xs text-muted-foreground/60 font-bold flex-shrink-0">{currentIdx + 1}/{totalWrong}</span>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="text-lg font-semibold text-foreground leading-relaxed"><MathText>{current.question.question}</MathText></div>

                        {current.question.type === 'mcq' ? (
                            <div className="space-y-2.5">
                                {current.question.options?.map((option, i) => {
                                    const isSel = selectedOption[currentIdx]?.toString() === i.toString();
                                    const isCorrectAnswer = i === current.question.correct_answer;
                                    let style = OPTION_STYLES.default;
                                    if (isSubmitted[currentIdx]) {
                                        if (isCorrectAnswer) style = OPTION_STYLES.correct;
                                        else if (isSel && !isCorrectMap[currentIdx]) style = OPTION_STYLES.wrong;
                                        else style = OPTION_STYLES.dim;
                                    } else if (isSel) {
                                        style = OPTION_STYLES.selected;
                                    }
                                    const badgeStyle = isSel && !isSubmitted[currentIdx]
                                        ? 'bg-white/20 text-white'
                                        : isSubmitted[currentIdx] && isCorrectAnswer
                                            ? 'bg-primary text-white'
                                            : isSubmitted[currentIdx] && isSel
                                                ? 'bg-streak text-white'
                                                : 'bg-secondary text-muted-foreground';
                                    return (
                                        <button key={i} disabled={!!isSubmitted[currentIdx]}
                                            onClick={() => !isSubmitted[currentIdx] && setSelectedOption(p => ({ ...p, [currentIdx]: i.toString() }))}
                                            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left transition-all ${style} ${isSubmitted[currentIdx] ? 'cursor-default' : 'cursor-pointer'}`}>
                                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${badgeStyle}`}>
                                                {isSubmitted[currentIdx] && isCorrectAnswer ? <Check className="w-3.5 h-3.5" /> : isSubmitted[currentIdx] && isSel && !isCorrectMap[currentIdx] ? <X className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
                                            </span>
                                            <span className="flex-1 font-medium text-sm"><MathText>{option}</MathText></span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <Textarea placeholder="Re-attempt your answer here..."
                                value={answers[currentIdx] || ""}
                                onChange={(e) => !isSubmitted[currentIdx] && setAnswers(p => ({ ...p, [currentIdx]: e.target.value }))}
                                rows={5} disabled={!!isSubmitted[currentIdx]}
                                className="border-2 border-border focus:border-chart-4 rounded-2xl resize-none text-sm bg-secondary/50 focus:bg-surface placeholder:text-muted-foreground/60" />
                        )}

                        {/* Why wrong last time (before submission) */}
                        {aiFeedback[current.originalIndex] && !isSubmitted[currentIdx] && (
                            <div className="card-soft bg-streak/10 border-streak/20 p-3.5">
                                <p className="text-xs font-bold text-streak mb-1 uppercase tracking-wide">Where you went wrong last time</p>
                                <p className="text-sm text-foreground leading-relaxed">{aiFeedback[current.originalIndex].student_error_analysis}</p>
                            </div>
                        )}

                        {/* Post-submit revelation */}
                        {isSubmitted[currentIdx] && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                {current.question.type === 'mcq' && (
                                    <div className={`rounded-2xl p-4 border-2 ${isCorrectMap[currentIdx] ? 'bg-primary/10 border-primary/30' : 'bg-streak/10 border-streak/30'}`}>
                                        <p className={`text-sm font-bold ${isCorrectMap[currentIdx] ? 'text-primary' : 'text-streak'}`}>
                                            {isCorrectMap[currentIdx] ? '✓ Correct this time! You nailed it.' : '✗ Not quite — review the explanation below carefully.'}
                                        </p>
                                    </div>
                                )}
                                <div className="card-soft bg-chart-3/10 border-chart-3/20 p-4">
                                    <p className="text-xs font-bold text-chart-3 mb-2 uppercase tracking-wide">Full Explanation</p>
                                    <p className="text-sm text-foreground leading-relaxed">{aiFeedback[current.originalIndex]?.correct_answer_explanation || "Review the model answer below."}</p>
                                </div>
                                {current.question.type !== 'mcq' && current.question.model_answer && (
                                    <div className="card-soft bg-primary/10 border-primary/20 p-4">
                                        <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wide">Model Answer</p>
                                        <ReactMarkdown className="text-sm text-foreground prose prose-sm max-w-none">{current.question.model_answer}</ReactMarkdown>
                                    </div>
                                )}
                                {aiFeedback[current.originalIndex]?.how_to_improve && (
                                    <div className="card-soft bg-xp/10 border-xp/20 p-3.5 flex items-start gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-xp flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-foreground leading-relaxed">{aiFeedback[current.originalIndex].how_to_improve}</p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Action row */}
            <div className="flex items-center justify-between gap-3">
                <Button variant="outline" onClick={() => loadHint(currentIdx)}
                    disabled={!!hints[currentIdx] || !!loadingHint[currentIdx]}
                    className="gap-2 rounded-xl border-2 border-xp/30 text-xp hover:bg-xp/10 font-semibold disabled:opacity-50">
                    {loadingHint[currentIdx] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
                    {hints[currentIdx] ? 'Hint shown' : loadingHint[currentIdx] ? 'Loading...' : 'Get a Hint'}
                </Button>

                {!isSubmitted[currentIdx] ? (
                    <Button onClick={() => handleSubmit(currentIdx)}
                        disabled={current.question.type === 'mcq' ? selectedOption[currentIdx] === undefined : !(answers[currentIdx]?.trim())}
                        className="gap-2 rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold px-6">
                        Submit Answer
                    </Button>
                ) : currentIdx < totalWrong - 1 ? (
                    <Button onClick={() => setCurrentIdx(p => p + 1)} className="gap-2 rounded-xl bg-foreground hover:bg-foreground/90 text-background font-bold px-6">
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button onClick={() => setFinished(true)} className="gap-2 rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold px-6">
                        Finish Review ✓
                    </Button>
                )}
            </div>

            {/* Mini navigator */}
            <div className="flex flex-wrap gap-1.5 justify-center">
                {wrongQuestions.map((_, i) => {
                    const tile = i === currentIdx
                        ? NAV_TILE_STYLES.current
                        : isSubmitted[i]
                            ? (isCorrectMap[i] ? NAV_TILE_STYLES.correct : NAV_TILE_STYLES.wrong)
                            : NAV_TILE_STYLES.idle;
                    return (
                        <button key={i} onClick={() => setCurrentIdx(i)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${tile}`}>
                            {i + 1}
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );
}
