import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Lock, CheckCircle2, Check, Zap, ChevronDown, ChevronRight,
    BookOpen, Brain, FileQuestion, Clock, Star,
    TrendingUp, ExternalLink
} from "lucide-react";
import { createPageUrl } from "@/utils";

const TYPE_CONFIG = {
    study_hours: {
        icon: Clock,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        label: "Study Hours",
        unit: "hrs",
        navPage: "Study",
        navLabel: "Open AcedIt Study"
    },
    quiz_score: {
        icon: Star,
        color: "text-purple-600",
        bg: "bg-purple-50",
        border: "border-purple-200",
        label: "Quiz Score",
        unit: "%",
        navPage: "Quizzes",
        navLabel: "Take Quizzes"
    },
    quiz_count: {
        icon: FileQuestion,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        label: "Quizzes Done",
        unit: "quizzes",
        navPage: "Quizzes",
        navLabel: "Take Quizzes"
    },
    flashcard_reviews: {
        icon: Brain,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        label: "Flashcard Reviews",
        unit: "reviews",
        navPage: "Study",
        navLabel: "Spaced Repetition"
    },
    study_sessions: {
        icon: BookOpen,
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        label: "Study Sessions",
        unit: "sessions",
        navPage: "Study",
        navLabel: "Start Session"
    },
    manual: {
        icon: CheckCircle2,
        color: "text-slate-600",
        bg: "bg-slate-50",
        border: "border-slate-200",
        label: "Task",
        unit: "",
        navPage: "Study",
        navLabel: "Open Study"
    },
};

function ProgressRing({ value, size = 40, strokeWidth = 4, color = "#7c3aed" }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(value, 100) / 100) * circ;
    return (
        <svg width={size} height={size} className="flex-shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={value >= 100 ? "#16a34a" : color}
                strokeWidth={strokeWidth}
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={size * 0.22} fontWeight="bold"
                fill={value >= 100 ? "#16a34a" : color}>
                {Math.round(Math.min(value, 100))}%
            </text>
        </svg>
    );
}

