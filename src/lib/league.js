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

/** Compete Score ceilings, mirroring computeCompeteScore in server.mjs. */
export const SLICE_MAX = { effort: 400, mastery: 400, consistency: 200 };
export const SCORE_MAX = SLICE_MAX.effort + SLICE_MAX.mastery + SLICE_MAX.consistency;

export const SLICES = [
    { key: "effort", label: "Effort", hint: "Countable study minutes this week", bar: "bg-primary" },
    { key: "mastery", label: "Mastery", hint: "Average of your first sit of each quiz", bar: "bg-chart-4" },
    { key: "consistency", label: "Consistency", hint: "Days active this week, plus your streak", bar: "bg-xp" },
];

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
