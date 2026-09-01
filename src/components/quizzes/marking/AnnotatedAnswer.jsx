/**
 * AnnotatedAnswer — the student's own answer, marked where it actually went
 * wrong.
 *
 * The words are theirs, rendered whole. Only the flagged characters carry a
 * mark, and the mark is an UNDERLINE rather than a strikethrough: a
 * strikethrough tells you to delete something, and almost nothing an assessor
 * flags should be deleted. It should be said better.
 *
 * ─── Why the note is not printed under the paragraph ────────────────────────
 * Because three notes under a paragraph is a wall, and the student has to work
 * out which one is about which phrase. The note belongs ON the phrase: point
 * at it and it tells you what the assessor saw and what would have scored.
 *
 * ─── Hover is not the interaction, it is one of three ───────────────────────
 * Hover, tap and keyboard focus all open the same note. Hover alone would make
 * this unusable on a phone, which is where most of these students are; and an
 * underline that only a mouse can interrogate is not an accessible control.
 * The trigger is a real <button> for exactly that reason.
 *
 * Colour is never the only signal either — every flagged span is underlined,
 * and the note names the severity in words.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check } from "lucide-react";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { segment } from "@/lib/annotate";

/** Static class lookups — Tailwind cannot see a class built at runtime. */
const TONE = {
    lost: {
        underline: "decoration-streak",
        text: "text-foreground",
        dot: "bg-streak",
        pill: "bg-streak/10 text-streak",
        label: "Cost a mark",
    },
    risk: {
        underline: "decoration-xp",
        text: "text-foreground",
        dot: "bg-xp",
        pill: "bg-xp/10 text-xp",
        label: "Imprecise",
    },
};

function Flagged({ ann, text, open, onToggle, onBank, banked }) {
    const tone = TONE[ann.severity] || TONE.lost;
    return (
        <span className="relative inline">
            <button
                type="button"
                onClick={onToggle}
                onMouseEnter={onToggle ? () => onToggle(true) : undefined}
                onMouseLeave={onToggle ? () => onToggle(false) : undefined}
                onFocus={() => onToggle?.(true)}
                onBlur={() => onToggle?.(false)}
                aria-expanded={open}
                aria-label={`${tone.label}: ${ann.quote}`}
                className={`inline cursor-pointer bg-transparent p-0 text-left
                    underline decoration-wavy decoration-2 underline-offset-4
                    ${tone.underline} ${tone.text}
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-ring rounded-sm`}
            >
                {text}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.span
                        role="tooltip"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        /* Block inside an inline flow, so it has to be taken out
                           of it — left-anchored and clamped to the viewport
                           rather than centred on the phrase, which would push a
                           note on a phrase near the right edge off the screen. */
                        className="absolute left-0 top-full z-30 mt-1.5 block w-[min(20rem,calc(100vw-3rem))]
                            rounded-2xl bg-surface border-2 border-border shadow-soft-lg p-3 text-left
                            font-body normal-case"
                    >
                        <span className="flex items-baseline gap-2 flex-wrap">
                            <span className={`pill text-[10px] ${tone.pill}`}>{tone.label}</span>
                            <span className="stat-label text-muted-foreground">{ann.criterion}</span>
                            {ann.worth > 0 && (
                                <span className="text-[10px] font-black text-muted-foreground tabular-nums">
                                    −{ann.worth}
                                </span>
                            )}
                        </span>
                        {ann.issue && (
                            <MarkdownMath className="block text-sm text-foreground leading-snug mt-1.5">
                                {ann.issue}
                            </MarkdownMath>
                        )}
                        {ann.fix && (
                            <span className="block mt-2 rounded-xl bg-primary/5 border border-primary/20 px-2.5 py-1.5">
                                <span className="stat-label text-primary">Instead</span>
                                <MarkdownMath className="block text-sm text-foreground leading-snug mt-0.5">
                                    {ann.fix}
                                </MarkdownMath>
                            </span>
                        )}
                        {onBank && (
                            <button type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => { e.stopPropagation(); onBank(ann); }}
                                disabled={banked}
                                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border-2 border-border
                                    px-2.5 py-1 text-xs font-bold text-foreground hover:border-primary/50
                                    disabled:opacity-60 disabled:cursor-default cursor-pointer transition-colors">
                                {banked
                                    ? <><Check className="w-3.5 h-3.5 text-primary" /> In your mistake bank</>
                                    : <><Plus className="w-3.5 h-3.5" /> Add to mistake bank</>}
                            </button>
                        )}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}

export default function AnnotatedAnswer({ text, annotations = [], onBank, banked = new Set() }) {
    const [open, setOpen] = useState(null);
    const segments = segment(text, annotations);
    if (segments.length === 0) return null;

    return (
        <p data-annotated className="text-base text-foreground leading-loose">
            {segments.map((s, i) => (
                s.ann ? (
                    <Flagged key={i} ann={s.ann} text={s.text}
                        open={open === i}
                        banked={banked.has(s.ann.quote)}
                        onBank={onBank}
                        onToggle={(v) => setOpen((cur) => (typeof v === "boolean"
                            ? (v ? i : (cur === i ? null : cur))
                            : (cur === i ? null : i)))} />
                ) : (
                    <React.Fragment key={i}>{s.text}</React.Fragment>
                )
            ))}
        </p>
    );
}
