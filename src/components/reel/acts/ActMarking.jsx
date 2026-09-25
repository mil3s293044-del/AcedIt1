/**
 * Act III — THE MARKING. The most convincing thing the product does, made
 * touchable.
 *
 * WHY THIS BEATS A TESTIMONIAL. Three students saying it helped is three
 * claims. One real three-mark VCAA-shaped question, a real answer, and the
 * itemised marking underneath it is a DEMONSTRATION — the reader can check it
 * against their own chemistry and decide for themselves, which is the only kind
 * of persuasion that survives contact with a sceptical sixteen-year-old.
 *
 * THE THIRD CRITERION HAS NOTHING TO UNDERLINE, AND THAT IS THE POINT OF THE
 * ACT. Two of the three marks are evidenced by phrases the student actually
 * wrote, so tapping the phrase shows the mark it earned. The dropped mark is
 * "names the electron transfer explicitly" — and it is UNQUOTABLE precisely
 * because the words are absent. There is nothing to point at.
 *
 * That is the exact failure the product's own MarkPanel was rebuilt to fix:
 * the marks that most needed explaining were the ones with no phrase to hang a
 * note on, so they got a single line and no button. Here it becomes the
 * argument — "we can't underline this one, because you never wrote it" is a
 * sharper statement about what marking is than any adjective would be.
 *
 * THE CRITERIA ARE THE LEDGER. The underlines are evidence for it, never a
 * second verdict — annotations chosen independently of the criteria is how the
 * real panel once ended up printing "cost a mark" on a phrase inside a clean
 * 3/3. Here every underline is BOUND to a criterion by construction: the map is
 * one array, so the two cannot disagree.
 */
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { segment } from "@/lib/annotate";
import { useAct } from "@/components/reel/ReelContext";
import Cue from "@/components/reel/Cue";

const QUESTION = "Explain why the magnesium electrode is the anode in a "
    + "magnesium/copper galvanic cell. (3 marks)";

const ANSWER = "Magnesium is the anode because it is more reactive than copper. "
    + "It sits higher on the electrochemical series, so it is more easily "
    + "oxidised. This means magnesium goes into solution as Mg²⁺ and the "
    + "electrode loses mass over time.";

/**
 * ONE ARRAY, so a mark and the words that earned it cannot drift apart.
 * `quote` null means the mark has no evidence in the answer — see the header.
 */
const MARKS = [
    {
        id: "m1", got: true, worth: 1,
        quote: "more reactive than copper",
        label: "Identifies magnesium as the stronger reductant",
        note: "Reactivity and position on the series both do this. Clean mark.",
    },
    {
        id: "m2", got: true, worth: 1,
        quote: "more easily oxidised",
        label: "States that oxidation occurs at the anode",
        note: "Implied correctly and supported by the mass loss at the end.",
    },
    {
        id: "m3", got: false, worth: 1,
        quote: null,
        label: "Names the electron transfer explicitly",
        note: "The half-equation, or the words “loses two electrons”. VCAA wants "
            + "the transfer stated, not inferred from “goes into solution”. "
            + "This is the most common way this mark is lost.",
    },
];

const EARNED = MARKS.filter((m) => m.got).reduce((n, m) => n + m.worth, 0);
const OUT_OF = MARKS.reduce((n, m) => n + m.worth, 0);

/* Bound to the criteria above by id, so the underline and the ledger are the
   same object read two ways. */
const SEGMENTS = segment(
    ANSWER,
    MARKS.filter((m) => m.quote).map((m) => ({ id: m.id, quote: m.quote })),
);

const INK = "#F4F7FB";

