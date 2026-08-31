/**
 * InkPad — write your working, get it typeset.
 *
 * For maths, typing is the wrong input. A student mid-derivation should not be
 * hunting for a fraction bar, and the existing MathInput — which is good — is
 * still a keyboard between them and the page.
 *
 * ─── One line at a time, and that is the whole design ───────────────────────
 * The obvious build is one big canvas you fill with working, and it is the one
 * that fails: handwriting sprawls, students write over their own lines, and by
 * the fourth step of a derivation the pad is a mess neither they nor a model
 * can read.
 *
 * So the pad holds ONE line. You write it, it is recognised, and it LIFTS off
 * the pad into the typeset stack above — where it is set properly, in order,
 * as maths — and the pad clears for the next step. Nothing accumulates on the
 * writing surface, so it never gets crowded, and what builds up instead is a
 * clean worked solution.
 *
 * ─── Recognition ────────────────────────────────────────────────────────────
 * Claude vision, over the upload path that already exists (UploadFile →
 * local-file:// → InvokeLLM with file_urls). No new dependency and nothing new
 * on the server. A small in-browser digit model was the alternative and it
 * would handle isolated digits and nothing else — no fractions, no roots, no
 * integrals, no superscripts — which is to say it would fail on exactly the
 * maths this exists for.
 *
 * ─── EVERY LINE STAYS EDITABLE, and that is not a nicety ────────────────────
 * Recognition is sometimes wrong. A student marked down for the transcriber's
 * mistake is the worst thing this feature could do, and it would be invisible
 * to us and infuriating to them. So each line can be corrected by hand before
 * it is submitted, and the transcript — not the image — is what gets marked.
 *
 * The strokes are carried alongside each line for the length of the attempt,
 * which is what lets a line be reopened and redrawn. They are NOT persisted:
 * the saved answer is the transcript, a plain string, exactly like every other
 * answer in the app, so none of the seventy-odd places that read `user_answers`
 * has to learn that handwriting exists. Storing the ink itself is a separate
 * job with a schema decision in it.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, Trash2, Check, Loader2, Pencil, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { newStroke, addPoint, isBlank, inkBounds, strokePath, compact } from "@/lib/ink";

/** Pad geometry in its own coordinate space; the SVG scales it to the box. */
const PAD_W = 900, PAD_H = 190;
/** Rasterised at 2x so thin strokes survive the downscale on the model's side. */
const RASTER_SCALE = 2;

/** Draw the strokes to a cropped canvas and hand back a PNG File. */
function rasterise(strokes) {
    const box = inkBounds(strokes, 18);
    if (!box) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(box.width * RASTER_SCALE));
    canvas.height = Math.max(1, Math.round(box.height * RASTER_SCALE));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // White ground and near-black ink regardless of the app's theme — the model
    // is reading handwriting, not admiring the palette.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 3.4 * RASTER_SCALE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setTransform(RASTER_SCALE, 0, 0, RASTER_SCALE, -box.x * RASTER_SCALE, -box.y * RASTER_SCALE);
    for (const s of strokes) {
        if (!Array.isArray(s) || s.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        for (let i = 1; i < s.length; i += 1) ctx.lineTo(s[i][0], s[i][1]);
        ctx.stroke();
    }
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob ? new File([blob], "line.png", { type: "image/png" }) : null),
            "image/png");
    });
}

