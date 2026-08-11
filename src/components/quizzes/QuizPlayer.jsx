import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft, Clock, Wand2, Loader2,
    X, Calculator, Check, ChevronLeft, ChevronRight, Flag, Layers, TrendingUp, Brain,
    Trophy, Star, BookOpen, Bookmark, BookmarkCheck
} from "lucide-react";
import AdaptiveReview from "./AdaptiveReview";
import DifficultyRating from "@/components/shared/DifficultyRating";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { commandTermOf } from "@/lib/quizInsight";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MathKeyboard from "../shared/MathKeyboard";
import MathInput from "../shared/MathInput";
import { Switch } from "@/components/ui/switch";
import MarkdownMath from "@/components/shared/MarkdownMath";
import MathText from "@/components/shared/LatexRenderer";
import { getLatexRules } from "@/lib/subjectExaminerPrompts";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { fireXPFeedback } from "../ranked/XPFeedback";

// ─── Static class lookup tables (no dynamic Tailwind interpolation) ──────────
const CHOICE_STATE = {
    default:   'border-2 border-border bg-surface text-foreground hover:border-chart-3/40 hover:bg-chart-3/5',
    selected:  'border-2 border-chart-3 bg-chart-3/10 text-foreground',
    correct:   'border-2 border-primary bg-primary/10 text-foreground',
    incorrect: 'border-2 border-streak bg-streak/10 text-foreground',
    disabled:  'border-2 border-border bg-secondary/50 text-muted-foreground',
};

const CHOICE_BADGE = {
    default:   'bg-secondary text-muted-foreground',
    selected:  'bg-chart-3 text-white',
    correct:   'bg-primary text-white',
    incorrect: 'bg-streak text-white',
    disabled:  'bg-secondary text-muted-foreground',
};

const SCORE_TIER = {
    excellent: { tile: 'bg-primary/10',  text: 'text-primary',  border: 'border-primary/20',  badge: 'bg-primary/15 text-primary',  label: 'Excellent', icon: Trophy },
    good:      { tile: 'bg-chart-3/10',  text: 'text-chart-3',  border: 'border-chart-3/20',  badge: 'bg-chart-3/15 text-chart-3',  label: 'Good',      icon: Star },
    okay:      { tile: 'bg-xp/10',       text: 'text-xp',       border: 'border-xp/20',       badge: 'bg-xp/15 text-xp',            label: 'Okay',      icon: TrendingUp },
    poor:      { tile: 'bg-streak/10',   text: 'text-streak',   border: 'border-streak/20',   badge: 'bg-streak/15 text-streak',    label: 'Needs review', icon: BookOpen },
};

const tierFromScore = (score) => {
    if (score >= 85) return SCORE_TIER.excellent;
    if (score >= 70) return SCORE_TIER.good;
    if (score >= 55) return SCORE_TIER.okay;
    return SCORE_TIER.poor;
};

// Mark-percentage → verdict tile (used for per-question score badges)
const markTier = (pct) => {
    if (pct >= 80) return SCORE_TIER.excellent;
    if (pct >= 50) return SCORE_TIER.okay;
    return SCORE_TIER.poor;
};

// AI feedback panel palette — uses chart-4 as the special/explanation accent.
const FEEDBACK_PANEL = {
    explanation:   'bg-chart-3/10 border-chart-3/20 text-chart-3',
    understanding: 'bg-chart-4/10 border-chart-4/20 text-chart-4',
    strengths:     'bg-primary/10 border-primary/20 text-primary',
    improve:       'bg-xp/10 border-xp/20 text-xp',
    comparison:    'bg-chart-4/10 border-chart-4/20 text-chart-4',
};

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
    } catch {}
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
    } catch {}
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

// SelfMarkBox — appears below "No answer written" on short-answer questions
// the student left blank. Lets them claim a mark for paper-and-pen work after
// comparing to the model answer above. Marks count toward the displayed total
// only — they don't earn XP, so goals/leaderboards stay protected.
function SelfMarkBox({ maxMarks, currentMark, onMark, onClear }) {
    const [editing, setEditing] = React.useState(currentMark === undefined);
    const [draft, setDraft] = React.useState(currentMark ?? "");

    if (currentMark !== undefined && !editing) {
        return (
            <div className="rounded-xl border-2 border-xp/40 bg-xp/5 px-3 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-xp/15 text-xp flex items-center justify-center font-extrabold text-sm tabular-nums">
                    {currentMark}/{maxMarks}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">Self-marked from your paper</p>
                    <p className="text-[10px] text-muted-foreground">Counts toward your total · doesn't earn XP</p>
                </div>
                <button
                    type="button"
                    onClick={() => { setDraft(currentMark); setEditing(true); }}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary"
                >
                    Edit
                </button>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-xs font-bold text-muted-foreground hover:text-streak px-2 py-1 rounded-md hover:bg-streak/10"
                >
                    Clear
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-xl border-2 border-dashed border-border bg-surface px-3 py-3 space-y-2">
            <p className="text-xs font-bold text-foreground">Did you answer this on paper?</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
                Compare your written answer to the model answer above. Award yourself the marks you'd give. <strong className="text-foreground">XP isn't affected</strong> — this just updates your displayed total.
            </p>
            <div className="flex items-center gap-2 pt-1">
                <input
                    type="number"
                    min={0}
                    max={maxMarks}
                    step={0.5}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`0 – ${maxMarks}`}
                    className="w-20 text-sm font-bold tabular-nums px-2.5 py-1.5 rounded-lg border-2 border-border bg-surface focus:border-primary focus:outline-none"
                    aria-label="Marks to claim"
                />
                <span className="text-sm font-bold text-muted-foreground tabular-nums">/ {maxMarks}</span>
                <button
                    type="button"
                    disabled={draft === "" || isNaN(Number(draft))}
                    onClick={() => {
                        const n = Math.max(0, Math.min(maxMarks, Number(draft)));
                        onMark(n);
                        setEditing(false);
                    }}
                    className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg bg-xp text-white hover:bg-xp/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Save mark
                </button>
            </div>
        </div>
    );
}

