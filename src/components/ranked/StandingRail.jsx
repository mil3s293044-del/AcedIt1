/**
 * StandingRail — the contest you are actually in, beside the board.
 *
 * ─── Where it came from ─────────────────────────────────────────────────────
 * A player card and a three-row ladder that lived on the "My profile" tab,
 * which is the wrong place for it twice over: it duplicated the neighbours the
 * board was already drawing two feet to the left, and it put the competitive
 * part of the page behind a tab you have to choose. The profile is your own
 * progression; the board is the race. This belongs with the race.
 *
 * It replaces the rail that was there — "Your standing", "Your title", "How
 * titles work" — three cards, of which one explained the scarcity rules for a
 * label most students do not have.
 *
 * ─── Up is a gain, down is a loss, and both are named ───────────────────────
 * A gap on its own is a number. "2.75 behind" tells a student nothing about
 * whether that is one good week or one good term. So the panel says what the
 * gap is WORTH in work — through `atarLift`, the same model the dashboard
 * differences for Today's Play, so the figure is checkable rather than a
 * slogan — and what is coming up behind them, which is the half of a
 * leaderboard that actually keeps people honest.
 *
 * ─── It never invents a number ──────────────────────────────────────────────
 * The work translation only exists for the ATAR board, because `atarLift`
 * models the ATAR composite and nothing else. On the XP and study-time boards
 * the gap is stated plainly in that board's own unit and no lever is offered.
 * A "sit two quizzes to close it" under an XP gap would be a guess dressed as
 * arithmetic.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, ArrowRight, Target, Crown } from "lucide-react";
import { createPageUrl } from "@/utils";
import { avatarHue, initialsOf, COMPONENT_ACTION } from "@/lib/ranked";
import { bestLever } from "@/lib/atarLift";

const TONE_PILL = {
    muted: "bg-secondary text-muted-foreground", xp: "bg-xp/15 text-xp",
    "chart-3": "bg-chart-3/15 text-chart-3", "chart-4": "bg-chart-4/15 text-chart-4",
    primary: "bg-primary/15 text-primary", streak: "bg-streak/15 text-streak",
};

const COMPONENT_LABEL = {
    mastery: "Mastery", consistency: "Consistency", effort: "Effort",
    breadth: "Breadth", planning: "Planning",
};

/** Where each component is actually moved. Every one has a screen. */
const COMPONENT_PAGE = {
    mastery: "MistakeBank", consistency: "Dashboard", effort: "Study",
    breadth: "Study", planning: "Goals",
};

function Face({ name, size = 28 }) {
    const hue = avatarHue(name);
    return (
        <span className="rounded-lg flex items-center justify-center font-display font-black flex-shrink-0"
            style={{
                width: size, height: size, fontSize: size * 0.4,
                backgroundColor: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 70% 28%)`,
            }}
            aria-hidden="true">
            {initialsOf(name)}
        </span>
    );
}

/**
 * One neighbour. Direction decides everything about how it reads — the person
 * above is a target and the person below is a threat, and a leaderboard that
 * only ever shows you the target is only half a leaderboard.
 */
function Neighbour({ dir, name, value, gapLabel, boardMeta }) {
    const up = dir === "up";
    return (
        <div className={`rounded-xl border-2 p-2.5 ${
            up ? "bg-streak/5 border-streak/25" : "bg-primary/5 border-primary/25"}`}>
            <p className={`stat-label flex items-center gap-1 ${up ? "text-streak" : "text-primary"}`}>
                {up ? <><ChevronUp className="w-3 h-3" /> To catch</>
                    : <><ChevronDown className="w-3 h-3" /> Behind you</>}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
                <Face name={name} />
                <span className="text-sm font-bold text-foreground truncate flex-1 min-w-0">{name}</span>
                <span className="text-sm font-black text-foreground tabular-nums flex-shrink-0">
                    {boardMeta.fmt(value)}
                </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{gapLabel}</p>
        </div>
    );
}

export default function StandingRail({
    mine, boardMeta, board, nameOf, components, title,
}) {
    // The cheapest points available, and what a realistic nudge is worth. Only
    // meaningful on the ATAR board — see the note at the top.
    const lever = useMemo(
        () => (board === "atar" && components ? bestLever(components) : null),
        [board, components]);

    // Does the lever actually close the gap the panel just named? Saying "worth
    // +0.9" under "2.75 behind" is honest; implying it overtakes them is not.
    const gap = mine?.above?.gap ?? null;
    const closes = lever && gap != null && lever.stepGain >= gap;

    if (!mine?.rank) {
        return (
            <div className="card-soft p-4 border-2 border-border">
                <p className="stat-label flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Your standing
                </p>
                <p className="text-xs text-muted-foreground leading-snug mt-2">
                    You&rsquo;re not on this board yet. Three study days puts you on the ATAR ladder.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="card-soft p-4 border-2 border-border space-y-3">
                <div>
                    <p className="stat-label flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" /> Your standing
                    </p>
                    <p className="font-display font-black text-3xl text-foreground leading-none mt-1">
                        #{mine.rank}
                        <span className="text-sm font-bold text-muted-foreground"> of {mine.total}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Top {mine.percentile}%
                        {title && <> · <span className={`pill text-[10px] ${TONE_PILL[title.tone] || TONE_PILL.primary}`}
                            title={title.blurb}>{title.label}</span></>}
                    </p>
                </div>

                {mine.above ? (
                    <Neighbour dir="up" boardMeta={boardMeta}
                        name={nameOf(mine.above.row)}
                        value={boardMeta.value(mine.above.row)}
                        gapLabel={`${boardMeta.gap(mine.above.gap)} — that's the next spot.`} />
                ) : (
                    <div className="rounded-xl bg-xp/5 border-2 border-xp/25 p-2.5">
                        <p className="text-xs font-bold text-foreground inline-flex items-center gap-1.5">
                            <Crown className="w-3.5 h-3.5 text-xp" /> Top of the board.
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Everyone below is climbing toward this.
                        </p>
                    </div>
                )}

                {mine.below && (
                    <Neighbour dir="down" boardMeta={boardMeta}
                        name={nameOf(mine.below.row)}
                        value={boardMeta.value(mine.below.row)}
                        gapLabel={`${boardMeta.gap(mine.below.gap).replace(" behind", "")} back — lose that and you drop a place.`} />
                )}
            </motion.div>

            {/* ── What it costs, in work ─────────────────────────────────── */}
            {lever && lever.stepGain > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="card-soft p-4 border-2 border-border">
                    <p className="stat-label">What closes it</p>
                    <p className="text-xs text-foreground leading-snug mt-1.5">
                        <span className="font-bold">
                            Ten points of {COMPONENT_LABEL[lever.key].toLowerCase()} is worth{" "}
                            <span className="tabular-nums">+{lever.stepGain.toFixed(2)}</span>
                        </span>
                        {mine.above && (closes
                            ? <> — enough to take {nameOf(mine.above.row)}&rsquo;s spot.</>
                            : <> of the {mine.above.gap.toFixed(2)} you need.</>)}
                        {!mine.above && <> on top of where you already are.</>}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-1.5">
                        {COMPONENT_ACTION[lever.key]}
                    </p>
                    <Link to={createPageUrl(COMPONENT_PAGE[lever.key] || "Dashboard")}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-primary mt-2.5 hover:underline">
                        Go and move it <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <p className="text-[10px] text-muted-foreground/70 leading-snug mt-2.5">
                        {lever.headroom} points of headroom left on it — that&rsquo;s where the cheapest
                        ATAR on your account is.
                    </p>
                </motion.div>
            )}
        </div>
    );
}
