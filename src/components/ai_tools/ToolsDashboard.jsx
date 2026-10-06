/**
 * ToolsDashboard — the screen /AITools opens on.
 *
 * ─── THE PAGE WAS A CHAT, AND A CHAT HAS NO FRONT DOOR ──────────────────────
 * /AITools has been three things: a persona dropdown over an empty thread, a
 * "bench" of verbs over a workpiece, and a scan that diagnosed a paragraph.
 * The chat is the right surface — it streams, it saves, it bills the right
 * feature, and it is what students actually want from an AI tool — and it is a
 * terrible LANDING, because an empty thread asks for the two hardest parts of
 * the job at once: which tool solves this, and what exactly is wrong.
 *
 * So the chat is unchanged and this is what sits in front of it. Three blocks,
 * in the order the questions get asked:
 *
 *   WHAT YOUR OWN WORK SAYS   `ToolBrief` — counted off rows already loaded,
 *                             so every line is checkable, and it leads because
 *                             it is the only part that is about them.
 *   YOUR TOOLKIT              all twelve, on a rail through the four phases.
 *   PICK UP WHERE YOU LEFT OFF   the conversations that already save.
 *
 * ─── IT IS A ROOM NOW, AND THE ROOM IS WHY IT READS AS A CONSOLE ────────────
 * Every element here used to be the SAME OBJECT — the direction cards, the
 * twelve tools and the saved conversations were one `rounded-2xl border-2
 * bg-surface` box with a 36px chip, a bold title and a chevron. Nineteen of
 * them, so nothing led, nothing was told apart, and the page read as a list of
 * divs. The brief was also capped at `max-w-2xl` while the toolkit ran full
 * width, so the top of the page was a narrow column beside a void.
 *
 * Three blocks, three shapes, on one grid: a SIGNAL carries a coloured spine
 * and no glyph, an INSTRUMENT carries a glyph plate and no spine, a saved
 * conversation is a row in a divided table. The palette, the hairlines and the
 * lattice live in `Console` — see index.css, and `consoleInk.test.mjs` for the
 * four silent ways to break a scoped palette.
 *
 * ─── NOTHING HERE CALLS A MODEL, AND NOTHING IS STORED ──────────────────────
 * The direction cards are arithmetic (toolBrief.js) and the Recent list is a
 * read of rows that exist (aiChats.js). A dashboard that generated its own
 * advice would be the second answer to a question the cards already answer
 * properly — and the one answer nobody can check, which is exactly what was
 * deleted from Insights. For the same reason there is no status readout: a
 * console is a tempting place to print "SYSTEM READY · 94%", and a number with
 * nothing behind it teaches a student that none of the numbers here are real.
 *
 * ─── THE PRICE IS NOT ON THE CARDS, DELIBERATELY ────────────────────────────
 * Pressing a tool here opens the chat with the composer seeded and SENDS
 * NOTHING, so no chips are spent by arriving — megaUpload's rule is that the
 * price is on screen before it is spent, and the thing that spends it is the
 * send button, which is where the cost already appears. Twelve prices across
 * twelve cards would be twelve figures on a screen where none of them is yet
 * true of anything.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { CHAT_TOOLS } from "@/components/ai_tools/chatTools";
import Console from "@/components/ai_tools/Console";
import ToolBrief from "@/components/ai_tools/ToolBrief";
import { toolsByPhase } from "@/lib/toolLabels";
import { fmtDate } from "@/lib/safeDate";
import { createPageUrl } from "@/utils";

/** `01`–`04`. A channel on an instrument is numbered, and the rail is ordered. */
const ordinal = (i) => String(i + 1).padStart(2, "0");

