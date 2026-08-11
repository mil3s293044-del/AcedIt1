/**
 * AcePerch — Ace hops up and sits on the edge of a button.
 *
 * This is the one animation in the set with a real cost attached, so the rules
 * are tighter than the rest:
 *
 * 1. ONE PER SCREEN. A mascot on every button is a mascot on nothing. He goes
 *    on the single action a page wants you to take, and only when that page
 *    genuinely has one — an empty state, a first run, a dead end.
 *
 * 2. HE NEVER BLOCKS THE CLICK. `pointer-events-none` throughout, and he sits
 *    ABOVE the button's top edge rather than over its label. A decoration that
 *    eats taps on the primary CTA is worse than no decoration.
 *
 * 3. HE ARRIVES ONCE. The hop plays on mount and then he settles into a small
 *    idle. A button with something bouncing on it forever is a button people
 *    learn to look away from.
 *
 * Usage — wrap the button in a positioned box:
 *
 *   <span className="relative inline-block">
 *     <Button>Start your first session</Button>
 *     <AcePerch />
 *   </span>
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import AceBody from "@/components/ace/AceBody";
import { useAceClaimed } from "@/components/ace/useAceYield";

// He sits on the CORNER, hanging slightly off the edge, rather than inside the
// button's horizontal span. At `right-3` on a narrow button he covered the
// label — "Start a session" rendered as "a session" — and a decoration that
// eats the words on the primary CTA is a bug, not a flourish.
const SIDE = {
    left: "-left-2",
    right: "-right-2",
    center: "left-1/2 -translate-x-1/2",
};

export default function AcePerch({
    side = "right",
    size = "w-14",
    delay = 0.35,
    label,
}) {
    const reduce = useReducedMotion();
    // He is one character. With the companion already standing in the corner
    // there were three of him on the Dashboard at once — companion, perch and
    // empty state — which stops reading as a mascot and starts reading as a
    // pattern. The perch is the one that yields: it's decoration, and the
    // companion is mid-conversation.
    const claimed = useAceClaimed();

    // The arc: crouch, spring up and over, land with a squash, settle.
    // `times` is what makes it read as a jump rather than a slide — the rise is
    // fast, the landing is abrupt, and the recovery is slow.
    const hop = reduce
        ? { opacity: 1, y: 0 }
        : {
            opacity: [0, 1, 1, 1, 1],
            y: [26, -14, 0, -3, 0],
            scaleY: [0.8, 1.08, 0.82, 1.02, 1],
            scaleX: [1.15, 0.95, 1.18, 0.99, 1],
            transition: { duration: 0.72, times: [0, 0.35, 0.6, 0.8, 1], delay, ease: "easeOut" },
        };

    if (claimed) return null;

    return (
        <span
            aria-hidden={label ? undefined : "true"}
            role={label ? "img" : undefined}
            aria-label={label}
            data-ace-perch={side}
            className={`absolute -top-12 ${SIDE[side] || SIDE.right} pointer-events-none z-10`}
        >
            <motion.span className="block origin-bottom" initial={reduce ? false : { opacity: 0, y: 26 }} animate={hop}>
                {/* Once he's landed, his own idle takes over — a small bob and
                    the blink loop. `alive={false}` would stop the bob but it
                    stops the blinking too, and an unblinking mascot on a button
                    reads as a sticker rather than a character. */}
                <AceBody className={size} pose="wave" />
            </motion.span>
        </span>
    );
}
