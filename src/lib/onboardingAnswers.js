/**
 * The wizard's answers: their shape, and where they are kept.
 *
 * EXTRACTED BECAUSE TWO CHUNKS NEED THEM AND ONLY ONE MAY BE EAGER. The
 * landing reel is in the first bundle (it is what an unauthenticated visitor
 * lands on) and the Onboarding page is lazy — so a static import of the page
 * from the reel would pull all 1,300 lines of it, plus the VCE catalogue and
 * the auth client, into the chunk every visitor parses before anything paints.
 *
 * Both surfaces read and write the SAME key, deliberately. A student who
 * answers two questions inside the reel, closes the tab and comes back to
 * /onboarding resumes exactly where they were, because there is one record of
 * what they said rather than two that have to be reconciled.
 *
 * `email` is load-bearing and is not a convenience: AuthContext matches it
 * against the signed-in user before applying anything, so the 7-day storage
 * window cannot leak one student's subjects onto another's account on a shared
 * school browser.
 */
export const STORAGE_KEY = "acedit_onboarding_v1";

export const DEFAULT_ANSWERS = {
    yearLevel:       null,
    subjects:        [],         // [{ name, code, id }]
    goalAtar:        null,
    goalCourseName:  "",
    goalUniversity:  "",
    intent:          null,       // "premium" | "free" — set on the sign-in step
    completedAt:     null,
    email:           null,       // set on the email+password path only
};

export function loadAnswers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_ANSWERS };
        return { ...DEFAULT_ANSWERS, ...JSON.parse(raw) };
    } catch {
        // Private window, blocked storage, or a half-written record. A fresh
        // start is always safe here; throwing would take the whole page down
        // on the one screen a visitor sees first.
        return { ...DEFAULT_ANSWERS };
    }
}

export function saveAnswers(answers) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); }
    catch { /* storage full or disabled — silent, by design */ }
}
