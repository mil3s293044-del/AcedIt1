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
 *   YOUR TOOLKIT              all twelve, in bands by WHEN you reach for one.
 *   PICK UP WHERE YOU LEFT OFF   the conversations that already save.
 *
 * ─── THE TOOLKIT WAS A GRID OF ICON-IN-A-BOX CARDS ──────────────────────────
 * Which is the shape this codebase has already named, about the quiz list:
 * "an icon in a rounded square, a title, two pills and three grey stat tiles —
 * and a grid of those is precisely what makes an app look generated." Twelve of
 * them, each with a tinted plate and a blurb of the same length, under four
 * headings numbered 01–04. Every one of those is a thing a machine reaches for.
 *
 * They are ROWS now, in bands, which is the idiom Subjects, QueueRow and the
 * Quizzes shelf already use — and which the direction rows directly above them
 * ALREADY WERE. The page speaks one language instead of three.
 *
 * ─── ONE LEFT EDGE, AND THAT WAS A REAL FAULT ───────────────────────────────
 * The rail needed clearance, so the bands carried `pl-7 sm:pl-9` — and nothing
 * else on the page moved with them. Measured at 1280: the headline, the
 * direction rows and the section headings all began at x=208 and the twelve
 * tool cards began at 244. Thirty-six pixels, on the one screen whose whole
 * argument is that it was laid out on a grid. The rail is gone and every row,
 * rule and heading here shares the container's edge by construction rather
 * than by arithmetic that has to be kept in step.
 *
 * ─── A BAND NEEDS NO RULE ONCE ITS ITEMS ARE FULL WIDTH ─────────────────────
 * The rule-to-the-end-of-the-row is the Quizzes-shelf idiom and it exists for a
 * specific reason: a left-aligned row of FIXED-WIDTH cards leaves a hole, and
 * the rule turns that hole into margin somebody chose. Rows reach the right
 * edge themselves, so the rule has nothing left to terminate — it stays on the
 * two SECTION headings, where it separates the page's major parts.
 *
 * ─── NOTHING HERE CALLS A MODEL, AND NOTHING IS STORED ──────────────────────
 * The direction cards are arithmetic (toolBrief.js), the Recent list is a read
 * of rows that exist and the usage tally counts those same rows (aiChats.js).
 * A dashboard that generated its own advice would be the second answer to a
 * question the cards already answer properly — and the one answer nobody can
 * check, which is exactly what was deleted from Insights. For the same reason
 * there is no status readout: a console is a tempting place to print "SYSTEM
 * READY · 94%", and a number with nothing behind it teaches a student that none
 * of the numbers here are real.
 *
 * ─── THE PRICE IS NOT ON THE ROWS, DELIBERATELY ─────────────────────────────
 * Pressing a tool here opens the chat with the composer seeded and SENDS
 * NOTHING, so no chips are spent by arriving — megaUpload's rule is that the
 * price is on screen before it is spent, and the thing that spends it is the
 * send button, which is where the cost already appears. Twelve prices across
 * twelve rows would be twelve figures none of which is yet true of anything.
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

/**
 * A major part of the page.
 *
 * Two of these — the toolkit and the saved conversations — and the rule is what
 * separates them. The direction rows above need none: the `h1` is their
 * heading, and an eyebrow over a headline that says the same thing in capitals
 * was one of the four mono labels this screen used to carry at once.
 */
function Section({ label, children, className = "" }) {
    return (
        <section className={className}>
            <div className="flex items-baseline gap-3 mb-4">
                <h2 className="font-display font-extrabold text-[15px] leading-none text-[var(--console-ink)]">
                    {label}
                </h2>
                <span className="h-px flex-1 bg-[var(--console-line)]" aria-hidden="true" />
            </div>
            {children}
        </section>
    );
}

