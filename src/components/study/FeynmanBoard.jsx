/**
 * FeynmanBoard — the blackboard you explain it on.
 *
 * ─── IT IS A BLACKBOARD BECAUSE THAT IS WHAT THE TECHNIQUE LOOKS LIKE ───────
 * Feynman's whole iconography is a board and a piece of chalk, and this app
 * already owns a blackout: a literal `#0A121F` ground with literal white ink,
 * in BOTH themes, written for the pomodoro and blurting. A token that flips
 * underneath a deliberate inversion is the bug rather than the fix — focus
 * mode's own lesson — so the ink here is literal too.
 *
 * Nothing sits beside the writing surface. The science rail folds away on every
 * other technique for exactly this reason; here there is nothing to fold.
 *
 * ─── THE RIBBON IS FREE, AND IT MAY NOT CLAIM WHAT ONLY THE MODEL KNOWS ─────
 * The subject's own `keyTerms` light up as they are used. That is a FACT and
 * it is computed locally, so it costs nothing and cannot be wrong.
 *
 * What it must never do is turn a term green for looking "explained nearby".
 * That would be a window heuristic over definitional cues, wrong constantly,
 * and wrong in the direction that tells a student their hand-wave was fine. A
 * term goes green only once a PASS has run and did not raise it — so before the
 * first check everything used is amber, which is the honest state: unproven.
 */
import React, { useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, ArrowRight, Check } from "lucide-react";
import { jargonUsed, readingLevel, readyToCheck, audienceOf } from "@/lib/feynman";

/** Literal ink. See the header — this ground must never follow the theme. */
const BOARD = "#0A121F";
const CHALK = "rgba(255,255,255,0.92)";
const CHALK_DIM = "rgba(255,255,255,0.45)";
const CHALK_FAINT = "rgba(255,255,255,0.14)";

