/**
 * YearBar — a study score as one bar, in the order of the year.
 *
 * The page it replaces listed four assessments as four grey boxes with a
 * percentage each, so "how much of this is decided in the exam" was an
 * addition the student had to do. That is the question somebody choosing a
 * subject actually has, so it is the sentence over the bar, and the bar
 * answers it at a glance: the school-assessed half drawn light, the exams
 * drawn solid, a component that is neither hatched (see `assessKind`).
 * Lightness AND hatching carry the kind, so it survives greyscale.
 *
 * ─── The animation is the reading order ─────────────────────────────────────
 * The segments grow left to right in turn, which is the order the year
 * happens in, and the two brackets under them arrive once the bar is full —
 * the parts first, then what they add up to. Under reduced motion it is
 * simply drawn.
 *
 * ─── Pointing goes both ways ────────────────────────────────────────────────
 * A segment and its row are one thing: pointing at either lifts the other.
 * Tapping a segment on a phone selects it (there is no hover there), and
 * tapping it again lets go.
 */
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { alpha } from "@/components/cards/PlayingCard";

const KIND_LABEL = { school: "At school", exam: "In the exams", other: "Assessed tasks" };

/** The fill for a kind, in the subject's own colour. */
export function kindFill(kind, hex) {
    if (kind === "exam") return { background: hex };
    if (kind === "other") {
        return {
            backgroundColor: alpha(hex, 0.55),
            backgroundImage: `repeating-linear-gradient(135deg, ${alpha("#FFFFFF", 0.32)} 0 3px, transparent 3px 8px)`,
        };
    }
    return { background: alpha(hex, 0.38) };
}

/**
 * The ink for a figure printed ON a solid segment. Half the palette is light
 * (amber, sky, emerald, teal), and white on amber is about 2:1, so the ink is
 * whichever of white and near-black has the higher contrast against the hex.
 */
export function inkOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return "#FFFFFF";
    const n = parseInt(m[1], 16);
    const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    const onWhite = 1.05 / (L + 0.05);
    const onDark = (L + 0.05) / 0.0625; // #111827-ish
    return onDark > onWhite ? "#111827" : "#FFFFFF";
}

/** Contiguous runs of one kind, for the brackets under the bar. */
function runsOf(parts) {
    const runs = [];
    for (const p of parts) {
        const last = runs[runs.length - 1];
        if (last && last.kind === p.kind) {
            last.width += p.width;
            last.percentage += p.percentage;
        } else {
            runs.push({ kind: p.kind, start: p.start, width: p.width, percentage: p.percentage });
        }
    }
    return runs;
}

