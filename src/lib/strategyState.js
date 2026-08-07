/**
 * strategyState — reading the state of a live Strategise plan off the planner.
 *
 * A plan isn't stored as a plan. It's a set of StudyPlan rows sharing a
 * `[str:<id>]` tag, which means the truth about how it's going lives in the
 * same rows the student has been ticking off (or not) all week. This module
 * reconstructs the plan from those rows so the check-in can ask about the days
 * that have already passed and rewrite only the ones that haven't.
 *
 * Up-front planning without this is the failure mode the whole feature was
 * meant to avoid: a schedule that stops matching reality on day two and
 * teaches the student to ignore it.
 */
import { stratIdOf, durationOf, noteTextOf } from "@/lib/planTags";

/** Local yyyy-mm-dd — never `toISOString()`, which silently shifts the day. */
export const dayKey = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Group plan rows into the Strategise plans they belong to.
 *
 * Returns one entry per `[str:]` id, newest deadline first:
 *   { id, sac, sessions, past, future, overdue, done, total, isLive }
 *
 * `overdue` is the part the check-in asks about: sessions dated before today
 * that were never ticked off. `isLive` means there are still future sessions
 * worth rewriting — a plan whose last day has passed is history, not a plan.
 */
export function activeStrategies(plans = [], assessments = [], today = dayKey()) {
    const groups = new Map();
    for (const p of plans) {
        const id = stratIdOf(p);
        if (!id) continue;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(p);
    }

    const out = [];
    for (const [id, sessions] of groups) {
        const sorted = [...sessions].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        const past = sorted.filter(s => s.date < today);
        const future = sorted.filter(s => s.date >= today);
        const overdue = past.filter(s => !s.is_completed);

        // The SAC this plan is for: the soonest uncompleted assessment in the
        // same subject that falls on or after the plan's last session. Matching
        // on subject alone picked up assessments the plan had nothing to do with.
        const lastDate = sorted[sorted.length - 1]?.date || today;
        const subject = sorted.find(s => s.subject_name)?.subject_name || null;
        const sac = assessments
            .filter(a => !a.is_completed && a.due_date && a.due_date >= lastDate
                && (!subject || a.subject_name === subject))
            .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null;

        out.push({
            id, sac, subject,
            sessions: sorted, past, future, overdue,
            done: sorted.filter(s => s.is_completed).length,
            total: sorted.length,
            isLive: future.length > 0 && (!sac || sac.due_date >= today),
        });
    }
    return out.sort((a, b) => (a.sac?.due_date || "9999").localeCompare(b.sac?.due_date || "9999"));
}

/**
 * Every plan that wants a check-in, soonest deadline first.
 *
 * Plural because students run more than one at a time — a Chemistry SAC and a
 * Specialist Maths SAC in the same fortnight is the normal case, not the edge
 * one, and surfacing only the most urgent left the other silently rotting.
 *
 * Only plans with something to report AND something left to change appear.
 * Nagging someone about a plan they can no longer alter is noise.
 */
export function strategiesNeedingCheckIn(plans, assessments, today = dayKey()) {
    return activeStrategies(plans, assessments, today)
        .filter(s => s.isLive && s.past.length > 0);
}

/** The single most urgent one, for callers that only have room for one. */
export function strategyNeedingCheckIn(plans, assessments, today = dayKey()) {
    return strategiesNeedingCheckIn(plans, assessments, today)[0] || null;
}

/** One line per past session, for the model to read. */
export function describeOutcomes(strategy, outcomes) {
    return strategy.past.map(s => {
        const verdict = outcomes[s.id] || (s.is_completed ? "done" : "skipped");
        return `${s.date} — "${s.title}" (${durationOf(s) || 40} min planned): ${verdict}`;
    }).join("\n");
}

/** One line per remaining session, so the model rewrites rather than invents. */
export function describeRemaining(strategy) {
    return strategy.future.map(s =>
        `${s.date} — "${s.title}" (${durationOf(s) || 40} min)${noteTextOf(s) ? ` — ${noteTextOf(s)}` : ""}`,
    ).join("\n");
}

/**
 * How the plan is tracking, in the plainest terms available. Drives the
 * check-in's headline so it can lead with the truth rather than a greeting.
 */
export function strategyStanding(strategy) {
    const { past, overdue } = strategy;
    if (past.length === 0) return { tone: "ok", text: "Nothing due yet." };
    const kept = past.length - overdue.length;
    if (overdue.length === 0) return { tone: "good", text: `${kept}/${past.length} done so far. Dead on plan.` };
    if (kept === 0) {
        return {
            tone: "bad",
            text: past.length === 1
                ? "The first session didn't happen. Worth rebuilding around what's actually left."
                : `None of the first ${past.length} got done. Worth rebuilding around what's actually left.`,
        };
    }
    return { tone: "warn", text: `${kept}/${past.length} done — ${overdue.length} slipped.` };
}
