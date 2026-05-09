import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Timer, Lock, Zap } from "lucide-react";

// Compute the recommended SAC time allowance from a quiz.
//   1.5 minutes per mark, with a 15-minute floor — matches VCAA conventions.
export function defaultSACTimeMs(quiz) {
    const totalMarks = (quiz?.questions || []).reduce(
        (sum, q) => sum + (Number(q.marks) || 1),
        0,
    );
    const minutes = Math.max(15, Math.ceil(totalMarks * 1.5));
    return minutes * 60 * 1000;
}

function formatMinutes(ms) {
    const m = Math.round(ms / 60000);
    return `${m} min${m === 1 ? "" : "s"}`;
}

// Two-step picker:
//   Step 1: Standard vs SAC
//   Step 2 (SAC only): "Begin SAC?" intro with time allowance + lock-in warning
//
// onPick receives ({ mode, timeLimitMs })
//   mode === "standard" → timeLimitMs is null
//   mode === "sac"      → timeLimitMs is the allotted ms
export default function QuizModePicker({ open, quiz, onPick, onCancel }) {
    const [stage, setStage] = useState("choose"); // choose | confirm-sac
    const [timeMs, setTimeMs] = useState(() => defaultSACTimeMs(quiz));

    const close = () => { setStage("choose"); onCancel(); };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                {stage === "choose" && (
                    <>
                        <DialogHeader className="p-5 border-b border-border bg-surface">
                            <DialogTitle className="text-lg font-display font-extrabold">
                                How do you want to take this quiz?
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-4 space-y-3">
                            <button
                                onClick={() => onPick({ mode: "standard", timeLimitMs: null })}
                                className="w-full text-left p-4 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all flex items-start gap-3 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                    <BookOpen className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-foreground">Standard practice</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        No time pressure. Take it at your own pace, see hints and feedback as you go.
                                    </p>
                                </div>
                            </button>
                            <button
                                onClick={() => setStage("confirm-sac")}
                                className="w-full text-left p-4 rounded-2xl border-2 border-border hover:border-xp hover:bg-xp/5 transition-all flex items-start gap-3 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0 group-hover:bg-xp/20 transition-colors">
                                    <Timer className="w-5 h-5 text-xp" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-foreground">Practice SAC</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        Exam-style focus mode. Countdown timer, fullscreen, auto-submits when time runs out.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </>
                )}

                {stage === "confirm-sac" && (
                    <>
                        <DialogHeader className="p-5 border-b border-border bg-xp/5">
                            <DialogTitle className="text-lg font-display font-extrabold flex items-center gap-2">
                                <Lock className="w-5 h-5 text-xp" />
                                Practice SAC — ready?
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl border-2 border-border p-4 bg-secondary/40">
                                <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                                    Time allowed
                                </p>
                                <div className="flex items-center gap-3">
                                    <Timer className="w-6 h-6 text-xp" />
                                    <p className="text-3xl font-display font-extrabold text-foreground">
                                        {formatMinutes(timeMs)}
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    1.5 minutes per mark · {(quiz?.questions || []).length} questions
                                </p>
                                {/* Quick adjusters */}
                                <div className="flex gap-1.5 mt-3">
                                    {[
                                        { label: "−5", v: -5 },
                                        { label: "−1", v: -1 },
                                        { label: "+1", v: 1 },
                                        { label: "+5", v: 5 },
                                    ].map((b) => (
                                        <button
                                            key={b.label}
                                            onClick={() => setTimeMs((t) => Math.max(60000, t + b.v * 60000))}
                                            className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/70 text-xs font-bold text-foreground transition-colors"
                                        >
                                            {b.label} min
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground space-y-1.5">
                                <p className="flex items-start gap-2">
                                    <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                    <span>Fullscreen focus — nav and distractions hidden.</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                    <span>Hints and per-question feedback are turned off until you finish.</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                    <span>Auto-submits when the timer hits zero.</span>
                                </p>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <Button variant="outline" onClick={() => setStage("choose")} className="flex-1">
                                    Back
                                </Button>
                                <Button
                                    onClick={() => onPick({ mode: "sac", timeLimitMs: timeMs })}
                                    className="flex-1 bg-xp hover:bg-xp/90 text-white"
                                >
                                    Begin SAC
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
