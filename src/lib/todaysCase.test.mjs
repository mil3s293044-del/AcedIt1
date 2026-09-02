/**
 * dashboard hero assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/todaysCase.test.mjs
 *
 * The failure this exists to catch is a case made of ZEROES. The hero is the
 * first thing a student sees, and printing "+0.00 ATAR" or "0 regions quiet"
 * at a first-week account teaches them that the numbers on this page are
 * decoration — after which the real ones do not land either.
 */
import assert from "node:assert/strict";
import { buildCase, payoffFor, previewFor } from "@/lib/todaysCase";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const COMPONENTS = { mastery: 40, consistency: 55, effort: 60, breadth: 30, planning: 20 };

const MOVE = {
    technique: "spaced_repetition",
    component: "mastery",
    why: { value: 11, label: "cards at or past their review date" },
};

// Learned cards a week past a short interval: far enough down the forgetting
// curve for the projection to have something to say.
const SLIPPING = Array.from({ length: 6 }, (_, i) => ({
    id: `s${i}`, question: "q",
    interval_days: 4, repetitions: 2, total_reviews: 2,
    last_reviewed_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    next_review_date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
}));

// ─── the payoff ─────────────────────────────────────────────────────────────

check("the payoff is a real ATAR difference", () => {
    const p = payoffFor(COMPONENTS, "mastery");
    assert.ok(p.gain > 0, "mastery at 40 has room");
    assert.equal(p.label, "mastery");
    assert.ok(p.headroom > 0);
});

check("no components, no payoff — never +0.00", () => {
    assert.equal(payoffFor(null, "mastery"), null);
    assert.equal(payoffFor({}, "mastery"), null);
    assert.equal(payoffFor(COMPONENTS, undefined), null);
    assert.equal(payoffFor(COMPONENTS, "not_a_component"), null);
});

check("a component with no headroom claims nothing", () => {
    assert.equal(payoffFor({ ...COMPONENTS, mastery: 100 }, "mastery"), null);
});

// ─── the assembled case ─────────────────────────────────────────────────────

check("the trigger comes first and the payoff last", () => {
    const c = buildCase({ move: MOVE, components: COMPONENTS, flashcards: SLIPPING });
    assert.equal(c.rows[0].kind, "trigger");
    assert.equal(c.rows[0].value, "11");
    assert.equal(c.rows[c.rows.length - 1].kind, "payoff");
    assert.ok(c.rows[c.rows.length - 1].value.startsWith("+"));
});

check("a review move can say what skipping it costs; a Pomodoro cannot", () => {
    const review = buildCase({ move: MOVE, components: null, flashcards: SLIPPING });
    const risk = review.rows.find((r) => r.kind === "risk");
    assert.ok(risk, "the projection has something to say about these cards");
    assert.ok(Number(risk.value) > 0);
    // No equivalent projection exists for a timed block, and inventing a
    // scare for it is exactly what the drop-the-row rule is for.
    const pom = buildCase({ move: { technique: "pomodoro" }, components: null, flashcards: SLIPPING });
    assert.ok(!pom.rows.some((r) => r.kind === "risk"));
});

check("an empty deck makes no risk claim", () => {
    const c = buildCase({ move: MOVE, components: null, flashcards: [] });
    assert.ok(!c.rows.some((r) => r.kind === "risk"));
    // Cards nobody has ever reviewed were never learned, so they cannot have
    // been forgotten. Same rule retention.js applies.
    const fresh = buildCase({
        move: MOVE, components: null,
        flashcards: [{ question: "q", repetitions: 0, total_reviews: 0 }],
    });
    assert.ok(!fresh.rows.some((r) => r.kind === "risk"));
});

check("a first-week account gets NO rail rather than a rail of zeroes", () => {
    const c = buildCase({
        move: { technique: "pomodoro", component: "consistency" },
        components: null, flashcards: [],
    });
    assert.deepEqual(c.rows, [], "nothing here is real yet, so nothing is claimed");
});