export default function YearBar({ bar, hex, rows = true, compact = false, delay = 0 }) {
    const reduce = useReducedMotion();
    const [lit, setLit] = useState(null);       // hover / focus
    const [picked, setPicked] = useState(null); // a tap, for touch
    if (!bar?.parts?.length) return null;
    const active = lit ?? picked;
    const step = compact ? 0.06 : 0.12;
    const fillDone = delay + 0.15 + bar.parts.length * step + 0.35;
    const runs = runsOf(bar.parts);

    return (
        <div data-year-bar>
            {/* ── The bar ─────────────────────────────────────────────── */}
            <div className={`relative w-full ${compact ? "h-7" : "h-11"} rounded-xl bg-secondary/70 overflow-hidden`}
                role="img" aria-label={bar.lead || "How the study score is assessed"}>
                {bar.parts.map((p, i) => {
                    const dim = active != null && active !== i;
                    return (
                        <motion.button key={`${p.component}-${i}`} type="button"
                            data-segment={i} data-kind={p.kind}
                            aria-label={`${p.component}, ${p.percentage}%`}
                            onPointerEnter={(e) => { if (e.pointerType === "mouse") setLit(i); }}
                            onPointerLeave={(e) => { if (e.pointerType === "mouse") setLit(null); }}
                            onFocus={() => setLit(i)} onBlur={() => setLit(null)}
                            onClick={() => setPicked((v) => (v === i ? null : i))}
                            className="absolute inset-y-0 flex items-center justify-center focus:outline-none
                                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset cursor-pointer"
                            style={{ left: `${p.start}%`, width: `${p.width}%`, transformOrigin: "left center" }}
                            initial={reduce ? false : { scaleX: 0 }}
                            animate={{ scaleX: 1, opacity: dim ? 0.35 : 1 }}
                            transition={{
                                scaleX: { duration: 0.42, delay: delay + 0.15 + i * step, ease: [0.22, 1, 0.36, 1] },
                                opacity: { duration: 0.15 },
                            }}>
                            {/* A hairline between parts, in the page's own ground,
                                so two parts of one kind still read as two. */}
                            <span className="absolute inset-y-0 left-0 right-[2px] rounded-[6px]" style={kindFill(p.kind, hex)} />
                            {/* The figure arrives once its segment has grown, so it
                                is never drawn squashed by the scale it rides on. */}
                            {!compact && p.width >= 11 && (
                                <motion.span
                                    initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2, delay: reduce ? 0 : delay + 0.15 + i * step + 0.3 }}
                                    className={`relative z-10 font-display font-extrabold text-[13px] tabular-nums
                                        ${p.kind === "exam" ? "" : "text-foreground"}`}
                                    style={p.kind === "exam" ? { color: inkOn(hex) } : undefined}>
                                    {p.percentage}%
                                </motion.span>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* ── What the runs add up to ─────────────────────────────── */}
            <div className={`relative ${compact ? "h-5 mt-1" : "h-7 mt-1.5"}`} aria-hidden="true">
                {runs.map((r) => (
                    <motion.div key={`${r.kind}-${r.start}`} className="absolute top-0"
                        style={{ left: `${r.start}%`, width: `${r.width}%` }}
                        initial={reduce ? false : { opacity: 0, y: -3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: reduce ? 0 : fillDone }}>
                        <div className="mx-[3px] h-1.5 border-x border-b border-muted-foreground/40 rounded-b-[3px]" />
                        <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-bold text-muted-foreground mt-0.5 truncate px-0.5`}>
                            {KIND_LABEL[r.kind]} <span className="tabular-nums text-foreground">{r.percentage}%</span>
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* ── The parts, as rows ──────────────────────────────────── */}
            {rows && (
                <ul className="mt-3 divide-y divide-border/70">
                    {bar.parts.map((p, i) => (
                        <li key={`${p.component}-${i}`} data-part-row={i}
                            onPointerEnter={(e) => { if (e.pointerType === "mouse") setLit(i); }}
                            onPointerLeave={(e) => { if (e.pointerType === "mouse") setLit(null); }}
                            className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg transition-colors
                                ${active === i ? "bg-secondary/80" : ""}`}>
                            <span className="w-3 h-3 rounded-[4px] flex-shrink-0" style={kindFill(p.kind, hex)} aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-foreground leading-tight">
                                    {p.component}
                                    {p.heaviest && bar.parts.length > 1 && (
                                        <span className="ml-2 align-middle pill bg-foreground/[0.06] text-muted-foreground text-[10px] py-0">
                                            most marks
                                        </span>
                                    )}
                                </span>
                                {p.description && (
                                    <span className="block text-[12px] text-muted-foreground mt-0.5">{p.description}</span>
                                )}
                            </span>
                            <span className="font-display font-extrabold text-lg tabular-nums text-foreground flex-shrink-0">
                                {p.percentage}%
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {/* Said out loud rather than scaled to fit — `markSplit`'s rule. */}
            {rows && bar.total !== 100 && (
                <p className="text-[11px] text-muted-foreground/70 mt-2">
                    These add to {bar.total}% — the rest is not in our catalogue.
                </p>
            )}
        </div>
    );
}
