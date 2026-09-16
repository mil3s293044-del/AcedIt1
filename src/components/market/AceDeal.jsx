/**
 * AceDeal — Ace deals the board while it loads.
 *
 * ═══ Why this and not the app's normal loader ═══════════════════════════════
 * `AceShuffle` is the right answer on the twenty-five screens that use it: a
 * riffling deck beside "Loading your dashboard…", small and out of the way. The
 * floor is the one place where that is the wrong shape, because opening it is
 * an ARRIVAL. A student lands on a dark room they have not seen before, and the
 * thing they are waiting for is a table with cards on it.
 *
 * So the wait IS the deal. Ace flicks cards out and they land on the grid where
 * the real markets are about to be, face down, one after another. When the data
 * arrives they are already in position — which is the part that matters:
 *
 * **IT IS THE SKELETON, NOT A CURTAIN IN FRONT OF ONE.** An animation that
 * plays and THEN hands over to a loading state has made the student wait twice
 * and told them nothing. These cards are laid out on the same grid, at the same
 * size, in the same places; the content fills in underneath them. Nothing jumps.
 *
 * ═══ THE MASCOT HAS TO BE THE THING THAT MOVES ══════════════════════════════
 * The first version of this was six cards springing in past a STILL DRAWING of
 * Ace: `pose="toss"` set once, `idle={false}`, `eyes={false}`. Every one of
 * those is a switch that turns his own motion off, so the only animation on
 * screen was the cards, and the character — the entire reason to do this rather
 * than draw a spinner — was a picture beside them. A mascot who does not move
 * while six cards fly past him is not dealing them; he is watching.
 *
 * He deals A ROW AT A TIME, which is what dealing onto a two-column table
 * actually looks like, and it is also what makes the flick legible: three
 * tosses with a real beat between them, rather than six at a speed where the
 * arm never finishes travelling. Each beat is toss → recover, so the arm
 * SWINGS and comes back instead of resting in the thrown position.
 *
 * ═══ AND HE OUTLASTS THE DEAL WITHOUT OUTLASTING THE LOAD ═══════════════════
 * Three things happen in order and only the first is on a clock the loader
 * controls:
 *
 *   DEALING — one row per beat, three beats. The cards fly from HIS corner:
 *             the further down and across a slot is, the further its card has
 *             travelled, so the six of them fan out of one point rather than
 *             sliding in from the same offset six times.
 *   PLEASED — the board is full, so he is `proud`: eyes arced, hands on hips.
 *             The deal has a finish rather than a stop.
 *   HIS OWN  — and then he is simply standing there with `idle` on, and his
 *             own fidget system takes over: a glance, a stretch, a riffle. A
 *             slow load is the ONE case a loader cannot design for, and the
 *             answer is the character's own behaviour rather than a loop that
 *             gets more annoying the longer it runs.
 *
 * The deal is over inside two seconds and it never delays anything: if the
 * data is already there this does not render at all. Under
 * `prefers-reduced-motion` every timer is skipped, the cards are simply placed
 * and he simply stands — the layout is identical, nothing moves.
 */
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import AceBody from "@/components/ace/AceBody";

/**
 * The floor's literal ink, taken from `MarketCard` so the dealt shape and the
 * card that replaces it are the same object. Not tokens — the room renders
 * identically in both themes, and a token that flips underneath a deliberately
 * fixed room is the bug rather than the fix.
 *
 * `AceBody` takes `tone`/`card` as CLASS NAMES, not colours, so those are
 * written as Tailwind arbitrary values. Static strings, never assembled: JIT
 * cannot see a class built from a template literal, which is the recurring
 * gotcha this codebase records.
 */
const FELT_CARD = "#121C2E";        // MarketCard's own ground
const FELT_EDGE = "#233247";        // and its own border
const FELT_BONE = "#1B2840";        // the placeholder bars, a step up from the ground
const FELT_TEXT = "#6F86A8";

/** As many as the grid shows before a student scrolls. More is a longer wait. */
const DEALT = 6;
/** Two columns, so a row is two cards and the deal has three beats. */
const PER_ROW = 2;
const ROWS = Math.ceil(DEALT / PER_ROW);

/** One beat of the deal: the flick, then the arm coming back. */
const BEAT_MS = 400;
const FLICK_MS = 265;
/** How long he holds the finish before going back to being himself. */
const PLEASED_MS = 1100;

/**
 * Where a card starts, relative to where it lands.
 *
 * Ace stands above the grid's left edge, so every card has to travel back
 * toward him to have come FROM him — further for the right-hand column, and
 * further again for each row down. Approximate on purpose: these are start
 * offsets on an element whose final position is set by the grid, so being a
 * few pixels out changes the arc and can never change the layout.
 */
