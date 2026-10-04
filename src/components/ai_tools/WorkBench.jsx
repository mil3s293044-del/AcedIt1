/**
 * WorkBench — the workpiece, the tools, and what has been done to it.
 *
 * ─── THE WORKPIECE DOES NOT SCROLL AWAY ─────────────────────────────────────
 * That is the whole layout argument. In a chat the thing you are working on is
 * a message that leaves the screen as soon as you reply to it, so every tool
 * after the first needs the student to restate it. Here it is a header that
 * stays, and the tools act on it.
 *
 * ─── THE TOOLBAR IS WHAT APPLIES, IN THE ORDER WORTH DOING ──────────────────
 * `toolsFor` decides, not this component — a bench that drew all eight and
 * greyed six out would be the dropdown again with more pixels. What is on
 * screen is what can act on this thing.
 *
 * ─── A STEP IS A CONVERSATION, which is why there is no second send path ────
 * `UnifiedChat` already streams, handles artifacts, bills the right feature and
 * persists. Opening a step hands it that step's tool, subject and opening
 * message. Writing a bespoke runner here would be a second copy of the surface
 * `quizScore.js` has had to fix four times.
 *
 * ─── EVERY TOOL PRINTS ITS PRICE ────────────────────────────────────────────
 * A bench makes pressing things easy, which is the point and also the risk: a
 * student who runs five tools on one essay has spent five times what one chat
 * message costs. `priceLabel` is the same figure the server bills, on the
 * button, before it is pressed — megaUpload's rule, applied to the surface that
 * most invites a second press.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Coins, Plus } from "lucide-react";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { createPageUrl } from "@/utils";
import { toolsFor, SOURCES, KINDS } from "@/lib/workpiece";
import { toolById } from "@/components/ai_tools/chatTools";
import { priceLabel } from "@/lib/chips";

/* ── The workpiece itself ────────────────────────────────────────────────── */

function Piece({ workpiece, onBack }) {
    const src = SOURCES[workpiece.source];
    const kind = KINDS[workpiece.kind];
    return (
        <div className="rounded-2xl border-2 border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-wrap">
                {onBack && (
                    <button type="button" onClick={onBack}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground
                            hover:text-foreground transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Bench
                    </button>
                )}
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {kind?.label || "On the bench"}
                </span>
                {src && (
                    <span className="text-[10px] font-bold text-muted-foreground/70">· {src.label}</span>
                )}
                {workpiece.subject && (
                    <span className="text-[10px] font-bold text-muted-foreground/70">· {workpiece.subject}</span>
                )}
                {/* A WAY BACK, only where there is one. Typed and uploaded work
                    has nowhere to return to and `makeWorkpiece` drops the ref
                    rather than letting a dead link onto the header. */}
                {workpiece.ref?.page && (
                    <Link
                        to={createPageUrl(workpiece.ref.page) + (workpiece.ref.query || "")}
                        className="ml-auto text-[11px] font-bold text-primary underline underline-offset-2"
                    >
                        {workpiece.ref.label || "Where this came from"}
                    </Link>
                )}
            </div>
            {/* RENDERED AS MATHS, like every other surface that prints a
                question. A workpiece is very often a formula, and printing it
                as plain text is the failure the drill screen already records. */}
            <div className="px-4 pb-4 max-h-56 overflow-y-auto">
                <MarkdownMath className="text-[15px] text-foreground leading-relaxed">
                    {workpiece.body}
                </MarkdownMath>
            </div>
        </div>
    );
}

/* ── The toolbar ─────────────────────────────────────────────────────────── */

