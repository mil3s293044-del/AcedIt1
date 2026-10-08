/**
 * ChatWelcome — what the chat shows before the student has typed anything.
 *
 * ─── THE LOBBY IS GONE; THE CHAT IS THE PAGE ────────────────────────────────
 * /AITools has now been a persona dropdown over an empty thread, a BENCH of
 * verbs over a workpiece, a SCAN that diagnosed a pasted paragraph, and a
 * DASHBOARD in front of the chat. Three of those four replaced or fronted the
 * chat, and the chat is the surface a student actually wants: it streams, it
 * saves, it bills the right feature. What was always wrong was ARRIVING at it —
 * a blank box asks for the two hardest parts of the job at once, which tool
 * solves this and what exactly is wrong.
 *
 * So the answer is not a screen in front of the chat. It is the chat's own
 * empty state carrying what that screen was for, which is what every chatbot
 * worth copying already does: a composer in the middle, suggestions under it,
 * and the catalogue below that for somebody who would rather browse.
 *
 * ─── THE SUGGESTIONS ARE FACTS, NOT EXAMPLE PROMPTS ─────────────────────────
 * ChatGPT's starter chips are written by its authors and are the same for
 * everybody. These are counted off rows this student owns — `toolBrief.js` owns
 * the whole argument and all of the arithmetic — so each one is CHECKABLE:
 * "you have dropped this three times" means three, and the three are on
 * /MistakeBank. That is the one thing on this screen a generic chatbot cannot
 * print, which is why it sits directly under the composer rather than below the
 * catalogue.
 *
 * Each chip prints the FACT and the OFFER separately and in that order. The
 * fact is the half the student checks us on; the offer is what the button does.
 * Collapsed into one sentence they read as a single claim and the checkable
 * half stops being checkable — the whole difference between this and the
 * generated advice that was deleted from Insights.
 *
 * ─── THE CATALOGUE IS GROUPED BY WHEN YOU REACH FOR ONE ─────────────────────
 * Twelve tools in a flat grid is the dropdown again with more pixels, and a
 * grid of twelve identical cards is precisely the shape this codebase keeps
 * deleting (the old quiz list, the nineteen-box dashboard). `PHASES` is the
 * only axis a student can place themselves on without knowing a single tool's
 * name: somebody with a SAC on Friday knows whether they have written anything
 * yet. Rows on fixed columns rather than cards, which is the lesson the Ranked
 * board records about what makes a list read as designed.
 *
 * ─── COLOUR MEANS PHASE, AND ONLY PHASE ─────────────────────────────────────
 * `chatTools.js` gives every tool an accent of its own and the chat THREAD still
 * uses it — there it identifies who is speaking. Here it would mean twelve hues
 * against four groups with nothing saying which mattered, so `toneForTool` is
 * the one lookup and a run of rows sharing a spine reads as a band.
 *
 * ─── NOTHING HERE INVENTS A NUMBER ──────────────────────────────────────────
 * A tool nobody has opened prints NOTHING rather than "0 chats" — a zero row is
 * the padding every builder in `toolBrief.js` and `studyQueue.js` refuses, and
 * on a first-week account it would be twelve of them.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { createPageUrl } from "@/utils";
import { toolsByPhase, toneForTool } from "@/lib/toolLabels";

/** An instrument's usage, or "" — never a zero. */
function usageLabel(stat) {
    if (!stat || !stat.count) return "";
    return stat.count === 1 ? "1 chat" : `${stat.count} chats`;
}

/**
 * One suggestion. A FACT, then what pressing it does.
 *
 * A LOCKED CHIP STILL STATES ITS FACT. A free student's diagnosis is real and
 * about them, so hiding it behind the paywall would withhold the one thing here
 * that costs nothing to give — and it is the most honest argument for the tools
 * this screen can make. It goes to /Subscription rather than nowhere.
 */
