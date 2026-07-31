import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Target, Check, ArrowRight, Info } from "lucide-react";
import { subjectScore, requiredTop4Mean } from "@/lib/mockAtarMath";

/**
 * "What do I need?" — the mock ATAR planner. Pick a target ATAR, see the
 * top-4 subject score it demands, then play with a subject's sliders
 * (quizzes, accuracy, hours) to see exactly what practice would get there.
 * Wired to the same formula the server uses, so what the sliders promise
 * is genuinely achievable in-app.
 */
export default function MockAtarPlanner({ open, onOpenChange, data }) {
    const scores = data?.scores || [];
    const streak = data?.streak || 0;
    const totalXP = data?.totalXP || 0;
    const unlockedCount = scores.filter((s) => !s.locked).length;

    const [target, setTarget] = useState(85);
    const [subjectName, setSubjectName] = useState(null);

    // Default the what-if to the weakest unlocked subject (biggest win).
    useEffect(() => {
        if (!open) return;
        const unlocked = scores.filter((s) => !s.locked).sort((a, b) => a.score - b.score);
        setSubjectName((unlocked[0] || scores[0])?.subject || null);
        if (data?.atar != null) setTarget(Math.min(99.95, Math.round((data.atar + 5) * 2) / 2));
    }, [open]);  

    const needed = useMemo(
        () => requiredTop4Mean(target, { streak, totalXP, unlockedCount: Math.max(1, unlockedCount) }),
        [target, streak, totalXP, unlockedCount],
    );
    const reachable = needed <= 50;

    const subject = scores.find((s) => s.subject === subjectName) || null;

    // What-if sliders — initialised from the subject's real inputs.
    const [wQuizzes, setWQuizzes] = useState(3);
    const [wAccuracy, setWAccuracy] = useState(70);
    const [wHours, setWHours] = useState(2);
    useEffect(() => {
        if (!subject) return;
        setWQuizzes(Math.max(subject.attempts || 0, 1));
        setWAccuracy(subject.accuracy ?? 70);
        setWHours(Math.round(((subject.minutes || 0) / 60) * 2) / 2);
    }, [subjectName]);  

    const projected = subjectScore({ accuracy: wAccuracy, attempts: wQuizzes, minutes: wHours * 60, streak });
    const hitsNeeded = projected != null && projected >= Math.min(50, needed);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2">
                        <Target className="w-5 h-5 text-chart-4" /> What do I need?
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Target */}
                    <div>
                        <div className="flex items-baseline justify-between mb-2">
                            <p className="stat-label">Target mock ATAR</p>
                            <p className="font-display font-extrabold text-2xl text-chart-4 tabular-nums">{target.toFixed(2)}</p>
                        </div>
                        <Slider value={[target]} min={40} max={99.95} step={0.05}
                            onValueChange={([v]) => setTarget(Math.round(v * 20) / 20)} />
                    </div>

                    {/* What it demands */}
                    <div className={`rounded-2xl border-2 p-3.5 ${reachable ? "border-chart-4/30 bg-chart-4/5" : "border-xp/40 bg-xp/5"}`}>
                        {reachable ? (
                            <>
                                <p className="text-sm font-bold text-foreground">
                                    Each of your top 4 subjects needs ≈ <span className="text-chart-4">{needed.toFixed(1)}/50</span>
                                </p>
                                {unlockedCount > 0 && (
                                    <div className="mt-2.5 space-y-1.5">
                                        {scores.filter((s) => !s.locked).sort((a, b) => b.score - a.score).slice(0, 4).map((s) => {
                                            const done = s.score >= needed;
                                            return (
                                                <div key={s.subject} className="flex items-center gap-2 text-xs">
                                                    {done
                                                        ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                                        : <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
                                                    <span className="font-bold text-foreground truncate flex-1">{s.subject}</span>
                                                    <span className={`tabular-nums font-bold ${done ? "text-primary" : "text-muted-foreground"}`}>
                                                        {s.score.toFixed(1)}{!done && <> → {Math.min(50, needed).toFixed(1)}</>}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm font-bold text-foreground">
                                Past what subject scores alone can reach — unlock more subjects, grow your streak and XP for bonus points, then come back for {target.toFixed(2)}. 💪
                            </p>
                        )}
                    </div>

                    {/* Subject what-if */}
                    {scores.length > 0 && (
                        <div>
                            <p className="stat-label mb-2">Play it out in a subject</p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {scores.map((s) => (
                                    <button key={s.subject} onClick={() => setSubjectName(s.subject)}
                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                            s.subject === subjectName ? "bg-chart-4 border-chart-4 text-white" : "bg-surface border-border text-muted-foreground hover:border-chart-4/40"
                                        }`}>
                                        {s.subject}
                                    </button>
                                ))}
                            </div>

                            {subject && (
                                <div className="space-y-3.5 rounded-2xl border-2 border-border p-3.5">
                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-muted-foreground">Projected score</p>
                                        <p className={`font-display font-extrabold text-xl tabular-nums ${hitsNeeded ? "text-primary" : "text-foreground"}`}>
                                            {projected == null ? "locked" : projected.toFixed(1)}
                                            {hitsNeeded && <Check className="w-4 h-4 inline ml-1 -mt-1" />}
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1.5">
                                            <span>Quizzes done</span><span className="text-foreground tabular-nums">{wQuizzes}</span>
                                        </div>
                                        <Slider value={[wQuizzes]} min={0} max={30} step={1} onValueChange={([v]) => setWQuizzes(v)} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1.5">
                                            <span>Average accuracy</span><span className="text-foreground tabular-nums">{wAccuracy}%</span>
                                        </div>
                                        <Slider value={[wAccuracy]} min={0} max={100} step={1} onValueChange={([v]) => setWAccuracy(v)} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1.5">
                                            <span>Hours studied</span><span className="text-foreground tabular-nums">{wHours}h</span>
                                        </div>
                                        <Slider value={[wHours]} min={0} max={25} step={0.5} onValueChange={([v]) => setWHours(v)} />
                                    </div>
                                    <Link to="/Quizzes"
                                        className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white text-sm font-bold py-2.5 transition-colors">
                                        Start a {subject.subject} quiz <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground/60">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Same formula as your real mock score — what the sliders show is what doing the work would give you. Still a game, not a prediction.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
