import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Trash2, FileQuestion, ChevronDown, ChevronUp, Clock, History, Shuffle } from "lucide-react";

const difficultyConfig = {
    beginner: { bg: "bg-emerald-500", text: "text-emerald-700", light: "bg-emerald-50" },
    intermediate: { bg: "bg-amber-500", text: "text-amber-700", light: "bg-amber-50" },
    advanced: { bg: "bg-rose-500", text: "text-rose-700", light: "bg-rose-50" },
    Easy: { bg: "bg-emerald-500", text: "text-emerald-700", light: "bg-emerald-50" },
    Medium: { bg: "bg-amber-500", text: "text-amber-700", light: "bg-amber-50" },
    Hard: { bg: "bg-rose-500", text: "text-rose-700", light: "bg-rose-50" }
};

const QuizCard = React.memo(({ quiz, onPlay, onDelete, onReshuffle, pastAttempts = [], subjectColor }) => {
    const [showResults, setShowResults] = useState(false);
    const quizAttempts = pastAttempts.filter(a => a.quiz_id === quiz.id);
    const bestAttempt = quizAttempts.length > 0 
        ? quizAttempts.reduce((best, current) => current.score > best.score ? current : best, quizAttempts[0])
        : null;
    
    const difficulty = difficultyConfig[quiz.difficulty] || difficultyConfig.intermediate;
    const color = subjectColor || '#8B5CF6';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="h-full"
        >
            <Card className="h-full flex flex-col overflow-hidden bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl">
                {/* Colored Top Bar */}
                <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}dd)` }} />
                
                <CardContent className="p-5 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-4">
                        <div 
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                        >
                            <FileQuestion className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 mb-1.5">
                                {quiz.title}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${difficulty.light} ${difficulty.text}`}>
                                    {quiz.difficulty || 'Medium'}
                                </span>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-500">{quiz.questions?.length || 0} questions</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center py-2.5 bg-gray-50 rounded-xl">
                            <p className="text-base font-bold text-gray-900">{quizAttempts.length}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Attempts</p>
                        </div>
                        <div className="text-center py-2.5 bg-gray-50 rounded-xl">
                            {bestAttempt ? (
                                <>
                                    <p className={`text-base font-bold ${
                                        bestAttempt.score >= 80 ? 'text-emerald-600' :
                                        bestAttempt.score >= 60 ? 'text-amber-600' : 'text-rose-600'
                                    }`}>
                                        {bestAttempt.score}%
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Best</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-bold text-gray-300">—</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Best</p>
                                </>
                            )}
                        </div>
                        <div className="text-center py-2.5 bg-gray-50 rounded-xl">
                            {quizAttempts.length > 0 ? (
                                <>
                                    <p className="text-base font-bold text-gray-700">
                                        {Math.round(quizAttempts.reduce((acc, a) => acc + a.score, 0) / quizAttempts.length)}%
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-bold text-gray-300">—</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Results Accordion */}
                    {quizAttempts.length > 0 && (
                        <div className="mb-4">
                            <button
                                onClick={() => setShowResults(!showResults)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
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
                                            {quizAttempts.slice(0, 5).map((attempt, idx) => (
                                                <div key={attempt.id} className="flex items-center justify-between text-xs bg-gray-50/80 rounded-lg px-3 py-1.5">
                                                    <span className="text-gray-500">
                                                        {new Date(attempt.created_date).toLocaleDateString()}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-semibold ${
                                                            attempt.score >= 80 ? 'text-emerald-600' :
                                                            attempt.score >= 60 ? 'text-amber-600' : 'text-rose-600'
                                                        }`}>
                                                            {attempt.score}%
                                                        </span>
                                                        <span className="text-gray-400 flex items-center gap-0.5">
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

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto">
                        <Button
                            onClick={onPlay}
                            className="flex-1 h-10 rounded-xl font-medium shadow-sm hover:shadow transition-all"
                            style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                        >
                            <Play className="w-4 h-4 mr-1.5" />
                            {quizAttempts.length > 0 ? 'Retry' : 'Start'}
                        </Button>
                        {quiz.source_file_url && onReshuffle && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onReshuffle(quiz)}
                                className="h-10 w-10 rounded-xl text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Generate new questions from source"
                            >
                                <Shuffle className="w-4 h-4" />
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(quiz.id)}
                            className="h-10 w-10 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});

QuizCard.displayName = 'QuizCard';

export default QuizCard;