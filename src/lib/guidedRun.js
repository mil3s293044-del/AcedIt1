/**
 * guidedRun — the walkthrough that hands a new student three finished things.
 *
 * ─── Why this is not a tour ─────────────────────────────────────────────────
 * The usage audit said the problem plainly. Students FIND the pages: SACs sat
 * at 80% reach. They get there and pick the passive half of every technique —
 * active recall, blurting and rebuild-a-map were all on zero, and every one of
 * them is one tab away from a timer people use daily. So a tour of the app
 * teaches the thing they already know (where the pages are) and skips the
 * thing they do not (that the harder option is the one that works).
 *
 * This walks them through the real UI and asks for one finished artifact per
 * step. Three steps, in the app, on their own subjects.
 *
 * ─── The one rule, borrowed wholesale from onboardingTasks ──────────────────
 * A step is done when the ROW EXISTS, never when a button was clicked. A
 * walkthrough you can complete without doing anything teaches nothing and then
 * lies to us about it in the metrics — and this one pays XP, so a step that
 * advanced on "Next" would be paying for a click. The evidence table below is
 * the whole contract; the component around it only navigates and points.
 *
 * That also means the run repairs itself. A student who came through the
 * signup wizard already has subjects, so step one is done before the run
 * starts and it opens on the quiz. Nobody is ever asked to redo something they
 * have already done, which is the failure that made the old setup card
 * unkillable.
 *
 * ─── Premium re-runs the engine, not the tour ───────────────────────────────
 * The moment someone pays is the highest-intent moment in the product, and
 * replaying the beginners' tour there reads as filler. Same machinery, a
 * different three steps, over the thing that just unlocked: understand it,
 * test yourself on it, prove you can explain it.
 */

/** Paid per step, on evidence. Deliberately small — the artifact is the point. */
export const STEP_XP = 40;
/** Paid once when the last step lands. */
export const FINISH_XP = 100;

const any = (v) => Array.isArray(v) && v.length > 0;
const technique = (d, name) =>
    any(d?.techniques) && d.techniques.some((t) => t?.technique_name === name);
/**
 * `tool_type` is whatever the tool wrote at the time and both spellings of
 * -ise/-ize are in the wild — same loose compare exploreProgress uses, for the
 * same reason: losing a student's history to a z would make us ask them to
 * redo work they finished last night.
 */
const tool = (d, id) =>
    any(d?.aiResults) && d.aiResults.some((r) =>
        String(r?.tool_type || "").toLowerCase().replace(/z/g, "s") === id.replace(/z/g, "s"));

/**
 * The free run. Setup, then a test, then the retrieval pass the audit says
 * nobody finds on their own.
 *
 * `target` is a selector into the real page. It is allowed to miss — pages
 * re-render and a step whose target has gone still works as a card, it just
 * stops pointing. `guidedRun.test.mjs` asserts each one exists in the page it
 * names, so a rename shows up as a failing test rather than as a mascot
 * standing in a corner.
 */
export const FREE_STEPS = [
    {
        id: "free_subjects",
        run: "free",
        page: "Subjects",
        to: "/Subjects",
        label: "Your subjects",
        ask: "Add the subjects you're actually doing this year.",
        why: "Almost everything in here is organised by subject, so this is the one that turns the rest on.",
        here: "New Subject is at the top right, or pick them out of the VCE list underneath.",
        target: '[data-run-target="subjects"]',
        file: "src/pages/Subjects.jsx",
        done: (d) => any(d?.subjects),
    },
    {
        id: "free_quiz",
        run: "free",
        page: "Quizzes",
        to: "/Quizzes",
        label: "A quiz, sat",
        ask: "Make a quiz on something you covered this week, then sit it.",
        why: "Making it is the easy half. Sitting it is the half that tells you what you actually know.",
        here: "AI Generate builds one from a topic or your notes. Create writes your own.",
        target: '[data-run-target="quizzes"]',
        file: "src/pages/Quizzes.jsx",
        // Strictly a SAT quiz, which is stricter than Explore's tick for the
        // same feature. Explore is answering "have you ever touched this";
        // this is asking for the rep, and a quiz that was generated and never
        // opened is not one.
        done: (d) => any(d?.quizAttempts),
    },
    {
        id: "free_recall",
        run: "free",
        page: "Study",
        to: "/Study?tab=active_recall",
        label: "One recall pass",
        ask: "Run one Active Recall pass on whatever you got wrong.",
        why: "Answering from memory beats reading it again, and this is where most students stop short.",
        here: "Active Recall is in Suggested today. Pick the topic the quiz caught you on.",
        target: '[data-run-target="active_recall"]',
        file: "src/pages/Study.jsx",
        done: (d) => technique(d, "active_recall") || any(d?.recallSessions),
    },
];

