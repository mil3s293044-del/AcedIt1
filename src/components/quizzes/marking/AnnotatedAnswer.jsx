/**
 * AnnotatedAnswer — the student's own answer, marked where it actually went
 * wrong, the way an examiner's report marks one.
 *
 * The words are theirs, rendered whole. Only the flagged characters carry a
 * mark, and the mark is an UNDERLINE rather than a strikethrough: a
 * strikethrough tells you to delete something, and almost nothing an assessor
 * flags should be deleted. It should be said better.
 *
 * ─── The note is a real popover now, and that is a bug fix ──────────────────
 * It used to be `absolute` inside the paragraph, which meant a phrase near the
 * right edge or low on the page opened a note that ran off the screen — the
 * one place the marking actually says what to do, unreadable. It is PORTALLED
 * to the body and positioned `fixed` from a measured rect, then clamped to the
 * viewport and flipped above the phrase when there is no room below.
 *
 * `position: fixed` resolves against the nearest transformed ancestor rather
 * than the viewport, and framer-motion leaves an inline transform on every
 * animated section in this app — so portalling is not tidiness, it is the only
 * way `fixed` means fixed here. AceRoam's header records the same lesson,
 * learned the same way.
 *
 * ─── Hover is one of three ways in ──────────────────────────────────────────
 * Hover, tap and keyboard focus all open the same note. Hover alone would make
 * this unusable on a phone, which is where most of these students are. Colour
 * is never the only signal either — every flagged span is underlined, and the
 * note names the severity in words.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check } from "lucide-react";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { segment } from "@/lib/annotate";

/** Static class lookups — Tailwind cannot see a class built at runtime. */
const TONE = {
    lost: { underline: "decoration-streak", pill: "bg-streak/10 text-streak", label: "Cost a mark" },
    risk: { underline: "decoration-xp",     pill: "bg-xp/10 text-xp",         label: "Imprecise" },
};
const toneOf = (a) => TONE[a?.severity] || TONE.lost;

/** Keeps the note on screen. */
const NOTE_W = 340;
const MARGIN = 12;

function Note({ anchor, ann, onBank, banked }) {
    const [pos, setPos] = useState(null);
    const ref = useRef(null);

    const place = useCallback(() => {
        const el = anchor?.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        const h = ref.current?.offsetHeight || 200;
        // Below by default; above when the bottom of the screen is closer than
        // the note is tall. A note that opens off the bottom is the same bug as
        // one that opens off the side.
        const below = r.bottom + 8;
        const fitsBelow = below + h <= vh - MARGIN;
        const above = r.top - 8 - h;
        const fitsAbove = above >= MARGIN;
        const w = Math.min(NOTE_W, vw - MARGIN * 2);

        // Below, else above, else clamped into whatever room there is. On a
        // short viewport — a laptop with the keyboard up, a phone in landscape
        // — a long note fits NEITHER side, and flipping alone still leaves it
        // hanging off the bottom. The third case is the one that was missing:
        // pin it inside the viewport and let it scroll itself.
        let top;
        if (fitsBelow) top = below;
        else if (fitsAbove) top = above;
        else top = Math.max(MARGIN, vh - MARGIN - h);

        return setPos({
            top: Math.max(MARGIN, Math.min(vh - MARGIN - Math.min(h, vh - MARGIN * 2), top)),
            left: Math.max(MARGIN, Math.min(vw - w - MARGIN, r.left)),
            width: w,
            maxHeight: vh - MARGIN * 2,
        });
    }, [anchor]);

    // Layout effect so the first paint is already in the right place — a note
    // that appears in the corner and jumps reads as a rendering fault.
    useLayoutEffect(() => { place(); }, [place]);
    useEffect(() => {
        // Measured again once its real height is known, then kept in place
        // while the page moves under it.
        const id = requestAnimationFrame(place);
        window.addEventListener("scroll", place, { passive: true, capture: true });
        window.addEventListener("resize", place, { passive: true });
        return () => {
            cancelAnimationFrame(id);
            window.removeEventListener("scroll", place, { capture: true });
            window.removeEventListener("resize", place);
        };
    }, [place]);

    if (typeof document === "undefined") return null;
    const tone = toneOf(ann);

    return createPortal(
        <motion.div
            ref={ref}
            role="tooltip"
            data-mark-note={ann.quote}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={pos
                ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }
                : { opacity: 0 }}
            className="fixed z-50 overflow-y-auto overscroll-contain rounded-2xl bg-surface
                border-2 border-border shadow-soft-lg p-3.5 text-left"
        >
            <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`pill text-[10px] ${tone.pill}`}>{tone.label}</span>
                <span className="stat-label text-muted-foreground">{ann.criterion}</span>
                {ann.worth > 0 && (
                    <span className="text-[10px] font-black text-muted-foreground tabular-nums">
                        −{ann.worth}
                    </span>
                )}
            </div>

            {ann.issue && (
                <MarkdownMath className="text-sm text-foreground leading-snug mt-2">
                    {ann.issue}
                </MarkdownMath>
            )}

            {/* What the assessor was looking for. The issue says what is wrong;
                this says what would have earned the mark, which is the half a
                student cannot work out on their own. */}
            {ann.wanted && (
                <div className="mt-2 rounded-xl border-l-2 border-border pl-2.5">
                    <p className="stat-label text-muted-foreground">The assessor wanted</p>
                    <MarkdownMath className="text-sm text-foreground leading-snug mt-0.5">
                        {ann.wanted}
                    </MarkdownMath>
                </div>
            )}

            {ann.fixes.length > 0 && (
                <div className="mt-2.5 rounded-xl bg-primary/5 border border-primary/20 px-2.5 py-2">
                    <p className="stat-label text-primary">
                        {ann.fixes.length === 1 ? "Instead" : "Either of these"}
                    </p>
                    <ul className="mt-1 space-y-1.5">
                        {ann.fixes.map((f, i) => (
                            <li key={i} className="flex gap-2">
                                {ann.fixes.length > 1 && (
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

            {onBank && (
                <button type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => { e.stopPropagation(); onBank(ann); }}
                    disabled={banked}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border-2 border-border
                        px-2.5 py-1 text-xs font-bold text-foreground hover:border-primary/50
                        disabled:opacity-60 disabled:cursor-default cursor-pointer transition-colors">
                    {banked
                        ? <><Check className="w-3.5 h-3.5 text-primary" /> Saved to your mistake bank</>
                        : <><Plus className="w-3.5 h-3.5" /> Save this mistake</>}
                </button>
            )}
        </motion.div>,
        document.body,
    );
}

function Flagged({ ann, text, open, onToggle, onBank, banked }) {
    const ref = useRef(null);
    const tone = toneOf(ann);
    return (
        <>
            <button
                ref={ref}
                type="button"
                onClick={() => onToggle()}
                onMouseEnter={() => onToggle(true)}
                onMouseLeave={() => onToggle(false)}
                onFocus={() => onToggle(true)}
                onBlur={() => onToggle(false)}
                aria-expanded={open}
                aria-label={`${tone.label}: ${ann.quote}`}
                className={`inline cursor-pointer bg-transparent p-0 text-left text-foreground
                    underline decoration-wavy decoration-2 underline-offset-4 ${tone.underline}
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-ring rounded-sm`}
            >
                {text}
            </button>
            <AnimatePresence>
                {open && <Note anchor={ref} ann={ann} onBank={onBank} banked={banked} />}
            </AnimatePresence>
        </>
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
