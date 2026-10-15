/**
 * termRunway — the next eight weeks of SACs, and whether any prep is planned
 * before each one.
 *
 * ─── THE PLANNER COUNTED DOWN TO ONE DATE AND COULD NOT SEE THE SECOND ──────
 * The hero was a countdown to the NEXT assessment, beautifully, and nothing
 * else: a Chemistry SAC in six days and a Methods test in nineteen were one
 * banner and a row in a list further down. So the question a student most
 * needs answered in a term — "is anything coming up that I have done nothing
 * about?" — had no screen. The week board shows seven days; the list shows
 * dates; neither shows a SAC beside the sessions planned before it.
 *
 * This is that view: one track, eight Monday-anchored weeks, every tracked SAC
 * pinned on its date, and the planned sessions for its subject drawn as ticks
 * in the run-up. A SAC inside a fortnight with no prep planned is FLAGGED,
 * because that is the one thing on the term a student can still change cheaply.
 *
 * ─── WHAT COUNTS AS PREP ──────────────────────────────────────────────────
 * A planned session for the SAME SUBJECT, dated inside the SAC's run-up: the
 * `PREP_WINDOW_DAYS` before it, cut short by an earlier SAC in that subject —
 * a session before the first Chemistry SAC is prep for THAT one, not for the
 * one after it, or every session would be claimed twice. Matched on the
 * subject field, then on the subject's name appearing in the session's title,
 * which is how a hand-typed "Chemistry: redox" carries it.
 *
 * Nothing is inferred beyond that. A session with no subject is not anybody's
 * prep — crediting it to the nearest SAC would tell a student a SAC was
 * covered by a session they planned for something else.
 *
 * ─── "NO PREP PLANNED" IS ONLY SAID WHEN IT IS TRUE AND WORTH SAYING ────────
 * Under `SOON_DAYS` — the same fortnight `studyQueue` calls soon, imported
 * rather than restated, so the runway and the queue cannot disagree about when
 * a SAC becomes something to act on. Seven weeks out with nothing planned is
 * a normal state of affairs, and flagging it would teach a student to ignore
 * the flag.
 *
 * Pure, and a `.js`, so the test can hold every one of these rules.
 */

import { dayKey, weekStart } from "@/lib/studyLog";
import { SOON_DAYS } from "@/lib/studyQueue";

export const RUNWAY_WEEKS = 8;
export const PREP_WINDOW_DAYS = 21;
/** Closer than this on the track and two pins share a lane at their peril. */
export const PIN_GAP = 0.12;
export const MAX_LANES = 3;

export { SOON_DAYS };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const asDay = (v) => {
    if (v instanceof Date) return dayKey(v);
    if (typeof v !== "string") return null;
    const d = v.slice(0, 10);
    return DAY_RE.test(d) ? d : null;
};
const shiftDays = (iso, n) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return dayKey(d);
};
const idx = (iso) => Math.round(new Date(`${iso}T00:00:00`).getTime() / 86400000);
export const daysFrom = (a, b) => idx(b) - idx(a);

const norm = (s) => String(s || "").trim().toLowerCase();

/** Is this planned session prep for this SAC's subject? */
export function isPrepFor(plan, sac) {
    const subject = norm(sac?.subject_name);
    if (!subject) return false;
    if (norm(plan?.subject_name)) return norm(plan.subject_name) === subject;
    return norm(plan?.title).includes(subject);
}

/**
 * The whole runway.
 *
 * `today` is a "YYYY-MM-DD" or a Date. Assessments that are done, dateless or
 * already past are not on it — a runway is about what is still to come.
 */