function ActionItemRow({ item, isUnlocked }) {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.study_hours;
    const Icon = config.icon;
    const isManual = item.type === 'manual';
    const progress = item.target > 0 ? (item.current_progress / item.target) * 100 : 0;
    const displayProgress = item.type === 'study_hours'
        ? `${(item.current_progress || 0).toFixed(1)} / ${item.target} hrs`
        : item.type === 'quiz_score'
        ? `${Math.round(item.current_progress || 0)}% / ${item.target}%`
        : isManual
        ? (item.completed ? "Completed" : "To do")
        : `${Math.round(item.current_progress || 0)} / ${item.target} ${config.unit}`;

    return (
        <div className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 ${isUnlocked ? "bg-white" : "bg-gray-50 opacity-50"}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.completed ? "bg-green-50" : config.bg}`}>
                {item.completed
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Icon className={`w-4 h-4 ${config.color}`} />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.completed ? "line-through text-gray-400" : "text-gray-800"}`}>{item.title}</p>
                {isUnlocked && (
                    <div className="mt-1 space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className={`${item.completed ? "text-green-600" : config.color} font-semibold`}>{displayProgress}</span>
                            {!item.completed && !isManual && (
                                <a href={createPageUrl(item.navigation || config.navPage)}
                                    className={`flex items-center gap-1 text-xs ${config.color} hover:underline`}>
                                    {config.navLabel} <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                        {!isManual && <Progress value={Math.min(progress, 100)} className="h-1.5" />}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {!isManual && <ProgressRing value={isUnlocked ? Math.min(progress, 100) : 0} size={36} strokeWidth={3} />}
                {isManual && isUnlocked && (
                    <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${item.completed ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                        {item.completed && <Check className="w-4 h-4 text-white" />}
                    </div>
                )}
                <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" />{item.xp_reward}
                </span>
            </div>
        </div>
    );
}

export default function SubGoalCard({ subGoal, index, activeIndex, goal }) {
    const [isExpanded, setIsExpanded] = useState(index === activeIndex);
    const isActive = index === activeIndex;
    const isCompleted = subGoal.completed;
    const isLocked = index > activeIndex;

    const actionItems = subGoal.sub_sub_goals || [];
    const completedCount = actionItems.filter(i => i.completed).length;
    const totalCount = actionItems.length;

    // Progress from actual tracked data
    const progressPct = totalCount > 0
        ? Math.round((completedCount / totalCount) * 100)
        : (isCompleted ? 100 : 0);

    const xpTotal = actionItems.reduce((s, i) => s + (i.xp_reward || 0), 0) || subGoal.xp_reward || 0;

    // Auto-complete label
    const autoCompleteNote = totalCount > 0
        ? `${completedCount}/${totalCount} objectives met — auto-tracked from your AcedIt activity`
        : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`rounded-2xl border-2 overflow-hidden transition-all ${
                isCompleted ? "border-green-300 bg-green-50/30" :
                isActive ? "border-purple-400 bg-white shadow-lg shadow-purple-100" :
                "border-gray-200 bg-gray-50/50"
            }`}
        >
            {/* Header */}
            <button
                onClick={() => !isLocked && setIsExpanded(!isExpanded)}
                disabled={isLocked}
                className="w-full flex items-center gap-4 p-4 text-left"
            >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all ${
                    isCompleted ? "bg-green-500 text-white" :
                    isActive ? "bg-purple-600 text-white ring-4 ring-purple-200" :
                    "bg-gray-200 text-gray-400"
                }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isLocked ? <Lock className="w-4 h-4" /> : index + 1}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className={`font-semibold text-sm truncate ${isLocked ? "text-gray-400" : "text-gray-900"}`}>{subGoal.title}</p>
                        {isActive && <Badge className="bg-purple-100 text-purple-700 text-xs border-0 flex-shrink-0">Active</Badge>}
                        {isCompleted && <Badge className="bg-green-100 text-green-700 text-xs border-0 flex-shrink-0">Done ✓</Badge>}
                    </div>
                    {!isLocked && totalCount > 0 && (
                        <div className="flex items-center gap-3">
                            <Progress value={progressPct} className="h-1.5 flex-1" />
                            <span className="text-xs text-gray-500 flex-shrink-0">{completedCount}/{totalCount}</span>
                        </div>
                    )}
                    {isActive && !isCompleted && (
                        <p className="text-xs text-purple-500 mt-0.5 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Auto-tracked from your AcedIt usage
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-amber-600 font-bold flex items-center gap-1"><Zap className="w-3 h-3" />{xpTotal}</span>
                    {!isLocked && (isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
                </div>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && !isLocked && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-gray-100">
                            {/* Auto-track notice */}
                            {isActive && (() => {
                                const hasTracked = actionItems.some(i => i.type && i.type !== 'manual');
                                const hasManual = actionItems.some(i => i.type === 'manual');
                                if (!hasTracked && !hasManual) return null;
                                return (
                                    <div className="mx-4 mt-3 mb-1 flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-xl p-3">
                                        <TrendingUp className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-semibold text-purple-800">
                                                {hasManual && hasTracked ? "Mixed objectives" : hasManual ? "Manual tasks" : "Auto-tracked objectives"}
                                            </p>
                                            <p className="text-xs text-purple-600">
                                                {hasManual && hasTracked
                                                    ? "Some objectives are manually ticked off; others auto-complete when you hit targets in AcedIt."
                                                    : hasManual
                                                    ? "Mark these tasks as complete when you've done them. They're specific to what your sub-goal actually requires."
                                                    : "These objectives complete automatically when you hit the targets through normal AcedIt use."}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {actionItems.length > 0 && actionItems.map((item) => (
                                <ActionItemRow
                                    key={item.id}
                                    item={item}
                                    isUnlocked={isActive || isCompleted}
                                />
                            ))}

                            {/* Completed state */}
                            {isCompleted && (
                                <div className="p-4 bg-green-50 border-t border-green-200 text-center">
                                    <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
                                    <p className="text-sm font-bold text-green-800">Sub-goal completed!</p>
                                    <p className="text-xs text-green-600">All AcedIt objectives were verified automatically.</p>
                                </div>
                            )}

                            {/* Active but not done — motivational nudge */}
                            {isActive && !isCompleted && totalCount > 0 && (
                                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                                    <p className="text-xs text-gray-500">
                                        Complete your objectives in AcedIt — this sub-goal will unlock the next one automatically when all are met.
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}