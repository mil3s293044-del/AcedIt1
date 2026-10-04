/**
 * ToolBrief — what the dashboard leads with, before the student has typed.
 *
 * ─── A BLANK BOX ASKS THE STUDENT TO DO THE DIAGNOSIS ───────────────────────
 * /AITools opened on an empty thread behind a persona dropdown, so the first
 * thing it asked for was the two hardest parts of the job: knowing which tool
 * solves your problem, and stating the problem. Meanwhile nine modules in this
 * codebase already knew what was wrong — see toolBrief.js's header, which owns
 * the whole argument and all of the arithmetic.
 *
 * ─── SO IT LEADS THE DASHBOARD, AND THE TOOLKIT SITS UNDER IT ───────────────
 * This block is the page's own heading rather than a section inside it, which
 * is deliberate: a dashboard that opens with twelve tool cards has put the
 * catalogue first and asked the student to match themselves to it, which is the
 * dropdown again with more pixels. What goes first is the half that is about
 * THEM — and it is the only thing on this screen a generic chatbot cannot
 * print.
 *
 * ─── EVERY FACT IS CHECKABLE, WHICH IS WHY IT IS PRINTED SEPARATELY ─────────
 * Each card is a FACT and an OFFER, in that order and visibly distinct. The
 * fact is counted off rows the student can go and look at ("you have dropped
 * this three times" — the three are on /MistakeBank); the offer is what the
 * button does. Collapsed into one sentence they read as a single claim and the
 * checkable half stops being checkable, which is the whole difference between
 * this and the generated advice that was deleted from Insights.
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

function Card({ card, index, locked, onOpen }) {
    const tool = toolById(card.tool);
    const Glyph = tool?.icon;
    const body = (
        <>
            <div className="flex items-start gap-3">
                {Glyph && (
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                        ${tool.accentBg}`}>
                        {/* `w-4.5` is not in Tailwind's default scale and nothing here extends
                            it, so the old class was invalid and the glyph fell back to
                            lucide's intrinsic 24px inside a 36px chip. */}
                        <Glyph className={`w-4 h-4 ${tool.accentText}`} aria-hidden="true" />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    {/* THE FACT LEADS and is the heavier of the two, because it
                        is the half the student can check us on. */}
                    <p className="font-semibold text-foreground text-sm leading-snug">{card.fact}</p>
                    <p className="text-[13px] text-muted-foreground mt-1 leading-snug">
                        {card.offer}
                        {tool?.label && <span className="text-muted-foreground/70"> · {tool.label}</span>}
                    </p>
                </div>
                {locked
                    ? <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" aria-hidden="true" />
                    : <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" aria-hidden="true" />}
            </div>
        </>
    );

    const className = `block w-full text-left rounded-2xl border-2 border-border bg-surface p-4
        transition-colors hover:border-primary/40 focus-visible:border-primary/60`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
        >
            {/* A LOCKED CARD IS STILL A CARD, and it still states the fact. A
                free student's diagnosis is real and about them, so hiding it
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

    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                {cards.length ? "Worth a tool today" : "Your tools"}
            </p>
            {/* THE HEADING FRAMES; IT DOES NOT RESTATE. It used to print the
                first card's fact, which the first card then printed again in
                bold two inches below — one sentence twice, caught only by
                looking at it. Every card leads with its own fact at full
                weight, so nothing up here competes with the top of the list. */}
            <h1 className="font-display font-extrabold text-foreground text-xl sm:text-2xl leading-tight mb-5">
                {cards.length
                    ? "Here is what your own work says is worth a tool."
                    : "Pick the tool for where you are up to."}
            </h1>

            {cards.length > 0 && (
                <div className="space-y-2.5 max-w-2xl">
                    {cards.map((c, i) => (
                        <Card key={c.key} card={c} index={i} locked={locked} onOpen={onOpen} />
                    ))}
                </div>
            )}

            {/* WITH NOTHING MEASURED IT SAYS SO. An account in its first week
                has no dropped criteria, no slipping cards and nothing on the
                calendar — inventing a card for it would be the padding every
                builder in toolBrief.js refuses, on the one screen where a
                student has no way to tell. */}
            {!cards.length && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                    Once you have sat a quiz or reviewed some cards, this is where
                    what you keep dropping shows up — with the tool that clears it.
                </p>
            )}
        </div>
    );
}