/**
 * One phase of a session, and the tools that belong to it.
 *
 * ─── THE NUMBERS WENT, AND THE SEQUENCE DID NOT ─────────────────────────────
 * It was a 1px rail down the left with `01`–`04` at each node. Numbering four
 * things that are not steps you complete is a flourish rather than information,
 * and a numbered rail is among the most recognisable marks of a generated
 * layout. What carried the order was never the numerals: it is that the four
 * read in the order a session runs, which the headings say in words.
 *
 * The SPINE is what remains, and it is on every row rather than on the heading
 * — a run of rows sharing one colour reads as a band, the way QueueRow's tiers
 * do, where a single coloured spine (a direction row above) reads as one
 * thing's identity. Same device, two scales, and the difference is legible.
 */
function Band({ phase, children }) {
    return (
        <div className="pt-6 first:pt-0">
            {/* NO DASH BEFORE THE HEADING. The first draft put a short colour
                mark there and it pushed the heading 30px in — a THIRD left edge
                on the page, measured, on the screen whose complaint was that
                things did not line up. The band is already marked: every row
                under it shares one spine, which is how QueueRow's tiers read as
                bands. The heading sits flush with the rows, the rules and the
                headline, and the colour stays on the rows. */}
            {/* IT STACKS ON A PHONE. Side by side at 390 the heading wrapped to
                two lines while the sentence beside it was cut mid-word — the
                worst of both, and only the phone shot said so. */}
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5">
                <h3 className="font-display font-extrabold text-[13px] leading-none
                    text-[var(--console-ink)] flex-shrink-0">
                    {phase.label}
                </h3>
                <p className="text-[12.5px] leading-snug sm:leading-none min-w-0
                    text-[var(--console-ink-faint)] sm:truncate">
                    {phase.blurb}
                </p>
            </div>
            <div className="mt-2.5">{children}</div>
        </div>
    );
}

/**
 * "2 chats · 1 Oct", or nothing at all.
 *
 * TWO FIXED CELLS, both right-aligned, and the date cell is drawn EMPTY rather
 * than dropped. A row whose conversation carries no timestamp collapsed its
 * slot, so "1 chat" slid out to the page edge while "2 chats · 1 Oct" sat 50px
 * short of it — three different right edges down one column, which is the
 * raggedness this row layout exists to remove. Mono and `tabular-nums` because
 * these are figures in a column, which is the one job mono still has here.
 *
 * NOTHING AT ALL for a tool never opened. "0 chats" would pad the column to a
 * respectable length with a number that teaches a student the numbers here are
 * decoration — `studyQueue`'s rule about zero rows.
 */
function Used({ use }) {
    if (!use?.count) return null;
    return (
        <span className="hidden sm:flex items-baseline gap-2 flex-shrink-0 font-mono text-[10px]
            text-[var(--console-ink-faint)] tabular-nums">
            <span className="w-[52px] text-right">
                {use.count} chat{use.count === 1 ? "" : "s"}
            </span>
            <span className="w-[44px] text-right">
                {use.at ? fmtDate(use.at, "d MMM", "") : ""}
            </span>
        </span>
    );
}

/**
 * One tool, as a row.
 *
 * ─── THE GLYPH LOST ITS PLATE AND ITS OWN COLOUR ────────────────────────────
 * It sat in a 28px tinted square in the tool's own accent — twelve hues against
 * the four the page is actually organised by, mounted on twelve coloured chips.
 * The glyph stays, because it tells a repeated set apart, which is the one case
 * this app's icon rule keeps one for; it is drawn bare and in its BAND's colour,
 * so the only thing hue means on this screen is when you reach for the tool.
 * Shape is what separates the twelve, and shape survives greyscale.
 *
 * The chevron did not come back. The whole row is the button, so an arrow in
 * the corner restated the affordance twelve times. The LOCK stays: a lock is
 * status rather than decoration.
 */
