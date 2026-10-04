/**
 * workpieceSources — the student's own work, offered as things to work on.
 *
 * The assertions here are the ones that would put a BENCH ON SCREEN WITH
 * NOTHING USABLE ON IT: a candidate whose body never saved, a mistake card
 * carrying only its sixty-character pill, a ref pointing at a page that is not
 * a route.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    candidates, missedQuestions, droppedCriteria,
    upcomingAssessments, slippingSubjects, CANDIDATE_MAX,
} from "./workpieceSources.js";
import { isKind, SOURCES } from "./workpiece.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

const NOW = new Date("2026-10-04T09:00:00+10:00");
const inDays = (d) => { const t = new Date(NOW); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

const bankCard = (over = {}) => ({
    id: over.id || "m1", topic: "Mistake bank", subject_name: "Chemistry", is_active: true,
    question: "q", answer: "a",
    extra: { mistake: {
        criterion: "links the structure to the property",
        topic: "Bonding",
        question: "Explain why graphite conducts electricity but diamond does not.",
        question_title: "Explain why graphite conducts",
        cost: 1,
    } },
    ...over,
});

/* ── Assessments ─────────────────────────────────────────────────────────── */

ok("AN ASSESSMENT IS A TOPIC, so nothing offers to mark it", () => {
    // There is no written response yet — that is the whole reason a student is
    // preparing. A bench offering "mark it" on a SAC that has not happened is
    // the app not understanding what it is holding.
    const out = upcomingAssessments(
        [{ id: "a", subject_name: "Chemistry", title: "Unit 4 SAC", due_date: inDays(4) }], NOW);
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, "topic");
    assert.equal(out[0].subject, "Chemistry");
    assert.match(out[0].body, /in 4 days/);
});

ok("a completed or distant assessment is not offered", () => {
    assert.deepEqual(upcomingAssessments(
        [{ id: "a", subject_name: "Chem", due_date: inDays(3), is_completed: true }], NOW), []);
    assert.deepEqual(upcomingAssessments(
        [{ id: "b", subject_name: "Chem", due_date: inDays(99) }], NOW), []);
    // No subject means nothing can be routed to a persona.
    assert.deepEqual(upcomingAssessments([{ id: "c", due_date: inDays(2) }], NOW), []);
});

ok("the nearest assessment comes first", () => {
    const out = upcomingAssessments([
        { id: "a", subject_name: "Chemistry", title: "Far", due_date: inDays(10) },
        { id: "b", subject_name: "Biology", title: "Near", due_date: inDays(1) },
    ], NOW);
    assert.equal(out[0].subject, "Biology");
});

/* ── Dropped criteria ────────────────────────────────────────────────────── */

ok("THE WHOLE QUESTION IS THE WORKPIECE, the criterion is the title", () => {
    // What has to be got right next time is the question. The criterion names
    // which mark, and belongs in the heading.
    const out = droppedCriteria([bankCard({ id: "m1" }), bankCard({ id: "m2" })]);
    assert.equal(out.length, 1, "one criterion, one candidate");
    assert.match(out[0].body, /graphite conducts electricity/);
    assert.equal(out[0].title, "links the structure to the property");
    assert.equal(out[0].source, "mistake");
});

ok("ONE DROP IS NOT A PATTERN and is not offered", () => {
    assert.deepEqual(droppedCriteria([bankCard({ id: "only" })]), []);
});

ok("A CARD CARRYING ONLY ITS CLIPPED PILL IS SKIPPED", () => {
    // `mistakeMeta.question` falls back to `question_title`, which is a sixty
    // character clip for a pill — on a maths question that is a formula cut off
    // mid-expression. Opening a bench on it would be the failure `autoBankRows`
    // was deleted for, so the fallback is detected and the card skipped.
    const clipped = (id) => bankCard({ id, extra: { mistake: {
        criterion: "names the reagent",
        question_title: "Identify the reagent used in the",
        // no `question` at all — meta falls back to the title
    } } });
    assert.deepEqual(droppedCriteria([clipped("a"), clipped("b")]), []);
});

ok("a card that is not a bank card is never a mistake candidate", () => {
    const deck = bankCard({ id: "d", topic: "Chemistry" });   // a real flashcard
    assert.deepEqual(droppedCriteria([deck, deck]), []);
});

