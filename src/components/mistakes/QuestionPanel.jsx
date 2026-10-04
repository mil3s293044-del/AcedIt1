/**
 * QuestionPanel — the question, whole, wherever the bank prints one.
 *
 * ─── A CLIPPED QUESTION IS WORSE THAN NO QUESTION ───────────────────────────
 * The bank already records this once: `question_title` is a sixty-character
 * clip for a pill, which on a maths question is a formula cut off
 * mid-expression, and `extra.mistake.question` was added to hold the real one.
 * It then got clipped again at every surface that printed it — `line-clamp-2`
 * on the re-sit list, `truncate` on the row's label — so a student looking at
 * "Explain why the equilibrium shifts when the temperature is…" has to guess
 * at the half of the question the mark actually turned on. The whole point of
 * a drill is judging what the assessor wanted; you cannot do that against a
 * sentence that stops.
 *
 * ─── SO IT IS NEVER TRUNCATED, AND A LONG ONE COLLAPSES ─────────────────────
 * The two failures are different and both are real: a clipped question cannot
 * be read at all, and a forty-line one pushes the exercise it is context for
 * off the bottom of the screen. Collapsing solves the second without
 * reintroducing the first — everything is one tap away and nothing is lost.
 *
 * Expanding goes to FULL HEIGHT and never to an inner scroller. A scrollbar
 * inside a collapsed box is two cuts where there was one, and the student
 * still cannot see the whole thing at once. (`SourcePanel` scrolls instead,
 * and the difference is what the two are FOR: a stimulus is read WHILE
 * answering, so it has to stay in place beside the answer box. This is
 * context above a drill, so it gets out of the way and comes back whole.)
 *
 * ─── IT MEASURES RATHER THAN COUNTING CHARACTERS ────────────────────────────
 * The obvious threshold is a character count and it is wrong at both ends, and
 * wrong DIFFERENTLY at each width. `\frac{\mathrm{d}y}{\mathrm{d}x}` is thirty
 * characters and renders as one small glyph cluster; two hundred characters of
 * prose is two lines on a desktop and five on a 390px phone. So the rendered
 * height is compared against the clamp, through a ResizeObserver, and the
 * control appears only when there is genuinely something hidden.
 *
 * A CONTROL OVER NOTHING IS CHROME PRETENDING TO BE NAVIGATION — the rule the
 * single-tab `Tabs` was deleted for. A question that fits draws no button, no
 * fade and no border change; it is simply the question.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import MarkdownMath from "@/components/shared/MarkdownMath";

/**
 * How tall a question may be before it is worth collapsing.
 *
 * About five lines at `text-sm`, which is a full VCAA stem with its mark
 * allocation — the common case, and the one that must NOT grow a control.
 * `SLACK` stops a question one or two pixels over the line from sprouting a
 * "show the rest" button that reveals a sliver of descender.
 */
export const COLLAPSED_MAX = 104;
const SLACK = 12;

export default function QuestionPanel({
    children,
    label = "The question",
    // `inset` is the quieter well used above a drill, where the question is
    // CONTEXT and the exercise under it is the thing being done. `plain` is
    // for a list row that is already inside its own card.
    tone = "inset",
    // The CALLER owns the type. A list row prints its questions small and bold
    // and the drill's context inset prints them at body size — baking one in
    // would have quietly restyled every row this replaced, which is a change
    // nobody asked for riding along with a fix. `COLLAPSED_MAX` is a HEIGHT, so
    // it means the same thing at either scale: about five lines of body copy,
    // about seven of the small one, and in both cases the point at which the
    // thing it is context for starts leaving the screen.
    textClass = "text-sm text-foreground leading-snug",
    className = "",
}) {
    const [open, setOpen] = useState(false);
    const [tall, setTall] = useState(false);
    const innerRef = useRef(null);

    // The inner element is never clamped — the clamp lives on the wrapper — so
    // its height is the TRUE height whether or not the panel is open. Measuring
    // the clamped box instead would report the clamp back to itself and the
    // control could never appear.
    const measure = useCallback(() => {
        const el = innerRef.current;
        if (!el) return;
        setTall(el.scrollHeight > COLLAPSED_MAX + SLACK);
    }, []);

    useEffect(() => {
        measure();
        const el = innerRef.current;
        // KaTeX swaps in its own fonts and markdown may hold a table, so the
        // height after the first paint is not the height a second later. The
        // observer also catches a rotation or a resized window, where the same
        // question is four lines and then seven.
        if (!el || typeof ResizeObserver === "undefined") return undefined;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [measure, children]);

    if (!children) return null;

    const clamped = tall && !open;
    const well = tone === "inset"
        ? "rounded-xl bg-secondary/40 border-l-2 border-border pl-3 pr-3 py-2.5"
        : "";

    return (
        <div className={`${well} ${className}`}>
            {label && <p className="stat-label text-muted-foreground mb-1">{label}</p>}
            <div
                className="overflow-hidden transition-[max-height] duration-200 motion-reduce:transition-none"
                style={{
                    maxHeight: clamped ? COLLAPSED_MAX : undefined,
                    // THE FADE IS A MASK, NOT A GRADIENT IN A COLOUR. A
                    // gradient has to know the ground it sits on, and this
                    // panel is drawn over `bg-secondary/40` here, a plain card
                    // there, and both themes everywhere — so a hard-coded stop
                    // is a grey smear on one of them. A mask asks nothing about
                    // the colour underneath it.
                    ...(clamped ? {
                        WebkitMaskImage: "linear-gradient(to bottom, #000 72%, transparent 100%)",
                        maskImage: "linear-gradient(to bottom, #000 72%, transparent 100%)",
                    } : {}),
                }}
            >
                <div ref={innerRef}>
                    <MarkdownMath className={textClass}>
                        {children}
                    </MarkdownMath>
                </div>
            </div>

            {tall && (
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold
                        text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
                    {open ? "Show less" : "Show the whole question"}
                </button>
            )}
        </div>
    );
}
