import React, { useState, useEffect, useMemo } from "react";
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
import { aceDone } from "@/components/ace/AceReacts";
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
import QuizTable from "@/components/cards/QuizTable";
import ChoiceCard from "@/components/cards/ChoiceCard";
import { suitFor } from "@/components/cards/cardIdentity";

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
/**
 * Themes, cleaned.
 *
 * The model is told twice not to invent a theme from one question, and it will
 * do it anyway on a quiz where only one thing went wrong — "you struggle with
 * redox" off a single miss is a confident-sounding guess, and a confident
 * guess about what a student is bad at is worse than saying nothing. So the
 * two-question rule is enforced here rather than trusted upstream. Question
 * numbers are 1-based in the prompt and are also checked, because a theme that
 * points at question 9 of a 5-question quiz is a hallucination in the parts we
 * can see and probably in the parts we can't.
 */
function cleanThemes(raw, total) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(t => ({
            title: String(t?.title || "").trim(),
            detail: String(t?.detail || "").trim(),
            questions: [...new Set((Array.isArray(t?.questions) ? t.questions : [])
                .map(n => Number(n))
                .filter(n => Number.isInteger(n) && n >= 1 && n <= total))]
                .sort((a, b) => a - b),
        }))
        .filter(t => t.title && t.questions.length >= 2)
        .slice(0, 3);
}

