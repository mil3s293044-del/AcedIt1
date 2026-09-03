/**
 * QuizTable — the quiz as a hand you play, with Ace sitting across the table.
 *
 * The screen it replaces was a coloured header, a progress bar, a panel and
 * four lettered rows. None of it knew what a quiz is. This is the same
 * vocabulary the review deck already taught: two piles instead of a bar, card
 * stock instead of a panel, and a character who reacts to what you played.
 *
 * THE LOOP:
 *
 *   deal → read → play a suit → he eats it, or bats it away
 *
 * WHY HE EATS IT. A right answer has to go somewhere, and "somewhere" was a
 * green tick that faded. Feeding the card to Ace gives the correct answer a
 * destination and a personality in the same gesture, and the card arriving at
 * his mouth is what makes the won pile behind him grow by one — the same
 * "card becomes the pile" trick as filing a flashcard.
 *
 * WHY HE BATS THE WRONG ONE AWAY. A card he won't take, tumbling off down and
 * to the left. Identical to how a failed flashcard leaves the review table, on
 * purpose: one gesture for "that didn't work" across the whole app. He's not
 * cross about it — brow up, not down — because the correct answer lighting up
 * underneath is the actual feedback, and a mascot scolding a teenager for a
 * wrong answer is how you get the mascot turned off.
 *
 * MEASURED, NOT GUESSED. The played card flies from wherever the option you
 * clicked actually is, to wherever his mouth actually is. Both move: the
 * options are different heights on every question and he sits in a different
 * place on a phone. Hardcoding either would land the card in empty space on
 * most questions.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import PlayingCard, { SuitPip } from "@/components/cards/PlayingCard";
import { Pile, Count } from "@/components/cards/Pile";
import AceBody from "@/components/ace/AceBody";
import { suitForOption } from "@/components/cards/ChoiceCard";
import { rankAt } from "@/components/cards/cardIdentity";

/** The piles beside the question. Small — the question is the hero here. */
const PILE_H = "clamp(3.2rem, 7vh, 4.4rem)";

/** How long the played card takes to reach him, and how long he chews. */
const FLY_MS = 400;
const CHEW_MS = 900;

/**
 * Where his mouth is inside the AceBody box, as a fraction. AceBody's viewBox
 * is "-10 0 84 92" and the mouth sits at about (32, 44) in that space, which
 * is halfway across and a little under halfway down. Kept as a fraction rather
 * than as pixels so it survives him being rendered at any size.
 */
const MOUTH = { x: 0.5, y: 0.48 };

/** He holds each reaction for as long as it's worth looking at. */
const HOLD = { eat: FLY_MS + CHEW_MS, swat: FLY_MS + 500 };

