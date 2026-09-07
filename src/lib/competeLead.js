/**
 * competeLead — the one thing happening on Compete right now.
 *
 * ─── Why a hero at all ──────────────────────────────────────────────────────
 * Compete opened on three tabs and made the student choose between Battles,
 * Back yourself and Your calls before it told them anything. That is a
 * navigation question standing where an answer should be, on the page whose
 * entire job is "is anything happening". Today's Play settles the same problem
 * on the dashboard by leading with one move, and this follows it.
 *
 * ─── Ordered by what is about to be DECIDED ─────────────────────────────────
 * Not by what is most exciting, and not by what has the biggest number on it:
 * a call that settles tonight matters more than a battle a fortnight out,
 * because it is the one where doing something still changes the result.
 *
 * Every branch returns null rather than a placeholder when its number is not
 * real — the rule Today's Play keeps about its rail. A first-week account has
 * no battles and no calls, and telling it "0 XP at stake" teaches a student
 * that the numbers on this page are decoration.
 */

const HOUR = 3600 * 1000;

const hoursUntil = (t) => {
    const ms = new Date(t || 0).getTime() - Date.now();
    return Number.isFinite(ms) ? ms / HOUR : null;
};

/**
 * @param openCalls   resolved-but-open forecasts, from `forecastBoard`
 * @param battles     normalised battles, from `allBattles`
 * @param myEmail     so a battle can say whether you are ahead
 */
export function competeLead({ openCalls = [], battles = [], hasDeck = false } = {}) {
    // 1. A call about to settle. The most time-critical thing the page holds,
    //    and the only one where the deadline is the point.
    const closing = openCalls
        .map((r) => ({ r, h: hoursUntil(r?.forecast?.deadline) }))
        .filter((x) => x.h != null && x.h > 0 && x.h <= 48)
        .sort((a, b) => a.h - b.h)[0];
    if (closing) {
        const h = Math.max(1, Math.round(closing.h));
        return {
            kind: "call_closing",
            tab: "calls",
            title: h <= 24 ? "A call settles today" : `A call settles in ${h}h`,
            detail: closing.r.question,
            action: "See it",
        };
    }

    // 2. A battle that is genuinely close. `gap` is whatever the normaliser
    //    computed; with no gap there is no contest to report, so it is skipped
    //    rather than described as tied.
    const live = battles
        .filter((b) => b && b.status === "active" && typeof b.gap === "number")
        .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))[0];
    if (live && Math.abs(live.gap) <= 15) {
        return {
            kind: "battle_close",
            tab: "duels",
            title: live.gap >= 0 ? `You're ${Math.round(live.gap)} ahead` : `You're ${Math.abs(Math.round(live.gap))} behind`,
            detail: live.title || "A battle is close enough to turn.",
            action: "Open it",
        };
    }

    // 3. Any battle at all, close or not.
    if (live) {
        return {
            kind: "battle",
            tab: "duels",
            title: "A battle is running",
            detail: live.title || "Someone is racing you.",
            action: "Open it",
        };
    }

    // 4. Nothing live. Invite a call — but only when there is something to
    //    forecast ABOUT. A student with no cards and no history is being asked
    //    to predict a thing they have not started.
    if (hasDeck) {
        return {
            kind: "make_call",
            tab: "calls",
            title: "Nothing riding on this week",
            detail: "Call how your week goes. You only gain by knowing something we don't.",
            action: "Make a call",
        };
    }

    return null;
}
