/**
 * MoversPanel — what changed while you weren't looking.
 *
 * The retention question isn't "how am I doing", which a student can answer by
 * remembering. It's "did something happen without me?" — and the honest answer
 * lives in two places the page already had and never showed together: the odds
 * trail (how each price moved) and the arena ticker (what rivals actually did).
 *
 * Being careful about the claim is the whole design here. The trail records a
 * score every few hours, so we can say a price moved over a window and we can
 * say a rival studied inside that window. We cannot say the one caused the
 * other, and a market that fakes causation is a market nobody trusts twice.
 * So the move and the activity are two separate lines, and the copy never
 * joins them with "because".
 */
import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, ChevronRight } from "lucide-react";

const SOURCE_LABEL = {
    quiz: "a quiz", flashcard: "flashcards", study_session: "a session",
    active_recall: "active recall", blurting: "blurting", focus_session: "focus",
    mini_test: "a mock", loading_quiz: "a warm-up", practice_questions: "practice",
};

const agoLabel = (at) => {
    const m = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000));
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
};

export default function MoversPanel({ movers = [], feed = [], onOpen }) {
    if (!movers.length && !feed.length) return null;
    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-3xl bg-surface border border-border shadow-soft p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 mb-3">
                <h2 className="font-display font-extrabold text-foreground text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-chart-3" /> Moves
                </h2>
                <span className="stat-label text-muted-foreground">last 24 hours</span>
            </div>

            {movers.length > 0 && (
                <ul className="space-y-1.5 mb-4">
                    {movers.map(({ battle, delta, odds }) => {
                        const up = delta > 0;
                        return (
                            <li key={`${battle.kind}-${battle.id}`}>
                                <button onClick={() => onOpen?.(battle)}
                                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1
                                        hover:bg-secondary/60 transition-colors text-left group">
                                    {/* The move leads. On a market page the delta is the
                                        news; the level is context for it. */}
                                    <span className={`inline-flex items-center gap-1 font-display font-black
                                        text-sm tabular-nums w-16 flex-shrink-0 ${up ? "text-primary" : "text-streak"}`}>
                                        {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                        {up ? "+" : ""}{delta}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold text-foreground text-sm truncate">{battle.title}</span>
                                        <span className="block text-xs text-muted-foreground">now {odds}%</span>
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/50
                                        group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {feed.length > 0 && (
                <div className={movers.length ? "pt-3 border-t border-border" : ""}>
                    <p className="stat-label text-muted-foreground mb-2">Your rivals have been busy</p>
                    <ul className="space-y-1.5">
                        {feed.map((e, i) => (
                            <li key={`${e.email}-${e.at}-${i}`}
                                className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-chart-3 flex-shrink-0" aria-hidden />
                                {/* The name never truncates — "Pri…" identifies nobody.
                                    The sentence after it is what gives way. */}
                                <span className="font-bold text-foreground flex-shrink-0">
                                    {String(e.name || e.email).split(" ")[0]}
                                </span>
                                <span className="font-bold text-xp tabular-nums flex-shrink-0">+{e.xp}</span>
                                <span className="text-muted-foreground truncate">
                                    from {SOURCE_LABEL[e.source] || e.source} in {e.battle.title}
                                </span>
                                <span className="ml-auto text-muted-foreground tabular-nums flex-shrink-0">{agoLabel(e.at)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </motion.section>
    );
}
