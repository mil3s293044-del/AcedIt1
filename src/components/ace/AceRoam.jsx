/**
 * AceRoam — Ace walks across the page to a real element and points at it.
 *
 * Everything before this put him in a corner and had him talk about things
 * elsewhere on the screen. That's a chat bubble with a mascot on it. The thing
 * that makes a companion feel like one is that he goes to the thing: you say
 * "what should I do", and he walks over to the button and stands next to it.
 *
 * HOW IT WORKS. He's `position: fixed` and driven by two motion values. Given
 * a target — a CSS selector or an element — he measures it with
 * `getBoundingClientRect`, picks the side with more room, and springs to a
 * standing position beside it. While the distance is closing he's in his walk
 * cycle; when it stops he settles into whatever pose was asked for.
 *
 * THE PARTS THAT ARE EASY TO GET WRONG, and what's done about each:
 *
 *   - SCROLLING. A fixed element beside a document-flow target drifts the
 *     moment anything scrolls. He re-measures on scroll and resize, both
 *     passive and both coalesced into a frame.
 *
 *   - THE TARGET VANISHING. Pages re-render; the element he was walking to
 *     can disappear mid-stride. If a measure comes back empty he stops where
 *     he is rather than teleporting to 0,0.
 *
 *   - OFF-SCREEN TARGETS. If the thing is scrolled out of view he doesn't
 *     march off the edge of the window — he holds at the nearest edge, which
 *     reads as him waiting for you to scroll to it.
 *
 *   - BLOCKING THE THING HE'S POINTING AT. He stands BESIDE the target, never
 *     over it, and he's pointer-events-none. A guide that covers the button
 *     it's recommending is worse than no guide.
 *
 *   - REDUCED MOTION. No walk. He appears at the destination.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import AceBody from "@/components/ace/AceBody";
import { useAceClaimed, claimAce } from "@/components/ace/useAceYield";

/** How close counts as arrived, in px. */
const ARRIVED = 6;
/** Frames of the walk cycle. */
const STEP_MS = 150;
/**
 * His footprint, used to keep him inside the window and to place him beside a
 * target. It has to be at least as wide as he actually renders — at `w-24` he
 * is 96px, and an 88 here put him 2px over the target's left edge on the
 * flipped side. Rounded up rather than measured, because measuring costs a
 * layout read on every scroll frame to save four pixels.
 */
const W = 104, H = 96;

function measure(target) {
    if (!target) return null;
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (!b.width && !b.height) return null;
    return b;
}

/**
 * Where he stands relative to a target: whichever side has room, feet level
 * with the bottom of the element so he reads as standing next to it rather
 * than floating alongside.
 */
function spotFor(b, vw, vh) {
    const right = vw - b.right;
    const onLeft = right < W + 16 && b.left > W + 16;
    const x = onLeft ? b.left - W - 6 : b.right + 4;
    const y = b.bottom - H + 6;
    return {
        x: Math.max(4, Math.min(vw - W - 4, x)),
        y: Math.max(4, Math.min(vh - H - 4, y)),
        // He points back toward the target when he had to stand on its left.
        flip: onLeft,
    };
}

/**
 * How long he stands at one place before wandering to the next, when given
 * more than one. Long enough to read what he's next to; short enough that a
 * page with three things worth seeing shows you all three.
 */
const DWELL_MS = 9000;

