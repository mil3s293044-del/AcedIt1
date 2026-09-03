/**
 * quizInsight assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizInsight.test.mjs
 *
 * These exist for one class of bug: a "wrong only" retry is a run at the HARD
 * SUBSET of a quiz, and every reader that treated it as a run at the whole
 * quiz got something wrong in a way a student would notice and could not
 * explain. Its score became the quiz's retention, its title renamed the quiz
 * in the fading list, and — worst — its per-question results were indexed
 * against the subset, so a miss on question 5 was recorded against question 1
 * and the drill built from it re-asked the wrong question.
 */
import assert from "node:assert/strict";
import {
    isRetryAttempt, isLegacyRetry, baseQuizTitle, weakSpots, retrievalStrength,
    workQueue, autoBankRows, buildDrillQuestions,
} from "@/lib/quizInsight";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);

const QUIZ = {
    id: "q1", title: "Polymers — Quick Quiz", subject: "Chemistry",
    questions: [
        { question: "Explain why a thermoset does not melt.", type: "short",
          model_answer: "Cross-links are covalent and are not broken by heating.", marks: 4 },
        { question: "Identify the functional group.", type: "mcq",
          options: ["Ester", "Amine", "Ketone"], correct_answer: 1,
          explanation: "The N–H stretch is diagnostic." },
        { question: "Describe addition polymerisation.", type: "short" },
    ],
};

// A full sit, then another: question 0 missed both times.
const attempt = (over = {}) => ({
    quiz_id: "q1", quiz_title: "Polymers — Quick Quiz", score: 50, date: ago(3),
    extra: { question_results: [
        { q_index: 0, question: QUIZ.questions[0].question, is_correct: false, marks: 0, marks_max: 4,
          command_term: { term: "explain", tier: "explain", tierLabel: "Explain", tone: "xp" } },
        { q_index: 1, question: QUIZ.questions[1].question, is_correct: true, marks: 1, marks_max: 1,
          command_term: { term: "identify", tier: "recall", tierLabel: "Recall", tone: "chart-3" } },
    ] },
    ...over,
});

// ─── telling a retry apart ──────────────────────────────────────────────────

check("a retry is recognised by its flag, and by its title when it predates one", () => {
    assert.ok(isRetryAttempt({ extra: { is_retry: true }, quiz_title: "Anything" }));
    assert.ok(isRetryAttempt({ quiz_title: "Methods — wrong only" }));
    assert.ok(!isRetryAttempt({ quiz_title: "Methods" }));
    assert.equal(baseQuizTitle("Methods — wrong only"), "Methods");
    assert.equal(baseQuizTitle("Methods"), "Methods");
});

check("only a retry saved WITHOUT the flag has untrustworthy indices", () => {
    // The flag is what says "q_index counts positions in the parent quiz".
    assert.ok(isLegacyRetry({ quiz_title: "Methods — wrong only" }));
    assert.ok(!isLegacyRetry({ quiz_title: "Methods — wrong only", extra: { is_retry: true } }));
    assert.ok(!isLegacyRetry({ quiz_title: "Methods" }));
});

// ─── the fading list ────────────────────────────────────────────────────────

check("a retry is not the quiz's most recent result", () => {
    // This is the "Mathematical Methods — wrong only · 0%" row: a student who
    // had just gone back over their misses, told their retention had collapsed.
    const rows = retrievalStrength([QUIZ], [
        attempt({ score: 80, date: ago(2) }),
        attempt({ score: 0, date: ago(0), quiz_title: "Polymers — Quick Quiz — wrong only",
                  extra: { is_retry: true, question_results: [] } }),
    ]);
    assert.equal(rows.length, 1, "one quiz, one row");
    assert.equal(rows[0].lastScore, 80, "the full sit is the last real score");
    assert.equal(rows[0].title, "Polymers — Quick Quiz", "a retry must not rename the quiz");
});

check("the title comes from the quiz, never from a retry's attempt row", () => {
    const rows = retrievalStrength([], [
        attempt({ quiz_id: null, quiz_title: "Legal — wrong only", extra: { question_results: [] } }),
        attempt({ quiz_id: null, quiz_title: "Legal", date: ago(9), extra: { question_results: [] } }),
    ]);
    assert.equal(rows.length, 1, "the retry must group with its parent, not beside it");
    assert.equal(rows[0].title, "Legal");
});

// ─── weak spots ─────────────────────────────────────────────────────────────

check("two misses of the same question is a weak spot; one is not", () => {
    assert.equal(weakSpots([attempt()]).length, 0, "one miss is noise");
    const spots = weakSpots([attempt({ date: ago(5) }), attempt({ date: ago(1) })]);
    assert.equal(spots.length, 1);
    assert.equal(spots[0].qIndex, 0);
    assert.equal(spots[0].missed, 2);
    assert.equal(spots[0].seen, 2);
});

check("a legacy retry cannot pin its misses on the wrong question", () => {
    // Its q_index 0 means "the first question I was shown", which was question
    // 2 of the quiz. Trusting it would report a miss on question 0 — one the
    // student may have got right — and drill that.
    const legacy = {
        quiz_id: "q1", quiz_title: "Polymers — Quick Quiz — wrong only", score: 0, date: ago(1),
        extra: { question_results: [{ q_index: 0, question: "Describe addition polymerisation.", is_correct: false }] },
    };
    assert.equal(weakSpots([attempt(), legacy]).length, 0);
});

