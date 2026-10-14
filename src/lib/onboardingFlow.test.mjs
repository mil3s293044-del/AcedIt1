/**
 * onboarding flow assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/onboardingFlow.test.mjs
 *
 * The wizard is the first thing a new student reads, and every figure on it is
 * a promise the rest of the app has to keep. So these check what it SAYS
 * against the things it says it is reading — the scheduler, the catalogue, the
 * calendar, the ladder — and that a missing answer drops a line rather than
 * printing a hole.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    STEPS, stepsFor, STEP_NAME, weeksUntilExams, reviewLadder, REVIEW_LADDER,
    reviewDates, formatReviewDates, scalingFor, shortSubject, SHORT_MAX, YEARS,
    yearOf, handFrom, personalLine, aceLines, buildLines, revealFacts, formatAtar, prevStep,
} from "@/lib/onboardingFlow";
import { calculateNextReview } from "@/lib/sm2";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { scalingOf } from "@/lib/subjectBrowse";
import { atarBandOf } from "@/lib/atarBands";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = process.cwd();
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/** Every .jsx under the onboarding folder, RECURSIVELY. The first draft read
    the top folder only, and the invented ladder sat one level down in
    wizard/TheReveal.jsx — so the scan passed against the very bug it names. */
function onboardingFiles(dir = "src/components/onboarding") {
    const out = [];
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) out.push(...onboardingFiles(rel));
        else if (/\.jsx$/.test(e.name)) out.push(rel);
    }
    return out;
}
const FLOW_FILES = () => ["src/pages/Onboarding.jsx", ...onboardingFiles()];

const NOW = new Date(2026, 9, 14, 10, 0);      // a Wednesday in October
const SUBJ = (name) => {
    const c = VCE_SUBJECTS.find((v) => v.name === name);
    return { id: c?.id || name, name, code: c?.code };
};
const FULL = {
    yearLevel: "Year 12 Units 3&4",
    subjects: ["Mathematical Methods", "Chemistry", "English", "Physics"].map(SUBJ),
    goalAtar: 92.5,
    goalCourseName: "Bachelor of Commerce",
};
const BARE = { yearLevel: null, subjects: [], goalAtar: null };
const CUSTOM = { yearLevel: "Year 9", subjects: [{ id: "c1", name: "Year 9 Science", code: "Y9SCI", is_custom: true }] };
const SHAPES = [FULL, BARE, CUSTOM, { ...FULL, goalAtar: null }, { ...FULL, subjects: [] }];

