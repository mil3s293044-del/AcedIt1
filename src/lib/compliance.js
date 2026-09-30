/**
 * compliance — age, consent, and what the app is allowed to do with either.
 *
 * ─── THE POLICIES ALREADY PROMISED ALL OF THIS ──────────────────────────────
 * `Privacy.jsx` says "We only knowingly collect information from a student
 * where they are capable of giving consent, or where a parent or guardian has
 * consented", and `Terms.jsx` says a user under 18 may use the Service "only
 * with the knowledge and consent of a parent or guardian". Both have been
 * published for months. **The app collected no age and asked for no consent** —
 * there was no `date_of_birth` anywhere in the codebase, so neither sentence
 * could have been true of anybody.
 *
 * That is the exposure this module closes, and it is worth being precise about
 * which one: whether the Privacy Act binds a sole trader under the $3M
 * small-business threshold is arguable, but a published statement that the
 * product does not implement is a representation, and a representation that is
 * not true is misleading conduct under the Australian Consumer Law whatever the
 * Privacy Act says. The cheapest fix was never to soften the policy. It was to
 * make the product do what the policy already claimed.
 *
 * ─── THREE THRESHOLDS, AND THEY ARE NOT THE SAME NUMBER ─────────────────────
 *   13  `MIN_AGE` — below this the account is refused outright. VCE starts at
 *       about 15, so nobody legitimate is excluded, and 13 is the floor every
 *       comparable service keeps. Refusing is the only honest option: an app
 *       that quietly accepts a 10-year-old has collected a child's data before
 *       anybody can decide what to do about it.
 *   16  `SOCIAL_MIN_AGE` — Australia's social media minimum age. AcedIt's
 *       primary purpose is education, which the Rules exempt, so this is NOT
 *       used to refuse an account. It gates the SOCIAL surfaces specifically,
 *       which is the conservative reading and costs a 15-year-old nothing but
 *       the Compete floor.
 *   18  `ADULT_AGE` — the line the published policies already drew for
 *       guardian consent, and the line advertising tracking stops at.
 *
 * ─── UNKNOWN AGE IS TREATED AS A CHILD, WHICH IS THE OPPOSITE OF THE TOUR ───
 * `aceTour.js` counts an unknown account age as OLD, because getting that wrong
 * generously ambushes 130 existing accounts with a tutorial. Here the asymmetry
 * runs the other way: getting it wrong generously means advertising to a
 * fifteen-year-old, and getting it wrong strictly means an adult sees a prompt
 * asking for their birthday. So `UNKNOWN` denies every permission, and the ~130
 * existing accounts are asked once rather than grandfathered.
 *
 * ─── CONSENT IS OPT-IN, AND SILENCE IS NOT CONSENT ──────────────────────────
 * `initAnalytics()` ran at module load in `main.jsx` — before React rendered,
 * before login, before anything could have been agreed — so the Meta and TikTok
 * pixels fired on every visitor including every student. Nothing here loads
 * until somebody presses a button, a dismissed banner counts as a refusal, and
 * blocked or absent storage counts as a refusal too. The one direction this can
 * fail is toward not tracking, which costs a marketing number and nothing else.
 */

/* ── Ages ────────────────────────────────────────────────────────────────── */

export const MIN_AGE = 13;
export const SOCIAL_MIN_AGE = 16;
export const ADULT_AGE = 18;

export const BAND = {
    UNKNOWN: "unknown",
    UNDER_MIN: "under-min",     // < 13 — refused
    CHILD: "child",             // 13–15 — no social surfaces, no ad tracking
    TEEN: "teen",               // 16–17 — social allowed, still no ad tracking
    ADULT: "adult",             // 18+
};

/**
 * Whole years old today, or null when the date of birth is unusable.
 *
 * Built from calendar parts rather than a millisecond difference: a year is not
 * a fixed number of milliseconds, and dividing by 365.25 puts somebody's
 * birthday a day out, which on the day they turn 16 is the one day it matters.
 */
export function ageFrom(dob, now = new Date()) {
    if (!dob) return null;
    const d = dob instanceof Date ? dob : new Date(String(dob));
    if (Number.isNaN(d.getTime())) return null;
    // A birth date in the future is bad data, never a negative age.
    if (d.getTime() > now.getTime()) return null;
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    // Nobody using a VCE study app is 120. A value this far out is a typo or a
    // placeholder, and treating it as a real adult age would hand it every
    // permission this module grants.
    if (age < 0 || age > 120) return null;
    return age;
}

/** Which band a date of birth falls in. Unusable input is UNKNOWN, never ADULT. */
export function ageBand(dob, now = new Date()) {
    const age = ageFrom(dob, now);
    if (age === null) return BAND.UNKNOWN;
    if (age < MIN_AGE) return BAND.UNDER_MIN;
    if (age < SOCIAL_MIN_AGE) return BAND.CHILD;
    if (age < ADULT_AGE) return BAND.TEEN;
    return BAND.ADULT;
}

