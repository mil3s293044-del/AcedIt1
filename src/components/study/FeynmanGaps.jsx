/**
 * FeynmanGaps — the questions your explanation does not answer.
 *
 * ─── IT IS QUESTIONS, NOT CRITICISM, AND THAT IS THE WHOLE SCREEN ───────────
 * A list of faults is a guilt list, which is the shape /MistakeBank refused
 * when it chose "am I actually fixing these" over "what did I get wrong". The
 * output of a Feynman pass is the thing a curious listener would ask next —
 * which a student can go away and answer, and which reads as the conversation
 * the technique is imitating without costing a conversation's worth of calls.
 *
 * ─── THE UNDERLINING IS ALREADY BUILT AND ALREADY TESTED ────────────────────
 * `segment()` from annotate.js claims spans by EXACT string match, drops
 * overlaps, and never fuzzy-matches — because underlining the wrong six words
 * and saying they cost a mark sends a student to rewrite a sentence that was
 * fine. A Feynman gap carries `quote` and `id`, which is all `segment` needs,
 * so nothing new was written to draw this.
 *
 * And the split `MarkModule` settled holds here too: THE UNDERLINE POINTS, THE
 * MODULE HOLDS THE CONTENT. A gap whose problem is an ABSENCE has no quote and
 * no underline — and it is the strongest kind there is, which is exactly why it
 * may not be the one with nowhere to live.
 */
import React, { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Circle, Square, CornerDownRight, X, RotateCcw, Pencil } from "lucide-react";
import { segment } from "@/lib/annotate";
import { kindOf, progressOf } from "@/lib/feynman";
import MarkdownMath from "@/components/shared/MarkdownMath";

/** Shape carries the kind, so the four are told apart without colour. */
const SHAPE = { ring: Circle, box: Square, arrow: CornerDownRight, cross: X };

const TONE = {
    berry:     { text: "text-berry",     border: "border-berry/35",     bg: "bg-berry/10"     },
    xp:        { text: "text-xp",        border: "border-xp/35",        bg: "bg-xp/10"        },
    "chart-4": { text: "text-chart-4",   border: "border-chart-4/35",   bg: "bg-chart-4/10"   },
    streak:    { text: "text-streak",    border: "border-streak/35",    bg: "bg-streak/10"    },
};

