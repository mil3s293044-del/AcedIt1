/**
 * league — what a weekly board means, kept out of the component that draws it.
 *
 * ─── This is the first week any of this has been true ───────────────────────
 * Weekly leagues shipped with migration 0015 and a lazy-settlement design that
 * was never reached: the one call to the settle function sat behind
 * `LEAGUES_SCALE_MODE === "tiered"` while the mode has been "global"
 * throughout, so `final_position` was NULL on every row the table ever held.
 * The board accumulated data for months and no student could see any of it —
 * `getLeagueStanding` had zero callers and there was no page.
 *
 * So everything here is about not repeating that: the numbers say what they
 * measure, a week with no result says so rather than printing a zero, and
 * nothing claims a standing the server has not actually settled.
 */

/* ── THE SCORE LIVES HERE AND THE SERVER IMPORTS IT ─────────────────────────
 *
 * `computeCompeteScore` used to live in `server.mjs` with these ceilings
 * restated here as a comment promising they matched. That is the mirror this
 * codebase keeps deleting — `market.js`, `megaUpload.js` and `storageBudget.js`
 * are all imported by the server rather than copied, and the ONE number a
 * student is ranked on is a worse thing to keep two copies of than a page
 * price. It moved; `server.mjs` imports it with a relative path.
 */

/** Compete Score ceilings. The slices sum to SCORE_MAX by construction. */
export const SLICE_MAX = { effort: 400, mastery: 400, consistency: 200 };
export const SCORE_MAX = SLICE_MAX.effort + SLICE_MAX.mastery + SLICE_MAX.consistency;

/** A minute of countable study is a point, to the ceiling. */
export const EFFORT_MINUTES_FULL = SLICE_MAX.effort;

/**
 * How many eligible sits mastery ramps to full over.
 *
 * ─── AN AVERAGE ALONE PUNISHED DOING MORE WORK ──────────────────────────────
 * Mastery was the bare average of your first sit of each eligible quiz, so ONE
 * easy quiz at 95% scored 380 and TWELVE at 78% scored 312. The student who did
 * twelve times the work came second, every week, by construction — and the
 * fastest way up the board was to sit one quiz on your best topic and stop.
 *
 * The average still decides the HEIGHT and the count decides how much of it you
 * get, ramping to full at four. Four because it is a real week of quizzing
 * rather than a grind: at twelve the ramp would reward volume over accuracy,
 * which is the same inversion pointed the other way.
 *
 * `BOARD_MIN_QUESTIONS`/`BOARD_MIN_MARKS` already stop an eight-second quiz
 * counting at all, so this never has to be the thing defending against that.
 */
export const MASTERY_SITS_FULL = 4;

/**
 * The weekly score, out of SCORE_MAX.
 *
 * ─── EVERY SLICE MEASURES THIS WEEK, and one of them did not ────────────────
 * Consistency used to be `days/7 × 150 + streak/14 × 50`, and a streak is a
 * LIFETIME number sitting inside a weekly competition. A student with a 60-day
 * run banked 50 points every Monday for nothing they had done that week, and a
 * student in their first week could not close it however hard they worked —
 * "never score a student on a signal they can't reach", on the one board whose
 * whole promise is that it resets.
 *
 * Days active takes the full 200 now. The streak still pays everywhere else it
 * always did (the XP multiplier, shields, the dashboard panel); it has simply
 * stopped being a head start on a weekly race.
 */
export function computeCompeteScore({ minutes = 0, avgAccuracy = 0, activeDays = 0, sits = 0 } = {}) {
    const mins = Math.max(0, Number(minutes) || 0);
    const effort = Math.round(Math.min(mins, EFFORT_MINUTES_FULL));

    const acc = Math.max(0, Math.min(100, Number(avgAccuracy) || 0));
    const n = Math.max(0, Math.floor(Number(sits) || 0));
    const ramp = Math.min(1, n / MASTERY_SITS_FULL);
    const mastery = Math.round((acc / 100) * SLICE_MAX.mastery * ramp);

    const days = Math.max(0, Math.min(7, Number(activeDays) || 0));
    const consistency = Math.round((days / 7) * SLICE_MAX.consistency);

    return { effort, mastery, consistency, total: effort + mastery + consistency };
}

/**
 * What one more of each is worth, so the board can say what a point COSTS.
 *
 * A student looking at "you are 40 points off third" cannot act on it unless
 * something says 40 points is forty more minutes, or one more quiz. Every
 * branch returns null rather than a placeholder when the slice is already full
 * — "study more" to somebody who has maxed effort is the app not reading its
 * own screen.
 */
