/**
 * RankTable — the leaderboard as a table, with everyone's position on a card.
 *
 * What it replaces was four rows, each opening with "#3" in bold and a
 * coloured disc holding either a trophy or two initials. It read fine and it
 * read as a leaderboard widget, which is the shape this block has in every app
 * that has ever had one.
 *
 * THE RANK IS ALREADY A CARD NUMBER. First place is the Ace, second is the
 * King, and so on down. Nothing has to be invented for this to work, because
 * a deck is a ranked set and a leaderboard is a ranked set, and both of them
 * put the best thing at the top. So the "#3" text becomes an actual three
 * of something, and a glance down the column reads A K Q J the way a glance
 * down a leaderboard reads 1 2 3 4.
 *
 * THE ROWS ARE DEALT, one after another, from the right. A leaderboard is the
 * one panel on the page where the ORDER is the entire content, and a stagger
 * is the cheapest way to say "these are in sequence" without a word of copy.
 * Your own row deals last and lands harder, which is the only emphasis it
 * needs; the old row said it with a green tint and the word "(you)" and still
 * did not stand out.
 *
 * Under reduced motion every row is simply there, in order.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, TrendingUp } from "lucide-react";
import PlayingCard from "@/components/cards/PlayingCard";
import { RANKS } from "@/components/cards/cardIdentity";

/**
 * Position to card rank. #1 is the Ace and it counts down from there, which is
 * how a deck is ordered and how a leaderboard is ordered.
 *
 * RANKS runs 2..A, so the Ace is the last entry. Anyone past 13th place gets
 * the 2, because there is no 1 in a deck and inventing one to cover 47th place
 * would break the only rule that makes this legible.
 */
function rankCard(position) {
    const i = RANKS.length - position;          // 1 -> "A", 2 -> "K", 13 -> "2"
    return RANKS[i] || RANKS[0];
}

/** The four suits in order, so no two adjacent rows share one. */
const SUITS = ["spade", "heart", "club", "diamond"];

/** The podium keeps its metal; everyone else takes the app's ink. */
const TONE = { 1: "#F59E0B", 2: "#94A3B8", 3: "#B45309" };

export default function RankTable({ rows = [], fmtXP }) {
    const reduce = useReducedMotion();

    return (
        <div data-rank-table className="space-y-1.5">
            {rows.map((row, i) => {
                const { entry, isMe, below, display } = row;
                const gapStr = entry.gap > 0
                    ? `+${fmtXP(entry.gap)}`
                    : entry.gap < 0
                        ? `${fmtXP(Math.abs(entry.gap))} below`
                        : "You";
                const tone = isMe ? "#58CC02" : (TONE[entry.rank] || "#0D1626");

                return (
                    <motion.div
                        key={entry.id || entry.user_email || i}
                        data-rank-row={entry.rank}
                        data-rank-me={isMe ? "1" : "0"}
                        className={`flex items-center gap-3 p-3 rounded-xl border shadow-soft
                            transition-colors ${
                            isMe
                                ? "bg-primary/5 border-primary/40"
                                : below
                                    ? "bg-surface border-border/60 opacity-70"
                                    : "bg-surface border-border/60 hover:border-xp/30"}`}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 46, rotate: 2.5 }}
                        animate={{ opacity: below ? 0.7 : 1, x: 0, rotate: 0 }}
                        transition={reduce ? { duration: 0.2 } : {
                            type: "spring", stiffness: isMe ? 260 : 210,
                            damping: isMe ? 17 : 22, mass: 0.8,
                            delay: 0.12 + i * 0.075,
                        }}
                    >
                        {/* Their place, printed. */}
                        <PlayingCard
                            rank={rankCard(entry.rank)}
                            suit={SUITS[(entry.rank - 1) % 4]}
                            tone={tone}
                            indices={false}
                            watermark={false}
                            className="w-9 flex-shrink-0 aspect-[2.5/3.5]"
                        >
                            <span className="absolute inset-0 grid place-items-center">
                                <span className={`font-display font-black text-[13px] leading-none
                                    tabular-nums ${isMe ? "text-primary" : "text-foreground"}`}>
                                    {rankCard(entry.rank)}
                                </span>
                            </span>
                        </PlayingCard>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className={`font-bold text-sm truncate ${
                                    isMe ? "text-primary" : "text-foreground"}`}>
                                    {isMe ? `${display} (you)` : display}
                                </p>
                                {entry.streak_days > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-xs
                                        font-bold text-streak flex-shrink-0">
                                        <Flame className="w-3 h-3" /> {entry.streak_days}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                                <span className="font-bold text-foreground/70">#{entry.rank}</span>
                                {"  ·  "}{fmtXP(entry.total_xp || 0)} XP
                            </p>
                        </div>

                        {!isMe && entry.gap !== undefined && entry.gap !== 0 && (
                            <span className={`pill flex-shrink-0 ${
                                entry.gap > 0 ? "bg-xp/15 text-xp" : "bg-secondary text-muted-foreground"}`}>
                                <TrendingUp className="w-3 h-3" />
                                {gapStr}
                            </span>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}
