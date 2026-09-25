/**
 * firstWin — the first session does ONE REAL THING.
 *
 * ─── Why this is not another tour ───────────────────────────────────────────
 * `aceTour` walks a new student past six pages and says what each is for. It
 * is a narrated slideshow: Ace talks, you press Next, nothing happens, and
 * nothing is yours at the end. You read the first two leads and press Next
 * through the rest — that is the SHAPE, not the copy, and no amount of
 * rewriting the leads fixes it.
 *
 * A richer version was built once and reverted (`be14756`), and the revert
 * note is the constraint on this one: it gated each step on evidence and paid
 * XP per step, across a client library, a component, a SERVER PAYOUT SOURCE
 * and six `data-run-target` anchors scattered through the pages. Every one of
 * those is a thing that rots. The idea was not the problem; the apparatus was.
 *
 * So this earns its engagement a different way: the student PRODUCES
 * something. Pick a subject, say what is going wrong, and the app builds them
 * three real exam questions, marks their answers, and shows what that did.
 * The quiz row, the attempt and any banked mistake are REAL and they stay —
 * which is the whole difference between a tutorial and a first win.
 *
 * ─── It is a CONDUCTOR, not a second quiz player ────────────────────────────
 * The sitting and the marking happen in the real `QuizPlayer`, reached by the
 * real route. That is not a shortcut, it is the point: the marking panel
 * already itemises criteria and already carries the "save this to your mistake
 * bank" button, so the two things hardest to discover in this app get taught by
 * being USED rather than described. A bespoke mini-player would be a second
 * copy of the surface this codebase has fixed four times.
 *
 * ─── What it teaches, and WHEN ─────────────────────────────────────────────
 * Four concepts, each attached to the moment it becomes true rather than
 * delivered as a lesson:
 *
 *   which technique  at the "what is going wrong" beat — the answer names the
 *                    technique that fits the problem they just described.
 *   chips            at the moment one is spent. The price is on screen BEFORE
 *                    the button, which is the rule megaUpload already keeps.
 *   the marking      by being marked, in the real panel.
 *   the ATAR         at the close, against what actually happened — see the
 *                    note on `closingFacts`, which refuses to invent a number.
 *
 * ─── Eligibility is DERIVED, never a flag ──────────────────────────────────
 * Same rule and same reasoning as `aceTour`: there are ~130 existing accounts
 * and a run that fires for anyone "who has not seen it" would ambush all of
 * them at once. A profile older than the window never starts one and nothing
 * is written to their row. An unknown age counts as OLD — getting this wrong
 * generously ambushes everybody, getting it wrong the other way costs one
 * student a first run.
 */
import { PRICE } from "@/lib/chips";

/** A profile older than this never gets offered a first run. */
export const WINDOW_HOURS = 24;

/** How many questions the first quiz has. */
export const QUESTION_COUNT = 3;

/** What generating that quiz costs, read from the one price list. */
export const GENERATE_FEATURE = "quiz_ai_gen";
export const GENERATE_PRICE = PRICE[GENERATE_FEATURE];

/**
 * The three problems, and the technique each one actually calls for.
 *
 * These are the words a student would use about their own subject, not the
 * names of our features — "I've read it twice and it still slips" rather than
 * "spaced repetition". The technique is the ANSWER, which is how the mapping
 * gets taught: they describe the problem, Ace names the tool.
 *
 * `technique` keys the Study page's own techniques, so following the advice
 * lands on the right screen. studyIntent.js makes the same promise for the
 * daily intent modal and says why at length: if the app recommends a technique
 * and then opens somewhere else, it is arguing with itself one screen later.
 */
export const PROBLEMS = [
    {
        id: "slips",
        label: "I read it, then it's gone",
        technique: "spaced_repetition",
        techniqueLabel: "Spaced repetition",
        answer: "Re-reading feels like learning because the words look familiar. Spaced repetition makes you produce it instead — and asks again right before you would have forgotten.",
    },
    {
        id: "gaps",
        label: "I don't know what I don't know",
        technique: "blurting",
        techniqueLabel: "Blurting",
        answer: "Then the job is finding the holes while there is time to fill them. Blurting is that: write everything you remember, and it marks what you left out.",
    },
    {
        id: "exam",
        label: "I know it until the exam",
        technique: "active_recall",
        techniqueLabel: "Active recall",
        answer: "The knowledge is there and the retrieval is not. That closes with real questions marked properly, not another read of the notes.",
    },
];

