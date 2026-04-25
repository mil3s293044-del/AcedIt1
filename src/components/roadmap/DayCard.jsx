import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, ChevronDown, ChevronRight, ExternalLink, RefreshCw, Sparkles, Timer } from "lucide-react";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

const TOOL_EMOJI = {
    "Pomodoro Timer": "🍅",
    "Spaced Repetition Flashcards": "🧠",
    "Active Recall": "💡",
    "Blurting Method": "✍️",
    "Exam Mode": "📋",
    "Goals Section": "🎯",
    "Study Planner": "📅",
    "AI Quizzes": "❓",
    "Essay Planner": "📝",
    "Concept Explainer": "🔍",
    "Exam Question Generator": "⚡",
    "Note Summariser": "📄",
    "AI Math Tutor": "🔢",
    "AI English Mentor": "✒️",
    "Line Memoriser": "🔖",
    "AI Teaching Assistant": "🎓",
};

const CONFIDENCE_LEVELS = [
    { value: 1, emoji: "😟", label: "No idea" },
    { value: 2, emoji: "😕", label: "Struggling" },
    { value: 3, emoji: "😐", label: "Getting there" },
    { value: 4, emoji: "🙂", label: "Pretty good" },
    { value: 5, emoji: "😄", label: "Nailed it!" },
];

const MASTERY_DOT = {
    red: "bg-red-500",
    yellow: "bg-yellow-400",
    green: "bg-green-500",
};

export default function DayCard({ day, topicLabel, isConsolidation, rating, masteryColor, generatedBasedOnDay, onRate }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [hoveredRating, setHoveredRating] = useState(null);

    const borderClass = isConsolidation
        ? "border-orange-300 bg-orange-50/20"
        : rating
        ? "border-green-200 bg-green-50/10"
        : "border-gray-200 bg-white";

    return (
        <Card className={`border-2 transition-all ${borderClass}`}>
            <CardContent className="p-0">
                {/* Header */}
                <button
                    className="w-full flex items-center gap-3 p-4 text-left"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {/* Day number circle with mastery dot */}
                    <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            rating ? "bg-green-500" : "bg-gradient-to-br from-teal-500 to-emerald-600"
                        }`}>
                            {rating ? <CheckCircle2 className="w-5 h-5" /> : day.day_number}
                        </div>
                        {masteryColor && (
                            <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${MASTERY_DOT[masteryColor]}`} />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Topic label — specific to subject/topic */}
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="font-bold text-gray-900 text-sm leading-tight">{topicLabel}</p>
                            {isConsolidation && (
                                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> Consolidation
                                </Badge>
                            )}
                        </div>
                        {/* Generated based on label */}
                        {generatedBasedOnDay && (
                            <p className="text-xs text-teal-600 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Generated based on your Day {generatedBasedOnDay} performance
                            </p>
                        )}
                        <p className="text-xs text-gray-500 truncate mt-0.5">{day.focus}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400 hidden sm:block">{day.total_time}</span>
                        {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                </button>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                                {/* Pomodoro tip */}
                                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                                    <Timer className="w-3.5 h-3.5 flex-shrink-0 text-teal-500" />
                                    <span>Use your{" "}
                                        <a href={createPageUrl("Study")} onClick={e => e.stopPropagation()} className="text-teal-600 hover:underline font-medium">Pomodoro Timer</a>
                                        {" "}throughout today's sessions.
                                    </span>
                                </div>
                                {/* Tools list */}
                                <div className="space-y-2">
                                    {(day.tools || []).filter(tool =>
                                        tool.name !== "Pomodoro Timer" &&
                                        (day.day_number === 1 || (tool.name !== "Goals Section" && tool.name !== "Study Planner"))
                                    ).map((tool, i) => (
                                        <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                                            <span className="text-xl flex-shrink-0 mt-0.5">{TOOL_EMOJI[tool.name] || "📚"}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <a
                                                        href={createPageUrl(tool.route)}
                                                        onClick={e => e.stopPropagation()}
                                                        className="font-semibold text-teal-700 hover:text-teal-900 hover:underline text-sm flex items-center gap-1"
                                                    >
                                                        {tool.name} <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                    {tool.component && tool.component !== "General" && (
                                                        <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">{tool.component}</Badge>
                                                    )}
                                                    <Badge className="bg-white border text-gray-500 text-xs flex items-center gap-1 px-1.5 py-0.5">
                                                        <Clock className="w-3 h-3" />{tool.duration}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{tool.reason}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="text-xs text-gray-400 text-right">
                                    Total: <span className="font-semibold text-gray-600">{day.total_time}</span>
                                </div>

                                {/* Confidence Check-in */}
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="text-xs font-semibold text-gray-500 mb-2">
                                        {rating ? "Your confidence for this day:" : "How confident do you feel after completing this session?"}
                                    </p>
                                    <div className="flex gap-1 sm:gap-2">
                                        {CONFIDENCE_LEVELS.map(level => (
                                            <button
                                                key={level.value}
                                                onClick={() => onRate(level.value)}
                                                onMouseEnter={() => setHoveredRating(level.value)}
                                                onMouseLeave={() => setHoveredRating(null)}
                                                title={level.label}
                                                className={`flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-lg transition-all flex-1 ${
                                                    rating === level.value
                                                        ? "bg-teal-100 ring-2 ring-teal-400"
                                                        : hoveredRating === level.value
                                                        ? "bg-gray-100"
                                                        : ""
                                                }`}
                                            >
                                                <span className="text-xl">{level.emoji}</span>
                                                <span className="text-xs text-gray-400 hidden sm:block">{level.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {rating && rating <= 2 && (
                                        <p className="text-xs text-orange-600 mt-2 font-medium">
                                            ⚠️ Tomorrow's session will revisit this content before moving forward.
                                        </p>
                                    )}
                                    {rating && rating >= 4 && (
                                        <p className="text-xs text-green-600 mt-2 font-medium">
                                            🚀 Great confidence! Tomorrow's session will push to more advanced practice.
                                        </p>
                                    )}
                                    {!rating && (
                                        <p className="text-xs text-gray-400 mt-2">
                                            Submit your rating to unlock the next day's personalised session.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}