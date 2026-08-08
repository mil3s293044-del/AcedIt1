/**
 * CalloutQuiz — answering a call-out.
 *
 * Someone has bet their competition XP that you didn't actually learn the
 * material you clocked hours against. This is where you settle it: eight
 * questions built from your own flashcards and quizzes from the contest
 * window, five minutes, 75% to pass.
 *
 * The client never sees which option is correct — questions arrive stripped
 * and the server marks the submission — so there is nothing to read out of
 * devtools. The countdown here is a courtesy; the server times it too, and
 * an overrun fails regardless of what this component thinks.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Swords, Loader2, Timer, Check, Trophy, AlertTriangle } from "lucide-react";

const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export default function CalloutQuiz({ callout, open, onOpenChange, onSettled }) {
    const { toast } = useToast();
    const [stage, setStage] = useState("brief");   // brief → running → result
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [idx, setIdx] = useState(0);
    const [left, setLeft] = useState(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const submittedRef = useRef(false);

    const submit = useCallback(async (auto = false) => {
        if (submittedRef.current) return;
        submittedRef.current = true;
        setBusy(true);
        try {
            const picks = questions.map((_, i) => (i in answers ? answers[i] : -1));
            const res = await base44.functions.invoke("submitCallout", {
                callout_id: callout.id, answers: picks,
            });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            setResult(data);
            setStage("result");
            onSettled?.(data);
        } catch (e) {
            submittedRef.current = false;
            toast({
                title: auto ? "Time ran out and the submit failed" : "Couldn't submit",
                description: e.message, variant: "destructive",
            });
        } finally { setBusy(false); }
    }, [answers, questions, callout, onSettled, toast]);

    // Countdown. Hitting zero submits whatever is there — leaving the tab open
    // on a dead timer would otherwise look like the quiz was never sat.
    useEffect(() => {
        if (stage !== "running" || left == null) return;
        if (left <= 0) { submit(true); return; }
        const t = setTimeout(() => setLeft(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [stage, left, submit]);

    const begin = async () => {
        setBusy(true);
        try {
            const res = await base44.functions.invoke("startCallout", { callout_id: callout.id });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            setQuestions(data.questions || []);
            setLeft(data.seconds_left ?? callout.seconds_allowed ?? 300);
            setStage("running");
        } catch (e) {
            toast({ title: "Couldn't open the call-out", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const stake = callout.extra?.stake_at_call ?? null;
    const q = questions[idx];
    const answeredCount = Object.keys(answers).length;
    const urgent = left != null && left <= 60;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o && stage === "running") return; onOpenChange(o); }}>
            <DialogContent className="max-w-lg rounded-3xl max-h-[88vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2">
                        <Swords className="w-5 h-5 text-streak" />
                        {stage === "result" ? "Call-out settled" : "You've been called out"}
                    </DialogTitle>
                </DialogHeader>

                {/* ── The terms, stated before the clock starts ─────────────── */}
                {stage === "brief" && (
                    <div className="space-y-4">
                        <p className="text-sm text-foreground leading-relaxed">
                            <span className="font-bold">{callout.caller_name || "A rival"}</span> reckons you clocked
                            the hours without learning the material. {callout.question_count} questions from your own
                            study in this contest, {Math.round((callout.seconds_allowed || 300) / 60)} minutes,
                            {" "}{Math.round((callout.pass_mark || 0.75) * 100)}% to pass.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-3">
                                <p className="stat-label text-primary">If you pass</p>
                                <p className="text-sm font-bold text-foreground mt-0.5">
                                    {stake != null ? `You take ${stake} XP off them.` : "You take their stake."}
                                </p>
                            </div>
                            <div className="rounded-2xl border-2 border-streak/25 bg-streak/5 p-3">
                                <p className="stat-label text-streak">If you don't</p>
                                <p className="text-sm font-bold text-foreground mt-0.5">
                                    {stake != null ? `You lose ${stake} XP.` : "You lose the same."}
                                </p>
                            </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                            Both of you risk the same amount — whichever of you earned less in this contest.
                            The exact figure is settled when you submit.
                        </p>

                        <div className="rounded-xl bg-secondary/60 px-3 py-2.5 flex items-start gap-2">
                            <Timer className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-snug">
                                The clock starts the moment you begin and keeps running if you close this —
                                so start when you're ready to sit it.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Not yet</Button>
                            <Button onClick={begin} disabled={busy} className="flex-1 gap-1.5 bg-streak hover:bg-streak/90 text-white btn-3d">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                                Start — {Math.round((callout.seconds_allowed || 300) / 60)} min
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── The quiz ─────────────────────────────────────────────── */}
                {stage === "running" && q && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-muted-foreground tabular-nums">
                                Question {idx + 1} of {questions.length} · {answeredCount} answered
                            </p>
                            <span className={`inline-flex items-center gap-1 pill tabular-nums ${
                                urgent ? "bg-streak/15 text-streak" : "bg-secondary text-muted-foreground"}`}>
                                <Timer className="w-3 h-3" /> {mmss(left ?? 0)}
                            </span>
                        </div>

                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-chart-3 transition-all"
                                style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div key={idx} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                                {q.subject && <p className="stat-label mb-1">{q.subject}</p>}
                                <p className="text-base font-bold text-foreground leading-snug mb-3">{q.q}</p>
                                <div className="space-y-2">
                                    {q.options.map((opt, oi) => (
                                        <button key={oi} onClick={() => setAnswers(a => ({ ...a, [idx]: oi }))}
                                            aria-pressed={answers[idx] === oi}
                                            className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                                                answers[idx] === oi
                                                    ? "border-chart-3 bg-chart-3/10 text-foreground"
                                                    : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIdx(i => Math.max(0, i - 1))}
                                disabled={idx === 0} className="border-2 rounded-xl">Back</Button>
                            {idx < questions.length - 1 ? (
                                <Button onClick={() => setIdx(i => i + 1)} className="flex-1">Next</Button>
                            ) : (
                                <Button onClick={() => submit(false)} disabled={busy}
                                    className="flex-1 gap-1.5 bg-streak hover:bg-streak/90 text-white btn-3d">
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Submit {answeredCount < questions.length && `(${questions.length - answeredCount} blank)`}
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── The verdict ──────────────────────────────────────────── */}
                {stage === "result" && result && (
                    <div className="space-y-4 text-center">
                        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                            result.passed ? "bg-primary/15" : "bg-streak/15"}`}>
                            {result.passed
                                ? <Trophy className="w-8 h-8 text-primary" />
                                : <AlertTriangle className="w-8 h-8 text-streak" />}
                        </div>
                        <div>
                            <p className={`font-display font-black text-2xl ${result.passed ? "text-primary" : "text-streak"}`}>
                                {result.passed ? "Proved it." : result.overtime ? "Out of time." : "Didn't hold up."}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {result.correct}/{result.total} correct — {Math.round(result.score * 100)}%,
                                {" "}needed {Math.round(result.pass_mark * 100)}%.
                            </p>
                        </div>
                        <div className={`rounded-2xl border-2 p-4 ${
                            result.passed ? "border-primary/25 bg-primary/5" : "border-streak/25 bg-streak/5"}`}>
                            <p className="font-display font-black text-3xl tabular-nums text-foreground">
                                {result.passed ? "+" : "−"}{result.xp_moved} XP
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {result.passed
                                    ? `Taken off ${callout.caller_name || "them"} for calling it wrong.`
                                    : "Gone to the call-out."}
                            </p>
                        </div>
                        <Button onClick={() => onOpenChange(false)} className="w-full">Done</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
