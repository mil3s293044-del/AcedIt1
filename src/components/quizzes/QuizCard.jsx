import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, Trash2, FileQuestion, ChevronDown, ChevronUp, Clock, History, Shuffle, Target } from "lucide-react";

// Static lookup tables (Tailwind JIT-safe)
const difficultyConfig = {
    beginner:     { text: "text-primary", light: "bg-primary/10" },
    intermediate: { text: "text-xp",      light: "bg-xp/10" },
    advanced:     { text: "text-streak",  light: "bg-streak/10" },
    Easy:         { text: "text-primary", light: "bg-primary/10" },
    Medium:       { text: "text-xp",      light: "bg-xp/10" },
    Hard:         { text: "text-streak",  light: "bg-streak/10" }
};

const getScoreTextClass = (score) => {
    if (score >= 90) return "text-primary";
    if (score >= 70) return "text-chart-3";
    if (score >= 50) return "text-xp";
    return "text-streak";
};

const QuizCard = React.memo(({ quiz, onPlay, onRetryWrong, onDelete, onReshuffle, pastAttempts = [] }) => {
    const [showResults, setShowResults] = useState(false);
    const quizAttempts = pastAttempts.filter(a => a.quiz_id === quiz.id);

    // Wrong MCQ questions from the most recent attempt (short answers can't be
    // auto-graded without stored feedback, so they're excluded).
    const mostRecent = [...quizAttempts].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))[0];
    const wrongIdx = mostRecent?.user_answers
        ? (quiz.questions || [])
            .map((q, i) => ({ q, i }))
            .filter(({ q, i }) => q.type === 'mcq' && (mostRecent.user_answers[i] === undefined || parseInt(mostRecent.user_answers[i]) !== q.correct_answer))
            .map(({ i }) => i)
        : [];
    // Display the adjusted score when present (includes self-marked paper work)
    // so the card matches what the student sees on the results page.
    const effectiveScore = (a) => (typeof a.adjusted_score === "number" ? a.adjusted_score : a.score);
    const bestAttempt = quizAttempts.length > 0
        ? quizAttempts.reduce((best, current) => effectiveScore(current) > effectiveScore(best) ? current : best, quizAttempts[0])
        : null;
    const bestScore = bestAttempt ? effectiveScore(bestAttempt) : null;

    const difficulty = difficultyConfig[quiz.difficulty] || difficultyConfig.intermediate;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="h-full"
        >
            <div className="card-soft h-full flex flex-col overflow-hidden">
                {/* Colored Top Bar */}
                <div className="h-1.5 bg-chart-3" />

                <div className="p-5 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-chart-3/10">
                            <FileQuestion className="w-5 h-5 text-chart-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground leading-snug line-clamp-2 mb-1.5">
                                {quiz.title}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${difficulty.light} ${difficulty.text}`}>
                                    {quiz.difficulty || 'Medium'}
                                </span>
                                <span className="text-xs text-muted-foreground/60">•</span>
                                <span className="text-xs text-muted-foreground">{quiz.questions?.length || 0} questions</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center py-2.5 bg-secondary/50 rounded-xl">
                            <p className="text-base font-bold text-foreground">{quizAttempts.length}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Attempts</p>
                        </div>
                        <div className="text-center py-2.5 bg-secondary/50 rounded-xl">
                            {bestAttempt ? (
                                <>
                                    <p className={`text-base font-bold ${getScoreTextClass(bestScore)}`}>
                                        {bestScore}%
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Best</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-bold text-muted-foreground/60">—</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Best</p>
                                </>
                            )}
                        </div>
                        <div className="text-center py-2.5 bg-secondary/50 rounded-xl">
                            {quizAttempts.length > 0 ? (
                                <>
                                    <p className="text-base font-bold text-muted-foreground">
                                        {Math.round(quizAttempts.reduce((acc, a) => acc + a.score, 0) / quizAttempts.length)}%
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-bold text-muted-foreground/60">—</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Results Accordion */}
                    {quizAttempts.length > 0 && (
                        <div className="mb-4">
                            <button
                                onClick={() => setShowResults(!showResults)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                            >
                                <History className="w-3.5 h-3.5" />
                                {showResults ? 'Hide History' : 'View History'}
                                {showResults ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <AnimatePresence>
                                {showResults && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                                            {quizAttempts.slice(0, 5).map((attempt) => (
                                                <div key={attempt.id} className="flex items-center justify-between text-xs bg-secondary/50 rounded-lg px-3 py-1.5">
                                                    <span className="text-muted-foreground">
                                                        {new Date(attempt.created_date).toLocaleDateString()}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-semibold ${getScoreTextClass(attempt.score)}`}>
                                                            {attempt.score}%
                                                        </span>
                                                        <span className="text-muted-foreground/60 flex items-center gap-0.5">
                                                            <Clock className="w-3 h-3" />
                                                            {Math.floor(attempt.time_taken / 60)}:{(attempt.time_taken % 60).toString().padStart(2, '0')}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Spacer to push actions to bottom */}
                    <div className="flex-1" />

                    {/* Retry-wrong shortcut */}
                    {wrongIdx.length > 0 && onRetryWrong && (
                        <Button
                            onClick={() => onRetryWrong(wrongIdx)}
                            variant="outline"
                            className="w-full h-9 rounded-xl font-medium text-streak border-streak/30 hover:bg-streak/10 hover:border-streak/50 mb-2"
                        >
                            <Target className="w-4 h-4 mr-1.5" />
                            Retry {wrongIdx.length} wrong
                        </Button>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto">
                        <Button
                            onClick={onPlay}
                            className="flex-1 h-10 rounded-xl font-medium bg-chart-3 hover:bg-chart-3/90 text-white"
                        >
                            <Play className="w-4 h-4 mr-1.5" />
                            {quizAttempts.length > 0 ? 'Retry all' : 'Start'}
                        </Button>
                        {quiz.source_file_url && onReshuffle && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Generate new questions"
                                onClick={() => onReshuffle(quiz)}
                                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-chart-4 hover:bg-chart-4/10 transition-colors"
                                title="Generate new questions from source"
                            >
                                <Shuffle className="w-4 h-4" />
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete quiz"
                            onClick={() => onDelete(quiz.id)}
                            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-streak hover:bg-streak/10 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

QuizCard.displayName = 'QuizCard';

export default QuizCard;
