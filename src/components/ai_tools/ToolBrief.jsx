/**
 * ToolBrief — what the console leads with, before the student has typed.
 *
 * ─── A BLANK BOX ASKS THE STUDENT TO DO THE DIAGNOSIS ───────────────────────
 * /AITools opened on an empty thread behind a persona dropdown, so the first
 * thing it asked for was the two hardest parts of the job: knowing which tool
 * solves your problem, and stating the problem. Meanwhile nine modules in this
 * codebase already knew what was wrong — see toolBrief.js's header, which owns
 * the whole argument and all of the arithmetic.
 *
 * ─── SO IT LEADS THE ROOM, AND THE TOOLKIT SITS UNDER IT ────────────────────
 * This block is the page's own heading rather than a section inside it, which
 * is deliberate: a console that opens with twelve instrument cards has put the
 * catalogue first and asked the student to match themselves to it, which is the
 * dropdown again with more pixels. What goes first is the half that is about
 * THEM — and it is the only thing on this screen a generic chatbot cannot print.
 *
 * ─── EVERY FACT IS CHECKABLE, WHICH IS WHY IT IS PRINTED SEPARATELY ─────────
 * Each row is a FACT and an OFFER, in that order and visibly distinct. The fact
 * is counted off rows the student can go and look at ("you have dropped this
 * three times" — the three are on /MistakeBank); the offer is what the button
 * does. Collapsed into one sentence they read as a single claim and the
 * checkable half stops being checkable, which is the whole difference between
 * this and the generated advice that was deleted from Insights.
 *
 * ─── A SIGNAL IS NOT AN INSTRUMENT, SO IT IS NOT DRAWN AS ONE ───────────────
 * Every element on this page used to be the same object: the direction cards,
 * the twelve tools and the saved conversations were all one `rounded-2xl
 * border-2 bg-surface` box with a 36px chip, a bold title and a chevron. So "a
 * SAC in three days" and "Line Memoriser" carried identical weight, nothing
 * led, and the page read as nineteen boxes rather than as three kinds of thing.
 *
 * These rows lead with the fact at full measure; the tools below are compact
 * rows on fixed columns with their usage on the right; the conversations are a
 * divided list inside one panel. All three carry a spine and the colour is the
 * PHASE — the idiom Subjects, the Quizzes shelf and QueueRow all use — so a
 * tool is one colour wherever it appears on this screen.
 *
 * ─── THE BRIEF IS NOT A QUEUE ───────────────────────────────────────────────
 * /Review owns the full ranked list of everything outstanding. This is capped
 * at three and answers a narrower question — what is worth opening a TOOL for —
 * so it cannot become a second, smaller copy of that screen, which is the
 * failure the Quizzes shelf went through when it carried five next-moves.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { toolById } from "@/components/ai_tools/chatTools";
import { createPageUrl } from "@/utils";
import { toolQuery } from "@/lib/toolBrief";
import { toneForTool } from "@/lib/toolLabels";

/** The link a card opens. The seed rides in the query string, unsent. */
export function briefHref(card) {
    return `${createPageUrl("AITools")}?${toolQuery(card)}`;
}

