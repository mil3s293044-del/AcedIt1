/**
 * toolBrief — the brief that replaced a blank chat box.
 *
 * The things asserted here are the ones that RENDER PERFECTLY and are simply
 * wrong about the student they describe: a percentage multiplied twice, a zero
 * read as evidence, a model call smuggled into a module whose whole argument is
 * that it makes none.
 */
import assert from "node:assert/strict";
import {
    personaFor, assessmentCard, repeatCard, weakTopicCard, slippingCard,
    toolBrief, BRIEF_MAX,
} from "./toolBrief.js";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

const NOW = new Date("2026-10-04T09:00:00+10:00");
const inDays = (d) => {
    const t = new Date(NOW); t.setDate(t.getDate() + d);
    return t.toISOString().slice(0, 10);
};

/* ── Routing ─────────────────────────────────────────────────────────────── */

ok("a subject routes to the persona that marks its work", () => {
    assert.equal(personaFor("Mathematical Methods"), "math_tutor");
    assert.equal(personaFor("Specialist Mathematics"), "math_tutor");
    assert.equal(personaFor("English"), "english_mentor");
    assert.equal(personaFor("Literature"), "english_mentor");
    assert.equal(personaFor("English (EAL)"), "english_mentor");
    // Anything unrecognised gets the general examiner rather than a guess.
    assert.equal(personaFor("Chemistry"), "exam_questions");
    assert.equal(personaFor(""), "exam_questions");
    assert.equal(personaFor(null), "exam_questions");
});

/* ── Assessments ─────────────────────────────────────────────────────────── */

ok("the NEAREST assessment wins, and a far one is not offered at all", () => {
    const rows = [
        { id: "a", subject_name: "Chemistry", title: "Unit 4 SAC", due_date: inDays(9) },
        { id: "b", subject_name: "Biology", title: "Prac report", due_date: inDays(2) },
        { id: "c", subject_name: "Legal", title: "Essay", due_date: inDays(90) },
    ];
    const card = assessmentCard(rows, NOW);
    assert.equal(card.subject, "Biology");
    assert.match(card.fact, /in 2 days/);
});

ok("a completed or past assessment is never offered", () => {
    assert.equal(assessmentCard(
        [{ id: "a", subject_name: "Chemistry", due_date: inDays(3), is_completed: true }], NOW), null);
    assert.equal(assessmentCard(
        [{ id: "b", subject_name: "Chemistry", due_date: inDays(-3) }], NOW), null);
    // A row with no subject cannot be routed to a persona, so it is skipped
    // rather than sent to a general one about nothing.
    assert.equal(assessmentCard([{ id: "c", due_date: inDays(1) }], NOW), null);
});

ok("today and tomorrow are words, not \"in 0 days\"", () => {
    const a = assessmentCard([{ id: "x", subject_name: "Chemistry", due_date: inDays(0) }], NOW);
    assert.match(a.fact, /today/);
    const b = assessmentCard([{ id: "y", subject_name: "Chemistry", due_date: inDays(1) }], NOW);
    assert.match(b.fact, /tomorrow/);
});

/* ── The weak-topic card, and the percentage that is already a percentage ── */

// THE REAL COLUMNS, read off supabase/schema.json rather than invented. The
// first draft of this fixture wrote `times_reviewed` / `times_correct`, which
// are not flashcard columns at all, so weakTopicsFrom counted zero reviews and
// every assertion here passed or failed for the wrong reason — the same shape
// the queue probe hit writing `correct:` where the table carries `is_correct`.
const weakCard = (over) => ({
    id: "c1", subject_name: "Chemistry", topic: "Redox", is_active: true,
    total_reviews: 10, review_count_good: 3, review_count_easy: 0,
    is_weak_spot: true, ...over,
});

ok("A MISS RATE IS ALREADY A PERCENTAGE and is never multiplied again", () => {
    const card = weakTopicCard([weakCard()]);
    assert.ok(card, "a topic with real misses makes a card");
    const pct = Number(/(\d+)%/.exec(card.fact)[1]);
    assert.ok(pct > 0 && pct <= 100, `miss rate printed as ${pct}%, which is not a percentage`);
});

ok("A 0% MISS RATE IS NOT EVIDENCE OF COSTING MARKS", () => {
    // weakTopicsFrom keeps a topic on `weakCards > 0` ALONE, so a deck whose
    // every review LANDED still arrives with a real missRate of 0 — and
    // `missRate != null` is true of 0. Printing "0% of your reviews missed"
    // under an offer to fix it is the app telling a student their clean record
    // is the problem.
    const clean = weakCard({ total_reviews: 10, review_count_good: 10 });
    assert.equal(weakTopicCard([clean]), null);
});

ok("a topic with NO reviews behind it is not scored at all", () => {
    // missRate is null there, and Number(null) is 0 — the trap that would make
    // an unopened topic read as a perfect record rather than as no record.
    const fresh = weakCard({ total_reviews: 0, review_count_good: 0 });
    assert.equal(weakTopicCard([fresh]), null);
});

ok("a maths topic goes to the tutor and everything else to the explainer", () => {
    const m = weakTopicCard([weakCard({ subject_name: "Mathematical Methods" })]);
    assert.equal(m.tool, "math_tutor");
    const c = weakTopicCard([weakCard({ subject_name: "Chemistry" })]);
    assert.equal(c.tool, "concept_explainer");
});

