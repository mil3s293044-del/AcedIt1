/**
 * pricing assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/pricing.test.mjs
 *
 * The price is the one number in this app that can be wrong in DOLLARS. It was
 * typed into seventeen places across eleven files, and `TUTOR_HOURLY` /
 * `ACEDIT_WEEKLY` were each declared twice at the same value with nothing
 * importing either — the shape this codebase already fixed for the AI tool
 * count ("hand-written as three different numbers across five screens"), on a
 * figure that decides what a sixteen-year-old is charged.
 *
 * So the scan is the guard, the same way `megaUpload.test.mjs` keeps a second
 * copy of the page price from appearing. Comments are stripped first: this
 * module and three marketing components EXPLAIN the price in prose, and a file
 * documenting a figure must not fail the scan for it — the false positive
 * `fnResult.test.mjs` and `hookDeps.test.mjs` each had to learn, whose cheap
 * fix is deleting the sentence that says why.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    PREMIUM_WEEKLY_AUD, TUTOR_HOURLY_AUD, TRIAL_DAYS, priceLabel, weeksPerTutorHour,
} from "@/lib/pricing";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

/** Every .js/.jsx under src/, with comments removed. */
function sources() {
    const out = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { walk(full); continue; }
            if (!/\.jsx?$/.test(e.name)) continue;
            if (/\.test\.mjs$/.test(e.name)) continue;
            const raw = fs.readFileSync(full, "utf8");
            const code = raw
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
            out.push({ rel: path.relative(ROOT, full), raw, code });
        }
    };
    walk(SRC);
    return out;
}
const FILES = sources();

check("the scan reached the files that print the price", () => {
    // A walk that silently matched nothing passes forever.
    assert.ok(FILES.length > 200, `only ${FILES.length} sources found`);
    for (const rel of ["src/lib/pricing.js", "src/pages/Checkout.jsx", "src/pages/Landing.jsx"]) {
        assert.ok(FILES.some((f) => f.rel === rel), `${rel} is not in the walk`);
    }
});

check("priceLabel prints the receipt and the headline from one figure", () => {
    assert.equal(priceLabel(), `$${PREMIUM_WEEKLY_AUD}`);
    assert.equal(priceLabel({ currency: true }), `$${PREMIUM_WEEKLY_AUD} AUD`);
    assert.equal(priceLabel({ cents: true, currency: true }), `$${PREMIUM_WEEKLY_AUD.toFixed(2)} AUD`);
    // A total due has to show the cents or it does not read as a charge.
    assert.match(priceLabel({ cents: true }), /\.\d\d$/);
});

check("the tutor comparison is derived, not stated", () => {
    assert.equal(weeksPerTutorHour(), Math.round(TUTOR_HOURLY_AUD / PREMIUM_WEEKLY_AUD));
    assert.ok(weeksPerTutorHour() > 1, "an hour of tutoring must buy more than a week");
});

check("no file outside pricing.js states the weekly price as a figure", () => {
    const bad = [];
    for (const f of FILES) {
        if (f.rel === "src/lib/pricing.js") continue;
        // "$5", "$5/week", "$5.00", "$5 AUD" — a dollar sign and the price, not
        // part of a longer number (so $50 and $5000 are left alone) and NOT a
        // KaTeX span: LoadingQuiz answers "Solve $2x = 10$" with the option
        // "$5$", which is a maths delimiter either side of a numeral and has
        // nothing to do with money. A trailing `$` is the tell.
        const re = new RegExp(`\\$${PREMIUM_WEEKLY_AUD}(?![\\d$])`, "g");
        if (re.test(f.code)) bad.push(f.rel);
    }
    assert.deepEqual(bad, [], `these still type the price: ${bad.join(", ")}`);
});

check("no file outside pricing.js declares its own price constant", () => {
    const bad = [];
    for (const f of FILES) {
        if (f.rel === "src/lib/pricing.js") continue;
        if (/const\s+(ACEDIT_WEEKLY|TUTOR_HOURLY|PREMIUM_WEEKLY|WEEKLY_PRICE)\s*=\s*[\d.]/.test(f.code)) {
            bad.push(f.rel);
        }
    }
    assert.deepEqual(bad, [], `these declare a price of their own: ${bad.join(", ")}`);
});

