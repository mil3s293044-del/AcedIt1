/**
 * CommitmentRun — the time you said you'd do, as cards you turn over.
 *
 * WHAT IT REPLACES was a ring reading "28 / 100 XP". A hundred XP is a number
 * the app made up; forty-five minutes is a number the student said out loud
 * this morning in the planner, and it was being drawn as a grey bar a pixel
 * and a half high underneath the copy. The panel was showing three separate
 * answers to "how is today going" — the XP ring, "time today", and that bar —
 * and the only one with any weight behind it was the smallest thing on screen.
 *
 * SO THE COMMITMENT BECOMES THE OBJECT. One card per block of the time you
 * promised, face down at the start of the day, turning over as you actually do
 * it. You can count what is left without reading a number, which is the entire
 * argument for using cards for anything here, and a row of them wants
 * horizontal space — which is what the panel had going spare.
 *
 * IT TURNS IN BLOCKS, NOT CONTINUOUSLY, and that is the point rather than a
 * limitation. A bar that creeps rewards a minute of sitting down; a card that
 * flips rewards finishing something. The block is five minutes up to an hour
 * and scales past that so a two-hour commitment is still a readable dozen
 * cards rather than twenty-four unreadable ones.
 *
 * NO COMMITMENT IS NOT AN EMPTY STATE HERE. If nothing was set this morning
 * the run shows the pack square and unplayed and asks for one, because a
 * student who has not said what today is for is exactly the student this panel
 * exists to catch, and showing them nothing is the one response guaranteed not
 * to help.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight } from "lucide-react";
import { SpadePip } from "@/components/ace/SpadeMark";
import { runOf, MIN_CARDS } from "@/lib/commitmentRun";

export default function CommitmentRun({ commitment, fmtTime, hasCard = false }) {
    const reduce = useReducedMotion();

    if (!commitment) {
        return (
            <div data-commitment-run="none" className="mt-4">
                {/* The ghost pack is there to give the empty state an OBJECT —
                    six card shapes waiting to be earned. When the panel is
                    already leading with a real card two inches away, a second
                    row of card shapes stops reading as "yours to fill" and
                    starts reading as a loading skeleton next to the real
                    thing. The sentence is the actual ask and it stays either
                    way. */}
                {!hasCard && (
                    <div className="flex items-end gap-1.5 mb-2.5" aria-hidden="true">
                        {Array.from({ length: MIN_CARDS }, (_, i) => (
                            <span key={i} className="w-[26px] sm:w-[30px] aspect-[2.5/3.5]
                                rounded-[5px] border border-dashed border-border bg-muted/40" />
                        ))}
                    </div>
                )}
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Nothing committed for today.{" "}
                    <Link to={createPageUrl("Goals")}
                        className="font-bold text-primary hover:underline inline-flex
                            items-center gap-0.5">
                        Say what today is for <ArrowRight className="w-3 h-3" />
                    </Link>
                </p>
            </div>
        );
    }

    const { total, turned, block } = runOf(commitment);
    const left = total - turned;

    return (
        <div data-commitment-run={`${turned}/${total}`} className="mt-4">
            <div className="flex items-end gap-1.5 mb-2.5">
                {Array.from({ length: total }, (_, i) => {
                    const on = i < turned;
                    return (
                        <motion.span
                            key={i}
                            data-run-card={on ? "done" : "todo"}
                            className="relative w-[26px] sm:w-[30px] aspect-[2.5/3.5]"
                            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, rotate: -4 }}
                            animate={{ opacity: 1, y: 0, rotate: 0 }}
                            transition={reduce
                                ? { duration: 0.2, delay: i * 0.02 }
                                : { type: "spring", stiffness: 300, damping: 24, delay: 0.25 + i * 0.045 }}
                        >
                            {on ? (
                                /* Face up: a block you have actually done. The
                                   spade rather than a tick, because this is the
                                   app's own mark and a tick is every app's. */
                                <span className="absolute inset-0 rounded-[5px] bg-surface
                                    border border-primary/40 grid place-items-center
                                    shadow-[0_1px_2px_rgba(13,22,38,0.10)]">
                                    <SpadePip className="w-1/2 h-1/2" tone="fill-primary" />
                                </span>
                            ) : (
                                /* A back drawn for THIS size rather than the
                                   shared CardBack. That one centres a medallion
                                   at 38% of the card with a ring around it,
                                   which is right at deck size and at thirty
                                   pixels is a circle with a hairline through
                                   it — the row read as a line of little tokens
                                   rather than as cards face down. Stripped to
                                   the one thing that still says "back" that
                                   small: the diagonal lattice. */
                                <span className="absolute inset-0 rounded-[5px] border
                                    border-border bg-secondary/70 overflow-hidden">
                                    <span className="absolute inset-0 opacity-50"
                                        style={{
                                            backgroundImage:
                                                "repeating-linear-gradient(45deg,"
                                                + " hsl(var(--muted-foreground)/0.55) 0 1px,"
                                                + " transparent 1px 4px)",
                                        }} />
                                </span>
                            )}
                        </motion.span>
                    );
                })}
            </div>

            <p className="text-[13px] leading-relaxed">
                <span className="font-bold text-foreground">
                    {fmtTime(commitment.done)} of {fmtTime(commitment.target)}
                </span>
                <span className="text-muted-foreground">
                    {commitment.met
                        ? " · you did what you said you would"
                        : commitment.done === 0
                            ? " · you committed to this today"
                            : ` · ${left} card${left === 1 ? "" : "s"} left, ${block} minutes each`}
                </span>
            </p>
        </div>
    );
}
