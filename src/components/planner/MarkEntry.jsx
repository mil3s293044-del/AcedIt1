/**
 * MarkEntry — what you actually got, entered once, where the SAC lives.
 *
 * ═══ TWO COLUMNS THIS APP HAS SHIPPED FOR MONTHS AND NEVER ONCE WRITTEN ═════
 * `subject_assessments.score` and `out_of` have been in the schema since
 * migration 0002. Nothing in the codebase set them and nothing read them: a
 * SAC was ticked done and the mark — the entire point of sitting it — went
 * nowhere. That is the "collect nothing you don't use" rule inverted, which
 * this file has already recorded about `goal_study_score`, and it had the same
 * shape: a column with no input, and screens that could have used it quietly
 * doing without.
 *
 * Meanwhile Compete asked the same student for the same mark through
 * `window.prompt`, out of 100, into a market — the least gamified surface in
 * the app, and a SECOND place to type a number that already had a home.
 *
 * ═══ ONE ENTRY, BOTH JOBS ══════════════════════════════════════════════════
 * The mark is typed here. It fills the column, and `reportMark` then READS IT
 * BACK OFF THE ROW to settle any line the student had open on that SAC —
 * never from a request body, which is the rule every other settlement on the
 * board already keeps. So the planner and the floor cannot disagree about one
 * mark, because there is only one mark.
 *
 * ═══ THE DENOMINATOR IS A FACT ABOUT THE ASSESSMENT ═════════════════════════
 * A SAC is out of 60, or 40, or 25. Asking for a percentage makes the student
 * do arithmetic the app is better at, and asking for "48" alone is a number
 * that means nothing later. Both halves, with the percentage computed in front
 * of them — and `markPercent` is the ONE conversion, shared with the server, so
 * the figure under the box is the figure the market settles on.
 *
 * ═══ AND "I HAVEN'T GOT IT YET" IS A REAL ANSWER ════════════════════════════
 * Marks come back a week later. A dialog that will not close without one turns
 * ticking a SAC off into a thing students avoid doing, so the assessment can
 * be closed without a mark and the mark added when it arrives. What must never
 * happen is a BLANK being stored as a zero — `markPercent` returns null rather
 * than nought for exactly that, and an unmarked assessment leaves any line on
 * it open rather than settling it as a fail.
 */
import React, { useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { markPercent } from "@/lib/market";

export default function MarkEntry({ assessment, busy, onSave, onSkip, onClose }) {
    const [score, setScore] = useState("");
    const [outOf, setOutOf] = useState(String(assessment?.out_of || ""));

    const pct = markPercent(score, outOf);
    const ready = pct !== null;

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-xp" /> What did you get?
                    </DialogTitle>
                </DialogHeader>

                <p className="text-sm text-muted-foreground leading-snug -mt-1">
                    {assessment?.subject_name} — {assessment?.title}
                </p>

                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <label htmlFor="mark-score"
                            className="stat-label text-muted-foreground">Your mark</label>
                        <Input id="mark-score" type="number" inputMode="decimal" min="0"
                            value={score} onChange={(e) => setScore(e.target.value)}
                            placeholder="48" className="mt-1 tabular-nums" />
                    </div>
                    <span className="pb-2.5 text-muted-foreground font-bold">/</span>
                    <div className="w-24">
                        <label htmlFor="mark-out-of"
                            className="stat-label text-muted-foreground">Out of</label>
                        <Input id="mark-out-of" type="number" inputMode="decimal" min="1"
                            value={outOf} onChange={(e) => setOutOf(e.target.value)}
                            placeholder="60" className="mt-1 tabular-nums" />
                    </div>
                </div>

                {/* The conversion, in front of them, from the one function the
                    server settles with. Not a second estimate of the same sum. */}
                <p className="text-sm text-muted-foreground tabular-nums">
                    {ready
                        ? <>That&apos;s <span className="font-display font-black text-foreground">{pct}%</span>
                            {" "}— it goes on your record and settles any line you had on it.</>
                        : "Both halves, and we'll work out the percentage."}
                </p>

                <div className="flex gap-2 pt-1">
                    <Button variant="ghost" onClick={onSkip} disabled={busy}
                        className="text-muted-foreground">
                        Not back yet
                    </Button>
                    <Button onClick={() => onSave(Number(score), Number(outOf))}
                        disabled={!ready || busy} className="flex-1 gap-2">
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save the mark
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
