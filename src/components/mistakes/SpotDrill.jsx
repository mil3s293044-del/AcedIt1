/**
 * SpotDrill — find the words that cost the mark, in your own sentence.
 *
 * ─── Why this rung exists ───────────────────────────────────────────────────
 * Every other rung asks the student to reproduce something the app has shown
 * them. This one asks for a JUDGEMENT about their own writing, which is the
 * thing they actually have to do in a SAC — where nobody has underlined
 * anything and the weak phrase looks exactly like the strong ones until you
 * decide it doesn't.
 *
 * It is also the only rung that works on the student's own words. A model
 * answer is somebody else's sentence; the phrase they wrote is the one their
 * hand will reach for again under time pressure.
 *
 * ─── Tapping everything is not a strategy ───────────────────────────────────
 * `gradeSpot` counts a wrong tap against a right one, so selecting the whole
 * sentence scores nothing. A drill with a winning strategy that isn't "know
 * the answer" teaches the strategy instead of the answer.
 *
 * ─── It shows the answer, then still asks them to rate ──────────────────────
 * Same rule as everywhere else in the review flow: the app marks, the student
 * rates. Whether they knew it or guessed is the one judgement only they can
 * make, and an app that schedules a card off its own verdict has taken it.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { gradeSpot } from "@/lib/drill";

export default function SpotDrill({ spot, criterion, onGraded }) {
    const [picked, setPicked] = useState(() => new Set());
    const [checked, setChecked] = useState(false);

    const result = useMemo(
        () => (checked ? gradeSpot(spot, [...picked]) : null),
        [checked, spot, picked]);

    const toggle = (i) => {
        if (checked) return;
        setPicked(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i); else next.add(i);
            return next;
        });
    };

    const submit = () => {
        setChecked(true);
        onGraded?.(gradeSpot(spot, [...picked]));
    };

    return (
        <div className="space-y-4">
            <div>
                <p className="stat-label text-muted-foreground">Tap the words that cost the mark</p>
                <MarkdownMath className="text-sm text-muted-foreground leading-snug mt-1">
                    {criterion}
                </MarkdownMath>
            </div>

            {/* Their sentence, as they wrote it. Rendered as buttons rather
                than a marked-up string so nothing has to parse anything, and
                the whitespace tokens keep the original spacing exactly. */}
            <div className="rounded-2xl border-2 border-border bg-surface p-4 leading-loose">
                {spot.words.map((w, i) => {
                    if (w.space) return <span key={`s${i}`}>{w.text}</span>;
                    const on = picked.has(w.index);
                    const right = checked && w.wrong;
                    const missed = checked && w.wrong && !on;
                    const wrongPick = checked && !w.wrong && on;
                    return (
                        <button key={w.index} type="button" onClick={() => toggle(w.index)}
                            disabled={checked}
                            className={`rounded-md px-0.5 -mx-0.5 text-base font-medium transition-colors
                                ${right ? "bg-streak/20 text-streak underline decoration-streak decoration-2 underline-offset-4"
                                    : wrongPick ? "bg-secondary text-muted-foreground line-through"
                                    : on ? "bg-foreground text-background"
                                    : "text-foreground hover:bg-secondary"}
                                ${missed ? "ring-2 ring-streak/40" : ""}`}>
                            {w.text}
                        </button>
                    );
                })}
            </div>

            {!checked ? (
                <Button onClick={submit} disabled={picked.size === 0}
                    className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                    <Target className="w-4 h-4" />
                    {picked.size === 0 ? "Pick at least one word" : `Check ${picked.size}`}
                </Button>
            ) : (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border-2 border-border bg-surface p-3.5 space-y-2.5">
                    <p className={`flex items-center gap-2 text-sm font-black ${
                        result.allRight ? "text-primary" : "text-streak"}`}>
                        {result.allRight
                            ? <><Check className="w-4 h-4" /> Every one of them</>
                            : <><X className="w-4 h-4" /> {result.hits.length} of {result.total}
                                {result.falsePositives.length > 0
                                    && `, and ${result.falsePositives.length} that were fine`}</>}
                    </p>
                    <div>
                        <p className="stat-label text-primary">What would have scored</p>
                        <MarkdownMath className="text-sm text-foreground leading-snug mt-0.5">
                            {spot.wanted}
                        </MarkdownMath>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
