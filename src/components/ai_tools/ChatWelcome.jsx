/**
 * ChatWelcome — what the chat shows before the student has typed anything.
 *
 * ─── THE LOBBY IS GONE; THE CHAT IS THE PAGE ────────────────────────────────
 * /AITools has been a persona dropdown over an empty thread, a BENCH of verbs
 * over a workpiece, a SCAN that diagnosed a pasted paragraph, and a DASHBOARD
 * in front of the chat. Each put something in front of the chat and each lost
 * to it. What was always wrong was ARRIVING — a blank box asks for the two
 * hardest parts of the job at once, which tool and what exactly is wrong — so
 * the answer is the chat's own empty state: a composer in the middle, what
 * their own work says under it, and the catalogue below that.
 *
 * ─── IT GREETS THEM, AND THE BIG ICON WENT ──────────────────────────────────
 * It opened on a 48px tile holding the current tool's icon over "What are we
 * working on?" and that tool's blurb — Math Tutor's, for everybody, because
 * the tool was `CHAT_TOOLS[0]`. An icon restating the tool named in the
 * composer two inches below is the decoration this app keeps deleting. A
 * greeting by name says something no other screen of a chatbot can: that this
 * one knows who is in front of it.
 *
 * ─── THE SUGGESTIONS ARE FACTS, NOT EXAMPLE PROMPTS ─────────────────────────
 * Counted off rows this student owns (`toolBrief.js` owns all the arithmetic),
 * so each one is CHECKABLE: "you have dropped this three times" means three,
 * and the three are on /MistakeBank. The FACT and the OFFER are printed
 * separately and in that order — the fact is the half the student checks us
 * on; collapsed into one sentence it stops being checkable.
 *
 * ─── THE CATALOGUE IS GROUPED BY WHEN YOU REACH FOR ONE ─────────────────────
 * `PHASES` is the only axis a student can place themselves on without knowing a
 * single tool's name. Colour means PHASE here and only phase (`toneForTool`);
 * the thread uses the tool's own hue, where it names who is speaking.
 *
 * ─── THE LATTICE LIVES HERE NOW ─────────────────────────────────────────────
 * It was drawn across the whole route, behind a bordered panel that covered
 * most of it, so it showed only in the margins and lined up with nothing. The
 * page is full-bleed now and the lattice is drawn behind THIS, in the box the
 * content column is centred in — which is what makes `--lattice-x` land a line
 * on both of the column's edges. Once a conversation starts the welcome goes
 * and so does the grid: a thread is read, and a reading surface is plain.
 *
 * ─── NOTHING HERE INVENTS A NUMBER ──────────────────────────────────────────
 * A tool nobody has opened prints NOTHING rather than "0 chats".
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

/** Morning, afternoon or evening — the student's own clock, not the server's. */
function greeting(name, now = new Date()) {
    const h = now.getHours();
    const part = h < 5 ? "Evening" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
    return name ? `${part}, ${name}.` : `${part}.`;
}

/**
 * One suggestion. A FACT, then what pressing it does.
 *
 * A LOCKED CHIP STILL STATES ITS FACT. A free student's diagnosis is real and
 * about them; hiding it would withhold the one thing here that costs nothing to
 * give. It goes to /Subscription rather than nowhere.
 */