/* ── Missed questions ────────────────────────────────────────────────────── */

ok("a question with no text is skipped rather than opened empty", () => {
    const quizzes = [{ id: "q1", title: "Redox", subject: "Chemistry", questions: [{ question: "" }] }];
    const attempts = [{
        quiz_id: "q1", created_by: "x", score: 10,
        extra: { question_results: [{ q_index: 0, is_correct: false }] },
    }];
    assert.deepEqual(missedQuestions(quizzes, attempts, []), []);
});

/* ── Slipping ────────────────────────────────────────────────────────────── */

ok("SLIPPING CARDS ARE MATERIAL, not a topic to explain from scratch", () => {
    // The student already met this; RECALL is what failed. Being explained it
    // again is recognition, which drill.js refuses by name.
    const old = {
        id: "s1", subject_name: "Biology", topic: "Cells", is_active: true,
        total_reviews: 6, review_count_good: 6, interval_days: 2,
        last_reviewed_date: "2026-01-01", next_review_date: "2026-01-03",
    };
    const out = slippingSubjects([old], NOW.getTime());
    if (out.length) {
        assert.equal(out[0].kind, "material");
        assert.equal(out[0].subject, "Biology");
    }
});

/* ── The whole picker ────────────────────────────────────────────────────── */

ok("AN EMPTY ACCOUNT IS OFFERED NOTHING, which is a real answer", () => {
    assert.deepEqual(candidates({}), []);
});

ok("every candidate is usable: a real kind, a body, and a source", () => {
    const out = candidates({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(2) }],
        bankCards: [bankCard({ id: "m1" }), bankCard({ id: "m2" })],
        now: NOW,
    });
    assert.ok(out.length >= 2);
    for (const w of out) {
        assert.ok(isKind(w.kind), `unknown kind ${w.kind}`);
        assert.ok(w.body && w.body.trim().length > 0, "a candidate with no body");
        assert.ok(SOURCES[w.source], `unknown source ${w.source}`);
        assert.ok(w.title && w.title.trim().length > 0, "a candidate with no title");
    }
});

ok("THE DATE LEADS, because it is the only thing that cannot be moved", () => {
    const out = candidates({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(3) }],
        bankCards: [bankCard({ id: "m1" }), bankCard({ id: "m2" })],
        now: NOW,
    });
    assert.equal(out[0].source, "assessment");
});

ok("the picker is capped — it is a pick, not a list", () => {
    const many = [];
    for (let i = 0; i < 9; i++) {
        many.push({ id: `a${i}`, subject_name: `Subject ${i}`, title: `SAC ${i}`, due_date: inDays(i + 1) });
    }
    assert.ok(candidates({ assessments: many, now: NOW }).length <= CANDIDATE_MAX);
});

/* ── Refs ────────────────────────────────────────────────────────────────── */

ok("EVERY REF POINTS AT A REAL ROUTE", () => {
    // A header link that 404s is worse than no link. The page names are checked
    // against the app's own route table rather than a list written down here,
    // which would be the fifth copy this codebase keeps deleting.
    const cfg = readFileSync(new URL("../pages.config.js", import.meta.url), "utf8");
    const routes = new Set([...cfg.matchAll(/lazyPage\(\s*'([^']+)'/g)].map((m) => m[1]));
    assert.ok(routes.size > 10, "the route table was not parsed");

    const out = candidates({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(2) }],
        bankCards: [bankCard({ id: "m1" }), bankCard({ id: "m2" })],
        now: NOW,
    });
    for (const w of out) {
        if (!w.ref) continue;
        assert.ok(routes.has(w.ref.page), `${w.source} points at "${w.ref.page}", which is not a page`);
        assert.ok(w.ref.label, "a link with no words on it");
    }
});

ok("NOTHING HERE CALLS A MODEL OR STORES ANYTHING", () => {
    const src = readFileSync(new URL("./workpieceSources.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["InvokeLLM", "streamingAI", ".create(", ".update(", "localStorage"]) {
        assert.ok(!src.includes(bad), `workpieceSources must not reach for ${bad}`);
    }
});

console.log(`\nworkpieceSources: ${n} checks passed`);