const junk = /undefined|null|NaN|\[object/;

/* ── The steps, and one count ─────────────────────────────────────────────── */

check("seven steps, and every one has a NAME rather than a count", () => {
    assert.equal(STEPS.length, 7);
    for (const s of STEPS) {
        assert.ok(STEP_NAME[s], `${s} has no name`);
        assert.ok(!/\d+\s+of\s+\d+/i.test(STEP_NAME[s]), `${s}'s name is a count`);
    }
});

check("an existing student retaking the setup skips the build and nothing else", () => {
    const redo = stepsFor({ existingUser: true });
    assert.ok(!redo.includes("build"));
    assert.deepEqual(redo, STEPS.filter((s) => s !== "build"));
    assert.deepEqual(stepsFor(), STEPS);
});

check("THE FLOW PRINTS ONE COUNT — no eyebrow anywhere says 'N of M'", () => {
    // The old wizard printed "1 of 3", "2 of 4" and "3 of 3" under a header
    // reading "/6". Three counts for one position.
    const files = FLOW_FILES();
    assert.ok(files.length >= 6, `only ${files.length} files scanned`);
    for (const f of files) {
        const code = strip(read(f));
        const eyebrows = [...code.matchAll(/eyebrow=\{?["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
        for (const e of eyebrows) assert.ok(!/\d+\s+of\s+\d+/i.test(e), `${f}: eyebrow "${e}" is a second count`);
    }
});

/* ── The calendar ─────────────────────────────────────────────────────────── */

check("the weeks roll to next year once the exams have passed, and are never zero", () => {
    const after = new Date(2026, 10, 30);
    const { weeks } = weeksUntilExams("Year 12 Units 3&4", after);
    assert.ok(weeks > 40 && weeks < 52, `${weeks} weeks after the exams`);
    const eve = new Date(2026, 9, 24, 20);
    assert.ok(weeksUntilExams("Year 12 Units 3&4", eve).weeks >= 1, "the last week reads as zero");
    assert.match(weeksUntilExams("Year 11 Units 1&2", NOW).label, /end-of-year exams/);
    assert.match(weeksUntilExams("Year 8", NOW).label, /school year/);
});

/* ── The ladder is the scheduler ──────────────────────────────────────────── */

check("THE REVIEW LADDER IS WHAT THE SCHEDULER ACTUALLY WALKS", () => {
    // The reveal printed "Day 1 · 3 · 8 · 14" under a comment saying they were
    // the app's own intervals. Rated Good every time, calculateNextReview gives
    // intervals of 1, 3, 7 and 16 — so the days are 1, 4, 11 and 27.
    let card = {}, day = 0;
    const expected = [];
    for (let i = 0; i < 4; i++) {
        const next = calculateNextReview(3, card);
        day += next.interval_days;
        expected.push(day);
        card = { ...card, ...next };
    }
    assert.deepEqual(REVIEW_LADDER, expected);
    assert.deepEqual(reviewLadder(4), expected);
});

check("the ladder is derived, never typed back in", () => {
    const code = strip(read("src/lib/onboardingFlow.js"));
    assert.ok(!/LADDER\s*=\s*\[\s*\d/.test(code), "a ladder is hard-coded as a literal array");
    assert.ok(/calculateNextReview\s*\(/.test(code), "the ladder no longer runs the scheduler");
    for (const f of FLOW_FILES()) {
        assert.ok(!/\[\s*1\s*,\s*3\s*,\s*8\s*,\s*14\s*\]/.test(strip(read(f))), `${f} still prints the invented ladder`);
    }
});

check("review dates fall after today, in order, one per rung", () => {
    const dates = reviewDates(NOW);
    assert.equal(dates.length, REVIEW_LADDER.length);
    dates.forEach((d, i) => {
        assert.ok(d > NOW, "a review lands in the past");
        if (i) assert.ok(d > dates[i - 1], "the dates are not increasing");
    });
    const line = formatReviewDates(dates);
    assert.ok(!junk.test(line), line);
    assert.equal(line.split(" · ").length, dates.length);
});

/* ── Scaling is VTAC's ────────────────────────────────────────────────────── */

check("scaling is read through ONE parser, and the catalogue's own figure comes back", () => {
    const { scaled } = scalingFor(FULL.subjects);
    for (const s of scaled) {
        const cat = VCE_SUBJECTS.find((v) => v.name === s.name);
        assert.equal(s.factor, scalingOf(cat), `${s.name}'s factor is not the catalogue's`);
    }
    for (const f of ["src/lib/onboardingFlow.js", "src/components/onboarding/wizard/ScalingReport.jsx"]) {
        const code = strip(read(f));
        assert.ok(!/function\s+factorOf\s*\(/.test(code), `${f} carries a second scaling parser`);
    }
});

check("a custom subject is listed as unscaled, never drawn at zero", () => {
    const { scaled, unscaled } = scalingFor(CUSTOM.subjects);
    assert.equal(scaled.length, 0);
    assert.deepEqual(unscaled, ["Year 9 Science"]);
});

/* ── Names that fit ───────────────────────────────────────────────────────── */

check("EVERY catalogue subject has a label that fits a hand card without breaking a word", () => {
    // "Mathem / atical Methods" and "Chemistr / y" were the rail's own labels.
    for (const v of VCE_SUBJECTS) {
        const s = shortSubject(v.name);
        const words = s.split(/\s+/);
        assert.ok(words.length <= 2, `"${v.name}" → "${s}" is ${words.length} lines on a card`);
        for (const w of words) assert.ok(w.length <= SHORT_MAX, `"${v.name}" → "${w}" cannot fit on one line`);
    }
    assert.equal(shortSubject("Mathematical Methods"), "Methods");
    for (const w of shortSubject("Extremely Longwinded Customsubjectname").split(/\s+/)) assert.ok(w.length <= SHORT_MAX);
    assert.equal(shortSubject(""), "");
});

/* ── The hand ─────────────────────────────────────────────────────────────── */

check("NOBODY IS HANDED AN ACE — every subject is a two, and only the target is gold", () => {
    const hand = handFrom(FULL);
    const subs = hand.filter((c) => c.key.startsWith("sub-"));
    assert.equal(subs.length, FULL.subjects.length);
    for (const c of subs) assert.equal(c.rank, "2", `${c.label} was handed a ${c.rank}`);
    const aces = hand.filter((c) => c.rank === "A");
    assert.equal(aces.length, 1);
    assert.ok(aces[0].gold && aces[0].key === "atar");
    assert.equal(handFrom({ ...FULL, goalAtar: null }).filter((c) => c.rank === "A").length, 0);
});

check("the year card in the hand is the card that was picked, rank AND suit", () => {
    for (const y of YEARS) {
        const card = handFrom({ yearLevel: y.value })[0];
        assert.equal(card.rank, y.rank);
        assert.equal(card.suit, y.suit);
    }
    assert.ok(!YEARS.some((y) => y.rank === "A"), "a year level is handed the Ace");
    assert.equal(yearOf("Year 12 Units 3&4").rank, "Q");
});

check("ONE year→rank table — the picker and the hand read the same one", () => {
    for (const f of ["src/components/onboarding/wizard/YearCards.jsx", "src/components/onboarding/wizard/HandOfAnswers.jsx"]) {
        const code = strip(read(f));
        assert.ok(!/["']Year 12 Units 3&4["']\s*:\s*["']Q["']/.test(code) && !/rank:\s*["']Q["']/.test(code),
            `${f} keeps its own year ranks`);
    }
});

check("an absent answer is left out of the personal line, never printed as a blank", () => {
    assert.equal(personalLine(BARE), "");
    assert.equal(personalLine(FULL), "Year 12 · 4 subjects · ATAR 92.50 · Bachelor of Commerce");
    assert.equal(formatAtar(85), "85");
    for (const a of SHAPES) assert.ok(!junk.test(personalLine(a)));
});

/* ── What Ace says ────────────────────────────────────────────────────────── */

check("Ace says something real on every step, for every shape of answers", () => {
    for (const a of SHAPES) {
        for (const s of STEPS) {
            const lines = aceLines(s, a, NOW);
            assert.ok(lines.length > 0, `${s} is silent`);
            for (const l of lines) assert.ok(l && !junk.test(l), `${s}: "${l}"`);
        }
    }
});

check("his weeks are the calendar's, and his scaling is VTAC's", () => {
    const { weeks, label } = weeksUntilExams(FULL.yearLevel, NOW);
    assert.equal(aceLines("birthday", FULL, NOW)[0], `${weeks} weeks ${label}.`);
    const line = aceLines("target", FULL, NOW)[0];
    const m = /VTAC scales (.+) up (\d+)\./.exec(line);
    assert.ok(m, line);
    assert.equal(Number(m[2]), scalingOf(VCE_SUBJECTS.find((v) => v.name === m[1])));
});

check("HE NEVER COMMENTS ON AN AGE", () => {
    // The birthday screen is the only answer he does not pay out. An app
    // remarking on a fifteen-year-old's age has started editorialising.
    for (const a of SHAPES) {
        for (const s of STEPS) {
            for (const l of aceLines(s, { ...a, dob: "2010-03-01" }, NOW)) {
                assert.ok(!/\b(1[0-9]|you're young|old|age)\b/i.test(l.replace(/\d+ weeks?/, "")), `"${l}"`);
            }
        }
    }
});

/* ── The build and the reveal invent nothing ──────────────────────────────── */

check("every build line is computed, and a missing answer DROPS its line", () => {
    const full = buildLines(FULL, NOW);
    assert.deepEqual(full.map((l) => l.id), ["weeks", "scaling", "reviews", "target", "level"]);
    for (const l of full) assert.ok(l.doing && l.done && !junk.test(l.done) && !junk.test(l.doing), JSON.stringify(l));

    const noTarget = buildLines({ ...FULL, goalAtar: null }, NOW);
    assert.ok(!noTarget.some((l) => l.id === "target"), "a skipped target still printed a target line");
    assert.match(buildLines(FULL, NOW).find((l) => l.id === "target").done, new RegExp(atarBandOf(92.5)));

    const custom = buildLines(CUSTOM, NOW).find((l) => l.id === "scaling");
    assert.match(custom.done, /no VTAC data/);

    const bare = buildLines(BARE, NOW);
    assert.deepEqual(bare.map((l) => l.id), ["reviews"], "an empty wizard still invented lines");
});

check("NO BUILD LINE CLAIMS WORK THE APP IS NOT DOING", () => {
    // The tempting lines are the ones that make a wait feel valuable by lying
    // about it: "analysing 10,000 students", "matching you with…".
    for (const a of SHAPES) {
        for (const l of buildLines(a, NOW)) {
            assert.ok(!/analys|10,000|thousand|students like you|matching|AI is|personalis/i.test(`${l.doing} ${l.done}`),
                `"${l.doing} — ${l.done}"`);
        }
    }
});

check("the reveal states facts about THIS hand, and drops the ones it cannot", () => {
    const facts = revealFacts(FULL, NOW);
    assert.ok(facts.find((f) => f.id === "twos").head.startsWith("4 subjects"));
    assert.ok(!revealFacts({ ...FULL, goalAtar: null }, NOW).some((f) => f.id === "target"));
    for (const a of SHAPES) for (const f of revealFacts(a, NOW)) assert.ok(!junk.test(f.head + f.body));
});

check("BACK NEVER LANDS ON THE BUILD — it would replay itself to reach the target", () => {
    const at = (s) => STEPS.indexOf(s);
    assert.equal(STEPS[prevStep(STEPS, at("reveal"))], "target", "back from the reveal replays the shuffle");
    assert.equal(STEPS[prevStep(STEPS, at("build"))], "target");
    assert.equal(STEPS[prevStep(STEPS, at("signin"))], "reveal");
    assert.equal(prevStep(STEPS, 0), 0, "back from the first screen went somewhere");
    const redo = stepsFor({ existingUser: true });
    assert.equal(redo[prevStep(redo, redo.indexOf("reveal"))], "target");
    for (let i = 0; i < STEPS.length; i++) assert.notEqual(STEPS[prevStep(STEPS, i)], "build");
});

check("THE BUTTON IS NEVER UNDER THE CONSENT BANNER — the banner publishes its height and the bar reads it", () => {
    // The banner sat over the wizard's primary button for every first-time
    // visitor: both were pinned to the bottom and nothing knew about the
    // other. It renders perfectly and costs a signup on the one screen that
    // exists to make one.
    const banner = strip(read("src/components/legal/ConsentBanner.jsx"));
    // The MEASURED value, not merely a mention: the banner also resets the
    // variable to 0px on hide and unmount, and those alone satisfied the first
    // draft of this check with the real measurement deleted.
    assert.ok(/setProperty\(\s*["']--consent-h["']\s*,\s*`[^`]*getBoundingClientRect\(\)\.height/.test(banner),
        "the banner no longer publishes its measured height as --consent-h");
    assert.ok(/ResizeObserver/.test(banner), "the height is measured once rather than watched");
    const page = strip(read("src/pages/Onboarding.jsx"));
    assert.ok(/bottom:\s*["'`]var\(--consent-h/.test(page), "the actions bar ignores the banner's height");
});

check("CARD STOCK IS WHITE IN BOTH THEMES, everywhere a card is dealt from or to", () => {
    // A flight carries a white card. Picked from a dark card or landing on one,
    // it visibly changes what it is mid-air — the one thing a deal must not do.
    for (const f of [
        "src/components/onboarding/wizard/YearCards.jsx",
        "src/components/onboarding/wizard/HandOfAnswers.jsx",
        "src/components/onboarding/wizard/AtarCut.jsx",
        "src/components/onboarding/Table.jsx",
        "src/components/onboarding/DealFlight.jsx",
    ]) {
        assert.ok(/theme-locked-light/.test(strip(read(f))), `${f} draws card stock that follows the theme`);
    }
});

check("A PLAN CARD SELLS WHAT THE GATE ENFORCES — its figures are counted, never typed", () => {
    const src = strip(read("src/components/onboarding/StepSignin.jsx"));
    const plans = src.slice(src.indexOf("const PLANS"), src.indexOf("function PlanCard"));
    assert.ok(plans.length > 50, "the plan table moved, so this guard reads nothing");
    assert.ok(!/["'`][^"'`$]*\b\d+\s+(AI|answers|tools)\b/i.test(plans.replace(/\$\{[^}]*\}/g, "")),
        "a plan card states a hand-typed allowance");
    assert.ok(/FREE_LIFETIME_CAPS\[/.test(plans), "the free allowance is no longer read from the gate");
    assert.ok(/TOOL_N\b/.test(plans) && /Object\.keys\(TOOL_LABELS\)/.test(src), "the tool count is no longer the catalogue's");
});

check("THE SIGN-IN STEP PROMISES NO TRIAL — that decision is open in pricing.js", () => {
    const src = strip(read("src/components/onboarding/StepSignin.jsx"));
    assert.ok(!/trial|free week|7[- ]day|day 7|no card required|pay nothing/i.test(src),
        "the sign-in step makes a trial claim the checkout does not honour");
    assert.ok(/priceLabel\(\)/.test(src), "the price is typed rather than printed by priceLabel");
});

console.log(`\nonboardingFlow: ${passed} checks passed`);
