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
import { dayKey } from "./studyLog.js";

/**
 * The principles the plan is built on, with the work they come from. Every
 * rule below cites one of these, and every session carries the id of the
 * principle it applies — so the plan can show its reasoning instead of asking
 * the student to trust it.
 */
// Every claim below was checked against its source before being shown to a
// student. Where a finding is narrower than the popular version of it, the
// claim says so — an assured citation that overstates its paper is worse than
// no citation, because the reader can't tell the difference.
export const PRINCIPLES = {
    testing: {
        name: "Testing effect",
        // The delay qualifier is usually dropped, and it matters: in Roediger
        // & Karpicke's own data re-reading BEAT testing on a test five minutes
        // later. Testing only won at two days and one week.
        claim: "Retrieving beats re-reading when the test is days away — though re-reading wins if you're tested minutes later.",
        source: "Roediger & Karpicke, 2006, Psychological Science 17(3)",
    },
    spacing: {
        name: "Spacing effect",
        claim: "The same total study spread over days beats it massed into one sitting, and the further off the assessment, the wider the gaps should be.",
        source: "Cepeda, Pashler, Vul, Wixted & Rohrer, 2006, Psychological Bulletin 132(3)",
    },
    interleaving: {
        name: "Interleaving",
        // Retention and discrimination, not transfer — the old wording named
        // the wrong construct for this study.
        claim: "Mixing topics feels worse while you practise and holds up far better a week later — 60% vs 89% during practice, 63% vs 20% on the test.",
        source: "Rohrer & Taylor, 2007, Instructional Science 35(6)",
    },
    desirable: {
        name: "Desirable difficulty",
        claim: "Conditions that slow you down while learning — spacing, mixing, self-testing — tend to raise how much you still know later.",
        source: "Bjork & Bjork, 2011, Psychology and the Real World",
    },
    prerequisite: {
        name: "Cover it before you drill it",
        // Reworded and re-sourced. This used to read "you cannot practise
        // recalling material you have never actually learnt", cited to
        // Karpicke, Butler & Roediger 2009 — which is a survey of the study
        // strategies students choose and says nothing of the sort. The strong
        // claim is also wrong: unsuccessful retrieval attempts still help.
        // What the evidence supports is that the size of the benefit depends
        // on how hard the material is relative to what you already know.
        claim: "Retrieval practice pays off most on material you've already met — the harder it is relative to what you know, the smaller the gain.",
        source: "Minear, Coane et al., 2018, J. Exp. Psychol. LMC 44(9)",
    },
    metacognition: {
        name: "You will misjudge re-reading",
        // The finding the mis-citation above was reaching for, stated as what
        // its paper actually shows — and the real reason Strategise schedules
        // retrieval rather than "go over your notes".
        claim: "Asked how they study, most students name re-reading and rate it highly — the strategy the evidence keeps ranking last.",
        source: "Karpicke, Butler & Roediger, 2009, Memory 17(4)",
    },
    transfer: {
        name: "Transfer-appropriate processing",
        claim: "You remember best when practice matches the test, so practise timed, written and closed-book if that's the SAC.",
        source: "Morris, Bransford & Franks, 1977, JVLVB 16(5)",
    },
};

/** Everything Strategise is allowed to schedule, and what each is good for. */
export const TECHNIQUES = {
    pomodoro:          { label: "Focused block",     tab: "pomodoro",           phase: "learn",  principle: "prerequisite", blurb: "Learn or re-learn content you don't know yet" },
    concept_explainer: { label: "Concept explainer", tab: null, tool: true,     phase: "learn",  principle: "prerequisite", blurb: "Get a topic explained when you're stuck" },
    spaced_repetition: { label: "Flashcards",        tab: "spaced_repetition",  phase: "recall", principle: "spacing",      blurb: "Lock in definitions and facts over days" },
    active_recall:     { label: "Active recall",     tab: "active_recall",      phase: "recall", principle: "testing",      blurb: "Answer questions from memory, not notes" },
    blurting:          { label: "Blurting",          tab: "blurting",           phase: "recall", principle: "desirable",    blurb: "Brain-dump a topic, then find the gaps" },
    quiz:              { label: "Quiz",              tab: null, page: "/Quizzes", phase: "test", principle: "testing",      blurb: "Check yourself against marked questions" },
    exam:              { label: "Revision Mode",     tab: "exam",               phase: "test",  principle: "transfer",      blurb: "A timed paper under real conditions" },
};

export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