export default function ActMarking() {
    const { advance, deal } = useAct("marking");
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(null);

    const choose = (m) => {
        setOpen(m.id === open ? null : m.id);
        deal({ criterion: { cost: m.got ? 0 : m.worth, label: m.got ? m.label : "the mark you dropped" } });
    };

    const active = useMemo(() => MARKS.find((m) => m.id === open) || null, [open]);

    return (
        <div className="w-full flex flex-col items-center text-center" style={{ color: INK }}>
            <p className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase opacity-40">
                The marking
            </p>
            {/* SIZED TO FIT THE ACT, not to be the biggest thing available.
                At lg:3.1rem this wrapped to three lines and pushed the criteria
                below the fold, where the fixed hand rail covered the single
                most important line on the screen — "there is nothing to
                underline here, you never wrote it". An act that does not fit
                is an act whose ending nobody reads. */}
            <h2 className="mt-2 font-display font-black leading-[1.03] tracking-tight
                           text-[7vw] sm:text-[3.4vw] lg:text-[2.5rem] max-w-4xl">
                A score tells you nothing.{" "}
                <span className="opacity-45">A mark scheme tells you everything.</span>
            </h2>

            <div className="mt-5 w-full max-w-3xl text-left">
                {/* The paper. */}
                <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 sm:p-5">
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-40">
                        Chemistry &middot; Unit 3
                    </p>
                    <p className="mt-2 font-display font-black text-[15px] sm:text-lg leading-snug">
                        {QUESTION}
                    </p>

                    <p className="mt-4 text-[10px] font-black uppercase tracking-wider opacity-40">
                        What you wrote
                    </p>
                    <p className="mt-2 text-[14px] sm:text-[16px] leading-relaxed opacity-90">
                        {SEGMENTS.map((s, i) => {
                            if (!s.ann) return <span key={i}>{s.text}</span>;
                            const m = MARKS.find((x) => x.id === s.ann.id);
                            const on = open === m.id;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => choose(m)}
                                    /* UNDERLINED IN PLACE, never struck
                                       through and never lifted out into its
                                       own card. A strikethrough means DELETE
                                       THIS when the point is LOOK HERE, and
                                       pulling the phrase out of the paragraph
                                       loses the thing that makes it land. */
                                    className={`cursor-pointer rounded px-0.5 transition-colors
                                                underline decoration-2 underline-offset-4
                                                ${on ? "bg-primary/25 decoration-primary"
                                                     : "decoration-primary/50 hover:bg-primary/15"}`}
                                >
                                    {s.text}
                                </button>
                            );
                        })}
                    </p>
                </div>

                {/* The ledger. */}
                <div className="mt-3 flex items-center gap-3">
                    <span className="font-display font-black text-3xl sm:text-4xl tabular-nums">
                        {EARNED}<span className="opacity-40">/{OUT_OF}</span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold opacity-55">
                        marks &mdash; and here is exactly where the third went
                    </span>
                </div>

                <div className="mt-2.5 space-y-1.5">
                    {MARKS.map((m) => {
                        const on = open === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => choose(m)}
                                className={`w-full text-left rounded-xl border p-2.5 sm:p-3 cursor-pointer transition-all
                                            ${on ? "bg-white/[0.09] border-white/25"
                                                 : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"}`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                                                      ${m.got ? "bg-primary" : "bg-[#FF4B4B]"}`}>
                                        {m.got
                                            ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
                                            : <X className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[13px] sm:text-[15px] leading-snug">{m.label}</p>
                                        <AnimatePresence initial={false}>
                                            {on && (
                                                <motion.div
                                                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.25 }}
                                                    className="overflow-hidden"
                                                >
                                                    <p className="pt-2 text-[12px] sm:text-[13.5px] leading-relaxed opacity-65">
                                                        {m.note}
                                                    </p>
                                                    {!m.quote && (
                                                        /* THE LINE THIS ACT EXISTS FOR. */
                                                        <p className="pt-2 text-[12px] sm:text-[13.5px] font-black text-[#FFC800]">
                                                            There is nothing to underline here &mdash;
                                                            you never wrote it. That is the mark.
                                                        </p>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    {/* NOT "−0". The mark is worth one and was not
                                        earned, so the honest figure is 0 out of
                                        what it was worth — a minus sign in front
                                        of a zero reads as a deduction of
                                        nothing, which is the opposite of what
                                        this row is saying. */}
                                    <span className="shrink-0 text-[11px] font-black tabular-nums opacity-45">
                                        {m.got ? m.worth : 0}/{m.worth}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <Cue done={!!active} onAdvance={advance} nextLabel="Why any of this works" ink={INK}>
                Tap the underlined words
            </Cue>
        </div>
    );
}
