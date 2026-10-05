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
 * These rows carry a SPINE in the tool's own colour and no glyph plate; the
 * tools below carry a glyph plate and no spine; the conversations are a divided
 * list inside one panel. Three blocks, three shapes, told apart before a word
 * is read — the spine idiom Subjects, the Quizzes shelf and QueueRow all use.
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

/** The link a card opens. The seed rides in the query string, unsent. */
export function briefHref(card) {
    return `${createPageUrl("AITools")}?${toolQuery(card)}`;
}

function Signal({ card, index, locked, onOpen }) {
    const tool = toolById(card.tool);
    const body = (
        <>
            {/* THE SPINE IS THE TOOL, which is also what the tag under it says.
                Colour and word rather than colour alone: the floor's CVD rule —
                anything encoding an identity in hue needs a second channel. */}
            <span
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${tool?.accentSolid || "bg-[var(--console-accent)]"}`}
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
                    {tool?.label && (
                        <span className="font-mono text-[10px] uppercase tracking-wider whitespace-nowrap
                            text-[var(--console-ink-faint)]">
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
            <div className="flex items-center gap-2.5 mb-2">
                {/* NOT "Your toolkit" IN THE EMPTY CASE: that is the heading of
                    the block directly below, so a first-week account got the same
                    label twice on one screen with different content under each. */}
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]
                    text-[var(--console-ink-faint)]">
                    {cards.length ? "Worth a tool today" : "AI tools"}
                </span>
                {cards.length > 0 && (
                    <span className="font-mono text-[10px] font-bold leading-none px-1.5 py-1 rounded
                        bg-[rgb(var(--console-accent-rgb)/0.14)] text-[var(--console-accent-ink)]">
                        {cards.length}
                    </span>
                )}
                <span className="h-px flex-1 bg-[var(--console-line)]" aria-hidden="true" />
            </div>

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
