/**
 * compliance assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/compliance.test.mjs
 *
 * EVERY FAILURE HERE IS A PERMISSION GRANTED TO SOMEBODY IT SHOULD NOT BE, and
 * none of them throws. A wrong band renders perfectly; a pixel firing for a
 * fifteen-year-old looks exactly like one firing for an adult. There is no
 * runtime signal for any of it, which is how the original state of this app —
 * policies promising guardian consent over a product that collected no age —
 * survived for months.
 *
 * The asymmetry that decides most of these: getting age wrong GENEROUSLY means
 * advertising to a child and putting a named minor on a public board. Getting
 * it wrong STRICTLY means an adult is asked their birthday. So every ambiguous
 * input — missing, malformed, future-dated, absurd — must land on the strict
 * side, and each one is asserted rather than left to the reader.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    MIN_AGE, SOCIAL_MIN_AGE, ADULT_AGE, BAND, CONSENT, CONSENT_KEY,
    ageFrom, ageBand, bandOfProfile,
    mayHoldAccount, mayAdTrack, maySeeSocial, needsGuardian, mayBeMarketSubject,
    readConsent, writeConsent, mayTrack,
} from "@/lib/compliance";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const NOW = new Date("2026-09-30T00:00:00Z");
/** A date of birth that makes somebody exactly `age` today. */
const bornFor = (age) => {
    const d = new Date(NOW);
    d.setFullYear(d.getFullYear() - age);
    return d.toISOString().slice(0, 10);
};

/* ── Age arithmetic ──────────────────────────────────────────────────────── */

check("a birthday is a CALENDAR comparison, not a division", () => {
    // 365.25 days per year puts somebody a day out, and the day it is wrong is
    // the day they turn 16 — the one day the answer changes.
    assert.equal(ageFrom("2010-09-30", NOW), 16, "on the birthday they are the new age");
    assert.equal(ageFrom("2010-10-01", NOW), 15, "the day before, they are not");
    assert.equal(ageFrom("2010-09-29", NOW), 16);
    // Month boundary, where an off-by-one month is easiest to write.
    assert.equal(ageFrom("2010-12-31", NOW), 15);
    assert.equal(ageFrom("2010-01-01", NOW), 16);
});

check("EVERY UNUSABLE DATE IS NULL, never a number", () => {
    for (const bad of [null, undefined, "", "not a date", "0000-00-00", NaN, {}, []]) {
        assert.equal(ageFrom(bad, NOW), null, `${JSON.stringify(bad)} produced an age`);
    }
    // A future date is bad data, and must not come back as a negative age that
    // then compares as "under 13" and refuses a real account for the wrong reason.
    assert.equal(ageFrom("2030-01-01", NOW), null);
    // And an absurd one must not be handed adult permissions.
    assert.equal(ageFrom("1850-01-01", NOW), null);
});

check("UNKNOWN IS A CHILD HERE, which is the opposite of the tour's rule", () => {
    // aceTour counts an unknown account age as OLD so 130 accounts are not
    // ambushed. The asymmetry runs the other way for this: unknown must deny.
    assert.equal(ageBand(null, NOW), BAND.UNKNOWN);
    assert.equal(ageBand(undefined, NOW), BAND.UNKNOWN);
    assert.equal(ageBand("rubbish", NOW), BAND.UNKNOWN);
    assert.equal(bandOfProfile({}, NOW), BAND.UNKNOWN);
    assert.equal(bandOfProfile(null, NOW), BAND.UNKNOWN);
    assert.equal(bandOfProfile({ extra: {} }, NOW), BAND.UNKNOWN);

    assert.equal(mayHoldAccount(BAND.UNKNOWN), false);
    assert.equal(mayAdTrack(BAND.UNKNOWN), false);
    assert.equal(maySeeSocial(BAND.UNKNOWN), false);
});

