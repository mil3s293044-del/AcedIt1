/**
 * studyLog — one reading of "when did this student actually study", across
 * BOTH tables it is written to.
 *
 * ─── The trap this exists to close ──────────────────────────────────────────
 * Study is logged in two places and neither is a superset of the other:
 *
 *   study_techniques   pomodoro, active recall, blurting, spaced repetition —
 *                      everything the Study page runs. Minutes are in
 *                      `session_duration`.
 *   study_sessions     quizzes and the activity tracker, and nothing else.
 *                      Minutes are in `duration_minutes`.
 *
 * The dashboard's week panel read only the second one. So a student who spent
 * their week on the Study page saw a panel headed "cleared this week" that
 * counted their quizzes and called it the week — the identical failure the
 * ATAR's planning component had, written up in CLAUDE.md, repeated on the
 * surface next to it. Anything asking "did they study" reads BOTH, through
 * here, or it will keep happening.
 *
 * ─── Normalised, because the two rows disagree about everything ─────────────
 * Different minute columns, different subject columns in places, and `date` is
 * a DAY on both while `created_date` is a timestamp. One shape out: subject,
 * minutes, the day it belongs to, and where it came from.
 */

/** The day a row belongs to. `date` is authoritative; created_date is the fallback. */
const dayOf = (row) => String(row?.date || row?.created_date || "").slice(0, 10);

const mins = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Both logs as one list, newest day first.
 *
 * A row with no day at all is DROPPED rather than dated today: it would land
 * in whatever window is being measured and inflate it, and a row that cannot
 * say when it happened cannot answer any question this file is asked.
 */
export function studyEvents(sessions = [], techniques = []) {
    const out = [];

    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
        const day = dayOf(s);
        if (!day) return;
        out.push({
            id: s.id, day, at: s.created_date || s.date,
            subject: s.subject || null,
            minutes: mins(s.duration_minutes) || mins(s.session_duration),
            source: "session",
        });
    });

    (Array.isArray(techniques) ? techniques : []).forEach((t) => {
        const day = dayOf(t);
        if (!day) return;
        out.push({
            id: t.id, day, at: t.created_date || t.date,
            subject: t.subject || null,
            minutes: mins(t.session_duration) || mins(t.duration_minutes),
            source: "technique",
        });
    });

    return out.sort((a, b) => String(b.day).localeCompare(String(a.day)));
}

// ─── Days, weeks, and where "now" sits in one ───────────────────────────────

const MS_DAY = 86400000;

/** `Date` → "YYYY-MM-DD", in local time. Never `toISOString`, which is UTC. */
export function dayKey(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Monday = 0 … Sunday = 6.
 *
 * The school week starts on Monday here, so a Sunday session belongs to the
 * week that is ending rather than the one about to start. `getDay()` puts
 * Sunday at 0, which would file it under the wrong week entirely.
 */
export const weekIndex = (d) => (d.getDay() + 6) % 7;

/** The Monday of the week `d` falls in. */
export function weekStart(d) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    s.setDate(s.getDate() - weekIndex(s));
    return s;
}

/** How many prior weeks the baseline may draw on. */
export const BASELINE_WEEKS = 8;

/** Fewer than this many comparable weeks and there is no "usual" to claim. */
export const MIN_BASELINE_WEEKS = 2;

/**
 * This week's study so far, against what this student usually has by this
 * point in the week.
 *
 * ─── Why compare them to THEMSELVES ─────────────────────────────────────────
 * The panel this replaces printed "4 sessions · 27m across 3 days", which is a
 * log: it reads the same whether that is a good week or a collapse, and the
 * only honest thing you can do with it is nod. Against their own usual, the
 * same 27m says something — and it says it on week one and on week thirty,
 * without the app ever having to invent a target it cannot justify.
 *
 * ─── BY THIS POINT IN THE WEEK, not the whole week ──────────────────────────
 * Comparing Wednesday's running total against past FULL weeks would tell every
 * student they are behind until Sunday. Each prior week is therefore truncated
 * at the same weekday, so Wednesday is measured against Wednesdays.
 *
 * ─── The baseline is a MEDIAN ───────────────────────────────────────────────
 * One five-hour cram week before a SAC should not set the bar for the rest of
 * the term — the mean lets it, and then the panel tells a student working
 * normally that they are failing. Same lesson the Ranked board learned when
 * one student 27 points clear set the scale for everybody's gap bar.
 */
