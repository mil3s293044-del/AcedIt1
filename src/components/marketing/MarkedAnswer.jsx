/**
 * MarkedAnswer — the product's central act, shown rather than described.
 *
 * The page said "marks your work against real VCAA criteria" four separate
 * times and never once showed what that looks like. That claim is the whole
 * reason anyone would pay, and a claim repeated is weaker than the same claim
 * demonstrated once.
 *
 * So: a real question, a real answer of the kind a good student actually
 * writes, and the marking beside it. The answer is deliberately NOT bad. It is
 * fluent, it is correct, it would feel finished to whoever wrote it, and it
 * drops a mark on something they would never have noticed. That is the exact
 * experience the product exists to fix, and a strawman answer full of obvious
 * errors would have demonstrated nothing.
 *
 * The criteria reveal one at a time on scroll, so the missed mark lands last.
 *
 * The example is a Chemistry unit 3 answer because redox is on the syllabus,
 * the criterion it misses is a real one, and the omission is the single most
 * common thing students lose marks for in that question type: describing the
 * change without naming the transfer.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import PlayingCard from "@/components/cards/PlayingCard";

const QUESTION = "Explain why the magnesium electrode is the anode in a "
    + "magnesium/copper galvanic cell. (3 marks)";

const ANSWER = "Magnesium is the anode because it is more reactive than copper. "
    + "It sits higher on the electrochemical series, so it is more easily "
    + "oxidised. This means magnesium goes into solution as Mg²⁺ and the "
    + "electrode loses mass over time.";

const CRITERIA = [
    {
        got: true,
        text: "Identifies magnesium as the stronger reductant",
        note: "Reactivity and position on the series both do this. Clean mark.",
    },
    {
        got: true,
        text: "States that oxidation occurs at the anode",
        note: "Implied correctly and supported by the mass loss.",
    },
    {
        got: false,
        text: "Names the electron transfer explicitly",
        note: "The half-equation, or the words “loses two electrons”. VCAA "
            + "wants the transfer stated, not left to be inferred from “goes "
            + "into solution”. This is the most common way this mark is lost.",
    },
];

export default function MarkedAnswer() {
    const reduce = useReducedMotion();
    const scored = CRITERIA.filter((c) => c.got).length;

    return (
        <div data-marked-answer className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">

            {/* ── What the student wrote ────────────────────────────────── */}
            <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, rotate: -1 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ type: "spring", stiffness: 190, damping: 22 }}
            >
                <PlayingCard rank="Q" suit="diamond" tone="#3B82F6"
                    className="w-full" watermark={false}>
                    <div className="p-6 sm:p-8 pt-11">
                        <p className="stat-label mb-2">Chemistry, unit 3</p>
                        <p className="font-display font-extrabold text-foreground
                            text-base leading-snug">
                            {QUESTION}
                        </p>
                        <div className="mt-5 pt-5 border-t border-border">
                            <p className="stat-label mb-2">Your answer</p>
                            <p className="text-foreground/85 text-[15px] leading-relaxed">
                                {ANSWER}
                            </p>
                        </div>
                    </div>
                </PlayingCard>
            </motion.div>

            {/* ── What an assessor would tick ───────────────────────────── */}
            <div>
                <div className="flex items-baseline justify-between mb-5">
                    <p className="stat-label text-white/50">VCAA criteria</p>
                    <p className="font-display font-extrabold text-2xl text-white">
                        {scored}<span className="text-white/35"> / {CRITERIA.length}</span>
                    </p>
                </div>

                <div className="space-y-3">
                    {CRITERIA.map((c, i) => (
                        <motion.div
                            key={c.text}
                            data-criterion={c.got ? "got" : "missed"}
                            className={`rounded-2xl border p-4 ${
                                c.got
                                    ? "border-white/10 bg-white/[0.03]"
                                    : "border-streak/45 bg-streak/[0.08]"}`}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 26 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-70px" }}
                            transition={reduce ? { duration: 0.3 } : {
                                type: "spring", stiffness: 210, damping: 23,
                                // The missed one lands last, on its own beat.
                                delay: 0.25 + i * 0.28,
                            }}
                        >
                            <div className="flex items-start gap-3">
                                <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center
                                    justify-center flex-shrink-0 ${
                                    c.got ? "bg-primary" : "bg-streak"}`}>
                                    {c.got
                                        ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                        : <X className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                </span>
                                <div className="min-w-0">
                                    <p className={`font-bold text-sm leading-snug ${
                                        c.got ? "text-white/85" : "text-white"}`}>
                                        {c.text}
                                    </p>
                                    <p className={`text-sm leading-relaxed mt-1 ${
                                        c.got ? "text-white/45" : "text-white/70"}`}>
                                        {c.note}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <motion.p
                    className="text-white/55 text-sm leading-relaxed mt-6"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: "-70px" }}
                    transition={{ delay: 1.2, duration: 0.5 }}
                >
                    Nothing in that answer is wrong. It reads like a finished answer, and
                    whoever wrote it would have moved on. That is the mark AcedIt is for.
                </motion.p>
            </div>
        </div>
    );
}
