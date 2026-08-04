/**
 * studyIntent — today's declared intent, and what the app should do about it.
 *
 * The Dashboard's intent modal asks what today is for and writes the answer to
 * user_profiles.extra.daily_intent. This is the shared read, so every surface
 * acts on the same answer instead of each one re-deriving the shape — and so
 * the mode→technique→tool mapping lives in exactly one place.
 *
 * The mapping deliberately matches the advice the modal itself gives on the
 * plan screen. If cram mode tells a student to use active recall and quiz
 * themselves, the Study page had better open on Active Recall when they get
 * there, or the app is arguing with itself one screen later.
 */

export const INTENT_PLAN = {
    homework: {
        label: "Homework",
        // "Use the Pomodoro timer — 25 on, 5 off" / "Open AI Tools if you get stuck"
        technique: "pomodoro",
        tool: "concept_explainer",
        duration: 45,
        blurb: "you said homework",
    },
    cramming: {
        label: "Cramming",
        // "Use active recall — test yourself, don't just re-read"
        technique: "active_recall",
        tool: "exam_questions",
        duration: 60,
        blurb: "you said cramming",
    },
    free: {
        label: "Free study",
        // "Review flashcards" / "Use the Concept Explainer to dig into something"
        technique: "spaced_repetition",
        tool: "concept_explainer",
        duration: 25,
        blurb: "you said free study",
    },
};

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Today's intent, or null. Yesterday's answer is not today's — an intent that
 * outlived its day would quietly steer every page with a stale mode.
 */
export function todaysIntent(userProfile) {
    const raw = userProfile?.extra?.daily_intent;
    if (!raw?.mode || raw.date !== todayKey()) return null;
    const plan = INTENT_PLAN[raw.mode];
    if (!plan) return null;
    return { mode: raw.mode, duration: raw.duration || plan.duration, plan };
}