export function termRunway({ today, assessments = [], plans = [], weeks = RUNWAY_WEEKS } = {}) {
    const day0 = asDay(today) || dayKey(new Date());
    const from = dayKey(weekStart(new Date(`${day0}T00:00:00`)));
    const span = weeks * 7;
    const to = shiftDays(from, span - 1);
    const xOf = (iso) => (daysFrom(from, iso) + 0.5) / span;

    const upcoming = (Array.isArray(assessments) ? assessments : [])
        .filter((a) => a && !a.is_completed && asDay(a.due_date) && asDay(a.due_date) >= day0)
        .sort((a, b) => asDay(a.due_date).localeCompare(asDay(b.due_date)));

    const rows = (Array.isArray(plans) ? plans : []).filter((p) => asDay(p?.date));

    // Each SAC's run-up, cut short by the previous SAC in the same subject.
    const lastDueBySubject = new Map();
    const sacs = upcoming.map((sac) => {
        const due = asDay(sac.due_date);
        const key = norm(sac.subject_name);
        const prior = lastDueBySubject.get(key);
        lastDueBySubject.set(key, due);
        const windowFrom = prior && prior > shiftDays(due, -PREP_WINDOW_DAYS)
            ? shiftDays(prior, 1)
            : shiftDays(due, -PREP_WINDOW_DAYS);
        const prep = rows
            .filter((p) => {
                const d = asDay(p.date);
                return d >= windowFrom && d < due && isPrepFor(p, sac);
            })
            .sort((a, b) => asDay(a.date).localeCompare(asDay(b.date)));
        const done = prep.filter((p) => p.is_completed).length;
        const ahead = prep.filter((p) => !p.is_completed && asDay(p.date) >= day0).length;
        const daysOut = daysFrom(day0, due);
        return {
            sac,
            id: String(sac.id ?? `${key}:${due}`),
            due,
            daysOut,
            inView: due <= to,
            x: xOf(due),
            prep,
            planned: prep.length,
            done,
            ahead,
            // Planned and still to come, or already done — either is a plan.
            // A run-up made only of sessions that came and went undone is not.
            // And a SAC that is TODAY is never flagged: there is no session
            // left to plan before it, and a flag nobody can act on is a
            // verdict rather than a prompt.
            needsPrep: daysOut >= 1 && daysOut <= SOON_DAYS && done === 0 && ahead === 0,
        };
    });

    const inView = sacs.filter((s) => s.inView);

    // LANES. Pins closer than `PIN_GAP` would overlap, so a later one rises
    // into the next lane; past `MAX_LANES` they share, which is the honest
    // answer to four SACs in one week rather than a pin drawn off the panel.
    const laneEnds = [];
    for (const s of inView) {
        let lane = laneEnds.findIndex((end) => s.x - end >= PIN_GAP);
        if (lane === -1) lane = laneEnds.length < MAX_LANES ? laneEnds.length : inView.indexOf(s) % MAX_LANES;
        laneEnds[lane] = s.x;
        s.lane = lane;
    }

    const ticks = inView.flatMap((s) => s.prep
        .filter((p) => asDay(p.date) >= from)
        .map((p) => ({
            id: String(p.id ?? `${s.id}:${p.date}`),
            sacId: s.id,
            day: asDay(p.date),
            x: xOf(asDay(p.date)),
            done: !!p.is_completed,
            missed: !p.is_completed && asDay(p.date) < day0,
            subject: s.sac.subject_name,
        })));

    const weekMarks = Array.from({ length: weeks }, (_, w) => {
        const start = shiftDays(from, w * 7);
        return { start, x: (w * 7) / span, width: 7 / span, current: w === 0 };
    });

    return {
        from, to, span, today: day0,
        todayX: xOf(day0),
        weeks: weekMarks,
        sacs: inView,
        ticks,
        lanes: Math.max(1, laneEnds.length),
        later: sacs.filter((s) => !s.inView),
        next: sacs[0] || null,
        flagged: inView.filter((s) => s.needsPrep).length,
    };
}

const whenWord = (d) => (d === 1 ? "tomorrow" : `${d} days out`);

/**
 * The planner's headline: what the TERM says, never the countdown. The
 * runway's own header prints the next SAC's number at display size, so a
 * headline restating it was the same fact twice, one above the other.
 *
 * Every branch is counted off the runway, and the order is what a student can
 * still do something about: an unplanned SAC first, then reassurance that is
 * actually true, then the long view.
 */
export function runwayLead(r) {
    // Nothing tracked: the runway's own empty header makes the ask, with the
    // button, so the headline names the page rather than asking twice.
    if (!r || !r.next) return "Your week, and the term it's building toward.";
    const flagged = (r.sacs || []).filter((s) => s.needsPrep);
    if (flagged.length === 1) {
        const s = flagged[0];
        return `${s.sac.subject_name} is ${whenWord(s.daysOut)} and nothing is planned for it yet.`;
    }
    if (flagged.length > 1) return `${flagged.length} SACs in the next fortnight have no prep planned yet.`;
    const soon = (r.sacs || []).filter((s) => s.daysOut >= 1 && s.daysOut <= SOON_DAYS).length;
    if (soon === 1) return "The SAC inside the next fortnight has prep planned. Keep it that way.";
    if (soon > 1) return `All ${soon} SACs inside the next fortnight have prep planned.`;
    const total = (r.sacs || []).length + (r.later || []).length;
    if ((r.sacs || []).some((s) => s.daysOut <= 0)) return "Today's the SAC. Nothing else lands inside the next fortnight.";
    return `${total} ${total === 1 ? "assessment" : "assessments"} ahead and none inside a fortnight, which is the cheapest time to space the prep out.`;
}
