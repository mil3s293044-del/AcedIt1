import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import {
    Lock, CheckCircle2, Check, Zap, ChevronDown, ChevronRight,
    BookOpen, Brain, FileQuestion, Clock, Star,
    TrendingUp, ExternalLink
} from "lucide-react";
import { createPageUrl } from "@/utils";

// All class strings are pre-computed full static strings so Tailwind JIT can see them.
const TYPE_CONFIG = {
    study_hours: {
        icon: Clock,
        color: "text-primary",
        bg: "bg-primary/10",
        border: "border-primary/20",
        label: "Study Hours",
        unit: "hrs",
        navPage: "Study",
        navLabel: "Open AcedIt Study"
    },
    quiz_score: {
        icon: Star,
        color: "text-chart-4",
        bg: "bg-chart-4/10",
        border: "border-chart-4/20",
        label: "Quiz Score",
        unit: "%",
        navPage: "Quizzes",
        navLabel: "Take Quizzes"
    },
    quiz_count: {
        icon: FileQuestion,
        color: "text-chart-4",
        bg: "bg-chart-4/10",
        border: "border-chart-4/20",
        label: "Quizzes Done",
        unit: "quizzes",
        navPage: "Quizzes",
        navLabel: "Take Quizzes"
    },
    flashcard_reviews: {
        icon: Brain,
        color: "text-chart-3",
        bg: "bg-chart-3/10",
        border: "border-chart-3/20",
        label: "Flashcard Reviews",
        unit: "reviews",
        navPage: "Study",
        navLabel: "Spaced Repetition"
    },
    study_sessions: {
        icon: BookOpen,
        color: "text-xp",
        bg: "bg-xp/10",
        border: "border-xp/20",
        label: "Study Sessions",
        unit: "sessions",
        navPage: "Study",
        navLabel: "Start Session"
    },
    manual: {
        icon: CheckCircle2,
        color: "text-muted-foreground",
        bg: "bg-secondary",
        border: "border-border",
        label: "Task",
        unit: "",
        navPage: "Study",
        navLabel: "Open Study"
    },
};

// Shell classes for the sub-goal card itself, indexed by state. Pre-computed for JIT.
const SHELL_CLASSES = {
    completed: "border-primary/30 bg-primary/5",
    active:    "border-chart-3/40 bg-surface shadow-soft",
    locked:    "border-border bg-secondary/50",
};

const NUMBER_BADGE_CLASSES = {
    completed: "bg-primary text-white",
    active:    "bg-chart-3 text-white ring-4 ring-chart-3/20",
    locked:    "bg-secondary text-muted-foreground/60",
};

function ProgressRing({ value, size = 40, strokeWidth = 4 }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(value, 100) / 100) * circ;
    // Use design tokens via HSL CSS variables for stroke colors.
    const trackStroke = "hsl(var(--border))";
    const activeStroke = "hsl(var(--chart-3))";
    const doneStroke = "hsl(var(--primary))";
    const stroke = value >= 100 ? doneStroke : activeStroke;
    return (
        <svg width={size} height={size} className="flex-shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackStroke} strokeWidth={strokeWidth} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={size * 0.22} fontWeight="bold"
                fill={stroke}>
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
        <div className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${isUnlocked ? "bg-surface" : "bg-secondary/50 opacity-50"}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.completed ? "bg-primary/10" : config.bg}`}>
                {item.completed
                    ? <CheckCircle2 className="w-4 h-4 text-primary" />
                    : <Icon className={`w-4 h-4 ${config.color}`} />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground/60" : "text-foreground"}`}>{item.title}</p>
                {isUnlocked && (
                    <div className="mt-1 space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className={`${item.completed ? "text-primary" : config.color} font-semibold`}>{displayProgress}</span>
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
                    <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${item.completed ? "bg-primary border-primary" : "border-border"}`}>
                        {item.completed && <Check className="w-4 h-4 text-white" />}
                    </div>
                )}
                <span className="text-xs text-xp font-semibold flex items-center gap-1">
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

    const stateKey = isCompleted ? "completed" : isActive ? "active" : "locked";
    const shellClass = SHELL_CLASSES[stateKey];
    const numberBadgeClass = NUMBER_BADGE_CLASSES[stateKey];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`rounded-2xl border-2 overflow-hidden transition-all ${shellClass}`}
        >
            {/* Header */}
            <button
                onClick={() => !isLocked && setIsExpanded(!isExpanded)}
                disabled={isLocked}
                className="w-full flex items-center gap-4 p-4 text-left"
            >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all ${numberBadgeClass}`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isLocked ? <Lock className="w-4 h-4" /> : index + 1}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className={`font-semibold text-sm truncate ${isLocked ? "text-muted-foreground/60" : "text-foreground"}`}>{subGoal.title}</p>
                        {isActive && <span className="pill bg-chart-3/15 text-chart-3 flex-shrink-0">Active</span>}
                        {isCompleted && (
                            <span className="pill bg-primary/15 text-primary gap-1 flex-shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                Done
                            </span>
                        )}
                    </div>
                    {!isLocked && totalCount > 0 && (
                        <div className="flex items-center gap-3">
                            <Progress value={progressPct} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground flex-shrink-0">{completedCount}/{totalCount}</span>
                        </div>
                    )}
                    {isActive && !isCompleted && (
                        <p className="text-xs text-chart-3 mt-0.5 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Auto-tracked from your AcedIt usage
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-xp font-bold flex items-center gap-1"><Zap className="w-3 h-3" />{xpTotal}</span>
                    {!isLocked && (isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground/60" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/60" />)}
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
                        <div className="border-t border-border">
                            {/* Auto-track notice */}
                            {isActive && (() => {
                                const hasTracked = actionItems.some(i => i.type && i.type !== 'manual');
                                const hasManual = actionItems.some(i => i.type === 'manual');
                                if (!hasTracked && !hasManual) return null;
                                return (
                                    <div className="mx-4 mt-3 mb-1 flex items-start gap-2 bg-chart-3/5 border border-chart-3/20 rounded-xl p-3">
                                        <TrendingUp className="w-4 h-4 text-chart-3 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-semibold text-foreground">
                                                {hasManual && hasTracked ? "Mixed objectives" : hasManual ? "Manual tasks" : "Auto-tracked objectives"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
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
                                <div className="p-4 bg-primary/5 border-t border-primary/20 text-center">
                                    <CheckCircle2 className="w-6 h-6 text-primary mx-auto mb-1" />
                                    <p className="text-sm font-bold text-foreground">Sub-goal completed!</p>
                                    <p className="text-xs text-muted-foreground">All AcedIt objectives were verified automatically.</p>
                                </div>
                            )}

                            {/* Active but not done — motivational nudge */}
                            {isActive && !isCompleted && totalCount > 0 && (
                                <div className="p-3 bg-secondary/50 border-t border-border text-center">
                                    <p className="text-xs text-muted-foreground">
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