const FEEDBACK_PANEL = {
    wrong:       'bg-streak/10 border-streak/20 text-streak',
    improve:     'bg-xp/10 border-xp/20 text-xp',
    explanation: 'bg-chart-3/10 border-chart-3/20 text-chart-3',
    comparison:  'bg-chart-4/10 border-chart-4/20 text-chart-4',
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
    /** Mistakes grouped across questions — see cleanThemes. */
    const [themes, setThemes] = useState([]);
    /**
     * Results open on the verdict, not on question one. Going through the
     * questions is a thing you choose to do, not the thing you land in.
     */
    const [resultsView, setResultsView] = useState("verdict");
    /**
     * "Why was I right?" answers, fetched only when asked. A correct answer
     * gets a tick by default — writing a paragraph about twelve of those is
     * what buried the eight that mattered, and it's paid for on every quiz
     * whether anyone reads it or not. But a right answer you guessed is a real
     * question, so it stays answerable.
     */
    const [whyRight, setWhyRight] = useState({});
    const [askingWhy, setAskingWhy] = useState({});
    /** Missed questions already written into a deck, so the button can't double up. */
    const [cardsMade, setCardsMade] = useState(null);
    const [makingCards, setMakingCards] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    /**
     * What the table shows: cards he's eaten, cards he wouldn't take, and the
     * current run. Counted here rather than derived from `userAnswers`,
     * because a run is about the ORDER you answered in and that isn't
     * recoverable from a map of answers — you can revisit questions.
     */
    const [tally, setTally] = useState({ won: 0, missed: 0, run: 0 });
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
    /**
     * Which questions actually cost marks. Read off the AI marks where they
     * exist and off the MCQ key where they don't, so it still works when
     * marking was skipped for a tier limit.
     */
    const missedIndexes = useMemo(() => shuffledQuiz.questions
        .map((q, i) => {
            const fb = aiFeedback[i];
            const max = q.type === 'mcq' ? 1 : (q.marks || 5);
            if (fb) return (fb.marks || 0) >= max * (q.type === 'mcq' ? 1 : 0.8) ? -1 : i;
            if (q.type !== 'mcq') return -1;
            return parseInt(userAnswers[i], 10) === q.correct_answer ? -1 : i;
        })
        .filter(i => i >= 0), [shuffledQuiz.questions, aiFeedback, userAnswers]);

    /**
     * The missed questions become real flashcards in the subject's deck.
     *
     * This is the whole point of the results screen. Reading feedback once is
     * not remembering it; the spaced-repetition engine next door is the only
     * thing in this app that actually produces retention, and until now the
     * results screen was a dead end that fed it nothing. Straight in as weak
     * spots due today, because a question you just got wrong demonstrably is
     * one — same as the blurting gaps do.
     */
    const makeCardsFromMisses = async () => {
        if (makingCards || cardsMade !== null || !missedIndexes.length) return;
        setMakingCards(true);
        const today = new Date().toISOString().split('T')[0];
        let made = 0;
        for (const i of missedIndexes) {
            const q = shuffledQuiz.questions[i];
            const answer = q.type === 'mcq'
                ? q.options?.[q.correct_answer]
                : q.model_answer;
            // A card with no answer on the back is not a card. Skip rather
            // than file something that will waste a review when it comes up.
            if (!q.question || !answer) continue;
            try {
                await base44.entities.Flashcard.create({
                    subject_name: shuffledQuiz.subject || null,
                    // Quizzes carry a subject but rarely a topic, so the deck
                    // is named after the quiz. Better a findable deck called
                    // "Redox check" than everything in one called "General".
                    topic: shuffledQuiz.title || "Quiz misses",
                    question: q.question,
                    answer,
                    is_active: true,
                    is_weak_spot: true,
                    next_review_date: today,
                });
                made += 1;
            } catch { /* one bad card shouldn't lose the rest */ }
        }
        setMakingCards(false);
        setCardsMade(made);
        toast(made > 0
            ? { title: `${made} card${made === 1 ? "" : "s"} added`, description: `They're in your ${shuffledQuiz.subject || "flashcard"} decks under "${shuffledQuiz.title}", due today.` }
            : { title: "Nothing to add", description: "These questions have no model answer to put on the back.", variant: "destructive" });
    };

    /**
     * The explanation for a question you got RIGHT, fetched on request.
     * One short call, one question, and only when someone actually wants it.
     */
    const askWhyRight = async (idx) => {
        if (whyRight[idx] || askingWhy[idx]) return;
        const q = shuffledQuiz.questions[idx];
        if (!q) return;
        setAskingWhy(p => ({ ...p, [idx]: true }));
        try {
            const access = await checkLiveTier(FEATURES.QUIZ_AI_MARK);
            if (!access.allowed) throw new Error(access.reason);
            const answer = q.type === 'mcq' ? q.options?.[q.correct_answer] : q.model_answer;
            const res = await base44.integrations.Core.InvokeLLM({
                feature: "quiz_ai_mark",
                prompt: `${getLatexRules()}

A ${shuffledQuiz.subject} student answered this correctly but wants to know WHY it is right — they may have guessed.

Question: ${q.question}
Correct answer: ${answer}

In two or three sentences, explain what makes that the right answer and what the question was testing. No praise, no preamble.`,
            });
            setWhyRight(p => ({ ...p, [idx]: typeof res === "string" ? res : (res?.text || String(res || "")) }));
        } catch (e) {
            toast({ title: "Couldn't explain that one", description: e?.message || "Try again in a moment.", variant: "destructive" });
        } finally {
            setAskingWhy(p => ({ ...p, [idx]: false }));
        }
    };

    /** Anything that points at a question also switches to the question view. */
    const openQuestion = (i) => { setCurrentFeedbackIndex(i); setResultsView("questions"); };

    /**
     * How many questions the adaptive drill will actually re-ask. Its own
     * threshold, not `missedIndexes`': the drill counts a short answer as worth
     * redoing below 60% where the verdict counts it as missed below 80%, and
     * offering "redo the 3 you missed" on a drill that then loads two questions
     * is the kind of small lie that makes a screen untrustworthy.
     */
    const drillCount = useMemo(() => shuffledQuiz.questions.filter((q, i) => {
        const fb = aiFeedback[i];
        if (!fb) return false;
        return q.type === 'mcq' ? fb.marks < 1 : fb.marks < (q.marks || 5) * 0.6;
    }).length, [shuffledQuiz.questions, aiFeedback]);

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
        const content = `**Question**\n${q.question || ''}\n\n**Your answer**\n${yourAns}\n\n**${q.type === 'mcq' ? 'Correct answer' : 'Model answer'}**\n${modelOrCorrect || '—'}${fb?.student_error_analysis ? `\n\n**What went wrong**\n${fb.student_error_analysis}` : ''}`;
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
            setTally(t => ({
                won: t.won + (correct ? 1 : 0),
                missed: t.missed + (correct ? 0 : 1),
                run: correct ? t.run + 1 : 0,
            }));
            correct ? playCorrectSound() : playIncorrectSound();
            // Snappy when right, a touch longer when wrong so there's time to
            // see the correct answer highlighted. The 900 is the card reaching
            // his mouth (400) plus enough of the chew to register — he keeps
            // chewing over the top of the next question, which is fine.
            setTimeout(() => handleNext(), correct ? 900 : 1500);
        } else {
            handleNext();
        }
    };

    /**
     * Number keys pick a suit; Enter plays it.
     *
     * Deliberately two steps. One keystroke that both chooses AND submits an
     * MCQ is one fat-finger away from an irreversible wrong answer, and unlike
     * a flashcard grade a quiz answer is marked.
     */
    useEffect(() => {
        if (currentQuestion?.type !== 'mcq' || showFeedback) return undefined;
        const onKey = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            const n = Number(e.key);
            if (n >= 1 && n <= (currentQuestion.options?.length || 0)) {
                e.preventDefault();
                handleAnswerChange(String(n - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmitAnswer();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

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
        // Ace reacts to the mark. One event; the reaction itself is mounted
        // once in the Layout rather than built into three results screens.
        const marked = shuffledQuiz.questions.filter(
            (q, i) => q.type === "mcq" && userAnswers[i] !== undefined
                && parseInt(userAnswers[i], 10) === q.correct_answer).length;
        aceDone("quiz", shuffledQuiz.questions.length
            ? Math.round((marked / shuffledQuiz.questions.length) * 100) : null);
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

For EACH question return: marks, what_wrong, improve${hasShortWithPrevious ? ', comparison' : ''}.
For a question that scored full marks, leave what_wrong and improve as empty strings — do not write praise.
Return exactly ${questionsForAnalysis.length} items.

THEN look ACROSS every question that lost marks and find the THEMES.
A theme is one underlying reason that cost marks on TWO OR MORE questions —
the same confusion, the same missing step, the same misread command term.
This is the most useful thing you will produce: a student who is told "these
three were the same mistake" has one thing to fix instead of three.
  - "questions" must list the question numbers it covers, and there must be at
    least two of them.
  - "title" is at most eight words and names the mistake, not the topic.
  - "detail" is ONE sentence saying what to do differently.
If no two lost questions share a cause, return an empty themes array. Never
invent a theme from a single question.`,
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
                                    what_wrong: { type: "string" },
                                    improve: { type: "string" },
                                    comparison: { type: "string" }
                                },
                                required: ["marks", "what_wrong", "improve"]
                            }
                        },
                        themes: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    detail: { type: "string" },
                                    questions: { type: "array", items: { type: "number" } }
                                },
                                required: ["title", "detail", "questions"]
                            }
                        }
                    },
                    required: ["feedback"]
                }
            });

            if (!response?.feedback?.length) throw new Error("AI returned invalid format");

            const mappedFeedback = response.feedback.map(item => ({
                marks: item.marks || 0,
                // Empty rather than "No errors noted": a question you got right
                // has nothing to say here, and a placeholder in a panel is
                // indistinguishable from real feedback until you read it.
                student_error_analysis: item.what_wrong?.trim() || null,
                how_to_improve: item.improve?.trim() || null,
                comparison_to_previous: item.comparison || null
            }));

            setAiFeedback(mappedFeedback);
            setThemes(cleanThemes(response.themes, shuffledQuiz.questions.length));

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
                                    <button key={index} onClick={() => openQuestion(index)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${isActive && resultsView === 'questions' ? 'bg-chart-3 text-white border-chart-3 shadow-soft' : `${itemClass} hover:opacity-80`}`}>
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
                                        <button key={index} onClick={() => openQuestion(index)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${pillClass} ${isActive && resultsView === 'questions' ? 'ring-2 ring-chart-3 ring-offset-1' : ''}`}>
                                            {index + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-4">
                                {/* ── THE VERDICT ────────────────────────────
                                    What happened, why, and one thing to do
                                    about it. Results used to open on question
                                    one's feedback, which answers "what did I
                                    get wrong on Q1" — a question nobody has
                                    before they know how the whole thing went. */}
                                {resultsView === "verdict" && (
                                    <motion.div data-verdict initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4">
                                        <div className={`card-soft p-6 text-center ${tier.tile} ${tier.border}`}>
                                            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-2 ${tier.badge}`}>
                                                <TierIcon className="w-7 h-7" />
                                            </div>
                                            <p className={`text-5xl font-black ${tier.text}`}>
                                                {isGeneratingFeedback ? "—" : `${overallScore}%`}
                                            </p>
                                            <p className="text-foreground/80 font-semibold mt-1">{tier.label}</p>
                                            <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-border text-center">
                                                <div>
                                                    <p className="stat-num text-primary">{totalQ - missedIndexes.length}</p>
                                                    <p className="stat-label">Right</p>
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

                                        {isGeneratingFeedback && (
                                            <div className="card-soft p-6 flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-sm">Marking, and looking for what these have in common&hellip;</span>
                                            </div>
                                        )}

                                        {/* THE THEMES. The most useful thing on the screen:
                                            three wrong answers for one reason is ONE thing to
                                            fix, not three. */}
                                        {themes.map((t, i) => (
                                            <motion.div key={t.title} data-theme={i}
                                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.08 + i * 0.06 }}
                                                className="card-soft p-5 border-l-4 border-l-streak">
                                                <p className="text-xs font-bold text-streak uppercase tracking-wider mb-1.5">
                                                    {t.questions.length} questions, one reason
                                                </p>
                                                <h3 className="font-display font-extrabold text-foreground text-base leading-snug">
                                                    {t.title}
                                                </h3>
                                                <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{t.detail}</p>
                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {t.questions.map(n => (
                                                        <button key={n} onClick={() => openQuestion(n - 1)}
                                                            className="px-2.5 py-1 rounded-lg bg-secondary text-xs font-bold text-foreground
                                                                hover:bg-streak/15 hover:text-streak transition-colors">
                                                            Q{n}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        ))}

                                        {/* THE ONE BUTTON. Reading feedback is not
                                            remembering it; the only thing in this app that
                                            produces retention is the review deck, and until
                                            now this screen fed it nothing. */}
                                        {missedIndexes.length > 0 && !isGeneratingFeedback && (
                                            <div className="card-soft p-5">
                                                {cardsMade === null ? (
                                                    <>
                                                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                                                            You lost marks on <span className="font-bold text-foreground">{missedIndexes.length}</span>
                                                            {" "}question{missedIndexes.length === 1 ? "" : "s"}. Put them in your deck and they&rsquo;ll
                                                            keep coming back until you know them.
                                                        </p>
                                                        <Button data-make-cards onClick={makeCardsFromMisses} disabled={makingCards}
                                                            className="btn-3d gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl w-full sm:w-auto">
                                                            {makingCards
                                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding&hellip;</>
                                                                : <><Layers className="w-4 h-4" /> Add {missedIndexes.length} to my {shuffledQuiz.subject || "flashcard"} deck</>}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <p data-cards-made={cardsMade} className="text-sm font-bold text-primary inline-flex items-center gap-2">
                                                        <Check className="w-4 h-4" />
                                                        {cardsMade} card{cardsMade === 1 ? "" : "s"} added to &ldquo;{shuffledQuiz.title}&rdquo; &mdash; due today.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Both of these are things you do with the WHOLE
                                            quiz, so they live on the verdict. The drill used
                                            to sit in the per-question footer, where it read
                                            as a control for the question you were looking
                                            at rather than for the attempt. */}
                                        <div className="flex flex-wrap gap-2">
                                            {drillCount > 0 && !isGeneratingFeedback && (
                                                <Button data-drill onClick={() => setShowAdaptiveReview(true)}
                                                    className="gap-2 rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold btn-3d">
                                                    <Brain className="w-4 h-4" /> Redo the {drillCount} you missed
                                                </Button>
                                            )}
                                            <Button data-go-questions variant="outline" onClick={() => setResultsView("questions")}
                                                className="gap-2 rounded-xl border-2 border-border font-semibold">
                                                Go through the questions <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        {shuffledQuiz.subject && (
                                            <div className="card-soft p-4">
                                                <DifficultyRating subjectName={shuffledQuiz.subject} />
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {resultsView === "questions" && (<>
                                <button data-back-to-verdict onClick={() => setResultsView("verdict")}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground
                                        hover:text-foreground transition-colors">
                                    <ChevronLeft className="w-3.5 h-3.5" /> Back to the verdict
                                </button>

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

                                            {/* ── FEEDBACK ────────────────────
                                                Two panels, not four. "Why This Answer",
                                                "Your Understanding", "Strengths" and "How to
                                                Improve" were four labels for two ideas, on
                                                every question whether it went well or not,
                                                and the volume is exactly what stopped anyone
                                                reading the ones that mattered. */}
                                            {currentFeedback ? (
                                                <div className="space-y-3 pt-2 border-t border-border">
                                                    {currentFeedback.student_error_analysis && (
                                                        <div data-panel="wrong" className={`${FEEDBACK_PANEL.wrong} border rounded-2xl p-4`}>
                                                            <p className="text-xs font-bold uppercase tracking-wide mb-1.5">What went wrong</p>
                                                            <div className="text-sm text-foreground leading-relaxed">
                                                                <MarkdownMath>{currentFeedback.student_error_analysis}</MarkdownMath>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {currentFeedback.how_to_improve && (
                                                        <div data-panel="fix" className={`${FEEDBACK_PANEL.improve} border rounded-2xl p-4`}>
                                                            <p className="text-xs font-bold uppercase tracking-wide mb-1.5">What to do about it</p>
                                                            <div className="text-sm text-foreground leading-relaxed">
                                                                <MarkdownMath>{currentFeedback.how_to_improve}</MarkdownMath>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {currentFeedback.comparison_to_previous && (
                                                        <div className={`${FEEDBACK_PANEL.comparison} border rounded-2xl p-3.5`}>
                                                            <p className="text-xs font-bold uppercase tracking-wide mb-1.5">vs Last Attempt</p>
                                                            <div className="text-xs text-foreground leading-relaxed"><MarkdownMath>{currentFeedback.comparison_to_previous}</MarkdownMath></div>
                                                        </div>
                                                    )}

                                                    {/* Nothing went wrong here, so nothing is
                                                        written — but a right answer you guessed
                                                        is a real question, so it stays askable.
                                                        One short call, only when wanted. */}
                                                    {!currentFeedback.student_error_analysis && !currentFeedback.how_to_improve && (
                                                        whyRight[currentFeedbackIndex] ? (
                                                            <div data-panel="why" className={`${FEEDBACK_PANEL.explanation} border rounded-2xl p-4`}>
                                                                <p className="text-xs font-bold uppercase tracking-wide mb-1.5">Why this is the answer</p>
                                                                <div className="text-sm text-foreground leading-relaxed">
                                                                    <MarkdownMath>{whyRight[currentFeedbackIndex]}</MarkdownMath>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                <p className="text-sm text-primary font-bold inline-flex items-center gap-1.5">
                                                                    <Check className="w-4 h-4" /> You got this one.
                                                                </p>
                                                                <button data-ask-why onClick={() => askWhyRight(currentFeedbackIndex)}
                                                                    disabled={askingWhy[currentFeedbackIndex]}
                                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground
                                                                        hover:text-foreground underline underline-offset-4 disabled:opacity-60">
                                                                    {askingWhy[currentFeedbackIndex]
                                                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Asking&hellip;</>
                                                                        : <><Wand2 className="w-3.5 h-3.5" /> Guessed it? Ask why it&rsquo;s right</>}
                                                                </button>
                                                            </div>
                                                        )
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
                                </>)}
                            </div>
                        </div>

                        {/* Bottom nav — only while going through the questions.
                            Prev and Next on a summary screen are buttons for
                            moving through something you aren't looking at. */}
                        {resultsView === "questions" && (
                            <div className="flex-shrink-0 bg-surface/80 backdrop-blur-sm border-t border-border px-4 lg:px-6 py-3">
                                <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                                    <Button variant="outline" onClick={() => setCurrentFeedbackIndex(p => Math.max(0, p - 1))} disabled={currentFeedbackIndex === 0} className="gap-2 rounded-xl border-2 border-border font-semibold">
                                        <ChevronLeft className="w-4 h-4" /> Prev
                                    </Button>
                                    <Button variant="outline" onClick={() => setResultsView("verdict")}
                                        className="gap-2 rounded-xl border-2 border-border font-semibold text-xs">
                                        Verdict
                                    </Button>
                                    <Button variant="outline" onClick={() => setCurrentFeedbackIndex(p => Math.min(totalQ - 1, p + 1))} disabled={currentFeedbackIndex === totalQ - 1} className="gap-2 rounded-xl border-2 border-border font-semibold">
                                        Next <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
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

                {/* Header. A slab of saturated blue across the top of a card
                    table was the loudest thing on the screen and the least
                    informative; it sits on the background now, so the table is
                    what you look at. The "N/M answered" count went with it —
                    the piles say that, and say it better. */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => { if (Object.keys(userAnswers).length > 0) setShowSaveProgressDialog(true); else onExit(); }}
                            aria-label="Leave this quiz"
                            className="w-8 h-8 rounded-xl border-2 border-border text-muted-foreground
                                hover:text-foreground hover:bg-secondary flex items-center justify-center
                                transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                        <div className="min-w-0">
                            <p className="text-foreground font-bold text-sm truncate">{shuffledQuiz.title}</p>
                            <p className="text-muted-foreground text-xs truncate">{shuffledQuiz.subject}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isSAC ? (
                            // Countdown — turns amber under 5 min, red under 1 min.
                            <div className={`flex items-center gap-1.5 text-sm font-mono font-bold px-2.5 py-1 rounded-lg ${
                                remainingMs <= 60000   ? "bg-streak/15 text-streak animate-pulse"
                                : remainingMs <= 300000 ? "bg-xp/15 text-xp"
                                : "bg-secondary text-muted-foreground"
                            }`}>
                                <Clock className="w-4 h-4" />
                                {formatElapsed(remainingMs)}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-mono font-bold">
                                <Clock className="w-4 h-4" />
                                {formatElapsed(Date.now() - startTime)}
                            </div>
                        )}
                        <button onClick={() => setShowQuestionMap(v => !v)}
                            aria-label="Jump to a question"
                            className="w-8 h-8 rounded-xl border-2 border-border text-muted-foreground
                                hover:text-foreground hover:bg-secondary flex items-center justify-center
                                transition-colors">
                            <Layers className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* The progress bar is gone — the two piles on the table say
                    the same thing, and saying it twice is how a screen ends up
                    looking like a dashboard. */}

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

                {/* The table */}
                <QuizTable
                    questionKey={currentQuestionIndex}
                    number={currentQuestionIndex + 1}
                    suit={suitFor(shuffledQuiz.subject)}
                    remaining={totalQ - currentQuestionIndex}
                    won={tally.won} missed={tally.missed} run={tally.run}
                    verdict={showFeedback ? (isCorrect ? "correct" : "wrong") : null}
                    playedIndex={showFeedback ? parseInt(userAnswers[currentQuestionIndex], 10) : null}
                    optionCount={currentQuestion.options?.length || 0}
                    question={(
                        <>
                            {/* No "Correct!" pill and no "3 / 10". The option
                                goes green, Ace eats it or bats it away, and the
                                corner index is the question number — three ways
                                of saying the same thing is how a screen starts
                                looking generated. */}
                            <span className={`pill mb-3 ${currentQuestion.type === 'mcq' ? 'bg-chart-4/15 text-chart-4' : 'bg-chart-3/15 text-chart-3'}`}>
                                {currentQuestion.type === 'mcq' ? 'Multiple Choice' : `Short Answer · ${currentQuestion.marks || 5} marks`}
                            </span>
                            <div className="text-lg sm:text-xl font-semibold text-foreground leading-relaxed">
                                <MarkdownMath>{currentQuestion.question || ""}</MarkdownMath>
                            </div>
                        </>
                    )}
                >
                    <div className="space-y-6">
                            {currentQuestion.type === 'mcq' ? (
                                <div className="space-y-2.5">
                                    {currentQuestion.options?.map((option, index) => {
                                        const isSelected = getCurrentAnswer()?.toString() === index.toString();
                                        const isCorrectAnswer = index === currentQuestion.correct_answer;
                                        let stateKey;
                                        if (showFeedback) {
                                            if (isCorrectAnswer) stateKey = 'correct';
                                            else if (isSelected && !isCorrect) stateKey = 'incorrect';
                                            else stateKey = 'dimmed';
                                        } else if (isSelected) {
                                            stateKey = 'selected';
                                        } else {
                                            stateKey = 'default';
                                        }
                                        return (
                                            <ChoiceCard key={index} index={index}
                                                count={currentQuestion.options.length}
                                                state={stateKey} disabled={showFeedback}
                                                onClick={() => !showFeedback && handleAnswerChange(index.toString())}>
                                                <MathText>{option}</MathText>
                                            </ChoiceCard>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground/60 font-medium">Write a detailed answer below</span>
                                        <div className="flex items-center gap-2">
                                            <Calculator className="w-3.5 h-3.5 text-muted-foreground/60" />
                                            <Switch checked={mathMode[currentQuestionIndex] || false} onCheckedChange={(v) => { setMathMode(p => ({ ...p, [currentQuestionIndex]: v })); }} />
                                            <Label className="text-xs text-muted-foreground cursor-pointer">Math</Label>
                                        </div>
                                    </div>
                                    {mathMode[currentQuestionIndex] ? (
                                        <>
                                            <MathInput value={getCurrentAnswer() || ""} onChange={(value) => handleAnswerChange(value)}
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
                                                                setTimeout(() => { if (textarea) { textarea.selectionStart = newCursor; textarea.selectionEnd = newCursor; textarea.focus(); } }, 0);
                                                                return;
                                                            }
                                                        }
                                                    }
                                                    newValue = current.substring(0, pos) + value + current.substring(pos);
                                                    newCursor = pos + value.length;
                                                    handleAnswerChange(newValue);
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
                                                        setTimeout(() => { if (textarea) { textarea.selectionStart = nc; textarea.selectionEnd = nc; textarea.focus(); } }, 0);
                                                    }
                                                }}
                                                onClear={() => { handleAnswerChange(""); const textarea = mathInputRefs[currentQuestionIndex]; setTimeout(() => { if (textarea) { textarea.selectionStart = 0; textarea.selectionEnd = 0; textarea.focus(); } }, 0); }}
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
                </QuizTable>

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
