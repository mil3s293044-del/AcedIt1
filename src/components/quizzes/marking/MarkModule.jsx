/**
 * MarkModule — one mark, and everything a student can do about it.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * The criteria used to be one-line rows and everything actionable — what the
 * assessor wanted, what would have scored, save this to your bank — lived
 * inside a popover that appeared on HOVER over an underlined phrase. Two
 * things followed from that, and both were bad.
 *
 * A mark with no phrase to underline had nowhere to put its explanation. Those
 * are not edge cases; they are the most important marks on the page. "Does not
 * name the transfer" cannot be underlined precisely because the words are
 * absent, so the marks a student most needed explaining were the ones that got
 * a single line and no way to save them.
 *
 * And an action inside a hover popover is an action you have to catch. The
 * note was portalled to the body, so moving the pointer off the phrase toward
 * the button left the phrase and closed the note. You could see the button and
 * not reach it, which is exactly what "glitchy, and I kept hovering to save"
 * describes.
 *
 * So the content moved OUT of the hover and into a block that is simply on the
 * screen. Hover now does one job — point at which mark a phrase belongs to —
 * and nothing you need is behind it.
 *
 * ─── Open by default when it cost you ───────────────────────────────────────
 * A dropped mark is why the student is on this screen; it is open. A mark they
 * earned collapses to its tick, because "yes, that was fine" is a thing to
 * confirm at a glance and not to read. Nothing is hidden that costs marks.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, X, AlertTriangle, Plus, ChevronDown } from "lucide-react";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { isBankable } from "@/lib/quizMarking";

/** Static class lookups — Tailwind cannot see a class assembled at runtime. */
const STATUS = {
    lost: {
        icon: X,
        chip: "bg-streak",
        ring: "border-streak/30 bg-streak/5",
        label: "text-streak",
        // The cost, said the way an assessor writes it in the margin.
        cost: (n) => `−${n} mark${n === 1 ? "" : "s"}`,
    },
    earned: {
        icon: Check,
        chip: "bg-primary",
        ring: "border-primary/20 bg-primary/5",
        label: "text-primary",
        cost: (n) => `+${n} mark${n === 1 ? "" : "s"}`,
    },
    risk: {
        icon: AlertTriangle,
        chip: "bg-xp",
        ring: "border-xp/25 bg-xp/5",
        label: "text-xp",
        // The honest version of what this is. It is NOT costing them a mark,
        // and the old panel said it was — see quizMarking's header.
        cost: () => "no marks lost",
    },
};

export default function MarkModule({ mod, index, banked, saving, onBank, onPoint, flash }) {
    const reduce = useReducedMotion();
    const s = STATUS[mod.status] || STATUS.risk;
    const Icon = s.icon;
    const [open, setOpen] = useState(mod.status !== "earned");

    // Jumping here from a phrase in the answer must land on the CONTENT. An
    // earned mark is collapsed by default, and following its underline to a
    // closed header is a dead end — the pointer promised something to read.
    useEffect(() => { if (flash) setOpen(true); }, [flash]);
    const bankable = isBankable(mod);
    const hasBody = Boolean(mod.wanted || mod.detail || mod.fixes.length || mod.evidence.length || bankable);

    return (
        <motion.li
            data-mark-module={mod.id}
            data-status={mod.status}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.3) }}
            className={`rounded-2xl border-2 overflow-hidden transition-shadow ${s.ring}
                ${flash ? "ring-2 ring-ring shadow-soft-lg" : ""}`}
        >
            {/* The header is the ledger line: what was wanted, and what it cost.
                It stays readable on its own — a student scrolling the list is
                reading these and nothing else. */}
            <button
                type="button"
                onClick={() => hasBody && setOpen((v) => !v)}
                aria-expanded={hasBody ? open : undefined}
                className={`w-full flex items-start gap-2.5 text-left px-3 py-2.5
                    ${hasBody ? "cursor-pointer" : "cursor-default"}`}
            >
                <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${s.chip}`}>
                    <Icon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                    <MarkdownMath className="text-sm font-bold text-foreground leading-snug">
                        {mod.text}
                    </MarkdownMath>
                    <span className={`text-[11px] font-black tabular-nums ${s.label}`}>
                        {s.cost(mod.worth)}
                    </span>
                </span>
                {hasBody && (
                    <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5
                        transition-transform ${open ? "rotate-180" : ""}`} />
                )}
            </button>

            <AnimatePresence initial={false}>
                {open && hasBody && (
                    <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 pt-0.5 space-y-2.5 border-t border-border/60 mt-0.5">
                            {/* What the assessor was looking for. The issue says
                                what went wrong; this says what would have earned
                                it, which is the half a student cannot work out
                                on their own. */}
                            {mod.wanted && (
                                <div className="rounded-xl border-l-2 border-border pl-2.5 pt-1.5">
                                    <p className="stat-label text-muted-foreground">The assessor wanted</p>
                                    <MarkdownMath className="text-sm text-foreground leading-snug mt-0.5">
                                        {mod.wanted}
                                    </MarkdownMath>
                                </div>
                            )}

                            {mod.detail && mod.detail !== mod.wanted && (
                                <MarkdownMath className="text-sm text-muted-foreground leading-relaxed">
                                    {mod.detail}
                                </MarkdownMath>
                            )}

                            {/* Where it shows in their own words. The quote is a
                                button: it scrolls the underlined phrase into
                                view and flashes it, so the module and the
                                marked answer below are one thing rather than
                                two lists of the same findings. */}
                            {mod.evidence.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="stat-label text-muted-foreground">In your answer</p>
                                    {mod.evidence.map((a) => (
                                        <button key={a.id} type="button"
                                            onClick={() => onPoint?.(a)}
                                            className="block w-full text-left rounded-xl bg-secondary/50 border border-border
                                                px-2.5 py-1.5 hover:border-ring transition-colors cursor-pointer">
                                            <span className={`text-sm text-foreground italic underline decoration-wavy
                                                decoration-2 underline-offset-4
                                                ${mod.status === "lost" ? "decoration-streak" : "decoration-xp"}`}>
                                                “{a.quote}”
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {mod.fixes.length > 0 && (
                                <div className="rounded-xl bg-primary/5 border border-primary/20 px-2.5 py-2">
                                    <p className="stat-label text-primary">
                                        {mod.fixes.length === 1 ? "Instead" : "Either of these"}
                                    </p>
                                    <ul className="mt-1 space-y-1.5">
                                        {mod.fixes.map((f, i) => (
                                            <li key={i} className="flex gap-2">
                                                {mod.fixes.length > 1 && (
                                                    <span aria-hidden="true"
                                                        className="text-primary font-black text-xs mt-0.5">·</span>
                                                )}
                                                <MarkdownMath className="text-sm text-foreground leading-snug flex-1 min-w-0">
                                                    {f}
                                                </MarkdownMath>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Always here for a mark that was lost, quote or no
                                quote. This is the button that did not exist for
                                three quarters of a student's mistakes. */}
                            {bankable && onBank && (
                                <button type="button"
                                    onClick={() => onBank(mod)}
                                    disabled={banked || saving}
                                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-border
                                        px-2.5 py-1 text-xs font-bold text-foreground hover:border-primary/50
                                        disabled:opacity-60 disabled:cursor-default cursor-pointer transition-colors">
                                    {banked
                                        ? <><Check className="w-3.5 h-3.5 text-primary" /> In your mistake bank</>
                                        : saving
                                            ? <>Saving…</>
                                            : <><Plus className="w-3.5 h-3.5" /> Save this mistake</>}
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.li>
    );
}