function fromAce(i) {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    return {
        x: -(60 + col * 210),
        y: -(70 + row * 145),
        rotate: -22 - col * 8,
        scale: 0.82,
        opacity: 0,
    };
}

/** One card, flicked from Ace and landing in its place on the grid. */
function DealtCard({ i, dealt, frozen }) {
    const settled = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };
    // It is in the air only once its ROW has been thrown. Before that it is
    // held, which is why it is invisible rather than merely offset.
    const out = frozen || dealt > Math.floor(i / PER_ROW);
    return (
        <motion.div
            aria-hidden
            initial={frozen ? settled : fromAce(i)}
            animate={out ? settled : fromAce(i)}
            transition={frozen ? { duration: 0 } : {
                // Springy on the way in, because a dealt card has weight. The
                // pair is offset by a beat of its own so a row reads as two
                // cards thrown from one hand, not as a bar dropping in.
                type: "spring", stiffness: 240, damping: 24,
                delay: (i % PER_ROW) * 0.07,
            }}
            className="rounded-2xl border-2 h-[132px] p-4 flex flex-col justify-between"
            style={{ background: FELT_CARD, borderColor: FELT_EDGE }}
        >
            {/* The shape of a market card, at its real size, so the content
                fills in underneath rather than pushing anything about. */}
            <div className="space-y-2">
                <div className="h-2.5 rounded-full w-1/3" style={{ background: FELT_BONE }} />
                <div className="h-3 rounded-full w-4/5" style={{ background: FELT_BONE }} />
            </div>
            <div className="h-2 rounded-full w-full" style={{ background: FELT_BONE }} />
        </motion.div>
    );
}

/**
 * The deal, as a clock.
 *
 * `dealt` counts the rows already thrown and `flicking` is whether the arm is
 * mid-throw — one state each, because his pose and the cards have to be driven
 * by the SAME count or the flick and the landing drift apart on a slow frame.
 */
function useDeal(frozen) {
    const [dealt, setDealt] = useState(frozen ? ROWS : 0);
    const [flicking, setFlicking] = useState(false);
    const [pleased, setPleased] = useState(false);

    useEffect(() => {
        if (frozen) return undefined;
        const timers = [];
        for (let r = 0; r < ROWS; r += 1) {
            const at = r * BEAT_MS;
            timers.push(setTimeout(() => setFlicking(true), at));
            // The card leaves his hand PART WAY through the flick, not at the
            // start of it — a card that departs before the arm moves reads as
            // two unrelated animations.
            timers.push(setTimeout(() => { setDealt(r + 1); setFlicking(false); },
                at + FLICK_MS));
        }
        const done = ROWS * BEAT_MS;
        timers.push(setTimeout(() => setPleased(true), done));
        // …and then he stops performing and goes back to being himself.
        timers.push(setTimeout(() => setPleased(false), done + PLEASED_MS));
        return () => timers.forEach(clearTimeout);
    }, [frozen]);

    return { dealt, flicking, pleased };
}

export default function AceDeal({ label = "Opening the floor…" }) {
    const reduce = useReducedMotion();
    const { dealt, flicking, pleased } = useDeal(reduce);

    const done = dealt >= ROWS;
    // One expression, so what he is doing can never disagree with what the
    // cards are doing. `stand` is the only resting pose here, which is what
    // lets his own idles fire once the deal is over.
    // `stand` is the recovery on purpose: it is the biggest arm delta from
    // `toss` in the pose table, and at 56px the arm is the only part of him
    // large enough to read as a throw. `offer` was the first choice and its
    // hands sit almost where the toss leaves them, so the flick disappeared.
    const pose = reduce ? "stand"
        : flicking ? "toss"
            : pleased ? "proud"
                : "stand";

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-5">
                {/* Small: he is dealing the table, not presenting it. At the
                    size AceIntro uses he would be the content. */}
                <AceBody
                    className="w-14 flex-shrink-0"
                    pose={pose}
                    tone="fill-[#E8F0FB]"
                    card="fill-[#121C2E]"
                    cardStroke="stroke-[#233247]"
                    // ON, both of them. These were the switches that made the
                    // first version a still drawing: without idles he freezes
                    // the moment the deal ends, and without eyes he does not
                    // look at the person waiting.
                    idle={done}
                    eyes
                    title="Ace dealing the board"
                />
                <p className="text-sm font-bold" style={{ color: FELT_TEXT }}>{label}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                {Array.from({ length: DEALT }, (_, i) => (
                    <DealtCard key={i} i={i} dealt={dealt} frozen={reduce} />
                ))}
            </div>
        </div>
    );
}