check("the three thresholds land on the right side of each birthday", () => {
    assert.equal(ageBand(bornFor(12), NOW), BAND.UNDER_MIN);
    assert.equal(ageBand(bornFor(13), NOW), BAND.CHILD, "13 is the first year an account is allowed");
    assert.equal(ageBand(bornFor(15), NOW), BAND.CHILD);
    assert.equal(ageBand(bornFor(16), NOW), BAND.TEEN, "16 is where the social surfaces open");
    assert.equal(ageBand(bornFor(17), NOW), BAND.TEEN);
    assert.equal(ageBand(bornFor(18), NOW), BAND.ADULT);
    assert.equal(ageBand(bornFor(40), NOW), BAND.ADULT);
    // The constants themselves, so a change to one is a deliberate act.
    assert.equal(MIN_AGE, 13);
    assert.equal(SOCIAL_MIN_AGE, 16);
    assert.equal(ADULT_AGE, 18);
});

/* ── Permissions ─────────────────────────────────────────────────────────── */

check("AN ACCOUNT UNDER 13 IS REFUSED, not quietly accepted", () => {
    assert.equal(mayHoldAccount(BAND.UNDER_MIN), false);
    for (const b of [BAND.CHILD, BAND.TEEN, BAND.ADULT]) assert.equal(mayHoldAccount(b), true);
});

check("ADVERTISING TRACKING STOPS AT 18, not at 16", () => {
    // The children's code means under-18. A 16-year-old is old enough for the
    // social floor and is still a child for advertising, and those two lines
    // being different numbers is the thing most likely to be collapsed later.
    assert.equal(mayAdTrack(BAND.CHILD), false);
    assert.equal(mayAdTrack(BAND.TEEN), false, "16 is NOT old enough to be ad-tracked");
    assert.equal(mayAdTrack(BAND.ADULT), true);
    assert.equal(mayAdTrack(BAND.UNDER_MIN), false);
});

check("the social floor opens at 16 and guardian consent runs to 18", () => {
    assert.equal(maySeeSocial(BAND.CHILD), false);
    assert.equal(maySeeSocial(BAND.TEEN), true);
    assert.equal(maySeeSocial(BAND.ADULT), true);

    assert.equal(needsGuardian(BAND.CHILD), true);
    assert.equal(needsGuardian(BAND.TEEN), true, "the policies drew this line at 18");
    assert.equal(needsGuardian(BAND.ADULT), false);
});

/* ── Being the subject of a market ───────────────────────────────────────── */

check("A MINOR IS NOT A MARKET SUBJECT BY DEFAULT, and an adult is", () => {
    // A default is a decision made on somebody's behalf. It is only fair to
    // make it for the people who can knowingly undo it.
    const at = (age, extra = {}) => ({ extra: { date_of_birth: bornFor(age), ...extra } });
    assert.equal(mayBeMarketSubject(at(17), NOW), false, "a 17-year-old was opted in by default");
    assert.equal(mayBeMarketSubject(at(16), NOW), false);
    assert.equal(mayBeMarketSubject(at(18), NOW), true);
    // Explicit choice wins in both directions.
    assert.equal(mayBeMarketSubject(at(17, { market_subject_opt_in: true }), NOW), true);
    assert.equal(mayBeMarketSubject(at(25, { market_subject_opt_in: false }), NOW), false);
});

check("SOMEBODY OFF THE FLOOR CANNOT BE TRADED, whatever they ticked", () => {
    // The under-16 gate is not a preference and an opt-in must not defeat it —
    // otherwise the one control a child can reach undoes the protection.
    const child = { extra: { date_of_birth: bornFor(14), market_subject_opt_in: true } };
    assert.equal(mayBeMarketSubject(child, NOW), false);
    // And an unknown age is never tradeable, which covers all ~130 existing
    // accounts until they answer.
    assert.equal(mayBeMarketSubject({ extra: { market_subject_opt_in: true } }, NOW), false);
    assert.equal(mayBeMarketSubject({}, NOW), false);
    assert.equal(mayBeMarketSubject(null, NOW), false);
});

/* ── Consent ─────────────────────────────────────────────────────────────── */

/** A localStorage stand-in, and one that throws the way a blocked one does. */
const memStore = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
const deadStore = () => ({
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
});

check("SILENCE IS NOT CONSENT, and neither is a broken localStorage", () => {
    assert.equal(readConsent(memStore()), CONSENT.UNSET);
    assert.equal(readConsent(deadStore()), CONSENT.UNSET, "a throw must read as unset, not granted");
    assert.equal(readConsent(null), CONSENT.UNSET);
    // A junk value is not a yes.
    const s = memStore();
    s.setItem(CONSENT_KEY, "yes please");
    assert.equal(readConsent(s), CONSENT.UNSET);
});

