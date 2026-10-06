/**
 * Console — the room /AITools opens into.
 *
 * ─── ONE WRAPPER, AND THE CLASS IS WHAT SCOPES THE PALETTE ──────────────────
 * The `console` class is where ~15 `--console-*` tokens are declared (index.css)
 * and every one of them is scoped to it. That is the same arrangement `Room`
 * keeps for the Compete floor, for the same reason: custom properties inherit
 * down the DOM tree while `position: fixed` escapes LAYOUT rather than the
 * cascade, so an overlay opened from inside this room still reads the room's
 * ink without being told which room it is in.
 *
 * It also means the class going missing blanks every token at once and the page
 * still renders — in inherited ink, which on a cream app is a cream page where a
 * graphite one was intended. That exact edit silently no-opped during the floor's
 * refactor, which is why `consoleInk.test.mjs` asserts the class is here.
 *
 * ─── NO NEGATIVE MARGIN ─────────────────────────────────────────────────────
 * `Room` carried `-m-4 sm:-m-6` to pull its ground past a page padding that does
 * not exist — Layout's `<main>` has none — and gave /Competitions a horizontal
 * scrollbar at `sm` and up for as long as it had existed. This is a plain
 * full-bleed block that owns its own width and pads inside, like every other
 * page in the app.
 *
 * ─── THE LATTICE IS A SIBLING, NOT A BACKGROUND ON THE CONTENT ──────────────
 * Drawn as its own absolutely positioned layer so the content sits over it with
 * no stacking context of its own to fight, and `pointer-events-none` so a grid
 * covering the page cannot swallow a click on the thing underneath it.
 */
import React from "react";

export default function Console({ children, className = "" }) {
    return (
        <div
            className={`console relative isolate min-h-[calc(100dvh-8rem)] md:min-h-[calc(100dvh-3rem)]
                bg-[var(--console-ground)] text-[var(--console-ink)] ${className}`}
        >
            <div className="console-lattice absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
            {children}
        </div>
    );
}
