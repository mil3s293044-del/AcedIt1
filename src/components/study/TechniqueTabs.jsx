/**
 * TechniqueTabs — the six techniques as ONE row, each with a counted fact.
 *
 * ─── SIX PASTEL TILES WERE TABS THAT DID NOT LOOK LIKE TABS ─────────────────
 * Each technique was a 140px tile in its own tint with an icon on a plate, a
 * name and a slogan, and pressing one changed the tool further down the page.
 * So the navigation was the loudest thing on screen, it was a grid of
 * identical boxes (the shape this app keeps deleting), and it said a slogan
 * where it could have said something true. It is a tab strip now, and the
 * second line under each name is `techniqueFacts` — "14 ready", "SAC in 3
 * days", "Yesterday" — so the strip is worth reading before it is pressed.
 *
 * ─── IT STICKS UNDER THE TOP BAR ────────────────────────────────────────────
 * The tools are long (a deck shelf, a mind map, a mock paper), and switching
 * used to mean scrolling back past all of it. `top-12` is the top bar's own
 * `h-12`; the strip is a child of the page column, so it stops sticking where
 * the column ends.
 *
 * ─── IT IS THE PROGRESS BAR'S CONTROL ───────────────────────────────────────
 * A segmented bar with one pill that slides to the live cell — ProgressTabs'
 * own idiom, so the two pages a student moves between most use one control.
 * It was an underline strip in a six-column grid, and equal cells around
 * names of unequal length read as uneven gaps rather than as six tabs — and
 * in equal cells "Spaced Repetition" ran into the pill beside it. The cells
 * are sized by their content (`flex-auto`) and share what is left.
 *
 * ─── COLOUR IS ON THE GLYPH AND THE LIVE FACT ───────────────────────────────
 * A repeated set keeps its icons, because they tell six siblings apart. The
 * hue goes where it identifies the technique — the glyph, and a fact worth
 * pressing for — and nowhere else.
 *
 * The technique the page is suggesting carries a dot, so the heading's
 * suggestion can be found in the strip without reading it twice.
 */
import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function TechniqueTabs({ techniques = [], value, onChange, facts = {}, suggested = null }) {
    const reduce = useReducedMotion();
    const refs = useRef({});
    const rowRef = useRef(null);

    // On a phone the strip scrolls sideways, so the live tab has to be brought
    // into view when it changes from outside (a deep link, the heading's
    // button). The ROW is scrolled rather than `scrollIntoView` called on the
    // tab, which would also scroll the PAGE whenever the strip was below the
    // fold — a page that jumps down on load.
    useEffect(() => {
        const row = rowRef.current;
        const el = refs.current[value];
        if (!row || !el || row.scrollWidth <= row.clientWidth) return;
        // The row is `relative`, so it is the tab's offsetParent.
        const left = el.offsetLeft;
        const right = left + el.offsetWidth;
        if (left >= row.scrollLeft && right <= row.scrollLeft + row.clientWidth) return;
        const target = Math.max(0, left - (row.clientWidth - el.offsetWidth) / 2);
        row.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
    }, [value, reduce]);

    const onKey = (e) => {
        const i = techniques.findIndex((t) => t.id === value);
        if (i < 0) return;
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = techniques[(i + step + techniques.length) % techniques.length];
        onChange(next.id);
        refs.current[next.id]?.focus();
    };

    return (
        // THE BAND IS THE PAGE'S OWN GROUND, so content scrolling under the
        // sticky bar is hidden behind it rather than showing through the gaps
        // between the cells.
        <div className="sticky top-12 z-20 -mx-4 lg:-mx-8 px-4 lg:px-8 py-2 bg-background/90 backdrop-blur-xl">
            <div ref={rowRef} role="tablist" aria-label="Study techniques" onKeyDown={onKey}
                className="relative flex gap-1 overflow-x-auto scrollbar-none p-1.5 rounded-2xl bg-surface border-2 border-border
                    shadow-soft lg:overflow-visible">
                {techniques.map((t) => {
                    const on = t.id === value;
                    const Icon = t.icon;
                    const fact = facts[t.id];
                    return (
                        <button
                            key={t.id}
                            ref={(el) => { refs.current[t.id] = el; }}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            tabIndex={on ? 0 : -1}
                            onClick={() => onChange(t.id)}
                            className="group relative flex-shrink-0 min-w-[8.5rem] lg:min-w-0 lg:flex-auto px-3 py-2 rounded-xl text-left
                                transition-colors hover:bg-secondary/70
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {/* ONE PILL THAT TRAVELS, the ProgressTabs idiom: a
                                move says "the same page, another tool", where a
                                cut says "another page". */}
                            {on && (
                                <motion.span
                                    layoutId="study-technique-pill"
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-xl bg-foreground"
                                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                                />
                            )}
                            <span className="relative flex items-center gap-2">
                                <Icon className={`w-4 h-4 flex-shrink-0 ${t.ink}`} aria-hidden="true" />
                                <span className={`text-sm font-bold whitespace-nowrap transition-colors
                                    ${on ? "text-background" : "text-foreground/80 group-hover:text-foreground"}`}>
                                    {t.name}
                                </span>
                                {suggested === t.id && !on && (
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.bar}`}
                                        aria-label="Suggested" role="img" />
                                )}
                            </span>
                            {/* A LIVE FACT IS IN THE TECHNIQUE'S INK, a
                                description is not. "14 ready" is a reason to
                                press; "Flashcards" is a label, and colouring
                                both the same would say they were equally worth
                                reading. */}
                            {fact && (
                                <span className={`relative mt-0.5 block pl-6 text-xs whitespace-nowrap truncate tabular-nums
                                    ${on
                                        ? (fact.live ? "font-semibold text-background/75" : "text-background/55")
                                        : (fact.live ? `font-semibold ${t.ink}` : "text-muted-foreground/70")}`}>
                                    {fact.text}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
