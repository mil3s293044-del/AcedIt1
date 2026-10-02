/**
 * WhatToTest — the picks that open a session, drawn as the TOP OF THE SETUP
 * CARD rather than as a panel sitting on it.
 *
 * ─── IT WAS A BLOB PATCHED ON TOP OF THE PAGE ───────────────────────────────
 * It rendered its own `card-soft`, above a second card called "Session Setup",
 * beside a third called "Turn your notes into questions" — three panels on one
 * screen all answering "what am I about to study". Picking a row changed two
 * fields in a card BELOW it, which a student has no reason to look at. So the
 * most useful thing on the screen read as an advert for the form underneath.
 *
 * It renders no card now. The parent owns the panel and this is its head: Ace
 * asks, the picks are a flush list, and a rule under them hands over to the
 * manual fields. One surface, one next move — the rule the Quizzes page landed
 * on when it had five.
 *
 * ─── A ROW IS A SPINE, NOT A BOX ────────────────────────────────────────────
 * Each pick was a `rounded-2xl border-2` inside a bordered card: box in a box,
 * four times down the screen, which is most of what made it read as pasted on.
 * The kind's colour is a SPINE down the row — the idiom Subjects and the
 * Quizzes shelf already use to identify a thing — and the rows separate with a
 * hairline. The pill stays, because "costing you marks" is a claim and a bare
 * colour cannot make it.
 *
 * ─── THE ROW STARTS THE SESSION ─────────────────────────────────────────────
 * On BOTH pages, and that is deliberate: `startFromSuggestion` records that a
 * suggestion saying "I'll build it" has to build it, rather than filling two
 * fields and leaving the student to go and find a button. Blurting used to
 * fill-and-stop, which made one affordance mean two things across two sibling
 * screens. The manual fields under the rule are the other path, and they are
 * drawn as the other path.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Network } from "lucide-react";
import AceBody from "@/components/ace/AceBody";
import { suggestTopics, ownMaterial, SUGGESTION_KIND } from "@/lib/recallSuggest";

// Spine, pill ground and pill ink per kind. Static classes only — the JIT
// cannot see a template-string class name.
const KIND_STYLE = {
    weak:       { spine: "bg-streak",   pill: "bg-streak/15 text-streak" },
    assessment: { spine: "bg-xp",       pill: "bg-xp/15 text-xp" },
    slipped:    { spine: "bg-chart-4",  pill: "bg-chart-4/15 text-chart-4" },
    recent:     { spine: "bg-primary",  pill: "bg-primary/15 text-primary" },
};
const FALLBACK = { spine: "bg-border", pill: "bg-secondary text-muted-foreground" };

/**
 * `picks` is optional and the parent passes it. The card around this has to
 * know whether there are any BEFORE it renders — with none, its "or set it up
 * yourself" rule would be handing over from nothing. Computing it in both
 * places would be two answers to one question; `suggestTopics` is pure, so the
 * parent owns it and hands it down.
 */
export default function WhatToTest({
    flashcards = [], assessments = [], techniques = [], maps = [],
    picks = null, onPick, limit = 4, verb = "Test",
}) {
    const computed = useMemo(
        () => suggestTopics({ flashcards, assessments, techniques, limit }),
        [flashcards, assessments, techniques, limit]);
    const suggestions = picks || computed;

    // What the app can build a session from RIGHT NOW, per suggestion — shown
    // before they commit, so nobody starts a session and finds it empty.
    const withMaterial = useMemo(() => suggestions.map(s => ({
        ...s,
        material: ownMaterial({ flashcards, maps, subject: s.subject, topic: s.topic }),
    })), [suggestions, flashcards, maps]);

    if (!withMaterial.length) return null;

    return (
        <div>
            {/* Ace asks it. The heading was already a question — "What should
                I test?" — sitting under a target icon in a rounded box, which
                is a question nobody is being asked BY anyone. He's holding the
                options out to you, which is what the list actually is. */}
            <div className="flex items-end gap-3">
                <AceBody className="w-16 sm:w-20 flex-shrink-0 -mb-1" pose="offer" title="Ace" />
                <div className="min-w-0 mb-1">
                    <h3 className="font-display font-extrabold text-foreground text-base leading-snug">
                        {verb === "Blurt" ? "Right — what are we blurting?" : "Right — what are we testing?"}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                        From what you&rsquo;ve actually logged. Pick one and I&rsquo;ll build it.
                    </p>
                </div>
            </div>

            {/* Flush, hairline-separated, each row carrying its own spine. The
                negative inset takes the rows to the card's edge, so the list
                reads as part of the panel rather than as a thing inside it. */}
            <ul className="mt-4 -mx-5 sm:-mx-6">
                {withMaterial.map((s, i) => {
                    const ink = KIND_STYLE[s.kind.id] || FALLBACK;
                    return (
                        <motion.li key={`${s.subject}-${s.topic}`}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(i * 0.05, 0.25) }}
                            className="border-t border-border">
                            <button onClick={() => onPick?.(s)}
                                className="group relative w-full text-left pl-5 pr-4 sm:pl-6 sm:pr-5 py-3
                                    hover:bg-secondary/40 transition-colors">
                                <span aria-hidden
                                    className={`absolute left-0 top-0 bottom-0 w-1 ${ink.spine}
                                        opacity-70 group-hover:opacity-100 transition-opacity`} />
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline gap-x-2">
                                            <span className="text-sm font-bold text-foreground">{s.topic}</span>
                                            {s.subject && (
                                                <span className="text-[11px] text-muted-foreground">{s.subject}</span>
                                            )}
                                        </div>
                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                            <span className={`pill ${ink.pill}`}>{s.kind.label}</span>
                                            <span className="text-xs text-muted-foreground">{s.why}</span>
                                        </p>
                                    </div>
                                    {/* What it can run on without an upload. Saying
                                        this up front is the difference between a
                                        suggestion and a promise. It trails the row
                                        rather than sitting under the reason, which
                                        put two numbers on two lines saying
                                        different things about one topic. */}
                                    <span className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0
                                        text-[11px] text-muted-foreground">
                                        {s.material.cards.length > 0 && (
                                            <span className="inline-flex items-center gap-1">
                                                <Layers className="w-3 h-3" />
                                                <span className="font-bold text-foreground">{s.material.cards.length}</span> cards
                                            </span>
                                        )}
                                        {s.material.fromMap.length > 0 && (
                                            <span className="inline-flex items-center gap-1">
                                                <Network className="w-3 h-3" />
                                                <span className="font-bold text-foreground">{s.material.fromMap.length}</span> from your map
                                            </span>
                                        )}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs font-bold
                                        text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0">
                                        {verb}
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                    </span>
                                </div>
                            </button>
                        </motion.li>
                    );
                })}
            </ul>
        </div>
    );
}

export { SUGGESTION_KIND };
