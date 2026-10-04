/**
 * Readout — the scan result: what is wrong, where, and the tool that fixes it.
 *
 * ─── THE TRACE IS THE PROGRESS BAR ──────────────────────────────────────────
 * A hairline runs down the left of the findings and breaks out at 90° into
 * each one — a bus with branches, which is what makes this read as
 * instrumentation rather than as a list of tips. Each row owns its own
 * segment, so the line turns GREEN from the top as findings clear and the
 * student watches it run clean. That is "fix it until the whole thing is
 * resolved" drawn once, rather than a list plus a separate percentage bar
 * saying the same thing twice.
 *
 * ─── IT IS ROWS, NOT CALLOUTS, AND THAT IS WHY IT WORKS ON A PHONE ──────────
 * The obvious drawing is an engineering callout: a leader line from a phrase,
 * up, then out to a floating label. At 390px there is no margin for the label
 * to float in, and half this app's traffic is phones. Worse, a callout can only
 * exist where there is something to point AT — and the strongest findings are
 * the unquotable ones, because "never names the mechanism" is unquotable
 * precisely in that the words are absent. That is the failure `MarkModule` was
 * rebuilt to end. So the row HOLDS and the underline POINTS, and a finding with
 * nothing to point at loses only its underline.
 *
 * ─── NO THIRD ROOM ──────────────────────────────────────────────────────────
 * A terminal-green-on-black diagnostic panel was the tempting version. The
 * Compete floor earns its own palette by being somewhere else; a third one is a
 * third set of tokens to keep in sync and `floorInk.test.mjs` exists because
 * every way to break that is silent. High-tech here comes from PRECISION — a
 * mono fault code, hairlines, tick marks, one sweep on arrival — in the app's
 * own tokens, both themes.
 *
 * ─── AND SHAPE CARRIES THE STATE, not only colour ───────────────────────────
 * Open and cleared are the streak red and the brand green, which sit at ΔE 7.0
 * under deuteranopia — the floor's step-dot lesson. So an open node is a HOLLOW
 * RING and a cleared one is FILLED WITH A TICK, which reads at 8px with no
 * colour at all.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Coins, RotateCw, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toolById } from "@/components/ai_tools/chatTools";
import { priceLabel } from "@/lib/chips";
import { FAULTS, markedSegments, progressOf, SCAN_FEATURE, SCAN_MODEL_LABEL } from "@/lib/diagnostic";

const rowId = (key) => `finding-${String(key).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

/* ── The work, with what the scan pointed at ─────────────────────────────── */

/**
 * The student's own text, underlined where a finding anchored.
 *
 * Rendered as PLAIN TEXT rather than through `MarkdownMath`, which is the one
 * deliberate exception to this app's rule about printing questions as maths:
 * the underlines are character offsets into the raw string, and a markdown
 * renderer rebuilds the DOM around its own nodes, so the two cannot both be
 * true of the same span. What is drawn is exactly what the scan read.
 */
function WorkPanel({ work, findings, focus, onFocus }) {
    const segments = useMemo(() => markedSegments(work, findings), [work, findings]);
    if (!work) return null;

    return (
        <div className="rounded-2xl border-2 border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/60">
                <span className="stat-label text-muted-foreground">What was scanned</span>
                <span className="flex-1 h-px bg-border" />
            </div>
            <div className="px-4 py-3 max-h-64 overflow-y-auto">
                <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap select-text">
                    {segments.map((seg, i) => (
                        seg.key ? (
                            <button
                                key={i}
                                type="button"
                                onClick={() => onFocus?.(seg.key)}
                                className={`text-left underline decoration-2 underline-offset-4 transition-colors
                                    ${seg.cleared
                                        ? "decoration-primary/60 text-foreground"
                                        : "decoration-streak text-foreground"}
                                    ${focus === seg.key ? "bg-xp/20 rounded-sm" : "hover:bg-secondary"}`}
                            >
                                {seg.text}
                            </button>
                        ) : <span key={i}>{seg.text}</span>
                    ))}
                </p>
            </div>
        </div>
    );
}

/* ── One finding, on the trace ───────────────────────────────────────────── */

