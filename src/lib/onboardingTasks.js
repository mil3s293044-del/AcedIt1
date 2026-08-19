/**
 * onboardingTasks — what setup a student genuinely still owes us.
 *
 * ─── The bug this exists to kill ────────────────────────────────────────────
 * Setup completion was read from three booleans on `onboarding_tasks`, and the
 * signup flow wrote exactly two of them. `subjects_selected` and `goals_set`
 * were set from the wizard answers; `username_set` was only ever written by the
 * Settings page. So every student who came through the funnel landed on their
 * dashboard and was told:
 *
 *     "Quick setup. Five minutes. Tell us who you are and what you're chasing."
 *
 * having just spent six screens telling us their year level, their subjects,
 * their ATAR target and their course — with a name already on the account from
 * signup. The card had no way to go away, because the flag it waited on was
 * never written by the path they took.
 *
 * ─── Why this derives instead of trusting the flags ─────────────────────────
 * A boolean that says work was done is a cache, and this one was stale for
 * every user who took the main route through the product. The underlying data
 * is right there on the profile — a name, subject rows, a goal — so each task
 * asks whether the THING exists, and treats the flag as a hint rather than the
 * truth. That also repairs every existing account on read, with no migration
 * and no backfill, the same way subject colours were fixed.
 */

const has = (v) => typeof v === "string" ? v.trim().length > 0 : !!v;

/**
 * Which of the three setup tasks are genuinely done.
 *
 * `hasSubjects` comes from the caller because subjects live in their own table
 * rather than on the profile; pass it when you know, omit it to fall back to
 * the stored flag.
 */
export function taskState(profile, { hasSubjects } = {}) {
    const p = profile || {};
    const flags = p.onboarding_tasks || {};
    return {
        // A name arrives from the auth provider at signup for most students;
        // the Settings page is only one of several ways to end up with one.
        username_set: !!(flags.username_set || has(p.username) || has(p.display_name) || has(p.full_name)),
        subjects_selected: !!(flags.subjects_selected || (hasSubjects ?? false)),
        goals_set: !!(flags.goals_set || has(p.goal_atar) || has(p.goal_course_name) || has(p.goal_university)),
    };
}

/** The task ids still outstanding, in the order they're worth doing. */
export function outstandingTasks(profile, ctx) {
    const state = taskState(profile, ctx);
    return ["username_set", "subjects_selected", "goals_set"].filter((k) => !state[k]);
}

/**
 * Should the setup nudge appear at all?
 *
 * `onboarding_completed` is the student's own dismissal and always wins — being
 * shown a task list you have explicitly finished is worse than being shown one
 * you have not started.
 */
export function needsSetup(profile, ctx) {
    if (!profile) return false;
    if (profile.onboarding_completed) return false;
    return outstandingTasks(profile, ctx).length > 0;
}

/**
 * Honest copy for however much is actually left.
 *
 * "Quick setup. Five minutes." in front of a single username field is the sort
 * of overclaim that teaches students to ignore the card.
 */
export function setupCopy(profile, ctx) {
    const left = outstandingTasks(profile, ctx);
    if (left.length === 0) return null;
    if (left.length === 1 && left[0] === "username_set") {
        return {
            title: "Pick a username",
            body: "It's the name that shows on leaderboards and call-outs. Everything else is set.",
        };
    }
    if (left.length === 1 && left[0] === "subjects_selected") {
        return {
            title: "Add your subjects",
            body: "Everything in here is organised by subject, so this is the one that unlocks the rest.",
        };
    }
    if (left.length === 1 && left[0] === "goals_set") {
        return {
            title: "Set a target",
            body: "Your dashboard measures distance to it. Without one there's nothing to measure against.",
        };
    }
    return {
        title: `${left.length} things left to set up`,
        body: "Quick ones. They tailor what the rest of the app shows you.",
    };
}
