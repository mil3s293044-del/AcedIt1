import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft, ArrowRight, CheckCircle, Clock, Wand2, Loader2,
    X, Calculator, Check, ChevronLeft, ChevronRight, Flag,
    BarChart3, Target, Layers, Zap, TrendingUp, AlertCircle, Brain
} from "lucide-react";
import AdaptiveReview from "./AdaptiveReview";
import DifficultyRating from "@/components/shared/DifficultyRating";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import ReactMarkdown from 'react-markdown';
import MathKeyboard from "../shared/MathKeyboard";
import MathInput from "../shared/MathInput";
import { Switch } from "@/components/ui/switch";
import { LatexBlock, LatexInline, processLatexContent } from "../shared/LatexRenderer";

// Sound generation
const playCorrectSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = 800; osc.type = 'sine';
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
        setTimeout(() => {
            const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
            o2.connect(g2); g2.connect(ctx.destination);
            o2.frequency.value = 1000; o2.type = 'sine';
            g2.gain.setValueAtTime(0.3, ctx.currentTime);
            g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            o2.start(ctx.currentTime); o2.stop(ctx.currentTime + 0.3);
        }, 150);
    } catch(e) {}
};

const playIncorrectSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = 200; osc.type = 'sawtooth';
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
};

const shuffleArray = (array) => {
    const s = [...array];
    for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
};

function formatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function QuizPlayer({ quiz, onComplete, onExit }) {
    const [showSaveProgressDialog, setShowSaveProgressDialog] = useState(false);
    const [savedProgressId, setSavedProgressId] = useState(null);

    const [shuffledQuiz] = useState(() => {
        const shuffledQuestions = quiz.questions.map(question => {
            if (question.type === 'mcq' && question.options?.length > 0) {
                const optionsWithIndex = question.options.map((opt, idx) => ({ option: opt, originalIndex: idx }));
                const shuffled = shuffleArray(optionsWithIndex);
                const newCorrectIndex = shuffled.findIndex(item => item.originalIndex === question.correct_answer);
                return { ...question, options: shuffled.map(item => item.option), correct_answer: newCorrectIndex, originalOptions: question.options, originalCorrectAnswer: question.correct_answer };
            }
            return question;
        });
        return { ...quiz, questions: shuffledQuestions };
    });

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [startTime] = useState(Date.now());
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [aiFeedback, setAiFeedback] = useState([]);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);
    const [pastAttempts, setPastAttempts] = useState([]);
    const [mathMode, setMathMode] = useState({});
    const [, forceUpdate] = useState(0);
    const [showKeyboard, setShowKeyboard] = useState({});
    const [cursorPosition, setCursorPosition] = useState({});
    const mathInputRefs = useState({})[0];
    const [currentFeedbackIndex, setCurrentFeedbackIndex] = useState(0);
    const [previousAnswers, setPreviousAnswers] = useState({});
    const [showQuestionMap, setShowQuestionMap] = useState(false);
    const [showAdaptiveReview, setShowAdaptiveReview] = useState(false);
    const [submittedQuestions, setSubmittedQuestions] = useState(new Set());
    const { toast } = useToast();

    const currentQuestion = shuffledQuiz.questions[currentQuestionIndex];
    const totalQ = shuffledQuiz.questions.length;
    const progress = ((currentQuestionIndex) / totalQ) * 100;
    const answeredCount = Object.keys(userAnswers).filter(k => {
        const a = userAnswers[k];
        const q = shuffledQuiz.questions[parseInt(k)];
        return q?.type === 'mcq' ? a !== undefined : (a?.length > 0);
    }).length;

    const saveProgressToDatabase = async () => {
        try {
            const user = await base44.auth.me();
            const progressData = { quiz_id: quiz.id, quiz_title: quiz.title, current_question_index: currentQuestionIndex, user_answers: userAnswers, start_time: startTime, last_updated: new Date().toISOString() };
            if (savedProgressId) {
                await base44.entities.QuizProgress.update(savedProgressId, progressData);
            } else {
                const result = await base44.entities.QuizProgress.create(progressData);
                setSavedProgressId(result.id);
            }
            toast({ title: "Progress saved!", description: "You can continue this quiz later." });
        } catch (error) {
            toast({ title: "Save failed", description: "Could not save progress.", variant: "destructive" });
        }
    };

    const clearSavedProgress = async () => {
        if (savedProgressId) {
            try { await base44.entities.QuizProgress.delete(savedProgressId); setSavedProgressId(null); } catch (e) {}
        }
    };

    useEffect(() => {
        const timer = setInterval(() => forceUpdate(p => p + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const loadPastAttempts = async () => {
            try {
                const attempts = await base44.entities.QuizAttempt.filter({ quiz_id: quiz.id }, '-created_date');
                setPastAttempts(attempts || []);
                if (attempts?.length > 0 && attempts[0].user_answers) setPreviousAnswers(attempts[0].user_answers);
                const user = await base44.auth.me();
                const prog = await base44.entities.QuizProgress.filter({ quiz_id: quiz.id, created_by: user.email }, '-last_updated');
                if (prog?.length > 0) {
                    setCurrentQuestionIndex(prog[0].current_question_index || 0);
                    setUserAnswers(prog[0].user_answers || {});
                    setSavedProgressId(prog[0].id);
                }
            } catch (e) {}
        };
        loadPastAttempts();
        const handleBeforeUnload = (e) => { if (Object.keys(userAnswers).length > 0 && !showResults) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [quiz.id]);

    useEffect(() => {
        const handler = () => {
            if (Object.keys(userAnswers).length > 0 && !showResults) {
                window.dispatchEvent(new CustomEvent('navigation-guard-status', { detail: { hasUnsavedWork: true, onSave: saveProgressToDatabase } }));
            }
        };
        window.addEventListener('navigation-guard-check', handler);
        return () => window.removeEventListener('navigation-guard-check', handler);
    }, [userAnswers, showResults]);

    const isMCQSubmitted = (idx) => {
        const q = shuffledQuiz.questions[idx];
        return q?.type === 'mcq' && submittedQuestions.has(idx);
    };

    const handleAnswerChange = (value) => {
        if (!showFeedback) setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: value }));
    };

    const handleSubmitAnswer = () => {
        const userAnswer = userAnswers[currentQuestionIndex];
        if (currentQuestion.type === 'mcq') {
            if (userAnswer === undefined) { toast({ title: "Select an answer first", variant: "destructive" }); return; }
            const correct = parseInt(userAnswer) === currentQuestion.correct_answer;
            setIsCorrect(correct);
            setShowFeedback(true);
            setSubmittedQuestions(prev => new Set([...prev, currentQuestionIndex]));
            correct ? playCorrectSound() : playIncorrectSound();
            // Fire instant XP animation on correct answer
            if (correct) {
                window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp: 2, source: 'quiz' } }));
            }
            setTimeout(() => handleNext(), 1800);
        } else {
            handleNext();
        }
    };

    const handleNext = () => {
        setShowFeedback(false);
        setIsCorrect(null);
        if (currentQuestionIndex < totalQ - 1) {
            setCurrentQuestionIndex(p => p + 1);
        } else {
            handleFinishQuiz();
        }
    };

    const handleFinishQuiz = async () => {
        await clearSavedProgress();
        recordStudyAndGetStreak().catch(() => {});
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);
        try {
            const user = await base44.auth.me();
            if (user?.email) {
                const tempCorrect = shuffledQuiz.questions.filter((q, i) => q.type === 'mcq' && userAnswers[i] !== undefined && parseInt(userAnswers[i]) === q.correct_answer).length;
                await base44.entities.StudySession.create({ subject: quiz.subject, duration_minutes: Math.ceil(timeTaken / 60), technique: "quiz", notes: `Quiz: ${quiz.title}`, productivity_rating: tempCorrect === quiz.questions.length ? 5 : Math.max(1, Math.ceil((tempCorrect / quiz.questions.length) * 5)), date: new Date().toISOString().split('T')[0] });
                const leaderboardEntries = await base44.entities.Leaderboard.filter({ user_email: user.email });
                if (leaderboardEntries.length > 0) {
                    const entry = leaderboardEntries[0];
                    await base44.entities.Leaderboard.update(entry.id, { total_study_time: (entry.total_study_time || 0) + Math.ceil(timeTaken / 60), total_sessions: (entry.total_sessions || 0) + 1, last_updated: new Date().toISOString() });
                }
            }
        } catch (e) {}
        setShowResults(true);
        await generateAIFeedback(timeTaken);
    };

    const generateAIFeedback = async (timeTaken) => {
        setIsGeneratingFeedback(true);
        try {
            const questionsForAnalysis = shuffledQuiz.questions.map((question, index) => {
                const userAnswer = userAnswers[index];
                const prevAnswer = previousAnswers[index];
                if (question.type === 'mcq') {
                    const selectedOption = userAnswer !== undefined ? question.options[parseInt(userAnswer)] : "No answer provided";
                    const correctOption = question.options[question.correct_answer];
                    return { q_num: index + 1, type: 'mcq', question: question.question, student_answer: selectedOption, correct_answer: correctOption, is_correct: parseInt(userAnswer) === question.correct_answer };
                } else {
                    return { q_num: index + 1, type: 'short', question: question.question, student_answer: userAnswer || "No answer provided", previous_answer: prevAnswer || null, model_answer: question.model_answer || "Not provided", marks_allocation: question.marks || 5 };
                }
            });

            const hasShortWithPrevious = questionsForAnalysis.some(q => q.type === 'short' && q.previous_answer);
            const comparisonInstructions = hasShortWithPrevious ? `\nFor short answers with a "Previous Answer", compare current vs previous attempt specifically.` : '';

            let sourceFileUrl = shuffledQuiz.source_file_url;
            let sourceFileContent = '';
            if (sourceFileUrl) {
                const ext = sourceFileUrl.split('.').pop()?.toLowerCase().split('?')[0];
                if (ext === 'docx' || ext === 'pptx') {
                    try {
                        const textResult = await base44.functions.invoke('extractDocumentText', { file_url: sourceFileUrl });
                        sourceFileContent = `\n\nSource Document Content:\n${textResult.data?.text || ''}\n\n`;
                        sourceFileUrl = undefined;
                    } catch (e) {}
                }
            }

            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `Mark this ${shuffledQuiz.subject} quiz. Provide feedback for ALL ${questionsForAnalysis.length} questions.${sourceFileContent}${comparisonInstructions}

MARKING: MCQ = 0 or 1 mark only. Short answer = 0 to allocation marks. Be lenient on phrasing.

${questionsForAnalysis.map(q => `Q${q.q_num} [${q.type.toUpperCase()}]${q.type === 'short' ? ` - ${q.marks_allocation} marks` : ''}:
Question: ${q.question}
Student Answer: ${q.student_answer}${q.type === 'short' && q.previous_answer ? `\nPrevious Answer: ${q.previous_answer}` : ''}
${q.type === 'mcq' ? `Correct Answer: ${q.correct_answer}` : `Model Answer: ${q.model_answer}`}`).join('\n---\n')}

For EACH question: marks, understanding, why_correct, what_wrong, strength, improve${hasShortWithPrevious ? ', comparison' : ''}.
Return exactly ${questionsForAnalysis.length} items.`,
                file_urls: sourceFileUrl ? [sourceFileUrl] : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        feedback: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    marks: { type: "number" },
                                    understanding: { type: "string" },
                                    why_correct: { type: "string" },
                                    what_wrong: { type: "string" },
                                    strength: { type: "string" },
                                    improve: { type: "string" },
                                    comparison: { type: "string" }
                                },
                                required: ["marks", "understanding", "why_correct", "what_wrong", "strength", "improve"]
                            }
                        }
                    },
                    required: ["feedback"]
                }
            });

            if (!response?.feedback?.length) throw new Error("AI returned invalid format");

            const mappedFeedback = response.feedback.map(item => ({
                marks: item.marks || 0,
                student_understanding: item.understanding || "No analysis provided",
                correct_answer_explanation: item.why_correct || "Explanation not provided",
                student_error_analysis: item.what_wrong || "No errors noted",
                strengths: item.strength || "N/A",
                how_to_improve: item.improve || "Keep practicing",
                comparison_to_previous: item.comparison || null
            }));

            setAiFeedback(mappedFeedback);

            const finalScore = calcScoreFromFeedback(mappedFeedback);
            const questionsCorrect = mappedFeedback.filter((fb, idx) => {
                const q = shuffledQuiz.questions[idx];
                return q?.type === 'mcq' ? fb.marks === 1 : fb.marks >= (q?.marks || 5) * 0.8;
            }).length;

            // Award 2 XP per correct mark after AI marking
            const totalMarksAwarded = mappedFeedback.reduce((sum, fb) => sum + (fb.marks || 0), 0);
            const xpEarned = totalMarksAwarded * 2;
            if (xpEarned > 0) {
                window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp: xpEarned, source: 'quiz_marked' } }));
            }

            try {
                await base44.entities.QuizAttempt.create({ quiz_id: quiz.id, quiz_title: quiz.title, quiz_category: quiz.category, score: finalScore, questions_total: totalQ, questions_correct: questionsCorrect, time_taken: timeTaken, xp_earned: xpEarned, user_answers: userAnswers, date: new Date().toISOString().split('T')[0] });
            } catch (e) {}

            toast({ title: "✅ Quiz marked!", description: `AI analysed all ${mappedFeedback.length} questions.` });
        } catch (error) {
            setAiFeedback([]);
            toast({ title: "AI Marking Failed", description: error.message || "Could not analyse answers.", variant: "destructive" });
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    const calcScoreFromFeedback = (feedback) => {
        if (feedback.length !== shuffledQuiz.questions.length) return 0;
        let total = 0, max = 0;
        shuffledQuiz.questions.forEach((q, i) => {
            const fb = feedback[i];
            if (!fb) return;
            if (q.type === 'mcq') { total += fb.marks || 0; max += 1; }
            else { total += fb.marks || 0; max += q.marks || 5; }
        });
        return max > 0 ? Math.round((total / max) * 100) : 0;
    };

    const overallScore = calcScoreFromFeedback(aiFeedback);
    const getCurrentAnswer = () => userAnswers[currentQuestionIndex];

    // ─── RESULTS VIEW ──────────────────────────────────────────────────────────
    // ─── ADAPTIVE REVIEW ───────────────────────────────────────────────────────
    if (showAdaptiveReview) {
        const wrongQuestions = shuffledQuiz.questions
            .map((q, i) => ({ question: q, originalIndex: i }))
            .filter(({ question, originalIndex }) => {
                const fb = aiFeedback[originalIndex];
                if (!fb) return false;
                if (question.type === 'mcq') return fb.marks < 1;
                return fb.marks < (question.marks || 5) * 0.6;
            });
        return (
            <div className="max-w-2xl mx-auto py-4">
                <AdaptiveReview
                    quiz={shuffledQuiz}
                    wrongQuestions={wrongQuestions}
                    aiFeedback={aiFeedback}
                    onComplete={() => { setShowAdaptiveReview(false); onExit(); }}
                    onExit={() => setShowAdaptiveReview(false)}
                />
            </div>
        );
    }

    if (showResults) {
        const previousAttempt = pastAttempts[0];
        const improvement = previousAttempt ? overallScore - previousAttempt.score : null;
        const currentQ = shuffledQuiz.questions[currentFeedbackIndex];
        const currentFeedback = aiFeedback[currentFeedbackIndex];
        const currentUserAnswer = userAnswers[currentFeedbackIndex];
        const grade = overallScore >= 85 ? { label: "Outstanding", emoji: "🏆", color: "from-amber-500 to-yellow-400" }
            : overallScore >= 70 ? { label: "Great Work", emoji: "⭐", color: "from-emerald-500 to-teal-400" }
            : overallScore >= 55 ? { label: "Good Effort", emoji: "📈", color: "from-blue-500 to-indigo-400" }
            : { label: "Keep Going", emoji: "📚", color: "from-slate-600 to-slate-500" };

        return (
            <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
                {/* Top bar */}
                <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-slate-100 shadow-sm">
                    <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button onClick={async () => { await clearSavedProgress(); onExit(); }} variant="ghost" size="sm" className="gap-2 rounded-xl hover:bg-slate-100">
                                <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline font-semibold">Exit</span>
                            </Button>
                            <div className="h-5 w-px bg-slate-200" />
                            <div>
                                <h1 className="text-sm lg:text-base font-bold text-slate-900 truncate max-w-[200px] lg:max-w-none">{shuffledQuiz.title}</h1>
                                <p className="text-xs text-slate-400">{shuffledQuiz.subject}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isGeneratingFeedback && (
                                <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full font-medium">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Marking...
                                </div>
                            )}
                            <div className={`px-3 py-1.5 rounded-xl font-black text-sm ${overallScore >= 70 ? 'bg-emerald-100 text-emerald-700' : overallScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {isGeneratingFeedback ? '—' : `${overallScore}%`}
                            </div>
                            {improvement !== null && improvement !== 0 && !isGeneratingFeedback && (
                                <div className={`hidden sm:flex px-2 py-1 rounded-lg text-xs font-bold ${improvement > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                                    {improvement > 0 ? `+${improvement}%` : `${improvement}%`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Questions</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {shuffledQuiz.questions.map((q, index) => {
                                const fb = aiFeedback[index];
                                const isActive = currentFeedbackIndex === index;
                                let bg = 'bg-slate-50 text-slate-500 border-slate-100';
                                let badge = null;
                                if (fb) {
                                    if (q.type === 'mcq') {
                                        bg = fb.marks === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100';
                                        badge = fb.marks === 1 ? '✓' : '✗';
                                    } else {
                                        const pct = (fb.marks / (q.marks || 5)) * 100;
                                        bg = pct >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : pct >= 50 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100';
                                        badge = `${fb.marks}/${q.marks || 5}`;
                                    }
                                }
                                return (
                                    <button key={index} onClick={() => setCurrentFeedbackIndex(index)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : `${bg} hover:opacity-80`}`}>
                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-white/70'}`}>{index + 1}</span>
                                        <span className="text-xs font-medium flex-1 truncate">{q.type === 'mcq' ? 'MCQ' : 'Short Answer'}</span>
                                        {badge && <span className="text-xs font-bold">{badge}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main area */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Mobile question pills */}
                        <div className="lg:hidden flex-shrink-0 bg-white border-b border-slate-100 px-4 py-2.5 overflow-x-auto">
                            <div className="flex gap-1.5">
                                {shuffledQuiz.questions.map((q, index) => {
                                    const fb = aiFeedback[index];
                                    const isActive = currentFeedbackIndex === index;
                                    let bg = 'bg-slate-200 text-slate-600';
                                    if (fb) { bg = q.type === 'mcq' ? (fb.marks === 1 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : ((fb.marks / (q.marks || 5)) >= 0.8 ? 'bg-emerald-500 text-white' : (fb.marks / (q.marks || 5)) >= 0.5 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'); }
                                    return (
                                        <button key={index} onClick={() => setCurrentFeedbackIndex(index)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${bg} ${isActive ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}>
                                            {index + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-4">
                                {/* Score hero (only on first question) */}
                                {currentFeedbackIndex === 0 && !isGeneratingFeedback && aiFeedback.length > 0 && (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                        <div className={`bg-gradient-to-br ${grade.color} rounded-3xl p-6 text-white text-center relative overflow-hidden`}>
                                            <div className="absolute inset-0 opacity-20"><div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" /></div>
                                            <div className="relative">
                                                <p className="text-3xl mb-1">{grade.emoji}</p>
                                                <p className="text-5xl font-black">{overallScore}%</p>
                                                <p className="text-white/80 font-semibold mt-1">{grade.label}</p>
                                                <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-white/20 text-center">
                                                    <div><p className="text-xl font-black">{aiFeedback.filter((fb, i) => shuffledQuiz.questions[i]?.type === 'mcq' ? fb.marks === 1 : fb.marks >= (shuffledQuiz.questions[i]?.marks || 5) * 0.8).length}</p><p className="text-xs text-white/60">Correct</p></div>
                                                    <div><p className="text-xl font-black">{totalQ}</p><p className="text-xs text-white/60">Total</p></div>
                                                    <div><p className="text-xl font-black font-mono">{formatElapsed(Date.now() - startTime)}</p><p className="text-xs text-white/60">Time</p></div>
                                                </div>
                                            </div>
                                        </div>
                                        {shuffledQuiz.subject && (
                                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                                <DifficultyRating subjectName={shuffledQuiz.subject} />
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Question card */}
                                <AnimatePresence mode="wait">
                                    <motion.div key={currentFeedbackIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                                        className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="px-6 pt-5 pb-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${currentQ.type === 'mcq' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        {currentQ.type === 'mcq' ? 'Multiple Choice' : `Short Answer • ${currentQ.marks || 5} marks`}
                                                    </span>
                                                </div>
                                                {currentFeedback && (
                                                    <span className={`text-sm font-black px-3 py-1 rounded-xl ${currentQ.type === 'mcq' ? (currentFeedback.marks === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700') : (() => { const p = (currentFeedback.marks / (currentQ.marks || 5)) * 100; return p >= 80 ? 'bg-emerald-100 text-emerald-700' : p >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'; })()}`}>
                                                        {currentQ.type === 'mcq' ? `${currentFeedback.marks}/1` : `${currentFeedback.marks}/${currentQ.marks || 5}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-6 space-y-5">
                                            <div className="text-lg font-semibold text-slate-900 leading-relaxed">
                                                {processLatexContent(currentQ.question || "").map((part, idx) => {
                                                    if (part.type === 'display') return <LatexBlock key={idx}>{part.content}</LatexBlock>;
                                                    if (part.type === 'inline') return <LatexInline key={idx}>{part.content}</LatexInline>;
                                                    return <span key={idx}>{part.content}</span>;
                                                })}
                                            </div>

                                            {currentQ.type === 'mcq' ? (
                                                <div className="space-y-2">
                                                    {currentQ.options?.map((option, oi) => {
                                                        const isCorr = oi === currentQ.correct_answer;
                                                        const isUser = currentUserAnswer !== undefined && parseInt(currentUserAnswer) === oi;
                                                        return (
                                                            <div key={oi} className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border-2 ${isCorr ? 'bg-emerald-50 border-emerald-300' : isUser ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-100'}`}>
                                                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${isCorr ? 'bg-emerald-500 text-white' : isUser ? 'bg-red-500 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                                                    {isCorr ? <Check className="w-3.5 h-3.5" /> : isUser ? <X className="w-3.5 h-3.5" /> : String.fromCharCode(65 + oi)}
                                                                </span>
                                                                <div className="flex-1">
                                                                    <p className={`text-sm font-medium ${isCorr ? 'text-emerald-800' : isUser ? 'text-red-800' : 'text-slate-600'}`}>{option}</p>
                                                                    {isCorr && <p className="text-xs text-emerald-600 font-bold mt-0.5">Correct Answer</p>}
                                                                    {isUser && !isCorr && <p className="text-xs text-red-600 font-bold mt-0.5">Your Answer</p>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Your Answer</p>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentUserAnswer || <span className="text-slate-300 italic">No answer written</span>}</p>
                                                    </div>
                                                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                                                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">Model Answer</p>
                                                        <ReactMarkdown className="text-sm text-emerald-900 prose prose-sm max-w-none">{currentQ.model_answer || "No model answer provided"}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Feedback */}
                                            {currentFeedback ? (
                                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Wand2 className="w-3.5 h-3.5" /> AI Feedback
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        {[
                                                            { label: "Why This Answer", content: currentFeedback.correct_answer_explanation, bg: "bg-blue-50 border-blue-100", text: "text-blue-700", body: "text-blue-900" },
                                                            { label: "Your Understanding", content: currentFeedback.student_understanding, bg: "bg-purple-50 border-purple-100", text: "text-purple-700", body: "text-purple-900" },
                                                            { label: "Strengths", content: currentFeedback.strengths, bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", body: "text-emerald-900" },
                                                            { label: "How to Improve", content: currentFeedback.how_to_improve, bg: "bg-amber-50 border-amber-100", text: "text-amber-700", body: "text-amber-900" },
                                                        ].map(item => (
                                                            <div key={item.label} className={`${item.bg} border rounded-2xl p-3.5`}>
                                                                <p className={`text-xs font-bold ${item.text} uppercase tracking-wide mb-1.5`}>{item.label}</p>
                                                                <p className={`text-xs ${item.body} leading-relaxed`}>{item.content}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {currentFeedback.comparison_to_previous && (
                                                        <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-3.5">
                                                            <p className="text-xs font-bold text-cyan-700 uppercase tracking-wide mb-1.5">vs Last Attempt</p>
                                                            <p className="text-xs text-cyan-900 leading-relaxed">{currentFeedback.comparison_to_previous}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isGeneratingFeedback ? (
                                                <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="text-sm">AI is marking this question...</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Bottom nav */}
                        <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-slate-100 px-4 lg:px-6 py-3">
                            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                                <Button variant="outline" onClick={() => setCurrentFeedbackIndex(p => Math.max(0, p - 1))} disabled={currentFeedbackIndex === 0} className="gap-2 rounded-xl border-2 border-slate-200 font-semibold">
                                    <ChevronLeft className="w-4 h-4" /> Prev
                                </Button>
                                {!isGeneratingFeedback && aiFeedback.length > 0 && (() => {
                                    const wrongCount = shuffledQuiz.questions.filter((q, i) => {
                                        const fb = aiFeedback[i];
                                        if (!fb) return false;
                                        return q.type === 'mcq' ? fb.marks < 1 : fb.marks < (q.marks || 5) * 0.6;
                                    }).length;
                                    return wrongCount > 0 ? (
                                        <Button onClick={() => setShowAdaptiveReview(true)}
                                            className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs px-3">
                                            <Brain className="w-3.5 h-3.5" /> Review {wrongCount} Wrong
                                        </Button>
                                    ) : null;
                                })()}
                                <Button variant="outline" onClick={() => setCurrentFeedbackIndex(p => Math.min(totalQ - 1, p + 1))} disabled={currentFeedbackIndex === totalQ - 1} className="gap-2 rounded-xl border-2 border-slate-200 font-semibold">
                                    Next <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── QUIZ TAKING VIEW ──────────────────────────────────────────────────────
    return (
        <>
            <Dialog open={showSaveProgressDialog} onOpenChange={setShowSaveProgressDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save your progress?</DialogTitle></DialogHeader>
                    <p className="text-slate-600 text-sm">You're {Math.round(((currentQuestionIndex + 1) / totalQ) * 100)}% through. Want to save and continue later?</p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={async () => { await clearSavedProgress(); setShowSaveProgressDialog(false); onExit(); }}>Don't Save</Button>
                        <Button onClick={async () => { await saveProgressToDatabase(); setShowSaveProgressDialog(false); onExit(); }} className="bg-emerald-600 hover:bg-emerald-700">Save & Exit</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-3">

                {/* Header */}
                <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => { if (Object.keys(userAnswers).length > 0) setShowSaveProgressDialog(true); else onExit(); }}
                            className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                            <X className="w-4 h-4 text-white/70" />
                        </button>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{shuffledQuiz.title}</p>
                            <p className="text-white/40 text-xs">{shuffledQuiz.subject} · {answeredCount}/{totalQ} answered</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1.5 text-white/60 text-sm font-mono font-bold">
                            <Clock className="w-4 h-4" />
                            {formatElapsed(Date.now() - startTime)}
                        </div>
                        <button onClick={() => setShowQuestionMap(v => !v)}
                            className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                            <Layers className="w-4 h-4 text-white/70" />
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
                </div>

                {/* Question map */}
                <AnimatePresence>
                    {showQuestionMap && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            className="bg-white rounded-2xl border border-slate-100 p-4 overflow-hidden">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Jump to Question</p>
                            <div className="flex flex-wrap gap-1.5">
                                {shuffledQuiz.questions.map((q, i) => {
                                    const a = userAnswers[i];
                                    const done = q.type === 'mcq' ? a !== undefined : (a?.length > 0);
                                    const submitted = submittedQuestions.has(i);
                                    return (
                                        <button key={i}
                                            onClick={() => { if (!submitted) { setCurrentQuestionIndex(i); setShowFeedback(false); setIsCorrect(null); setShowQuestionMap(false); } }}
                                            disabled={submitted}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === currentQuestionIndex ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : submitted ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                            {i + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Question card */}
                <AnimatePresence mode="wait">
                    <motion.div key={currentQuestionIndex}
                        initial={{ opacity: 0, x: 30, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -30, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

                        {/* Card header */}
                        <div className="px-6 pt-5 pb-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${currentQuestion.type === 'mcq' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {currentQuestion.type === 'mcq' ? 'Multiple Choice' : `Short Answer · ${currentQuestion.marks || 5} marks`}
                                    </span>
                                    {showFeedback && (
                                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                        </motion.span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-slate-300">{currentQuestionIndex + 1} / {totalQ}</span>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="text-lg font-semibold text-slate-900 leading-relaxed">
                                {processLatexContent(currentQuestion.question || "").map((part, idx) => {
                                    if (part.type === 'display') return <LatexBlock key={idx}>{part.content}</LatexBlock>;
                                    if (part.type === 'inline') return <LatexInline key={idx}>{part.content}</LatexInline>;
                                    return <span key={idx}>{part.content}</span>;
                                })}
                            </div>

                            {currentQuestion.type === 'mcq' ? (
                                <div className="space-y-2.5">
                                    {currentQuestion.options?.map((option, index) => {
                                        const isSelected = getCurrentAnswer()?.toString() === index.toString();
                                        const isCorrectAnswer = index === currentQuestion.correct_answer;
                                        let style = "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 text-slate-700";
                                        if (showFeedback) {
                                            if (isCorrectAnswer) style = "border-emerald-400 bg-emerald-50 text-emerald-900";
                                            else if (isSelected && !isCorrect) style = "border-red-400 bg-red-50 text-red-900";
                                            else style = "border-slate-100 bg-slate-50 text-slate-400";
                                        } else if (isSelected) {
                                            style = "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
                                        }
                                        return (
                                            <motion.button key={index} type="button" disabled={showFeedback}
                                                whileHover={!showFeedback ? { scale: 1.005 } : {}}
                                                whileTap={!showFeedback ? { scale: 0.998 } : {}}
                                                onClick={() => !showFeedback && handleAnswerChange(index.toString())}
                                                className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left transition-all duration-150 ${style} ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}>
                                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${isSelected && !showFeedback ? 'bg-white/20 text-white' : showFeedback && isCorrectAnswer ? 'bg-emerald-500 text-white' : showFeedback && isSelected && !isCorrect ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100'}`}>
                                                    {showFeedback && isCorrectAnswer ? <Check className="w-3.5 h-3.5" /> : showFeedback && isSelected && !isCorrect ? <X className="w-3.5 h-3.5" /> : String.fromCharCode(65 + index)}
                                                </span>
                                                <span className="flex-1 font-medium text-sm">{option}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400 font-medium">Write a detailed answer below</span>
                                        <div className="flex items-center gap-2">
                                            <Calculator className="w-3.5 h-3.5 text-slate-400" />
                                            <Switch checked={mathMode[currentQuestionIndex] || false} onCheckedChange={(v) => { setMathMode(p => ({ ...p, [currentQuestionIndex]: v })); setShowKeyboard(p => ({ ...p, [currentQuestionIndex]: v })); }} />
                                            <Label className="text-xs text-slate-500 cursor-pointer">Math</Label>
                                        </div>
                                    </div>
                                    {mathMode[currentQuestionIndex] ? (
                                        <>
                                            <MathInput value={getCurrentAnswer() || ""} onChange={(value) => handleAnswerChange(value)}
                                                onCursorPositionChange={(pos) => setCursorPosition(p => ({ ...p, [currentQuestionIndex]: pos }))}
                                                textareaRef={(ref) => { if (ref) mathInputRefs[currentQuestionIndex] = ref; }}
                                                placeholder="Write your answer here..." rows={6}
                                                className="w-full rounded-2xl border-2 border-slate-200 focus-within:border-indigo-400" />
                                            <MathKeyboard
                                                getCurrentValue={() => getCurrentAnswer() || ""}
                                                onInput={(value, options = {}) => {
                                                    let current = getCurrentAnswer() || "";
                                                    const textarea = mathInputRefs[currentQuestionIndex];
                                                    const pos = textarea?.selectionStart ?? current.length;
                                                    let newValue, newCursor;
                                                    if (options.replaceLastToken && current.trim()) {
                                                        const beforeCursor = current.substring(0, pos);
                                                        const tokens = beforeCursor.match(/[\d.]+|[a-zA-Z]+|[^\s\w]/g) || [];
                                                        if (tokens.length > 0) {
                                                            const lastToken = tokens[tokens.length - 1];
                                                            if (/^[\d.]+$/.test(lastToken)) {
                                                                const lastTokenPos = beforeCursor.lastIndexOf(lastToken);
                                                                const rep = value.replace(/^x/, lastToken);
                                                                newValue = current.substring(0, lastTokenPos) + rep + current.substring(pos);
                                                                newCursor = lastTokenPos + rep.length;
                                                                handleAnswerChange(newValue);
                                                                setCursorPosition(p => ({ ...p, [currentQuestionIndex]: newCursor }));
                                                                setTimeout(() => { if (textarea) { textarea.selectionStart = newCursor; textarea.selectionEnd = newCursor; textarea.focus(); } }, 0);
                                                                return;
                                                            }
                                                        }
                                                    }
                                                    newValue = current.substring(0, pos) + value + current.substring(pos);
                                                    newCursor = pos + value.length;
                                                    handleAnswerChange(newValue);
                                                    setCursorPosition(p => ({ ...p, [currentQuestionIndex]: newCursor }));
                                                    setTimeout(() => { if (textarea) { textarea.selectionStart = newCursor; textarea.selectionEnd = newCursor; textarea.focus(); } }, 0);
                                                }}
                                                onBackspace={() => {
                                                    const current = getCurrentAnswer() || "";
                                                    const textarea = mathInputRefs[currentQuestionIndex];
                                                    const pos = textarea?.selectionStart ?? current.length;
                                                    if (pos > 0) {
                                                        const nv = current.substring(0, pos - 1) + current.substring(pos);
                                                        const nc = pos - 1;
                                                        handleAnswerChange(nv);
                                                        setCursorPosition(p => ({ ...p, [currentQuestionIndex]: nc }));
                                                        setTimeout(() => { if (textarea) { textarea.selectionStart = nc; textarea.selectionEnd = nc; textarea.focus(); } }, 0);
                                                    }
                                                }}
                                                onClear={() => { handleAnswerChange(""); setCursorPosition(p => ({ ...p, [currentQuestionIndex]: 0 })); const textarea = mathInputRefs[currentQuestionIndex]; setTimeout(() => { if (textarea) { textarea.selectionStart = 0; textarea.selectionEnd = 0; textarea.focus(); } }, 0); }}
                                            />
                                        </>
                                    ) : (
                                        <Textarea placeholder="Write your answer here..." value={getCurrentAnswer() || ""} onChange={(e) => handleAnswerChange(e.target.value)}
                                            rows={6} className="border-2 border-slate-200 focus:border-indigo-400 rounded-2xl resize-none text-sm bg-slate-50 focus:bg-white transition-colors placeholder:text-slate-300" />
                                    )}
                                    {getCurrentAnswer()?.length > 0 && !mathMode[currentQuestionIndex] && (
                                        <p className="text-xs text-slate-400 text-right">{getCurrentAnswer().length} chars</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))}
                        disabled={showFeedback || currentQuestionIndex === 0}
                        className="gap-2 rounded-xl border-2 border-slate-200 font-semibold hover:bg-slate-50">
                        <ChevronLeft className="w-4 h-4" /> Prev
                    </Button>

                    <Button onClick={currentQuestion.type === 'mcq' ? handleSubmitAnswer : handleNext}
                        disabled={showFeedback}
                        className={`gap-2 rounded-xl font-bold px-8 h-11 transition-all hover:scale-[1.02] ${currentQuestionIndex === totalQ - 1 ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                        {currentQuestionIndex === totalQ - 1 ? (
                            <><Flag className="w-4 h-4" /> {currentQuestion.type === 'mcq' ? 'Submit & Finish' : 'Finish Quiz'}</>
                        ) : (
                            <>{currentQuestion.type === 'mcq' ? 'Submit' : 'Next'} <ChevronRight className="w-4 h-4" /></>
                        )}
                    </Button>
                </div>
            </motion.div>
        </>
    );
}