function ToolRow({ tool, phase, use, index, locked, onOpen }) {
    const Icon = tool.icon;
    const body = (
        <span className="flex items-start sm:items-center gap-3 pl-3.5 pr-3 py-2.5">
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${phase.spine}`} aria-hidden="true" />
            {/* Top-aligned where the row wraps to two lines, or the glyph
                floats in the middle of the gap between them. */}
            <Icon className={`w-4 h-4 flex-shrink-0 mt-[3px] sm:mt-0 ${phase.ink}`} aria-hidden="true" />
            {/* A FIXED NAME COLUMN, so every blurb starts at one x. Left to
                size itself the name pushed the sentence beside it to a
                different place on all twelve rows, and a ragged middle column
                is exactly what separates a list of divs from a table somebody
                laid out — the Ranked board's own lesson, which is also why its
                figures share a right edge. 150px clears the longest label
                ("Concept Explainer", which 132 clipped) at this size.

                It collapses below `sm`: at 360 a fixed 132 leaves the blurb
                about forty characters, so the two STACK there and the blurb
                keeps its own line and WRAPS — truncating there would cut the
                only sentence saying what the tool is for. */}
            <span className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className="font-bold text-[13px] text-[var(--console-ink)]
                    sm:w-[150px] sm:flex-shrink-0 sm:truncate">
                    {tool.label}
                </span>
                <span className="min-w-0 sm:flex-1 sm:truncate text-[12.5px] text-[var(--console-ink-dim)]">
                    {tool.blurb}
                </span>
            </span>
            <Used use={use} />
            {locked && (
                <Lock className="w-3 h-3 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />
            )}
        </span>
    );
    const className = `group relative block w-full text-left overflow-hidden rounded-md transition-colors
        border border-[var(--console-line)] bg-[var(--console-panel)]
        hover:border-[rgb(var(--console-accent-rgb)/0.55)]
        focus-visible:border-[var(--console-accent-ink)]`;
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 10) * 0.015 }}
        >
            {/* A LOCKED TOOL IS STILL DESCRIBED. A free student reading what
                each one does is the argument for upgrading; a list of greyed-out
                strips is not. */}
            {locked ? (
                <Link to={createPageUrl("Subscription")} className={className}>{body}</Link>
            ) : (
                <button type="button" className={className} onClick={() => onOpen(tool)}>{body}</button>
            )}
        </motion.div>
    );
}

/**
 * The saved conversations, as a table.
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
    usage = {},
    locked = false,
    loading = false,
    onOpenCard,
    onOpenTool,
    onOpenChat,
}) {
    const groups = toolsByPhase(CHAT_TOOLS);
    let n = 0;

    return (
        <Console>
            {/* THE PADDING IS A WHOLE NUMBER OF LATTICE CELLS (32 and 64), so
                the first horizontal line of the grid lands on the top of the
                content rather than a third of the way through the headline. */}
            <div className="max-w-4xl mx-auto w-full px-4 py-8 sm:py-16">
                {/* ── What your own work says ─────────────────────────────── */}
                <ToolBrief cards={cards} locked={locked} loading={loading} onOpen={onOpenCard} />

                {/* ── The toolkit ─────────────────────────────────────────── */}
                <Section label="Your toolkit" className="mt-10">
                    {groups.map((g) => (
                        <Band key={g.id} phase={g}>
                            <div className="space-y-1.5">
                                {g.tools.map((t) => (
                                    <ToolRow
                                        key={t.id}
                                        tool={t}
                                        phase={g}
                                        use={usage[t.id]}
                                        index={n++}
                                        locked={locked}
                                        onOpen={onOpenTool}
                                    />
                                ))}
                            </div>
                        </Band>
                    ))}
                </Section>

                {/* ── Where you left off ──────────────────────────────────────
                    Only drawn when there is something to pick up. An empty
                    "Recent" band on a first visit is a heading saying "you have
                    none", which is the paper-cut the Quizzes shelf records: the
                    blocks above already make every ask this page has. */}
                {recent.length > 0 && (
                    <Section label="Pick up where you left off" className="mt-10">
                        <RecentTable items={recent} onOpen={onOpenChat} />
                    </Section>
                )}
            </div>
        </Console>
    );
}
