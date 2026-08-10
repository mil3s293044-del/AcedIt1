/**
 * weekPlan — "Plan this week for me", built from what the student's own data
 * already says.
 *
 * ── WHY THIS EXISTS AGAIN ───────────────────────────────────────────────────
 * The original version asked for an hours budget and handed the whole problem
 * to a language model, which knew nothing about the student beyond a list of
 * subject names. It produced the same plausible scatter whether the SAC was
 * tomorrow or three weeks away, so it was replaced by Strategise.
 *
 * But Strategise starts from one logged assessment and works backwards from
 * its date. A student in week three of term with nothing imminent gets nothing
 * from it, and that is most weeks of the year. This fills that gap.
 *
 * ── WHY IT'S NOT AN AI CALL ─────────────────────────────────────────────────
 * The app now knows things it didn't when the first version was written: which
 * cards fall out of reach this week and when, how much of the month was
 * retrieval rather than review, which subject's memories keep collapsing, and
 * which subject hasn't been touched at all. Those answers are computed, not
 * guessed — so the plan is deterministic, instant, free, costs no AI quota,
 * and every session can name the evidence it came from.
 *
 * A session nobody can see the reason for is a session nobody trusts, and the
 * first version's real failure was that it could never explain itself.
 */
import { retentionOutlook } from "@/lib/retention";
import { retrievalShare, stabilityBySubject } from "@/lib/memoryAnalytics";

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);

/** Session titles must start with a type the planner board can route on. */
export const KIND = {
    flashcards: { prefix: "Flashcards", technique: "spaced_repetition" },
    recall:     { prefix: "Active recall", technique: "active_recall" },
    blurting:   { prefix: "Blurting", technique: "blurting" },
    quiz:       { prefix: "Quiz", technique: "quiz" },
    mock:       { prefix: "Revision Mode", technique: "exam" },
    focus:      { prefix: "Focused block", technique: "pomodoro" },
};

/** Ordered by how much they cost to ignore, not by how nice they'd be. */
export const REASONS = {
    slipping:   { id: "slipping",   rank: 1, label: "Cards about to slip" },
    assessment: { id: "assessment", rank: 2, label: "Assessment coming" },
    retrieval:  { id: "retrieval",  rank: 3, label: "Not enough retrieval" },
    unstable:   { id: "unstable",   rank: 4, label: "Memory not holding" },
    untouched:  { id: "untouched",  rank: 5, label: "Subject untouched" },
    balance:    { id: "balance",    rank: 6, label: "Keeping it even" },
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Every slot the week has room for, in date order.
 *
 * Days already at the per-day cap from EXISTING plans get no slots — the point
 * is to fill a week, not to double-book one the student has already filled.
 */
function openSlots({ weekStart, today, daysOff, maxPerDay, existingPlans, startTime }) {
    const busy = Object.create(null);
    for (const p of existingPlans || []) {
        if (!p?.date) continue;
        busy[p.date] = (busy[p.date] || 0) + 1;
    }
    const off = new Set(daysOff || []);
    const slots = [];
    for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const key = iso(d);
        // Never plan into the past. A Wednesday plan made on Wednesday still
        // gets Wednesday.
        if (key < iso(today)) continue;
        if (off.has(key) || off.has(DAY_KEYS[d.getDay()])) continue;
        const room = Math.max(0, maxPerDay - (busy[key] || 0));
        for (let s = 0; s < room; s++) {
            slots.push({
                date: key,
                // Two sessions on one day shouldn't start at the same minute.
                start: shiftTime(startTime, s * 90),
                index: s,
            });
        }
    }
    return slots;
}