check("no file hard-types the trial length as a figure", () => {
    // A TRIAL phrasing, not any seven-day quantity. The first draft matched
    // `\b7[- ]day` and reported five files, four of them correct code about
    // something else entirely — a 7-day STREAK, a 7-day onboarding staleness
    // window, cards falling out of reach within 7 days, the dashboard's run of
    // seven. A false positive is the direction that gets a good guard deleted,
    // and the fifth file really did still carry four trial figures, which the
    // noise is exactly what hides.
    const TRIAL_PHRASES = [
        `${TRIAL_DAYS}[- ]day free`,
        `free ${TRIAL_DAYS}[- ]day`,
        `${TRIAL_DAYS} days? free`,
        `free for ${TRIAL_DAYS} days?`,
        `${TRIAL_DAYS} days? completely free`,
        `(?:charge|refund|cancel)[^.\n]{0,30}\\b${TRIAL_DAYS} days?`,
        `\\b${TRIAL_DAYS} days?[^.\n]{0,30}(?:refund|trial)`,
        // "Cancel before day 7 and you pay nothing" — the trial length with no
        // "days" after it, which the first pass missed on two pages.
        `\\bday ${TRIAL_DAYS}\\b`,
        `trial_days:\\s*${TRIAL_DAYS}\\b`,
        `trial[_ ]?period[_ ]?days:\\s*${TRIAL_DAYS}\\b`,
    ];
    const re = new RegExp(TRIAL_PHRASES.join("|"), "i");
    const bad = FILES.filter((f) => f.rel !== "src/lib/pricing.js" && re.test(f.code))
        .map((f) => f.rel);
    assert.deepEqual(bad, [], `these hard-type the trial: ${bad.join(", ")}`);
});

/* ── The trial is advertised and not delivered ────────────────────────────
 *
 * Recorded as assertions rather than fixed, because which way to close it is a
 * pricing decision. `trial_active` and `trial_ends_at` are real columns, read
 * in four places and WRITTEN BY NOTHING; /Paywall is the only screen that asks
 * Stripe for a trial and has no inbound links; every reachable route to paying
 * goes through /Checkout, which sends none. These pin the facts so the day
 * somebody closes it, the test says which half they closed.
 */

check("exactly one screen asks Stripe for a trial, and we know which", () => {
    const senders = FILES.filter((f) => /trial_days:/.test(f.code)).map((f) => f.rel);
    assert.deepEqual(senders, ["src/pages/Paywall.jsx"],
        `the set of screens requesting a Stripe trial has changed: ${senders.join(", ")}`);
});

check("the server honours a trial only when a caller asks for one", () => {
    const server = fs.readFileSync(path.join(ROOT, "server.mjs"), "utf8");
    assert.match(server, /trial_period_days:\s*trial_days/,
        "stripeCheckout no longer passes the requested trial through");
    assert.match(server, /payment_method_types:\s*\["card"\]/,
        "checkout no longer collects a card — 'no card required' may now be true");
});

check("the app-side trial columns are still read by nobody who writes them", () => {
    const readers = FILES.filter((f) => /trial_ends_at/.test(f.code)).map((f) => f.rel);
    assert.ok(readers.length >= 3, "trial_ends_at has stopped being read — check isPremium");
    // A WRITE is an assignment or a patch key, never a comparison.
    const writers = FILES.filter((f) =>
        /trial_ends_at\s*[:=](?!=)/.test(f.code) && !/trial_ends_at\s*===/.test(f.code),
    ).map((f) => f.rel);
    assert.deepEqual(writers, [],
        `trial_ends_at now has a writer (${writers.join(", ")}) — the trial may be real; `
        + "update pricing.js's TRIAL_DAYS note and the CLAUDE.md section with it");
});

console.log(`\npricing: ${passed} checks passed`);