export default function FeynmanBoard({
    value,
    onChange,
    terms = [],
    audience = "classmate",
    topic = "",
    // Terms a pass has already cleared. Before any pass this is empty, which is
    // the honest state rather than an optimistic one.
    cleared = [],
    // The open questions, pinned beside the board on a rewrite. This is what
    // makes the second draft a LOOP rather than a blank page again.
    pinned = [],
    onPinnedToggle = null,
    focus = false,
    onToggleFocus = null,
    onCheck,
    busy = false,
    checkLabel = "Find the gaps",
    priceLabel = "",
}) {
    const ref = useRef(null);
    const used = useMemo(() => jargonUsed(value, terms), [value, terms]);
    const level = useMemo(() => readingLevel(value), [value]);
    const ready = useMemo(() => readyToCheck(value), [value]);
    const who = audienceOf(audience);
    const clearedSet = useMemo(() => new Set(cleared), [cleared]);

    // The caret belongs on the board the moment it opens. A writing surface
    // that needs to be clicked first has asked for a step before the step.
    useEffect(() => { ref.current?.focus(); }, [focus]);

    const board = (
        <div className="h-full flex flex-col min-h-0" style={{ background: BOARD }}>
            {/* ── Header: what you are explaining, and to whom ────────────── */}
            <div className="flex items-start gap-3 px-4 sm:px-6 pt-4 pb-3 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: CHALK_DIM }}>
                        Explain it to {who.short}
                    </p>
                    <p className="font-display font-extrabold text-lg sm:text-xl leading-tight line-clamp-2"
                        style={{ color: CHALK }}>
                        {topic || "In your own words"}
                    </p>
                </div>
                {onToggleFocus && (
                    <button
                        type="button"
                        onClick={onToggleFocus}
                        className="flex-shrink-0 rounded-xl p-2 transition-colors"
                        style={{ color: CHALK_DIM }}
                        aria-label={focus ? "Leave focus mode" : "Focus mode"}
                    >
                        {focus ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 lg:gap-4 px-4 sm:px-6 pb-4">
                {/* ── The surface ─────────────────────────────────────────── */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <textarea
                        ref={ref}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={`Start anywhere. Say it the way you would out loud.`}
                        spellCheck="true"
                        className="flex-1 min-h-[14rem] w-full resize-none bg-transparent
                            outline-none focus-visible:outline-none
                            focus-visible:ring-1 focus-visible:ring-white/20 rounded-lg
                            text-[15px] sm:text-base leading-relaxed tracking-[0.01em]"
                        style={{ color: CHALK, caretColor: "#58CC02" }}
                    />
                    {/* ── The one honest reading, and it says "reads like" ─── */}
                    <div className="flex items-center gap-3 pt-2 flex-shrink-0">
                        <div className="h-px flex-1" style={{ background: CHALK_FAINT }} />
                        <p className="text-[11px] tabular-nums" style={{ color: CHALK_DIM }}>
                            {level
                                ? `${ready.words} words · reads like Year ${level.year}`
                                : ready.words > 0
                                    ? `${ready.words} word${ready.words === 1 ? "" : "s"}`
                                    : ""}
                        </p>
                    </div>
                </div>

                {/* ── The ribbon ──────────────────────────────────────────── */}
                {(used.length > 0 || pinned.length > 0) && (
                    <aside className="lg:w-56 flex-shrink-0 pt-4 lg:pt-0 space-y-4 overflow-y-auto">
                        {pinned.length > 0 && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                                    style={{ color: CHALK_DIM }}>
                                    Still to answer
                                </p>
                                <ul className="space-y-1.5">
                                    {pinned.map((g) => (
                                        <li key={g.id}>
                                            <button
                                                type="button"
                                                onClick={() => onPinnedToggle?.(g.id)}
                                                className="w-full text-left flex items-start gap-2 text-[12px] leading-snug"
                                                style={{ color: g.closed ? CHALK_DIM : CHALK }}
                                            >
                                                <span
                                                    className="mt-0.5 w-3.5 h-3.5 rounded-full border flex-shrink-0
                                                        flex items-center justify-center"
                                                    style={{
                                                        borderColor: g.closed ? "#58CC02" : CHALK_DIM,
                                                        background: g.closed ? "#58CC02" : "transparent",
                                                    }}
                                                >
                                                    {g.closed && <Check className="w-2.5 h-2.5" style={{ color: BOARD }} />}
                                                </span>
                                                <span className={g.closed ? "line-through" : ""}>{g.ask}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {used.length > 0 && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                                    style={{ color: CHALK_DIM }}>
                                    Terms you leaned on
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {used.map((t) => {
                                        const ok = clearedSet.has(t);
                                        return (
                                            <motion.span
                                                key={t}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="rounded-lg px-2 py-0.5 text-[11px] font-bold border"
                                                style={{
                                                    color: ok ? "#58CC02" : "#FFC800",
                                                    borderColor: ok ? "rgba(88,204,2,0.4)" : "rgba(255,200,0,0.35)",
                                                    background: ok ? "rgba(88,204,2,0.10)" : "rgba(255,200,0,0.08)",
                                                }}
                                            >
                                                {t}
                                            </motion.span>
                                        );
                                    })}
                                </div>
                                {/* It states the fact and asks the question. It does
                                    NOT say these are unexplained — only a pass knows. */}
                                <p className="text-[11px] leading-snug mt-2" style={{ color: CHALK_DIM }}>
                                    Would {who.short} know what {used.length === 1 ? "that means" : "these mean"}?
                                </p>
                            </div>
                        )}
                    </aside>
                )}
            </div>

            {/* ── The one button ──────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 sm:px-6 pb-4 flex-shrink-0">
                <Button
                    onClick={onCheck}
                    disabled={!ready.ok || busy}
                    className="bg-berry hover:bg-berry/90 text-white gap-2 font-bold"
                >
                    {checkLabel} <ArrowRight className="w-4 h-4" />
                </Button>
                {/* A DISABLED BUTTON SAYS WHY, and the price is on screen before
                    it is spent — the rule megaUpload keeps. */}
                <p className="text-[11px] leading-snug" style={{ color: CHALK_DIM }}>
                    {!ready.ok
                        ? `${ready.need} more word${ready.need === 1 ? "" : "s"} and it has something to read`
                        : priceLabel}
                </p>
            </div>
        </div>
    );

    // ── FOCUS IS THE SAME BOARD, EDGE TO EDGE ───────────────────────────────
    // Not a different screen: the student is mid-sentence when they press it,
    // so a layout that re-flows under them loses their place. Same component,
    // same ground, the window grows.
    if (focus) {
        return <div className="fixed inset-0 z-[10000]" style={{ background: BOARD }}>{board}</div>;
    }
    return (
        <div className="rounded-3xl overflow-hidden shadow-soft-lg min-h-[32rem] flex flex-col"
            style={{ background: BOARD }}>
            {board}
        </div>
    );
}
