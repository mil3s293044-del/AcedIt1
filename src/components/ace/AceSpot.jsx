/**
 * AceSpot — Ace placed on a page: he arrives, does the thing he was put there
 * to do, settles, and reacts when something happens beside him.
 *
 * The rules are in `src/lib/aceSpot.js`. This is the wiring:
 *
 *   <AceSpot pose="point" entrance="rise" cue={ace.cue} className="w-16" />
 *
 * `pose` is what he does on arrival (and again whenever it changes); he then
 * settles into the nearest resting pose and fidgets every 8–12 seconds. A
 * page tells him what happened with `useAceCue`:
 *
 *   const ace = useAceCue();
 *   ace.react("added");            // a SAC tracked: he cheers, then settles
 *   <Button {...ace.hover("eager")}>  // he leans in while you hover it
 *
 * These are ILLUSTRATIONS, not the floating Ace, so they claim no stage in
 * `ACE_ORDER`: they do not talk, follow you or compete for the corner.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import AceBody from "@/components/ace/AceBody";
import {
    CALM_IDLE, INTRO_MS, ARRIVE_DELAY, cueFor, shownPose, isTextEntry, entranceFor,
} from "@/lib/aceSpot";

/** A cue for an AceSpot: fire an event, or hold a pose while hovered. */
export function useAceCue() {
    const [cue, setCue] = useState(null);
    const react = useCallback((event) => setCue((prev) => cueFor(event, prev)), []);
    const release = useCallback(() => setCue((prev) => (prev?.ms === null ? { pose: null, ms: null, n: (prev?.n || 0) + 1 } : prev)), []);
    const hover = useCallback((event = "eager") => ({
        onPointerEnter: (e) => { if (e.pointerType !== "touch") react(event); },
        onPointerLeave: release,
    }), [react, release]);
    return useMemo(() => ({ cue, react, release, hover }), [cue, react, release, hover]);
}

/** True while any text field on the page has focus. */
function useTyping() {
    const [typing, setTyping] = useState(() => typeof document !== "undefined" && isTextEntry(document.activeElement));
    useEffect(() => {
        const sync = () => setTyping(isTextEntry(document.activeElement));
        // focusout fires BEFORE the next element takes focus, so it is read a
        // tick later or tabbing between two fields reads as "stopped typing".
        const later = () => setTimeout(sync, 0);
        document.addEventListener("focusin", sync);
        document.addEventListener("focusout", later);
        return () => {
            document.removeEventListener("focusin", sync);
            document.removeEventListener("focusout", later);
        };
    }, []);
    return typing;
}

export default function AceSpot({
    pose = "stand",
    intro = null,
    entrance = "rise",
    cue = null,
    hold = false,
    delay = ARRIVE_DELAY,
    className = "w-16",
    bodyClassName = "w-full",
    idle = true,
    ...bodyProps
}) {
    const reduce = useReducedMotion();
    const typing = useTyping();
    const [introDone, setIntroDone] = useState(false);
    const [live, setLive] = useState(null);
    const timer = useRef(null);

    // The arrival gesture, and again every time the page changes what he is
    // saying (a verdict turning, an answer in the check-in): do it, then settle.
    useEffect(() => {
        setIntroDone(false);
        const t = setTimeout(() => setIntroDone(true), INTRO_MS + delay * 1000);
        return () => clearTimeout(t);
    }, [pose, intro, delay]);

    // A reaction plays for its length, or until released when it is held.
    useEffect(() => {
        clearTimeout(timer.current);
        if (!cue) return undefined;
        setLive(cue.pose ? cue : null);
        if (cue.pose && cue.ms) timer.current = setTimeout(() => setLive(null), cue.ms);
        return () => clearTimeout(timer.current);
    }, [cue]);

    const shown = shownPose({ pose, intro, reduce, introDone, cue: live, hold });
    const motionProps = entranceFor(entrance, { reduce, delay });

    return (
        <motion.div className={className} style={{ transformOrigin: "50% 100%" }}
            data-ace-spot={entrance} data-ace-pose={shown} {...motionProps}>
            <AceBody className={bodyClassName} pose={shown}
                idle={idle && !typing && !live}
                idleEvery={CALM_IDLE} {...bodyProps} />
        </motion.div>
    );
}
