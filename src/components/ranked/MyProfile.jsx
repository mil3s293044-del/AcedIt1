/**
 * MyProfile — your own progression. Not your position.
 *
 * ─── The split this page needed ─────────────────────────────────────────────
 * This tab briefly carried a player card and a three-row ladder showing the
 * students either side of you. Both were wrong here, for the same reason: the
 * BOARD tab was already drawing those neighbours, larger, two feet to the
 * left, and putting the competitive half of a page called Ranked behind a tab
 * you have to go and choose is hiding the point of the page. The standing
 * moved to `StandingRail`, beside the board where the race actually is.
 *
 * What is left is the half that is genuinely about you and nobody else: how
 * far up the ladder you have climbed, and what you have unlocked. Those do not
 * need a rival on screen to mean something, which is exactly why they belong
 * on the other side of the tab.
 *
 * ─── It replaced `GamifiedMyRank` ───────────────────────────────────────────
 * An XP card, five stat tiles, twelve hand-written achievements, a missions
 * block, a streak explainer and a rate table — with `AchievementsGallery`
 * rendering a SECOND achievements grid, from the server, directly underneath.
 * Two grids of badges on one screen, one authoritative and one a hard-coded
 * guess at the same idea. The server catalogue stayed; it grants the XP.
 *
 * ─── No query of its own ────────────────────────────────────────────────────
 * XP and streak come off the board row the page has already fetched. The old
 * component re-read the profile, the sessions, the goals, the attempts and
 * every flashcard to print tiles that are gone.
 */
import React, { useMemo } from "react";
import XPLevelCard from "./XPLevelCard";
import AchievementsGallery from "./AchievementsGallery";

export default function MyProfile({ data, loading }) {
    const row = useMemo(
        () => (data?.board || []).find(r => r.user_email === data?.me) || null,
        [data]);

    if (loading) {
        return (
            <div className="space-y-4 max-w-4xl">
                <div className="card-soft animate-pulse h-40" />
                <div className="card-soft animate-pulse h-52" />
            </div>
        );
    }

    return (
        // Capped and centred. The board tab is a wide grid with a rail; this
        // tab is one column of cards, and stretched to 1400px a card holding
        // "Level 12" on the left and "6,384 XP to 13" on the right is mostly
        // the space between them.
        <div className="space-y-5 max-w-4xl">
            <XPLevelCard totalXP={row?.total_xp || 0} streakDays={row?.streak_days || 0} />
            <AchievementsGallery />
        </div>
    );
}