check("each row survives on its own", () => {
    // Trigger but no components and no history.
    const onlyWhy = buildCase({ move: { why: { value: 3, label: "days left" } }, components: null });
    assert.deepEqual(onlyWhy.rows.map((r) => r.kind), ["trigger"]);
    // Components but no trigger and no technique.
    const onlyPayoff = buildCase({ move: { component: "breadth" }, components: COMPONENTS });
    assert.deepEqual(onlyPayoff.rows.map((r) => r.kind), ["payoff"]);
});

check("a why row with no number is dropped rather than printed empty", () => {
    const c = buildCase({ move: { why: { label: "cards waiting" } }, components: null });
    assert.deepEqual(c.rows, []);
});

check("nothing at all does not throw", () => {
    assert.deepEqual(buildCase({}).rows, []);
});


// ─── the card's face ────────────────────────────────────────────────────────
//
// The card turns over on a promise — "here is the first one you would face" —
// so a face that is a placeholder breaks it on the one interaction the panel
// asks for. Every branch returns null rather than inventing something.

const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const deck = [
    { question: "Older, so this one is first", subject_name: "Chemistry",
      next_review_date: yday, total_reviews: 2, repetitions: 1 },
    { question: "Due today", subject_name: "Biology",
      next_review_date: new Date().toISOString().slice(0, 10), total_reviews: 1, repetitions: 1 },
    { question: "Not due for a week", subject_name: "Biology",
      next_review_date: soon, total_reviews: 3, repetitions: 3 },
];

check("a review move shows the card the session would actually open with", () => {
    const p = previewFor({ move: { technique: "spaced_repetition" }, flashcards: deck });
    assert.equal(p.body, "Older, so this one is first", "longest overdue first, same order as the queue");
    assert.equal(p.label, "Chemistry");
    assert.equal(p.foot, "and 1 more", "the card not yet due is not counted");
});

check("one card due says nothing about others", () => {
    const p = previewFor({ move: { technique: "spaced_repetition" }, flashcards: [deck[1]] });
    assert.equal(p.foot, null);
});

check("an empty deck turns over to nothing rather than a placeholder", () => {
    assert.equal(previewFor({ move: { technique: "spaced_repetition" }, flashcards: [] }), null);
    // A never-reviewed card is NEW, not due — same rule as everywhere else.
    assert.equal(previewFor({
        move: { technique: "spaced_repetition" },
        flashcards: [{ question: "q", next_review_date: yday, total_reviews: 0, repetitions: 0 }],
    }), null);
    // A due card with no question text is not a face.
    assert.equal(previewFor({
        move: { technique: "spaced_repetition" },
        flashcards: [{ next_review_date: yday, total_reviews: 2, repetitions: 1 }],
    }), null);
});

check("a deadline shows the deadline, by name", () => {
    const p = previewFor({ move: { component: "planning" }, deadline: { days: 3, title: "Unit 3 AOS 2 SAC" } });
    assert.equal(p.body, "Unit 3 AOS 2 SAC", "the title is the point — 'your SAC' they already know");
    assert.equal(p.label, "In 3 days");
    assert.equal(previewFor({ move: { component: "planning" }, deadline: { days: 0, title: "Chem SAC" } }).label, "Due today");
    // A deadline with no title has nothing to show.
    assert.equal(previewFor({ move: { component: "planning" }, deadline: { days: 2 } }), null);
});

check("a timed block shows the block", () => {
    const p = previewFor({ move: { technique: "pomodoro" } });
    assert.equal(p.body, "25:00");
});

check("a move we have no material for turns over to nothing", () => {
    assert.equal(previewFor({ move: { technique: "exam", component: "breadth" } }), null);
    assert.equal(previewFor({ move: null }), null);
    assert.equal(previewFor({}), null);
});

console.log(`\n${passed} passed`);