export const problemById = (id) => PROBLEMS.find((p) => p.id === id) || null;

/**
 * The beats. `quiz` is the one that leaves this component for the real
 * QuizPlayer, which is why the state has to survive a navigation.
 */
export const BEATS = ["subject", "problem", "build", "quiz", "close"];
export const beatIndex = (id) => BEATS.indexOf(id);

const blank = () => ({
    status: "unstarted",
    beat: "subject",
    subject: null,
    problem: null,
    quiz_id: null,
    started_at: null,
    finished_at: null,
});

/**
 * The stored state, normalised. Lives on `user_profiles.extra.first_win`,
 * beside `ace_tour` and `daily_intent`. Anything unreadable normalises to
 * unstarted rather than throwing — a profile shape we did not expect should
 * cost a student a first run, never a page.
 */
export function firstWinState(profile) {
    const raw = profile?.extra?.first_win;
    if (!raw || typeof raw !== "object") return blank();
    const beat = BEATS.includes(raw.beat) ? raw.beat : "subject";
    return { ...blank(), ...raw, beat };
}

/** Merge a patch into `extra` without disturbing anything else living there. */
export function withFirstWinPatch(profile, patch) {
    const extra = profile?.extra && typeof profile.extra === "object" ? profile.extra : {};
    return { ...extra, first_win: { ...firstWinState(profile), ...patch } };
}

/** Hours since the profile row was created, or null when we cannot tell. */
export function profileAgeHours(profile, now = Date.now()) {
    const raw = profile?.created_date || profile?.created_at;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) return null;
    return (now - t) / 3_600_000;
}

/**
 * "start" for a brand-new account, "resume" for one part-way through, null for
 * everyone else. A run already in progress resumes WHATEVER the account's age:
 * somebody who began it and came back tomorrow should be able to finish.
 */
export function firstWinStatus(profile, { now = Date.now() } = {}) {
    if (!profile) return null;
    const state = firstWinState(profile);
    if (state.status === "done" || state.status === "skipped") return null;
    if (state.status === "active") return "resume";
    const age = profileAgeHours(profile, now);
    if (age == null || age > WINDOW_HOURS) return null;
    return "start";
}

/**
 * How long a dashboard card offers the run back before the entry moves to Help.
 *
 * It is DOUBLE the window in which the run offers itself, which is the point:
 * the card exists for the student who met Ace on minute one and closed him,
 * and they will not come looking for it — it has to be in front of them on the
 * screen they land on. After that it stops being news and becomes reference,
 * and reference lives on Help with everything else this app can do.
 */
export const ENTRY_WINDOW_HOURS = 48;

/**
 * Whether the dashboard should offer the run back.
 *
 * Only when it is NOT about to open by itself — `firstWinStatus` is non-null
 * exactly while a run is pending or part-way through, and a card telling
 * somebody to start a thing that is already talking to them from the corner is
 * the app asking twice. So this fires for the two cases where a manual entry
 * is the ONLY way in: they finished or skipped it, or the 24-hour window shut
 * before they ever got to it.
 *
 * An unknown profile age counts as old and gets no card, the same direction
 * every other age check here errs in.
 */
export function showRunCard(profile, { now = Date.now() } = {}) {
    if (!profile) return false;
    if (firstWinStatus(profile, { now })) return false;
    const age = profileAgeHours(profile, now);
    return age != null && age <= ENTRY_WINDOW_HOURS;
}

/** A replay starts from scratch: the old subject and quiz are last time's. */
export const replayPatch = () => ({
    status: "active", beat: "subject",
    subject: null, problem: null, quiz_id: null,
    started_at: new Date().toISOString(), finished_at: null,
});

/**
 * THE TOUR WAITS FOR THIS. Both fire on a fresh account and both are Ace in
 * the corner; two of him talking over each other on somebody's first screen is
 * worse than either alone. The first run leads because it is the one that
 * produces something, and the tour — the map — is still there afterwards.
 */
