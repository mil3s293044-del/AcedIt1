/**
 * strategise assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/strategise.test.mjs
 *
 * ═══ A PLAN THAT IS WRONG LOOKS LIKE A PLAN ═════════════════════════════════
 * Strategise had no test at all, and three things were wrong with it, each of
 * which rendered a perfectly reasonable-looking fortnight:
 *
 *   - the run-up was counted in UTC, so in Melbourne it started TODAY;
 *   - every day was capped at the SMALLEST minutes set on any day, so one
 *     20-minute Wednesday made a 90-minute Saturday a 20-minute one;
 *   - it asked the student to type what was shaky while the app had their
 *     weak cards, repeated dropped criteria and untouched course areas on file.
 *
 * The model is pure and held here, along with what the page sends the model
 * and which of a student's sessions a rebuild is allowed to replace — the one
 * decision on this screen that deletes rows.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    runUpDays, applyRules, MAX_RUNUP, seedAims, paintDay, studyDays, runUpTotals,
    strategyIdFor, strategyIsFor, isNewStyleStrategy, sessionsToReplace, existingByDay,
    otherSacsByDay, planBrief, AIMS, DEFAULT_MINUTES,
} from "@/lib/strategise";
import { evidenceFor, customChip, CUSTOM_MAX, clipWords } from "@/lib/strategyEvidence";
import { stratIdOf } from "@/lib/planTags";
import { BANK_TOPIC } from "@/lib/mistakeBank";

// MELBOURNE, because that is where the bug lived. In a UTC container the UTC
// day and the local one are the same string and the injection passes silently.
process.env.TZ = "Australia/Melbourne";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

// ─── The run-up ──────────────────────────────────────────────────────────────

check("the run-up starts TOMORROW in Melbourne, whatever the hour", () => {
    for (const hour of [0, 8, 15, 23]) {
        const days = runUpDays("2026-10-20", new Date(2026, 9, 15, hour, 30));
        assert.deepEqual(days, ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"],
            `at ${hour}:30 the run-up was ${days.join(", ")}`);
    }
});

check("the SAC day itself is never a run-up day", () => {
    const days = runUpDays("2026-11-03", new Date(2026, 9, 28, 9));
    assert.equal(days[days.length - 1], "2026-11-02");
    assert.ok(!days.includes("2026-11-03"));
});

check("a malformed or missing date is no run-up rather than a guess", () => {
    assert.deepEqual(runUpDays(null), []);
    assert.deepEqual(runUpDays("next friday"), []);
});

check("the run-up is capped", () => {
    assert.equal(runUpDays("2027-12-01", new Date(2026, 9, 15)).length, MAX_RUNUP);
});

// ─── Per-day budgets ─────────────────────────────────────────────────────────

const DAYS = ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"];

check("a 90-minute Saturday is not capped by a 20-minute Wednesday", () => {
    const minutesByDay = { "2026-10-16": 20, "2026-10-17": 90, "2026-10-18": 45, "2026-10-19": 45, "2026-10-20": 45, "2026-10-21": 45 };
    const { sessions } = applyRules([
        { date: "2026-10-17", technique: "pomodoro", topic: "Redox", duration: 80, why: "x" },
        { date: "2026-10-16", technique: "active_recall", topic: "Cells", duration: 20, why: "x" },
    ], { days: DAYS, availableDays: DAYS, minutesByDay, confidence: 3 });
    const sat = sessions.filter((s) => s.date === "2026-10-17").reduce((n, s) => n + s.duration, 0);
    assert.ok(sat >= 80, `Saturday held ${sat} minutes`);
});

check("each day still keeps inside ITS OWN minutes", () => {
    const minutesByDay = Object.fromEntries(DAYS.map((d) => [d, 30]));
    minutesByDay["2026-10-17"] = 90;
    const { sessions } = applyRules([
        { date: "2026-10-16", technique: "pomodoro", topic: "Redox", duration: 60, why: "x" },
        { date: "2026-10-17", technique: "active_recall", topic: "Cells", duration: 60, why: "x" },
        { date: "2026-10-17", technique: "blurting", topic: "Redox", duration: 30, why: "x" },
    ], { days: DAYS, availableDays: DAYS, minutesByDay, confidence: 3 });
    for (const d of DAYS) {
        const used = sessions.filter((s) => s.date === d).reduce((n, s) => n + s.duration, 0);
        assert.ok(used <= minutesByDay[d], `${d} used ${used} of ${minutesByDay[d]}`);
    }
});

check("the flat budget still works for the check-in, which passes one number", () => {
    const { sessions } = applyRules([
        { date: "2026-10-16", technique: "pomodoro", topic: "Redox", duration: 90, why: "x" },
    ], { days: DAYS, availableDays: DAYS, minutesPerDay: 40, confidence: 3 });
    for (const s of sessions) assert.ok(s.duration <= 40);
});

check("the timed paper still survives on the last day", () => {
    const minutesByDay = Object.fromEntries(DAYS.map((d) => [d, 45]));
    const { sessions } = applyRules([], { days: DAYS, availableDays: DAYS, minutesByDay, confidence: 3 });
    assert.ok(sessions.some((s) => s.technique === "exam" && s.date === DAYS[DAYS.length - 1]));
});

// ─── Aims, painting and totals ───────────────────────────────────────────────

check("the seed runs learn → drill → test, and only seeds a weak-spot day when there is one", () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    const plain = seedAims(days);
    assert.equal(plain[days[0]].aim, "learn");
    assert.equal(plain[days[9]].aim, "test");
    assert.ok(!Object.values(plain).some((d) => d.aim === "weak"), "a weak-spot day with no weak spot on file");
    const weak = seedAims(days, { hasWeak: true });
    assert.ok(Object.values(weak).some((d) => d.aim === "weak"));
});

check("a day carrying another assessment opens as rest", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-03"];
    assert.equal(seedAims(days, { blocked: ["2026-11-02"] })["2026-11-02"].aim, "rest");
});

check("painting rest keeps the minutes, so painting it back restores them", () => {
    let plan = { "2026-11-01": { aim: "drill", minutes: 90 } };
    plan = paintDay(plan, "2026-11-01", { aim: "rest", minutes: 20 });
    assert.equal(plan["2026-11-01"].aim, "rest");
    assert.equal(plan["2026-11-01"].minutes, 90);
});

check("an unknown aim paints rest, and an off-scale minutes keeps the day's own", () => {
    const plan = paintDay({ d: { aim: "drill", minutes: 30 } }, "d", { aim: "nap", minutes: 7 });
    assert.equal(plan.d.aim, "rest");
    const p2 = paintDay({ d: { aim: "drill", minutes: 30 } }, "d", { aim: "test", minutes: 7 });
    assert.equal(p2.d.minutes, 30);
});

check("the totals count study days and their minutes, and rest is rest", () => {
    const days = ["a", "b", "c"];
    const plan = { a: { aim: "learn", minutes: 45 }, b: { aim: "rest", minutes: 90 }, c: { aim: "test", minutes: 30 } };
    assert.deepEqual(studyDays(days, plan), ["a", "c"]);
    assert.deepEqual(runUpTotals(days, plan), { studyDays: 2, minutes: 75, restDays: 1 });
});

check("there are five aims and rest is one of them", () => {
    assert.equal(AIMS.length, 5);
    assert.ok(AIMS.some((a) => a.id === "rest"));
    assert.equal(DEFAULT_MINUTES, 45);
});

// ─── A plan belongs to one assessment ────────────────────────────────────────

const SAC_A = "3f2a9c1e-0000-4000-8000-000000000001";
const SAC_B = "8b7d4e20-0000-4000-8000-000000000002";

check("a new strategy id carries its SAC and passes planTags' own pattern", () => {
    const id = strategyIdFor(SAC_A, "q7k2");
    assert.equal(id, "3f2a9c1e-q7k2");
    assert.equal(stratIdOf({ notes: `[str:${id}][dur:45] go` }), id);
    assert.ok(strategyIsFor(id, SAC_A));
    assert.ok(!strategyIsFor(id, SAC_B));
    assert.ok(isNewStyleStrategy(id));
    assert.ok(!isNewStyleStrategy("5f3a2b1c"), "an old eight-character id is not new-style");
});

const row = (id, date, extra = {}) => ({ id, date, notes: `[str:${extra.str}][dur:45] x`, is_completed: false, ...extra });

check("a rebuild replaces only the FUTURE, UNTICKED sessions of THIS SAC's plan", () => {
    const mine = strategyIdFor(SAC_A, "aaaa");
    const theirs = strategyIdFor(SAC_B, "bbbb");
    const plans = [
        row("past", "2026-10-10", { str: mine }),
        row("done", "2026-10-20", { str: mine, is_completed: true }),
        row("todo", "2026-10-20", { str: mine }),
        row("today", "2026-10-15", { str: mine }),
        row("other", "2026-10-20", { str: theirs }),
        { id: "plain", date: "2026-10-20", notes: "[dur:30] hand typed", is_completed: false },
    ];
    const ids = sessionsToReplace(plans, SAC_A, { today: "2026-10-15", stratIdOf }).map((p) => p.id).sort();
    assert.deepEqual(ids, ["today", "todo"]);
});

check("an OLD-style plan is matched through the guess, and a new-style one never is", () => {
    const legacyId = "5f3a2b1c";
    const theirs = strategyIdFor(SAC_B, "bbbb");
    const plans = [row("old", "2026-10-20", { str: legacyId }), row("newB", "2026-10-20", { str: theirs })];
    // The guess wrongly attributes BOTH to SAC A — exactly the two-SACs-in-one-
    // subject case. Only the old one may be believed.
    const legacy = [{ id: legacyId, sac: { id: SAC_A } }, { id: theirs, sac: { id: SAC_A } }];
    const ids = sessionsToReplace(plans, SAC_A, { today: "2026-10-15", legacy, stratIdOf }).map((p) => p.id);
    assert.deepEqual(ids, ["old"]);
});

check("no SAC, no replacement", () => {
    assert.deepEqual(sessionsToReplace([row("x", "2026-10-20", { str: "abc" })], null, { stratIdOf }), []);
});

check("what is already planned leaves out the rows a rebuild replaces", () => {
    const plans = [
        { id: "keep", date: "2026-10-16", title: "Methods: integration", subject_name: "Mathematical Methods" },
        { id: "gone", date: "2026-10-16", title: "Old plan" },
        { id: "out", date: "2026-12-01", title: "Not in the run-up" },
    ];
    const by = existingByDay(plans, ["2026-10-16"], { exclude: [{ id: "gone" }], minutesOf: () => 45 });
    assert.deepEqual(by["2026-10-16"].map((s) => s.id), ["keep"]);
    assert.equal(by["2026-12-01"], undefined);
});

check("other SACs in the run-up are found, and this one and completed ones are not", () => {
    const days = ["2026-10-16", "2026-10-17"];
    const by = otherSacsByDay([
        { id: "me", due_date: "2026-10-16" },
        { id: "m", due_date: "2026-10-17", subject_name: "Methods" },
        { id: "done", due_date: "2026-10-17", is_completed: true },
    ], days, "me");
    assert.deepEqual(Object.keys(by), ["2026-10-17"]);
    assert.deepEqual(by["2026-10-17"].map((a) => a.id), ["m"]);
});

// ─── Evidence ────────────────────────────────────────────────────────────────

const card = (o) => ({ subject_name: "Chemistry", is_active: true, total_reviews: 0, ...o });
const FIX = {
    subject: "Chemistry",
    flashcards: [
        // Redox misses 6 of 10.
        ...Array.from({ length: 5 }, (_, i) => card({ id: `r${i}`, topic: "Redox", total_reviews: 2, review_count_good: i < 2 ? 2 : 0 })),
        // A Methods deck that must not appear.
        ...Array.from({ length: 5 }, (_, i) => card({ id: `m${i}`, subject_name: "Mathematical Methods", topic: "Calculus", total_reviews: 2 })),
        // Two banked mistakes on one criterion.
        card({ id: "b1", topic: BANK_TOPIC, extra: { mistake: { criterion: "Names the electron transfer", topic: "Galvanic cells" } } }),
        card({ id: "b2", topic: BANK_TOPIC, extra: { mistake: { criterion: "Names the electron transfer", topic: "Galvanic cells" } } }),
    ],
    quizzes: [{ id: "q1", subject: "Chemistry", title: "Redox basics" }],
    attempts: [],
    assessments: [
        { id: "this", subject_name: "Chemistry", due_date: "2026-10-24" },
        { id: "a1", subject_name: "Chemistry", due_date: "2026-08-01", title: "Unit 3 SAC 1", score: 34, out_of: 50 },
        { id: "a2", subject_name: "Chemistry", due_date: "2026-09-01", title: "Unit 3 SAC 2", score: 36, out_of: 50 },
        { id: "a3", subject_name: "Chemistry", due_date: "2026-09-10", title: "Unentered", score: null, out_of: 50 },
    ],
    userSubject: { goal_study_score: 38 },
    keySkills: ["Redox", "Electrolysis", "Organic pathways"],
    sacId: "this",
};

check("the chips come from the student's own rows, in this subject only", () => {
    const chips = evidenceFor(FIX);
    const labels = chips.map((c) => c.label);
    assert.ok(labels.includes("Redox"), labels.join(" | "));
    assert.ok(!labels.some((l) => /Calculus/.test(l)), "a Methods deck leaked into a Chemistry plan");
    const weak = chips.find((c) => c.kind === "weak");
    assert.match(weak.detail, /60% of your reviews missed/);
    assert.equal(weak.source, "Your flashcards");
});

check("a criterion dropped twice is a repeat, said once", () => {
    const rep = evidenceFor(FIX).filter((c) => c.kind === "repeat");
    assert.equal(rep.length, 1);
    assert.match(rep[0].detail, /Dropped 2 times/);
    assert.equal(rep[0].source, "Mistake bank");
});

check("a course area is untouched only when nothing in the decks or quizzes names it", () => {
    const un = evidenceFor(FIX).filter((c) => c.kind === "untouched").map((c) => c.label);
    assert.deepEqual(un.sort(), ["Electrolysis", "Organic pathways"]);
});

check("the last mark is the newest RECORDED one, and a missing half is not a zero", () => {
    const mark = evidenceFor(FIX).find((c) => c.kind === "mark");
    assert.equal(mark.label, "Last Chemistry mark 72%");
    assert.match(mark.detail, /Averaging 70% over 2/);
    assert.ok(!/\b0%/.test(mark.label));
});

check("this SAC's own row is never its own last mark", () => {
    const fx = { ...FIX, assessments: [{ id: "this", subject_name: "Chemistry", due_date: "2026-10-24", score: 10, out_of: 50 }] };
    assert.equal(evidenceFor(fx).find((c) => c.kind === "mark"), undefined);
});

check("the target is the one the student set, and no target is no chip", () => {
    assert.equal(evidenceFor(FIX).find((c) => c.kind === "target").label, "Aiming for 38");
    assert.equal(evidenceFor({ ...FIX, userSubject: { goal_study_score: null } }).find((c) => c.kind === "target"), undefined);
});

check("a topic with reviews and a real 0% miss rate is never offered as a weakness", () => {
    const clean = Array.from({ length: 5 }, (_, i) => card({ id: `c${i}`, topic: "Stoichiometry", total_reviews: 2, review_count_good: 2 }));
    const chips = evidenceFor({ ...FIX, flashcards: clean });
    assert.ok(!chips.some((c) => /Stoichiometry/.test(c.label) && c.kind === "weak"));
    assert.ok(!chips.some((c) => /\b0% of your reviews/.test(c.detail || "")));
});

check("a FLAGGED topic whose reviews all landed says flagged, never 0% missed", () => {
    const flagged = Array.from({ length: 3 }, (_, i) => card({ id: `w${i}`, topic: "Stoichiometry", is_weak_spot: true, total_reviews: 2, review_count_good: 2 }));
    const chip = evidenceFor({ ...FIX, flashcards: flagged }).find((c) => c.kind === "weak");
    assert.ok(chip, "a flagged topic produced no chip");
    assert.match(chip.detail, /flagged weak/);
    assert.ok(!/0%/.test(chip.detail), chip.detail);
});

check("a repeated criterion that is FIXED every time is not offered as a weakness", () => {
    const fixed = (id) => card({ id, topic: BANK_TOPIC, repetitions: 12, review_count_good: 6, interval_days: 30,
        extra: { mistake: { criterion: "Names the electron transfer", topic: "Galvanic cells" } } });
    const chips = evidenceFor({ ...FIX, flashcards: [fixed("f1"), fixed("f2")] });
    assert.equal(chips.filter((c) => c.kind === "repeat").length, 0, "a fixed repeat was sent to the plan");
});

check("no subject, no chips", () => {
    assert.deepEqual(evidenceFor({ ...FIX, subject: "" }), []);
});

check("every chip names its source", () => {
    for (const c of evidenceFor(FIX)) assert.ok(c.source && c.detail && c.prompt, JSON.stringify(c));
});

check("a student's own chip is refused when empty, duplicated, too long or past the cap", () => {
    const base = evidenceFor(FIX);
    assert.equal(customChip("   ", base), null);
    assert.equal(customChip("redox", base), null, "a duplicate of an existing chip");
    assert.equal(customChip("x".repeat(200), base), null);
    let list = [...base];
    for (let i = 0; i < CUSTOM_MAX; i += 1) list.push(customChip(`Topic ${i}`, list));
    assert.equal(customChip("One more", list), null);
});

check("a long criterion is cut on a word, with an ellipsis", () => {
    const c = clipWords("Explains how the electron transfer at the anode drives the external circuit current", 40);
    assert.ok(c.endsWith("…"));
    assert.ok(!/\s…$/.test(c));
    assert.ok(c.length <= 41);
});

// ─── What the model is told ──────────────────────────────────────────────────

check("the prompt carries the TICKED chips and drops the unticked ones", () => {
    const ev = evidenceFor(FIX).map((c) => (c.kind === "untouched" ? { ...c, on: false } : c));
    const days = ["2026-10-16", "2026-10-17"];
    const brief = planBrief({
        sac: { title: "Unit 4 SAC", subject_name: "Chemistry", due_date: "2026-10-24" },
        evidence: ev, days, plan: { "2026-10-16": { aim: "weak", minutes: 45 }, "2026-10-17": { aim: "rest", minutes: 45 } },
    });
    assert.match(brief, /Redox — 60% of your reviews missed/);
    assert.match(brief, /Names the electron transfer/);
    assert.ok(!/Electrolysis/.test(brief), "an unticked chip reached the model");
    assert.match(brief, /HOW THEY DID LAST TIME: Their last Chemistry assessment/);
    assert.match(brief, /study score of 38/);
});

check("the prompt lists only the study days, at their own minutes", () => {
    const brief = planBrief({
        sac: { title: "SAC", subject_name: "Chemistry", due_date: "2026-10-24" },
        days: ["2026-10-16", "2026-10-17"],
        plan: { "2026-10-16": { aim: "learn", minutes: 90 }, "2026-10-17": { aim: "rest", minutes: 45 } },
    });
    assert.match(brief, /2026-10-16 — aim: Learn new content \(90 min\)/);
    assert.ok(!/2026-10-17 — aim/.test(brief), "a rest day was sent as a study day");
});

check("what is already on the planner reaches the prompt", () => {
    const brief = planBrief({
        sac: { title: "SAC", subject_name: "Chemistry", due_date: "2026-10-24" },
        days: ["2026-10-16"], plan: { "2026-10-16": { aim: "learn", minutes: 45 } },
        existing: { "2026-10-16": [{ subject: "Mathematical Methods", title: "Methods: integration", minutes: 60 }] },
    });
    assert.match(brief, /2026-10-16 — Mathematical Methods: Methods: integration \(60 min\)/);
});

check("with nothing on file the prompt says so rather than inventing topics", () => {
    const brief = planBrief({ sac: { subject_name: "Chemistry" }, days: [], plan: {} });
    assert.match(brief, /nothing specific on record/);
    assert.match(brief, /HOW THEY DID LAST TIME: no mark on record/);
});


// ─── The page ────────────────────────────────────────────────────────────────

const PAGE = strip(read("src/pages/Strategise.jsx"));

check("the page sends planBrief, and builds no prompt of its own", () => {
    assert.match(PAGE, /prompt:\s*planBrief\(/);
    assert.ok(!/SHAKY ON|WHAT THEY WANT:/.test(PAGE), "an inline prompt is back in the page");
});

check("the page opens on what the app knows rather than four text boxes", () => {
    assert.match(PAGE, /evidenceFor\(\{/);
    assert.ok(!/setShaky|setTopics|setLastMark|setGoal/.test(PAGE), "the free-text questionnaire is back");
});

check("every day keeps its own minutes — the page never passes the smallest budget", () => {
    assert.match(PAGE, /applyRules\([^)]*minutesByDay/);
    assert.ok(!/Math\.min\(\.\.\.[^)]*minutes/.test(PAGE), "a Math.min over the day budgets is back");
});

check("the new plan lands BEFORE the old one is removed", () => {
    const create = PAGE.indexOf("StudyPlan.bulkCreate(");
    const del = PAGE.indexOf("StudyPlan.delete(");
    assert.ok(create > 0 && del > 0, "save no longer creates and replaces");
    assert.ok(create < del, "the old plan is deleted before the new one exists");
    assert.match(PAGE, /Promise\.allSettled\(replacing\.map/);
});

check("a saved plan carries its SAC in the strategy id", () => {
    assert.match(PAGE, /strategyIdFor\(sac\.id\)/);
});

check("the lock and the price are on screen before anything is spent", () => {
    assert.match(PAGE, /canUseFeature\(rows\.profile, FEATURES\.ROADMAP_AI_GEN\)/);
    assert.match(PAGE, /!access\.allowed \?[\s\S]{0,200}createPageUrl\("Subscription"\)/);
    assert.match(PAGE, /priceLabel\("roadmap_ai_gen"\)/);
    assert.match(PAGE, /if \(!access\.allowed\) return;/, "build() no longer refuses a locked account");
});

check("the page reads ?id= and the runway's prep button passes it", () => {
    assert.match(PAGE, /URLSearchParams\(location\.search\)\.get\("id"\)/);
    const runway = strip(read("src/components/planner/TermRunway.jsx"));
    assert.match(runway, /createPageUrl\("Strategise"\)\}\?id=\$\{encodeURIComponent\(next\.sac\.id\)\}/);
});

check("a finger paints on tap and a mouse on press — a phone drag is a scroll", () => {
    assert.match(PAGE, /e\.pointerType !== "mouse"/);
    assert.match(PAGE, /touch-pan-x/);
});

// ─── strategise.js holds no UTC day ─────────────────────────────────────────

check("strategise.js never builds a day with toISOString", () => {
    assert.ok(!/toISOString\(\)/.test(strip(read("src/lib/strategise.js"))));
});

console.log(`\n${passed} strategise checks passed`);
