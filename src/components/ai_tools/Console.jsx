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
 * ─── THE LATTICE IS NOT DRAWN HERE ANY MORE ─────────────────────────────────
 * It covered the whole route, behind a bordered chat panel that covered most of
 * it, so it showed only in the margins and lined up with nothing. The chat is
 * full-bleed now, and the grid is drawn behind the welcome (`ChatWelcome`), in
 * the box its content column is centred in — the only place a line can land on
 * the column's edges. The room keeps its ground and its tokens.
 */
import React from "react";

export default function Console({ children, className = "" }) {
    return (
        <div
            className={`console relative min-h-[calc(100dvh-8rem)] md:min-h-[calc(100dvh-3rem)]
                bg-[var(--console-ground)] text-[var(--console-ink)] ${className}`}
        >
            {children}
        </div>
    );
}