export function nextPoint(cs = {}, { sits = 0, activeDays = 0, avgAccuracy = 0 } = {}) {
    const out = [];
    if ((cs.effort ?? 0) < SLICE_MAX.effort) {
        out.push({ key: "effort", per: 1, label: "Each study minute is a point." });
    }
    const n = Math.max(0, Math.floor(Number(sits) || 0));
    if (n < MASTERY_SITS_FULL && avgAccuracy > 0) {
        // What the NEXT sit adds if they hold their current average, which is
        // the honest estimate — it cannot know what they will score.
        const now = (avgAccuracy / 100) * SLICE_MAX.mastery * Math.min(1, n / MASTERY_SITS_FULL);
        const then = (avgAccuracy / 100) * SLICE_MAX.mastery * Math.min(1, (n + 1) / MASTERY_SITS_FULL);
        const gain = Math.round(then - now);
        if (gain > 0) out.push({ key: "mastery", per: gain, label: `One more quiz is about ${gain} points.` });
    }
    const days = Math.max(0, Math.min(7, Number(activeDays) || 0));
    if (days < 7) {
        const per = Math.round(SLICE_MAX.consistency / 7);
        out.push({ key: "consistency", per, label: `Studying another day is ${per} points.` });
    }
    return out;
}

export const SLICES = [
    { key: "effort", label: "Effort", hint: "Countable study minutes this week — one point each", bar: "bg-primary" },
    { key: "mastery", label: "Mastery", hint: `Your average first sit, over ${MASTERY_SITS_FULL} quizzes`, bar: "bg-chart-4" },
    { key: "consistency", label: "Consistency", hint: "Days you studied this week, out of 7", bar: "bg-xp" },
];

/* ── WHAT FINISHING WELL PAYS ───────────────────────────────────────────────
 *
 * The league computed a finish every week and paid NOTHING with it. It pays
 * three things now, and they are deliberately different KINDS of thing:
 *
 *   credits   the Monday grant, set by where you finished — see
 *             `grantForLeague`. Spendable, and the main reward.
 *   a crest   worn beside your name for the week AFTER, on every board the app
 *             draws. The only one other students can SEE, which is what makes
 *             a league competitive rather than a private score.
 *   XP        small, top finishers only.
 *
 * ─── THE XP IS SMALL ON PURPOSE ─────────────────────────────────────────────
 * XP feeds level, rank AND the ATAR, which is the flagship study score. A
 * league payout big enough to move somebody's ATAR would mean a quiet week
 * costs them twice — once on the board and once on the number this whole app
 * is standardised around — and would make the ATAR partly a measure of how
 * competitive somebody is rather than how much they have studied. These are
 * worth about one good study session, which is a nod rather than a lever.
 */

/** Top finishers only. Index 0 is first place. */
export const PODIUM = 3;
export const LEAGUE_XP = [120, 80, 50];

/** The XP a finish pays, or 0. Position is 1-based, as the database stores it. */
export function leagueXPFor(position) {
    const p = Math.floor(Number(position));
    if (!Number.isFinite(p) || p < 1) return 0;
    return LEAGUE_XP[p - 1] ?? 0;
}

/**
 * The crest a finish earns, or null.
 *
 * A PODIUM CREST IS EARNED AND IS NOT BOUGHT, so it is stored separately from
 * `cred_equipped` — which holds what somebody paid for and chose to wear. One
 * slot for both would mean winning the league silently took off the crest a
 * student had spent 2,850 credits on, or that buying one erased the proof they
 * came first. They are different claims and they get different storage.
 */
export function podiumCrest(position) {
    const p = Math.floor(Number(position));
    if (!Number.isFinite(p) || p < 1 || p > PODIUM) return null;
    return ["gold", "silver", "bronze"][p - 1];
}

/**
 * Is this podium crest still current? A crest is worn for the week AFTER the
 * one it was won in and then it is gone — a permanent badge for one good week
 * in March is a claim about today that stopped being true in March.
 */
export function podiumIsCurrent(award, thisWeekStart) {
    if (!award?.week || !thisWeekStart) return false;
    const won = new Date(`${award.week}T00:00:00Z`).getTime();
    const now = new Date(`${thisWeekStart}T00:00:00Z`).getTime();
    if (!Number.isFinite(won) || !Number.isFinite(now)) return false;
    const weeks = Math.round((now - won) / (7 * 86400000));
    return weeks === 1;
}

/**
 * The podium line: are you on it, and what does it cost or take to hold.
 *
 * ─── A BOARD WITH NO PODIUM DOES NOT PRINT ONE ──────────────────────────────
 * Three places paid out of two students is not a podium, it is everybody. The
 * same refusal `leagueLead` makes about "1st of 1", and for the same reason:
 * the whole value of a payline is that there is something on the other side of
 * it.
 *
 * In, it reports the MARGIN OVER FOURTH rather than over the row directly
 * below — fourth is the only person who can actually take the crest, so for
 * anyone in first or second "8 ahead of 3rd" is a number about nothing at
 * stake. Out, it is the gap to third, which is the whole reason the line is
 * drawn.
 */
