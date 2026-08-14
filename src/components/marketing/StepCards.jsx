/**
 * StepCards — "how it works", as three cards turned over one at a time.
 *
 * What it replaces: three rounded boxes, each with a giant ghosted numeral
 * (01, 02, 03) in the corner and an icon in a rounded square. That block is on
 * every generated landing page in the world, and the numerals were doing the
 * only job a card's corner index already does better.
 *
 * THEY START FACE-DOWN AND TURN OVER AS YOU REACH THEM. A page that explains
 * three steps in sequence should reveal them in sequence, and the reveal is
 * the app's own flip — the same one that turns a flashcard over. By the time
 * a visitor reaches the signup button they have already watched the product's
 * central gesture three times without being told anything about it.
 *
 * The backs are staggered so it reads as a dealer turning a row, not as three
 * things happening at once. Under reduced motion they are simply face-up.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";

/** Cards laid on a table don't sit square. Fixed, not random — a layout that
 *  reshuffles on re-render reads as a glitch. */
const LIE = [-2.4, 1.2, 2.8];

export default function StepCards({ steps = [] }) {
    const reduce = useReducedMotion();

    return (
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, i) => (
                <motion.div
                    key={step.title}
                    data-step-card={i}
                    className="relative mx-auto w-full max-w-[266px]"
                    style={{ perspective: 1200 }}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-90px" }}
                    transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                    <motion.div
                        className="relative aspect-[2.5/3.5]"
                        style={{ transformStyle: reduce ? undefined : "preserve-3d" }}
                        initial={reduce ? false : { rotateY: 180, rotate: LIE[i % 3] }}
                        whileInView={{ rotateY: 0, rotate: LIE[i % 3] }}
                        viewport={{ once: true, margin: "-90px" }}
                        transition={reduce ? { duration: 0.2 } : {
                            type: "spring", stiffness: 120, damping: 18,
                            // The turn starts after the card has arrived, and
                            // each one waits for the last — a dealer turning a
                            // row, rather than three things at once.
                            delay: 0.25 + i * 0.22,
                        }}
                        whileHover={reduce ? undefined : { rotate: 0, y: -8, scale: 1.02 }}
                    >
                        {/* FACE */}
                        <div className="absolute inset-0"
                            style={reduce ? undefined : {
                                backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                            }}>
                            <PlayingCard rank={String(i + 1)} suit={step.suit} tone={step.tone}
                                className="w-full h-full"
                                style={{ boxShadow: "0 24px 40px -18px rgba(0,0,0,0.6)" }}>
                                <div className="absolute inset-0 flex flex-col justify-center px-6 pt-10 pb-8">
                                    <h3 className="font-display font-extrabold text-2xl tracking-tight
                                        text-foreground leading-tight">
                                        {step.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                                        {step.body}
                                    </p>
                                </div>
                            </PlayingCard>
                        </div>

                        {/* BACK */}
                        {!reduce && (
                            <div className="absolute inset-0"
                                style={{
                                    backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                                    transform: "rotateY(180deg)",
                                }}>
                                <CardBack tone={step.tone} className="w-full h-full"
                                    style={{ boxShadow: "0 24px 40px -18px rgba(0,0,0,0.6)" }} />
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            ))}
        </div>
    );
}
