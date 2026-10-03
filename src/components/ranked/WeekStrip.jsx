/**
 * WeekStrip — the way into the weekly league, on the board that is about
 * standing.
 *
 * ─── Why here rather than a sixth nav item ──────────────────────────────────
 * Ranked is already where a student goes to ask "where do I sit". The ATAR
 * board answers that over 28 days; the league answers it over the week. One
 * more item in a five-item rail would make the nav the thing you have to read
 * first, which is the problem Compete's three tabs had.
 *
 * ─── IT WAS IN THE STICKY RAIL, WHICH IS THE SECOND COLUMN ──────────────────
 * Ranked's board is `xl:grid-cols-[1fr_320px]`, so below xl — every phone, and
 * any laptop in a narrow window — that rail stacks UNDERNEATH the whole
 * thirty-row board. The one entrance to a weekly competition sat below
 * everything on the page for most of the traffic. It LEADS the board now, full
 * width, and the League is a tab beside Leaderboard so the word is on screen
 * whether or not this strip renders at all.
 *
 * ─── AND IT SAYS WHAT THE WEEK PAYS ─────────────────────────────────────────
 * A position and a clock tell a student where they are and nothing about
 * whether it is worth anything, so there was no reason to click. The podium
 * line names the prize — the same `grantForLeague` the server grants with,
 * never a second copy of the figure — which is the rule `Podium` already keeps
 * about printing the reward on the step rather than drawing three heights.
 *
 * ─── `onOpen` RATHER THAN A LINK, when Ranked passes one ────────────────────
 * The league is a tab on the page this strip sits on, so navigating to
 * `/League` would leave the screen to show something that is already on it.
 * Without the prop it stays a real link, because `/League` is still a route
 * and this component should not require a parent to be useful.
 *
 * ─── But it has to actually be a way in ─────────────────────────────────────
 * A page with no entrance is the shape this whole feature already had: the
 * league endpoint existed, worked, and nothing ever called it, so it may as
 * well not have been written. The strip states this week's position and the
 * clock — real information, not just a link — and the whole row is the target.
 *
 * It refuses rather than guesses: no position yet means the strip says the
 * week has not started for you, never "0th".
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Trophy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useLiveTick } from "@/lib/LiveContext";
import { unwrapFn } from "@/lib/fnResult";
import { msUntilReset, untilLabel, isClosing, ordinal, podiumGap, PODIUM } from "@/lib/league";
import { grantForLeague } from "@/lib/credStore";
import AceShuffle from "@/components/ace/AceShuffle";

export default function WeekStrip({ onOpen = null }) {
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);
    const liveTick = useLiveTick();

    const load = useCallback(async () => {
        try {
            // unwrapFn: this checked `res.success`, which lives INSIDE data —
            // so the check never passed and the only entrance to the league
            // page never rendered. The feature shipped invisible.
            const payload = unwrapFn(await base44.functions.invoke("getLeagueStanding", {}));
            if (payload && !payload.error) setState(payload);
        } catch { /* the strip simply does not render */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load, liveTick]);

    if (loading) {
        return (
            <div className="card-soft px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
                <AceShuffle size="sm" /> This week…
            </div>
        );
    }
    // The league tables may not exist on this project yet. Silence is the
    // right failure here — the same posture call-outs and reactions take.
    if (!state?.success) return null;

    const ms = msUntilReset(state.group?.resets_at);
    const closing = isClosing(ms);
    const pos = state.me?.position;
    const total = state.rows?.length || 0;
    // The PODIUM is what makes the strip a reason to click rather than a
    // status line. It returns null on a board too small to have one, which is
    // when the clock is the more useful thing to print anyway.
    const pod = podiumGap(state.rows || []);
    const clock = ms != null ? `resets in ${untilLabel(ms)}` : null;

    // WHAT A FINISH IS WORTH, from the function the server grants with rather
    // than a figure typed here. Winning the group is the honest headline number
    // — it is the ceiling a student is actually playing for — and it is only
    // printed on a board big enough to HAVE a podium, because "top 3 of 2" is
    // everybody, the refusal `podiumGap` already makes.
    const topPay = total > PODIUM
        ? grantForLeague({ position: 1, groupSize: total, tiered: false, tierIndex: 0 })
        : null;

    const inner = (
        <>
            <span className="w-9 h-9 rounded-xl bg-xp/15 text-xp flex items-center justify-center flex-shrink-0">
                <Trophy className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="font-display font-extrabold text-sm text-foreground leading-tight">
                    {pos && total > 1
                        ? `${ordinal(pos)} of ${total} this week`
                        : "The weekly league"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                    {pod ? (
                        <>
                            <span className={pod.in ? "text-xp font-bold" : "font-bold text-foreground"}>
                                {pod.in ? "On the podium" : `${pod.gap} off the podium`}
                            </span>
                            {clock && <> · {clock}</>}
                        </>
                    ) : ms != null
                        ? <>Resets in <span className={closing ? "text-xp font-bold" : ""}>{untilLabel(ms)}</span></>
                        : "Effort, mastery and consistency over seven days"}
                </p>
            </div>
            {topPay != null && (
                <span className="hidden sm:flex flex-col items-end flex-shrink-0 pl-3
                    border-l border-border">
                    <span className="stat-label text-muted-foreground">Top 3 take</span>
                    <span className="font-display font-extrabold text-sm text-xp tabular-nums">
                        {topPay.credits}
                        <span className="text-[11px] font-bold text-muted-foreground ml-1">credits</span>
                    </span>
                </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground
                transition-colors flex-shrink-0" />
        </>
    );

    const cls = `card-soft px-4 py-3 flex items-center gap-3 w-full text-left
        hover:border-foreground/20 transition-colors group`;

    return onOpen
        ? <button type="button" onClick={onOpen} className={cls}>{inner}</button>
        : <Link to={createPageUrl("League")} className={cls}>{inner}</Link>;
}