/**
 * A phase on the rail.
 *
 * ─── THE FOUR PHASES ARE A SEQUENCE AND WERE DRAWN AS FOUR HEADINGS ─────────
 * Before → while → after → test is the best idea on this page and it was
 * invisible: four identical bold labels stacked down the page, each with a rule
 * beside it, saying nothing about being in an order. The rail is what makes the
 * map legible before a word is read, and it is information rather than
 * decoration — a student with a SAC on Friday knows whether they have written
 * anything yet, which is the whole reason this is the grouping axis.
 *
 * ─── THE LAST PHASE DRAWS NO CONNECTOR ──────────────────────────────────────
 * A rail running past the final node claims a step that is not there, which is
 * the league payline's rule about a rule under the last row. So the connector
 * belongs to the GAP between two nodes and the last band has no gap below it.
 *
 * The heading still ends in a RULE TO THE END OF THE ROW. The rail delimits the
 * band on the left; the rule terminates it on the right, which is what turns a
 * left-aligned row of fixed-width cards from a hole into a shelf — "After you
 * write" holds two tools and will never fill three columns.
 */
function Phase({ index, label, blurb, last, children }) {
    return (
        <section className={`relative pl-7 sm:pl-9 ${last ? "pb-0" : "pb-8"}`}>
            {/* The node: a port on a panel. Uniform across the four, because
                there is no "you are here" to claim — the numeral is what says
                which one this is. */}
            <span
                className="absolute left-0 top-[1px] w-[13px] h-[13px] rounded-[3px] flex items-center justify-center
                    border border-[var(--console-rail)] bg-[var(--console-panel)]"
                aria-hidden="true"
            >
                <span className="w-[5px] h-[5px] rounded-[1px] bg-[var(--console-accent-ink)]" />
            </span>
            {!last && (
                <span
                    className="absolute left-[6px] top-[18px] bottom-0 w-px bg-[var(--console-rail)]"
                    aria-hidden="true"
                />
            )}

            <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-[var(--console-ink-faint)]">
                    {index}
                </span>
                <h2 className="font-display font-extrabold text-[15px] leading-none text-[var(--console-ink)]">
                    {label}
                </h2>
                <span className="h-px flex-1 bg-[var(--console-line)]" aria-hidden="true" />
            </div>
            {blurb && (
                <p className="text-[12.5px] mt-1.5 text-[var(--console-ink-dim)]">{blurb}</p>
            )}
            <div className="mt-3">{children}</div>
        </section>
    );
}

/**
 * One instrument.
 *
 * ─── IT KEEPS ITS GLYPH AND LOSES ITS CHEVRON ───────────────────────────────
 * Twelve tools are a repeated set and the glyphs are what tell them apart,
 * which is the one case this app's icon rule keeps them for. The chevron is
 * not: the whole card is the button, so an arrow in the corner restated the
 * affordance twelve times. The LOCK stays, because a lock is status.
 *
 * The plate is a SQUARE at a small radius rather than the old `rounded-xl`
 * chip — same information, and it is most of what moves the card from a
 * friendly tile to something mounted on a panel.
 */
function Instrument({ tool, index, locked, onOpen }) {
    const Icon = tool.icon;
    const body = (
        <span className="flex items-start gap-2.5">
            <span className={`w-7 h-7 rounded-[5px] flex items-center justify-center flex-shrink-0 ${tool.accentBg}`}>
                <Icon className={`w-3.5 h-3.5 ${tool.accentText}`} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-bold text-[13px] leading-snug text-[var(--console-ink)]">
                    {tool.label}
                </span>
                <span className="block text-[12px] mt-0.5 leading-snug text-[var(--console-ink-dim)]">
                    {tool.blurb}
                </span>
            </span>
            {locked && (
                <Lock className="w-3 h-3 flex-shrink-0 mt-1 text-[var(--console-ink-faint)]" aria-hidden="true" />
            )}
        </span>
    );
    const className = `block w-full h-full text-left rounded-md p-3 transition-colors
        border border-[var(--console-line)] bg-[var(--console-panel)]
        hover:border-[rgb(var(--console-accent-rgb)/0.55)]
        focus-visible:border-[var(--console-accent-ink)]`;
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 8) * 0.02 }}
        >
            {/* A LOCKED TOOL IS STILL DESCRIBED. A free student reading what
                each one does is the argument for upgrading; a grid of greyed-out
                rectangles is not. */}
            {locked ? (
                <Link to={createPageUrl("Subscription")} className={className}>{body}</Link>
            ) : (
                <button type="button" className={className} onClick={() => onOpen(tool)}>{body}</button>
            )}
        </motion.div>
    );
}