function ToolButton({ op, lead, done, busy, onRun }) {
    const tool = toolById(op.tool);
    const Glyph = tool?.icon;
    return (
        <button
            type="button"
            disabled={busy}
            onClick={() => onRun(op)}
            className={`text-left rounded-2xl border-2 p-3.5 transition-colors disabled:opacity-60
                ${lead
                    ? "border-primary/50 bg-primary/5 hover:border-primary"
                    : "border-border bg-surface hover:border-muted-foreground/40"}`}
        >
            <div className="flex items-center gap-2">
                {Glyph && (
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tool.accentBg}`}>
                        <Glyph className={`w-3.5 h-3.5 ${tool.accentText}`} aria-hidden="true" />
                    </span>
                )}
                <span className="font-bold text-foreground text-sm leading-tight">{op.verb}</span>
                {/* DONE IS NOT DISABLED. Running a tool twice is legitimate —
                    a second plan after a first draft is the normal way of it —
                    so this records that it has been used rather than blocking. */}
                {done > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black
                        uppercase tracking-wider text-primary">
                        <Check className="w-3 h-3" />{done > 1 ? `×${done}` : ""}
                    </span>
                )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-snug">{op.does}</p>
            <p className="text-[11px] font-bold text-muted-foreground/70 mt-1.5 inline-flex items-center gap-1">
                <Coins className="w-3 h-3" aria-hidden="true" />
                {priceLabel(tool?.feature || "ai_chat")}
            </p>
        </button>
    );
}

/* ── What has been done ──────────────────────────────────────────────────── */

function StepRow({ step, index, onOpen }) {
    const tool = toolById(step.tool);
    const Glyph = tool?.icon;
    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => onOpen(step)}
            className="w-full text-left rounded-xl border border-border bg-surface px-3.5 py-3
                hover:border-muted-foreground/40 transition-colors flex items-center gap-3"
        >
            <span className="font-display font-black text-muted-foreground text-sm tabular-nums w-5 flex-shrink-0">
                {index + 1}
            </span>
            {Glyph && <Glyph className={`w-4 h-4 flex-shrink-0 ${tool.accentText}`} aria-hidden="true" />}
            <span className="min-w-0 flex-1">
                <span className="block font-bold text-foreground text-sm truncate">{step.title}</span>
                {step.preview && (
                    <span className="block text-[12px] text-muted-foreground truncate">{step.preview}</span>
                )}
            </span>
        </motion.button>
    );
}

/* ── The bench ───────────────────────────────────────────────────────────── */

export default function WorkBench({
    workpiece,
    steps = [],
    busy = false,
    onRun,
    onOpenStep,
    onBack,
    onNew,
}) {
    const tools = toolsFor(workpiece);
    const runs = steps.reduce((m, s) => {
        m[s.op] = (m[s.op] || 0) + 1;
        return m;
    }, {});

    return (
        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
            <Piece workpiece={workpiece} onBack={onBack} />

            <section>
                <div className="flex items-baseline gap-2 mb-2.5">
                    <h2 className="font-display font-extrabold text-foreground text-base">
                        {steps.length ? "What else" : "What do you want done to it"}
                    </h2>
                    <span className="flex-1 h-px bg-border" />
                </div>
                {/* NOTHING APPLIES IS A REAL ANSWER and it is said rather than
                    drawn as an empty grid. It can only happen for a kind the
                    model does not know, which `makeWorkpiece` already refuses —
                    so this is the belt rather than the braces. */}
                {tools.length ? (
                    <div className="grid sm:grid-cols-2 gap-2.5">
                        {tools.map((op, i) => (
                            <ToolButton
                                key={op.id}
                                op={op}
                                lead={i === 0}
                                done={runs[op.id] || 0}
                                busy={busy}
                                onRun={onRun}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Nothing on the bench fits this one. Start it again as a different kind.
                    </p>
                )}
            </section>

            {steps.length > 0 && (
                <section>
                    <div className="flex items-baseline gap-2 mb-2.5">
                        <h2 className="font-display font-extrabold text-foreground text-base">
                            Done so far
                        </h2>
                        <span className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2">
                        {steps.map((s, i) => (
                            <StepRow key={s.id} step={s} index={i} onOpen={onOpenStep} />
                        ))}
                    </div>
                </section>
            )}

            {onNew && (
                <button
                    type="button"
                    onClick={onNew}
                    className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground
                        hover:text-foreground transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Work on something else
                </button>
            )}
        </div>
    );
}

export { Piece, ToolButton, StepRow };