check("a retry that recorded parent indices IS counted", () => {
    const modern = {
        quiz_id: "q1", quiz_title: "Polymers — Quick Quiz — wrong only", score: 0, date: ago(1),
        extra: { is_retry: true, question_results: [
            { q_index: 0, question: QUIZ.questions[0].question, is_correct: false }] },
    };
    const spots = weakSpots([attempt(), modern]);
    assert.equal(spots.length, 1);
    assert.equal(spots[0].qIndex, 0);
    assert.equal(spots[0].missed, 2);
});

check("a spot names the quiz, not the retry it was last seen in", () => {
    const modern = {
        quiz_id: "q1", quiz_title: "Polymers — Quick Quiz — wrong only", score: 0, date: ago(1),
        extra: { is_retry: true, question_results: [
            { q_index: 0, question: QUIZ.questions[0].question, is_correct: false }] },
    };
    assert.equal(weakSpots([attempt(), modern])[0].quizTitle, "Polymers — Quick Quiz");
});

check("a spot the student has since got right drops off", () => {
    const fixed = attempt({ date: ago(0), extra: { question_results: [
        { q_index: 0, question: QUIZ.questions[0].question, is_correct: true, marks: 4, marks_max: 4 }] } });
    assert.equal(weakSpots([attempt(ago(5)), attempt(), fixed]).length, 0);
});

check("the drill rebuilds the real questions, by parent index", () => {
    const spots = weakSpots([attempt({ date: ago(5) }), attempt({ date: ago(1) })]);
    const qs = buildDrillQuestions(spots, [QUIZ]);
    assert.equal(qs.length, 1);
    assert.equal(qs[0].question, QUIZ.questions[0].question);
});

// ─── the one queue ──────────────────────────────────────────────────────────

check("evidence sorts above estimate, and each row says which it is", () => {
    const stale = {
        quiz_id: "q2", quiz_title: "Legal — Remedies", score: 50, date: ago(90),
        extra: { question_results: [] },
    };
    const q = workQueue([QUIZ, { id: "q2", title: "Legal — Remedies", questions: [] }],
        [attempt({ date: ago(5) }), attempt({ date: ago(1) }), stale]);
    assert.equal(q.rows[0].kind, "miss", "a demonstrated miss outranks a decay estimate");
    assert.ok(q.rows.some(r => r.kind === "fade"));
    assert.match(q.rows[0].detail, /missed 2 of 2/);
});

check("a quiz that is not overdue is not in the queue", () => {
    const fresh = { quiz_id: "q2", quiz_title: "Legal", score: 90, date: ago(0), extra: { question_results: [] } };
    assert.equal(workQueue([], [fresh]).stale.length, 0);
});

// ─── banking itself ─────────────────────────────────────────────────────────

check("a repeated miss becomes a bank card with a real back", () => {
    const spots = weakSpots([attempt({ date: ago(5) }), attempt({ date: ago(1) })]);
    const rows = autoBankRows(spots, [QUIZ], [], { topic: "Mistake bank", unit: "Mistake bank" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].topic, "Mistake bank");
    assert.equal(rows[0].unit, "Mistake bank", "unit is constant or the shelf splits the bank");
    assert.equal(rows[0].subject_name, "Chemistry");
    assert.ok(rows[0].is_weak_spot, "missed twice IS a demonstrated weak spot");
    assert.match(rows[0].answer, /Cross-links are covalent/);
    assert.equal(rows[0].extra.mistake.source, "quiz:q1:0");
    assert.ok(rows[0].extra.mistake.auto);
});

check("an MCQ banks the correct OPTION, not its index", () => {
    const twice = (i) => ({ quiz_id: "q1", quiz_title: "Polymers — Quick Quiz", date: ago(i),
        extra: { question_results: [{ q_index: 1, question: QUIZ.questions[1].question, is_correct: false }] } });
    const rows = autoBankRows(weakSpots([twice(5), twice(1)]), [QUIZ], []);
    assert.equal(rows.length, 1);
    assert.match(rows[0].answer, /Amine/);
    assert.match(rows[0].answer, /N–H stretch/, "the explanation is worth having on the back");
});

check("no model answer and no explanation means NO card", () => {
    // A card whose back reads "the correct answer" spends a real mistake on
    // nothing, and the student cannot get it back.
    const twice = (i) => ({ quiz_id: "q1", quiz_title: "Polymers", date: ago(i),
        extra: { question_results: [{ q_index: 2, question: QUIZ.questions[2].question, is_correct: false }] } });
    assert.equal(autoBankRows(weakSpots([twice(5), twice(1)]), [QUIZ], []).length, 0);
});

check("banking is idempotent — a reworded question does not re-bank", () => {
    const spots = weakSpots([attempt({ date: ago(5) }), attempt({ date: ago(1) })]);
    const first = autoBankRows(spots, [QUIZ], []);
    const again = autoBankRows(spots, [QUIZ], first);
    assert.equal(again.length, 0, "keyed on the question, not on its wording");
    // Also true of a card the student banked by hand from the same source.
    assert.equal(autoBankRows(spots, [QUIZ],
        [{ extra: { mistake: { source: "quiz:q1:0" } } }]).length, 0);
});

console.log(`\n${passed} passed`);
