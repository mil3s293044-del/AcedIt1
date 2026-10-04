/**
 * WorkPicker — what are we working on.
 *
 * ─── IT OPENS ON WHAT THEY ALREADY HAVE ─────────────────────────────────────
 * A blank box asks the student to supply context the app is already holding,
 * which is the complaint about the chat moved one screen along. The candidates
 * come from `workpieceSources` — a question they got wrong, a criterion they
 * keep dropping, a SAC on the planner — and every one of them is derived, so a
 * card disappears because the fact behind it stopped being true.
 *
 * ─── AND IT STILL TAKES ANYTHING ────────────────────────────────────────────
 * A student with a worksheet in front of them has to be able to put it on the
 * bench. "Something else" is a real second half rather than an escape hatch:
 * the KIND is asked for explicitly, because it is what decides which tools can
 * act on it and guessing it from the text would be the kind of inference this
 * codebase refuses — a wrong guess silently removes the tool they came for.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LIST, SOURCES, makeWorkpiece } from "@/lib/workpiece";

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
                {src?.label || "On the bench"}
                {workpiece.subject ? ` · ${workpiece.subject}` : ""}
            </p>
            <p className="font-semibold text-foreground text-sm leading-snug mt-1">{workpiece.title}</p>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-primary mt-2">
                Put it on the bench <ArrowRight className="w-3 h-3" />
            </span>
        </motion.button>
    );
}

export default function WorkPicker({ candidates = [], onPick, loading = false }) {
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState("question");
    const [body, setBody] = useState("");

    // NOTHING IS DRAWN WHILE IT LOADS. A skeleton list would promise candidates
    // before anything has been counted, and the commonest honest answer for a
    // new account is that there are none.
    if (loading) return null;

    const submit = () => {
        const w = makeWorkpiece({ kind, body, source: "typed" });
        // `makeWorkpiece` REFUSES an empty body, so this cannot open a bench
        // with nothing on it — the button simply does nothing, which is what a
        // disabled state would mean anyway and it is already disabled.
        if (w) onPick(w);
    };

    return (
        <div className="max-w-2xl mx-auto w-full px-4 py-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                The bench
            </p>
            <h2 className="font-display font-extrabold text-foreground text-xl leading-tight mb-5">
                What are we working on?
            </h2>

            {candidates.length > 0 && (
                <div className="space-y-2.5 mb-5">
                    {candidates.map((w, i) => (
                        <Candidate key={`${w.source}:${w.title}`} workpiece={w} index={i} onPick={onPick} />
                    ))}
                </div>
            )}

            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground
                        hover:text-foreground transition-colors"
                >
                    <Pencil className="w-3.5 h-3.5" />
                    {candidates.length ? "Something else" : "Put something on the bench"}
                </button>
            ) : (
                <div className="rounded-2xl border-2 border-border bg-surface p-4 space-y-3">
                    {/* THE KIND IS ASKED FOR, never guessed. It decides which
                        tools can act on the thing, so inferring it from the text
                        would silently remove the one the student came for. */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                            What is it
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {KIND_LIST.map((k) => (
                                <button
                                    key={k.id}
                                    type="button"
                                    onClick={() => setKind(k.id)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold border-2 transition-colors
                                        ${kind === k.id
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
                                >
                                    {k.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-2">
                            {KIND_LIST.find((k) => k.id === kind)?.hint}
                        </p>
                    </div>

                    <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={5}
                        placeholder="Paste the question, the problem, or what you wrote…"
                        className="resize-none"
                    />

                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="text-[12px] font-bold text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </button>
                        <Button onClick={submit} disabled={!body.trim()} className="font-bold">
                            On the bench <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
