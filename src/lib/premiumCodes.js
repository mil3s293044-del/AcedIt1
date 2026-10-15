// ════════════════════════════════════════════════════════════════════════════
// Premium codes — Premium for a set number of days, unlocked with a code and a
// name instead of a card. Built for the Year 10 program.
//
// Imported by BOTH server.mjs and the client, so it uses relative imports
// only (serverBoot.test.mjs): the server decides whether a code can be
// redeemed, the client draws the same answer.
//
// WHERE THE PREMIUM LIVES. A redemption is a row in `premium_code_redemptions`
// (migration 0041). `user_profiles.code_premium_until` is a DERIVED copy that a
// database trigger keeps equal to the latest unrevoked redemption — so blocking
// somebody is one edit in the Supabase table editor (set `revoked_at`), and the
// profile follows on its own. Nothing in the app writes the column, and a
// second trigger stops a student's own client from writing it either.
//
// IT IS NOT THE TRIAL. `trial_ends_at` is the Stripe trial, and pricing.test
// pins that nothing writes it. A code is a different promise and gets its own
// column, so neither can be mistaken for the other.
// ════════════════════════════════════════════════════════════════════════════

export const CODE_DAYS_DEFAULT = 21;
export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const CODE_MAX = 40;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Upper-case, no spaces. "year10 ace" and "YEAR10ACE" are the same code. */
export function normaliseCode(raw) {
    if (typeof raw !== "string") return "";
    return raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, CODE_MAX);
}

/** Trimmed, single-spaced, capped. The name is for us to manage the program. */
export function cleanName(raw) {
    if (typeof raw !== "string") return "";
    return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

/** Why a name cannot be used, or null. Letters required: "!!" is not a name. */
export function nameProblem(name) {
    const n = cleanName(name);
    if (n.length < NAME_MIN) return "Add your full name so we can match you to the program.";
    if (!/\p{L}/u.test(n)) return "Add your full name so we can match you to the program.";
    return null;
}

function future(value, now) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d > now ? d : null;
}

/** When code Premium ends, if it is still running. Null otherwise. */
export function codePremiumUntil(profile, now = new Date()) {
    return future(profile?.code_premium_until, now);
}

export function codePremiumActive(profile, now = new Date()) {
    return codePremiumUntil(profile, now) !== null;
}

/**
 * Can this account redeem this code? Pure, so the rules can be tested without
 * a database. `mine` is every redemption this account has, on any code.
 *
 * A REVOKED REDEMPTION ON ANY CODE REFUSES EVERY CODE. Blocking somebody who
 * is not in the program has to stick — otherwise they would simply type the
 * next code they hear about.
 */
export function redeemVerdict({ codeRow, mine = [], used = 0, now = new Date() }) {
    if (!codeRow) {
        return { ok: false, reason: "That code isn't valid. Check it and try again." };
    }
    if (codeRow.active === false) {
        return { ok: false, reason: "That code isn't active any more." };
    }
    if (codeRow.expires_at && !future(codeRow.expires_at, now)) {
        return { ok: false, reason: "That code has expired." };
    }
    if (mine.some((r) => r.revoked_at)) {
        return {
            ok: false,
            reason: "Codes can't be used on this account. If that seems wrong, contact support.",
        };
    }
    const same = mine.find((r) => r.code === codeRow.code);
    if (same) {
        const until = future(same.premium_until, now);
        return {
            ok: false,
            reason: until
                ? `You've already used this code. Premium runs until ${until.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}.`
                : "You've already used this code.",
        };
    }
    const max = codeRow.max_redemptions;
    if (max != null && Number(used) >= Number(max)) {
        return { ok: false, reason: "That code has been fully used." };
    }
    const days = Number(codeRow.days) > 0 ? Number(codeRow.days) : CODE_DAYS_DEFAULT;
    return { ok: true, days, premiumUntil: new Date(now.getTime() + days * DAY_MS) };
}