export default function InkPad({ lines = [], onChange, subject, disabled = false }) {
    const { toast } = useToast();
    const svgRef = useRef(null);
    const [strokes, setStrokes] = useState([]);
    const [drawing, setDrawing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState("");

    const blank = useMemo(() => isBlank(strokes), [strokes]);

    /** Pointer position in the pad's own coordinate space. */
    const at = useCallback((e) => {
        const r = svgRef.current?.getBoundingClientRect();
        if (!r || !r.width) return null;
        return { x: ((e.clientX - r.left) / r.width) * PAD_W, y: ((e.clientY - r.top) / r.height) * PAD_H };
    }, []);

    const down = (e) => {
        if (disabled || busy) return;
        const p = at(e);
        if (!p) return;
        // Capture, so a stroke that leaves the pad mid-letter still finishes
        // here rather than being abandoned on the element it crossed onto.
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDrawing(true);
        setStrokes((prev) => [...prev, newStroke(p.x, p.y)]);
    };
    const move = (e) => {
        if (!drawing) return;
        const p = at(e);
        if (!p) return;
        setStrokes((prev) => {
            if (prev.length === 0) return prev;
            const next = prev.slice();
            next[next.length - 1] = addPoint(next[next.length - 1], p.x, p.y);
            return next;
        });
    };
    const up = () => setDrawing(false);

    const undo = () => setStrokes((prev) => prev.slice(0, -1));
    const clear = () => setStrokes([]);

    /** Recognise what is on the pad, lift it into the stack, clear the pad. */
    const commit = async () => {
        if (blank || busy) return;
        setBusy(true);
        const ink = compact(strokes);
        try {
            const file = await rasterise(strokes);
            if (!file) throw new Error("Nothing to read");
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            const res = await base44.integrations.Core.InvokeLLM({
                feature: "quiz_ai_mark",
                prompt: `This image is ONE line of handwritten working from a VCE ${subject || "Mathematics"} student.

Transcribe exactly what is written. Rules:
- Return LaTeX for the maths, with no surrounding $ delimiters.
- Transcribe what is THERE, including mistakes. Never correct the student's algebra, never finish their working, never add a step they did not write.
- If a character is genuinely ambiguous, choose the reading that is most likely in context and say so in \`uncertain\`.
- If the image has no legible writing, return an empty \`latex\`.`,
                file_urls: [file_url],
                response_json_schema: {
                    type: "object",
                    properties: {
                        latex: { type: "string" },
                        uncertain: { type: "string" },
                    },
                    required: ["latex"],
                },
            });
            const body = res?.data ?? res;
            const latex = String(body?.latex || "").trim();
            if (!latex) {
                toast({
                    title: "Could not read that line",
                    description: "Write a little larger, or type it instead.",
                    variant: "destructive",
                });
                return;   // strokes are kept, so nothing they wrote is lost
            }
            onChange?.([...lines, { latex, ink, uncertain: String(body?.uncertain || "") }]);
            setStrokes([]);
        } catch (err) {
            toast({
                title: "Could not read that line",
                description: err?.message || "Try again, or type it instead.",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    };

    const saveEdit = () => {
        const next = lines.slice();
        next[editing] = { ...next[editing], latex: draft.trim(), edited: true };
        onChange?.(next.filter((l) => l.latex));
        setEditing(null);
    };
    const removeLine = (i) => onChange?.(lines.filter((_, n) => n !== i));

    return (
        <div className="space-y-3">
            {/* ── The worked solution, building up ───────────────────────── */}
            {lines.length > 0 && (
                <ol className="space-y-1.5">
                    <AnimatePresence initial={false}>
                        {lines.map((line, i) => (
                            <motion.li key={`${i}-${line.latex.slice(0, 12)}`}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                className="group flex items-start gap-2 rounded-xl bg-surface border border-border
                                    px-3 py-2">
                                <span className="stat-label text-muted-foreground/60 tabular-nums mt-1 w-5
                                    flex-shrink-0">{i + 1}</span>
                                {editing === i ? (
                                    <div className="flex-1 flex items-center gap-2">
                                        <input value={draft} onChange={(e) => setDraft(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                                            aria-label={`Line ${i + 1} as LaTeX`}
                                            className="flex-1 min-w-0 rounded-lg border-2 border-border bg-background
                                                px-2 py-1 text-sm font-mono focus:border-primary outline-none" />
                                        <button type="button" onClick={saveEdit} aria-label="Save line"
                                            className="w-8 h-8 grid place-items-center rounded-lg bg-primary
                                                text-primary-foreground cursor-pointer">
                                            <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <MarkdownMath className="flex-1 min-w-0 text-foreground">
                                            {`$${line.latex}$`}
                                        </MarkdownMath>
                                        <div className="flex gap-0.5 flex-shrink-0 opacity-70
                                            group-hover:opacity-100 transition-opacity">
                                            <button type="button" aria-label={`Correct line ${i + 1}`}
                                                onClick={() => { setEditing(i); setDraft(line.latex); }}
                                                className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground
                                                    hover:text-foreground hover:bg-secondary cursor-pointer">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button type="button" aria-label={`Delete line ${i + 1}`}
                                                onClick={() => removeLine(i)}
                                                className="w-8 h-8 grid place-items-center rounded-lg text-streak
                                                    hover:bg-streak/10 cursor-pointer">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.li>
                        ))}
                    </AnimatePresence>
                </ol>
            )}

            {/* ── The pad ────────────────────────────────────────────────── */}
            <div className="rounded-2xl border-2 border-dashed border-border bg-surface overflow-hidden">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${PAD_W} ${PAD_H}`}
                    role="application"
                    aria-label="Write one line of working"
                    className={`block w-full touch-none select-none
                        ${disabled || busy ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
                    style={{ height: "min(34vw, 190px)" }}
                    onPointerDown={down} onPointerMove={move}
                    onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
                >
                    {/* A ruled baseline, so writing lands straight without a grid
                        heavy enough to compete with the ink. */}
                    <line x1="0" y1={PAD_H * 0.68} x2={PAD_W} y2={PAD_H * 0.68}
                        stroke="currentColor" className="text-border" strokeWidth="2" strokeDasharray="8 10" />
                    {strokes.map((s, i) => (
                        <path key={i} d={strokePath(s)} fill="none" stroke="currentColor"
                            className="text-foreground" strokeWidth="3.4"
                            strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                </svg>

                <div className="flex items-center gap-2 px-3 py-2 border-t-2 border-border bg-background/40">
                    <button type="button" onClick={undo} disabled={strokes.length === 0 || busy}
                        aria-label="Undo last stroke"
                        className="w-9 h-9 grid place-items-center rounded-xl border-2 border-border
                            text-muted-foreground hover:text-foreground disabled:opacity-40
                            disabled:cursor-not-allowed cursor-pointer transition-colors">
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={clear} disabled={blank || busy}
                        aria-label="Clear the pad"
                        className="w-9 h-9 grid place-items-center rounded-xl border-2 border-border
                            text-streak hover:bg-streak/10 disabled:opacity-40
                            disabled:cursor-not-allowed cursor-pointer transition-colors">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-muted-foreground ml-1 hidden sm:block">
                        One line at a time — it gets typeset above.
                    </p>
                    <button type="button" onClick={commit} disabled={blank || busy || disabled}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary
                            text-primary-foreground px-3.5 py-2 text-sm font-bold hover:bg-primary/90
                            disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">
                        {busy
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading…</>
                            : <><Check className="w-4 h-4" /> Add line</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
