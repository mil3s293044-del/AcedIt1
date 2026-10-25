/**
 * ScopeSheet — which of your topics this SAC is on.
 *
 * The one fact only the student can supply, and the one that makes a folder
 * a folder: with it, every mistake, answer, card and quiz in those topics is
 * gathered; without it, the folder honestly covers the whole subject and says
 * so. The options are the student's OWN topics, off every source — their decks,
 * their quizzes, their banks — because a scope on a topic they have nothing in
 * would gather nothing.
 *
 * Topics whose name appears in the SAC's title or description are flagged
 * "named in the SAC" and are NOT pre-ticked. A folder that decided what a SAC
 * was on would be guessing, and a wrong guess hides real mistakes from the one
 * screen meant to gather them.
 */
import React, { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { normTopic } from "@/lib/revision";

export default function ScopeSheet({ open, onOpenChange, folder, options = [], suggested = [], onSave }) {
    const [picked, setPicked] = useState(() => new Set((folder?.topics || []).map(normTopic)));
    const named = new Set(suggested.map(normTopic));
    const toggle = (t) => setPicked((p) => { const n = new Set(p); const k = normTopic(t); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    const chosen = options.filter((o) => picked.has(normTopic(o.topic))).map((o) => o.topic);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl font-extrabold">What does {folder?.title || "this SAC"} cover?</DialogTitle>
                    <DialogDescription>
                        Tick your topics that are on it. Everything you have in them lands in this folder.
                        Leave them all unticked and it covers all of {folder?.subject}.
                    </DialogDescription>
                </DialogHeader>
                {options.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                        Nothing in {folder?.subject} yet — make a deck or a quiz and its topic shows up here.
                    </p>
                ) : (
                    <ul className="flex flex-wrap gap-2 max-h-72 overflow-y-auto py-1" data-scope-options>
                        {options.map((o) => {
                            const on = picked.has(normTopic(o.topic));
                            return (
                                <li key={o.topic}>
                                    <button type="button" onClick={() => toggle(o.topic)} aria-pressed={on} data-scope-topic={o.topic}
                                        className={`inline-flex items-center gap-1.5 rounded-full border-2 pl-2.5 pr-3 py-1.5 text-sm font-bold transition-colors ${
                                            on ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-foreground/30"}`}>
                                        <span className={`w-4 h-4 rounded-full grid place-items-center ${on ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                                            {on && <Check className="w-3 h-3" strokeWidth={3} />}
                                        </span>
                                        {o.topic}
                                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{o.count}</span>
                                        {named.has(normTopic(o.topic)) && (
                                            <span className="text-[10px] font-black text-chart-3 uppercase tracking-wide">named in the SAC</span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                    {picked.size > 0 && (
                        <Button variant="ghost" onClick={() => setPicked(new Set())} className="rounded-xl text-muted-foreground">
                            Whole subject
                        </Button>
                    )}
                    <Button onClick={() => { onSave(chosen); onOpenChange(false); }} data-scope-save
                        className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                        {chosen.length ? `Cover ${chosen.length} topic${chosen.length === 1 ? "" : "s"}` : `Cover all of ${folder?.subject || "it"}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
