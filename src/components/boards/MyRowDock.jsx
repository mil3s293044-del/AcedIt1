/**
 * MyRowDock — your row, holding on at the edge of the screen it left by.
 *
 * Being 18th on a board of thirty and having to hunt for your own name is how
 * a leaderboard stops being motivating. So when your row leaves the screen it
 * FOLLOWS you: scroll down past it and it holds on at the TOP; open a long
 * board from the podium and it waits at the BOTTOM. The edge it is on says
 * which way the real row is, and tapping it scrolls you back and pulses the
 * row so the landing is unmistakable (`dockSide` in boardKit.js is the rule).
 *
 * It only appears while the real row is off screen — a permanent copy would be
 * a second, smaller answer to a question already in front of you. The screen
 * it watches is the part a student can SEE: the sticky top bar (48px) and, on
 * a phone, the bottom nav are taken off the observed area, or a row sitting
 * under either would count as visible and nothing would follow.
 *
 * ABOVE the bottom nav on a phone, which is `md:hidden fixed bottom-0` at about
 * 72px tall and `z-40`. Under it, this is a control nobody can reach. At the
 * top it clears the sticky top bar the same way.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { dockSide } from "@/lib/boardKit";

const TOP_BAR = 48;
const BOTTOM_NAV = 76;

const bottomInset = () => (typeof window !== "undefined"
    && window.matchMedia?.("(min-width: 768px)")?.matches ? 0 : BOTTOM_NAV);

/**
 * Which edge your row should hold on at, or null while it is on screen.
 * `watch` is anything that changes when the row could have been replaced by
 * another element — the board, the scope, the collapse — so the observer is
 * re-attached to whichever element is your row now.
 */
export function useDockSide(targetRef, watch = "") {
    const [side, setSide] = useState(null);
    useEffect(() => {
        const el = targetRef.current;
        // Nothing to observe when you are on the podium (always near the top)
        // or not on this board at all.
        if (!el || typeof IntersectionObserver !== "function") { setSide(null); return undefined; }
        let visible = true;
        let frame = 0;
        const io = new IntersectionObserver(
            ([entry]) => {
                visible = entry.isIntersecting;
                setSide(dockSide({
                    visible,
                    rowTop: entry.boundingClientRect.top,
                    viewTop: entry.rootBounds?.top ?? TOP_BAR,
                }));
            },
            // A row half out of view is still a row you can see, so the dock
            // waits until it is genuinely gone.
            { threshold: 0.4, rootMargin: `-${TOP_BAR}px 0px -${bottomInset()}px 0px` });
        // THE OBSERVER ONLY REPORTS A CROSSING. A fling (or a jump to the top)
        // can carry the row from below the screen to above it between two
        // frames, and with no frame in which it was visible nothing fires —
        // so the dock stayed at the bottom pointing down at a row that was
        // now above. While the row is off screen, the edge is read on scroll.
        const read = () => {
            frame = 0;
            setSide(dockSide({ visible, rowTop: el.getBoundingClientRect().top, viewTop: TOP_BAR }));
        };
        const onScroll = () => { if (!visible && !frame) frame = requestAnimationFrame(read); };
        window.addEventListener("scroll", onScroll, { passive: true });
        io.observe(el);
        return () => {
            io.disconnect();
            window.removeEventListener("scroll", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [targetRef, watch]);
    return side;
}

/**
 * Where the dock sits on each edge. At the BOTTOM it stops short of the right
 * edge, because that corner is Ace's: his launcher is `fixed right-4 bottom-24`
 * on a phone and `md:right-6 md:bottom-6` above it, and a dock running the
 * full width drew straight over him — the collision the chat composer once
 * had with the same launcher. Moving the dock costs nothing; hiding him for
 * as long as somebody is scrolled past their own row would be the app
 * switching its mascot off for reading a leaderboard. The top edge has
 * nothing in it, so the dock takes its full width there.
 */
const SPOT = {
    top: "top-14 left-3 right-3 sm:left-auto sm:right-6 sm:w-[24rem]",
    bottom: "bottom-[5.25rem] md:bottom-5 left-3 right-[5.5rem] sm:left-auto sm:right-28 sm:w-[22rem]",
};

export default function MyRowDock({ side, onReturn, label = "Back to your row", children }) {
    return (
        <AnimatePresence>
            {side && (
                <motion.button key={side} type="button" onClick={onReturn} data-dock={side}
                    aria-label={label}
                    initial={{ opacity: 0, y: side === "top" ? -18 : 18, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: side === "top" ? -18 : 18, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className={`fixed z-30 ${side === "top" ? SPOT.top : SPOT.bottom}
                        flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 rounded-2xl text-left
                        bg-surface border-2 border-primary/50 shadow-xl
                        active:scale-[0.98] transition-transform`}>
                    {children}
                    {side === "top"
                        ? <ArrowUp className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />
                        : <ArrowDown className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />}
                </motion.button>
            )}
        </AnimatePresence>
    );
}