/** The premium run. Three tools, in the order they help. */
export const PREMIUM_STEPS = [
    {
        id: "premium_explain",
        run: "premium",
        page: "AITools",
        to: "/AITools?tool=concept_explainer",
        label: "Get it explained",
        ask: "Ask the Concept Explainer about the thing that made least sense in class.",
        why: "It answers at whatever depth you ask for, and it knows what VCE expects of the answer.",
        here: "Type the topic the way you'd say it out loud. Plain words are fine.",
        target: '[data-run-target="ai_tools"]',
        file: "src/components/ai_tools/UnifiedChat.jsx",
        done: (d) => tool(d, "concept_explainer"),
    },
    {
        id: "premium_exam",
        run: "premium",
        page: "AITools",
        to: "/AITools?tool=exam_questions",
        label: "Exam-shaped questions",
        ask: "Generate exam questions on a topic you have a SAC coming up in.",
        why: "Written to the real examiner's expectations for your subject, not generic practice.",
        here: "Same chat. Name the subject and the topic, and say how many marks you want them worth.",
        target: '[data-run-target="ai_tools"]',
        file: "src/components/ai_tools/UnifiedChat.jsx",
        done: (d) => tool(d, "exam_questions"),
    },
    {
        id: "premium_teach",
        run: "premium",
        page: "AITools",
        to: "/AITools?tool=teaching_assistant",
        label: "Teach it back",
        ask: "Explain that same topic back to Teach It Back and see what it marks you down for.",
        why: "Explaining is the hardest test of whether you have it, which is why it finds the gaps first.",
        here: "Say it in your own words. Half-finished sentences are the point — it works out what is missing.",
        target: '[data-run-target="ai_tools"]',
        file: "src/components/ai_tools/UnifiedChat.jsx",
        done: (d) => tool(d, "teaching_assistant"),
    },
];

export const RUNS = { free: FREE_STEPS, premium: PREMIUM_STEPS };
export const RUN_IDS = ["free", "premium"];

/** Every step in the app, for the tests and for a step lookup by id. */
export const ALL_STEPS = [...FREE_STEPS, ...PREMIUM_STEPS];
export const STEP_BY_ID = Object.fromEntries(ALL_STEPS.map((s) => [s.id, s]));

export const stepsFor = (runId) => RUNS[runId] || [];

/**
 * `preexisting` is the steps that were ALREADY done the moment the run opened.
 *
 * Without it, switching this on pays every existing account for work it did
 * months ago — most of the current users have subjects and have sat a quiz, so
 * they would each be handed 80 XP for logging in. The XP is for a rep performed
 * inside the walkthrough, so a step that was finished before it started gets
 * the tick and no payout.
 */
const blankRecord = () => ({
    status: "unstarted", started_at: null, completed_at: null, paid: [], preexisting: [],
});

/**
 * The stored state, normalised.
 *
 * Kept under `user_profiles.extra.guided_run` beside `daily_intent`, per run
 * rather than as one cursor, because premium arrives months after free and
 * must not overwrite the record of it.
 *
 * Anything unreadable normalises to unstarted rather than throwing. A profile
 * shape we did not expect should cost a student a walkthrough, never a page.
 */
