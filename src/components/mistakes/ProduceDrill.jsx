/**
 * ProduceDrill — the criterion, a box, and an examiner.
 *
 * The top rung. No wording to recognise and no words to slot in: the student
 * gets what the assessor was looking for and has to write something that would
 * earn it. This is the rung that transfers, because a SAC is a box.
 *
 * ─── Marked, not self-rated, and then still self-rated ──────────────────────
 * The model marks the attempt against the criterion in the same examiner voice
 * the quiz marking uses — it names what they got and what is still missing,
 * which is the whole reason to type rather than think it. But the SM-2 rating
 * stays the student's: an app that schedules a card off its own verdict has
 * taken away the one judgement only they can make, which is whether they knew
 * it or guessed it. The marking SUGGESTS a button and highlights it.
 *
 * ─── One call, and only when they ask ───────────────────────────────────────
 * Marking fires on submit, never as they type. A failed call is not a dead end
 * — the model answer appears and they rate themselves, which is exactly the
 * rung below. Nothing about this screen requires the network to work.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";

const VERDICT = {
    got:     { label: "That would score", cls: "text-primary",  icon: Check, rating: 4 },
    partial: { label: "Partly there",     cls: "text-xp",       icon: AlertTriangle, rating: 3 },
    missed:  { label: "Not yet",          cls: "text-streak",   icon: X, rating: 1 },
};

export default function ProduceDrill({ card, criterion, onMarked }) {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [mark, setMark] = useState(null);
    const [failed, setFailed] = useState(false);

    const submit = async () => {
        const attempt = text.trim();
        if (!attempt || busy) return;
        setBusy(true);
        setFailed(false);
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: "quiz_ai_mark",
                prompt: `${getExaminerPrompt(card?.subject_name || "")}

A student is re-drilling a mark they previously dropped. Mark THIS attempt
against the one criterion below, and nothing else.

THE CRITERION: ${criterion}

WHAT A FULL-MARK RESPONSE CONTAINED: ${card?.answer || "not recorded"}

THEIR ATTEMPT:
${attempt}

Rules, and breaking any of them makes this worse than no feedback:
- "verdict" is "got" only if this attempt would earn the criterion as written.
  "partial" if it has some of it. "missed" if it does not address it.
- "got" and "missing" are the SPECIFIC things — name the terms and ideas, not
  "good detail" or "more depth". A student cannot act on an adjective.
- "note" is one sentence, addressed to the RESPONSE and not to the student, in
  the voice of an examiner's report. No praise, no encouragement.
- Wording does not have to match the model answer. A different phrasing that
  earns the criterion is a "got".`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        verdict: { type: "string", enum: ["got", "partial", "missed"] },
                        got: { type: "array", items: { type: "string" } },
                        missing: { type: "array", items: { type: "string" } },
                        note: { type: "string" },
                    },
                    required: ["verdict", "note"],
                },
            });
            const data = res?.data ?? res;
            const v = VERDICT[data?.verdict] ? data.verdict : "partial";
            const m = {
                verdict: v,
                got: Array.isArray(data?.got) ? data.got.filter(Boolean) : [],
                missing: Array.isArray(data?.missing) ? data.missing.filter(Boolean) : [],
                note: String(data?.note || "").trim(),
            };
            setMark(m);
            onMarked?.(VERDICT[v].rating);
        } catch {
            // The model answer still appears below, so the student can mark
            // themselves. A drill that dead-ends when a request fails is worse
            // than one that never called out.
            setFailed(true);
            onMarked?.(null);
        } finally { setBusy(false); }
    };

    const v = mark ? VERDICT[mark.verdict] : null;
    const Icon = v?.icon;

    return (
        <div className="space-y-4">
            <div>
                <p className="stat-label text-muted-foreground">Write what would earn this</p>
                <MarkdownMath className="text-base sm:text-lg font-bold text-foreground leading-snug mt-1">
                    {criterion}
                </MarkdownMath>
            </div>

            <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!!mark || failed}
                rows={5}
                placeholder="In your own words…"
                className="border-2 border-border rounded-xl text-base"
            />

            {!mark && !failed && (
                <Button onClick={submit} disabled={!text.trim() || busy}
                    className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                    {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Marking against the criterion…</>
                          : "Mark my answer"}
                </Button>
            )}

            {mark && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border-2 border-border bg-surface p-3.5 space-y-2.5">
                    <p className={`flex items-center gap-2 text-sm font-black ${v.cls}`}>
                        <Icon className="w-4 h-4" /> {v.label}
                    </p>
                    {mark.note && (
                        <MarkdownMath className="text-sm text-foreground leading-snug">{mark.note}</MarkdownMath>
                    )}
                    {mark.got.length > 0 && (
                        <div>
                            <p className="stat-label text-primary">You had</p>
                            <ul className="text-sm text-foreground leading-snug mt-0.5 space-y-0.5">
                                {mark.got.map((g, i) => <li key={i}>· {g}</li>)}
                            </ul>
                        </div>
                    )}
                    {mark.missing.length > 0 && (
                        <div>
                            <p className="stat-label text-streak">Still missing</p>
                            <ul className="text-sm text-foreground leading-snug mt-0.5 space-y-0.5">
                                {mark.missing.map((g, i) => <li key={i}>· {g}</li>)}
                            </ul>
                        </div>
                    )}
                </motion.div>
            )}

            {failed && (
                <p className="text-sm text-muted-foreground">
                    Couldn&apos;t reach the marker. Compare against the wording below and rate it yourself.
                </p>
            )}

            {/* The model wording, once they have committed to an attempt.
                Before that it would just be the answer sitting under the
                question, which is the rung below wearing this one's clothes. */}
            {(mark || failed) && (
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3.5">
                    <p className="stat-label text-primary">What scores</p>
                    <MarkdownMath className="text-sm text-foreground leading-relaxed mt-1">
                        {card?.answer}
                    </MarkdownMath>
                </div>
            )}
        </div>
    );
}