export function podiumGap(rows = []) {
    const mine = rows.find((r) => r.is_me);
    if (!mine || rows.length <= PODIUM) return null;

    if (mine.position <= PODIUM) {
        const chaser = rows[PODIUM]; // 1-based PODIUM+1 → 0-based PODIUM
        if (!chaser) return null;
        return {
            in: true,
            position: mine.position,
            crest: podiumCrest(mine.position),
            margin: Math.max(0, mine.compete_score - chaser.compete_score),
            chaser: chaser.display_name,
        };
    }
    const third = rows[PODIUM - 1];
    if (!third) return null;
    return {
        in: false,
        position: mine.position,
        gap: Math.max(0, third.compete_score - mine.compete_score),
        holder: third.display_name,
    };
}

/**
 * Milliseconds until the week resets, or null.
 *
 * Returns null rather than 0 for a missing or unparseable date. `new Date(x||0)`
 * is the epoch and the epoch renders as "20705d ago" — the bug the Compete
 * feed already shipped once, and a countdown is the surface where it would be
 * least noticeable and most wrong.
 */
export function msUntilReset(resetsAt, now = new Date()) {
    if (!resetsAt) return null;
    const t = new Date(resetsAt).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, t - now.getTime());
}

/** "3d 4h" / "6h 12m" / "48m" / "under a minute". */
export function untilLabel(ms) {
    if (ms == null) return null;
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "under a minute";
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

/** The week is nearly over — worth saying, because it is still actionable. */
export const CLOSING_MS = 24 * 60 * 60 * 1000;
export const isClosing = (ms) => ms != null && ms > 0 && ms <= CLOSING_MS;

/**
 * The one sentence at the top: where you are and what is within reach.
 *
 * ORDERED BY WHAT IS ACTUALLY AT STAKE, and every branch returns null rather
 * than a placeholder — the rule Today's Play and `subjectLead` both keep. A
 * student alone on the board has not "won"; there is no race, and saying
 * "1st of 1" would be the app congratulating somebody for being the only one
 * here.
 */
export function leagueLead({ rows = [], me = {}, closing = false } = {}) {
    const mine = rows.find((r) => r.is_me);
    if (!mine || rows.length < 2) return null;

    const above = rows[mine.position - 2];
    const below = rows[mine.position];

    if (above) {
        const gap = above.compete_score - mine.compete_score;
        if (gap >= 0 && gap <= 120) {
            return {
                tone: "chase",
                headline: `${gap} points off ${above.display_name}`,
                detail: closing
                    ? "The week closes within the day."
                    : `That is ${Math.ceil(gap / 2)} more minutes of counted study, or one solid quiz.`,
            };
        }
    }
    if (below && mine.position <= 3) {
        const gap = mine.compete_score - below.compete_score;
        if (gap >= 0 && gap <= 80) {
            return {
                tone: "defend",
                headline: `${below.display_name} is ${gap} behind you`,
                detail: closing
                    ? "Holding this to Monday takes one more session."
                    : "Close enough to change by Monday.",
            };
        }
    }
    if (above) {
        return {
            tone: "climb",
            headline: `${mine.position} of ${rows.length} this week`,
            detail: `${above.compete_score - mine.compete_score} points to the place above.`,
        };
    }
    return { tone: "lead", headline: "You're leading the week", detail: null };
}

/**
 * Your finished weeks, as something to read.
 *
 * `best` is a lifetime fact and never regresses; `trend` needs a previous week
 * on BOTH sides and is null rather than 0 when it has one week or none — 0
 * means "held your place" and must not double as "I don't know yet", the same
 * rule the Quizzes trend tile keeps.
 */
export function historySummary(history = []) {
    // ── WATCH `Number(null) === 0` ──────────────────────────────────────────
    // `final_position` is NULL until the week is settled, and `Number(null)`
    // is a perfectly finite 0 — so a plain isFinite check waves every
    // unsettled week through as position zero, which then wins `best` and
    // reports a podium nobody was given. The same coercion attached every
    // unlinked annotation to the first criterion on the page. Reject the empty
    // values explicitly before converting.
    const weeks = (Array.isArray(history) ? history : [])
        .filter((h) => h && h.position != null && h.position !== "")
        .filter((h) => Number.isFinite(Number(h.position)) && Number(h.position) >= 1)
        .map((h) => ({ ...h, position: Number(h.position) }));
    if (!weeks.length) return { weeks: [], count: 0, best: null, trend: null, podiums: 0 };

    // Server hands these back newest-first.
    const best = Math.min(...weeks.map((w) => w.position));
    const trend = weeks.length >= 2 ? weeks[1].position - weeks[0].position : null;
    return {
        weeks,
        count: weeks.length,
        best,
        // A smaller position is better, so a POSITIVE trend is an improvement:
        // finishing 8th after 12th is +4. Drawing the raw difference would put
        // a green arrow on a week somebody went backwards.
        trend,
        podiums: weeks.filter((w) => w.position <= 3).length,
    };
}

/** 1st / 2nd / 3rd / 4th. */
export function ordinal(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 1) return null;
    const mod100 = v % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
    return `${v}${["th", "st", "nd", "rd"][v % 10] ?? "th"}`;
}