function Suggestion({ card, index, locked, label, onOpen }) {
    const tone = toneForTool(card.tool);

    const body = (
        <>
            {/* The spine runs the full height rather than sitting as a dot at
                the top, which is the idiom Subjects, the Quizzes shelf and
                QueueRow all use to say which family a row belongs to. */}
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${tone.spine}`} aria-hidden="true" />
            <span className="block pl-3 pr-2.5 py-2.5">
                <span className="block text-[13px] font-bold leading-snug text-[var(--console-ink)]">
                    {card.fact}
                </span>
                <span className="mt-1.5 flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 text-[11px] leading-snug text-[var(--console-ink-dim)]">
                        {card.offer}
                    </span>
                    {locked
                        ? <Lock className="w-3 h-3 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />
                        : <ArrowRight className="w-3 h-3 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />}
                </span>
                <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.1em]
                    text-[var(--console-ink-faint)]">
                    {label}
                </span>
            </span>
        </>
    );

    const className = `group relative block h-full w-full overflow-hidden text-left rounded-lg
        border border-[var(--console-line)] bg-[var(--console-panel)] transition-colors
        hover:border-[rgb(var(--console-accent-rgb)/0.55)]
        focus-visible:border-[var(--console-accent-ink)]`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + index * 0.05 }}
            className="h-full"
        >
            {locked
                ? <Link to={createPageUrl("Subscription")} className={className}>{body}</Link>
                : <button type="button" className={className} onClick={() => onOpen(card)}>{body}</button>}
        </motion.div>
    );
}

/** One instrument. Name and blurb on the left, what you have used it for on the right. */
function ToolRow({ tool, active, locked, usage, onPick }) {
    const tone = toneForTool(tool.id);
    const Icon = tool.icon;
    const used = usageLabel(usage);

    return (
        <button
            type="button"
            onClick={() => onPick(tool.id)}
            aria-current={active ? "true" : undefined}
            className={`group relative flex w-full items-center gap-2.5 overflow-hidden py-2 pl-3 pr-2.5
                text-left transition-colors hover:bg-[var(--console-panel-2)]
                ${active ? "bg-[var(--console-panel-2)]" : ""}`}
        >
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${tone.spine}
                ${active ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}`} aria-hidden="true" />

            {/* THE GLYPH IS THE DIFFERENTIATOR, so it keeps its shape and takes
                the phase's ink. A repeated set is the one case this app's icon
                rule keeps glyphs for — and no plate behind it, which is the
                ornament the old twelve-card grid was rebuilt to lose. */}
            <Icon className={`w-4 h-4 flex-shrink-0 ${tone.ink}`} aria-hidden="true" />

            <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold leading-tight text-[var(--console-ink)]">
                    {tool.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--console-ink-dim)]">
                    {tool.blurb}
                </span>
            </span>

            {/* A FIXED CELL, drawn EMPTY when there is nothing to say. As a flex
                row the count slid to the edge on some rows and sat short on
                others — ragged, which is the fault fixed columns exist to fix. */}
            <span className="hidden sm:block w-[62px] flex-shrink-0 text-right font-mono text-[10px]
                tabular-nums text-[var(--console-ink-faint)]">
                {used}
            </span>

            {locked && <Lock className="w-3 h-3 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />}
        </button>
    );
}

export default function ChatWelcome({
    tool,
    tools = [],
    cards = [],
    usage = {},
    locked = false,
    loading = false,
    labelFor,
    onOpenCard,
    onPickTool,
    children,
}) {
    const Icon = tool?.icon;
    const bands = toolsByPhase(tools);

    return (
        <div className="min-h-full py-7 sm:py-10">
            {/* THE MEASURE AND ITS PADDING ARE ONE ELEMENT, because the lattice
                behind this is origined on this column's own left edge and the
                division that makes a line land on BOTH edges needs a single
                number. Split across two elements the gutter stops being part of
                the column and the arithmetic in index.css silently stops being
                true. */}
            <div className="mx-auto w-full max-w-3xl px-4">
                {/* ── The ask ─────────────────────────────────────────────── */}
                <div className="text-center">
                    {Icon && (
                        <span className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl
                            border border-[var(--console-line)] bg-[var(--console-panel)]">
                            <Icon className="h-6 w-6 text-[var(--console-accent-ink)]" aria-hidden="true" />
                        </span>
                    )}
                    <h1 className="font-display font-extrabold text-[var(--console-ink)] text-2xl sm:text-[28px]
                        leading-[1.15]">
                        What are we working on?
                    </h1>
                    {tool?.blurb && (
                        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--console-ink-dim)]">
                            {tool.blurb}
                        </p>
                    )}
                </div>

                {/* ── The composer, centre stage ──────────────────────────── */}
                <div className="mt-6 text-left">{children}</div>

                {/* ── What their own work says ────────────────────────────── */}
                {/* NOTHING IS DRAWN WHILE IT LOADS. A skeleton here would promise
                    findings before anything has been counted, and the commonest
                    real answer — a new account with nothing measured — is an
                    empty list, so the skeleton would be a lie twice over. */}
                {!loading && cards.length > 0 && (
                    <section className="mt-7">
                        <div className="mb-2.5 flex items-center gap-2.5">
                            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em]
                                text-[var(--console-ink-faint)]">
                                Worth a tool today
                            </h2>
                            <span className="h-px flex-1 bg-[var(--console-line-soft)]" aria-hidden="true" />
                        </div>
                        <div className="grid items-stretch gap-2 sm:grid-cols-3">
                            {cards.map((c, i) => (
                                <Suggestion
                                    key={c.key} card={c} index={i} locked={locked}
                                    label={labelFor ? labelFor(c.tool) : ""}
                                    onOpen={onOpenCard}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── The catalogue, by when you reach for one ────────────── */}
                <section className="mt-7 space-y-5">
                    {bands.map((band) => (
                        <div key={band.id}>
                            {/* A RULE TO THE END OF THE ROW. It is what turns a
                                heading over a short list from a hole into a
                                shelf — the Quizzes-shelf idiom, and "After you
                                write" will never hold more than two. */}
                            <div className="mb-2 flex items-baseline gap-2.5">
                                <h3 className={`text-[11px] font-bold uppercase tracking-[0.1em] ${band.ink}`}>
                                    {band.label}
                                </h3>
                                <span className="h-px flex-1 bg-[var(--console-line-soft)]" aria-hidden="true" />
                                <span className="hidden sm:block text-[11px] text-[var(--console-ink-faint)]">
                                    {band.blurb}
                                </span>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-[var(--console-line)]
                                bg-[var(--console-panel)] divide-y divide-[var(--console-line-soft)]">
                                {band.tools.map((t) => (
                                    <ToolRow
                                        key={t.id} tool={t} active={t.id === tool?.id} locked={locked}
                                        usage={usage?.[t.id]} onPick={onPickTool}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </div>
    );
}
