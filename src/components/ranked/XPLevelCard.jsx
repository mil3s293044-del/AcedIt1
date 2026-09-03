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
 * ─── Two bars for two different quantities ──────────────────────────────────
 * Rank progress lives on the crest's ring now. The level bar stays a bar,
 * because rank and level are genuinely different things — level moves every
 * few sessions, rank a handful of times a year — and drawing them the same way
 * was most of why nobody could tell them apart.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Zap, Trophy, Crown, Flame, Check, ChevronDown } from "lucide-react";
import {
    XP_RANKS, getRankFromXP, getRankProgress, xpToNextRank,
    levelFromXP, levelProgress, xpToNextLevel, xpForLevel,
} from "@/components/shared/xpSystem";
import AceTip from "@/components/ace/AceTip";
import RankCrest from "./RankCrest";

/** One rung. `state` is "done" | "current" | "locked". */
function Rung({ r, state }) {
    const current = state === "current";
    return (
        <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-colors ${
            current ? "bg-secondary/60 border-border" : "border-transparent"}`}>
            <RankCrest rank={r} size={current ? 44 : 36} showRing={false}
                className={state === "locked" ? "opacity-40" : ""} />
            <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${
                    current ? "font-black text-foreground"
                        : state === "done" ? "font-bold text-foreground" : "font-bold text-muted-foreground/70"}`}>
                    {r.name}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                    {r.minXP.toLocaleString()}{r.maxXP === Infinity ? "+" : `–${r.maxXP.toLocaleString()}`} XP
                </p>
            </div>
            {current
                ? <span className="pill bg-foreground text-background text-[10px]">You</span>
                : state === "done"
                    ? <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    : null}
        </div>
    );
}

export default function XPLevelCard({ totalXP = 0, streakDays = 0, compact = false }) {
    const [showAll, setShowAll] = useState(false);
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

    // The rungs either side. `slice` keeps the numbers honest at both ends —
    // tier 1 has nothing below it and tier 10 nothing above, and padding the
    // list out with blanks to keep it three tall would be inventing rungs.
    const i = rank.tier - 1;
    const window = XP_RANKS.slice(Math.max(0, i - 1), i + 2);
    const shown = showAll ? XP_RANKS : window;

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

                {/* What the next rung costs, in the one unit that buys it. */}
                <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
                    {nextRank ? (
                        <>
                            <span className="font-bold text-foreground tabular-nums">
                                {xpToNextRank(totalXP).toLocaleString()} XP
                            </span>{" "}
                            to <span className="font-bold text-foreground">{nextRank.name}</span>.
                        </>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                            <Crown className="w-4 h-4 text-xp" /> Top of the ladder. There is nothing above this.
                        </span>
                    )}
                </p>
            </motion.div>

            {/* ── THE LADDER, around you ─────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="card-soft p-4">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                    <p className="stat-label flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" /> The ladder
                    </p>
                    <button type="button" onClick={() => setShowAll(v => !v)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                        {showAll ? "Just my rungs" : `All ${XP_RANKS.length}`}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                    </button>
                </div>

                <AnimatePresence initial={false} mode="popLayout">
                    <motion.div key={showAll ? "all" : "window"}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-1">
                        {shown.map(r => (
                            <Rung key={r.name} r={r}
                                state={r.tier === rank.tier ? "current" : totalXP >= r.minXP ? "done" : "locked"} />
                        ))}
                    </motion.div>
                </AnimatePresence>

                <p className="text-[11px] text-muted-foreground mt-2.5">
                    Ranks never reset. Levels move every few sessions; this moves a handful of times a year.
                </p>
            </motion.div>

            {/* ── LEVEL ──────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                className="card-soft p-5">
                <div className="flex items-baseline justify-between gap-3 mb-2.5">
                    <p className="stat-label">Level {level}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {xpNeeded.toLocaleString()} XP to {level + 1}
                    </p>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${lvlPct}%` }}
                        transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
                        className="h-full bg-xp rounded-full" />
                </div>
            </motion.div>

            {/* ── WHERE XP COMES FROM ────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="card-soft p-5">
                <p className="stat-label mb-3">Where XP comes from</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {/* No "AI Challenges" row. That feature was never wired into
                        the live UI and ChallengeEngine.jsx is deleted — this
                        table was advertising a way to earn XP that does not
                        exist. Retire something, grep the copy. */}
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
                <p className="text-[11px] text-muted-foreground mt-3">
                    Your streak multiplier applies to all of it. Daily caps stop grinding — difficulty and
                    accuracy are what move the number.
                </p>
            </motion.div>
        </div>
    );
}
