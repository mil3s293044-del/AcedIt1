/**
 * ReelContext — which act is on screen, what is in the hand, and how you move.
 *
 * ONE SOURCE OF TRUTH FOR "WHERE AM I", and it is derived from the DOM rather
 * than stored. The active act is whichever one an IntersectionObserver says is
 * most on screen; `goTo` scrolls, it does not set state. That ordering is the
 * whole reason scroll and the buttons cannot disagree: a student who drags the
 * scrollbar, presses ↓, clicks the chapter rail and swipes all end up in the
 * same state because all four do the same thing — move the scroll position and
 * let the observer report it.
 *
 * The alternative — state as the truth, with a `useEffect` scrolling to match —
 * is what produces the classic scrollytelling bug where the page fights you:
 * you scroll, state has not caught up, the effect scrolls you back.
 *
 * WE NEVER SWALLOW A WHEEL EVENT. There is no `preventDefault` on scroll
 * anywhere in this component tree. Hijacking the wheel is the single thing that
 * makes a page like this unusable on a trackpad, with a screen reader, under a
 * browser zoom, or on any input device we did not think of. The cinema comes
 * from snap points and from `scrollIntoView`, both of which the browser owns.
 */
import React, {
    createContext, useContext, useState, useCallback, useRef, useMemo, useEffect,
} from "react";
import { useReducedMotion } from "framer-motion";
import { ACTS, indexOf, step, dealt, cardFor, deviceTier, groundOf } from "@/lib/reel";

const Ctx = createContext(null);

export function useReel() {
    const v = useContext(Ctx);
    if (!v) throw new Error("useReel outside a <ReelProvider>");
    return v;
}

/**
 * What one act needs to know about itself.
 *
 * `played` is sticky and `active` is not. An act that has ever been on screen
 * stays played, so its entrance animation does not replay every time somebody
 * scrolls back up through it — on a snap deck, scrolling back is a normal
 * thing to do, and a film that re-stages its third act every time you glance
 * at it is exhausting rather than impressive.
 */
export function useAct(id) {
    const reel = useReel();
    return useMemo(() => ({
        active: reel.actId === id,
        played: reel.played.has(id),
        index: indexOf(id),
        advance: () => reel.goTo(step(id, 1)),
        back: () => reel.goTo(step(id, -1)),
        /** Pay this act out. Idempotent — see `dealt`. */
        deal: (state) => reel.deal(id, state),
    }), [reel, id]);
}

/**
 * Read the machine once, on mount.
 *
 * ON MOUNT AND NOT ON RESIZE, deliberately. Dragging a browser window narrower
 * does not make the computer slower, and re-tiering on resize is what makes a
 * page visibly drop its animations when somebody opens the devtools — which
 * looks exactly like a bug. The only input here that can legitimately change
 * mid-session is reduced-motion, which framer's hook already subscribes to.
 */
function useTier() {
    const reduce = useReducedMotion();
    const [machine] = useState(() => {
        if (typeof navigator === "undefined") return {};
        return {
            memory: navigator.deviceMemory,
            cores: navigator.hardwareConcurrency,
            saveData: !!navigator.connection?.saveData,
        };
    });
    return useMemo(
        () => ({ tier: deviceTier({ ...machine, reducedMotion: !!reduce }), reduce: !!reduce }),
        [machine, reduce],
    );
}

export function ReelProvider({ children, startAt }) {
    const [actId, setActId] = useState(() => (indexOf(startAt) >= 0 ? startAt : ACTS[0].id));
    const [played, setPlayed] = useState(() => new Set([indexOf(startAt) >= 0 ? startAt : ACTS[0].id]));
    const [hand, setHand] = useState([]);
    const { tier, reduce } = useTier();

    /** id → element, filled by each <Act> as it mounts. */
    const nodes = useRef(new Map());
    const register = useCallback((id, el) => {
        if (el) nodes.current.set(id, el);
        else nodes.current.delete(id);
    }, []);

    /**
     * Reported BY the observer, never set by a navigation. See the header.
     * `played` only ever grows.
     */
    const report = useCallback((id) => {
        setActId(id);
        setPlayed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    }, []);

    const goTo = useCallback((id) => {
        const el = nodes.current.get(id);
        if (!el) return;
        // `smooth` is the browser's own easing and is the right call: it is
        // interruptible. A hand-rolled rAF tween would keep running while the
        // student flicks the wheel the other way, which is the fighting-page
        // failure again in a different costume.
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        // Focus follows the scroll so ↓ keeps working and a screen reader is
        // told where it has been taken. `preventScroll` because focus() would
        // otherwise jump the page a second time and undo the smooth scroll.
        el.focus?.({ preventScroll: true });
    }, [reduce]);

    /**
     * Pay an act out.
     *
     * `cardFor` REFUSES rather than inventing, so a null here is the normal
     * case — an act whose gesture has not happened yet simply does not add to
     * the hand. Guarded against a no-op state change so an observer firing on
     * every scroll frame cannot re-render the whole reel.
     */
    const deal = useCallback((id, state) => {
        const card = cardFor(id, state);
        if (!card) return;
        setHand((prev) => {
            const next = dealt(prev, card);
            if (next.length === prev.length) {
                const at = prev.findIndex((c) => c.id === card.id);
                if (at >= 0 && prev[at].label === card.label && prev[at].note === card.note) return prev;
            }
            return next;
        });
    }, []);

    const value = useMemo(() => ({
        actId, index: indexOf(actId), total: ACTS.length,
        // What the fixed chrome must paint itself against. See lib/reel.
        ground: groundOf(actId),
        played, hand, tier, reduce,
        register, report, goTo, deal,
    }), [actId, played, hand, tier, reduce, register, report, goTo, deal]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Deep-link support, kept deliberately one-way.
 *
 * A hash in the URL takes you to that act on arrival. We do NOT write the hash
 * back as you scroll: a page that rewrites the address bar on every act fills
 * the back button with ten entries, so leaving the site takes ten presses. That
 * is a genuinely hostile pattern and it is the default outcome of "sync state
 * to the URL" on a scroll deck.
 */
export function useHashEntry(goTo) {
    useEffect(() => {
        const id = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "");
        if (!id || indexOf(id) < 0) return;
        // After paint, or the act's element has no layout to scroll to yet.
        const t = setTimeout(() => goTo(id), 60);
        return () => clearTimeout(t);
    }, [goTo]);
}