function Finding({ finding, index, last, focus, onFocus, onRepair, onClear, busy }) {
    const tool = toolById(finding.tool);
    const Glyph = tool?.icon;
    const open = !finding.cleared;
    const lit = focus === finding.key;

    // THE GAP BETWEEN ROWS IS PADDING, NOT MARGIN. The trace spans this
    // element's box and a margin sits OUTSIDE it, so with `mb-2` on the card
    // the line broke into one dash per row and stopped reading as a bus at all.
    return (
        <li id={rowId(finding.key)} className="relative pl-7 pb-2">
            {/* THE TRACE. The vertical segment belongs to this row, so the line
                recolours as this row clears — the whole reason there is no
                separate progress bar. The last row's segment stops AT the node
                rather than running past it, or the bus hangs off the end. */}
            <span
                aria-hidden="true"
                className={`absolute left-[3px] w-[2px] transition-colors duration-300
                    ${last ? "top-0 h-[22px]" : "top-0 bottom-0"}
                    ${finding.cleared ? "bg-primary" : "bg-streak"}`}
            />
            {/* The 90° elbow out of the bus into the row. */}
            <span
                aria-hidden="true"
                className={`absolute left-[3px] top-[21px] h-[2px] w-3 transition-colors duration-300
                    ${finding.cleared ? "bg-primary" : "bg-streak"}`}
            />
            {/* The node. Filled + ticked when cleared, a hollow ring when open —
                shape, so it survives greyscale and deuteranopia. */}
            <span
                aria-hidden="true"
                className={`absolute left-0 top-[16px] w-2 h-2 rounded-full border-2 transition-colors duration-300
                    ${finding.cleared
                        ? "border-primary bg-primary"
                        : "border-streak bg-surface"}`}
            />

            <div className={`rounded-xl border-2 px-3 py-2.5 transition-colors
                ${lit ? "border-xp bg-xp/5"
                    : finding.cleared ? "border-border bg-surface/60" : "border-border bg-surface"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-[11px] font-bold tracking-widest px-1.5 py-0.5 rounded
                        ${finding.cleared ? "bg-primary/10 text-primary" : "bg-streak/10 text-streak"}`}>
                        {finding.code}
                    </span>
                    {/* NOT `line-through`. A rule drawn through "Command term"
                        crosses the SPACE as well, and at 13px that reads as
                        "Command-term" — a hyphen the app appears to have
                        invented. The node and the code chip already say it is
                        cleared; the label only has to go quiet. */}
                    <span className={`text-sm font-bold ${finding.cleared ? "text-muted-foreground" : "text-foreground"}`}>
                        {finding.label}
                    </span>
                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                </div>

                <p className={`text-[13px] leading-snug mt-1.5 ${finding.cleared ? "text-muted-foreground" : "text-foreground"}`}>
                    {finding.says}
                </p>

                {/* WHAT WOULD HAVE SCORED, and only ever that. `MarkModule`
                    records the version where this fell back to the criticism,
                    so a block headed "what the assessor wanted" printed what
                    went wrong — telling the student to write the diagnosis. */}
                {finding.wanted && (
                    <p className="text-[13px] leading-snug mt-1.5 text-muted-foreground">
                        <span className="font-bold text-foreground">What scores: </span>
                        {finding.wanted}
                    </p>
                )}

                {finding.anchor && (
                    <button
                        type="button"
                        onClick={() => onFocus?.(finding.key)}
                        className="block mt-1.5 text-[12px] italic text-muted-foreground hover:text-foreground
                            underline decoration-dotted underline-offset-2 text-left"
                    >
                        “{finding.anchor.quote}”
                    </button>
                )}

                {open && (
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <Button
                            size="sm" disabled={busy} onClick={() => onRepair?.(finding)}
                            className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-1.5 h-8 text-xs font-bold"
                        >
                            {Glyph ? <Glyph className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                            {tool?.label || "Repair"}
                        </Button>
                        <span className="text-[11px] font-bold text-muted-foreground inline-flex items-center gap-1">
                            <Coins className="w-3 h-3" aria-hidden="true" />
                            {priceLabel(tool?.feature || "ai_chat")}
                        </span>
                        {/* THE STUDENT CLEARS IT, never the tool. drill.js makes
                            the identical call about a rating: whether they
                            actually understand it now is the one judgement only
                            they can make. */}
                        <button
                            type="button" onClick={() => onClear?.(finding.key, true)}
                            className="ml-auto text-[11px] font-bold text-muted-foreground hover:text-primary
                                inline-flex items-center gap-1 transition-colors"
                        >
                            <Check className="w-3.5 h-3.5" /> Cleared
                        </button>
                    </div>
                )}

                {finding.cleared && (
                    <button
                        type="button" onClick={() => onClear?.(finding.key, false)}
                        className="block mt-2 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Put it back
                    </button>
                )}
            </div>
        </li>
    );
}

/* ── The whole readout ───────────────────────────────────────────────────── */

export default function Readout({
    work,
    subject = null,
    findings = [],
    busy = false,
    onRepair,
    onClear,
    onRescan,
    onNew,
}) {
    const [focus, setFocus] = useState(null);
    const reduce = useReducedMotion();
    const swept = useRef(false);
    const p = progressOf(findings);

    const focusOn = (key) => {
        setFocus(key);
        document.getElementById(rowId(key))?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // ONE SWEEP, ON ARRIVAL. A loop that keeps running is a thing moving on
    // screen while somebody reads, which is the rule `PriceTick` keeps about
    // never animating on first paint for the opposite reason.
    const sweep = !reduce && !swept.current && findings.length > 0;
    if (findings.length > 0) swept.current = true;

    return (
        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
            <div>
                <p className="stat-label text-muted-foreground mb-1 font-mono tracking-widest">
                    SCAN{subject ? ` · ${subject}` : ""} · {SCAN_MODEL_LABEL}
                </p>
                <div className="flex items-baseline gap-3 flex-wrap">
                    <h2 className="font-display font-extrabold text-foreground text-xl leading-tight">
                        {p.total === 0
                            ? "No faults found"
                            : p.allClear
                                ? "All clear"
                                : `${p.open} ${p.open === 1 ? "fault" : "faults"} open`}
                    </h2>
                    {p.total > 0 && (
                        <span className="text-[12px] font-bold text-muted-foreground tabular-nums">
                            {p.cleared} of {p.total} cleared
                        </span>
                    )}
                </div>
            </div>

            <WorkPanel work={work} findings={findings} focus={focus} onFocus={focusOn} />

            {/* ── CLEAN IS A REAL SCREEN ──────────────────────────────────────
                A scan that found nothing is the right answer often, and it has
                to look like a result rather than like the page failing to
                load. Nothing is padded to fill the space. */}
            {p.total === 0 ? (
                <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-5 text-center">
                    <ShieldCheck className="w-7 h-7 text-primary mx-auto mb-2" aria-hidden="true" />
                    <p className="font-display font-extrabold text-foreground">Nothing to fix here</p>
                    <p className="text-[13px] text-muted-foreground mt-1 leading-snug">
                        The scan found no faults it could name against the VCAA conventions for
                        {subject ? ` ${subject}` : " this subject"}. That is a result, not a shrug.
                    </p>
                </div>
            ) : (
                <div className="relative">
                    {sweep && (
                        <motion.div
                            aria-hidden="true"
                            initial={{ top: 0, opacity: 0.9 }}
                            animate={{ top: "100%", opacity: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="absolute left-0 w-10 h-10 -translate-y-1/2 pointer-events-none z-10
                                bg-gradient-to-b from-transparent via-xp/40 to-transparent rounded-full blur-md"
                        />
                    )}
                    <ul className="relative">
                        {findings.map((f, i) => (
                            <Finding
                                key={f.key}
                                finding={f}
                                index={i}
                                last={i === findings.length - 1}
                                focus={focus}
                                onFocus={focusOn}
                                onRepair={onRepair}
                                onClear={onClear}
                                busy={busy}
                            />
                        ))}
                    </ul>

                    <AnimatePresence>
                        {p.allClear && (
                            <motion.div
                                initial={reduce ? false : { opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative pl-7 pt-1"
                            >
                                <span aria-hidden="true"
                                    className="absolute left-0 top-1 w-2 h-2 rounded-full bg-primary" />
                                <p className="text-sm font-bold text-primary inline-flex items-center gap-1.5">
                                    <Check className="w-4 h-4" /> Every fault cleared
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <div className="flex items-center gap-3 flex-wrap pt-1">
                {/* RE-SCAN IS PROOF AND IS OPTIONAL. It re-checks only what is
                    still open and can never add a finding — which is what makes
                    the all-clear reachable at all. */}
                {p.total > 0 && p.open > 0 && onRescan && (
                    <>
                        <Button
                            size="sm" variant="outline" disabled={busy} onClick={onRescan}
                            className="border-2 border-border rounded-xl gap-1.5 h-8 text-xs font-bold"
                        >
                            <RotateCw className="w-3.5 h-3.5" /> Re-scan what is left
                        </Button>
                        <span className="text-[11px] font-bold text-muted-foreground inline-flex items-center gap-1">
                            <Coins className="w-3 h-3" aria-hidden="true" />
                            {priceLabel(SCAN_FEATURE)}
                        </span>
                    </>
                )}
                {onNew && (
                    <button
                        type="button" onClick={onNew}
                        className="ml-auto text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Scan something else
                    </button>
                )}
            </div>
        </div>
    );
}

export { WorkPanel, Finding, FAULTS };
