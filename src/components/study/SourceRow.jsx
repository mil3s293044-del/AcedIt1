/**
 * SourceRow — "what am I working from", as one row inside the setup card.
 *
 * ─── IT WAS A SECOND CARD ASKING THE SAME QUESTION ──────────────────────────
 * Both study pages put the upload in its own panel beside the setup —
 * "Turn your notes into questions" on Active Recall, "Your notes (optional)"
 * on Blurting — which made it look like the real way in, when the student's
 * own cards and mind map are already better material and need no upload at
 * all. That is the mega-picker's own rule, which refused a second picker
 * because it would be "two answers to 'what am I working from'", pointed at
 * the panel one level up.
 *
 * So the sources sit together, in order of what the student already has:
 * their cards and map first, stated as a fact; then an upload; then a chapter
 * of a stored book, where that applies. Nothing here is required — saying so
 * once, quietly, is the difference between an optional step and a step that
 * LOOKS required, which is the "feature gated behind an optional-looking step"
 * shape this app has been through twice.
 */
import React from "react";
import { FileText, X } from "lucide-react";
import { STUDY_ACCEPT, STUDY_ACCEPT_LABEL } from "@/lib/pickFiles";

export default function SourceRow({
    files = [], onPick, onRemove, hint = null, have = null, children = null,
}) {
    return (
        <div className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="stat-label text-muted-foreground">Working from</p>
                {/* What it can already run on. A student who has cards for this
                    topic should never be told to go and find a PDF. */}
                {have && <p className="text-xs text-muted-foreground">{have}</p>}
            </div>
            {hint && <p className="text-xs text-muted-foreground leading-snug">{hint}</p>}

            <div className={`rounded-2xl border-2 border-dashed transition-colors
                ${files.length ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30"}`}>
                <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer rounded-2xl
                    hover:bg-secondary/40 transition-colors">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                        ${files.length ? "bg-primary/15" : "bg-surface"}`}>
                        <FileText className={`w-4 h-4 ${files.length ? "text-primary" : "text-muted-foreground"}`} />
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-bold
                            ${files.length ? "text-foreground" : "text-muted-foreground"}`}>
                            {files.length
                                ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                                : "Upload notes"}
                        </span>
                        <span className="block text-[11px] text-muted-foreground/70">{STUDY_ACCEPT_LABEL}</span>
                    </span>
                    <input type="file" className="hidden" multiple accept={STUDY_ACCEPT}
                        onChange={(e) => {
                            const picked = Array.from(e.target.files || []);
                            e.target.value = "";
                            onPick?.(picked);
                        }} />
                </label>
                {files.length > 0 && (
                    <div className="px-3.5 pb-3 space-y-1" onClick={(e) => e.stopPropagation()}>
                        {files.map((f, i) => (
                            <div key={`${f.name}-${i}`}
                                className="flex items-center gap-2 bg-surface rounded-lg px-2 py-1 border border-border">
                                <span className="flex-1 text-xs text-foreground truncate">{f.name}</span>
                                <button type="button" onClick={() => onRemove?.(i)}
                                    aria-label={`Remove ${f.name}`}
                                    className="text-muted-foreground/60 hover:text-streak flex-shrink-0 transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}