/**
 * The saved conversations, as a table rather than as more cards.
 *
 * THE COLUMNS ARE FIXED WIDTHS, which is most of what makes a list read as
 * something somebody designed — the Ranked board's own lesson. Every tool name
 * shares a left edge and every date a right one, so the eye runs down three
 * columns instead of re-finding them on each row. The tool column is `hidden
 * sm:` because at 360 it would take a third of the row from the title, which is
 * the one thing a student is scanning for.
 */
function RecentTable({ items, onOpen }) {
    return (
        <div className="rounded-md border border-[var(--console-line)] bg-[var(--console-panel)] overflow-hidden">
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpen(item)}
                    className="w-full text-left px-3.5 py-2.5 flex items-baseline gap-3 transition-colors
                        border-t border-[var(--console-line-soft)] first:border-t-0
                        hover:bg-[var(--console-panel-2)]"
                >
                    <span className="hidden sm:block w-[112px] flex-shrink-0 truncate font-mono text-[10px]
                        uppercase tracking-wider text-[var(--console-ink-faint)]">
                        {/* WHICH TOOL IT WAS is the one fact a student can act
                            on: it says what kind of help this thread already has
                            in it. `labelForTool` keeps the name of a tool that
                            has since left the catalogue. */}
                        {item.toolLabel || "Chat"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--console-ink)]">
                        {item.title}
                    </span>
                    <span className="flex-shrink-0 font-mono text-[10px] text-[var(--console-ink-faint)]">
                        {item.at ? fmtDate(item.at, "d MMM", "") : ""}
                    </span>
                </button>
            ))}
        </div>
    );
}

export default function ToolsDashboard({
    cards = [],
    recent = [],
    locked = false,
    loading = false,
    onOpenCard,
    onOpenTool,
    onOpenChat,
}) {
    const groups = toolsByPhase(CHAT_TOOLS);

    return (
        <Console>
            {/* A CONSOLE IS NARROWER THAN A PAGE. At `max-w-5xl` a signal row
                was two short sentences and then six hundred pixels of air before
                its tool tag, and the instrument grid drew three cards across a
                span wide enough for four — a marketing measure on a panel. This
                is the width at which the rows read as rows and the cards still
                take a two-line blurb. */}
            <div className="max-w-4xl mx-auto w-full px-4 py-8 sm:py-10">
                {/* ── What your own work says ─────────────────────────────── */}
                <ToolBrief cards={cards} locked={locked} loading={loading} onOpen={onOpenCard} />

                {/* ── The toolkit, on the rail ────────────────────────────── */}
                <div className="mt-9">
                    <div className="flex items-center gap-2.5 mb-5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]
                            text-[var(--console-ink-faint)]">
                            Your toolkit
                        </span>
                        <span className="h-px flex-1 bg-[var(--console-line)]" aria-hidden="true" />
                    </div>
                    {groups.map((g, i) => (
                        <Phase
                            key={g.id}
                            index={ordinal(i)}
                            label={g.label}
                            blurb={g.blurb}
                            last={i === groups.length - 1}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {g.tools.map((t, j) => (
                                    <Instrument
                                        key={t.id}
                                        tool={t}
                                        index={j}
                                        locked={locked}
                                        onOpen={onOpenTool}
                                    />
                                ))}
                            </div>
                        </Phase>
                    ))}
                </div>

                {/* ── Where you left off ──────────────────────────────────────
                    Only drawn when there is something to pick up. An empty
                    "Recent" band on a first visit is a heading saying "you have
                    none", which is the paper-cut the Quizzes shelf records: the
                    blocks above already make every ask this page has. */}
                {recent.length > 0 && (
                    <div className="mt-9">
                        <div className="flex items-center gap-2.5 mb-3">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]
                                text-[var(--console-ink-faint)]">
                                Pick up where you left off
                            </span>
                            <span className="h-px flex-1 bg-[var(--console-line)]" aria-hidden="true" />
                        </div>
                        <RecentTable items={recent} onOpen={onOpenChat} />
                    </div>
                )}
            </div>
        </Console>
    );
}