function Suggestion({ card, index, locked, label, onOpen }) {
    const tone = toneForTool(card.tool);

    const body = (
        <>
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${tone.spine}`} aria-hidden="true" />
            <span className="flex h-full flex-col pl-4 pr-3 py-3">
                <span className="block text-[13.5px] font-bold leading-snug text-[var(--console-ink)]">
                    {card.fact}
                </span>
                <span className="mt-1 block text-[12px] leading-snug text-[var(--console-ink-dim)]">
                    {card.offer}
                </span>
                <span className={`mt-auto flex items-center gap-1.5 pt-2.5 text-[11px] font-bold ${tone.ink}`}>
                    {label}
                    {locked
                        ? <Lock className="h-3 w-3 text-[var(--console-ink-faint)]" aria-hidden="true" />
                        : <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
                </span>
            </span>
        </>
    );

    const className = `group relative block h-full w-full overflow-hidden text-left rounded-xl
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

    const className = `group relative flex w-full items-center gap-3 overflow-hidden py-2.5 pl-3.5 pr-3
        text-left transition-colors hover:bg-[var(--console-panel-2)]
        ${active ? "bg-[var(--console-panel-2)]" : ""}`;
    const inner = (
        <>
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${tone.spine}
                ${active ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}`} aria-hidden="true" />

            {/* THE GLYPH IS THE DIFFERENTIATOR in a repeated set, so it keeps
                its shape and takes the phase's ink — no plate behind it. */}
            <Icon className={`w-4 h-4 flex-shrink-0 ${tone.ink}`} aria-hidden="true" />

            <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold leading-tight text-[var(--console-ink)]">
                    {tool.label}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[var(--console-ink-dim)]">
                    {tool.blurb}
                </span>
            </span>

            {/* A FIXED CELL, drawn EMPTY when there is nothing to say, or the
                column goes ragged. */}
            <span className="hidden sm:block w-[62px] flex-shrink-0 text-right font-mono text-[10.5px]
                tabular-nums text-[var(--console-ink-faint)]">
                {used}
            </span>

            {locked && <Lock className="w-3 h-3 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />}
        </>
    );

    // A LOCKED ROW GOES WHERE A LOCKED SUGGESTION GOES. Picking a tool a free
    // account cannot send to would change a composer that is not on screen.
    return locked
        ? <Link to={createPageUrl("Subscription")} className={className}>{inner}</Link>
        : (
            <button type="button" onClick={() => onPick(tool.id)} aria-current={active ? "true" : undefined}
                className={className}>
                {inner}
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
    firstName = "",
    price = null,
    labelFor,
    onOpenCard,
    onPickTool,
    children,
}) {
    const bands = toolsByPhase(tools);

    return (
        <div className="relative isolate min-h-full pb-10 pt-8 sm:pt-14">
            {/* THE GRID IS DRAWN IN THE BOX THE COLUMN IS CENTRED IN, so the
                `50%` in `--lattice-x` is half of the same width the column is
                centred against. On the whole route it was half of a width the
                column had nothing to do with. */}
            <div className="console-lattice pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

            {/* THE MEASURE AND ITS PADDING ARE ONE ELEMENT, because the lattice
                is origined on this column's own left edge and the division that
                lands a line on BOTH edges needs a single number. */}
            <div className="mx-auto w-full max-w-3xl px-4">
                {/* ── The greeting ────────────────────────────────────────── */}
                <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--console-ink-dim)]">{greeting(firstName)}</p>
                    <h1 className="mt-1 font-display text-[26px] font-extrabold leading-[1.15] text-[var(--console-ink)] sm:text-[32px]">
                        What are we working on?
                    </h1>
                </div>

                {/* ── The composer, centre stage ──────────────────────────── */}
                <div className="mt-7 text-left">{children}</div>
                {!locked && tool?.blurb && (
                    <p className="mt-2.5 text-center text-[12.5px] leading-snug text-[var(--console-ink-dim)]">
                        <span className="font-bold text-[var(--console-ink)]">{tool.label}</span>
                        {" — "}{tool.blurb}
                        {/* The composer row has no room for the price on a phone,
                            so it is said here, in words, before anything is sent. */}
                        {price != null && <span className="sm:hidden"> {price} chips a message.</span>}
                    </p>
                )}

                {/* ── What their own work says ────────────────────────────── */}
                {/* NOTHING IS DRAWN WHILE IT LOADS. A skeleton would promise
                    findings before anything has been counted, and the commonest
                    real answer — a new account — is an empty list. */}
                {!loading && cards.length > 0 && (
                    <section className="mt-10">
                        <div className="mb-3 flex items-center gap-3">
                            <h2 className="text-[13px] font-bold text-[var(--console-ink)]">From your own work</h2>
                            <span className="h-px flex-1 bg-[var(--console-line)]" aria-hidden="true" />
                        </div>
                        {/* `auto-fit`, so two findings take the row between them
                            rather than two thirds of it beside a hole. */}
                        <div className="grid items-stretch gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
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
                <section className="mt-10 space-y-6" aria-label="All tools">
                    {bands.map((band) => (
                        <div key={band.id}>
                            {/* A RULE TO THE END OF THE ROW turns a heading over a
                                short list from a hole into a shelf. */}
                            <div className="mb-2 flex items-baseline gap-3">
                                <h3 className={`text-[11px] font-bold uppercase tracking-[0.1em] ${band.ink}`}>
                                    {band.label}
                                </h3>
                                <span className="h-px flex-1 bg-[var(--console-line)]" aria-hidden="true" />
                                <span className="hidden sm:block text-[11.5px] text-[var(--console-ink-faint)]">
                                    {band.blurb}
                                </span>
                            </div>
                            <div className="overflow-hidden rounded-xl border border-[var(--console-line)]
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