export default function AceRoam({
    /** A selector/element, or an array of them to wander between. */
    target,
    pose = "point",
    size = "w-20 sm:w-24",
    label = "Ace",
    children,
    onArrive,
}) {
    const reduce = useReducedMotion();
    // He is one character: if the companion is already drawing him, this
    // doesn't get to draw a second one across the page.
    const claimed = useAceClaimed("roam");
    const x = useMotionValue(-200), y = useMotionValue(-200);
    const sx = useSpring(x, { stiffness: 46, damping: 15, mass: 1.1 });
    const sy = useSpring(y, { stiffness: 46, damping: 15, mass: 1.1 });
    const [walking, setWalking] = useState(false);
    const [step, setStep] = useState(0);
    const [flip, setFlip] = useState(false);
    const [ready, setReady] = useState(false);
    const [leg, setLeg] = useState(0);
    const placed = useRef(false);
    // Bounds the skip below. Without it, a tour whose stops have ALL gone
    // would advance the leg on every scroll frame forever.
    const misses = useRef(0);

    // A list means he tours. Normalised here so the rest of the component
    // only ever deals with one destination at a time.
    const stops = Array.isArray(target) ? target.filter(Boolean) : [target];
    const here = stops[leg % Math.max(1, stops.length)];

    useEffect(() => {
        if (stops.length < 2 || reduce) return;
        const t = setInterval(() => setLeg((n) => n + 1), DWELL_MS);
        return () => clearInterval(t);
    }, [stops.length, reduce]);

    const place = useCallback(() => {
        const b = measure(here);
        // A target that has gone: hold position rather than snapping to 0,0.
        //
        // On a tour, though, holding is wrong — a stop that isn't on this
        // page (an empty "On your radar" renders nothing) would strand him
        // there for good. He skips to the next one instead, at most once
        // around the loop before giving up until the next dwell tick.
        if (!b) {
            if (stops.length > 1 && misses.current < stops.length) {
                misses.current += 1;
                setLeg((n) => n + 1);
            }
            return;
        }
        misses.current = 0;
        const s = spotFor(b, window.innerWidth, window.innerHeight);
        setFlip(s.flip);
        if (!placed.current) {
            placed.current = true;
            // First placement comes in from off the nearest edge, so his
            // arrival is a walk rather than a fade.
            if (!reduce) {
                x.jump?.(s.x > window.innerWidth / 2 ? window.innerWidth + 40 : -120);
                y.jump?.(s.y);
            }
            setReady(true);
        }
        x.set(s.x);
        y.set(s.y);
    }, [here, reduce, x, y]);

    useEffect(() => {
        place();
        let frame = 0;
        const onScroll = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => { frame = 0; place(); });
        };
        window.addEventListener("scroll", onScroll, { passive: true, capture: true });
        window.addEventListener("resize", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true });
            window.removeEventListener("resize", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [place]);

    // "Walking" is derived from the gap between where he is and where he's
    // going, rather than from a timer — so a target that moves under him keeps
    // him walking for exactly as long as it takes to catch up.
    useEffect(() => {
        if (reduce) return;
        let arrived = false;
        const check = () => {
            const gap = Math.hypot(sx.get() - x.get(), sy.get() - y.get());
            const moving = gap > ARRIVED;
            setWalking(moving);
            if (!moving && !arrived) { arrived = true; onArrive?.(); }
            if (moving) arrived = false;
        };
        const unsub = [sx.on("change", check), sy.on("change", check)];
        return () => unsub.forEach((f) => f());
    }, [sx, sy, x, y, reduce, onArrive]);

    // He also CLAIMS him while he's out roaming, so the corner launcher
    // stands down. Claiming and yielding are two halves of the same rule:
    // whoever is drawing him says so, and everyone else defers.
    useEffect(() => (ready && !claimed ? claimAce("roam") : undefined), [ready, claimed]);

    useEffect(() => {
        if (!walking || reduce) { setStep(0); return; }
        const t = setInterval(() => setStep((s) => (s > 0 ? -1 : 1)), STEP_MS);
        return () => clearInterval(t);
    }, [walking, reduce]);

    if (!ready || claimed) return null;

    return (
        <motion.div
            data-ace-roam={walking ? "walking" : "arrived"}
            style={{ x: reduce ? x : sx, y: reduce ? y : sy }}
            className="fixed left-0 top-0 z-40 pointer-events-none flex items-end gap-2"
        >
            {/* HE is the way in to the chat panel while he's out here.
                The corner launcher stands down whenever he's roaming, so
                without this there'd be no way to open Ace at all from a page
                he's walking on. The wrapper stays pointer-events-none — only
                the figure itself is hittable, so he can stand near a button
                without stealing its clicks.

                Mirrored when he's on the target's left, so he always points
                TOWARD the thing rather than away from it. */}
            <button type="button" data-ace-roam-open
                onClick={() => window.dispatchEvent(new CustomEvent("ace:open"))}
                aria-label="Open Ace, your guide to AcedIt"
                className="pointer-events-auto"
                style={flip ? { transform: "scaleX(-1)" } : undefined}>
                <AceBody className={size} pose={walking ? "walk" : pose}
                    step={step} title={label} idle={!walking} />
            </button>
            {children && <div className="pointer-events-auto pb-2">{children}</div>}
        </motion.div>
    );
}
