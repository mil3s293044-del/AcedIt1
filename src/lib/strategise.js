/**
 * strategise — the rules an AI-drafted SAC plan has to obey.
 *
 * "Plan this week for me" asked for an hours budget and produced a scatter of
 * generic sessions. It knew nothing about what the student was actually
 * preparing for, so it couldn't sequence anything: the same plan came back
 * whether the SAC was tomorrow or in three weeks.
 *
 * Strategise is built around one logged assessment and works backwards from
 * its date. The model drafts the schedule because only it can read "I don't
 * understand titrations at all" and act on it; these rules then constrain the
 * draft, because a language model left alone will happily schedule five
 * blurting sessions in a row and forget the mock exam.
 *
 * The rules encode the study science the app already argues for elsewhere:
 * spacing beats cramming, retrieval beats re-reading, and you sit a timed
 * paper before the real one — not the night before.
 */

/** Everything Strategise is allowed to schedule, and what each is good for. */
export const TECHNIQUES = {
    pomodoro:          { label: "Focused block",     tab: "pomodoro",           phase: "learn",  blurb: "Learn or re-learn content you don't know yet" },
    concept_explainer: { label: "Concept explainer", tab: null, tool: true,     phase: "learn",  blurb: "Get a topic explained when you're stuck" },
    spaced_repetition: { label: "Flashcards",        tab: "spaced_repetition",  phase: "recall", blurb: "Lock in definitions and facts over days" },
    active_recall:     { label: "Active recall",     tab: "active_recall",      phase: "recall", blurb: "Answer questions from memory, not notes" },
    blurting:          { label: "Blurting",          tab: "blurting",           phase: "recall", blurb: "Brain-dump a topic, then find the gaps" },
    quiz:              { label: "Quiz",              tab: null, page: "/Quizzes", phase: "test", blurb: "Check yourself against marked questions" },
    exam:              { label: "Revision Mode",     tab: "exam",               phase: "test",  blurb: "A timed paper under real conditions" },
};

export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

/** Where a session lands in the run-up, as a fraction of days remaining. */
const PHASE_WINDOW = {
    // First half: close knowledge gaps. Middle: retrieve. Last quarter: test.
    learn:  [0, 0.55],
    recall: [0.15, 0.9],
    test:   [0.55, 1],
};

const dayKey = (d) => d.toISOString().slice(0, 10);

/** Every date from tomorrow to the SAC, inclusive of neither past nor SAC day. */
export function runUpDays(sacDate, from = new Date()) {
    const end = new Date(sacDate);
    const days = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() + 1);
    while (cur < end && days.length < 60) {
        days.push(dayKey(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}

/**
 * Constrain a drafted plan. Returns the repaired sessions plus a list of what
 * had to be changed, so the wizard can be honest about it rather than silently
 * rewriting the model's work.
 */
export function applyRules(sessions, { days, availableDays, minutesPerDay, confidence }) {
    const fixes = [];
    const allowed = new Set(days);
    const freeDays = new Set(availableDays?.length ? availableDays : days);

    let out = (sessions || [])
        .filter((s) => s && s.date && TECHNIQUE_IDS.includes(s.technique))
        .map((s) => ({
            ...s,
            duration: Math.max(15, Math.min(120, Number(s.duration) || 40)),
        }));

    // 1. Nothing outside the run-up, and nothing on a day they said they're busy.
    const before = out.length;
    out = out.filter((s) => allowed.has(s.date) && freeDays.has(s.date));
    if (out.length < before) fixes.push(`Dropped ${before - out.length} session${before - out.length === 1 ? "" : "s"} on days you're not free.`);

    // 2. Respect the daily budget — study you won't do isn't a plan.
    const byDay = {};
    out.forEach((s) => { (byDay[s.date] ||= []).push(s); });
    let trimmed = 0;
    Object.values(byDay).forEach((list) => {
        let used = 0;
        list.forEach((s) => {
            if (used + s.duration > minutesPerDay) {
                const room = Math.max(0, minutesPerDay - used);
                if (room < 15) { s._drop = true; trimmed++; }
                else { s.duration = room; }
            }
            used += s._drop ? 0 : s.duration;
        });
    });
    out = out.filter((s) => !s._drop);
    if (trimmed) fixes.push(`Trimmed ${trimmed} session${trimmed === 1 ? "" : "s"} to keep each day inside ${minutesPerDay} minutes.`);

    // 3. Phase discipline: learning early, retrieval through the middle,
    //    testing late. A mock exam on day one tests nothing.
    const total = days.length || 1;
    const posOf = (date) => days.indexOf(date) / Math.max(1, total - 1);
    let moved = 0;
    out.forEach((s) => {
        const [lo, hi] = PHASE_WINDOW[TECHNIQUES[s.technique].phase] || [0, 1];
        const pos = posOf(s.date);
        if (pos < lo || pos > hi) {
            const target = days[Math.round(((lo + hi) / 2) * (total - 1))];
            if (target && freeDays.has(target)) { s.date = target; moved++; }
        }
    });
    if (moved) fixes.push(`Resequenced ${moved} session${moved === 1 ? "" : "s"} so learning comes before testing.`);

    // 4. A timed paper before the real one. Non-negotiable.
    const lastFree = [...days].reverse().find((d) => freeDays.has(d));
    if (!out.some((s) => s.technique === "exam") && lastFree) {
        out.push({
            date: lastFree, technique: "exam", duration: Math.min(minutesPerDay, 45),
            topic: "Full timed run-through", why: "Sit it under real conditions before the real one.",
        });
        fixes.push("Added a timed Revision Mode paper — a plan without one hasn't tested anything.");
    }

    // 5. Low confidence means content is still missing; make sure something
    //    teaches it rather than only quizzing on what isn't there yet.
    if (confidence <= 2 && !out.some((s) => TECHNIQUES[s.technique].phase === "learn")) {
        const firstFree = days.find((d) => freeDays.has(d));
        if (firstFree) {
            out.unshift({
                date: firstFree, technique: "pomodoro", duration: Math.min(minutesPerDay, 45),
                topic: "Cover the content you flagged as shaky",
                why: "You said you don't know this well yet — retrieval needs something to retrieve.",
            });
            fixes.push("Added a content block up front — you can't recall what you haven't learnt.");
        }
    }

    out.sort((a, b) => a.date.localeCompare(b.date));
    return { sessions: out, fixes };
}

/** A plain-language summary of the shape of a plan. */
export function planSummary(sessions) {
    const mins = sessions.reduce((s, x) => s + (x.duration || 0), 0);
    const days = new Set(sessions.map((s) => s.date)).size;
    const kinds = new Set(sessions.map((s) => s.technique)).size;
    return { totalMinutes: mins, days, kinds, sessions: sessions.length };
}
