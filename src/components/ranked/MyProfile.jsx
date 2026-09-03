/**
 * MyProfile — who you are on this ladder, and what it would take to move.
 *
 * ─── What it replaced ───────────────────────────────────────────────────────
 * `GamifiedMyRank`, which was an XP card, five stat tiles, twelve hand-written
 * achievements, a daily-missions block, a streak-multiplier explainer and a
 * table of XP rates — and then `AchievementsGallery` rendered a SECOND
 * achievements grid, from the server catalogue, immediately underneath. Two
 * grids of badges on one screen, one of them authoritative and one of them a
 * hard-coded guess at the same idea.
 *
 * Two things were wrong with it beyond the length.
 *
 *   IT WASN'T COMPETITIVE. On a page called Ranked, nothing on the profile tab
 *   compared the student to anybody. "Total XP 4,200" is a number about you in
 *   a vacuum; "4th of 132, 1.24 behind Priya" is the same page doing its job.
 *   The board array already carried every neighbour and gap and none of it was
 *   read.
 *
 *   IT WASN'T PART OF THE APP. Five tiles with an icon in a rounded square is
 *   the house style of every dashboard ever generated, and this app has its
 *   own visual language — cards, where rank is how strong the thing is and
 *   suit is the family it belongs to, used on eighteen other surfaces. A
 *   student's own profile is the one place that language most obviously
 *   belongs and it was the one place not using it.
 *
 * ─── The card is EARNED, and that is the whole point ────────────────────────
 * Rank comes from the AcedIt ATAR through the same `rankFor` every deck and
 * quiz uses, so an Ace here means what an Ace means everywhere else in the
 * app: near the top of what the thing measures. Nobody is handed one for
 * signing up. Suit is the subject they have actually put the most time into —
 * the family they belong to — which is why it needs a real query rather than a
 * hash of their name.
 *
 * ─── One query, not five ────────────────────────────────────────────────────
 * The board payload the page has already fetched carries XP, streak and every
 * rival's score. The old component re-fetched the profile, the sessions, the
 * goals, the attempts and the flashcards to print tiles that are gone now. All
 * that is left to ask for is which subject the time went to.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy, ChevronUp, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import PlayingCard from "@/components/cards/PlayingCard";
import { rankFor, suitFor, colorFor, rankTitle } from "@/components/cards/cardIdentity";
import XPLevelCard from "./XPLevelCard";
import AchievementsGallery from "./AchievementsGallery";
import {
    standing, titlesFor, nextBand, weakestComponent, bandOf, COMPONENT_ACTION,
} from "@/lib/ranked";

const TONE_TEXT = {
    muted: "text-muted-foreground", xp: "text-xp", streak: "text-streak",
    "chart-3": "text-chart-3", "chart-4": "text-chart-4", primary: "text-primary",
};

const COMPONENT_LABEL = {
    mastery: "Mastery", consistency: "Consistency", effort: "Effort",
    breadth: "Breadth", planning: "Planning",
};

/** Where the weakest component is actually fixed. Each one has a screen. */
const COMPONENT_PAGE = {
    mastery: "MistakeBank", consistency: "Dashboard", effort: "Study",
    breadth: "Study", planning: "Goals",
};

const displayName = (row, me) => {
    if (!row) return "—";
    if (row.user_email === me) return "You";
    if (row.is_anonymous) return `Anon #${(row.user_email || "").slice(0, 4)}`;
    return row.username || row.user_name || (row.user_email || "").split("@")[0];
};

/**
 * The subject the student's logged time actually goes to.
 *
 * Recent rows rather than all of them: a profile should say what someone is
 * doing now, and a subject they dropped in March should not still be printed
 * on their card in September.
 */
function topSubjectOf(rows = []) {
    const mins = new Map();
    for (const r of rows) {
        const s = String(r?.subject || "").trim();
        if (!s) continue;
        mins.set(s, (mins.get(s) || 0) + (Number(r.session_duration) || 0));
    }
    let best = null;
    for (const [subject, m] of mins) if (!best || m > best.minutes) best = { subject, minutes: m };
    if (!best || best.minutes <= 0) return null;
    const total = [...mins.values()].reduce((a, b) => a + b, 0);
    return { ...best, share: Math.round((best.minutes / total) * 100) };
}