export function tourShouldWait(profile) {
    return firstWinStatus(profile) !== null;
}

/**
 * A student can only start this on a subject they actually study.
 *
 * The signup wizard writes `user_subjects` at step two, so by the time this
 * runs there is normally a list. With NOTHING there is no first win to have —
 * inventing a subject to demo on would make the quiz fake, which is the one
 * thing this cannot be. The caller hands them to the tour instead.
 */
export function subjectChoices(userSubjects = []) {
    return (Array.isArray(userSubjects) ? userSubjects : [])
        .map((s) => ({ name: s?.subject_name, color: s?.color || null }))
        .filter((s) => typeof s.name === "string" && s.name.trim().length > 0);
}

export const canStart = (userSubjects) => subjectChoices(userSubjects).length > 0;

/**
 * WHAT THE CLOSE MAY CLAIM.
 *
 * The temptation here is "that's +0.4 ATAR" — a concrete, motivating number.
 * It would be INVENTED. The AcedIt ATAR is a trailing-28-day composite that is
 * UNRANKED under three study days, so a brand-new account does not have one
 * yet and nothing this student just did produced that figure. Printing it
 * teaches them, on their very first screen, that the numbers on this app are
 * decoration — after which the real ones do not land either. The dashboard
 * rail already refuses the same temptation for the same reason.
 *
 * So the close reports only what genuinely happened — their real score, the
 * real XP the attempt paid, and how many marks they dropped — and explains the
 * ATAR as a thing that STARTS from here rather than as a number it can quote.
 *
 * `dropped` is what unlocks the mistake-bank sentence, and it is never faked:
 * on a clean sweep there is nothing to bank and the close says something else.
 */
/**
 * How many questions dropped a mark, read off the attempt the player saved.
 *
 * This decides whether the close offers the mistake bank, so it REFUSES
 * rather than guesses. `extra.question_results` carries the per-criterion
 * verdicts the marking already produced; without them the honest answer is
 * that we cannot tell — except in the one case that is arithmetic rather than
 * inference, a score under 100, where at least one mark is definitely gone.
 */
export function droppedFrom(attempt) {
    const results = attempt?.extra?.question_results;
    if (Array.isArray(results) && results.length > 0) {
        const counted = results.filter((r) =>
            Array.isArray(r?.criteria) && r.criteria.some((c) => c && c.met === false)).length;
        if (counted > 0) return counted;
    }
    const score = attempt?.score;
    if (score === null || score === undefined || score === "") return 0;
    const n = Number(score);
    // `Number(null) === 0` again — filtered above, so a missing score is 0
    // dropped ("we cannot tell") rather than 0% ("you got everything wrong").
    return Number.isFinite(n) && n < 100 ? 1 : 0;
}

export function closingFacts({ score = null, xp = null, dropped = 0, daysToRank = 3 } = {}) {
    // `Number(null) === 0`, so coercing first turns "the marking never came
    // back" into a 0% printed at a student about work nobody graded. That trap
    // has now reached `criterionIndexFor`, `expiredKeys`, `markPercent`,
    // `standingOf` and this — and here it would land on the FIRST screen a new
    // account ever sees. Null and undefined are filtered before Number().
    const num = (v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const rawScore = num(score);
    const rawXp = num(xp);
    const pct = rawScore === null ? null : Math.round(rawScore);
    const gained = rawXp !== null && rawXp > 0 ? Math.round(rawXp) : null;
    const missed = Math.max(0, Math.round(num(dropped) ?? 0));
    return {
        score: pct,
        xp: gained,
        dropped: missed,
        /** Only offered when there is a real dropped mark behind it. */
        showMistakeBank: missed > 0,
        /**
         * Never a predicted ATAR. What the student gets is the rule: it reads
         * the last 28 days and needs a few of them before it will rank you.
         */
        atarLine: `Your AcedIt ATAR reads your last 28 days — how well you know it, consistency, hours, spread and planning. It stays unranked until you have studied on ${daysToRank} separate days. Today is day one.`,
    };
}
