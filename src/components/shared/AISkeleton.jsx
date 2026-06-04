import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import LoadingQuiz from "@/components/shared/LoadingQuiz";

// AISkeleton — inline placeholder UI shown while an AI tool is generating.
// Replaces the old full-screen <AILoadingProgress> modal with quiet, shaped
// skeletons that match the result layout. No fake percent, no app-blocking.
//
// Usage:
//   {isGenerating && <AISkeleton type="questions" count={numQuestions} />}
//   {isGenerating && <AISkeleton type="flashcards" count={20} />}
//   {isGenerating && <AISkeleton type="plan" />}
//   {isGenerating && <AISkeleton type="text" />}
//   {isGenerating && <AISkeleton type="marking" />}

// ─── Shimmer building blocks ────────────────────────────────────────────────
const Bar = ({ w = "100%", h = 12, className = "" }) => (
    <div
        className={`rounded-md bg-gradient-to-r from-secondary via-secondary/40 to-secondary animate-pulse ${className}`}
        style={{ width: w, height: h }}
    />
);

const Block = ({ children, className = "" }) => (
    <div className={`bg-surface border border-border rounded-2xl p-5 space-y-3 ${className}`}>
        {children}
    </div>
);

// ─── Type-specific skeleton shapes ──────────────────────────────────────────

function QuestionSkeleton({ index }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 8) * 0.04 }}
        >
            <Block>
                {/* Top row: marks pill + ID */}
                <div className="flex items-center justify-between">
                    <Bar w="40px" h={10} />
                    <Bar w="60px" h={10} />
                </div>
                {/* Question text — 2 lines */}
                <div className="space-y-2 pt-1">
                    <Bar w="92%" h={14} />
                    <Bar w="78%" h={14} />
                </div>
                {/* Options — 4 thin bars (looks like MCQ choices) */}
                <div className="space-y-1.5 pt-2">
                    {[78, 65, 71, 60].map((w, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-secondary flex-shrink-0" />
                            <Bar w={`${w}%`} h={10} />
                        </div>
                    ))}
                </div>
            </Block>
        </motion.div>
    );
}

function FlashcardSkeleton({ index }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 8) * 0.04 }}
        >
            <Block className="aspect-[5/3] flex flex-col justify-center items-center gap-3">
                <Bar w="60%" h={14} />
                <Bar w="80%" h={10} />
                <Bar w="50%" h={10} />
            </Block>
        </motion.div>
    );
}

function PlanSkeleton() {
    return (
        <Block className="space-y-4">
            <div className="flex items-center gap-2">
                <Bar w="8px" h={20} className="!rounded-full" />
                <Bar w="200px" h={16} />
            </div>
            <div className="space-y-2 pl-3">
                {[80, 92, 70, 85, 60].map((w, i) => (
                    <Bar key={i} w={`${w}%`} h={12} />
                ))}
            </div>
            <div className="flex items-center gap-2 pt-2">
                <Bar w="8px" h={20} className="!rounded-full" />
                <Bar w="160px" h={16} />
            </div>
            <div className="space-y-2 pl-3">
                {[88, 75, 90].map((w, i) => (
                    <Bar key={i} w={`${w}%`} h={12} />
                ))}
            </div>
        </Block>
    );
}

function TextSkeleton() {
    // Generic flowing text — paragraphs of variable-width bars.
    return (
        <Block className="space-y-3">
            {[
                [98, 92, 76],
                [88, 95, 70, 82],
                [80, 90, 60],
            ].map((widths, p) => (
                <div key={p} className="space-y-1.5">
                    {widths.map((w, i) => <Bar key={i} w={`${w}%`} h={12} />)}
                </div>
            ))}
        </Block>
    );
}

function MarkingSkeleton() {
    return (
        <Block className="space-y-4">
            {/* Score circle placeholder */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-secondary animate-pulse" />
                <div className="space-y-2 flex-1">
                    <Bar w="50%" h={14} />
                    <Bar w="35%" h={10} />
                </div>
            </div>
            {/* Per-question rows */}
            <div className="space-y-2 pt-2">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-secondary animate-pulse flex-shrink-0" />
                        <Bar w={`${65 + (i * 5) % 25}%`} h={10} />
                    </div>
                ))}
            </div>
        </Block>
    );
}

// ─── Top-level component ────────────────────────────────────────────────────

export default function AISkeleton({
    type = "text",
    count = 5,
    message,
    className = "",
    withQuiz = true,   // show the loading mini-quiz above the skeleton
}) {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(t);
    }, []);

    // Choose the right shape
    const renderSkeletons = () => {
        switch (type) {
            case "questions":
                return Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                    <QuestionSkeleton key={i} index={i} />
                ));
            case "flashcards":
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
                            <FlashcardSkeleton key={i} index={i} />
                        ))}
                    </div>
                );
            case "plan":
                return <PlanSkeleton />;
            case "marking":
                return <MarkingSkeleton />;
            case "text":
            default:
                return <TextSkeleton />;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={`space-y-3 ${className}`}
            role="status"
            aria-live="polite"
            aria-label={message || "AI is generating"}
        >
            {/* Loading mini-quiz — turns the wait into quick revision + XP */}
            {withQuiz && <LoadingQuiz />}

            {/* Status strip — honest, no fake percent. Just an animated icon,
                a friendly status line, and a rolling seconds counter. */}
            <div className="flex items-center gap-2.5 px-1 py-1">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-bold text-foreground">
                    {message || "Generating…"}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                    {seconds}s
                </span>
            </div>

            {/* Shimmer bar across the top of the result area */}
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-secondary/60">
                <div
                    className="h-full w-1/3 bg-primary/70 rounded-full"
                    style={{
                        animation: "ai-shimmer 1.4s ease-in-out infinite",
                    }}
                />
            </div>
            <style>{`
                @keyframes ai-shimmer {
                    0%   { transform: translateX(-110%); }
                    100% { transform: translateX(410%); }
                }
            `}</style>

            {/* The shaped placeholders */}
            <div className={type === "flashcards" ? "" : "space-y-3"}>
                {renderSkeletons()}
            </div>
        </motion.div>
    );
}
