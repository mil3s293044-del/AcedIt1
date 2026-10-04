/**
 * ScanIntake — what are we checking, and what do we need to know about it.
 *
 * ─── IT ASKS FOR FOUR THINGS AND THREE OF THEM ARE OPTIONAL ─────────────────
 * The screen this replaces asked the student to classify their work into one of
 * five KINDS before it would offer anything, because the kind is what routed to
 * a tool. The scan does not route on it — it reads the work — so the question
 * is gone and what is left is only what genuinely changes the result:
 *
 *   the WORK      required, obviously
 *   the SUBJECT   gates which faults may be reported at all. Expression is a
 *                 real fault in English and a distraction in Chemistry, where
 *                 VCAA does not price it (`diagnostic.faultApplies`).
 *   the QUESTION  without it the scan is told, in as many words, that it may
 *                 not report a command-term or a mark-fit finding — both are
 *                 claims about a question it cannot see.
 *   the MARKS     the denominator a mark-fit finding is measured against.
 *
 * Asking for the last two and then ignoring them would be this app's own
 * recurring bug; they are threaded into the prompt in the same session.
 *
 * ─── AND IT OPENS ON WHAT THE STUDENT ALREADY HAS ───────────────────────────
 * A blank box asks them to supply context the app is already holding. The
 * candidates come from `workpieceSources` — a question they got wrong, a
 * criterion they keep dropping, a SAC on the planner — and every one is derived,
 * so a card disappears because the fact behind it stopped being true.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Coins, RotateCcw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCES } from "@/lib/workpiece";
import { priceLabel } from "@/lib/chips";
import { SCAN_FEATURE, SCAN_MODEL_LABEL, faultsFor } from "@/lib/diagnostic";

function Candidate({ workpiece, index, onPick }) {
    const src = SOURCES[workpiece.source];
    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => onPick(workpiece)}
            className="w-full text-left rounded-2xl border-2 border-border bg-surface p-4
                hover:border-primary/40 transition-colors"
        >
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {src?.label || "Your work"}
                {workpiece.subject ? ` · ${workpiece.subject}` : ""}
            </p>
            <p className="font-semibold text-foreground text-sm leading-snug mt-1 line-clamp-2">
                {workpiece.title}
            </p>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-primary mt-2">
                Check this <ArrowRight className="w-3 h-3" />
            </span>
        </motion.button>
    );
}

function RecentRow({ run, index, onOpen }) {
    const n = run.steps.length;
    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => onOpen(run)}
            className="w-full text-left rounded-2xl border-2 border-border bg-surface p-4
                hover:border-primary/40 transition-colors"
        >
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {n} {n === 1 ? "repair" : "repairs"}{run.subject ? ` · ${run.subject}` : ""}
            </p>
            <p className="font-semibold text-foreground text-sm leading-snug mt-1 line-clamp-2">
                {run.title}
            </p>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-primary mt-2">
                <RotateCcw className="w-3 h-3" /> Carry on
            </span>
        </motion.button>
    );
}

export default function ScanIntake({
    candidates = [],
    recent = [],
    subjects = [],
    loading = false,
    busy = false,
    onPick,
    onOpenRecent,
    onScan,
}) {
    const [body, setBody] = useState("");
    const [subject, setSubject] = useState("");
    const [question, setQuestion] = useState("");
    const [marks, setMarks] = useState("");

    // NOTHING IS DRAWN WHILE IT LOADS. A skeleton list would promise candidates
    // before anything has been counted, and the commonest honest answer for a
    // new account is that there are none.
    if (loading) return null;

    const ready = body.trim().length > 20;
    const checks = subject ? faultsFor(subject).length : 0;

    return (
        <div className="max-w-2xl mx-auto w-full px-4 py-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 font-mono">
                AI TOOLS
            </p>
            <h2 className="font-display font-extrabold text-foreground text-xl leading-tight mb-1">
                What do you want checked?
            </h2>
            <p className="text-[13px] text-muted-foreground mb-5 leading-snug">
                Paste a question, an answer or a paragraph. It gets scanned against the VCAA
                conventions for your subject, and every fault it finds comes with the tool that
                fixes it.
            </p>

            {recent.length > 0 && onOpenRecent && (
                <section className="mb-5">
                    <div className="flex items-baseline gap-2 mb-2.5">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                            Still open
                        </h3>
                        <span className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2.5">
                        {recent.map((b, i) => (
                            <RecentRow key={b.key} run={b} index={i} onOpen={onOpenRecent} />
                        ))}
                    </div>
                </section>
            )}

            {candidates.length > 0 && (
                <section className="mb-5">
                    <div className="flex items-baseline gap-2 mb-2.5">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                            From your own work
                        </h3>
                        <span className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2.5">
                        {candidates.map((w, i) => (
                            <Candidate key={w.key || w.title} workpiece={w} index={i} onPick={onPick} />
                        ))}
                    </div>
                </section>
            )}

            <section>
                <div className="flex items-baseline gap-2 mb-2.5">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                        {candidates.length || recent.length ? "Or paste something" : "Paste something"}
                    </h3>
                    <span className="flex-1 h-px bg-border" />
                </div>

                <div className="rounded-2xl border-2 border-border bg-surface p-4 space-y-3">
                    <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={6}
                        placeholder="Your answer, your paragraph, your working…"
                        className="resize-none"
                    />

                    <div className="grid sm:grid-cols-2 gap-2.5">
                        <div>
                            <label className="stat-label text-muted-foreground block mb-1">Subject</label>
                            <Select value={subject || "none"} onValueChange={(v) => setSubject(v === "none" ? "" : v)}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pick one" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Not set</SelectItem>
                                    {subjects.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="stat-label text-muted-foreground block mb-1">
                                Marks <span className="font-normal normal-case tracking-normal">(optional)</span>
                            </label>
                            <Input
                                value={marks}
                                onChange={(e) => setMarks(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                                inputMode="numeric"
                                placeholder="e.g. 4"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="stat-label text-muted-foreground block mb-1">
                            The question <span className="font-normal normal-case tracking-normal">(optional)</span>
                        </label>
                        <Textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            rows={2}
                            placeholder="Paste the question it was answering…"
                            className="resize-none text-sm"
                        />
                        {/* WHAT IT CANNOT CHECK, SAID BEFORE THE SCAN RUNS. A
                            readout silently missing two of its fault classes
                            reads as the scan being thin, rather than as the
                            student not having told it what the question was. */}
                        {!question.trim() && (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                                Without it, the scan cannot check the command term or whether the answer
                                fits the marks — both are claims about a question it cannot see.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                        <span className="text-[11px] font-bold text-muted-foreground inline-flex items-center gap-1">
                            <Coins className="w-3 h-3" aria-hidden="true" />
                            {priceLabel(SCAN_FEATURE)} · runs on {SCAN_MODEL_LABEL}
                            {checks > 0 && ` · ${checks} checks`}
                        </span>
                        <Button
                            disabled={!ready || busy}
                            onClick={() => onScan?.({ body: body.trim(), subject, question: question.trim(), marks })}
                            className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl font-bold gap-1.5"
                        >
                            <ScanLine className="w-4 h-4" /> Scan it
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
