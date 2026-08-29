/**
 * aceTour — Ace showing a brand-new student around, once.
 *
 * ─── What this is, and what it deliberately is not ──────────────────────────
 * A scripted tour. Six stops, Ace walks to each page and says what it is for,
 * Next moves on, Skip ends it. That is the whole machine.
 *
 * It is NOT an onboarding run: nothing here is gated on the student having
 * done something, nothing pays XP, and no step can be "failed". The version
 * that did all of that had a client library, a component, a server payout
 * source and six anchor attributes scattered through the pages, and every one
 * of those is a thing that can rot. A first session is worth a tour, not an
 * apparatus.
 *
 * ─── Why it can only ever fire for genuinely new accounts ───────────────────
 * There are ~130 existing accounts. A tour that fires for anyone "who has not
 * seen it" would ambush all of them on their next login, and they know where
 * the pages are. So eligibility is derived from the profile's own age rather
 * than from a flag we would have to backfill: a profile older than
 * TOUR_WINDOW_HOURS never starts one, and nothing is written to their row at
 * all. Same reasoning as onboardingTasks — the underlying data already answers
 * the question, so a boolean would only be a cache that can go stale.
 *
 * A tour already in progress resumes regardless of age. Someone who started it
 * and came back tomorrow should be able to finish it.
 */
import { PAGES } from "@/lib/aceKnowledge";

/** A profile older than this never gets offered the tour. */
export const TOUR_WINDOW_HOURS = 24;

/**
 * The six stops, then the sign-off back where they started.
 *
 * `page` keys into aceKnowledge's PAGES, which already carries the route,
 * the title and a one-line description used by Ace's other surfaces. The tour
 * adds `lead` — the reason to come back to this page — and takes everything
 * else from there, so the tour and the rest of Ace cannot drift apart.
 */
export const STOPS = [
    {
        id: "dashboard",
        page: "Dashboard",
        lead: "This is home. Every time you open AcedIt it works out what is worth doing today from what you have actually been doing, so it gets sharper the more you use it.",
    },
    {
        id: "subjects",
        page: "Subjects",
        lead: "Put your subjects in first. Your SAC and exam dates live in here too, and nearly every other screen reads from them.",
    },
    {
        id: "study",
        page: "Study",
        lead: "Six techniques doing six different jobs. Which one you want depends on what is going wrong — active recall for when you have read it twice and it still slips, blurting for finding the gaps while there is time to close them.",
    },
    {
        id: "quizzes",
        page: "Quizzes",
        lead: "Exam-shaped questions rather than flashcard-shaped ones. Write your own, or hand it your notes and it builds one, then it marks you on them.",
    },
    {
        id: "planner",
        page: "Goals",
        lead: "Your week laid out around the dates you are actually working towards. A SAC countdown changes as it gets closer, so you can see the whole run-up instead of just the day.",
    },
    {
        id: "help",
        page: "Help",
        lead: "Every feature with a line on what it does and when it is worth opening. It lives under Account, so it is here whenever you have lost the thread.",
    },
    {
        id: "signoff",
        page: "Dashboard",
        final: true,
        lead: "That is the tour. Pick one thing today rather than three — and I am in the corner whenever you want any of this again.",
    },
];

export const TOTAL_STOPS = STOPS.length;
/** The stops that teach something. The sign-off is not one of them. */
export const CONTENT_STOPS = STOPS.filter((s) => !s.final).length;

/**
 * A stop, with the title and route the PAGES map already holds.
 *
 * Only those two, not the description. `lead` below covers the same ground in
 * Ace's own voice, and rendering both put two near-identical sentences on top
 * of each other — "Six techniques doing six different jobs" twice, once from
 * each source. The value of reading from PAGES is that the ROUTE cannot drift
 * from the rest of the app, not that the prose gets written twice.
 */
export function stopAt(index) {
    const stop = STOPS[index];
    if (!stop) return null;
    const meta = PAGES[stop.page] || {};
    return {
        ...stop,
        index,
        title: meta.title || stop.page,
        route: meta.route || `/${stop.page}`,
    };
}

const blank = () => ({ status: "unstarted", stop: 0, started_at: null, finished_at: null });

/**
 * The stored state, normalised. Lives on `user_profiles.extra.ace_tour`,
 * beside daily_intent. Anything unreadable normalises to unstarted rather than
 * throwing — a profile shape we did not expect should cost a student a tour,
 * never a page.
 */
export function tourState(profile) {
    const raw = profile?.extra?.ace_tour;
    if (!raw || typeof raw !== "object") return blank();
    const stop = Number.isInteger(raw.stop) ? Math.max(0, Math.min(STOPS.length - 1, raw.stop)) : 0;
    return { ...blank(), ...raw, stop };
}

/**
 * Merge a patch back into `extra` without disturbing anything else living
 * there — daily_intent, intent_log, attribution and year_level are all in the
 * same object.
 */
export function withTourPatch(profile, patch) {
    const extra = profile?.extra && typeof profile.extra === "object" ? profile.extra : {};
    return { ...extra, ace_tour: { ...tourState(profile), ...patch } };
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
 * "start" for a brand-new account that has never seen it, "resume" for one
 * part-way through, null for everyone else.
 *
 * An unknown profile age is treated as OLD. Getting this wrong in the generous
 * direction means ambushing every existing account at once; getting it wrong
 * the other way means one student misses a tour.
 */
export function tourStatus(profile, { now = Date.now() } = {}) {
    if (!profile) return null;
    const state = tourState(profile);
    if (state.status === "done" || state.status === "skipped") return null;
    if (state.status === "active") return "resume";
    const age = profileAgeHours(profile, now);
    if (age == null || age > TOUR_WINDOW_HOURS) return null;
    return "start";
}
