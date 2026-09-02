/**
 * ClozeDrill — the model wording with the load-bearing terms taken out.
 *
 * The middle rung of the ladder. The student has been shown the answer once;
 * now they have to put the words back. It targets exactly the terms the
 * criterion turns on — see `keyTerms` — which are the ones a vague answer
 * leaves out.
 *
 * ─── The bank is the answers, not invented distractors ──────────────────────
 * Every word in the bank belongs in a gap, so the exercise is a matching
 * problem with no wrong options to eliminate by feel. Making up plausible
 * decoys would need a model call per card and would occasionally teach a
 * misconception by putting it on the screen next to the truth.
 *
 * ─── Marked when they ask, not as they type ─────────────────────────────────
 * Filling a gap and being told instantly is a hint machine: you tab through
 * the bank until the tick appears. Nothing is judged until Check, and after
 * Check the gaps show which ones were right, because "2 of 3" without saying
 * which is a mark with no reason.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gradeCloze } from "@/lib/drill";

export default function ClozeDrill({ cloze, onGraded }) {
    // blankIndex -> the word placed in it.
    const [filled, setFilled] = useState({});
    const [checked, setChecked] = useState(null);
    // The gap a tapped word goes into: the first still empty, so the student
    // works left to right without having to aim.
    const nextEmpty = cloze.answers.findIndex((_, i) => !filled[i]);

    const used = new Set(Object.values(filled));
    const complete = cloze.answers.every((_, i) => filled[i]);

    const place = (word) => {
        if (checked || used.has(word) || nextEmpty === -1) return;
        setFilled((f) => ({ ...f, [nextEmpty]: word }));
    };
    const clear = (i) => { if (!checked) setFilled((f) => { const n = { ...f }; delete n[i]; return n; }); };

    const check = () => {
        const g = gradeCloze(cloze, cloze.answers.map((_, i) => filled[i] || ""));
        setChecked(g);
        onGraded?.(g);
    };

    return (
        <div className="space-y-4">
            <p className="stat-label text-muted-foreground">Put the missing words back</p>

            <p className="text-base sm:text-lg text-foreground leading-loose">
                {cloze.segments.map((s, i) => {
                    if (s.blank == null) return <React.Fragment key={i}>{s.text}</React.Fragment>;
                    const word = filled[s.blank];
                    const right = checked?.each?.[s.blank];
                    return (
                        <button key={i} type="button"
                            onClick={() => clear(s.blank)}
                            disabled={!!checked || !word}
                            aria-label={word ? `Gap ${s.blank + 1}: ${word}. Tap to clear.` : `Gap ${s.blank + 1}, empty`}
                            className={`inline-block align-baseline min-w-[6.5rem] mx-0.5 px-2 rounded-lg
                                border-b-2 text-center font-bold transition-colors
                                ${checked
                                    ? (right ? "border-primary bg-primary/10 text-primary"
                                             : "border-streak bg-streak/10 text-streak line-through")
                                    : word ? "border-foreground/60 bg-secondary text-foreground cursor-pointer"
                                           : "border-dashed border-muted-foreground/50 text-muted-foreground/40"}`}>
                            {word || " "}
                        </button>
                    );
                })}
            </p>

            {/* After checking, the right answer sits under any gap they missed.
                Being told you were wrong and not what was right is the one
                thing a drill must never do. */}
            {checked && !checked.allRight && (
                <ul className="space-y-1">
                    {cloze.answers.map((a, i) => checked.each[i] ? null : (
                        <li key={i} className="text-sm text-muted-foreground">
                            Gap {i + 1} was <span className="font-bold text-foreground">{a}</span>
                        </li>
                    ))}
                </ul>
            )}

            {!checked && (
                <>
                    <div className="flex flex-wrap gap-2">
                        {cloze.bank.map((w) => (
                            <motion.button key={w} type="button" onClick={() => place(w)}
                                disabled={used.has(w)}
                                whileTap={{ scale: 0.96 }}
                                className={`rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition-colors
                                    ${used.has(w)
                                        ? "border-border text-muted-foreground/40 cursor-default"
                                        : "border-border text-foreground hover:border-primary/50 cursor-pointer"}`}>
                                {w}
                            </motion.button>
                        ))}
                    </div>
                    <Button onClick={check} disabled={!complete}
                        className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                        {complete ? "Check" : `${cloze.answers.length - Object.keys(filled).length} gap${cloze.answers.length - Object.keys(filled).length === 1 ? "" : "s"} to fill`}
                    </Button>
                </>
            )}

            {checked && (
                <p className={`flex items-center gap-2 text-sm font-bold
                    ${checked.allRight ? "text-primary" : "text-foreground"}`}>
                    {checked.allRight
                        ? <><Check className="w-4 h-4" /> All {checked.total} right.</>
                        : <><X className="w-4 h-4 text-streak" /> {checked.right} of {checked.total}.</>}
                </p>
            )}
        </div>
    );
}
