/**
 * Reel — the shell the acts sit in: the snap decision, the keys, the rails.
 *
 * THE SNAP DECISION IS THE ONE THAT CAN BREAK THE PAGE, so it is made by
 * measurement rather than by preference.
 *
 * `scroll-snap-type: y mandatory` is what makes this feel like a deck being
 * turned rather than a page being scrolled, and it has one catastrophic
 * failure: if an act's content is TALLER than the viewport, mandatory snap
 * makes the overflow physically unreachable. You scroll, and the container
 * yanks you back to the act's top edge — forever. A phone in landscape, a
 * student with large type set, a long subject list on the wizard's second
 * step: any of those, and the content below the fold cannot be reached at all.
 *
 * So: `proximity` by default, which can never trap, and an upgrade to
 * `mandatory` only once every act has been MEASURED to fit. The measurement is
 * re-run on resize, because that is a thing that genuinely changes the answer,
 * unlike the device tier next door. The difference between the two modes is a
 * polish layer — advancing is `scrollIntoView` either way, which snaps crisply
 * no matter what the CSS says.
 *
 * KEYS ARE NEVER STOLEN FROM AN INPUT. The back half of this reel is a form:
 * the student types a course name, searches subjects, tabs through options. A
 * global ↓ handler that scrolls the page while somebody is arrowing through a
 * combobox is the fastest way to make a wizard unusable. Everything bails on a
 * focused field, on a modifier, and on anything inside a dialog.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ACTS, step, reelProgress } from "@/lib/reel";
import { ReelProvider, useReel, useHashEntry } from "@/components/reel/ReelContext";
import ChapterRail from "@/components/reel/ChapterRail";
import HandRail from "@/components/reel/HandRail";

/** Is the keyboard currently somebody's, rather than ours? */
function typingInto(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    // A dialog owns its own keys entirely — including Escape and the arrows
    // inside a listbox — so we stand down for the whole subtree.
    return !!el.closest?.('[role="dialog"], [role="listbox"], [data-reel-keys="off"]');
}

function Shell({ children, tail }) {
    const reel = useReel();
    const { actId, goTo, hand } = reel;
    /**
     * THE HAND IS SPREAD OUT INSIDE THE TURN ITSELF, so the rail stands down
     * there. Two copies of one object on one screen reads as a rendering fault
     * rather than as a flourish — the wizard's own reveal step already learned
     * this and hides its rail for exactly the same reason.
     *
     * And on the sign-in act, where the student is typing into a form pinned
     * near the bottom of the viewport, a row of cards floating over the submit
     * button is not a flourish either.
     */
    const railVisible = actId !== "hand" && actId !== "signin";
    const trackRef = useRef(null);
    const [snap, setSnap] = useState("proximity");

    useHashEntry(goTo);

    /* ── The measurement ───────────────────────────────────────────────── */
    useEffect(() => {
        const measure = () => {
            const acts = document.querySelectorAll("[data-act]");
            if (!acts.length) return;
            const vh = window.innerHeight;
            // A few pixels of slack: an act at exactly 100svh measures a
            // fraction over on some zoom levels, and demoting the whole reel
            // to proximity over a rounding error would be silly.
            let fits = true;
            for (const a of acts) if (a.scrollHeight > vh + 4) { fits = false; break; }
            setSnap(fits ? "mandatory" : "proximity");
        };
        measure();
        window.addEventListener("resize", measure, { passive: true });
        // Content can grow after paint — a font loads, the subject list fills
        // in — so re-measure when the acts themselves change size, not only
        // when the window does.
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        if (ro) document.querySelectorAll("[data-act]").forEach((a) => ro.observe(a));
        return () => { window.removeEventListener("resize", measure); ro?.disconnect(); };
    }, []);

    useEffect(() => {
        const el = trackRef.current;
        if (el) el.style.setProperty("--reel-snap", snap);
    }, [snap]);

    /* ── The keys ──────────────────────────────────────────────────────── */
    const onKey = useCallback((e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (typingInto(document.activeElement)) return;

        const fwd = ["ArrowDown", "ArrowRight", "PageDown"];
        const back = ["ArrowUp", "ArrowLeft", "PageUp"];
        // Space pages forward, Shift+Space back — the browser's own convention,
        // which is worth keeping rather than inventing one.
        if (e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            goTo(step(actId, e.shiftKey ? -1 : 1));
            return;
        }
        if (fwd.includes(e.key)) { e.preventDefault(); goTo(step(actId, 1)); return; }
        if (back.includes(e.key)) { e.preventDefault(); goTo(step(actId, -1)); return; }
        if (e.key === "Home") { e.preventDefault(); goTo(ACTS[0].id); return; }
        if (e.key === "End") { e.preventDefault(); goTo(ACTS[ACTS.length - 1].id); }
    }, [actId, goTo]);

    useEffect(() => {
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onKey]);

    const progress = reelProgress(actId);

    return (
        <>
            {/* The film's own progress. One hairline, at the very top, and it
                measures ACTS rather than scroll height — the credits tail below
                is not part of the film and must not drag the bar to 40%. */}
            <motion.div
                aria-hidden
                className="fixed top-0 left-0 right-0 h-[3px] z-[70] origin-left bg-primary"
                style={{ scaleX: progress }}
                initial={false}
                animate={{ scaleX: progress }}
                transition={{ type: "spring", stiffness: 120, damping: 26 }}
            />

            <ChapterRail />

            <div ref={trackRef} className="reel-track">
                {children}
            </div>

            {/* The hand is fixed over everything and is the one object that
                survives the whole film — including the seam into the wizard,
                which is the entire reason it exists. */}
            <HandRail cards={railVisible ? hand : []} />

            {/* The credits: reference, below the film, deliberately un-snapped.
                Giving this snap points would make LEAVING the film feel like
                being detained by it. */}
            {tail}
        </>
    );
}

export default function Reel({ children, tail, startAt }) {
    return (
        <ReelProvider startAt={startAt}>
            <Shell tail={tail}>{children}</Shell>
        </ReelProvider>
    );
}