export function readRuns(profile) {
    const raw = profile?.extra?.guided_run;
    const out = {};
    for (const id of RUN_IDS) {
        const rec = raw && typeof raw === "object" ? raw[id] : null;
        out[id] = rec && typeof rec === "object"
            ? {
                ...blankRecord(),
                ...rec,
                paid: Array.isArray(rec.paid) ? rec.paid : [],
                preexisting: Array.isArray(rec.preexisting) ? rec.preexisting : [],
            }
            : blankRecord();
    }
    return out;
}

export const runRecord = (profile, runId) => readRuns(profile)[runId] || blankRecord();

/**
 * Merge a patch for one run back into `extra`, without touching anything else
 * living there. `extra` also carries daily_intent, intent_log, attribution and
 * year_level, so this never rebuilds the object from scratch.
 */
export function withRunPatch(profile, runId, patch) {
    const extra = profile?.extra && typeof profile.extra === "object" ? profile.extra : {};
    const runs = readRuns(profile);
    return {
        ...extra,
        guided_run: { ...runs, [runId]: { ...runs[runId], ...patch } },
    };
}

/**
 * Where the student is in a run, derived from their rows.
 *
 * `activeIndex` is the first step with no evidence behind it — NOT a stored
 * cursor. A stored cursor drifts the moment someone does step three before
 * step two, and students do that constantly.
 */
export function runProgress(runId, data, record = blankRecord()) {
    const steps = stepsFor(runId).map((s) => {
        let done = false;
        try { done = !!s.done(data || {}); }
        catch { done = false; }  // an unexpected shape proves nothing
        return {
            ...s,
            done,
            paid: record.paid.includes(s.id),
            // Already finished when the run opened, so it counts toward
            // progress but is never paid for. See blankRecord.
            preexisting: record.preexisting.includes(s.id),
        };
    });
    const activeIndex = steps.findIndex((s) => !s.done);
    const doneCount = steps.filter((s) => s.done).length;
    return {
        runId,
        steps,
        doneCount,
        total: steps.length,
        activeIndex,
        active: activeIndex === -1 ? null : steps[activeIndex],
        complete: steps.length > 0 && activeIndex === -1,
    };
}

/**
 * Which run, if any, this student should be walking right now.
 *
 * Premium wins when it is owed — someone who has just paid should be shown
 * what they bought, not the beginners' run they may already have finished. A
 * run the student stopped stays stopped; they told us clearly enough.
 */
export function chooseRun(profile, { premium = false } = {}) {
    if (!profile) return null;
    const runs = readRuns(profile);
    const open = (id) => runs[id].status === "unstarted" || runs[id].status === "active";
    if (premium && open("premium")) return "premium";
    if (open("free")) return "free";
    return null;
}

/**
 * Should the card be on screen at all?
 *
 * Returns the run id, or null. A run whose steps are ALL already satisfied
 * never opens — a student who arrives having done everything gets nothing to
 * dismiss, and the caller marks it finished quietly.
 */
export function activeRun(profile, data, { premium = false } = {}) {
    const runId = chooseRun(profile, { premium });
    if (!runId) return null;
    if (!data) return null;  // nothing loaded yet proves nothing either way
    return runProgress(runId, data, runRecord(profile, runId)).complete ? null : runId;
}

/**
 * Steps finished but not yet paid for.
 *
 * Payment is idempotent server-side per event_key, so this exists to avoid
 * pointless calls rather than to guarantee correctness — the source of truth
 * for "already paid" is the xp_events row, not this list.
 */
export function unpaidSteps(runId, data, record = blankRecord()) {
    return runProgress(runId, data, record).steps
        .filter((s) => s.done && !s.paid && !s.preexisting);
}

/** The steps a run should record as already-done when it opens. */
export function preexistingSteps(runId, data) {
    return runProgress(runId, data).steps.filter((s) => s.done).map((s) => s.id);
}

/** The XP a step pays, with the last one in a run carrying the finish bonus. */
export function xpFor(stepId) {
    const step = STEP_BY_ID[stepId];
    if (!step) return 0;
    const steps = stepsFor(step.run);
    const last = steps[steps.length - 1]?.id === stepId;
    return STEP_XP + (last ? FINISH_XP : 0);
}

/** The event key a step's payout is idempotent on. */
export const eventKeyFor = (stepId) => `guided_run_${stepId}`;
