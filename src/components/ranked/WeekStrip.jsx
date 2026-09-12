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
import { ChevronRight, Trophy, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useLiveTick } from "@/lib/LiveContext";
import { unwrapFn } from "@/lib/fnResult";
import { msUntilReset, untilLabel, isClosing, ordinal } from "@/lib/league";

export default function WeekStrip() {
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
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> This week…
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

    return (
        <Link
            to={createPageUrl("League")}
            className="card-soft px-4 py-3 flex items-center gap-3 hover:border-foreground/20
                transition-colors group"
        >
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
                    {ms != null
                        ? <>Resets in <span className={closing ? "text-xp font-bold" : ""}>{untilLabel(ms)}</span></>
                        : "Effort, mastery and consistency over seven days"}
                </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground
                transition-colors flex-shrink-0" />
        </Link>
    );
}
