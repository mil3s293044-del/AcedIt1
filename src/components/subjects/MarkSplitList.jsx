/**
 * MarkSplitList — a subject's assessments, heaviest first, with their share of
 * the study score.
 *
 * Drawn by the subject hub AND the subject's guide. Two drawings of one split
 * is two places a weight can be printed differently, and the split is the one
 * number on either screen a student plans a term around. `split` is always
 * `markSplit`'s output, so the arithmetic is shared as well as the picture.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function MarkSplitList({ split, hex }) {
    const reduce = useReducedMotion();
    if (!split?.parts?.length) return null;
    const first = split.parts[0];
    const last = split.parts[split.parts.length - 1];
    return (
        <div>
            {split.parts.length > 1 && last.percentage < first.percentage && (
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                    VCAA&apos;s split for this subject, heaviest first. Revising the
                    {" "}{last.percentage}% before the
                    {" "}{first.percentage}% is the trade nobody means to make.
                </p>
            )}
            <ul className="space-y-3">
                {split.parts.map((p) => (
                    <li key={p.component}>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[13px] font-bold text-foreground truncate">
                                {p.component}
                            </span>
                            <span className="text-[12px] font-bold tabular-nums text-muted-foreground flex-shrink-0">
                                {p.percentage}%
                            </span>
                        </div>
                        <span className="block h-1.5 rounded-full bg-secondary overflow-hidden mt-1">
                            <motion.span className="block h-full rounded-full"
                                style={{ background: hex }}
                                initial={reduce ? false : { width: 0 }}
                                animate={{ width: `${p.percentage}%` }}
                                transition={{ duration: 0.6 }} />
                        </span>
                        {p.description && (
                            <span className="block text-[11px] text-muted-foreground/70 mt-1">
                                {p.description}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
            {/* Said out loud rather than scaled to fit. A study design whose
                components do not add to 100 is a fact about the data, not
                something to paper over. */}
            {split.total !== 100 && (
                <p className="text-[11px] text-muted-foreground/60 mt-3">
                    These add to {split.total}% — the rest is not in our catalogue.
                </p>
            )}
        </div>
    );
}
