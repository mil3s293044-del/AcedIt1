import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
    Sparkles, Zap, Trophy, Clock, ChevronDown, ChevronRight,
    CheckCircle2, Brain, Timer, ClipboardList,
    Calendar, Loader2, Target, TrendingUp, BarChart3,
    AlertTriangle, Eye, EyeOff, Star, Flame, RefreshCw
} from "lucide-react";

const TYPE_CONFIG = {
    practice_questions: { icon: ClipboardList, label: "Practice Questions", color: "blue",   bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700"   },
    flashcard_sprint:   { icon: Brain,         label: "Flashcard Sprint",    color: "purple", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
    focus_session:      { icon: Timer,         label: "Focus Session",       color: "green",  bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700"  },
    mini_test:          { icon: ClipboardList, label: "Mini Test",           color: "orange", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
    revision_schedule:  { icon: Calendar,      label: "Revision Schedule",   color: "indigo", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
};

const DIFF_BADGE = {
    foundation: "bg-gray-100 text-gray-600",
    developing:  "bg-blue-100 text-blue-700",
    proficient:  "bg-yellow-100 text-yellow-700",
    advanced:    "bg-orange-100 text-orange-700",
    exam_ready:  "bg-red-100 text-red-700",
};

// ── Shared: Progress Ring ─────────────────────────────────────────────────────
function ProgressRing({ pct, size = 80, stroke = 7, color = "#7c3aed" }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
                fontSize={size * 0.22} fontWeight="bold" fill="#1f2937">
                {Math.round(pct)}%
            </text>
        </svg>
    );
}

// ── Live XP Badge (gamified) ──────────────────────────────────────────────────
function LiveXPBadge({ xp, label = "XP earned so far" }) {
    if (!xp || xp <= 0) return null;
    return (
        <motion.div
            key={xp}
            initial={{ scale: 0.7, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl px-4 py-2 shadow-lg shadow-amber-300/40 font-black text-base select-none"
        >
            <motion.span
                animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                className="text-lg"
            >⚡</motion.span>
            +{xp} XP
            <span className="text-amber-100 text-xs font-medium">{label}</span>
        </motion.div>
    );
}

// ── Completion Celebration ────────────────────────────────────────────────────
function CompletionCelebration({ xp, score, onDismiss }) {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onDismiss}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 300 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6 }} className="text-5xl mb-4">🏆</motion.div>
                <h2 className="text-2xl font-black text-gray-900 mb-1">Challenge Complete!</h2>
                {score !== null && score !== undefined && (
                    <p className="text-4xl font-black mb-2" style={{ color: score >= 75 ? '#16a34a' : '#ea580c' }}>
                        {score}%
                    </p>
                )}
                <div className="flex items-center justify-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <span className="text-xl font-bold text-amber-600">+{xp} XP earned!</span>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    {score >= 90 ? "Outstanding! Difficulty will increase next time." :
                     score >= 75 ? "Great work! Keep it up." :
                     score != null ? "Keep practising — you'll improve!" :
                     "Session complete! Consistency builds results."}
                </p>
                <Button onClick={onDismiss} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                    Continue
                </Button>
            </motion.div>
        </motion.div>
    );
}

// ── Anti-Cheat: Tab visibility hook ──────────────────────────────────────────
function useTabVisibility(isActive, onTabAway) {
    useEffect(() => {
        if (!isActive) return;
        const handle = () => { if (document.hidden) onTabAway(); };
        document.addEventListener('visibilitychange', handle);
        return () => document.removeEventListener('visibilitychange', handle);
    }, [isActive, onTabAway]);
}

// ── Focus Session ─────────────────────────────────────────────────────────────
function FocusSessionContent({ content, challenge, progress, onProgressUpdate }) {
    const [elapsed, setElapsed] = useState(progress.focus_seconds_elapsed || 0);
    const [running, setRunning] = useState(false);
    const [activePhase, setActivePhase] = useState(0);
    const [tabAway, setTabAway] = useState(progress.tab_away_count || 0);
    const [xpEarnedLive, setXpEarnedLive] = useState(0);
    const intervalRef = useRef(null);
    const lastXpMinuteRef = useRef(Math.floor((progress.focus_seconds_elapsed || 0) / 60));
    const phases = content?.phases || [];
    const target = (challenge.time_limit_minutes || 30) * 60;
    const minRequired = (challenge.completion_criteria?.min_focus_minutes || Math.round(challenge.time_limit_minutes * 0.7)) * 60;
    const pct = Math.min(100, Math.round((elapsed / target) * 100));
    const canComplete = elapsed >= minRequired;

    const handleTabAway = useCallback(() => {
        if (running) {
            setTabAway(p => p + 1);
            setRunning(false);
            onProgressUpdate({ tab_away_count: tabAway + 1 });
        }
    }, [running, tabAway, onProgressUpdate]);

    useTabVisibility(running, handleTabAway);

    useEffect(() => {
        if (!running) { clearInterval(intervalRef.current); return; }
        intervalRef.current = setInterval(() => {
            setElapsed(p => {
                const next = p + 1;
                // Save progress every 30s
                if (next % 30 === 0) onProgressUpdate({ focus_seconds_elapsed: next, tab_away_count: tabAway });
                // Award XP every completed minute
                const currentMinute = Math.floor(next / 60);
                if (currentMinute > lastXpMinuteRef.current) {
                    lastXpMinuteRef.current = currentMinute;
                    const minuteKey = `focus_${challenge.id}_min_${currentMinute}`;
                    base44.functions.invoke('awardXPIncremental', {
                        type: 'focus_minute',
                        event_key: minuteKey,
                        metadata: { challenge_id: challenge.id, minute: currentMinute, tab_away_count: tabAway, difficulty: challenge.difficulty }
                    }).then(res => {
                        const xp = res?.data?.xp_awarded || 0;
                        if (xp > 0) setXpEarnedLive(prev => prev + xp);
                    }).catch(() => {});
                }
                return next;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [running, tabAway, onProgressUpdate, challenge.id]);

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const remaining = Math.max(0, minRequired - elapsed);
    const remMins = Math.floor(remaining / 60);
    const remSecs = remaining % 60;

    return (
        <div className="space-y-4">
            {tabAway >= 3 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Tab-away detected ({tabAway}x). Timer paused automatically. Stay on this tab for verified focus time.
                </div>
            )}
            <div className="bg-gray-900 text-white rounded-2xl p-6 text-center space-y-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                    {running ? "Active Focus Time" : "Paused"}
                </p>
                <p className="text-4xl font-black font-mono">{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</p>
                <Progress value={pct} className="h-2 bg-gray-700" />
                <p className="text-xs text-gray-400">
                    {canComplete
                        ? "✅ Minimum reached — finish when ready!"
                        : `${String(remMins).padStart(2,'0')}:${String(remSecs).padStart(2,'0')} remaining until completion`}
                </p>
                <div className="flex justify-center min-h-[40px]">
                    <LiveXPBadge xp={xpEarnedLive} label="earned so far" />
                </div>
                <Button onClick={() => setRunning(!running)} variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    {running ? "⏸ Pause" : "▶ Start"}
                </Button>
            </div>
            <div className="space-y-2">
                {phases.map((phase, i) => (
                    <div key={i} onClick={() => setActivePhase(i)}
                        className={`cursor-pointer border-2 rounded-xl p-3 transition-all ${activePhase === i ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-gray-900">{phase.name}</span>
                            <Badge className="text-xs bg-green-100 text-green-700">{phase.duration_minutes}min</Badge>
                        </div>
                        {activePhase === i && <p className="text-xs text-gray-600">{phase.activity}</p>}
                    </div>
                ))}
            </div>
            {content?.success_indicator && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-800">✓ Success Indicator</p>
                    <p className="text-xs text-blue-700 mt-1">{content.success_indicator}</p>
                </div>
            )}
            <div className="flex items-center justify-between">
                <ProgressRing pct={pct} size={60} stroke={6} color={canComplete ? "#16a34a" : "#7c3aed"} />
                <Button onClick={() => onProgressUpdate({ focus_seconds_elapsed: elapsed, tab_away_count: tabAway, _submit: true })}
                    disabled={!canComplete}
                    className={`flex-1 ml-4 ${canComplete ? "bg-green-600 hover:bg-green-700" : "opacity-50 cursor-not-allowed bg-gray-300"}`}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {canComplete ? "Complete Session" : `Need ${Math.ceil((minRequired - elapsed) / 60)} more min`}
                </Button>
            </div>
        </div>
    );
}

// ── Practice Questions ────────────────────────────────────────────────────────
function PracticeQuestionsContent({ content, challenge, progress, onProgressUpdate }) {
    const questions = content?.questions || [];
    const minRequired = challenge.completion_criteria?.min_questions_attempted || Math.ceil(questions.length * 0.8);
    const [answers, setAnswers] = useState({});
    const [revealed, setRevealed] = useState({});
    const [correct, setCorrect] = useState({});
    const attempted = Object.keys(revealed).length;
    const correctCount = Object.values(correct).filter(Boolean).length;
    const pct = Math.min(100, Math.round((attempted / minRequired) * 100));
    const canComplete = attempted >= minRequired;

    const revealAnswer = (idx, q) => {
        if (revealed[idx]) return;
        setRevealed(p => ({ ...p, [idx]: true }));
        const newAttempted = attempted + 1;
        let isCorrect = false;
        if (q.type === 'mcq') {
            const userAns = answers[idx];
            isCorrect = q.options ? userAns === q.answer || String(userAns) === String(q.answer) : false;
        }
        setCorrect(p => ({ ...p, [idx]: isCorrect }));
        const newCorrect = correctCount + (isCorrect ? 1 : 0);
        onProgressUpdate({ questions_attempted: newAttempted, questions_correct: newCorrect });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
                <ProgressRing pct={pct} size={60} stroke={6} color={canComplete ? "#16a34a" : "#7c3aed"} />
                <div className="flex-1 text-sm text-gray-600">
                    <p><strong>{attempted}</strong> / {minRequired} questions attempted</p>
                    <p className="text-xs text-gray-400 mt-0.5">{minRequired - attempted > 0 ? `${minRequired - attempted} more to complete` : "✅ Ready to submit!"}</p>
                    {attempted > 0 && <p className="text-xs text-green-600 mt-0.5">Accuracy: {Math.round((correctCount / attempted) * 100)}%</p>}
                </div>
            </div>
            {questions.map((q, idx) => (
                <div key={idx} className={`border-2 rounded-xl p-4 space-y-3 transition-all ${revealed[idx] ? (correct[idx] ? "border-green-300 bg-green-50/50" : "border-orange-200 bg-orange-50/30") : "border-gray-200"}`}>
                    <p className="font-medium text-gray-900 text-sm">{idx + 1}. {q.question}</p>
                    {q.type === 'mcq' && q.options?.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {q.options.map((opt, oidx) => (
                                <button key={oidx} disabled={!!revealed[idx]}
                                    onClick={() => setAnswers(p => ({ ...p, [idx]: opt }))}
                                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                                        revealed[idx]
                                            ? (opt === q.answer ? "bg-green-100 border-green-400 font-bold text-green-800" : answers[idx] === opt ? "bg-red-100 border-red-300 text-red-700" : "border-gray-200 text-gray-400")
                                            : answers[idx] === opt ? "bg-purple-100 border-purple-400 font-semibold text-purple-800" : "border-gray-200 hover:border-gray-300 text-gray-700"}`}>
                                    {String.fromCharCode(65 + oidx)}. {opt}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <textarea className="w-full text-sm border rounded-lg p-2 min-h-16 resize-none focus:ring-2 focus:ring-purple-300 outline-none"
                            placeholder="Write your answer..." disabled={!!revealed[idx]}
                            value={answers[idx] || ''} onChange={e => setAnswers(p => ({ ...p, [idx]: e.target.value }))} />
                    )}
                    {!revealed[idx] ? (
                        <button onClick={() => revealAnswer(idx, q)} disabled={q.type !== 'mcq' && !answers[idx]}
                            className="text-xs text-purple-600 hover:text-purple-800 font-semibold disabled:opacity-40">
                            Reveal Answer
                        </button>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <p className="text-xs font-bold text-green-800 mb-1">✓ Model Answer</p>
                            <p className="text-xs text-green-700">{q.answer}</p>
                            {q.hint && <p className="text-xs text-gray-400 mt-1 italic">Tip: {q.hint}</p>}
                        </div>
                    )}
                </div>
            ))}
            <Button onClick={() => onProgressUpdate({ questions_attempted: attempted, questions_correct: correctCount, _submit: true })}
                disabled={!canComplete}
                className={`w-full ${canComplete ? "bg-green-600 hover:bg-green-700" : "opacity-50 cursor-not-allowed bg-gray-300"}`}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {canComplete ? "Complete Challenge" : `Attempt ${minRequired - attempted} more question${minRequired - attempted !== 1 ? 's' : ''}`}
            </Button>
        </div>
    );
}

// ── Flashcard Sprint ──────────────────────────────────────────────────────────
function FlashcardContent({ content, challenge, progress, onProgressUpdate }) {
    const cards = content?.cards || [];
    const minCards = challenge.completion_criteria?.min_cards_reviewed || Math.ceil(cards.length * 0.9);
    const [idx, setIdx] = useState(progress.cards_reviewed || 0);
    const [flipped, setFlipped] = useState(false);
    const [ratings, setRatings] = useState([]); // 0=wrong, 0.75=good, 1=easy
    const [xpEarnedLive, setXpEarnedLive] = useState(0);
    const card = cards[idx];
    const done = idx >= cards.length;
    const pct = Math.min(100, Math.round((idx / minCards) * 100));
    const accuracy = ratings.length > 0 ? Math.round((ratings.filter(r => r > 0).length / ratings.length) * 100) : 0;
    const canComplete = idx >= minCards;

    const rate = (val) => {
        const newRatings = [...ratings, val];
        setRatings(newRatings);
        const newIdx = idx + 1;
        const newCorrect = newRatings.filter(r => r >= 0.75).length;
        onProgressUpdate({ cards_reviewed: newIdx, cards_correct: newCorrect });
        setIdx(newIdx);
        setFlipped(false);
        // Award XP per card immediately
        const cardKey = `flashcard_${challenge.id}_card_${idx}`;
        base44.functions.invoke('awardXPIncremental', {
            type: 'flashcard_card',
            event_key: cardKey,
            metadata: { challenge_id: challenge.id, card_index: idx, correct: val >= 0.75 }
        }).then(res => {
            const xp = res?.data?.xp_awarded || 0;
            if (xp > 0) setXpEarnedLive(prev => prev + xp);
        }).catch(() => {});
    };

    if (done || (canComplete && idx >= cards.length)) {
        const finalAcc = ratings.length > 0 ? Math.round((ratings.filter(r => r >= 0.75).length / ratings.length) * 100) : 0;
        return (
            <div className="text-center py-8 space-y-4">
                <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className="text-lg font-bold text-gray-900">Sprint Complete!</h3>
                <div className="flex items-center justify-center gap-6 text-sm">
                    <div className="text-center"><p className="text-2xl font-black text-purple-600">{idx}</p><p className="text-gray-500">Cards</p></div>
                    <div className="text-center"><p className="text-2xl font-black text-green-600">{finalAcc}%</p><p className="text-gray-500">Accuracy</p></div>
                </div>
                <Button onClick={() => onProgressUpdate({ cards_reviewed: idx, cards_correct: ratings.filter(r => r >= 0.75).length, _submit: true })}
                    className="bg-green-600 hover:bg-green-700 w-full">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Challenge
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <span className="text-xs text-gray-500">Card {idx + 1} of {cards.length}</span>
                <div className="flex items-center gap-3">
                    <LiveXPBadge xp={xpEarnedLive} label="so far" />
                    <span className={`text-xs font-semibold ${accuracy >= 75 ? "text-green-600" : "text-orange-500"}`}>{accuracy}% acc</span>
                </div>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-center text-gray-400">{canComplete ? "✅ Minimum reached!" : `${minCards - idx} more cards to complete`}</p>

            <motion.div key={idx} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                className="cursor-pointer select-none" onClick={() => setFlipped(!flipped)}>
                <div className={`rounded-2xl border-2 p-6 min-h-36 flex items-center justify-center text-center transition-all ${flipped ? "bg-purple-50 border-purple-300" : "bg-gray-50 border-gray-200"}`}>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">{flipped ? "ANSWER" : "QUESTION — TAP TO FLIP"}</p>
                        <p className="text-base font-medium text-gray-900">{flipped ? card.back : card.front}</p>
                        {flipped && card.memory_tip && <p className="text-xs text-purple-500 mt-3 italic">💡 {card.memory_tip}</p>}
                    </div>
                </div>
            </motion.div>

            {flipped && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-2">
                    {[["Again", 0, "bg-red-100 text-red-700 border-red-200"], ["Good", 0.75, "bg-yellow-100 text-yellow-700 border-yellow-200"], ["Easy", 1, "bg-green-100 text-green-700 border-green-200"]].map(([label, val, cls]) => (
                        <button key={label} onClick={() => rate(val)} className={`py-2.5 text-sm font-bold rounded-xl border-2 ${cls} hover:opacity-80 transition-all`}>{label}</button>
                    ))}
                </motion.div>
            )}
            {!flipped && <p className="text-xs text-center text-gray-400">Rate after flipping to track progress</p>}
        </div>
    );
}

// ── Mini Test ─────────────────────────────────────────────────────────────────
function MiniTestContent({ content, challenge, progress, onProgressUpdate }) {
    const questions = content?.questions || [];
    const minScore = challenge.completion_criteria?.min_score_percent || 0;
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(progress.mini_test_submitted || false);
    const [score, setScore] = useState(progress.mini_test_score ?? null);

    const answeredCount = Object.keys(answers).length;
    const allAnswered = answeredCount >= questions.length;

    const handleSubmit = () => {
        let earned = 0, total = 0;
        questions.forEach((q, i) => {
            total += q.marks || 1;
            if (q.type === 'mcq' && answers[i] === q.answer) earned += q.marks || 1;
        });
        const finalScore = total > 0 ? Math.round((earned / total) * 100) : 0;
        setScore(finalScore);
        setSubmitted(true);
        onProgressUpdate({
            mini_test_submitted: true,
            mini_test_score: finalScore,
            questions_attempted: questions.length,
            questions_correct: earned
        });
    };

    return (
        <div className="space-y-4">
            {!submitted ? (
                <>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>{answeredCount} / {questions.length} answered</span>
                        {minScore > 0 && <span className="text-orange-600 font-semibold">Pass mark: {minScore}%</span>}
                    </div>
                    <Progress value={Math.round((answeredCount / questions.length) * 100)} className="h-1.5 mb-3" />
                    {questions.map((q, idx) => (
                        <div key={idx} className={`border-2 rounded-xl p-4 space-y-3 transition-all ${answers[idx] ? "border-purple-200" : "border-gray-200"}`}>
                            <div className="flex justify-between items-start">
                                <p className="font-medium text-sm text-gray-900 flex-1">{idx + 1}. {q.question}</p>
                                <Badge className="ml-2 bg-gray-100 text-gray-600 text-xs flex-shrink-0">{q.marks}mk</Badge>
                            </div>
                            {q.type === 'mcq' && q.options ? (
                                <div className="space-y-1.5">
                                    {q.options.map((opt, oi) => (
                                        <button key={oi} onClick={() => setAnswers(p => ({ ...p, [idx]: opt }))}
                                            className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${answers[idx] === opt ? "bg-purple-100 border-purple-400 font-medium text-purple-800" : "border-gray-200 hover:border-gray-300"}`}>
                                            {String.fromCharCode(65 + oi)}. {opt}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <textarea className="w-full text-sm border rounded-lg p-2 min-h-16 resize-none outline-none focus:ring-2 focus:ring-purple-300"
                                    value={answers[idx] || ''} onChange={e => setAnswers(p => ({ ...p, [idx]: e.target.value }))} />
                            )}
                        </div>
                    ))}
                    <Button onClick={handleSubmit} disabled={!allAnswered}
                        className={`w-full ${allAnswered ? "bg-orange-600 hover:bg-orange-700" : "opacity-50 cursor-not-allowed bg-gray-300"}`}>
                        {allAnswered ? "Submit Test" : `Answer all ${questions.length - answeredCount} remaining questions`}
                    </Button>
                </>
            ) : (
                <div className="space-y-4">
                    <div className={`rounded-2xl p-6 text-center ${score >= (minScore || 65) ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
                        <ProgressRing pct={score} size={80} stroke={8} color={score >= (minScore || 65) ? "#16a34a" : "#ea580c"} />
                        <p className={`text-sm font-semibold mt-3 ${score >= (minScore || 65) ? "text-green-700" : "text-orange-700"}`}>
                            {score >= 90 ? "Outstanding! 🔥" : score >= 75 ? "Great work! ✅" : score >= (minScore || 65) ? "Passed! Keep practising." : "Not quite — try again after reviewing."}
                        </p>
                        {minScore > 0 && score < minScore && (
                            <p className="text-xs text-orange-600 mt-1">Required {minScore}% to complete this challenge.</p>
                        )}
                    </div>
                    {content?.marking_guide && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-blue-800 mb-1">Marking Guide</p>
                            <p className="text-xs text-blue-700">{content.marking_guide}</p>
                        </div>
                    )}
                    <Button onClick={() => onProgressUpdate({ mini_test_submitted: true, mini_test_score: score, _submit: true })}
                        disabled={minScore > 0 && score < minScore}
                        className={`w-full ${(minScore === 0 || score >= minScore) ? "bg-green-600 hover:bg-green-700" : "opacity-50 cursor-not-allowed bg-gray-300"}`}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {(minScore === 0 || score >= minScore) ? "Complete Challenge" : `Need ${minScore}% to complete (got ${score}%)`}
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Revision Schedule ─────────────────────────────────────────────────────────
function RevisionScheduleContent({ content, challenge, progress, onProgressUpdate }) {
    const days = content?.days || [];
    const minDays = challenge.completion_criteria?.min_days_completed || Math.ceil(days.length * 0.8);
    const [checked, setChecked] = useState({});
    const done = Object.values(checked).filter(Boolean).length;
    const pct = Math.min(100, Math.round((done / minDays) * 100));
    const canComplete = done >= minDays;

    const toggle = (i) => {
        if (checked[i]) return; // cannot uncheck — prevents gaming
        const newChecked = { ...checked, [i]: true };
        setChecked(newChecked);
        const newDone = Object.values(newChecked).filter(Boolean).length;
        onProgressUpdate({ days_marked: newDone });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-4">
                <ProgressRing pct={pct} size={60} stroke={6} color={canComplete ? "#16a34a" : "#6366f1"} />
                <div className="flex-1 text-sm text-gray-600">
                    <p><strong>{done}</strong> / {minDays} days completed</p>
                    <p className="text-xs text-gray-400 mt-0.5">{canComplete ? "✅ Ready to complete!" : `${minDays - done} more days to complete`}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Days cannot be unchecked.</p>
                </div>
            </div>
            <Progress value={pct} className="h-1.5" />
            {days.map((day, i) => (
                <div key={i} onClick={() => toggle(i)}
                    className={`cursor-pointer border-2 rounded-xl p-3 transition-all ${checked[i] ? "border-green-300 bg-green-50 cursor-default" : "border-gray-200 hover:border-indigo-300"}`}>
                    <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${checked[i] ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                            {checked[i] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-xs text-gray-500 uppercase">Day {day.day}</span>
                                {day.label && <span className="text-xs text-gray-400">— {day.label}</span>}
                                <Badge className="text-xs bg-gray-100 text-gray-600 ml-auto">{day.duration_minutes}min</Badge>
                            </div>
                            <p className={`text-sm font-medium ${checked[i] ? "line-through text-gray-400" : "text-gray-900"}`}>{day.task}</p>
                            {day.method && <p className="text-xs text-gray-500 mt-0.5">{day.method}</p>}
                        </div>
                    </div>
                </div>
            ))}
            <Button onClick={() => onProgressUpdate({ days_marked: done, _submit: true })}
                disabled={!canComplete}
                className={`w-full ${canComplete ? "bg-indigo-600 hover:bg-indigo-700" : "opacity-50 cursor-not-allowed bg-gray-300"}`}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {canComplete ? "Complete Challenge" : `Complete ${minDays - done} more day${minDays - done !== 1 ? 's' : ''}`}
            </Button>
        </div>
    );
}

// ── Main ChallengeEngine ──────────────────────────────────────────────────────
export default function ChallengeEngine({ goal, subGoal, onXPEarned }) {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [activeChallenge, setActiveChallenge] = useState(null);
    const [pastChallenges, setPastChallenges] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [celebration, setCelebration] = useState(null); // { xp, score }
    const saveTimerRef = useRef(null);

    useEffect(() => {
        if (subGoal?.id) loadHistory();
    }, [subGoal?.id]);

    const loadHistory = async () => {
        const user = await base44.auth.me();
        // CRITICAL: filter by created_by so each user only sees their own challenges
        const all = await base44.entities.GoalChallenge.filter({ goal_id: goal.id, sub_goal_id: subGoal.id, created_by: user.email });
        const sorted = (all || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setPastChallenges(sorted);
        const active = sorted.find(c => c.status === 'active');
        if (active) setActiveChallenge(active);
        setIsLoaded(true);
    };

    // Debounced progress save to backend
    const handleProgressUpdate = useCallback(async (partial) => {
        if (!activeChallenge) return;
        const isSubmit = partial._submit;
        const cleanPartial = { ...partial };
        delete cleanPartial._submit;

        // Optimistic local update
        setActiveChallenge(prev => ({
            ...prev,
            progress: { ...(prev.progress || {}), ...cleanPartial }
        }));

        // Debounce saves (every 5s or on submit)
        clearTimeout(saveTimerRef.current);
        const doSave = async () => {
            try {
                await base44.functions.invoke('saveChallengeProgress', {
                    challenge_id: activeChallenge.id,
                    progress: cleanPartial
                });
            } catch (_) {}
        };

        if (isSubmit) {
            await doSave();
            await handleComplete(cleanPartial);
        } else {
            saveTimerRef.current = setTimeout(doSave, 5000);
        }
    }, [activeChallenge]);

    const handleGenerate = async (reshuffle = false) => {
        setIsGenerating(true);
        try {
            // If reshuffling, skip the active one first
            if (reshuffle && activeChallenge) {
                await base44.entities.GoalChallenge.update(activeChallenge.id, { status: 'skipped' });
                setPastChallenges(prev => prev.map(c => c.id === activeChallenge.id ? { ...c, status: 'skipped' } : c));
                setActiveChallenge(null);
            }
            const res = await base44.functions.invoke('generateGoalChallenge', {
                goal_id: goal.id,
                sub_goal_id: subGoal.id,
            });
            const data = res?.data ?? res;
            setActiveChallenge(data.challenge);
            setPastChallenges(prev => [data.challenge, ...prev.filter(c => c.id !== data.challenge.id)]);
            toast({ title: reshuffle ? "New Challenge Generated! 🔀" : "Challenge Ready! ⚡", description: data.challenge.title });
        } catch (err) {
            toast({ title: "Failed to generate challenge", description: err.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleComplete = async (finalProgress) => {
        if (!activeChallenge || isCompleting) return;
        setIsCompleting(true);
        try {
            const res = await base44.functions.invoke('completeGoalChallenge', {
                challenge_id: activeChallenge.id,
                final_progress: finalProgress,
            });
            const data = res?.data ?? res;

            if (data.error) {
                toast({ title: "Cannot complete yet", description: data.reasons?.join(' ') || data.error, variant: "destructive" });
                return;
            }

            setCelebration({ xp: data.xp_awarded, score: data.score });
            if (onXPEarned) onXPEarned(data.xp_awarded);
            setActiveChallenge(prev => ({ ...prev, status: 'completed', result: data.challenge?.result }));
            setPastChallenges(prev => prev.map(c => c.id === activeChallenge.id ? { ...c, status: 'completed', result: data.challenge?.result } : c));
        } catch (err) {
            const errData = err?.response?.data || {};
            const msg = errData.reasons?.join(' ') || errData.error || err.message;
            toast({ title: "Could not complete challenge", description: msg, variant: "destructive" });
        } finally {
            setIsCompleting(false);
        }
    };

    const config = activeChallenge ? TYPE_CONFIG[activeChallenge.challenge_type] : null;
    const completedCount = pastChallenges.filter(c => c.status === 'completed').length;
    const lastScore = pastChallenges.filter(c => c.result?.score != null)[0]?.result?.score;

    const renderContent = () => {
        if (!activeChallenge?.content) return null;
        const sharedProps = {
            content: activeChallenge.content,
            challenge: activeChallenge,
            progress: activeChallenge.progress || {},
            onProgressUpdate: handleProgressUpdate,
        };
        switch (activeChallenge.challenge_type) {
            case 'practice_questions': return <PracticeQuestionsContent {...sharedProps} />;
            case 'flashcard_sprint':   return <FlashcardContent {...sharedProps} />;
            case 'focus_session':      return <FocusSessionContent {...sharedProps} />;
            case 'mini_test':          return <MiniTestContent {...sharedProps} />;
            case 'revision_schedule':  return <RevisionScheduleContent {...sharedProps} />;
            default: return null;
        }
    };

    if (!isLoaded) return (
        <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
    );

    return (
        <>
            <AnimatePresence>
                {celebration && (
                    <CompletionCelebration
                        xp={celebration.xp}
                        score={celebration.score}
                        onDismiss={() => setCelebration(null)}
                    />
                )}
            </AnimatePresence>

            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h3 className="font-bold text-gray-900">AI Challenges</h3>
                        {completedCount > 0 && <Badge className="bg-purple-100 text-purple-700 text-xs">{completedCount} done</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                        {lastScore != null && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Last: <span className={`font-bold ml-0.5 ${lastScore >= 75 ? "text-green-600" : "text-orange-500"}`}>{lastScore}%</span>
                            </div>
                        )}
                        {/* Always show generate/new button in header when no active challenge */}
                        {(!activeChallenge || activeChallenge.status !== 'active') && (
                            <Button size="sm" onClick={() => handleGenerate(false)} disabled={isGenerating}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-xs h-8 px-3">
                                {isGenerating
                                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                                    : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />{completedCount > 0 ? "New Challenge" : "Start Challenge"}</>}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Active Challenge */}
                {activeChallenge && activeChallenge.status === 'active' ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className={`rounded-2xl border-2 ${config?.border || "border-purple-200"} ${config?.bg || "bg-purple-50"} p-4`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <Badge className={`${DIFF_BADGE[activeChallenge.difficulty]} text-xs capitalize`}>
                                            {activeChallenge.difficulty?.replace('_', ' ')}
                                        </Badge>
                                        <Badge className="bg-amber-100 text-amber-700 text-xs flex items-center gap-1">
                                            <Zap className="w-3 h-3" />{activeChallenge.xp_reward} XP
                                        </Badge>
                                        <Badge className="bg-gray-100 text-gray-600 text-xs flex items-center gap-1">
                                            <Clock className="w-3 h-3" />{activeChallenge.time_limit_minutes}min
                                        </Badge>
                                    </div>
                                    <h4 className={`font-bold text-sm ${config?.text || "text-purple-700"}`}>{activeChallenge.title}</h4>
                                    <p className="text-xs text-gray-600 mt-1">{activeChallenge.description}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {config?.icon && <config.icon className={`w-8 h-8 ${config.text || "text-purple-600"} flex-shrink-0 opacity-60`} />}
                                    <button onClick={() => handleGenerate(true)} disabled={isGenerating}
                                        title="Get a different challenge"
                                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 rounded-lg px-2.5 py-1.5 font-semibold transition-all shadow-sm disabled:opacity-40">
                                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} /> New Challenge
                                    </button>
                                </div>
                            </div>
                            {activeChallenge.instructions && (
                                <div className="bg-white/70 rounded-xl p-3 mb-3">
                                    <p className="text-xs text-gray-700">{activeChallenge.instructions}</p>
                                </div>
                            )}
                            {activeChallenge.completion_criteria && (
                                <div className="bg-white/60 border border-white/80 rounded-xl p-2.5 mb-2">
                                    <p className="text-xs font-bold text-gray-600 mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> Objective Completion Criteria</p>
                                    <p className="text-xs text-gray-500">{activeChallenge.target_metric}</p>
                                </div>
                            )}
                            {activeChallenge.ai_reasoning && (
                                <div className="bg-white/50 border border-white/80 rounded-xl p-2.5">
                                    <p className="text-xs text-gray-500 italic">🤖 {activeChallenge.ai_reasoning}</p>
                                </div>
                            )}
                        </div>

                        {/* Live progress bar */}
                        {(activeChallenge.progress?.percent_complete > 0) && (
                            <div className="flex items-center gap-3 px-1">
                                <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                <div className="flex-1">
                                    <Progress value={activeChallenge.progress.percent_complete} className="h-2" />
                                </div>
                                <span className="text-xs font-bold text-gray-600">{activeChallenge.progress.percent_complete}%</span>
                            </div>
                        )}

                        <div className="bg-white border border-gray-200 rounded-2xl p-4">
                            {isCompleting ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                                    <p className="text-sm text-gray-600 font-medium">Verifying completion…</p>
                                </div>
                            ) : renderContent()}
                        </div>
                    </motion.div>
                ) : activeChallenge?.status === 'completed' ? (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 text-center space-y-3">
                        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                        <p className="font-semibold text-gray-800">Challenge Complete!</p>
                        <p className="text-sm text-gray-500">Difficulty adapts to your performance.</p>
                        <Button onClick={() => handleGenerate(false)} disabled={isGenerating}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                            {isGenerating
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                                : <><Sparkles className="w-4 h-4 mr-2" />Generate Next Challenge</>}
                        </Button>
                    </div>
                ) : null
                }

                {/* History */}
                {pastChallenges.length > 0 && (
                    <div>
                        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                            <BarChart3 className="w-4 h-4" />
                            {completedCount} completed challenge{completedCount !== 1 ? 's' : ''}
                            {showHistory ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                        <AnimatePresence>
                            {showHistory && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 space-y-1.5">
                                    {pastChallenges.filter(c => c.status === 'completed').map((c) => {
                                        const cfg = TYPE_CONFIG[c.challenge_type];
                                        return (
                                            <div key={c.id} className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                                                {cfg?.icon && <cfg.icon className="w-3.5 h-3.5 text-gray-400" />}
                                                <span className="flex-1 truncate">{c.title}</span>
                                                <span className="capitalize text-gray-400">{c.difficulty?.replace('_', ' ')}</span>
                                                {c.result?.score != null && (
                                                    <span className={`font-bold ${c.result.score >= 75 ? "text-green-600" : "text-orange-500"}`}>{c.result.score}%</span>
                                                )}
                                                <span className="text-amber-600 font-semibold">+{c.xp_reward}XP</span>
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </>
    );
}