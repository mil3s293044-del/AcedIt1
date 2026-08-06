/**
 * battleOdds — momentum, projections and win probability for a battle.
 *
 * A battle used to show two numbers and a bar: your score and theirs. That
 * tells you who is ahead, which is the least interesting thing about a
 * competition. It can't tell you whether a lead is opening or closing, whether
 * you're gaining, or whether the gap is realistically closable in the time
 * left — the things that actually make you want to open the app and study.
 *
 * Everything here derives from `participants[].score_history`, the trail
 * syncCompetitionSlice records on the server (one point every few hours).
 * With no trail yet it degrades to lead-only odds rather than inventing data.
 */

const HOUR = 3600 * 1000;

const scoreOf = (p) => Number(p?.compete_score ?? p?.progress_percent ?? 0) || 0;

const trailOf = (p) =>
    (Array.isArray(p?.score_history) ? p.score_history : [])
        .filter((h) => h && h.t && typeof h.s === "number")
        .sort((a, b) => new Date(a.t) - new Date(b.t));

/**
 * Points gained over the last `hours`. Null when there's no trail old enough
 * to measure against — an unknown pace is not the same as a flat one.
 */
export function momentumOf(participant, hours = 24) {
    const trail = trailOf(participant);
    if (trail.length < 2) return null;
    const cutoff = Date.now() - hours * HOUR;
    // Latest point at or before the cutoff — the score `hours` ago.
    const before = [...trail].reverse().find((h) => new Date(h.t).getTime() <= cutoff);
    const baseline = before ?? trail[0];
    const gained = scoreOf(participant) - baseline.s;
    return Math.round(gained);
}

/** Points per hour over the trail, used to project where a battle is heading. */
function paceOf(participant) {
    const trail = trailOf(participant);
    if (trail.length < 2) return 0;
    const first = trail[0];
    const spanHours = (Date.now() - new Date(first.t).getTime()) / HOUR;
    if (spanHours < 1) return 0;
    return Math.max(0, (scoreOf(participant) - first.s) / spanHours);
}

export function hoursLeft(targetDate) {
    if (!targetDate) return null;
    const ms = new Date(targetDate).getTime() - Date.now();
    return ms > 0 ? ms / HOUR : 0;
}

const logistic = (x) => 1 / (1 + Math.exp(-x));

/**
 * Win probability for `me` against the strongest rival.
 *
 * Projects both scores forward at their measured pace, then treats the
 * remaining margin as uncertain in proportion to how much time is left —
 * a 20-point lead with an hour to go is nearly safe; the same lead with a
 * week to go is barely a lead at all.
 *
 * Returns null when there's nobody to race, rather than a fake 100%.
 */
export function winOdds({ me, rivals, targetDate }) {
    if (!me || !rivals?.length) return null;
    const best = rivals.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a));

    const hrs = hoursLeft(targetDate);
    // No deadline: judge on the standing gap with a generous uncertainty.
    const horizon = hrs == null ? 48 : Math.max(0, hrs);

    const myPace = paceOf(me);
    const theirPace = paceOf(best);
    const projectedMargin =
        (scoreOf(me) - scoreOf(best)) + (myPace - theirPace) * horizon;

    // Spread grows with the square root of time left — more runway, more that
    // can change. Floored so a finished battle isn't infinitely certain.
    const typicalPace = Math.max(1, (myPace + theirPace) / 2);
    const sigma = Math.max(4, typicalPace * Math.sqrt(horizon + 1) * 1.6);

    const p = logistic(projectedMargin / sigma);
    return Math.max(1, Math.min(99, Math.round(p * 100)));
}

/**
 * The gap between me and the leader over time, for the swing line. Positive
 * means ahead. Points are sampled from whichever trail has data.
 */
export function gapSeries({ me, rivals }) {
    const mine = trailOf(me);
    if (mine.length < 2 || !rivals?.length) return [];
    const best = rivals.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a));
    const theirs = trailOf(best);
    if (!theirs.length) return [];

    // Their score as at a given time — last point at or before it.
    const theirScoreAt = (t) => {
        const at = new Date(t).getTime();
        const pt = [...theirs].reverse().find((h) => new Date(h.t).getTime() <= at);
        return pt ? pt.s : theirs[0].s;
    };
    return mine.map((h) => h.s - theirScoreAt(h.t));
}

/** One line naming the state of the race. Drives the card's headline. */
export function battleNarrative({ me, rivals }) {
    if (!me || !rivals?.length) return null;
    const best = rivals.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a));
    const lead = scoreOf(me) - scoreOf(best);
    const myMo = momentumOf(me, 24);
    const theirMo = momentumOf(best, 24);
    const name = (best.name || best.email || "They").split(" ")[0];

    if (myMo != null && theirMo != null) {
        if (lead > 0 && myMo > theirMo) return { tone: "good", text: `Pulling away — you gained ${myMo} to ${name}'s ${theirMo} today.` };
        if (lead > 0 && myMo < theirMo) return { tone: "warn", text: `Lead is closing — ${name} gained ${theirMo} today to your ${myMo}.` };
        if (lead < 0 && myMo > theirMo) return { tone: "good", text: `Closing the gap — you gained ${myMo} to ${name}'s ${theirMo} today.` };
        if (lead < 0 && myMo < theirMo) return { tone: "bad", text: `Falling behind — ${name} gained ${theirMo} today to your ${myMo}.` };
    }
    if (lead > 0) return { tone: "good", text: `${lead} pts ahead of ${name}.` };
    if (lead < 0) return { tone: "warn", text: `${Math.abs(lead)} pts behind ${name} — catch up!` };
    return { tone: "warn", text: `Dead level with ${name}.` };
}
