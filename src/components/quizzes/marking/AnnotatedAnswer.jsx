/**
 * AnnotatedAnswer — the student's own answer, marked where it actually went
 * wrong, the way an examiner's report marks one.
 *
 * The words are theirs, rendered whole. Only the flagged characters carry a
 * mark, and the mark is an UNDERLINE rather than a strikethrough: a
 * strikethrough tells you to delete something, and almost nothing an assessor
 * flags should be deleted. It should be said better.
 *
 * ─── This POINTS. It does not hold the feedback ─────────────────────────────
 * It used to. The note that opened on hover carried what the assessor wanted,
 * the suggested rewrites, and the button that saved the mistake — which meant
 * every one of those was reachable only by keeping a pointer on six underlined
 * words. The note is portalled to the body, so moving toward it left the
 * phrase and closed it; you could see the save button and not get to it. That
 * is the "glitchy hover, and I kept hovering to save it" bug, and it is not a
 * timing problem to tune. Content you need is not allowed to live in something
 * that disappears when you reach for it.
 *
 * So all of that moved into MarkModule, which is simply on the screen. What is
 * left here is a label: which mark this phrase belongs to, and what it cost.
 * Tapping the phrase scrolls to that mark. Hover is a preview of a destination
 * now, and nothing is lost if it never opens — the same content is already
 * below, in a block that does not move.
 *
 * Because the label is small and fixed-height, the elaborate three-case
 * viewport clamping the old note needed is gone with it: flip above when there
 * is no room below, clamp horizontally, done. It is still PORTALLED, because
 * `position: fixed` resolves against the nearest transformed ancestor and
 * framer-motion leaves an inline transform on every animated section in this
 * app. AceRoam's header records the same lesson, learned the same way.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { segment } from "@/lib/annotate";

/** Static class lookups — Tailwind cannot see a class built at runtime. */
const TONE = {
    lost: { underline: "decoration-streak", pill: "bg-streak/10 text-streak", label: "Cost a mark" },
    risk: { underline: "decoration-xp",     pill: "bg-xp/10 text-xp",         label: "Imprecise" },
};
const toneOf = (a) => TONE[a?.severity] || TONE.risk;

const LABEL_W = 300;
const MARGIN = 12;

/**
 * The pointer label. Small, so it fits almost anywhere, which is why this
 * needs none of the scroll-inside-itself machinery the old note did.
 */
function Pointer({ anchor, ann }) {
    const [pos, setPos] = useState(null);
    const ref = useRef(null);
    const tone = toneOf(ann);

    const place = useCallback(() => {
        const el = anchor?.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        const h = ref.current?.offsetHeight || 56;
        const w = Math.min(LABEL_W, vw - MARGIN * 2);
        const below = r.bottom + 8;
        // Below, unless the bottom of the screen is closer than the label is
        // tall — then above the phrase instead.
        const top = below + h <= vh - MARGIN ? below : Math.max(MARGIN, r.top - 8 - h);
        setPos({ top, left: Math.max(MARGIN, Math.min(vw - w - MARGIN, r.left)), width: w });
    }, [anchor]);

    // Layout effect so the first paint is already in the right place — a label
    // that appears in the corner and jumps reads as a rendering fault.
    useLayoutEffect(() => { place(); }, [place]);
    useEffect(() => {
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

    return createPortal(
        <motion.div
            ref={ref}
            role="tooltip"
            data-mark-note={ann.quote}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.13 }}
            // pointer-events-none is deliberate and load-bearing: there is
            // nothing to click in here, so it must never intercept the pointer
            // on its way somewhere else.
            style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { opacity: 0 }}
            className="fixed z-50 pointer-events-none rounded-xl bg-surface border-2 border-border
                shadow-soft-lg px-3 py-2 text-left"
        >
            <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`pill text-[10px] ${tone.pill}`}>{tone.label}</span>
                {ann.worth > 0 && (
                    <span className="text-[10px] font-black text-muted-foreground tabular-nums">
                        −{ann.worth}
                    </span>
                )}
            </div>
            <p className="text-xs font-bold text-foreground leading-snug mt-1">{ann.criterion}</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-1 flex items-center gap-1">
                <ArrowDown className="w-3 h-3 flex-shrink-0" /> Tap to jump to this mark
            </p>
        </motion.div>,
        document.body,
    );
}

function Flagged({ ann, text, open, onToggle, onOpen, flash }) {
    const ref = useRef(null);
    const tone = toneOf(ann);
    return (
        <>
            <button
                ref={ref}
                type="button"
                data-annotation={ann.id}
                onClick={() => onOpen?.(ann)}
                onMouseEnter={() => onToggle(true)}
                onMouseLeave={() => onToggle(false)}
                onFocus={() => onToggle(true)}
                onBlur={() => onToggle(false)}
                aria-label={`${tone.label}: ${ann.quote}. ${ann.criterion}. Jump to this mark.`}
                className={`inline cursor-pointer bg-transparent p-0 text-left text-foreground
                    underline decoration-wavy decoration-2 underline-offset-4 ${tone.underline}
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-ring rounded-sm transition-colors
                    ${flash ? "bg-ring/20" : ""}`}
            >
                {text}
            </button>
            <AnimatePresence>
                {open && <Pointer anchor={ref} ann={ann} />}
            </AnimatePresence>
        </>
    );
}

export default function AnnotatedAnswer({ text, annotations = [], onOpen, flash }) {
    const [hovered, setHovered] = useState(null);
    const segments = segment(text, annotations);
    if (segments.length === 0) return null;

    return (
        <p data-annotated className="text-base text-foreground leading-loose">
            {segments.map((s, i) => (
                s.ann ? (
                    <Flagged key={i} ann={s.ann} text={s.text}
                        open={hovered === i}
                        flash={flash === `ann:${s.ann.id}`}
                        onOpen={onOpen}
                        onToggle={(v) => setHovered((cur) => (v ? i : (cur === i ? null : cur)))} />
                ) : (
                    <React.Fragment key={i}>{s.text}</React.Fragment>
                )
            ))}
        </p>
    );
}