/** Where a session lands in the run-up, as a fraction of days remaining. */
const PHASE_WINDOW = {
    // First half: close knowledge gaps. Middle: retrieve. Last quarter: test.
    learn:  [0, 0.55],
    recall: [0.15, 0.9],
    test:   [0.55, 1],
};

/**
 * A run-up day is LOCAL. This was `toISOString().slice(0, 10)`, which is UTC:
 * in Melbourne every local midnight is the previous afternoon in UTC, so the
 * "tomorrow" the loop starts on printed as TODAY and the run-up quietly
 * included a day the student had already half spent. A test in a UTC
 * container could never see it — `strategise.test.mjs` pins the zone itself.
 */
const localDay = (iso) => new Date(`${iso}T00:00:00`);

/**
 * What survives when a day can't hold everything. The timed paper is the one
 * session the rules promise unconditionally, so it claims its minutes first.
 */
const PRIORITY = (s) => (s.technique === "exam" ? 0 : 1);

/**
 * Each day's own budget. The page used to hand this the SMALLEST minutes the
 * student set anywhere and apply it to every day — "so a generous day can't
 * justify overrunning a short one" — which was the right worry and the wrong
 * fix: one 20-minute Wednesday capped a 90-minute Saturday at 20, and the plan
 * came back far thinner than the days the student had just laid out. A day's
 * ceiling is that day's minutes, and nothing borrows across.
 */
const budgetFor = (minutesByDay, minutesPerDay) => (date) => {
    const own = Number(minutesByDay?.[date]);
    if (Number.isFinite(own) && own > 0) return own;
    const flat = Number(minutesPerDay);
    return Number.isFinite(flat) && flat > 0 ? flat : 60;
};

/** Minutes already committed on a given date. */
const byDayMinutes = (sessions, date) =>
    sessions.filter((s) => s.date === date).reduce((n, s) => n + (s.duration || 0), 0);

/** The longest run-up the page will lay out, in days. */
export const MAX_RUNUP = 60;

