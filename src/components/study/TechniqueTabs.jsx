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
 * ─── COLOUR IS ON THE GLYPH AND THE UNDERLINE ───────────────────────────────
 * A repeated set keeps its icons, because they tell six siblings apart. The
 * hue goes where it identifies the technique — the glyph, and the bar that
 * slides under the live one — and nowhere else. The bar SLIDES (one element,
 * `layoutId`) because a move between tabs says "the same page, another tool",
 * where a cut says "another page"; ProgressTabs makes the same call.
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
        <div className="sticky top-12 z-20 -mx-4 lg:-mx-8 px-4 lg:px-8 bg-background/95 backdrop-blur-xl border-b border-border">
            <div ref={rowRef} role="tablist" aria-label="Study techniques" onKeyDown={onKey}
                className="relative flex overflow-x-auto scrollbar-none lg:grid lg:grid-cols-6 lg:overflow-visible">
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
                            className="group relative flex-shrink-0 min-w-[8.25rem] lg:min-w-0 px-3 pt-3 pb-3.5 text-left
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-t-lg"
                        >
                            <span className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 flex-shrink-0 ${t.ink}`} aria-hidden="true" />
                                <span className={`text-sm font-bold whitespace-nowrap transition-colors
                                    ${on ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                                    {t.name}
                                </span>
                                {suggested === t.id && !on && (
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.bar}`}
                                        aria-label="Suggested" role="img" />
                                )}
                            </span>
                            {fact && (
                                <span className={`mt-0.5 block pl-6 text-xs whitespace-nowrap truncate tabular-nums
                                    ${fact.live ? "font-semibold text-muted-foreground" : "text-muted-foreground/70"}`}>
                                    {fact.text}
                                </span>
                            )}
                            {on && (
                                <motion.span
                                    layoutId="study-technique-tab"
                                    aria-hidden="true"
                                    className={`absolute left-3 right-3 bottom-0 h-[3px] rounded-full ${t.bar}`}
                                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
