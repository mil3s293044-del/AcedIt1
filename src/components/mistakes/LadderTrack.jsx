/**
 * LadderTrack — how far this one mistake has actually come.
 *
 * ─── Why it exists ──────────────────────────────────────────────────────────
 * The ladder is the most useful thing about the bank and it was completely
 * invisible. A student saw one exercise, rated it, and had no way to know
 * whether that was the first of two or the fourth of five — the card said
 * "coming back" and nothing else, so the only way to find out how close a
 * mistake was to done was to keep doing it and see. A drill you cannot see the
 * end of is one you stop doing.
 *
 * ─── A skipped step is drawn as skipped ─────────────────────────────────────
 * Not every rung can be built for every mistake — spotting needs the student's
 * own words, filling needs a wording with something worth blanking. Those are
 * struck through rather than left pending, because a step that will never
 * happen sitting in a progress bar is a bar that jumps.
 */
import React from "react";
import { Check, Minus } from "lucide-react";
import { ladderProgress } from "@/lib/drill";

const DOT = {
    done:    "bg-primary text-primary-foreground border-primary",
    current: "bg-surface text-foreground border-foreground",
    todo:    "bg-secondary text-muted-foreground border-transparent",
    skipped: "bg-transparent text-muted-foreground/40 border-dashed border-border",
};
const LABEL = {
    done: "text-muted-foreground",
    current: "text-foreground font-black",
    todo: "text-muted-foreground/70",
    skipped: "text-muted-foreground/40 line-through",
};

export default function LadderTrack({ steps = [], compact = false }) {
    if (!steps.length) return null;
    const p = ladderProgress(steps);

    return (
        <div>
            <div className="flex items-start gap-0.5">
                {steps.map((s, i) => (
                    <React.Fragment key={s.id}>
                        {i > 0 && (
                            <span aria-hidden="true"
                                className={`flex-1 h-0.5 mt-[0.6rem] rounded-full ${
                                    s.state === "done" ? "bg-primary" : "bg-border"}`} />
                        )}
                        <span className="flex flex-col items-center gap-1 flex-shrink-0"
                            title={`${s.label} — ${s.blurb}`}>
                            <span className={`w-[1.35rem] h-[1.35rem] rounded-full border-2 flex items-center
                                justify-center text-[10px] font-black ${DOT[s.state]}`}>
                                {s.state === "done" ? <Check className="w-3 h-3" strokeWidth={3} />
                                    : s.state === "skipped" ? <Minus className="w-2.5 h-2.5" />
                                    : i + 1}
                            </span>
                            {!compact && (
                                <span className={`text-[10px] leading-none ${LABEL[s.state]}`}>{s.label}</span>
                            )}
                        </span>
                    </React.Fragment>
                ))}
            </div>
            {!compact && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                    {p.done === p.total
                        ? "Every step done."
                        : <>Step <span className="font-bold text-foreground tabular-nums">{p.done + 1}</span> of{" "}
                            <span className="tabular-nums">{p.total}</span>
                            {steps.some((s) => s.state === "skipped")
                                && <span className="text-muted-foreground/70"> · struck-through steps don&rsquo;t apply to this one</span>}</>}
                </p>
            )}
        </div>
    );
}
