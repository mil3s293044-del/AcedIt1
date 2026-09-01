/**
 * MultipartQuestion — a stem, then (a), (b), (c), the way a VCAA paper reads.
 *
 * A real exam question sets up a situation once and then asks two or three
 * things about it, worth different marks and marked separately. A quiz that
 * can only hold one prompt and one answer per question cannot imitate that, so
 * students practise on a shape they will never sit.
 *
 * ─── Why this is a separate component rather than a rewrite ─────────────────
 * QuizPlayer branches on `type === 'mcq'` forty-one times and keys everything
 * off one answer per question. Teaching all of that about parts is how you
 * break scoring for the quizzes people already have. So the player branches
 * ONCE — multipart here, everything else down the path it always took — and
 * this owns the whole part-shaped screen.
 *
 * ─── The stem is context, not a question ────────────────────────────────────
 * It stays at the top, visually quieter than the parts, and it is never
 * numbered. Students answer parts; the stem is the thing they keep glancing
 * back at. On a phone it collapses after the first part is opened, because a
 * six-line stem plus three parts does not fit and the stem is the half you
 * have already read.
 *
 * ─── Answer keys ────────────────────────────────────────────────────────────
 * Every input writes to `part.key` from quizSchema — "3a", "3b" — and those
 * keys are what the marker and the attempt row see. A single-part question
 * never reaches this component, which is why its answers keep the bare index
 * that every attempt ever saved uses.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import MarkdownMath from "@/components/shared/MarkdownMath";
import InkPad from "@/components/quizzes/InkPad";
import ChoiceCard from "@/components/cards/ChoiceCard";
import MathText from "@/components/shared/LatexRenderer";

/** Type/Math/Write, per part rather than per question. */
const MODES = [["text", "Type"], ["ink", "Write"]];

function PartHeader({ part }) {
    return (
        <div className="flex items-baseline gap-2.5 mb-2">
            <span className="font-display font-black text-foreground text-lg leading-none w-6 flex-shrink-0">
                {part.label})
            </span>
            <div className="flex-1 min-w-0">
                <MarkdownMath className="text-base font-semibold text-foreground leading-snug">
                    {part.prompt}
                </MarkdownMath>
            </div>
            {/* Right-aligned in the gutter, the way a paper prints an
                allocation. It tells the student how much to write, which is
                most of what a mark allocation is for. */}
            <span className="text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap flex-shrink-0">
                {part.marks} mark{part.marks === 1 ? "" : "s"}
            </span>
        </div>
    );
}

export default function MultipartQuestion({
    question, answers = {}, onAnswer, subject,
    inkLines = {}, onInk, disabled = false,
}) {
    const [stemOpen, setStemOpen] = useState(true);
    const [modes, setModes] = useState({});

    return (
        <div className="space-y-5">
            {/* ── The stem ───────────────────────────────────────────────── */}
            {question.stem && (
                <div className="rounded-2xl bg-secondary/40 border-2 border-border overflow-hidden">
                    <button type="button" onClick={() => setStemOpen((v) => !v)}
                        aria-expanded={stemOpen}
                        className="w-full flex items-center gap-2 px-4 pt-3 pb-1 cursor-pointer sm:cursor-default"
                    >
                        <span className="stat-label text-muted-foreground">The question</span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto sm:hidden transition-transform
                            ${stemOpen ? "" : "-rotate-90"}`} />
                    </button>
                    <motion.div initial={false}
                        animate={{ height: stemOpen ? "auto" : 0, opacity: stemOpen ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <MarkdownMath className="px-4 pb-4 text-base sm:text-lg text-foreground leading-relaxed">
                            {question.stem}
                        </MarkdownMath>
                    </motion.div>
                </div>
            )}

            {/* ── The parts ──────────────────────────────────────────────── */}
            {question.parts.map((part) => {
                const value = answers[part.key];
                const mode = modes[part.key] || "text";
                return (
                    <div key={part.key} data-part={part.key}
                        className="rounded-2xl bg-surface border-2 border-border p-4">
                        <PartHeader part={part} />

                        {part.type === "mcq" ? (
                            <div className="space-y-2 mt-3">
                                {(part.options || []).map((option, i) => (
                                    <ChoiceCard key={i} index={i} count={part.options.length}
                                        state={String(value ?? "") === String(i) ? "selected" : "default"}
                                        disabled={disabled}
                                        onClick={() => !disabled && onAnswer?.(part.key, String(i))}>
                                        <MathText>{option}</MathText>
                                    </ChoiceCard>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2 mt-3">
                                <div className="flex items-center justify-end">
                                    <div role="radiogroup" aria-label={`How to answer part ${part.label}`}
                                        className="inline-flex rounded-xl border-2 border-border overflow-hidden">
                                        {MODES.map(([m, label]) => {
                                            const on = mode === m;
                                            return (
                                                <button key={m} type="button" role="radio" aria-checked={on}
                                                    onClick={() => setModes((p) => ({ ...p, [part.key]: m }))}
                                                    className={`px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors
                                                        ${on ? "bg-chart-3 text-white" : "text-muted-foreground hover:text-foreground"}`}>
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {mode === "ink" ? (
                                    <InkPad
                                        subject={subject}
                                        disabled={disabled}
                                        lines={inkLines[part.key] || []}
                                        onChange={(next) => {
                                            onInk?.(part.key, next);
                                            onAnswer?.(part.key, next.map((l) => `$$${l.latex}$$`).join("\n"));
                                        }}
                                    />
                                ) : (
                                    <Textarea
                                        value={value || ""}
                                        disabled={disabled}
                                        onChange={(e) => onAnswer?.(part.key, e.target.value)}
                                        aria-label={`Your answer to part ${part.label}`}
                                        placeholder={`Your answer to (${part.label})…`}
                                        /* Rows scale with the allocation: a two-mark
                                           part wants two or three lines, and a box
                                           the size of a six-mark answer tells the
                                           student to pad. */
                                        rows={Math.min(10, 2 + part.marks)}
                                        className="w-full rounded-xl border-2 border-border focus:border-chart-3"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