/** Every date from tomorrow to the SAC, inclusive of neither past nor SAC day. */
export function runUpDays(sacDate, from = new Date()) {
    const iso = typeof sacDate === "string" ? sacDate.slice(0, 10) : null;
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return [];
    const end = localDay(iso);
    const days = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() + 1);
    while (cur < end && days.length < MAX_RUNUP) {
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
export function applyRules(sessions, { days, availableDays, minutesPerDay, minutesByDay, confidence }) {
    const fixes = [];
    const budget = budgetFor(minutesByDay, minutesPerDay);
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
    Object.entries(byDay).forEach(([date, list]) => {
        let used = 0;
        const cap = budget(date);
        list.forEach((s) => {
            if (used + s.duration > cap) {
                const room = Math.max(0, cap - used);
                if (room < 15) { s._drop = true; trimmed++; }
                else { s.duration = room; }
            }
            used += s._drop ? 0 : s.duration;
        });
    });
    out = out.filter((s) => !s._drop);
    if (trimmed) fixes.push(`Trimmed ${trimmed} session${trimmed === 1 ? "" : "s"} to keep each day inside the minutes you gave it.`);

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
            date: lastFree, technique: "exam", duration: Math.min(budget(lastFree), 45),
            topic: "Full timed run-through", why: "Sit it under real conditions before the real one.",
            principle: "transfer",
        });
        fixes.push("Added a timed Revision Mode paper — you should meet the format before it counts (transfer-appropriate processing).");
    }

    // 5. Low confidence means content is still missing; make sure something
    //    teaches it rather than only quizzing on what isn't there yet.
    if (confidence <= 2 && !out.some((s) => TECHNIQUES[s.technique].phase === "learn")) {
        const firstFree = days.find((d) => freeDays.has(d));
        if (firstFree) {
            out.unshift({
                date: firstFree, technique: "pomodoro", duration: Math.min(budget(firstFree), 45),
                topic: "Cover the content you flagged as shaky",
                why: "You said you don't know this well yet — retrieval needs something to retrieve.",
                principle: "prerequisite",
            });
            fixes.push("Added a content block up front — retrieval practice needs something encoded first.");
        }
    }

    // 6. Spacing. A topic touched once is a topic half-learnt: every topic that
    //    appears in the retrieval phase should come back at least once, on a
    //    different day. Cepeda et al. (2006) — distributed beats massed.
    const retrieval = out.filter((s) => TECHNIQUES[s.technique].phase === "recall");
    const touches = {};
    retrieval.forEach((s) => { (touches[s.topic] ||= []).push(s); });
    let spaced = 0;
    Object.entries(touches).forEach(([topic, list]) => {
        if (list.length > 1) return;
        const first = list[0];
        const firstIdx = days.indexOf(first.date);
        // Come back to it at least two days later, if there's room in the budget.
        const revisit = days.find((d, i) => i >= firstIdx + 2 && freeDays.has(d)
            && (byDayMinutes(out, d) + 20) <= budget(d));
        if (revisit) {
            out.push({
                date: revisit, technique: "spaced_repetition", duration: 20,
                topic, why: `Second pass on ${topic} — spacing it out is what makes it stick.`,
                principle: "spacing",
            });
            spaced++;
        }
    });
    if (spaced) fixes.push(`Added ${spaced} spaced second pass${spaced === 1 ? "" : "es"} — one exposure to a topic isn't learning it.`);

    // 7. Interleaving. Three days of the same technique in a row is blocking,
    //    which feels productive and transfers worse (Rohrer & Taylor, 2007).
    out.sort((a, b) => a.date.localeCompare(b.date));
    let varied = 0;
    for (let i = 2; i < out.length; i++) {
        const [a, b, c] = [out[i - 2], out[i - 1], out[i]];
        if (a.technique === b.technique && b.technique === c.technique) {
            const alt = TECHNIQUE_IDS.find((t) =>
                t !== c.technique && TECHNIQUES[t].phase === TECHNIQUES[c.technique].phase);
            if (alt) { c.technique = alt; c.principle = TECHNIQUES[alt].principle; varied++; }
        }
    }
    if (varied) fixes.push(`Varied ${varied} session${varied === 1 ? "" : "s"} — three of the same in a row is blocking, and it transfers worse.`);

    // 8. No brand-new content in the final stretch. Learning something for the
    //    first time the day before is the cramming this is meant to replace.
    const cutoff = Math.floor((days.length - 1) * 0.8);
    let converted = 0;
    out.forEach((s) => {
        if (TECHNIQUES[s.technique].phase === "learn" && days.indexOf(s.date) > cutoff) {
            s.technique = "active_recall";
            s.principle = "testing";
            s.why = "Too late to meet this cold — test what you've got instead.";
            converted++;
        }
    });
    if (converted) fixes.push(`Turned ${converted} late content block${converted === 1 ? "" : "s"} into retrieval — new material in the last days is cramming.`);

    // 9. Re-settle the day budget. Rules 3 and 6 move and add sessions after
    //    the first budget pass, which let them stack up on one date — the test
    //    for this produced the same session twice on the same day. Dedupe, then
    //    re-apply the ceiling over the final set.
    const seen = new Set();
    out = out.filter((s) => {
        const k = `${s.date}|${s.technique}|${s.topic}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    const finalByDay = {};
    out.forEach((s) => { (finalByDay[s.date] ||= []).push(s); });
    let spilled = 0;
    Object.entries(finalByDay).forEach(([date, list]) => {
        let used = 0;
        const cap = budget(date);
        // Claim the budget in priority order. Rule 4 calls the timed paper
        // non-negotiable, but this pass runs after it and used to bin it
        // whenever the last day was already full — which is precisely when it
        // happens, because rule 5's content block is unshifted to the front and
        // ate the budget first. Ordering here is what makes rule 4 true.
        [...list].sort((a, b) => PRIORITY(a) - PRIORITY(b)).forEach((s) => {
            if (used + s.duration <= cap) { used += s.duration; return; }
            // Push it to the next free day with room rather than binning it.
            const from = days.indexOf(date);
            const moveTo = days.find((d, i) => i > from && freeDays.has(d)
                && byDayMinutes(out.filter((x) => x !== s), d) + s.duration <= budget(d));
            if (moveTo) { s.date = moveTo; spilled++; return; }
            // Nowhere to go. Shrink it rather than lose it, if it's protected
            // and there's any room at all.
            const room = Math.max(0, cap - used);
            if (PRIORITY(s) === 0 && room >= 15) { s.duration = room; used += room; return; }
            s._drop = true;
        });
    });
    out = out.filter((s) => !s._drop);
    if (spilled) fixes.push(`Spread ${spilled} session${spilled === 1 ? "" : "s"} to a later day so no day is overloaded.`);

    // 10. Last line of defence on the timed paper. If every earlier rule has
    //     conspired to leave none — a very short run-up with a tight daily
    //     budget does it — make room by displacing the least important session
    //     on the last available day. A plan that never rehearses the format is
    //     not the plan this feature promises.
    if (lastFree && !out.some((s) => s.technique === "exam")) {
        const dayList = out.filter((s) => s.date === lastFree);
        const used = dayList.reduce((n, s) => n + s.duration, 0);
        let room = budget(lastFree) - used;
        while (room < 15 && dayList.length) {
            const victim = dayList.pop();
            out = out.filter((s) => s !== victim);
            room += victim.duration;
        }
        if (room >= 15) {
            out.push({
                date: lastFree, technique: "exam", duration: Math.min(room, 45),
                topic: "Full timed run-through",
                why: "Sit it under real conditions before the real one.",
                principle: "transfer",
            });
            fixes.push("Made room for a timed paper on the last day — meeting the format before it counts is the one thing worth displacing something for.");
        }
    }

    // Every session declares the principle it applies.
    out.forEach((s) => { s.principle ||= TECHNIQUES[s.technique].principle; });

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

// ─── The page's model ────────────────────────────────────────────────────────
//
// Everything below is what the one-screen Strategise page draws and sends.
// Pure, so `strategise.test.mjs` can hold the decisions the page used to make
// inline: which days are in the run-up, what a tap paints, which of the
// student's existing sessions a rebuild replaces, and what the model is told.

/**
 * What a day can be for. The student picks the aim; the model picks the
 * technique that serves it. Kept at this level so they are saying what they
 * want out of the day, not choosing features.
 */
export const AIMS = [
    { id: "learn", label: "Learn",     long: "Learn new content", hint: "Cover something I don't know yet" },
    { id: "drill", label: "Drill",     long: "Drill what I know", hint: "Flashcards, recall, make it stick" },
    { id: "weak",  label: "Weak spot", long: "Fix a weak spot",   hint: "Attack a topic I keep losing marks on" },
    { id: "test",  label: "Test",      long: "Test myself",       hint: "Questions or a timed run under pressure" },
    { id: "rest",  label: "Rest",      long: "Rest day",          hint: "No study — protect it" },
];
export const AIM_IDS = AIMS.map((a) => a.id);
export const aimOf = (id) => AIMS.find((a) => a.id === id) || AIMS[AIMS.length - 1];

export const MINUTE_STEPS = [20, 30, 45, 60, 90];
export const DEFAULT_MINUTES = 45;

export const CONFIDENCE = [
    { v: 1, label: "Barely started", hint: "Most of it is new to me" },
    { v: 2, label: "Shaky",          hint: "I've seen it, it hasn't stuck" },
    { v: 3, label: "Getting there",  hint: "Solid on some topics, not others" },
    { v: 4, label: "Pretty solid",   hint: "Mostly just need practice" },
];

// Transfer-appropriate processing: practice should look like the assessment.
export const SAC_FORMATS = [
    { id: "extended", label: "Extended response", prompt: "extended written responses — they need writing practice under time, not just recall" },
    { id: "short",    label: "Short answer",      prompt: "short-answer questions — precise recall and clear definitions matter most" },
    { id: "mcq",      label: "Multiple choice",   prompt: "multiple choice — discrimination between close alternatives matters most" },
    { id: "prac",     label: "Practical / data",  prompt: "practical or data analysis — interpreting results and applying method matters most" },
    { id: "mixed",    label: "A mix",             prompt: "a mix of question types" },
];

/**
 * The opening shape: learn early, drill through the middle, test late — and a
 * weak-spot stretch before the testing only when there IS a weak spot on
 * file, because a day aimed at "the topic I keep losing marks on" with no such
 * topic is a day the model has to invent a weakness for.
 *
 * A day carrying ANOTHER assessment opens as rest. Nobody revises Chemistry on
 * the afternoon of their Methods SAC, and a run-up that pretends otherwise is
 * the first thing a student has to correct.
 */
export function seedAims(days = [], { hasWeak = false, blocked = [] } = {}) {
    const busy = new Set(blocked);
    const n = days.length;
    const plan = {};
    days.forEach((d, i) => {
        const pos = i / Math.max(1, n - 1);
        const aim = busy.has(d) ? "rest"
            : pos < 0.3 ? "learn"
                : pos < 0.55 ? "drill"
                    : pos < 0.8 && hasWeak ? "weak"
                        : pos < 0.8 ? "drill"
                            : "test";
        plan[d] = { aim, minutes: DEFAULT_MINUTES };
    });
    return plan;
}

/**
 * One tap of the brush. Painting rest keeps the minutes the day had, so
 * painting it back restores them rather than resetting to the brush.
 */
export function paintDay(plan = {}, day, brush = {}) {
    if (!day) return plan;
    const aim = AIM_IDS.includes(brush.aim) ? brush.aim : "rest";
    const prev = plan[day] || { minutes: DEFAULT_MINUTES };
    const minutes = aim === "rest"
        ? prev.minutes || DEFAULT_MINUTES
        : (MINUTE_STEPS.includes(brush.minutes) ? brush.minutes : prev.minutes || DEFAULT_MINUTES);
    return { ...plan, [day]: { aim, minutes } };
}

/** The days in the run-up that are not rest, in order. */
export const studyDays = (days = [], plan = {}) =>
    days.filter((d) => plan[d] && plan[d].aim !== "rest");

/** What the footer prints: study days, minutes, rest days. */
export function runUpTotals(days = [], plan = {}) {
    const study = studyDays(days, plan);
    return {
        studyDays: study.length,
        minutes: study.reduce((s, d) => s + (plan[d]?.minutes || 0), 0),
        restDays: days.length - study.length,
    };
}

// ─── A plan belongs to ONE assessment, and says which ───────────────────────
//
// A Strategise plan is not stored as a plan: it is the StudyPlan rows that
// share a `[str:<id>]` tag. The id used to be eight random characters, so the
// only way back from a plan to its SAC was `activeStrategies`' guess — the
// soonest assessment in the same subject on or after the plan's last session —
// which is right until a student has two Chemistry SACs a fortnight apart.
//
// New ids carry the SAC: the first eight characters of its id, then a dash and
// a random tail. `planTags`' pattern already allows the dash, so nothing that
// reads the tag changes. Old ids still match through the guess, and ONLY
// through the guess: a new-style id is never handed to it, or a plan for the
// later SAC could be attributed to the earlier one and deleted by a rebuild.

const sacStem = (sacId) => String(sacId || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
const NEW_STYLE = /^([a-z0-9]{8})-[a-z0-9]+$/;

export function strategyIdFor(sacId, tail = Math.random().toString(36).slice(2, 8)) {
    const stem = sacStem(sacId);
    const t = String(tail).toLowerCase().replace(/[^a-z0-9]/g, "") || "x";
    return stem.length === 8 ? `${stem}-${t}` : t;
}

/** True only for a new-style id carrying this SAC. */
export function strategyIsFor(stratId, sacId) {
    const m = String(stratId || "").toLowerCase().match(NEW_STYLE);
    const stem = sacStem(sacId);
    return !!m && stem.length === 8 && m[1] === stem;
}

export const isNewStyleStrategy = (stratId) => NEW_STYLE.test(String(stratId || "").toLowerCase());

/**
 * The sessions a rebuild replaces: still to come, not ticked off, and from an
 * earlier plan for THIS assessment. Running Strategise twice used to stack a
 * second set of sessions on top of the first, so a student who changed their
 * mind about Saturday ended up with two Saturdays.
 *
 * What is done stays done and what is past stays past — a rebuild rewrites the
 * future, never the record. `legacy` is `activeStrategies`' output, used only
 * for old-style ids (see above).
 */
export function sessionsToReplace(plans = [], sacId, { today, legacy = [], stratIdOf } = {}) {
    if (!sacId || typeof stratIdOf !== "function") return [];
    const legacyIds = new Set(
        (legacy || []).filter((s) => s?.sac?.id === sacId && !isNewStyleStrategy(s.id)).map((s) => s.id));
    return (plans || []).filter((p) => {
        const id = stratIdOf(p);
        if (!id) return false;
        if (p.is_completed) return false;
        if (!p.date || (today && p.date < today)) return false;
        return strategyIsFor(id, sacId) || legacyIds.has(id);
    });
}

/**
 * What is already on the planner inside the run-up, by day — every subject,
 * because a Methods block on Thursday is exactly why Thursday is short. Rows a
 * rebuild is about to replace are left out: they are not "already planned",
 * they are what this screen is rewriting.
 */
export function existingByDay(plans = [], days = [], { exclude = [], minutesOf = () => null } = {}) {
    const inRun = new Set(days);
    const skip = new Set((exclude || []).map((p) => p.id));
    const out = {};
    for (const p of plans || []) {
        if (!p?.date || !inRun.has(p.date) || skip.has(p.id)) continue;
        (out[p.date] ||= []).push({
            id: p.id, title: p.title || "Study session", subject: p.subject_name || null,
            minutes: minutesOf(p), done: !!p.is_completed,
        });
    }
    return out;
}

/** Other assessments that fall inside the run-up, by day. */
export function otherSacsByDay(assessments = [], days = [], sacId) {
    const inRun = new Set(days);
    const out = {};
    for (const a of assessments || []) {
        const d = String(a?.due_date || "").slice(0, 10);
        if (!a || a.id === sacId || a.is_completed || !inRun.has(d)) continue;
        (out[d] ||= []).push(a);
    }
    return out;
}

/**
 * The prompt. Everything the model is told comes off the screen: the chips
 * that are ticked, the aims and minutes painted on the strip, and what was
 * already on the planner — so the plan cannot be built on something the
 * student was not shown, and the test can check each reaches it.
 */
export function planBrief({
    sac, confidence = 3, format = "mixed", evidence = [], days = [], plan = {}, existing = {},
} = {}) {
    const subject = sac?.subject_name || "their subject";
    const on = (evidence || []).filter((c) => c?.on);
    const topics = on.filter((c) => !c.context);
    const mark = on.find((c) => c.kind === "mark");
    const target = on.find((c) => c.kind === "target");
    const conf = CONFIDENCE.find((c) => c.v === confidence) || CONFIDENCE[2];
    const fmt = SAC_FORMATS.find((f) => f.id === format) || SAC_FORMATS[SAC_FORMATS.length - 1];

    const brief = studyDays(days, plan)
        .map((d) => `${d} — aim: ${aimOf(plan[d].aim).long} (${plan[d].minutes} min)`).join("\n");
    const busy = Object.entries(existing || {})
        .filter(([, list]) => list.length)
        .map(([d, list]) => `${d} — ${list.map((s) => `${s.subject || "study"}: ${s.title}${s.minutes ? ` (${s.minutes} min)` : ""}`).join("; ")}`)
        .join("\n");

    return `Turn a student's day-by-day aims into concrete study sessions for one assessment.

ASSESSMENT: ${sac?.title || "Assessment"} — ${subject} (${String(sac?.assessment_type || "SAC").toUpperCase()})
DATE: ${sac?.due_date || "not set"}
HOW WELL THEY KNOW IT: ${conf.label} — ${conf.hint}
FORMAT OF THE ASSESSMENT: ${fmt.prompt}
HOW THEY DID LAST TIME: ${mark ? mark.prompt : "no mark on record"}
WHAT THEY WANT: ${target ? target.prompt : "to do well"}

WHAT THEIR OWN WORK SAYS NEEDS ATTENTION (from their flashcards, mistake bank, quizzes and the study design — each confirmed by the student):
${topics.length ? topics.map((c) => `- ${c.prompt}`).join("\n") : "- nothing specific on record; infer the topics from the subject"}

THE DAYS THEY'VE PLANNED, AND WHAT EACH IS FOR:
${brief || "(none)"}

ALREADY ON THEIR PLANNER IN THOSE DAYS (other work — leave it alone, and keep that day's session light if it is busy):
${busy || "(nothing)"}

For each of those dates produce one session (two only if the minutes allow and it genuinely helps).
Honour the aim they chose for that day — it's their decision, not yours to override.
Pick the technique that serves it:
${TECHNIQUE_IDS.map((id) => `- ${id}: ${TECHNIQUES[id].blurb}`).join("\n")}

Rules:
- Never schedule a date that isn't listed above.
- Never exceed that day's stated minutes.
- Name a specific topic per session, taken from the list above wherever one fits. A "Fix a weak spot" day attacks one of those listed weaknesses BY NAME.
- "why" is one short sentence to the student about what that session buys them, naming the evidence when it came from the list ("you've dropped this criterion three times").
- Interleave the topics rather than blocking one topic for days.
- Match the practice to the format above — an extended-response SAC needs writing practice, not just recall.`;
}

/** The schema the model returns, shared so the page and the check-in agree. */
export const PLAN_SCHEMA = {
    type: "object",
    properties: {
        sessions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    date: { type: "string" },
                    technique: { type: "string", enum: TECHNIQUE_IDS },
                    topic: { type: "string" },
                    duration: { type: "number" },
                    why: { type: "string" },
                },
                required: ["date", "technique", "topic", "duration", "why"],
            },
        },
    },
    required: ["sessions"],
};