check("a choice round-trips, and an invalid one is refused outright", () => {
    const s = memStore();
    assert.equal(writeConsent(CONSENT.GRANTED, s), true);
    assert.equal(readConsent(s), CONSENT.GRANTED);
    assert.equal(writeConsent(CONSENT.DENIED, s), true);
    assert.equal(readConsent(s), CONSENT.DENIED, "a withdrawal must stick");
    assert.equal(writeConsent("maybe", s), false);
    assert.equal(readConsent(s), CONSENT.DENIED, "the invalid write did not overwrite the real one");
    assert.equal(writeConsent(CONSENT.GRANTED, deadStore()), false, "an unstorable choice reports failure");
});

check("TRACKING NEEDS BOTH CONSENT AND AN ADULT BAND, never either alone", () => {
    assert.equal(mayTrack({ consent: CONSENT.GRANTED, band: BAND.ADULT }), true);
    assert.equal(mayTrack({ consent: CONSENT.DENIED, band: BAND.ADULT }), false, "an adult who said no");
    assert.equal(mayTrack({ consent: CONSENT.UNSET, band: BAND.ADULT }), false, "nobody has been asked yet");
    assert.equal(mayTrack({ consent: CONSENT.GRANTED, band: BAND.TEEN }), false,
        "a 16-year-old ticking the box is not the consent the code is asking for");
    assert.equal(mayTrack({ consent: CONSENT.GRANTED, band: BAND.CHILD }), false);
    assert.equal(mayTrack({}), false, "no arguments at all must not track");
    assert.equal(mayTrack(), false);
});

check("AN ANONYMOUS VISITOR IS THE ONLY UNKNOWN THAT MAY TRACK", () => {
    // The marketing site has no account and no age to know, so consent alone
    // governs there. Once somebody is signed in, unknown means they have not
    // answered — which is a refusal, and `allowAnonymous` is not passed.
    assert.equal(mayTrack({ consent: CONSENT.GRANTED, band: BAND.UNKNOWN, allowAnonymous: true }), true);
    assert.equal(mayTrack({ consent: CONSENT.GRANTED, band: BAND.UNKNOWN }), false);
    assert.equal(mayTrack({ consent: CONSENT.DENIED, band: BAND.UNKNOWN, allowAnonymous: true }), false);
    // And the flag must never widen a known minor.
    assert.equal(mayTrack({ consent: CONSENT.GRANTED, band: BAND.CHILD, allowAnonymous: true }), false);
    // Truthy-but-not-true must not open it either.
    assert.equal(mayTrack({ consent: CONSENT.GRANTED, band: BAND.UNKNOWN, allowAnonymous: "yes" }), false);
});

/* ── The wiring, scanned ─────────────────────────────────────────────────── */

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const withoutComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

check("NOTHING LOADS A PIXEL AT MODULE SCOPE ANY MORE", () => {
    // The original bug, pinned where it happened: `initAnalytics()` was called
    // at the top level of main.jsx, so Meta and TikTok fired before React
    // rendered, before login and before anything could have been agreed.
    const main = withoutComments(read("src/main.jsx"));
    assert.ok(!/^\s*initAnalytics\(\)/m.test(main),
        "main.jsx calls initAnalytics() at module scope again — that fires before any consent");
});

check("every pixel loader is behind the consent gate", () => {
    const src = withoutComments(read("src/lib/analytics.js"));
    assert.ok(/from ["']@\/lib\/compliance["']/.test(src),
        "analytics.js no longer reads the consent model");
    // The three loaders must not be reachable without a gate in the same function.
    const init = src.match(/export function applyConsent[\s\S]{0,700}/)?.[0] || "";
    assert.ok(/mayTrack|readConsent/.test(init),
        "the loader entry point does not consult consent");
    for (const fn of ["loadMetaPixel", "loadTikTokPixel", "loadGA4"]) {
        assert.ok(init.includes(fn), `${fn} is not reached from the gated entry point`);
    }
});

console.log(`\ncompliance: ${passed} checks passed`);
