import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Lightbulb, ChevronRight, CheckCircle, XCircle, Loader2, Sparkles, Target, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LatexBlock, LatexInline, processLatexContent } from "@/components/shared/LatexRenderer";
import ReactMarkdown from "react-markdown";

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

    const renderLatex = (text) => processLatexContent(text || "").map((part, idx) => {
        if (part.type === 'display') return <LatexBlock key={idx}>{part.content}</LatexBlock>;
        if (part.type === 'inline') return <LatexInline key={idx}>{part.content}</LatexInline>;
        return <span key={idx} className="whitespace-pre-wrap">{part.content}</span>;
    });

    const loadHint = async (qIdx) => {
        if (hints[qIdx] || loadingHint[qIdx]) return;
        setLoadingHint(p => ({ ...p, [qIdx]: true }));
        const q = wrongQuestions[qIdx];
        const feedback = aiFeedback[q.originalIndex];
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                prompt: `Give a helpful hint for this ${quiz.subject} question. Don't reveal the answer directly.

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
                <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-8 text-white text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                        <p className="text-4xl mb-2">🎯</p>
                        <h2 className="text-2xl font-black mb-1">Review Complete!</h2>
                        <p className="text-white/70 text-sm mb-6">You pushed through {totalWrong} previously wrong question{totalWrong !== 1 ? 's' : ''}</p>
                        <div className="grid grid-cols-2 gap-3">
                            {mcqWrong.length > 0 && (
                                <div className="bg-white/10 rounded-2xl p-4">
                                    <p className="text-2xl font-black">{mcqCorrectOnRetry}/{mcqWrong.length}</p>
                                    <p className="text-xs text-white/60 mt-1">MCQ correct on retry</p>
                                </div>
                            )}
                            {shortWrong.length > 0 && (
                                <div className="bg-white/10 rounded-2xl p-4">
                                    <p className="text-2xl font-black">{shortWrong.length}</p>
                                    <p className="text-xs text-white/60 mt-1">Short answers reviewed</p>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-white/50 mt-5">Great work pushing through the tough ones 💪</p>
                    </div>
                </div>
                <Button onClick={onComplete} className="w-full bg-violet-600 hover:bg-violet-700 rounded-xl h-12 font-bold text-base">
                    Done
                </Button>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-3">
            {/* Header */}
            <div className="bg-violet-900 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={onExit} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                        <ArrowLeft className="w-4 h-4 text-white/70" />
                    </button>
                    <div className="min-w-0">
                        <p className="text-white font-bold text-sm flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5 text-violet-300" /> Adaptive Review
                        </p>
                        <p className="text-white/40 text-xs">{quiz.title} · {completedCount}/{totalWrong} done</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Target className="w-3.5 h-3.5 text-violet-300" />
                    <span className="text-white/80 text-xs font-bold">{totalWrong} to review</span>
                </div>
            </div>

            {/* Progress */}
            <div className="h-1 bg-violet-100 rounded-full overflow-hidden">
                <motion.div className="h-full bg-violet-500 rounded-full" animate={{ width: `${(completedCount / totalWrong) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>

            {/* Hint banner */}
            <AnimatePresence>
                {hints[currentIdx] && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-700 mb-1 uppercase tracking-wide">Hint</p>
                            <p className="text-sm text-amber-900 leading-relaxed">{hints[currentIdx]}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Question card */}
            <AnimatePresence mode="wait">
                <motion.div key={currentIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

                    <div className="px-6 pt-5 pb-4 bg-gradient-to-r from-violet-50/60 to-white border-b border-slate-100">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full">
                                    {current.question.type === 'mcq' ? 'Multiple Choice' : `Short Answer · ${current.question.marks || 5} marks`}
                                </span>
                                <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Previously Wrong</span>
                            </div>
                            <span className="text-xs text-slate-300 font-bold flex-shrink-0">{currentIdx + 1}/{totalWrong}</span>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="text-lg font-semibold text-slate-900 leading-relaxed">{renderLatex(current.question.question)}</div>

                        {current.question.type === 'mcq' ? (
                            <div className="space-y-2.5">
                                {current.question.options?.map((option, i) => {
                                    const isSel = selectedOption[currentIdx]?.toString() === i.toString();
                                    const isCorrectAnswer = i === current.question.correct_answer;
                                    let style = "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50";
                                    if (isSubmitted[currentIdx]) {
                                        if (isCorrectAnswer) style = "border-emerald-400 bg-emerald-50";
                                        else if (isSel && !isCorrectMap[currentIdx]) style = "border-red-300 bg-red-50";
                                        else style = "border-slate-100 bg-slate-50 opacity-50";
                                    } else if (isSel) {
                                        style = "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/20";
                                    }
                                    return (
                                        <button key={i} disabled={!!isSubmitted[currentIdx]}
                                            onClick={() => !isSubmitted[currentIdx] && setSelectedOption(p => ({ ...p, [currentIdx]: i.toString() }))}
                                            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left transition-all ${style} ${isSubmitted[currentIdx] ? 'cursor-default' : 'cursor-pointer'}`}>
                                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${isSel && !isSubmitted[currentIdx] ? 'bg-white/20 text-white' : isSubmitted[currentIdx] && isCorrectAnswer ? 'bg-emerald-500 text-white' : isSubmitted[currentIdx] && isSel ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {isSubmitted[currentIdx] && isCorrectAnswer ? <CheckCircle className="w-3.5 h-3.5" /> : isSubmitted[currentIdx] && isSel && !isCorrectMap[currentIdx] ? <XCircle className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
                                            </span>
                                            <span className="flex-1 font-medium text-sm">{renderLatex(option)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <Textarea placeholder="Re-attempt your answer here..."
                                value={answers[currentIdx] || ""}
                                onChange={(e) => !isSubmitted[currentIdx] && setAnswers(p => ({ ...p, [currentIdx]: e.target.value }))}
                                rows={5} disabled={!!isSubmitted[currentIdx]}
                                className="border-2 border-slate-200 focus:border-violet-400 rounded-2xl resize-none text-sm bg-slate-50 focus:bg-white placeholder:text-slate-300" />
                        )}

                        {/* Why wrong last time (before submission) */}
                        {aiFeedback[current.originalIndex] && !isSubmitted[currentIdx] && (
                            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3.5">
                                <p className="text-xs font-bold text-orange-600 mb-1 uppercase tracking-wide">Where you went wrong last time</p>
                                <p className="text-sm text-orange-900 leading-relaxed">{aiFeedback[current.originalIndex].student_error_analysis}</p>
                            </div>
                        )}

                        {/* Post-submit revelation */}
                        {isSubmitted[currentIdx] && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                {current.question.type === 'mcq' && (
                                    <div className={`rounded-2xl p-4 border-2 ${isCorrectMap[currentIdx] ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                        <p className={`text-sm font-bold ${isCorrectMap[currentIdx] ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {isCorrectMap[currentIdx] ? '✓ Correct this time! You nailed it.' : '✗ Not quite — review the explanation below carefully.'}
                                        </p>
                                    </div>
                                )}
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                    <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wide">Full Explanation</p>
                                    <p className="text-sm text-blue-900 leading-relaxed">{aiFeedback[current.originalIndex]?.correct_answer_explanation || "Review the model answer below."}</p>
                                </div>
                                {current.question.type !== 'mcq' && current.question.model_answer && (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                        <p className="text-xs font-bold text-emerald-600 mb-2 uppercase tracking-wide">Model Answer</p>
                                        <ReactMarkdown className="text-sm text-emerald-900 prose prose-sm max-w-none">{current.question.model_answer}</ReactMarkdown>
                                    </div>
                                )}
                                {aiFeedback[current.originalIndex]?.how_to_improve && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 flex items-start gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-900 leading-relaxed">{aiFeedback[current.originalIndex].how_to_improve}</p>
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
                    className="gap-2 rounded-xl border-2 border-amber-200 text-amber-700 hover:bg-amber-50 font-semibold disabled:opacity-50">
                    {loadingHint[currentIdx] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
                    {hints[currentIdx] ? 'Hint shown' : loadingHint[currentIdx] ? 'Loading...' : 'Get a Hint'}
                </Button>

                {!isSubmitted[currentIdx] ? (
                    <Button onClick={() => handleSubmit(currentIdx)}
                        disabled={current.question.type === 'mcq' ? selectedOption[currentIdx] === undefined : !(answers[currentIdx]?.trim())}
                        className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold px-6">
                        Submit Answer
                    </Button>
                ) : currentIdx < totalWrong - 1 ? (
                    <Button onClick={() => setCurrentIdx(p => p + 1)} className="gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold px-6">
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button onClick={() => setFinished(true)} className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-6">
                        Finish Review ✓
                    </Button>
                )}
            </div>

            {/* Mini navigator */}
            <div className="flex flex-wrap gap-1.5 justify-center">
                {wrongQuestions.map((_, i) => (
                    <button key={i} onClick={() => setCurrentIdx(i)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${i === currentIdx ? 'bg-violet-600 text-white ring-2 ring-violet-300' : isSubmitted[i] ? (isCorrectMap[i] ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700') : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {i + 1}
                    </button>
                ))}
            </div>
        </motion.div>
    );
}