/**
 * XPLevelCard — your rank, as a badge worth having.
 *
 * ─── What changed ───────────────────────────────────────────────────────────
 * Four stacked cards: a rank card with an amber trophy in a rounded square, a
 * level card, the full ten-tier ladder with a lock icon on everything you
 * hadn't reached, and the XP rate table. Two problems.
 *
 *   EVERY RANK LOOKED THE SAME. One trophy glyph, one amber tile, ten tiers.
 *   Arriving at tier 9 changed a string and nothing else, which makes the
 *   ladder something to read rather than something to climb. `RankCrest` gives
 *   each tier its own colour and prints its number, so the badge visibly
 *   changes as you go — that is what makes a rank worth reaching.
 *
 *   THE LADDER WAS A WALL. Ten rows, seven of them greyed out behind padlocks,
 *   is a list of things you have not done — and it pushed everything else off
 *   the screen. It shows the rung below, the one you are on and the one next,
 *   which is the part that is about you. The whole climb is one tap away for
 *   anybody who wants to see it.
 *
 * ─── Two quantities, drawn differently, in one block ────────────────────────
 * Rank progress lives on the crest's ring; level is a bar. They are genuinely
 * different things — level moves every few sessions, rank a handful of times a
 * year — and drawing them identically was most of why nobody could tell them
 * apart. But they answer the same question, "how far along am I", so they sit
 * in the same card: the level bar used to be a strip of its own that was four
 * fifths whitespace, a heading and a number at opposite ends of a wide screen.
 *
 * ─── The ladder went horizontal ─────────────────────────────────────────────
 * See RankLadder. Ten tiers is the only thing here that is inherently long,
 * and it was the one thing in a three-row window with the rest behind a
 * toggle, while a third of the screen sat empty beside it.
 */
import React from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Zap, Trophy, Crown, Flame } from "lucide-react";
import {
    XP_RANKS, getRankFromXP, getRankProgress, xpToNextRank,
    levelFromXP, levelProgress, xpToNextLevel, xpForLevel,
} from "@/components/shared/xpSystem";
import AceTip from "@/components/ace/AceTip";
import RankCrest from "./RankCrest";
import RankLadder from "./RankLadder";

export default function XPLevelCard({ totalXP = 0, streakDays = 0, compact = false }) {
    const rank = getRankFromXP(totalXP);
    const nextRank = XP_RANKS[rank.tier] || null;
    const rankPct = getRankProgress(totalXP);
    const level = levelFromXP(totalXP);
    const lvlPct = levelProgress(totalXP);
    const xpNeeded = xpToNextLevel(level) - (totalXP - xpForLevel(level));

    if (compact) {
        return (
            <div className="card-soft p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <RankCrest rank={rank} pct={rankPct} size={48} />
                        <div>
                            <p className="font-display font-extrabold text-foreground text-sm">{rank.name}</p>
                            <p className="text-muted-foreground text-xs">Level {level}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-display font-extrabold text-foreground">{totalXP.toLocaleString()}</p>
                        <p className="stat-label inline-flex items-center gap-1">Total XP <AceTip term="xp" /></p>
                    </div>
                </div>
                <div className="mt-3">
                    <Progress value={lvlPct} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">{xpNeeded} XP to Level {level + 1}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── RANK ───────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="card-soft p-5 sm:p-6">
                <div className="flex items-center gap-4 sm:gap-5">
                    <RankCrest rank={rank} pct={rankPct} size={96} className="flex-shrink-0" />

                    <div className="min-w-0 flex-1">
                        <p className="stat-label">Rank {rank.tier} of {XP_RANKS.length}</p>
                        <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground leading-tight truncate">
                            {rank.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="pill bg-secondary text-foreground">Level {level}</span>
                            <span className="pill bg-xp/15 text-xp gap-1">
                                <Zap className="w-3 h-3" /> {totalXP.toLocaleString()} XP
                            </span>
                            {streakDays >= 7 && (
                                <span className="pill bg-streak/15 text-streak gap-1">
                                    <Flame className="w-3 h-3" /> {streakDays}d
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border grid gap-4 sm:grid-cols-2 items-center">
                    {/* What the next rung costs, in the one unit that buys it. */}
                    <p className="text-sm text-muted-foreground">
                        {nextRank ? (
                            <>
                                <span className="font-bold text-foreground tabular-nums">
                                    {xpToNextRank(totalXP).toLocaleString()} XP
                                </span>{" "}
                                to <span className="font-bold text-foreground">{nextRank.name}</span>.
                            </>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                                <Crown className="w-4 h-4 text-xp" /> Top of the ladder. Nothing above this.
                            </span>
                        )}
                    </p>

                    {/* Level, in the same block rather than a card of its own.
                        A heading and a number at opposite ends of a wide strip
                        is not a card, it is a gap with a border around it. */}
                    <div>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="stat-label">Level {level}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                {xpNeeded.toLocaleString()} XP to {level + 1}
                            </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden mt-1.5">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${lvlPct}%` }}
                                transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
                                className="h-full bg-xp rounded-full" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── THE LADDER, end to end ─────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="card-soft p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                    <p className="stat-label flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" /> The ladder
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        Ranks never reset — this moves a handful of times a year.
                    </p>
                </div>
                <RankLadder ranks={XP_RANKS} currentTier={rank.tier} totalXP={totalXP} pct={rankPct} />
            </motion.div>

        </div>
    );
}

/**
 * Where XP comes from — the rate card.
 *
 * Exported separately because the profile lays it beside the achievements grid
 * rather than under it: both read better in a column than stretched across a
 * wide screen, and this one is a two-column list to begin with.
 *
 * It is the ONLY rate card in the app. There was briefly a second on the same
 * tab, and the two disagreed in two rows (flashcards at 0.5 against 0.6–1.5,
 * quizzes at 2 XP/mark against 8–50) — two tables for one economy, on one
 * screen, with different numbers, is worse than either alone.
 */
export function XPSources() {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="card-soft p-5">
            <p className="stat-label mb-3">Where XP comes from</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2 text-sm">
                {/* No "AI Challenges" row. That feature was never wired into
                    the live UI and ChallengeEngine.jsx is deleted — this table
                    was advertising a way to earn XP that does not exist.
                    Retire something, grep the copy. */}
                {[
                    ["Focus sessions", "1.6–96 XP/hr"],
                    ["Flashcards", "0.6–1.5 XP/card"],
                    ["Quizzes", "8–50 XP"],
                    ["Sub-goals", "40–195 XP"],
                    ["Full goals", "240–540 XP"],
                    ["Daily streak", "15–100 XP"],
                    ["Score wagers", "up to 3.5× bet"],
                    ["Competitions", "Bonus XP"],
                ].map(([label, xp]) => (
                    <div key={label} className="flex justify-between items-center gap-2 bg-secondary/50 rounded-lg px-2.5 py-1.5">
                        <span className="text-foreground text-xs truncate">{label}</span>
                        <span className="font-bold text-chart-3 text-xs flex-shrink-0">{xp}</span>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
                Your streak multiplier applies to all of it. Daily caps stop grinding — difficulty and
                accuracy are what move the number.
            </p>
        </motion.div>
    );
}
