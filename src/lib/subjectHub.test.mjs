/**
 * subject hub assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/subjectHub.test.mjs
 *
 * The one that matters most is coverage: crediting a student with an area of
 * study they have not touched would send them into a SAC believing they had
 * done the work, which is the opposite of what this page is for.
 */
import assert from "node:assert/strict";
import {
    markSplit, coverage, subjectStats, subjectLead, SOON_DAYS,
} from "@/lib/subjectHub";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const NOW = new Date(2026, 8, 2);                       // a Wednesday
const day = (n) => {
    const d = new Date(2026, 8, 2 - n);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ─── the mark split ─────────────────────────────────────────────────────────

check("assessments come back heaviest first", () => {
    const s = markSplit({ assessment_structure: [
        { component: "Unit 3 SAC", percentage: 20 },
        { component: "Exam 2", percentage: 44 },
        { component: "Unit 4 SAC", percentage: 14 },
        { component: "Exam 1", percentage: 22 },
    ] });
    assert.deepEqual(s.parts.map((p) => p.component),
        ["Exam 2", "Exam 1", "Unit 3 SAC", "Unit 4 SAC"]);
    assert.equal(s.heaviest.percentage, 44,
        "the whole point: revising a 14% SAC over a 44% exam is a bad trade");
    assert.equal(s.total, 100);
});

check("percentages are VCAA's and are not renormalised", () => {
    const s = markSplit({ assessment_structure: [
        { component: "A", percentage: 30 }, { component: "B", percentage: 40 },
    ] });
    assert.equal(s.total, 70, "reported honestly rather than scaled up to 100");
    assert.equal(s.parts[0].percentage, 40);
});

check("a subject with no structure claims none", () => {
    // A custom subject the student created has no study design, and inventing
    // one would be the app making up a curriculum.
    assert.equal(markSplit({}).heaviest, null);
    assert.deepEqual(markSplit(null).parts, []);
    assert.deepEqual(markSplit({ assessment_structure: [{ component: "", percentage: 0 }] }).parts, []);
});

// ─── coverage ───────────────────────────────────────────────────────────────

check("an area is covered by a topic that names it, either way round", () => {
    const c = coverage(
        ["Calculus", "Vectors and matrices", "Probability"],
        ["Calculus revision", "Vectors"],
    );
    assert.deepEqual(c.areas.filter((a) => a.covered).map((a) => a.skill),
        ["Calculus", "Vectors and matrices"]);
    assert.deepEqual(c.untouched, ["Probability"]);
    assert.equal(c.covered, 2);
    assert.equal(c.total, 3);
});

check("a topic that matches nothing is REPORTED, not forced onto an area", () => {
    // Crediting an area the student has not covered is the one error this
    // cannot make. Saying "I did not recognise this deck" is the honest
    // alternative and it is what makes the rest of the panel believable.
    const c = coverage(["Calculus"], ["Trigonometry", "Calculus"]);
    assert.deepEqual(c.unmatched, ["Trigonometry"]);
    assert.equal(c.areas[0].covered, true);
    assert.deepEqual(c.areas[0].topics, ["Calculus"]);
});

check("matching ignores case and punctuation, not meaning", () => {
    assert.equal(coverage(["Key skills"], ["key-skills"]).covered, 1);
    assert.equal(coverage(["Calculus"], ["Photosynthesis"]).covered, 0,
        "two unrelated words must not match");
});

check("no study design means no claim either way", () => {
    const c = coverage([], ["Calculus"]);
    assert.equal(c.total, 0);
    assert.deepEqual(c.untouched, []);
    assert.deepEqual(c.unmatched, ["Calculus"]);
});

// ─── the student's own numbers ──────────────────────────────────────────────

const CARDS = [
    { subject_name: "Chemistry", topic: "Redox", next_review_date: day(1), total_reviews: 3, _mastery_score: 70 },
    { subject_name: "Chemistry", topic: "Organic", next_review_date: day(-9), total_reviews: 2 },
    { subject_name: "English", topic: "Text response", next_review_date: day(1), total_reviews: 1 },
];

check("a subject counts only its own rows", () => {
    const s = subjectStats("Chemistry", { flashcards: CARDS, now: NOW });
    assert.equal(s.cards, 2);
    assert.equal(s.decks, 2);
    assert.deepEqual(s.topics.sort(), ["Organic", "Redox"]);
});

check("the subject name matches loosely but never across subjects", () => {
    const s = subjectStats("chemistry", { flashcards: CARDS, now: NOW });
    assert.equal(s.cards, 2, "case is not a different subject");
    assert.equal(subjectStats("Chem", { flashcards: CARDS, now: NOW }).cards, 0,
        "and a prefix is not the same subject either");
});

check("a retry is work and is never a score", () => {
    const quizzes = [{ id: "q1", subject: "Chemistry" }];
    const attempts = [
        { quiz_id: "q1", score: 70, created_date: "2026-08-01T09:00:00Z" },
        { quiz_id: "q1", score: 0, created_date: "2026-08-05T09:00:00Z", extra: { is_retry: true } },
    ];
    const s = subjectStats("Chemistry", { quizzes, attempts, now: NOW });
    assert.equal(s.sits, 1);
    assert.equal(s.bestScore, 70);
    assert.equal(s.lastScore, 70, "and it is not your last result either");
});

check("the adjusted score wins, as it does everywhere else", () => {
    const s = subjectStats("Chemistry", {
        quizzes: [{ id: "q1", subject: "Chemistry" }],
        attempts: [{ quiz_id: "q1", score: 60, adjusted_score: 78, created_date: "2026-08-01T09:00:00Z" }],
        now: NOW,
    });
    assert.equal(s.bestScore, 78);
});

check("nothing sat reports nothing rather than zero", () => {
    const s = subjectStats("Chemistry", { flashcards: CARDS, now: NOW });
    assert.equal(s.bestScore, null);
    assert.equal(s.lastScore, null);
});

check("the usual week excludes this half-finished one", () => {
    const events = [
        { subject: "Chemistry", day: day(7), minutes: 120 },
        { subject: "Chemistry", day: day(14), minutes: 60 },
        { subject: "Chemistry", day: day(0), minutes: 5 },     // this week so far
    ];
    const s = subjectStats("Chemistry", { events, now: NOW });
    assert.equal(s.weekMinutes, 5);
    assert.equal(s.usualMinutes, 90, "a Monday morning must not drag the usual to nothing");
});

check("with no past weeks there is no usual to claim", () => {
    const s = subjectStats("Chemistry", {
        events: [{ subject: "Chemistry", day: day(0), minutes: 40 }], now: NOW,
    });
    assert.equal(s.usualMinutes, null);
    assert.equal(s.weekMinutes, 40);
});

check("the next assessment is the next one, and past ones do not count", () => {
    const assessments = [
        { subject_name: "Chemistry", due_date: day(30), title: "Long gone" },
        { subject_name: "Chemistry", due_date: day(-20), title: "Unit 4 SAC" },
        { subject_name: "Chemistry", due_date: day(-5), title: "Prac report" },
        { subject_name: "Chemistry", due_date: day(-3), title: "Done already", is_completed: true },
    ];
    const s = subjectStats("Chemistry", { assessments, now: NOW });
    assert.equal(s.nextAssessment.title, "Prac report");
    assert.equal(s.nextAssessment.daysAway, 5);
});

// ─── the lead line ──────────────────────────────────────────────────────────

const base = { due: 0, mistakes: 0, nextAssessment: null };

check("a SAC inside a fortnight outranks everything", () => {
    const lead = subjectLead(
        { ...base, due: 40, mistakes: 9, nextAssessment: { daysAway: 3, title: "Unit 3 SAC" } },
        { total: 5, untouched: ["X"] }, { heaviest: { component: "Exam 2", percentage: 44 } },
    );
    assert.equal(lead.kind, "assessment");
});

check("an assessment further out than the window does not lead", () => {
    const lead = subjectLead(
        { ...base, due: 6, nextAssessment: { daysAway: SOON_DAYS + 1 } }, null, null);
    assert.equal(lead.kind, "due", "a SAC a month away is not today's problem");
});

check("marks you are dropping outrank the review pile", () => {
    const lead = subjectLead({ ...base, due: 30, mistakes: 2 }, null, null);
    assert.equal(lead.kind, "mistakes");
});

check("with nothing to do it falls back to what the marks are worth", () => {
    const lead = subjectLead({ ...base }, { total: 3, untouched: [] },
        { heaviest: { component: "Exam 2", percentage: 44 } });
    assert.equal(lead.kind, "weight");
});

check("and with nothing real to say it says nothing", () => {
    assert.equal(subjectLead({ ...base }, { total: 0, untouched: [] }, { heaviest: null }), null);
    assert.equal(subjectLead(null, null, null), null);
});

console.log(`\n${passed} passed`);