/* ── Repeats ─────────────────────────────────────────────────────────────── */

const bankCard = (criterion, subject, i) => ({
    id: `m${i}`, topic: "Mistake bank", subject_name: subject, is_active: true,
    question: "q", answer: "a",
    extra: { mistake: { criterion, topic: "Bonding", question: "Q", cost: 1 } },
});

ok("ONE drop is an instance; a card is only made for a repeat", () => {
    const once = [bankCard("links structure to property", "Chemistry", 1)];
    assert.equal(repeatCard(once), null);
    const twice = [
        bankCard("links structure to property", "Chemistry", 1),
        bankCard("links structure to property", "Chemistry", 2),
    ];
    const card = repeatCard(twice);
    assert.ok(card, "two drops of one criterion is a pattern worth naming");
    assert.match(card.fact, /2 times/);
    assert.equal(card.subject, "Chemistry");
});

ok("a criterion dropped across TWO subjects names neither", () => {
    // `subjects` is a set of every subject it was dropped in. Naming one of
    // several would be picking arbitrarily, and the fact is about the writing
    // rather than about a subject.
    const card = repeatCard([
        bankCard("does not name the transfer", "Chemistry", 1),
        bankCard("does not name the transfer", "Biology", 2),
    ]);
    assert.ok(card);
    assert.equal(card.subject, null);
    assert.ok(!/Chemistry|Biology/.test(card.fact), "it must not claim one of the two");
});

/* ── Slipping ────────────────────────────────────────────────────────────── */

ok("slipping cards go to TEACH IT BACK, never to an explainer", () => {
    // The student has already met this material and RECALL is what failed, so
    // being told it again is recognition — the illusion drill.js refuses.
    const old = {
        id: "s1", subject_name: "Biology", topic: "Cells", is_active: true,
        total_reviews: 4, review_count_good: 4, interval_days: 2,
        last_reviewed_date: "2026-01-01", next_review_date: "2026-01-03",
    };
    const card = slippingCard([old], NOW.getTime());
    if (card) {
        assert.equal(card.tool, "teaching_assistant");
        assert.equal(card.subject, "Biology");
    }
});

/* ── The brief ───────────────────────────────────────────────────────────── */

ok("AN EMPTY ACCOUNT GETS NO CARDS AND NO LEAD", () => {
    assert.deepEqual(toolBrief({}), []);
});

ok("NO BUILDER PADS THE BRIEF with a row whose number is not real", () => {
    // Every card printed must carry a figure above zero somewhere in its fact,
    // or a date. A brief that reaches a respectable length on zeroes teaches a
    // student the numbers here are decoration.
    const b = toolBrief({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(3) }],
        bankCards: [
            bankCard("links structure to property", "Chemistry", 1),
            bankCard("links structure to property", "Chemistry", 2),
        ],
        cards: [weakCard()],
        now: NOW,
    });
    assert.ok(b.length >= 2, "a loaded account gets several cards");
    for (const c of b) {
        assert.ok(!/\b0\b\s*(%|times|cards)/.test(c.fact), `zero row: ${c.fact}`);
        assert.ok(c.seed && c.seed.length > 20, "every card carries a real opening message");
        assert.ok(c.tool, "every card names a tool");
    }
});

ok("the brief is capped and sorted by what it costs to skip", () => {
    const b = toolBrief({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(1) }],
        bankCards: [
            bankCard("links structure to property", "Chemistry", 1),
            bankCard("links structure to property", "Chemistry", 2),
        ],
        cards: [weakCard()],
        now: NOW,
    });
    assert.ok(b.length <= BRIEF_MAX, "never more than the cap");
    // A DATE LEADS. It is the only thing here that cannot be moved.
    assert.equal(b[0].kind, "assessment");
    for (let i = 1; i < b.length; i++) {
        assert.ok(b[i - 1].urgency >= b[i].urgency, "sorted by urgency");
    }
});

ok("THERE IS NO SEPARATE LEAD, because it printed the first card twice", () => {
    // `briefLead` returned cards[0].fact, which the first card then printed
    // again in bold directly below it. One sentence, twice, on a screen whose
    // whole claim is that every line on it is worth reading. The heading frames
    // instead, and the cards lead themselves — so nothing may export a lead.
    const src = readFileSync(new URL("./toolBrief.js", import.meta.url), "utf8");
    assert.ok(!/export function briefLead/.test(src), "a lead would duplicate card one");
});

/* ── The property the whole module rests on ──────────────────────────────── */

ok("NOTHING HERE CALLS A MODEL, asserted as an absence", () => {
    // The diagnosis is arithmetic so a student can check it; the agent is what
    // they hand it to. An agent that reads the data and writes the diagnosis is
    // what was deleted from Insights, and it would arrive here by somebody
    // importing streamingAI or invoking a function from this module.
    const src = readFileSync(new URL("./toolBrief.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["streamingAI", "invoke(", "InvokeLLM", "fetch(", "anthropic"]) {
        assert.ok(!src.includes(bad), `toolBrief must not reach for ${bad}`);
    }
});

ok("NOTHING IS STORED, so a card cannot go stale", () => {
    const src = readFileSync(new URL("./toolBrief.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of [".create(", ".update(", "localStorage", "sessionStorage"]) {
        assert.ok(!src.includes(bad), `toolBrief must not write ${bad}`);
    }
});

console.log(`\ntoolBrief: ${n} checks passed`);