/** One row of the ladder around you. */
function Neighbour({ row, me, value, delta, position }) {
    const isMe = position === "me";
    return (
        <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
            isMe ? "bg-foreground text-background" : "bg-secondary/40"}`}>
            <span className={`text-[11px] font-bold tabular-nums w-6 flex-shrink-0 ${
                isMe ? "text-background/70" : "text-muted-foreground"}`}>
                {row.rank ? `#${row.rank}` : "—"}
            </span>
            <span className={`text-sm font-bold truncate flex-1 min-w-0 ${
                isMe ? "text-background" : "text-foreground"}`}>
                {displayName(row.row, me)}
            </span>
            <span className={`text-sm font-black tabular-nums flex-shrink-0 ${
                isMe ? "text-background" : "text-foreground"}`}>
                {value == null ? "—" : value.toFixed(2)}
            </span>
            {delta != null && (
                <span className={`inline-flex items-center text-[11px] font-bold tabular-nums w-14 justify-end flex-shrink-0 ${
                    position === "above" ? "text-streak" : "text-primary"}`}>
                    {position === "above"
                        ? <><ChevronUp className="w-3 h-3" />+{delta.toFixed(2)}</>
                        : <><ChevronDown className="w-3 h-3" />−{delta.toFixed(2)}</>}
                </span>
            )}
        </div>
    );
}