export default function QuizPlayer({ quiz, onExit, mode = "standard", timeLimitMs = null }) {
    const isSAC = mode === "sac" && timeLimitMs > 0;
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
    // Re-render every second so the elapsed/countdown clock actually ticks.
    const [, setClockTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setClockTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, []);
    const remainingMs = timeLimitMs ? Math.max(0, timeLimitMs - (Date.now() - startTime)) : null;

    // ─── Self-marked marks (paper-and-pen workflow) ─────────────────────────
    // Map of { [questionIndex]: numberOfMarksAwarded }. Only allowed on short
    // answer questions the student LEFT BLANK — that's the signal they did the
    // work on paper. Self-marked marks update the displayed total score on
    // the results page but DO NOT affect XP or the saved score field, so
    // goals / leaderboards stay protected from inflation.
    const [selfMarkedMarks, setSelfMarkedMarks] = useState({});
    // QuizAttempt.id captured after the row is created in handleFinishQuiz, so
    // self-mark edits can persist back to the same row (debounced below).
    const [createdAttemptId, setCreatedAttemptId] = useState(null);

    // SAC mode: auto-submit when the timer hits zero.
    const [autoSubmitted, setAutoSubmitted] = useState(false);
    useEffect(() => {
        if (!isSAC || autoSubmitted || showResults) return;
        if (remainingMs !== null && remainingMs <= 0) {
            setAutoSubmitted(true);
            // Defer to next tick so any state updates settle first.
            setTimeout(() => handleFinishQuiz(), 0);
        }
    }, [isSAC, remainingMs, autoSubmitted, showResults]);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [aiFeedback, setAiFeedback] = useState([]);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);
    const [pastAttempts, setPastAttempts] = useState([]);
    const [mathMode, setMathMode] = useState({});
    const [, forceUpdate] = useState(0);
    const mathInputRefs = useState({})[0];
    const [currentFeedbackIndex, setCurrentFeedbackIndex] = useState(0);
    const [previousAnswers, setPreviousAnswers] = useState({});
    const [showQuestionMap, setShowQuestionMap] = useState(false);
    const [showAdaptiveReview, setShowAdaptiveReview] = useState(false);
    const [submittedQuestions, setSubmittedQuestions] = useState(new Set());
    const [savedQuestions, setSavedQuestions] = useState(new Set());
    const { toast } = useToast();

    // Bookmark a question + model/correct answer into the revise-later library
    // (stored as an AISavedResult — no new table needed).
    const handleSaveAnswer = async (idx) => {
        if (savedQuestions.has(idx)) return;
        const q = shuffledQuiz.questions[idx];
        if (!q) return;
        const ua = userAnswers[idx];
        const yourAns = q.type === 'mcq'
            ? (ua !== undefined ? q.options?.[parseInt(ua)] : 'No answer')
            : (ua || 'No answer');
        const modelOrCorrect = q.type === 'mcq' ? q.options?.[q.correct_answer] : q.model_answer;
        const fb = aiFeedback[idx];
        const content = `**Question**\n${q.question || ''}\n\n**Your answer**\n${yourAns}\n\n**${q.type === 'mcq' ? 'Correct answer' : 'Model answer'}**\n${modelOrCorrect || '—'}${fb?.correct_answer_explanation ? `\n\n**Why**\n${fb.correct_answer_explanation}` : ''}`;
        try {
            await base44.entities.AISavedResult.create({
                tool_type: 'saved_answer',
                title: (q.question || 'Saved answer').slice(0, 80),
                subject_name: shuffledQuiz.subject || '',
                topic: shuffledQuiz.title || '',
                content,
                input_data: { quiz_title: shuffledQuiz.title, type: q.type },
                date_created: new Date().toISOString().split('T')[0],
            });
            setSavedQuestions(s => new Set([...s, idx]));
            toast({ title: 'Saved to your library', description: 'Find it under Saved answers on the Quizzes page.' });
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        }
    };

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
            const progressData = { quiz_id: quiz.id, quiz_title: quiz.title, current_question_index: currentQuestionIndex, user_answers: userAnswers, start_time: startTime, last_updated: new Date().toISOString() };
            if (savedProgressId) {
                await base44.entities.QuizProgress.update(savedProgressId, progressData);
            } else {
                const result = await base44.entities.QuizProgress.create(progressData);
                setSavedProgressId(result.id);
            }
            toast({ title: "Progress saved!", description: "You can continue this quiz later." });
        } catch {
            toast({ title: "Save failed", description: "Could not save progress.", variant: "destructive" });
        }
    };

    const clearSavedProgress = async () => {
        if (savedProgressId) {
            try { await base44.entities.QuizProgress.delete(savedProgressId); setSavedProgressId(null); } catch {}
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
            } catch {}
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
            // Snappy when right (you nailed it), a touch longer when wrong so
            // there's time to see the correct answer highlighted.
            setTimeout(() => handleNext(), correct ? 750 : 1500);
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
        } catch {}
        setShowResults(true);
        await generateAIFeedback(timeTaken);
    };

    // Real XP award through the server engine (idempotent via event_key so a
    // re-render or double-call can't double-pay). Retry runs earn nothing —
    // they're pure practice and would be farmable otherwise.
    const awardQuizXP = async ({ score, questionsCorrect, totalMarks, timeTaken }) => {
        if (quiz._isRetry) return;
        try {
            const res = await base44.functions.invoke('awardXP', {
                source: 'quiz',
                event_key: `quiz_${quiz.id}_${startTime}`,
                quiz_score: score,
                questions_total: totalQ,
                questions_correct: questionsCorrect,
                total_marks: totalMarks,
                time_taken_secs: timeTaken,
            });
            fireXPFeedback(res?.data ?? res, 'quiz');
        } catch (e) {
            console.error('Quiz XP award failed:', e);
        }
    };

    // When AI marking is unavailable (tier cap hit, or the call failed) the
    // attempt still counts: save it with the auto-markable (MCQ) score and pay
    // real XP on those marks. awardQuizXP's event_key keeps this un-doublable.

    /**
     * Per-question results, recorded onto the attempt.
     *
     * `user_answers` alone can't support any of this: it stores the INDEX of
     * the option picked, into a shuffle regenerated per attempt and never
     * persisted, so a stored attempt genuinely cannot say which questions were
     * missed. This writes the answer to that — correctness, marks, and the
     * command term off the stem — so weak spots and command-term analysis have
     * something real to read. Lives in `extra` so it needs no migration.
     */
    const buildQuestionResults = (marksFor) => shuffledQuiz.questions.map((q, i) => {
        const max = q.type === 'mcq' ? 1 : (q.marks || 5);
        const { marks, correct } = marksFor(q, i, max);
        return {
            q_index: i,
            type: q.type,
            question: q.question,
            command_term: commandTermOf(q.question),
            marks_max: max,
            marks,
            is_correct: correct,
        };
    });

    const saveMcqOnlyAttempt = async (timeTaken) => {
        const mcqQuestions = shuffledQuiz.questions.filter(q => q.type === 'mcq');
        const mcqCorrect = shuffledQuiz.questions.filter((q, i) => q.type === 'mcq' && userAnswers[i] !== undefined && parseInt(userAnswers[i]) === q.correct_answer).length;
        const fallbackScore = mcqQuestions.length > 0 ? Math.round((mcqCorrect / mcqQuestions.length) * 100) : 0;
        // Short answers went unmarked on this path, so they record as
        // null rather than as wrong — an unmarked question is not a
        // question you got wrong.
        const mcqOnlyResults = buildQuestionResults((q, i) => (q.type === 'mcq'
            ? { marks: parseInt(userAnswers[i]) === q.correct_answer ? 1 : 0,
                correct: parseInt(userAnswers[i]) === q.correct_answer }
            : { marks: undefined, correct: null }));
        try {
            const created = await base44.entities.QuizAttempt.create({ quiz_id: quiz.id, quiz_title: quiz.title, quiz_category: quiz.category, score: fallbackScore, questions_total: totalQ, questions_correct: mcqCorrect, time_taken: timeTaken, xp_earned: mcqCorrect * 2, user_answers: userAnswers, date: new Date().toISOString().split('T')[0], extra: { question_results: mcqOnlyResults } });
            if (created?.id) setCreatedAttemptId(created.id);
        } catch {}
        await awardQuizXP({ score: fallbackScore, questionsCorrect: mcqCorrect, totalMarks: mcqCorrect, timeTaken });
    };

    const generateAIFeedback = async (timeTaken) => {
        // Tier gate first — if user has hit the cap, skip AI marking with a
        // clean message. Quiz results are still shown; just no AI feedback.
        const access = await checkLiveTier(FEATURES.QUIZ_AI_MARK);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: `${access.reason} Your answers are still saved.`,
                variant: "destructive",
            });
            await saveMcqOnlyAttempt(timeTaken);
            return;
        }

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
                    } catch {}
                }
            }

            const response = await base44.integrations.Core.InvokeLLM({
                feature: "quiz_ai_mark",
                prompt: `${getLatexRules()}

Mark this ${shuffledQuiz.subject} quiz. Provide feedback for ALL ${questionsForAnalysis.length} questions.${sourceFileContent}${comparisonInstructions}

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

            const aiResults = buildQuestionResults((q, i, max) => {
                const fb = mappedFeedback[i];
                if (!fb) return { marks: undefined, correct: null };
                const marks = fb.marks || 0;
                return { marks, correct: q.type === 'mcq' ? marks === 1 : marks >= max * 0.8 };
            });

            const totalMarksAwarded = mappedFeedback.reduce((sum, fb) => sum + (fb.marks || 0), 0);
            const xpEarned = totalMarksAwarded * 2;

            try {
                const created = await base44.entities.QuizAttempt.create({ quiz_id: quiz.id, quiz_title: quiz.title, quiz_category: quiz.category, score: finalScore, questions_total: totalQ, questions_correct: questionsCorrect, time_taken: timeTaken, xp_earned: xpEarned, user_answers: userAnswers, date: new Date().toISOString().split('T')[0], extra: { question_results: aiResults } });
                // Stash the new attempt's id so any later self-marks update the same row.
                if (created?.id) setCreatedAttemptId(created.id);
            } catch {}

            // Real XP through the server engine + celebration popup.
            await awardQuizXP({ score: finalScore, questionsCorrect, totalMarks: totalMarksAwarded, timeTaken });

            toast({ title: "✅ Quiz marked!", description: `AI analysed all ${mappedFeedback.length} questions.` });
        } catch (error) {
            setAiFeedback([]);
            toast({ title: "AI Marking Failed", description: error.message || "Could not analyse answers.", variant: "destructive" });
            await saveMcqOnlyAttempt(timeTaken);
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    /**
     * Score from the marker's feedback.
     *
     * This used to bail with `return 0` whenever the feedback array came back
     * a different length to the quiz — so a marking glitch was written to the
     * database as a genuine zero, indistinguishable from a student who got
     * everything wrong, and it dragged their average down permanently. A
     * partial response is now marked on the questions it actually covered:
     * `max` only counts questions that came back, so ten right out of ten
     * marked is 100%, not 50% because the marker skipped the rest.
     */
    const calcScoreFromFeedback = (feedback) => {
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

    // ─── Adjusted score (auto + self-marked) ────────────────────────────────
    // Sums the user's self-marked marks on top of the AI-marked total.
    // Only used for the on-screen "your total" display — never persisted.
    const calcAdjustedScore = () => {
        if (!aiFeedback.length || aiFeedback.length !== shuffledQuiz.questions.length) {
            return { adjustedPct: overallScore, extraMarks: 0, hasSelfMarked: false };
        }
        let total = 0, max = 0;
        shuffledQuiz.questions.forEach((q, i) => {
            const fb = aiFeedback[i];
            const qMax = q.type === "mcq" ? 1 : (q.marks || 5);
            max += qMax;
            const autoMarks = fb?.marks || 0;
            const selfMarks = selfMarkedMarks[i] || 0;
            total += Math.min(qMax, autoMarks + selfMarks);
        });
        const extraMarks = Object.values(selfMarkedMarks).reduce((a, b) => a + (Number(b) || 0), 0);
        return {
            adjustedPct: max > 0 ? Math.round((total / max) * 100) : 0,
            extraMarks,
            hasSelfMarked: extraMarks > 0,
        };
    };
    const adjusted = calcAdjustedScore();

    // Persist self-marks back to the QuizAttempt row (debounced 600ms) so
    // AI features (Study Roadmap, Analytics, Performance coach) see the
    // adjusted picture. The base `score` field stays as-is for XP/goal
    // integrity.
    useEffect(() => {
        if (!createdAttemptId) return;
        const t = setTimeout(() => {
            base44.entities.QuizAttempt.update(createdAttemptId, {
                self_marked_marks: selfMarkedMarks,
                adjusted_score: adjusted.adjustedPct,
            }).catch(() => {});
        }, 600);
        return () => clearTimeout(t);
    }, [createdAttemptId, selfMarkedMarks, adjusted.adjustedPct]);

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
        // Compare like-for-like: adjusted total vs previous adjusted total.
        const previousScore = previousAttempt ? (previousAttempt.adjusted_score ?? previousAttempt.score) : null;
        const improvement = previousScore !== null ? adjusted.adjustedPct - previousScore : null;
        const currentQ = shuffledQuiz.questions[currentFeedbackIndex];
        const currentFeedback = aiFeedback[currentFeedbackIndex];
        const currentUserAnswer = userAnswers[currentFeedbackIndex];
        const tier = tierFromScore(overallScore);
        const TierIcon = tier.icon;

        return (
            <div className="fixed inset-0 z-50 bg-background flex flex-col">
                {/* Top bar */}
                <div className="flex-shrink-0 bg-surface/80 backdrop-blur-sm border-b border-border shadow-soft">
                    <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button onClick={async () => { await clearSavedProgress(); onExit(); }} variant="ghost" size="sm" className="gap-2 rounded-xl hover:bg-secondary">
                                <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline font-semibold">Exit</span>
                            </Button>
                            <div className="h-5 w-px bg-border" />
                            <div>
                                <h1 className="text-sm lg:text-base font-bold text-foreground truncate max-w-[200px] lg:max-w-none">{shuffledQuiz.title}</h1>
                                <p className="text-xs text-muted-foreground/60">{shuffledQuiz.subject}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isGeneratingFeedback && (
                                <div className="flex items-center gap-1.5 text-xs text-chart-4 bg-chart-4/10 px-3 py-1.5 rounded-full font-medium">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Marking...
                                </div>
                            )}
                            <div className={`px-3 py-1.5 rounded-xl font-black text-sm ${tier.badge}`}>
                                {isGeneratingFeedback ? '—' : `${overallScore}%`}
                            </div>
                            {!isGeneratingFeedback && adjusted.hasSelfMarked && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-xp/15 text-xp text-xs font-bold tabular-nums" title={`+${adjusted.extraMarks} self-marked. XP based on ${overallScore}% only.`}>
                                    <span>→ {adjusted.adjustedPct}%</span>
                                    <span className="hidden sm:inline text-[10px] opacity-80">incl. paper</span>
                                </div>
                            )}
                            {improvement !== null && improvement !== 0 && !isGeneratingFeedback && (
                                <div className={`hidden sm:flex px-2 py-1 rounded-lg text-xs font-bold ${improvement > 0 ? 'bg-primary/10 text-primary' : 'bg-streak/10 text-streak'}`}>
                                    {improvement > 0 ? `+${improvement}%` : `${improvement}%`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="hidden lg:flex flex-col w-60 bg-surface border-r border-border overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Questions</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {shuffledQuiz.questions.map((q, index) => {
                                const fb = aiFeedback[index];
                                const isActive = currentFeedbackIndex === index;
                                let itemClass = 'bg-secondary/50 text-muted-foreground border-border';
                                let badge = null;
                                if (fb) {
                                    if (q.type === 'mcq') {
                                        const t = fb.marks === 1 ? SCORE_TIER.excellent : SCORE_TIER.poor;
                                        itemClass = `${t.tile} ${t.text} ${t.border}`;
                                        badge = fb.marks === 1 ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />;
                                    } else {
                                        const pct = (fb.marks / (q.marks || 5)) * 100;
                                        const t = markTier(pct);
                                        itemClass = `${t.tile} ${t.text} ${t.border}`;
                                        badge = `${fb.marks}/${q.marks || 5}`;
                                    }
                                }
                                return (
                                    <button key={index} onClick={() => setCurrentFeedbackIndex(index)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${isActive ? 'bg-chart-3 text-white border-chart-3 shadow-soft' : `${itemClass} hover:opacity-80`}`}>
                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isActive ? 'bg-surface/20' : 'bg-surface/70'}`}>{index + 1}</span>
                                        <span className="text-xs font-medium flex-1 truncate">{q.type === 'mcq' ? 'MCQ' : 'Short Answer'}</span>
                                        {badge && <span className="text-xs font-bold inline-flex items-center">{badge}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main area */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Mobile question pills */}
                        <div className="lg:hidden flex-shrink-0 bg-surface border-b border-border px-4 py-2.5 overflow-x-auto">
                            <div className="flex gap-1.5">
                                {shuffledQuiz.questions.map((q, index) => {
                                    const fb = aiFeedback[index];
                                    const isActive = currentFeedbackIndex === index;
                                    let pillClass = 'bg-secondary text-muted-foreground';
                                    if (fb) {
                                        if (q.type === 'mcq') {
                                            pillClass = fb.marks === 1 ? 'bg-primary text-white' : 'bg-streak text-white';
                                        } else {
                                            const pct = fb.marks / (q.marks || 5);
                                            pillClass = pct >= 0.8 ? 'bg-primary text-white' : pct >= 0.5 ? 'bg-xp text-white' : 'bg-streak text-white';
                                        }
                                    }
                                    return (
                                        <button key={index} onClick={() => setCurrentFeedbackIndex(index)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${pillClass} ${isActive ? 'ring-2 ring-chart-3 ring-offset-1' : ''}`}>
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
                                        <div className={`card-soft p-6 text-center relative overflow-hidden ${tier.tile} ${tier.border}`}>
                                            <div className="relative">
                                                <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-2 ${tier.badge}`}>
                                                    <TierIcon className="w-7 h-7" />
                                                </div>
                                                <p className={`text-5xl font-black ${tier.text}`}>{overallScore}%</p>
                                                <p className="text-foreground/80 font-semibold mt-1">{tier.label}</p>
                                                <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-border text-center">
                                                    <div>
                                                        <p className="stat-num text-primary">{aiFeedback.filter((fb, i) => shuffledQuiz.questions[i]?.type === 'mcq' ? fb.marks === 1 : fb.marks >= (shuffledQuiz.questions[i]?.marks || 5) * 0.8).length}</p>
                                                        <p className="stat-label">Correct</p>
                                                    </div>
                                                    <div>
                                                        <p className="stat-num text-foreground">{totalQ}</p>
                                                        <p className="stat-label">Total</p>
                                                    </div>
                                                    <div>
                                                        <p className="stat-num font-mono text-xp">{formatElapsed(Date.now() - startTime)}</p>
                                                        <p className="stat-label">Time</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {shuffledQuiz.subject && (
                                            <div className="card-soft p-4">
                                                <DifficultyRating subjectName={shuffledQuiz.subject} />
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Question card */}
                                <AnimatePresence mode="wait">
                                    <motion.div key={currentFeedbackIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                                        className="card-soft overflow-hidden">
                                        <div className="px-6 pt-5 pb-4 bg-secondary/50 border-b border-border">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`pill ${currentQ.type === 'mcq' ? 'bg-chart-4/10 text-chart-4' : 'bg-chart-3/10 text-chart-3'}`}>
                                                        {currentQ.type === 'mcq' ? 'Multiple Choice' : `Short Answer • ${currentQ.marks || 5} marks`}
                                                    </span>
                                                    <button
                                                        onClick={() => handleSaveAnswer(currentFeedbackIndex)}
                                                        disabled={savedQuestions.has(currentFeedbackIndex)}
                                                        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${savedQuestions.has(currentFeedbackIndex) ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                                                        title="Save this question + answer to revise later"
                                                    >
                                                        {savedQuestions.has(currentFeedbackIndex) ? <><BookmarkCheck className="w-3.5 h-3.5" /> Saved</> : <><Bookmark className="w-3.5 h-3.5" /> Save</>}
                                                    </button>
                                                </div>
                                                {currentFeedback && (() => {
                                                    const t = currentQ.type === 'mcq'
                                                        ? (currentFeedback.marks === 1 ? SCORE_TIER.excellent : SCORE_TIER.poor)
                                                        : markTier((currentFeedback.marks / (currentQ.marks || 5)) * 100);
                                                    return (
                                                        <span className={`text-sm font-black px-3 py-1 rounded-xl ${t.badge}`}>
                                                            {currentQ.type === 'mcq' ? `${currentFeedback.marks}/1` : `${currentFeedback.marks}/${currentQ.marks || 5}`}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div className="p-6 space-y-5">
                                            <div className="text-lg font-semibold text-foreground leading-relaxed">
                                                <MarkdownMath>{currentQ.question || ""}</MarkdownMath>
                                            </div>

                                            {currentQ.type === 'mcq' ? (
                                                <div className="space-y-2">
                                                    {currentQ.options?.map((option, oi) => {
                                                        const isCorr = oi === currentQ.correct_answer;
                                                        const isUser = currentUserAnswer !== undefined && parseInt(currentUserAnswer) === oi;
                                                        const stateKey = isCorr ? 'correct' : isUser ? 'incorrect' : 'disabled';
                                                        const choiceCls = CHOICE_STATE[stateKey];
                                                        const badgeCls = CHOICE_BADGE[stateKey];
                                                        return (
                                                            <div key={oi} className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl ${choiceCls}`}>
                                                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${badgeCls}`}>
                                                                    {isCorr ? <Check className="w-3.5 h-3.5" /> : isUser ? <X className="w-3.5 h-3.5" /> : String.fromCharCode(65 + oi)}
                                                                </span>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium"><MathText>{option}</MathText></p>
                                                                    {isCorr && <p className="text-xs text-primary font-bold mt-0.5">Correct Answer</p>}
                                                                    {isUser && !isCorr && <p className="text-xs text-streak font-bold mt-0.5">Your Answer</p>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="bg-secondary/50 rounded-2xl p-4 border border-border">
                                                        <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wide mb-2">Your Answer</p>
                                                        {currentUserAnswer
                                                            ? <div className="text-sm text-foreground whitespace-pre-wrap"><MarkdownMath>{currentUserAnswer}</MarkdownMath></div>
                                                            : (
                                                                <div className="space-y-3">
                                                                    <p className="text-sm text-foreground"><span className="text-muted-foreground/60 italic">No answer written</span></p>
                                                                    <SelfMarkBox
                                                                        maxMarks={currentQ.marks || 5}
                                                                        currentMark={selfMarkedMarks[currentFeedbackIndex]}
                                                                        onMark={(m) => setSelfMarkedMarks(prev => ({ ...prev, [currentFeedbackIndex]: m }))}
                                                                        onClear={() => setSelfMarkedMarks(prev => {
                                                                            const next = { ...prev };
                                                                            delete next[currentFeedbackIndex];
                                                                            return next;
                                                                        })}
                                                                    />
                                                                </div>
                                                            )
                                                        }
                                                    </div>
                                                    <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
                                                        <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Model Answer</p>
                                                        <div className="text-sm text-foreground prose prose-sm max-w-none">
                                                            <MarkdownMath>{currentQ.model_answer || "No model answer provided"}</MarkdownMath>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Feedback */}
                                            {currentFeedback ? (
                                                <div className="space-y-3 pt-2 border-t border-border">
                                                    <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Wand2 className="w-3.5 h-3.5" /> AI Feedback
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        {[
                                                            { label: "Why This Answer", content: currentFeedback.correct_answer_explanation, panel: FEEDBACK_PANEL.explanation },
                                                            { label: "Your Understanding", content: currentFeedback.student_understanding, panel: FEEDBACK_PANEL.understanding },
                                                            { label: "Strengths", content: currentFeedback.strengths, panel: FEEDBACK_PANEL.strengths },
                                                            { label: "How to Improve", content: currentFeedback.how_to_improve, panel: FEEDBACK_PANEL.improve },
                                                        ].map(item => (
                                                            <div key={item.label} className={`${item.panel} border rounded-2xl p-3.5`}>
                                                                <p className="text-xs font-bold uppercase tracking-wide mb-1.5">{item.label}</p>
                                                                <div className="text-xs text-foreground leading-relaxed"><MarkdownMath>{item.content || ""}</MarkdownMath></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {currentFeedback.comparison_to_previous && (
                                                        <div className={`${FEEDBACK_PANEL.comparison} border rounded-2xl p-3.5`}>
                                                            <p className="text-xs font-bold uppercase tracking-wide mb-1.5">vs Last Attempt</p>
                                                            <div className="text-xs text-foreground leading-relaxed"><MarkdownMath>{currentFeedback.comparison_to_previous}</MarkdownMath></div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isGeneratingFeedback ? (
                                                <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground/60">
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
                        <div className="flex-shrink-0 bg-surface/80 backdrop-blur-sm border-t border-border px-4 lg:px-6 py-3">
                            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                                <Button variant="outline" onClick={() => setCurrentFeedbackIndex(p => Math.max(0, p - 1))} disabled={currentFeedbackIndex === 0} className="gap-2 rounded-xl border-2 border-border font-semibold">
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
                                            className="gap-2 rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold text-xs px-3 btn-3d">
                                            <Brain className="w-3.5 h-3.5" /> Review {wrongCount} Wrong
                                        </Button>
                                    ) : null;
                                })()}
                                <Button variant="outline" onClick={() => setCurrentFeedbackIndex(p => Math.min(totalQ - 1, p + 1))} disabled={currentFeedbackIndex === totalQ - 1} className="gap-2 rounded-xl border-2 border-border font-semibold">
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
                    <p className="text-muted-foreground text-sm">You're {Math.round(((currentQuestionIndex + 1) / totalQ) * 100)}% through. Want to save and continue later?</p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={async () => { await clearSavedProgress(); setShowSaveProgressDialog(false); onExit(); }}>Don't Save</Button>
                        <Button onClick={async () => { await saveProgressToDatabase(); setShowSaveProgressDialog(false); onExit(); }} className="bg-primary hover:bg-primary/90 text-white btn-3d">Save & Exit</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-4">

                {/* Header */}
                <div className="bg-chart-3 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-soft">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => { if (Object.keys(userAnswers).length > 0) setShowSaveProgressDialog(true); else onExit(); }}
                            className="w-8 h-8 bg-surface/15 hover:bg-surface/25 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                            <X className="w-4 h-4 text-white" />
                        </button>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{shuffledQuiz.title}</p>
                            <p className="text-white/70 text-xs">{shuffledQuiz.subject} · {answeredCount}/{totalQ} answered</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {isSAC ? (
                            // Countdown — turns amber under 5 min, red under 1 min.
                            <div className={`flex items-center gap-1.5 text-sm font-mono font-bold px-2.5 py-1 rounded-lg ${
                                remainingMs <= 60000   ? "bg-streak/30 text-white animate-pulse"
                                : remainingMs <= 300000 ? "bg-xp/30 text-white"
                                : "bg-surface/15 text-white/95"
                            }`}>
                                <Clock className="w-4 h-4" />
                                {formatElapsed(remainingMs)}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-white/80 text-sm font-mono font-bold">
                                <Clock className="w-4 h-4" />
                                {formatElapsed(Date.now() - startTime)}
                            </div>
                        )}
                        <button onClick={() => setShowQuestionMap(v => !v)}
                            className="w-8 h-8 bg-surface/15 hover:bg-surface/25 rounded-xl flex items-center justify-center transition-colors">
                            <Layers className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div className="h-full bg-chart-3 rounded-full"
                        animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
                </div>

                {/* Question map */}
                <AnimatePresence>
                    {showQuestionMap && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            className="card-soft p-4 overflow-hidden">
                            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">Jump to Question</p>
                            <div className="flex flex-wrap gap-1.5">
                                {shuffledQuiz.questions.map((q, i) => {
                                    const a = userAnswers[i];
                                    const done = q.type === 'mcq' ? a !== undefined : (a?.length > 0);
                                    const submitted = submittedQuestions.has(i);
                                    const mapBtn = i === currentQuestionIndex
                                        ? 'bg-chart-3 text-white ring-2 ring-chart-3/40'
                                        : submitted
                                            ? 'bg-secondary text-muted-foreground cursor-not-allowed opacity-60'
                                            : done
                                                ? 'bg-primary/15 text-primary'
                                                : 'bg-secondary text-muted-foreground/60 hover:bg-secondary/80';
                                    return (
                                        <button key={i}
                                            onClick={() => { if (!submitted) { setCurrentQuestionIndex(i); setShowFeedback(false); setIsCorrect(null); setShowQuestionMap(false); } }}
                                            disabled={submitted}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${mapBtn}`}>
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
                        initial={{ opacity: 0, x: 40, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -40, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.6 }}
                        className="card-soft overflow-hidden">

                        {/* Card header */}
                        <div className="px-6 pt-5 pb-4 bg-chart-3/10 border-b border-border">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className={`pill ${currentQuestion.type === 'mcq' ? 'bg-chart-4/15 text-chart-4' : 'bg-chart-3/15 text-chart-3'}`}>
                                        {currentQuestion.type === 'mcq' ? 'Multiple Choice' : `Short Answer · ${currentQuestion.marks || 5} marks`}
                                    </span>
                                    {showFeedback && (
                                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                            className={`pill ${isCorrect ? 'bg-primary/15 text-primary' : 'bg-streak/15 text-streak'}`}>
                                            {isCorrect ? <><Check className="w-3 h-3" /> Correct!</> : <><X className="w-3 h-3" /> Incorrect</>}
                                        </motion.span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-muted-foreground/60">{currentQuestionIndex + 1} / {totalQ}</span>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="text-xl sm:text-2xl font-semibold text-foreground leading-relaxed">
                                <MarkdownMath>{currentQuestion.question || ""}</MarkdownMath>
                            </div>

                            {currentQuestion.type === 'mcq' ? (
                                <div className="space-y-3">
                                    {currentQuestion.options?.map((option, index) => {
                                        const isSelected = getCurrentAnswer()?.toString() === index.toString();
                                        const isCorrectAnswer = index === currentQuestion.correct_answer;
                                        let stateKey;
                                        if (showFeedback) {
                                            if (isCorrectAnswer) stateKey = 'correct';
                                            else if (isSelected && !isCorrect) stateKey = 'incorrect';
                                            else stateKey = 'disabled';
                                        } else if (isSelected) {
                                            stateKey = 'selected';
                                        } else {
                                            stateKey = 'default';
                                        }
                                        const choiceCls = CHOICE_STATE[stateKey];
                                        const badgeCls = CHOICE_BADGE[stateKey];
                                        return (
                                            <motion.button key={index} type="button" disabled={showFeedback}
                                                whileHover={!showFeedback ? { scale: 1.005 } : {}}
                                                whileTap={!showFeedback ? { scale: 0.998 } : {}}
                                                onClick={() => !showFeedback && handleAnswerChange(index.toString())}
                                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all duration-150 ${choiceCls} ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}>
                                                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${badgeCls}`}>
                                                    {showFeedback && isCorrectAnswer ? <Check className="w-4 h-4" /> : showFeedback && isSelected && !isCorrect ? <X className="w-4 h-4" /> : String.fromCharCode(65 + index)}
                                                </span>
                                                <span className="flex-1 font-medium text-base"><MathText>{option}</MathText></span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground/60 font-medium">Write a detailed answer below</span>
                                        <div className="flex items-center gap-2">
                                            <Calculator className="w-3.5 h-3.5 text-muted-foreground/60" />
                                            <Switch checked={mathMode[currentQuestionIndex] || false} onCheckedChange={(v) => { setMathMode(p => ({ ...p, [currentQuestionIndex]: v })); setShowKeyboard(p => ({ ...p, [currentQuestionIndex]: v })); }} />
                                            <Label className="text-xs text-muted-foreground cursor-pointer">Math</Label>
                                        </div>
                                    </div>
                                    {mathMode[currentQuestionIndex] ? (
                                        <>
                                            <MathInput value={getCurrentAnswer() || ""} onChange={(value) => handleAnswerChange(value)}
                                                onCursorPositionChange={(pos) => setCursorPosition(p => ({ ...p, [currentQuestionIndex]: pos }))}
                                                textareaRef={(ref) => { if (ref) mathInputRefs[currentQuestionIndex] = ref; }}
                                                placeholder="Write your answer here..." rows={6}
                                                className="w-full rounded-2xl border-2 border-border focus-within:border-chart-3" />
                                            <MathKeyboard
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
                                            rows={6} className="border-2 border-border focus:border-chart-3 rounded-2xl resize-none text-sm bg-secondary/50 focus:bg-surface transition-colors placeholder:text-muted-foreground/60" />
                                    )}
                                    {getCurrentAnswer()?.length > 0 && !mathMode[currentQuestionIndex] && (
                                        <p className="text-xs text-muted-foreground/60 text-right">{getCurrentAnswer().length} chars</p>
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
                        className="gap-2 rounded-xl border-2 border-border font-semibold hover:bg-secondary">
                        <ChevronLeft className="w-4 h-4" /> Prev
                    </Button>

                    <Button onClick={currentQuestion.type === 'mcq' ? handleSubmitAnswer : handleNext}
                        disabled={showFeedback}
                        className={`gap-2 rounded-xl font-bold px-8 h-11 transition-all hover:scale-[1.02] btn-3d ${currentQuestionIndex === totalQ - 1 ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-chart-3 hover:bg-chart-3/90 text-white'}`}>
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
