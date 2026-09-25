/**
 * Cue — the prompt that tells you what this act wants from you.
 *
 * EVERY ACT ASKS FOR ONE GESTURE AND SAYS SO IN PLAIN WORDS. "Drag the days."
 * "Tap a phrase." An interactive page whose interactions are undiscoverable is
 * just a page that does not work: a student who does not realise the sentence
 * is draggable sees a static chart and scrolls past the best thing on the
 * screen. The affordance has to be printed, not implied by a hover state that
 * a touch screen never shows.
 *
 * IT DISAPPEARS ONCE YOU HAVE DONE IT. A prompt still pulsing at somebody who
 * has already dragged the handle is the app not noticing — the "collect
 * nothing you don't use" instinct applied to attention. What replaces it is
 * the way ON: the advance, which is the act's real exit.
 *
 * `done` therefore has three states and not two: not yet, done-and-here-is-the
 * -way-forward, and (for an act with nothing to do) no cue at all.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function Cue({ children, done = false, onAdvance, nextLabel = "Next", ink = "currentColor" }) {
    return (
        <div className="mt-8 h-[52px] flex items-center justify-center" style={{ color: ink }}>
            <AnimatePresence mode="wait" initial={false}>
                {!done ? (
                    <motion.div
                        key="ask"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-2 text-sm font-bold tracking-wide opacity-80"
                    >
                        <span className="reel-cue inline-block">&#9662;</span>
                        {children}
                    </motion.div>
                ) : (
                    <motion.button
                        key="go"
                        type="button"
                        onClick={onAdvance}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="group flex items-center gap-2 text-sm font-black tracking-wide
                                   cursor-pointer hover:opacity-100 opacity-85 transition"
                    >
                        {nextLabel}
                        <ChevronDown className="w-4 h-4 reel-cue" />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