function shiftTime(hhmm, addMinutes) {
    const [h, m] = String(hhmm || "16:00").split(":").map(Number);
    const total = Math.min(22 * 60, (Number.isFinite(h) ? h : 16) * 60 + (Number.isFinite(m) ? m : 0) + addMinutes);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * What this week actually needs, before it's fitted to the time available.
 * Each demand carries the evidence for itself so the UI never has to invent a
 * justification for a session it was handed.
 */
export function weekDemands({ subjects = [], assessments = [], flashcards = [], techniques = [], today = new Date() }) {
    const out = [];
    const names = subjects.map(s => s?.subject_name).filter(Boolean);

    // 1. Cards crossing out of reach inside the window. This is the only thing
    //    on the list with a deadline the student cannot see coming.
    const outlook = retentionOutlook(flashcards, { days: 7, now: +today });
    for (const s of outlook.subjects) {
        if (s.total < 5) continue;                    // a handful isn't a session
        const sessions = Math.min(3, Math.ceil(s.total / 40));
        for (let i = 0; i < sessions; i++) {
            out.push({
                reason: REASONS.slipping,
                subject: s.subject,
                kind: KIND.flashcards,
                topic: s.topics.slice(0, 2).join(", "),
                why: s.slipping > 0
                    ? `${s.slipping} card${s.slipping === 1 ? " has" : "s have"} already slipped past reliable recall`
                    : `${s.falling} card${s.falling === 1 ? "" : "s"} drop out of reach within 7 days`,
                evidence: `${s.total} at risk · about ${s.minutes} min to hold`,
                urgent: s.slipping > 0,
            });
        }
    }

    // 2. Anything assessed soon, weighted by how soon.
    const soon = (assessments || [])
        .filter(a => a && !a.is_completed && a.due_date)
        .map(a => ({ ...a, days: Math.round((Date.parse(a.due_date) - +today) / DAY) }))
        .filter(a => Number.isFinite(a.days) && a.days >= 0 && a.days <= 21)
        .sort((a, b) => a.days - b.days);
    for (const a of soon) {
        const n = a.days <= 3 ? 3 : a.days <= 7 ? 2 : 1;
        for (let i = 0; i < n; i++) {
            // A timed paper belongs in the run-up, not the night before, and
            // not before there's anything to test.
            const kind = a.days <= 7 && i === 0 ? KIND.mock : i === 1 ? KIND.recall : KIND.quiz;
            out.push({
                reason: REASONS.assessment,
                subject: a.subject_name,
                kind,
                topic: a.title,
                why: `${a.title} ${a.days === 0 ? "is today" : a.days === 1 ? "is tomorrow" : `is in ${a.days} days`}`,
                evidence: a.assessment_type ? `${a.assessment_type} · ${a.due_date}` : a.due_date,
                urgent: a.days <= 7,
                before: a.due_date,
            });
        }
    }

    // 3. Retrieval deficit. The most replicated finding in the literature, and
    //    the app teaches it everywhere without ever scheduling it.
    const share = retrievalShare(techniques);
    if (share.hasData && share.share != null && share.share < 0.5) {
        const busiest = share.byTechnique.find(t => !t.isRetrieval);
        for (let i = 0; i < (share.share < 0.3 ? 2 : 1); i++) {
            out.push({
                reason: REASONS.retrieval,
                subject: names[i % Math.max(1, names.length)] || null,
                kind: i === 0 ? KIND.blurting : KIND.recall,
                topic: "",
                why: `Only ${Math.round(share.share * 100)}% of your last month was retrieval practice`,
                evidence: busiest ? `${busiest.minutes}m of it was ${busiest.label}` : "",
                urgent: false,
            });
        }
    }

    // 4. The subject whose memories keep collapsing back to days.
    const stability = stabilityBySubject(flashcards);
    const weak = stability.weakest;
    if (weak && weak.medianInterval < 7 && weak.cards >= 5) {
        out.push({
            reason: REASONS.unstable,
            subject: weak.subject,
            kind: KIND.recall,
            topic: "",
            why: `${weak.subject} cards keep collapsing back to ${weak.medianInterval} days between reviews`,
            evidence: `${weak.cards} cards · strongest subject holds ${stability.strongest?.medianInterval ?? "—"} days`,
            urgent: false,
        });
    }

    // 5. Subjects that got no time at all in the last month.
    const touched = new Set((techniques || []).map(t => t?.subject).filter(Boolean));
    for (const name of names) {
        if (touched.has(name)) continue;
        out.push({
            reason: REASONS.untouched,
            subject: name,
            kind: KIND.focus,
            topic: "",
            why: `No ${name} logged in the last 28 days`,
            evidence: "",
            urgent: false,
        });
    }

    // 6. Whatever's left goes on keeping the week even.
    for (const name of names) {
        out.push({
            reason: REASONS.balance,
            subject: name,
            kind: KIND.recall,
            topic: "",
            why: `Keeping ${name} ticking over`,
            evidence: "",
            urgent: false,
        });
    }

    return out.sort((a, b) => (a.reason.rank - b.reason.rank) || (b.urgent - a.urgent));
}

/**
 * Fit the demands into the week the student says they have.
 *
 * Nothing here saves anything — it proposes, and the caller shows the list for
 * approval. That was the one part of the original worth keeping.
 */
export function planWeek({
    weekStart,
    today = new Date(),
    subjects = [],
    assessments = [],
    flashcards = [],
    techniques = [],
    existingPlans = [],
    hours = 6,
    sessionMinutes = 40,
    maxPerDay = 2,
    daysOff = [],
    startTime = "16:00",
} = {}) {
    const start = weekStart ? new Date(weekStart) : new Date(today);
    const slots = openSlots({ weekStart: start, today, daysOff, maxPerDay, existingPlans, startTime });
    const demands = weekDemands({ subjects, assessments, flashcards, techniques, today });

    const budget = Math.max(0, Math.round(hours * 60));
    const sessions = [];
    let spent = 0;
    // Don't put the same subject back-to-back on one day, and don't let one
    // subject eat the whole week — spacing is the point.
    const perDaySubject = Object.create(null);

    for (const d of demands) {
        if (spent + sessionMinutes > budget) { d.unplaced = true; continue; }
        const slot = slots.find(s => {
            if (s.taken) return false;
            if (d.before && s.date > d.before) return false;     // after the SAC is useless
            const key = `${s.date}::${d.subject || "any"}`;
            return !perDaySubject[key];
        });
        if (!slot) { d.unplaced = true; continue; }
        slot.taken = true;
        perDaySubject[`${slot.date}::${d.subject || "any"}`] = true;

        const label = d.topic ? `${d.kind.prefix}: ${d.topic}` : `${d.kind.prefix}: ${d.subject || "study"}`;
        sessions.push({
            id: `${slot.date}-${sessions.length}`,
            title: label,
            subject_name: d.subject || null,
            date: slot.date,
            start_time: slot.start,
            duration_minutes: sessionMinutes,
            technique: d.kind.technique,
            reason: d.reason.id,
            reasonLabel: d.reason.label,
            why: d.why,
            evidence: d.evidence,
            urgent: !!d.urgent,
            include: true,
        });
        spent += sessionMinutes;
    }

    sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_time.localeCompare(b.start_time)));

    // What it could NOT fit is worth saying, and counted rather than merely
    // flagged: fitting one of the three flashcard sessions the cards actually
    // need is not the same as fitting them, and a plan that reports it as
    // "covered" is lying by omission.
    const unmet = [];
    for (const d of demands) {
        if (!d.unplaced) continue;
        if (d.reason.rank > REASONS.retrieval.rank) continue;   // only the ones that cost to skip
        const found = unmet.find(u => u.reason === d.reason.id && u.subject === (d.subject || null));
        if (found) { found.count++; continue; }
        unmet.push({ reason: d.reason.id, label: d.reason.label, subject: d.subject || null, why: d.why, count: 1 });
    }

    return {
        sessions,
        unmet,
        minutes: spent,
        budget,
        slotsUsed: sessions.length,
        slotsAvailable: slots.length,
        hasData: demands.length > 0,
    };
}