export default function MyProfile({ data, loading }) {
    const [techniques, setTechniques] = useState([]);

    useEffect(() => {
        let alive = true;
        base44.entities.StudyTechnique
            .filter({}, "-created_date", 120)
            .then(rows => { if (alive) setTechniques(rows || []); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    // The ATAR ladder specifically, and globally. The board tab's own filters
    // are its own; a profile that changed who you were because a toggle on the
    // other tab was set to "Friends" would be a profile of your friends list.
    const field = useMemo(() => (data?.board || [])
        .filter(r => r.acedit_atar != null)
        .sort((a, b) => (b.acedit_atar || 0) - (a.acedit_atar || 0)), [data]);

    const mine = useMemo(() => {
        const s = standing(field, data?.me);
        return { ...s, row: field.find(r => r.user_email === data?.me) || null };
    }, [field, data]);

    const title = useMemo(() => titlesFor(field).get(data?.me) || null, [field, data]);
    const top = useMemo(() => topSubjectOf(techniques), [techniques]);

    const atar = data?.my_atar ?? null;
    const band = data?.my_band || bandOf(atar)?.name || null;
    const next = nextBand(atar);
    const weakest = weakestComponent(data?.my_components);

    // The card. Suit is the subject the time goes to; with none logged yet it
    // falls back to spades rather than inventing a subject the student would
    // not recognise as theirs.
    const subject = top?.subject || null;
    const suit = subject ? suitFor(subject) : "spade";
    const tone = subject ? colorFor(subject) : "#6B7280";
    const rank = rankFor(atar ?? 0);

    if (loading) {
        return (
            <div className="space-y-5">
                <div className="card-soft animate-pulse h-64" />
                <div className="card-soft animate-pulse h-40" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ── THE CARD, AND THE GAP ──────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="card-soft on-table p-5 lg:p-6">
                <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] items-start">

                    {/* Rank = the score. Suit = the subject. Same contract as
                        every other card in the app, which is what makes this
                        one legible without a legend. */}
                    <div className="mx-auto sm:mx-0">
                        <PlayingCard
                            rank={rank} suit={suit} tone={tone} pips="compact"
                            mastery={atar ?? 0}
                            className="w-[150px] h-[210px]"
                            title={rankTitle(rank, suit, atar ?? 0)}>
                            <span className="absolute inset-x-0 bottom-0 px-3 pb-3 text-center">
                                <span className="block font-display font-black text-foreground text-xl leading-none tabular-nums">
                                    {atar == null ? "—" : atar.toFixed(2)}
                                </span>
                                <span className="block text-[10px] font-bold text-muted-foreground truncate mt-1">
                                    {subject || "AcedIt ATAR"}
                                </span>
                            </span>
                        </PlayingCard>
                        {title && (
                            <p className={`text-center text-[11px] font-black mt-2 ${TONE_TEXT[title.tone] || ""}`}
                                title={title.blurb}>
                                {title.label}
                            </p>
                        )}
                    </div>

                    <div className="min-w-0 space-y-4">
                        <div>
                            <p className="stat-label text-muted-foreground">Your standing</p>
                            {/* The headline is the COMPARISON, not the score.
                                The score is already the biggest thing on the
                                page above this one; printing it again here
                                would be the third readout of one number. */}
                            <h2 className="font-display font-black text-foreground text-2xl lg:text-3xl leading-tight mt-0.5">
                                {mine.rank
                                    ? <>#{mine.rank} <span className="text-muted-foreground font-extrabold text-xl">of {mine.total}</span></>
                                    : "Not ranked yet"}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {mine.rank
                                    ? <>Top {mine.percentile}% across AcedIt{band ? ` · ${band}` : ""}</>
                                    : "Three study days on the board unlocks your place."}
                            </p>
                        </div>

                        {/* Who is directly above and below. This is the whole
                            reason the tab exists — a rank on its own is a fact,
                            and a rank with the person you are chasing beside it
                            is a race. */}
                        {mine.rank && (
                            // Capped. Stretched across a wide screen the score
                            // and the gap end up a hand's width from the name
                            // they belong to, and a ladder you have to track
                            // across is not a ladder.
                            <div className="space-y-1.5 max-w-md">
                                {mine.above && (
                                    <Neighbour row={{ row: mine.above.row, rank: mine.rank - 1 }} me={data?.me}
                                        value={mine.above.row.acedit_atar} delta={mine.above.gap} position="above" />
                                )}
                                <Neighbour row={{ row: mine.row, rank: mine.rank }} me={data?.me}
                                    value={atar} position="me" />
                                {mine.below && (
                                    <Neighbour row={{ row: mine.below.row, rank: mine.rank + 1 }} me={data?.me}
                                        value={mine.below.row.acedit_atar} delta={mine.below.gap} position="below" />
                                )}
                            </div>
                        )}

                        {/* What closes the gap, and the door to it. A profile
                            that names your weakest component and leaves you to
                            find the page is the "suggestion that says I'll
                            build it" failure in another costume. */}
                        {weakest && (
                            <div className="rounded-2xl border-2 border-border bg-secondary/40 p-3.5">
                                <p className="text-xs text-foreground leading-snug">
                                    <span className="font-bold">
                                        {mine.above
                                            ? `${mine.above.gap.toFixed(2)} behind ${displayName(mine.above.row, data?.me)}.`
                                            : mine.rank === 1 ? "Top of the board."
                                            : next ? `${next.gap.toFixed(2)} to ${next.name}.` : ""}
                                    </span>{" "}
                                    {COMPONENT_LABEL[weakest.key]} is your lowest component at{" "}
                                    <span className="font-bold tabular-nums">{weakest.value}</span> —{" "}
                                    {COMPONENT_ACTION[weakest.key]}
                                </p>
                                <Link to={createPageUrl(COMPONENT_PAGE[weakest.key] || "Dashboard")}
                                    className="inline-flex items-center gap-1.5 text-xs font-black text-primary mt-2 hover:underline">
                                    Go and move it <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        )}

                        {top && (
                            <p className="text-[11px] text-muted-foreground">
                                <span className="font-bold text-foreground">{top.share}%</span> of your logged
                                time lately goes to {top.subject} — that&rsquo;s the suit on your card.
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── XP AND LEVEL ───────────────────────────────────────── */}
            <XPLevelCard
                totalXP={mine.row?.total_xp || 0}
                streakDays={mine.row?.streak_days || 0} />

            {/* There is no "how to earn XP" table here, and that is on
                purpose. XPLevelCard above already prints one — "Earn XP From",
                under the rank ladder — and the standalone copy this component
                inherited disagreed with it in two rows (flashcards at 0.5
                against 0.6–1.5, quizzes at 2 XP/mark against 8–50). Two rate
                cards for one economy, on one screen, with different numbers,
                is worse than either of them alone. */}

            {/* ── ACHIEVEMENTS ───────────────────────────────────────── */}
            {/* One grid. The catalogue is the server's, it grants the XP on
                unlock, and it is the only one that can be added to without a
                deploy — so the twelve hard-coded badges that used to sit
                directly above it went, not this. */}
            <AchievementsGallery />

            {!mine.rank && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                    Your card takes its rank from your AcedIt ATAR, so it moves when the score does.
                </p>
            )}
        </div>
    );
}
