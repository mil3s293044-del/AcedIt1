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
 *   YOUR TOOLKIT              all twelve, grouped by WHEN you reach for one.
 *   PICK UP WHERE YOU LEFT OFF   the conversations that already save.
 *
 * ─── NOTHING HERE CALLS A MODEL, AND NOTHING IS STORED ──────────────────────
 * The direction cards are arithmetic (toolBrief.js) and the Recent list is a
 * read of rows that exist (aiChats.js). A dashboard that generated its own
 * advice would be the second answer to a question the cards already answer
 * properly — and the one answer nobody can check, which is exactly what was
 * deleted from Insights.
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
import { ArrowRight, Lock, MessageSquare } from "lucide-react";
import { CHAT_TOOLS } from "@/components/ai_tools/chatTools";
import ToolBrief from "@/components/ai_tools/ToolBrief";
import { toolsByPhase } from "@/lib/toolLabels";
import { fmtDate } from "@/lib/safeDate";
import { createPageUrl } from "@/utils";

/**
 * A band heading with a rule to the end of the row.
 *
 * The idiom the Quizzes shelf settled on: a left-aligned row of cards that does
 * not fill its container reads as a hole without one, and the rule TERMINATES
 * the band — so the space beside two cards is margin somebody chose rather than
 * somewhere content failed to reach. "After you write" holds two tools and will
 * never fill three columns.
 */
function Band({ label, blurb, children }) {
    return (
        <section className="pt-7">
            <div className="flex items-center gap-3">
                <h2 className="font-display font-extrabold text-foreground text-base leading-none">
                    {label}
                </h2>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
            </div>
            {blurb && <p className="text-[13px] text-muted-foreground mt-1.5">{blurb}</p>}
            <div className="mt-3">{children}</div>
        </section>
    );
}

function ToolCard({ tool, index, locked, onOpen }) {
    const Icon = tool.icon;
    const body = (
        <span className="flex items-start gap-3">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tool.accentBg}`}>
                <Icon className={`w-4 h-4 ${tool.accentText}`} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-bold text-sm text-foreground leading-snug">{tool.label}</span>
                <span className="block text-[13px] text-muted-foreground mt-0.5 leading-snug">{tool.blurb}</span>
            </span>
            {locked
                ? <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" aria-hidden="true" />
                : <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" aria-hidden="true" />}
        </span>
    );
    const className = `block w-full text-left rounded-2xl border-2 border-border bg-surface p-3.5
        transition-colors hover:border-primary/40 focus-visible:border-primary/60`;
    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
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

function RecentRow({ item, onOpen }) {
    return (
        <button
            type="button"
            onClick={() => onOpen(item)}
            className="w-full text-left rounded-2xl border-2 border-border bg-surface p-3.5
                transition-colors hover:border-primary/40 focus-visible:border-primary/60"
        >
            <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-foreground leading-snug line-clamp-2">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {/* WHICH TOOL IT WAS is the one fact a student can act
                            on: it says what kind of help this thread already
                            has in it. `labelForTool` keeps the name of a tool
                            that has since left the catalogue. */}
                        {item.toolLabel || "Chat"}
                        {item.subject ? ` · ${item.subject}` : ""}
                        {item.at ? ` · ${fmtDate(item.at, "d MMM", "")}` : ""}
                    </p>
                </div>
            </div>
        </button>
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
        <div className="max-w-5xl mx-auto w-full px-4 py-7 sm:py-9">
            {/* ── What your own work says ─────────────────────────────────── */}
            <ToolBrief cards={cards} locked={locked} loading={loading} onOpen={onOpenCard} />

            {/* ── The toolkit ─────────────────────────────────────────────── */}
            {groups.map((g) => (
                <Band key={g.id} label={g.label} blurb={g.blurb}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {g.tools.map((t, i) => (
                            <ToolCard key={t.id} tool={t} index={i} locked={locked} onOpen={onOpenTool} />
                        ))}
                    </div>
                </Band>
            ))}

            {/* ── Where you left off ──────────────────────────────────────────
                Only drawn when there is something to pick up. An empty
                "Recent" band on a first visit is a heading saying "you have
                none", which is the paper-cut the Quizzes shelf records: the
                blocks above already make every ask this page has. */}
            {recent.length > 0 && (
                <Band
                    label="Pick up where you left off"
                    blurb="Your last conversations, carried on rather than started again."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {recent.map((r) => (
                            <RecentRow key={r.id} item={r} onOpen={onOpenChat} />
                        ))}
                    </div>
                </Band>
            )}
        </div>
    );
}