export function weekPace(events = [], now = new Date()) {
    const list = Array.isArray(events) ? events : [];
    const thisMonday = weekStart(now);
    const idx = weekIndex(now);

    // Minutes in [start, start + throughDays] inclusive, plus what made them up.
    const window = (start, throughDays) => {
        const from = dayKey(start);
        const to = dayKey(new Date(start.getTime() + throughDays * MS_DAY));
        const rows = list.filter((e) => e.day >= from && e.day <= to);
        return {
            minutes: rows.reduce((sum, e) => sum + e.minutes, 0),
            sessions: rows.length,
            days: new Set(rows.map((e) => e.day)).size,
            subjects: [...new Set(rows.map((e) => e.subject).filter(Boolean))],
            rows,
        };
    };

    const current = window(thisMonday, idx);

    // Prior weeks, each cut at the same weekday. A week with nothing in it is
    // dropped rather than counted as a zero: a student who joined three weeks
    // ago has no history before that, and reading those as zero-minute weeks
    // would set their "usual" at nothing and congratulate any effort at all.
    const priors = [];
    for (let w = 1; w <= BASELINE_WEEKS; w += 1) {
        const start = new Date(thisMonday.getTime() - w * 7 * MS_DAY);
        const got = window(start, idx);
        if (got.minutes > 0) priors.push(got.minutes);
    }

    let baseline = null;
    if (priors.length >= MIN_BASELINE_WEEKS) {
        const sorted = [...priors].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        baseline = sorted.length % 2
            ? sorted[mid]
            : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }

    return {
        minutes: current.minutes,
        sessions: current.sessions,
        days: current.days,
        subjects: current.subjects,
        // Which weekday we are measuring up to, so the panel can say "by
        // Thursday" rather than leaving the reader to work out what is being
        // compared to what.
        dayIndex: idx,
        baseline,
        weeksOfHistory: priors.length,
        delta: baseline == null ? null : current.minutes - baseline,
    };
}

/**
 * Subject → the minutes a normal week holds for it.
 *
 * ─── Why a MEDIAN of past weeks, and why past weeks only ────────────────────
 * The same reasoning as `weekPace`, for the same reason: one five-hour cram
 * before a SAC is not what a student "usually" does, and a mean lets it say
 * so. The CURRENT week is excluded because it is half-finished — counting a
 * Monday morning would drag every subject's usual toward nothing, and the
 * number is supposed to be the thing this week is measured against.
 *
 * A week the subject was not touched at all IS counted, as a zero, and that is
 * the opposite of the rule `weekPace` uses — deliberately. There, an empty
 * week means the student was not using the app and there is no evidence about
 * their pace; here, a week with study in it and none of it on Chemistry is
 * direct evidence about Chemistry. Skipping those would report a subject
 * touched once a month as its one good week.
 */
export function usualWeeklyMinutes(events = [], now = new Date()) {
    const list = Array.isArray(events) ? events : [];
    const thisMonday = weekStart(now);

    // Which past weeks the student was active at all. A student who joined
    // three weeks ago has no week before that, and reading those as zeroes
    // would say every subject is usually never studied.
    const weeks = [];
    for (let w = 1; w <= BASELINE_WEEKS; w += 1) {
        const start = new Date(thisMonday.getTime() - w * 7 * MS_DAY);
        const from = dayKey(start);
        const to = dayKey(new Date(start.getTime() + 6 * MS_DAY));
        const rows = list.filter((e) => e.day >= from && e.day <= to);
        if (rows.length) weeks.push(rows);
    }
    if (weeks.length < MIN_BASELINE_WEEKS) return new Map();

    const subjects = new Set(list.map((e) => e.subject).filter(Boolean));
    const out = new Map();
    subjects.forEach((subject) => {
        const perWeek = weeks.map((rows) => rows
            .filter((e) => e.subject === subject)
            .reduce((sum, e) => sum + e.minutes, 0));
        const sorted = perWeek.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2
            ? sorted[mid]
            : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        out.set(subject, median);
    });
    return out;
}
