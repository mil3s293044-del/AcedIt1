/**
 * MarkedWord — the page marking its own headline.
 *
 * The sentence starts with the word most people would have written. As you
 * reach it, a stroke goes through that word by hand, the better one is written
 * in beside it, an examiner's underline is drawn under that, and the
 * annotation appears explaining what the swap bought. It is the product doing
 * its own job on its own copy, in front of you, on the one sentence that makes
 * the argument for buying it.
 *
 * WHY THIS IS WORTH MORE THAN A THIRD PARAGRAPH. Everything else on this page
 * is a claim about marking: the section further down shows a worked example,
 * which is stronger, and this is stronger still, because there is no worked
 * example to trust. The thing being marked is the sentence you are in the
 * middle of reading, and the improvement is one you can check against your own
 * ear in about a second.
 *
 * IT IS DRAWN, NOT PRINTED. Both marks are SVG paths with a deliberate wobble,
 * drawn by animating pathLength, so they arrive the way a pen arrives rather
 * than the way a CSS border appears. A straight `line-through` and a
 * `border-bottom` would have said the same thing and read as a spreadsheet.
 *
 * NOTHING REFLOWS. The corrected word occupies its space from the first paint
 * and fades in, rather than being inserted and pushing the line around. A
 * headline that jumps as you read it is worse than no animation at all, and
 * this one is centred, so an insertion would move every word on the line.
 *
 * Under reduced motion the sentence is simply in its final, corrected state
 * with the annotation already there.
 *
 * THE ANNOTATION IS A SEPARATE EXPORT, and that is a layout constraint rather
 * than a preference. Nested inside the word it was a block box inside an
 * inline-block inside a centred h2, so the wrapper inherited the card's whole
 * height and width and the headline broke around it: the sentence rendered as
 * "Rereading does nothing. Letting bad detrimental / AI think for you is" with
 * the words genuinely out of order. It goes after the headline, as a sibling.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

/** A stroke with a wobble in it, so it reads as a pen and not as a rule. */
const STRIKE = "M1 5.4 C 22 3.2, 44 6.6, 66 4.2 S 92 5.8, 99 3.9";
const UNDER = "M1 4.2 C 24 6.8, 47 2.4, 70 5.6 S 93 3.2, 99 5.0";

export default function MarkedWord({ was = "bad", now = "detrimental", delay = 0 }) {
    const reduce = useReducedMotion();
    const view = { once: true, margin: "-90px" };
    const draw = (d) => (reduce
        ? { pathLength: 1 }
        : { pathLength: 1, transition: { duration: 0.55, delay: delay + d, ease: "easeInOut" } });

    return (
        <span data-marked-word className="relative inline-block">
            {/* The word you would have written. */}
            <span className="relative inline-block text-[#0D1626]/35">
                {was}
                <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"
                    className="absolute left-[-3%] top-1/2 w-[106%] h-[0.42em] -translate-y-1/2
                        overflow-visible pointer-events-none">
                    <motion.path d={STRIKE} fill="none" stroke="#FF4B4B"
                        strokeWidth="3.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                        initial={reduce ? false : { pathLength: 0 }}
                        whileInView={draw(0)} viewport={view} />
                </svg>
            </span>

            {" "}

            {/* The word an assessor wanted. */}
            <span data-marked-now className="relative inline-block">
                <motion.span
                    className="inline-block text-primary"
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={view}
                    transition={{ duration: 0.4, delay: delay + 0.4 }}
                >
                    {now}
                </motion.span>
                <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"
                    className="absolute left-[-2%] -bottom-[0.12em] w-[104%] h-[0.3em]
                        overflow-visible pointer-events-none">
                    <motion.path d={UNDER} fill="none" stroke="#58CC02"
                        strokeWidth="3.4" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                        initial={reduce ? false : { pathLength: 0 }}
                        whileInView={draw(0.62)} viewport={view} />
                </svg>
            </span>

        </span>
    );
}


/**
 * MarkingNote — what the app says back about the swap.
 *
 * Same shape as the criteria panel in the worked example further down the
 * page, because it is the same object: this is what AcedIt actually returns,
 * not a marketing device that resembles it. Sits after the headline rather
 * than inside it, for the layout reason in the note at the top of this file.
 */
export function MarkingNote({ criterion = "Word choice", note, delay = 1.05 }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            data-marked-note
            className="mt-8 mx-auto max-w-[27rem] text-left rounded-2xl
                bg-surface border border-border shadow-soft p-4"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-90px" }}
            transition={{ duration: 0.45, delay }}
        >
            <div className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-md bg-primary flex items-center
                    justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </span>
                <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="stat-label">AcedIt · {criterion}</span>
                        <span className="pill bg-primary/15 text-primary">+1 mark</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                        {note}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
