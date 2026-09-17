/**
 * SourcePanel — the material a question is asked ABOUT, on screen with it.
 *
 * VCAA examines from stimulus and the generator, reading a textbook, writes
 * like VCAA: "Using Source B, explain…", "Refer to the case study on p.14".
 * Nothing in the saved quiz held Source B, so the question was unanswerable —
 * and worse, the MARKER then judged the answer against a source it also could
 * not see, so the student lost marks for a gap the app created.
 *
 * So a question carries its source (`quizSchema.normaliseStimulus`) and this
 * prints it. It is DELIBERATELY DRAWN AS A DOCUMENT rather than as another of
 * the app's panels: an inset well, a rule down the left the way a block quote
 * is set, and the label as a caption above it. A student has to be able to tell
 * at a glance which words are the examiner's and which are the source's,
 * because half the skill being tested is reading the source.
 *
 * It is SELECTABLE and scrolls at a height, not clamped or behind a "show
 * more": a source you cannot read all of is the same failure as no source, and
 * students quote from these.
 */
import React from "react";
import MarkdownMath from "@/components/shared/MarkdownMath";

export default function SourcePanel({ stimulus, className = "" }) {
    // Null is the normal case — every quiz generated before this existed, and
    // every question that genuinely needs no source. Render nothing at all
    // rather than an empty headed box.
    if (!stimulus?.content) return null;

    return (
        <figure className={`mb-4 ${className}`}>
            <figcaption className="text-[11px] font-bold uppercase tracking-widest
                text-muted-foreground mb-1.5">
                {stimulus.label || "Source material"}
            </figcaption>
            <div className="border-l-4 border-chart-4/40 bg-secondary/40 rounded-r-xl
                px-4 py-3 max-h-72 overflow-y-auto">
                <div className="text-sm text-foreground leading-relaxed select-text
                    [&_table]:text-xs [&_p]:mb-2 [&_p:last-child]:mb-0">
                    <MarkdownMath>{stimulus.content}</MarkdownMath>
                </div>
            </div>
        </figure>
    );
}
