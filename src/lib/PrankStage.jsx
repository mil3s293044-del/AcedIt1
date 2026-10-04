/**
 * PrankStage — the one place a prank plays.
 *
 * ─── A PREVIEW THAT IMITATES THE REAL THING IS NOT A PREVIEW ────────────────
 * The store's Preview button built a prank-shaped object and handed it to
 * `PrankOverlay` directly, which draws the CARD and the particles — and misses
 * the half that is not in the overlay at all. Shake and upside-down act on the
 * PAGE: `prankBodyClass` goes on the element Layout owns, so a page cannot
 * apply it without becoming a second writer of a class it does not own. The
 * first version wrote a comment explaining that and shipped two previews that
 * visibly did nothing.
 *
 * Which is the wrong trade. The fix is not for the page to reach up; it is for
 * the preview to go through the SAME QUEUE a delivered prank goes through, so
 * what a student sees before they spend is what their friend gets, by
 * construction rather than by two implementations agreeing.
 *
 * ─── IT IS A QUEUE, NOT A SLOT ──────────────────────────────────────────────
 * Layout already held `prankQueue` and advanced it on `onDone`, because two
 * playing at once is a mess nobody can read. A preview joins the back of that
 * queue like anything else, so pressing Preview five times plays five in
 * order instead of five on top of each other.
 *
 * ─── A PREVIEW IS STILL MARKED AS ONE ───────────────────────────────────────
 * `preview: true` rides on the row. Nothing in the overlay reads it today and
 * nothing should need to — the whole point is that it plays identically — but
 * a prank that reached the server or a seen-set would be charging somebody for
 * a rehearsal, so the flag exists for any future reader to refuse on rather
 * than having to infer it from an id prefix.
 */
import React, { createContext, useCallback, useContext, useMemo } from "react";

const Ctx = createContext(null);

/**
 * CONTROLLED BY LAYOUT, which is the whole reason this works.
 *
 * The queue cannot live in here. `prankBodyClass` goes on the element Layout
 * renders as its root, and a provider that owned the queue would sit INSIDE
 * that element — so the class would be set by a parent that cannot see the
 * state. Layout keeps the queue, applies the class, and passes the queue down;
 * this is the doorway pages reach it through.
 */
export function PrankStageProvider({ queue = [], setQueue, children }) {
    // GUARDED INSIDE, NOT WRAPPED OUTSIDE. An earlier draft did
    // `const set = setQueue || (() => {})`, which mints a new function on every
    // render — so every callback below depended on a value that always changed
    // and the memoisation did nothing. The prop goes in the deps and the guard
    // goes in the body, which is stable when the prop is.
    const play = useCallback((kind, from, extra = {}) => {
        if (!kind || !setQueue) return;
        setQueue((q) => [...q, {
            id: `prank-${kind}-${Date.now()}-${q.length}`,
            kind,
            from: from || "Someone",
            ...extra,
        }]);
    }, [setQueue]);

    /** Push rows that arrived from the server. */
    const enqueue = useCallback((rows) => {
        if (!setQueue || !Array.isArray(rows) || !rows.length) return;
        setQueue((q) => [...q, ...rows]);
    }, [setQueue]);

    /** The overlay calls this when one finishes, and the next takes the stage. */
    const advance = useCallback(() => {
        if (setQueue) setQueue((q) => q.slice(1));
    }, [setQueue]);

    const value = useMemo(
        () => ({ current: queue[0] || null, play, enqueue, advance }),
        [queue, play, enqueue, advance]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Read the stage.
 *
 * It returns a NO-OP SHAPE outside the provider rather than throwing, because
 * the probe renders these components without Layout and a preview button that
 * crashes a page is worse than one that does nothing there.
 */
export function usePrankStage() {
    return useContext(Ctx) || { current: null, play: () => {}, enqueue: () => {}, advance: () => {} };
}

export default PrankStageProvider;