function Signal({ card, index, locked, onOpen }) {
    const tool = toolById(card.tool);
    const body = (
        <>
            {/* THE SPINE IS THE PHASE, and the tag beside it names the tool.
                It used to be the tool's OWN accent, which meant this page drew
                twelve hues at the top and organised the twelve tools by four
                different ones below — so "Teach It Back" was blue up here and
                sat in a band coloured something else two inches down. Colour
                means WHEN YOU REACH FOR IT everywhere on this screen now; the
                word is the second channel the floor's CVD rule asks for. */}
            <span
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${toneForTool(card.tool).spine}`}
                aria-hidden="true"
            />
            <span className="block pl-4 pr-3 py-3">
                {/* THE FACT LEADS and is the heavier of the two, because it is
                    the half the student can check us on. */}
                <span className="block font-semibold text-[15px] leading-snug text-[var(--console-ink)]">
                    {card.fact}
                </span>
                <span className="flex items-center gap-2 mt-1.5">
                    <span className="text-[13px] leading-snug text-[var(--console-ink-dim)] min-w-0 flex-1">
                        {card.offer}
                    </span>
                    {/* SENTENCE CASE. Mono uppercase is the most recognisable
                        mark of a generated dashboard and this screen carried
                        four of them at once; it is kept where it is doing work
                        — the figures and dates in the tables — and a tool's
                        name is a name. */}
                    {tool?.label && (
                        <span className="text-[12px] whitespace-nowrap text-[var(--console-ink-faint)]">
                            {tool.label}
                        </span>
                    )}
                    {locked
                        ? <Lock className="w-3.5 h-3.5 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />
                        : <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />}
                </span>
            </span>
        </>
    );

    const className = `group relative block w-full text-left overflow-hidden rounded-md
        border border-[var(--console-line)] bg-[var(--console-panel)] transition-colors
        hover:border-[rgb(var(--console-accent-rgb)/0.55)]
        focus-visible:border-[var(--console-accent-ink)]`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
        >
            {/* A LOCKED SIGNAL IS STILL A SIGNAL, and it still states the fact.
                A free student's diagnosis is real and about them, so hiding it
                behind the paywall would withhold the one thing here that costs
                nothing to give — and it is the most honest argument for the
                tools that this screen can make. */}
            {locked ? (
                <Link to={createPageUrl("Subscription")} className={className}>{body}</Link>
            ) : (
                <button type="button" className={className} onClick={() => onOpen(card)}>{body}</button>
            )}
        </motion.div>
    );
}

export default function ToolBrief({ cards = [], locked = false, onOpen, loading = false }) {
    // NOTHING IS DRAWN WHILE IT LOADS. A skeleton brief would promise findings
    // before anything has been counted, and the commonest real answer here —
    // a new account with nothing measured — is an empty list.
    if (loading) return null;

    // THE MEASURE IS CAPPED AND THE ROWS ARE NOT. The brief used to sit at
    // `max-w-2xl` while the toolkit below ran full width, so the top of the page
    // was a narrow column beside a void. A sentence still wants a measure — so
    // the heading keeps one and the ROWS span the content, the way the saved
    // conversations below them do. Only the prose is narrow, which reads as
    // typography rather than as somewhere content failed to reach.
    return (
        <div>
            {/* THE EYEBROW IS MONO, which is the console's one piece of type
                vocabulary: labels on an instrument are monospaced and body copy
                is not, so the meta and the prose cannot be mistaken for each
                other at a glance. The COUNT beside it is real — it is the length
                of the list directly below — rather than a status readout with
                nothing behind it, which is the invented number this codebase
                deletes on sight. */}
            {/* NO EYEBROW. It read "WORTH A TOOL TODAY" in mono capitals
                directly above an `h1` reading "Here is what your own work says
                is worth a tool" — the same words twice, the second time
                shouted, with a count chip over a list two rows long. A heading
                does not need a label saying what the heading is about. */}
            {/* THE HEADING FRAMES; IT DOES NOT RESTATE. It used to print the
                first card's fact, which the first card then printed again in
                bold two inches below — one sentence twice, caught only by
                looking at it. Every row leads with its own fact at full weight,
                so nothing up here competes with the top of the list. */}
            <h1 className="font-display font-extrabold text-[var(--console-ink)]
                text-2xl sm:text-[28px] leading-[1.15] mb-5 max-w-3xl">
                {cards.length
                    ? "Here is what your own work says is worth a tool."
                    : "Pick the tool for where you are up to."}
            </h1>

            {cards.length > 0 && (
                <div className="space-y-2">
                    {cards.map((c, i) => (
                        <Signal key={c.key} card={c} index={i} locked={locked} onOpen={onOpen} />
                    ))}
                </div>
            )}

            {/* WITH NOTHING MEASURED IT SAYS SO. An account in its first week
                has no dropped criteria, no slipping cards and nothing on the
                calendar — inventing a card for it would be the padding every
                builder in toolBrief.js refuses, on the one screen where a
                student has no way to tell. */}
            {!cards.length && (
                <p className="text-sm leading-relaxed text-[var(--console-ink-dim)] max-w-2xl">
                    Once you have sat a quiz or reviewed some cards, this is where
                    what you keep dropping shows up — with the tool that clears it.
                </p>
            )}
        </div>
    );
}
