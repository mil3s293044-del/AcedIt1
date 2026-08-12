/**
 * AceReacts — he turns up the moment you finish something.
 *
 * Quizzes, active recall and blurting each end on their own results screen,
 * with their own layout and their own idea of what a score is. Editing three
 * screens to add a mascot to each gives you three mascots that drift apart.
 * So this is mounted once and every activity fires the same event at it —
 * exactly the shape `xp_awarded` and `streak_updated` already use.
 *
 *   window.dispatchEvent(new CustomEvent("ace:done", {
 *       detail: { pct: 82, what: "quiz" }
 *   }));
 *
 * `pct` is optional. Something with no score still gets a reaction, it just
 * gets the "you did the thing" one rather than a verdict.
 *
 * WHY HE COMES FROM THE BOTTOM: the results are above, and a character who
 * slides up from the edge doesn't cover them. Everything that finishes an
 * activity puts a number on the screen; landing on top of that number is the
 * one thing this must not do.
 *
 * He holds for six seconds and leaves on his own. No dismiss button — a
 * control to get rid of something that was already going means the thing
 * outstayed its welcome, and the fix for that is a shorter timer.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AceBody from "@/components/ace/AceBody";
import { AFTER, afterBand, pick } from "@/lib/aceVoice";
import { claimAce, useAceClaimed } from "@/components/ace/useAceYield";

const HOLD_MS = 6000;

/** Which pose fits which verdict. Rough gets warmth, not sympathy. */
const POSE = { great: "cheer", good: "happy", rough: "think", done: "wave" };

export default function AceReacts() {
    const [event, setEvent] = useState(null);
    const claimed = useAceClaimed("reacts");

    useEffect(() => {
        const on = (e) => {
            const pct = e?.detail?.pct;
            const band = afterBand(pct);
            setEvent({
                band,
                // Seeded by the score so the same result gives the same line —
                // a reaction that reshuffles on re-render reads as random.
                line: pick(AFTER[band], `${e?.detail?.what || "x"}-${Math.round(pct ?? -1)}`),
                at: e?.detail?.what || "",
            });
        };
        window.addEventListener("ace:done", on);
        return () => window.removeEventListener("ace:done", on);
    }, []);

    useEffect(() => {
        if (!event) return;
        const t = setTimeout(() => setEvent(null), HOLD_MS);
        return () => clearTimeout(t);
    }, [event]);

    // He's the whole character here, so nothing else gets to draw him at the
    // same time — the corner launcher stands down while he's reacting.
    const showing = Boolean(event) && !claimed;
    useEffect(() => (showing ? claimAce("reacts") : undefined), [showing]);

    return (
        <AnimatePresence>
            {showing && (
                <motion.div
                    key={event.line}
                    initial={{ y: 140, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 140, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    data-ace-reacts={event.band}
                    role="status"
                    className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 sm:bottom-8
                        flex items-end gap-2 pointer-events-none max-w-[calc(100vw-1.5rem)]"
                >
                    <AceBody className="w-20 sm:w-24 flex-shrink-0" pose={POSE[event.band]} title="Ace" />
                    <div className="rounded-2xl bg-surface border-2 border-border shadow-soft-lg
                        px-4 py-3 mb-2 relative">
                        {/* Tail toward him. `block` matters: an inline element
                            with borders and no box doesn't form a triangle. */}
                        <span aria-hidden="true"
                            className="block absolute left-0 bottom-4 -translate-x-full
                                border-y-8 border-y-transparent border-r-8 border-r-border" />
                        <span aria-hidden="true"
                            className="block absolute left-0 bottom-4 -translate-x-[calc(100%-2px)]
                                border-y-8 border-y-transparent border-r-8 border-r-surface" />
                        <p className="text-sm font-bold text-foreground leading-snug">{event.line}</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** One call for any activity that just finished. */
export function aceDone(what, pct) {
    window.dispatchEvent(new CustomEvent("ace:done", { detail: { what, pct } }));
}
