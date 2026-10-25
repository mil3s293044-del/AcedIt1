/**
 * RebuildDrill — the answer as its first letters. Write it back.
 *
 * The third rung of the answer ladder. The student has read the answer and
 * put its key words back; now every word is reduced to its opening letter and
 * they type the whole thing. The cue is just enough to pull the WORDING rather
 * than the gist — a blank box asks for the idea, which is the rung above.
 *
 * ─── Marked when they ask, word by word ─────────────────────────────────────
 * Nothing is judged as they type, or the cue becomes a hint machine. On Check
 * the answer comes back with every word that returned in order inked plainly
 * and every word that did not underlined, so "22 of 30" says WHICH eight.
 * Spelling and punctuation do not count — this is not a spelling test.
 */
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { gradeRebuild } from "@/lib/answerBank";

export default function RebuildDrill({ rebuild, onGraded }) {
    const reduce = useReducedMotion();
    const [text, setText] = useState("");
    const [grade, setGrade] = useState(null);

    const check = () => {
        const g = gradeRebuild(rebuild, text);
        setGrade(g);
        onGraded?.(g);
    };

    return (
        <div className="space-y-4" data-rebuild>
            <div>
                <p className="stat-label text-muted-foreground">Every word is its first letter</p>
                {/* The cue, set like a printed page: each word keeps its length,
                    so the shape of the sentence is part of the cue. */}
                <p className="mt-2 font-mono text-sm sm:text-[15px] leading-relaxed text-foreground/80 break-words"
                    aria-label="The answer, first letters only">
                    {rebuild.words.map((w, i) => (
                        <span key={i} className="mr-[0.55em] inline-block">{w.cue}</span>
                    ))}
                </p>
            </div>

            {grade ? (
                <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="pt-4 border-t border-border space-y-2" data-rebuild-result>
                    <p className="text-sm font-black text-foreground">
                        <span className="tabular-nums">{grade.right}</span> of{" "}
                        <span className="tabular-nums">{grade.total}</span> words back, in order
                    </p>
                    <p className="text-[15px] leading-relaxed">
                        {/* The space sits OUTSIDE the word, or two missed words in
                            a row read as one underline running between them. */}
                        {rebuild.words.map((w, i) => (
                            <React.Fragment key={i}>
                                <span className={grade.each[i] === false
                                    ? "text-streak font-bold underline decoration-2 underline-offset-4 decoration-streak/60"
                                    : "text-foreground"}>
                                    {w.text}
                                </span>{" "}
                            </React.Fragment>
                        ))}
                    </p>
                    {grade.right < grade.total && (
                        <p className="text-[11px] text-muted-foreground">Underlined words are the ones that did not come back.</p>
                    )}
                </motion.div>
            ) : (
                <>
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
                        placeholder="Write the answer out in full…" data-rebuild-input
                        className="rounded-xl border-2 text-[15px] leading-relaxed" />
                    <Button onClick={check} disabled={!text.trim()} data-rebuild-check
                        className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                        Check it
                    </Button>
                </>
            )}
        </div>
    );
}
