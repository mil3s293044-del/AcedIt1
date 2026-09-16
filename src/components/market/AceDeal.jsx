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
 * ═══ It uses the character that already exists ══════════════════════════════
 * `pose="toss"` is Ace flicking a card out of frame and watching it go — it was
 * written for a gag and it is exactly a deal. No new artwork, no second Ace,
 * and he arrives the way he arrives everywhere else. The one thing that had to
 * change is the INK: the floor renders in literal colours in both themes (see
 * the Compete section of CLAUDE.md), so `tone` and `card` are passed literals
 * rather than the tokens he takes elsewhere. A token that flips underneath a
 * deliberately fixed room is the bug, not the fix.
 *
 * ═══ A LOADER MUST NOT OUTLAST THE LOAD ════════════════════════════════════
 * The deal is 90ms a card and the whole thing settles inside a second. If the
 * data is already there it never renders at all — an animation that delays
 * content the browser is holding is worse than a spinner, however good it
 * looks. And under `prefers-reduced-motion` the cards are simply placed: the
 * layout is identical, nothing moves.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import AceBody from "@/components/ace/AceBody";

/**
 * The floor's literal ink, taken from `MarketCard` so the dealt shape and the
 * card that replaces it are the same object. Not tokens — see the header.
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

/** One card, flicked from Ace and landing in its place on the grid. */
function DealtCard({ i, reduce }) {
    const settled = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };
    return (
        <motion.div
            aria-hidden
            initial={reduce ? settled : { opacity: 0, x: -140, y: -40, rotate: -25, scale: 0.85 }}
            animate={settled}
            transition={reduce ? { duration: 0 } : {
                // Springy on the way in, because a dealt card has weight. The
                // stagger IS the deal — six cards arriving together is a fade.
                type: "spring", stiffness: 260, damping: 26, delay: i * 0.09,
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

export default function AceDeal({ label = "Opening the floor…" }) {
    const reduce = useReducedMotion();
    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-5">
                {/* Small: he is dealing the table, not presenting it. At the
                    size AceIntro uses he would be the content. */}
                <AceBody
                    className="w-12 flex-shrink-0"
                    pose="toss"
                    tone="fill-[#E8F0FB]"
                    card="fill-[#121C2E]"
                    cardStroke="stroke-[#233247]"
                    idle={false}
                    eyes={false}
                    title="Ace dealing the board"
                />
                <p className="text-sm font-bold" style={{ color: FELT_TEXT }}>{label}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                {Array.from({ length: DEALT }, (_, i) => (
                    <DealtCard key={i} i={i} reduce={reduce} />
                ))}
            </div>
        </div>
    );
}