function GapModule({ gap, index, onToggle, refFor }) {
    const kind = kindOf(gap.kind);
    const tone = TONE[kind.tone] || TONE.berry;
    const Shape = SHAPE[kind.shape] || Circle;
    return (
        <motion.li
            ref={refFor}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 5) * 0.05 }}
            className="pb-2.5"
        >
            <div className={`rounded-2xl border-2 p-4 transition-colors
                ${gap.closed ? "border-border bg-secondary/30" : `${tone.border} bg-surface`}`}>
                <div className="flex items-start gap-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                        ${gap.closed ? "bg-primary/15" : tone.bg}`}>
                        {gap.closed
                            ? <Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                            : <Shape className={`w-3.5 h-3.5 ${tone.text}`} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                        {/* THE QUESTION LEADS, at full weight. It is the thing
                            the student can act on; everything else is why. */}
                        <div className={`font-display font-extrabold text-foreground text-[15px] leading-snug
                            ${gap.closed ? "opacity-60" : ""}`}>
                            <MarkdownMath>{gap.ask}</MarkdownMath>
                        </div>
                        <p className={`text-[11px] font-black uppercase tracking-widest mt-1.5
                            ${gap.closed ? "text-muted-foreground" : tone.text}`}>
                            {kind.label}
                        </p>
                        {gap.why && (
                            <div className="text-[13px] text-muted-foreground leading-snug mt-1.5">
                                <MarkdownMath>{gap.why}</MarkdownMath>
                            </div>
                        )}
                        {gap.quote && (
                            <p className="text-[13px] text-muted-foreground leading-snug mt-2 pl-3
                                border-l-2 border-border italic">
                                “{gap.quote}”
                            </p>
                        )}
                    </div>
                </div>

                {/* ── THE ACTION GOES IN THE GUTTER UNDER THE CARD ───────────
                    Never its top-right corner — that corner is where the title
                    starts, and this app has the rule written down because the
                    Quizzes shelf learned it. Put there, the button took ~110px
                    off a 22rem column and wrapped "Does heating actually change
                    the activation energy?" onto five lines of about four words.
                    The question is the whole payload; nothing may squeeze it.

                    THE STUDENT TICKS IT, NEVER THE MODEL — drill.js's rule.
                    Whether they can answer it now is the one judgement only
                    they can make, and the re-check is PROOF for anyone who
                    wants it rather than a verdict imposed on them. */}
                <div className="pl-10 pt-2.5">
                    <button
                        type="button"
                        onClick={() => onToggle(gap.id)}
                        className={`rounded-xl px-3 py-1.5 text-[12px] font-bold border-2
                            transition-colors ${gap.closed
                                ? "border-primary/40 text-primary bg-primary/10"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                    >
                        {gap.closed ? "Answered" : "I can answer this"}
                    </button>
                </div>
            </div>
        </motion.li>
    );
}

export default function FeynmanGaps({
    work = "",
    gaps = [],
    onToggle,
    onRewrite,
    onRecheck,
    onFinish,
    busy = false,
    recheckLabel = "",
}) {
    const refs = useRef({});
    const open = gaps.filter((g) => !g.closed);
    const prog = progressOf(gaps);
    // `segment` takes anything carrying `quote`, which is what a gap carries.
    const segments = useMemo(() => segment(work, open.filter((g) => g.quote)), [work, open]);

    const jump = (id) => {
        refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // ── ALL CLEAR IS A REAL ANSWER, and it has a real screen ────────────────
    // The property the whole design rests on: a pass that always finds
    // something is a horoscope, so the state where it finds nothing cannot look
    // like the page failed to load.
    if (!gaps.length) {
        return (
            <div className="card-soft p-8 text-center max-w-2xl mx-auto">
                <span className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-7 h-7 text-primary" aria-hidden="true" />
                </span>
                <h3 className="font-display font-extrabold text-foreground text-xl mb-1.5">
                    It holds up.
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Nothing in that explanation needed a follow-up question. That is the
                    whole point of the technique, and it is worth more than a score.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                    <Button onClick={onFinish} className="bg-berry hover:bg-berry/90 text-white font-bold">
                        Log the session
                    </Button>
                    <Button variant="outline" onClick={onRewrite} className="gap-1.5">
                        <Pencil className="w-3.5 h-3.5" /> Keep working on it
                    </Button>
                </div>
            </div>
        );
    }

    // THE QUESTIONS ARE THE CONTENT, so they take the wider column. The
    // explanation beside them is the REFERENCE — read once, to see where an
    // underline landed, and usually a short paragraph. The first split gave the
    // reference 1fr and the questions 22rem, which is the proportion backwards.
    return (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr] gap-5 items-start">
            {/* ── What you wrote, with the gaps underlined in place ───────── */}
            <div className="card-soft p-5 sm:p-6 order-2 lg:order-1">
                <p className="stat-label text-muted-foreground mb-3">What you said</p>
                <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {segments.map((s, i) => (
                        s.ann ? (
                            <button
                                key={i}
                                type="button"
                                onClick={() => jump(s.ann.id)}
                                className="underline decoration-berry decoration-2 underline-offset-4
                                    hover:bg-berry/10 rounded transition-colors text-left"
                            >
                                {s.text}
                            </button>
                        ) : <span key={i}>{s.text}</span>
                    ))}
                </p>
            </div>

            {/* ── The questions ───────────────────────────────────────────── */}
            <div className="order-1 lg:order-2 lg:sticky lg:top-4">
                <div className="flex items-baseline gap-3 mb-1">
                    <h3 className="font-display font-extrabold text-foreground text-lg leading-none">
                        {open.length} to answer
                    </h3>
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
                <p className="text-[13px] text-muted-foreground mb-3">
                    {prog.closed > 0
                        ? `${prog.closed} of ${prog.total} answered.`
                        : "Questions your explanation leaves open."}
                </p>

                <ul>
                    {gaps.map((g, i) => (
                        <GapModule
                            key={g.id}
                            gap={g}
                            index={i}
                            onToggle={onToggle}
                            refFor={(el) => { refs.current[g.id] = el; }}
                        />
                    ))}
                </ul>

                <div className="flex flex-wrap gap-2 pt-1">
                    <Button onClick={onRewrite} className="bg-berry hover:bg-berry/90 text-white gap-1.5 font-bold">
                        <Pencil className="w-3.5 h-3.5" /> Explain it again
                    </Button>
                    {onRecheck && (
                        <Button variant="outline" onClick={onRecheck} disabled={busy} className="gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Check the rewrite
                        </Button>
                    )}
                </div>
                {recheckLabel && (
                    <p className="text-[11px] text-muted-foreground mt-2">{recheckLabel}</p>
                )}
            </div>
        </div>
    );
}