export default function QuizTable({
    /** Changes per question. Drives the deal. */
    questionKey,
    /** Printed in the question card's corner, with the subject's suit. */
    number,
    suit = "spade",
    tone,
    /** Questions not yet reached, INCLUDING the one on the table. */
    remaining = 1,
    won = 0,
    missed = 0,
    /** Consecutive correct answers. */
    run = 0,
    /** "correct" | "wrong" | null — set the moment an answer is submitted. */
    verdict = null,
    /** Which option was played, so the right card flies off the right row. */
    playedIndex = null,
    optionCount = 4,
    question,
    children,
}) {
    const reduce = useReducedMotion();
    const aceRef = useRef(null);
    const [flight, setFlight] = useState(null);
    const firedRef = useRef(null);
    const timerRef = useRef(null);
    const inDeck = Math.max(0, remaining - 1);

    // A verdict starts a flight: measure the row you played and his mouth, and
    // send a card between them.
    //
    // The timer deliberately does NOT live in the effect's cleanup. A correct
    // answer advances the question about half a second in, which clears the
    // verdict — and a cleanup-owned timer would be cancelled at that moment,
    // leaving the card frozen in his mouth for the rest of the quiz. `fired`
    // is what stops the same verdict re-firing instead.
    useEffect(() => {
        if (!verdict || reduce) return;
        const id = `${questionKey}-${verdict}`;
        if (firedRef.current === id) return;
        const row = document.querySelector(`[data-choice="${playedIndex}"]`);
        const ace = aceRef.current;
        if (!row || !ace) return;
        firedRef.current = id;
        const r = row.getBoundingClientRect();
        const a = ace.getBoundingClientRect();
        setFlight({
            id,
            verdict,
            suit: suitForOption(playedIndex, optionCount),
            // Fixed-position, so it can cross anything between the two.
            from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
            to: { x: a.left + a.width * MOUTH.x, y: a.top + a.height * MOUTH.y },
        });
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setFlight(null),
            HOLD[verdict === "correct" ? "eat" : "swat"]);
    }, [verdict, questionKey, playedIndex, optionCount, reduce]);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    // What he's doing. `gulp` while the card is in the air, `munch` once it
    // has arrived — the two halves of one bite, driven by the same timer the
    // card flies on rather than by a second one that could drift out of step.
    const [chewing, setChewing] = useState(false);
    useEffect(() => {
        if (!flight || flight.verdict !== "correct") { setChewing(false); return undefined; }
        const t = setTimeout(() => setChewing(true), FLY_MS * 0.85);
        return () => clearTimeout(t);
    }, [flight]);

    const pose = !flight ? "stand"
        : flight.verdict === "wrong" ? "swat"
        : chewing ? "munch" : "gulp";

    return (
        <div data-quiz-table className="space-y-4">
            {/* The table edge: what's left, what he's eaten, and him. */}
            <div className="flex items-end justify-between gap-3">
                <div className="flex items-end gap-2">
                    <Pile count={inDeck} tone={tone} h={PILE_H} />
                    <Count n={inDeck} label="to go" className="!text-left" />
                </div>

                <div className="flex items-end gap-2">
                    <div className="text-right">
                        <Count n={won} label="won" className="!text-right" />
                        {missed > 0 && (
                            <p className="text-[10px] text-muted-foreground/70 text-right leading-tight">
                                {missed} missed
                            </p>
                        )}
                    </div>
                    <Pile data-won-pile count={won} tone={tone} h={PILE_H} spent />
                    <div className="relative flex-shrink-0">
                        {/* A run is the card word for a streak, and it's the
                            only new number on the screen. It appears when it
                            starts meaning something, not at one. */}
                        <AnimatePresence>
                            {run >= 2 && (
                                <motion.span key="run"
                                    initial={{ opacity: 0, y: 6, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    data-run={run}
                                    // Anchored to his right edge, not centred
                                    // on him: he sits at the end of the row, so
                                    // a centred chip hangs off the table.
                                    className="absolute -top-1 right-0 whitespace-nowrap
                                        px-2 py-0.5 rounded-full bg-xp/15 text-xp text-[10px] font-black">
                                    {run} in a row
                                </motion.span>
                            )}
                        </AnimatePresence>
                        <span ref={aceRef} data-ace-quiz={pose} className="block">
                            <AceBody className="w-16 sm:w-20" pose={pose} title="Ace" idle={!flight} />
                        </span>
                    </div>
                </div>
            </div>

            {/* The question, on card stock. Landscape because a question is a
                paragraph — the flashcard's 2.5:3.5 is load-bearing because the
                flashcard IS the card, but this one is lying on the table. */}
            <AnimatePresence mode="wait">
                <motion.div key={questionKey}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: -60, rotate: -4, scale: 0.94 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, rotate: 0, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, rotate: 3, scale: 0.96 }}
                    transition={reduce ? { duration: 0.15 }
                        : { type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}>
                    {/* No watermark: on a landscape card the big pale pip lands
                        directly behind the question text. */}
                    <PlayingCard rank={rankAt(number)} suit={suit} tone={tone} smallIndices
                        watermark={false} className="w-full">
                        <div data-question-card className="relative px-5 sm:px-7 py-8 min-h-[7rem]
                            flex items-center">
                            <div className="w-full">{question}</div>
                        </div>
                    </PlayingCard>
                </motion.div>
            </AnimatePresence>

            {children}

            {/* The card you played, in flight. Portalled by `fixed` rather than
                nested in a row, because it has to cross the whole table. */}
            <AnimatePresence>
                {flight && (
                    <motion.div key={flight.id}
                        aria-hidden="true"
                        className="fixed z-[70] pointer-events-none w-16"
                        style={{ left: 0, top: 0 }}
                        initial={{
                            x: flight.from.x - 32, y: flight.from.y - 45,
                            opacity: 1, scale: 1, rotate: 0,
                        }}
                        animate={flight.verdict === "correct"
                            // Into his mouth, and gone.
                            ? {
                                x: flight.to.x - 32, y: flight.to.y - 45,
                                scale: 0.08, rotate: 22, opacity: [1, 1, 0],
                                transition: {
                                    duration: FLY_MS / 1000, ease: [0.3, 0.5, 0.4, 1],
                                    opacity: { duration: FLY_MS / 1000, times: [0, 0.88, 1] },
                                },
                            }
                            // Batted off: up to him, then away down-left.
                            : {
                                x: [flight.from.x - 32, flight.to.x - 60, flight.from.x - 210],
                                y: [flight.from.y - 45, flight.to.y - 30, flight.from.y + 190],
                                rotate: [0, -20, -150], scale: [1, 0.9, 0.6],
                                opacity: [1, 1, 0],
                                transition: { duration: 0.62, times: [0, 0.42, 1], ease: "easeIn" },
                            }}
                        exit={{ opacity: 0 }}
                    >
                        <span className="block aspect-[2.5/3.5] rounded-lg bg-surface border-2 border-border
                            shadow-soft-lg grid place-items-center">
                            {flight.suit
                                ? <SuitPip suit={flight.suit} className="w-1/2 h-1/2" />
                                : <span className="font-display font-black text-lg text-foreground">
                                    {String.fromCharCode(65 + (playedIndex ?? 0))}
                                </span>}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
