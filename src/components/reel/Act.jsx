/**
 * Act — one full-viewport beat of the reel.
 *
 * IT IS A REAL ELEMENT IN A REAL SCROLL CONTAINER. Not a fixed stage with
 * content swapped underneath it, which is the other way to build this and
 * costs you everything: no native scroll, no find-in-page, no deep link, no
 * screen reader order, nothing in the DOM for a crawler, and a back button that
 * means something different from what it says. The film is made by snap points
 * and staging, not by taking the page away from the browser.
 *
 * `tabIndex={-1}` and the `section` role are not decoration: `goTo` focuses the
 * act it scrolls to, so keyboard and assistive tech are told where they have
 * been taken instead of having the page move underneath them silently.
 */
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useReel, useAct } from "@/components/reel/ReelContext";

export default function Act({
    id,
    label,
    children,
    /** Paints the act's own ground. The reel has no single background. */
    className = "",
    /**
     * A few acts want the stage edge-to-edge (the storm, the brain). Most want
     * the readable column, which is what this gives them.
     */
    bare = false,
}) {
    const { register, report } = useReel();
    const { active, played } = useAct(id);
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        register(id, el);
        if (!el || typeof IntersectionObserver === "undefined") return undefined;

        /**
         * THRESHOLD 0.55, AND THE REASON MATTERS. At a low threshold two acts
         * are "visible" through most of a scroll and the reported act flickers
         * between them, which makes the chapter rail strobe and re-fires every
         * payout. Past half the viewport only one act can qualify at a time, so
         * the report is unambiguous by construction rather than by a debounce.
         */
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) if (e.isIntersecting) report(id);
            },
            { threshold: 0.55 },
        );
        io.observe(el);
        return () => { io.disconnect(); register(id, null); };
    }, [id, register, report]);

    return (
        <section
            ref={ref}
            id={id}
            tabIndex={-1}
            aria-label={label}
            data-act={id}
            data-active={active ? "" : undefined}
            /* THE CHROME IS FIXED AND THE CONTENT IS CENTRED, so the act has
               to reserve the space both of them occupy or they overlap it.
               Without this the eyebrow on the marking and subjects acts sat
               UNDER the nav bar — centred perfectly inside a box that was
               64px taller than the space actually available. The bottom
               reserve is for the hand rail, which appears as soon as the first
               act pays out and would otherwise cover a cue or a Continue
               button. Both are padding rather than margin so `justify-center`
               centres within what is left.

               THE BOTTOM NUMBER IS MEASURED AGAINST THE RAIL, not guessed, and
               it DIFFERS BY BREAKPOINT because the rail does. At pb-24 the
               full rail landed squarely on top of every act's cue — the one
               control telling the reader what to do next. On a phone the rail
               collapses to a 32px pill, so reserving 128px there would be
               throwing away a sixth of a screen that is already too small for
               these acts. If either changes, this changes with it. */
            className={`act-h act-snap relative w-full flex flex-col items-center justify-center
                        overflow-hidden outline-none
                        pt-20 pb-20 sm:pt-24 sm:pb-32 ${className}`}
        >
            {bare ? children : (
                <motion.div
                    className="relative z-10 w-full max-w-5xl px-6 sm:px-8"
                    /**
                     * STAGED ON FIRST PLAY ONLY. `played` is sticky, so an act
                     * you scroll back through is simply there — it does not
                     * re-stage. A film that replays its third act every time
                     * you glance back at it is exhausting, not impressive.
                     */
                    initial={{ opacity: 0, y: 28 }}
                    animate={played ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                    {children}
                </motion.div>
            )}
        </section>
    );
}