/** The band for a loaded profile row. Reads `extra.date_of_birth`. */
export function bandOfProfile(profile, now = new Date()) {
    return ageBand(profile?.extra?.date_of_birth, now);
}

/* ── What each band may do ───────────────────────────────────────────────── */

/** An account may exist at all. */
export function mayHoldAccount(band) {
    return band === BAND.CHILD || band === BAND.TEEN || band === BAND.ADULT;
}

/**
 * ADVERTISING TRACKING STOPS AT 18, not at 16.
 *
 * The incoming Children's Online Privacy Code is explicit that consent is
 * needed before children's personal information is used for targeted
 * advertising, and "child" there is under 18. Consent from a 15-year-old to be
 * tracked by Meta is not the consent that rule is asking for, so the honest
 * implementation is not to ask: no band under ADULT may be advertising-tracked,
 * whatever box was ticked. UNKNOWN is denied too.
 */
export function mayAdTrack(band) {
    return band === BAND.ADULT;
}

/**
 * The social surfaces — Compete, friends, leaderboards, markets.
 *
 * Gated at 16 on the conservative reading of the social media minimum age. The
 * education exemption very likely covers AcedIt, so this is a safety margin
 * rather than a concession, and it is one line to move if advice says so.
 */
export function maySeeSocial(band) {
    return band === BAND.TEEN || band === BAND.ADULT;
}

/** Under 18 needs a guardian to have agreed — the line the policies drew. */
export function needsGuardian(band) {
    return band === BAND.CHILD || band === BAND.TEEN;
}

/**
 * A NAMED STUDENT MAY ONLY BE THE SUBJECT OF A MARKET IF THEY ALLOWED IT.
 *
 * Compete auto-mints "Will <name> study 5+ days this week?" about students who
 * asked for nothing. The codebase already refuses to auto-mint SAC MARK markets
 * for exactly this reason and says so in its own words — that consent nobody
 * sought is not something a settlement can hand back. The same argument applies
 * to a study log; it was simply never applied.
 *
 * So: an adult is opted IN by default and may leave, and anybody under 18 is
 * opted OUT by default and must choose. That asymmetry is the whole point — a
 * default is a decision made on somebody's behalf, and it should only be made
 * on behalf of the people who can undo it knowingly.
 */
export function mayBeMarketSubject(profile, now = new Date()) {
    const band = bandOfProfile(profile, now);
    if (!maySeeSocial(band)) return false;            // not on the floor at all
    const choice = profile?.extra?.market_subject_opt_in;
    if (choice === true) return true;
    if (choice === false) return false;
    return band === BAND.ADULT;                       // unset: adults in, minors out
}

/* ── Tracking consent ────────────────────────────────────────────────────── */

export const CONSENT_KEY = "acedit.consent.v1";
export const CONSENT = { GRANTED: "granted", DENIED: "denied", UNSET: "unset" };

/**
 * What the visitor chose, from storage.
 *
 * A throw is a REFUSAL, not an error to report. Private browsing and blocked
 * storage are ordinary, and the same posture every other stored preference here
 * takes — except that the failure direction is chosen deliberately: an
 * unreadable choice must never read as consent.
 */
export function readConsent(storage) {
    try {
        const s = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
        const v = s?.getItem(CONSENT_KEY);
        return v === CONSENT.GRANTED || v === CONSENT.DENIED ? v : CONSENT.UNSET;
    } catch { return CONSENT.UNSET; }
}

/** Record a choice. Returns false when it could not be stored. */
export function writeConsent(value, storage) {
    if (value !== CONSENT.GRANTED && value !== CONSENT.DENIED) return false;
    try {
        const s = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
        s?.setItem(CONSENT_KEY, value);
        return true;
    } catch { return false; }
}

/**
 * The one question every tracking call asks: may this fire, right now?
 *
 * BOTH conditions, never either. Consent alone is not enough because a minor
 * cannot consent to this; an adult band alone is not enough because nobody has
 * agreed. `band` is UNKNOWN for a signed-out visitor, which is why the marketing
 * site can still measure: `allowAnonymous` is what the landing page passes,
 * where there is no account and no age to know. It is NOT passed once somebody
 * is signed in — at that point an unknown age means they have not answered yet,
 * and that is a refusal.
 */
export function mayTrack({ consent, band, allowAnonymous = false } = {}) {
    if (consent !== CONSENT.GRANTED) return false;
    if (band === BAND.UNKNOWN) return allowAnonymous === true;
    return mayAdTrack(band);
}

export default {
    MIN_AGE, SOCIAL_MIN_AGE, ADULT_AGE, BAND, CONSENT, CONSENT_KEY,
    ageFrom, ageBand, bandOfProfile,
    mayHoldAccount, mayAdTrack, maySeeSocial, needsGuardian, mayBeMarketSubject,
    readConsent, writeConsent, mayTrack,
};
