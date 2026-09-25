/**
 * HandRail — the hand you are building, held at the bottom of the screen for
 * the whole film.
 *
 * THIS IS THE OBJECT THAT MAKES IT ONE FILM. The landing page and the wizard
 * used to be a brochure and a form joined by a full page reload; what joins
 * them now is not a transition, it is a THING that survives the seam. A card
 * dealt by the forgetting act is still in your hand while the wizard asks your
 * year level, so the two halves are visibly the same sitting.
 *
 * IT IS THE PROGRESS INDICATOR, AND IT SHOWS WHAT YOU LEARNED RATHER THAN HOW
 * MANY SCREENS ARE LEFT. A segmented "3 of 6" bar answers a question nobody
 * enjoys the answer to. A hand that grows answers "was that worth it" instead,
 * and every card in it is a real, checkable fact the student was just shown —
 * `cardFor` refuses to deal a placeholder precisely so this row can never fill
 * with card-shaped nothing.
 *
 * IT NEVER SHRINKS. Scrolling back up does not take a card away: you cannot
 * unlearn the thing you just learned, and a hand that emptied as you re-read an
 * act would read as progress being confiscated.
 *
 * EMPTY IS ABSENT, not a row of slots. Before the first act pays out there is
 * nothing to hold, and drawing five dashed placeholders would open the film by
 * telling a student how much they have not done — the CommitmentRun ghost-pack
 * lesson, on the one screen where a bad first impression costs a customer.
 */
import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronUp } from "lucide-react";

const SUIT_GLYPH = { spade: "♠", heart: "♥", diamond: "♦", club: "♣" };

export default function HandRail({ cards = [] }) {
    const reduce = useReducedMotion();
    /**
     * COLLAPSED BY DEFAULT ON A PHONE, and this is not a nicety.
     *
     * The rail is `position: fixed` over acts that, on a 390×844 screen,
     * are legitimately taller than the viewport — the marking act alone is a
     * question, a five-line answer and three criteria. A 90px bar pinned to the
     * bottom of that is 11% of the screen permanently sitting on top of body
     * text the reader is scrolling through. On a 1440×900 desktop the acts
     * fit and the bar covers nothing, which is why this was invisible until a
     * phone screenshot.
     *
     * What survives collapsed is the thing the rail is actually FOR: a count
     * that grows as you go, so the continuity across the seam into the wizard
     * is still visible. Tapping deals the hand out. The full cards are also on
     * the turn, at size, which is where anybody actually reads them.
     */
    const [open, setOpen] = useState(false);
    if (!cards.length) return null;

    return (
        <div
            className="fixed bottom-0 inset-x-0 z-[64] pointer-events-none
                       flex justify-center pb-3 sm:pb-4"
            aria-live="polite"
        >
            {/* The phone's collapsed pill. */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className={`sm:hidden pointer-events-auto flex items-center gap-2 rounded-full
                            bg-white text-[#0D1626] border border-black/10 px-3.5 py-1.5
                            shadow-[0_6px_18px_-6px_rgba(0,0,0,0.45)] cursor-pointer
                            ${open ? "hidden" : ""}`}
            >
                <span className="text-[11px] font-black tabular-nums">{cards.length}</span>
                <span className="text-[11px] font-bold opacity-60">
                    {cards.length === 1 ? "fact in your hand" : "facts in your hand"}
                </span>
                <ChevronUp className="w-3.5 h-3.5 opacity-50" strokeWidth={3} />
            </button>

            <div
                onClick={() => setOpen(false)}
                className={`${open ? "flex" : "hidden"} sm:flex pointer-events-auto sm:pointer-events-none
                            items-end gap-1.5 sm:gap-2 px-3 max-w-full overflow-hidden`}
            >
                <AnimatePresence initial={false}>
                    {cards.map((c, i) => (
                        <motion.div
                            key={c.id}
                            layout
                            /* DEALT, not faded in. It arrives from below and
                               off to one side with a flick of rotation, which
                               is what a card being tossed onto a table does —
                               the same gesture AceDeal uses, so the object
                               behaves the same way everywhere in the app. */
                            initial={reduce
                                ? { opacity: 0 }
                                : { opacity: 0, y: 70, rotate: -14, scale: 0.85 }}
                            animate={{
                                opacity: 1, y: 0, scale: 1,
                                /* A held hand fans. The lean is tiny and comes
                                   off the index, so the row reads as cards in
                                   a hand rather than as chips in a tray. */
                                rotate: reduce ? 0 : (i - (cards.length - 1) / 2) * 2.6,
                            }}
                            exit={{ opacity: 0, y: 30, transition: { duration: 0.18 } }}
                            transition={reduce
                                ? { duration: 0.2 }
                                : { type: "spring", stiffness: 260, damping: 22 }}
                            style={{ transformOrigin: "50% 100%" }}
                            className="shrink-0"
                        >
                            <div
                                className="w-[74px] sm:w-[92px] rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-2
                                           bg-white text-[#0D1626] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.45)]
                                           border border-black/10"
                                style={{ borderTopColor: c.tone, borderTopWidth: 3 }}
                            >
                                <div className="flex items-center justify-between leading-none">
                                    <span className="text-[10px] sm:text-[11px] font-black tabular-nums">{c.rank}</span>
                                    <span
                                        className="text-[9px] sm:text-[10px]"
                                        style={{ color: c.suit === "heart" || c.suit === "diamond" ? "#D33" : "#0D1626" }}
                                    >
                                        {SUIT_GLYPH[c.suit] || SUIT_GLYPH.spade}
                                    </span>
                                </div>
                                <div className="mt-1 text-[11px] sm:text-[13px] font-black leading-tight truncate">
                                    {c.label}
                                </div>
                                {/* The note is what stops the card being a
                                    score. "11 weeks" is a number; "11 weeks
                                    until exams" is the fact.

                                    ONE LINE, because this rail is fixed over
                                    the acts and every pixel it grows is a pixel
                                    of act it covers — at two lines it sat on
                                    top of the cue. The full text is on the
                                    card in the turn, which is where somebody
                                    actually reads it. */}
                                <div className="text-[8px] sm:text-[9px] font-semibold opacity-55 leading-tight truncate">
                                    {c.note}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
