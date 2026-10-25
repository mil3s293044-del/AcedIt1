/**
 * WriteDrill — the question alone. Write the answer.
 *
 * The top rung of the answer ladder, and the one a SAC actually asks. No cue,
 * no word bank: the question is above, and the box is empty.
 *
 * ─── Checked against what earned the marks, and shown side by side ──────────
 * The check is the terms the saved answer's marks turned on (`writeOf`): each
 * one is named as in or missing, so the student can read the verdict line by
 * line rather than being handed one. Then the saved answer appears under
 * theirs, because a list of terms is a check and the two answers side by side
 * is the lesson. No model call: a write drilled on a schedule would otherwise
 * cost chips every time it came round.
 *
 * With no terms to look for, it simply shows the two answers together and the
 * student judges — the honest fallback, never an invented score.
 */
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { gradeWrite } from "@/lib/answerBank";

export default function WriteDrill({ write, answer, onGraded }) {
    const reduce = useReducedMotion();
    const [text, setText] = useState("");
    const [grade, setGrade] = useState(null);

    const check = () => {
        const g = gradeWrite(write, text);
        setGrade(g);
        onGraded?.(g);
    };

    if (!grade) {
        return (
            <div className="space-y-3" data-write>
                <p className="stat-label text-muted-foreground">Write it from memory</p>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
                    placeholder="Your answer…" data-write-input
                    className="rounded-xl border-2 text-[15px] leading-relaxed" />
                <Button onClick={check} disabled={!text.trim()} data-write-check
                    className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                    Check it
                </Button>
            </div>
        );
    }

    return (
        <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4" data-write-result>
            {grade.total > 0 && (
                <div>
                    <p className="text-sm font-black text-foreground">
                        <span className="tabular-nums">{grade.right}</span> of{" "}
                        <span className="tabular-nums">{grade.total}</span> of the words that earned the marks
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="The words that earned the marks">
                        {[...grade.hit.map((t) => [t, true]), ...grade.missed.map((t) => [t, false])].map(([t, ok]) => (
                            <li key={t}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border-2 ${ok
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-streak/30 bg-streak/10 text-streak"}`}>
                                {ok ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={3} />}
                                {t}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border-2 border-border p-3">
                    <p className="stat-label text-muted-foreground">You wrote</p>
                    <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-wrap">{text}</p>
                </div>
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
                    <p className="stat-label text-primary">The saved answer</p>
                    <MarkdownMath className="text-sm text-foreground leading-relaxed mt-1">{answer}</MarkdownMath>
                </div>
            </div>
        </motion.div>
    );
}
