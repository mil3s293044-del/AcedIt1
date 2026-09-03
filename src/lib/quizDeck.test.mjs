/**
 * quiz deck face assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizDeck.test.mjs
 *
 * Two of these rules are the kind that go wrong silently and are then believed
 * by the student: a card showing a lower score than the results page just did,
 * and a "retry what you got wrong" that hands back questions they got right.
 */
import assert from "node:assert/strict";
import { quizDeckStats, effectiveScore } from "@/lib/quizDeck";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const QUIZ = {
    id: "q1",
    questions: [
        { type: "mcq", correct_answer: 1 },
        { type: "short" },
        { type: "mcq", correct_answer: 0 },
    ],
};

check("a quiz nobody has sat has no score, which is not a score of zero", () => {
    const s = quizDeckStats(QUIZ, []);
    assert.equal(s.bestScore, null, "null and 0 print different words on the face");
    assert.equal(s.avgScore, null);
    assert.equal(s.attempts, 0);
    assert.deepEqual(s.wrongIdx, []);
});

check("the adjusted score wins, because it is the one they were shown", () => {
    // Self-marked written work lands in adjusted_score. A card reading the raw
    // score would say 40% under a results page that just said 78%.
    const s = quizDeckStats(QUIZ, [
        { quiz_id: "q1", score: 40, adjusted_score: 78, created_date: "2026-08-01" },
    ]);
    assert.equal(s.bestScore, 78);
    assert.equal(effectiveScore({ score: 40, adjusted_score: 78 }), 78);
    assert.equal(effectiveScore({ score: 40 }), 40, "raw score when there is no adjustment");
    assert.equal(effectiveScore({ score: 0, adjusted_score: 0 }), 0, "zero is a real adjustment");
});

check("best is the best of them, not the latest", () => {
    const s = quizDeckStats(QUIZ, [
        { quiz_id: "q1", score: 90, created_date: "2026-08-01" },
        { quiz_id: "q1", score: 55, created_date: "2026-08-09" },
    ]);
    assert.equal(s.bestScore, 90);
    assert.equal(s.avgScore, 73);
    assert.equal(s.attempts, 2);
});

check("other quizzes' attempts are not this quiz's", () => {
    const s = quizDeckStats(QUIZ, [
        { quiz_id: "q1", score: 50 },
        { quiz_id: "somethingelse", score: 100 },
    ]);
    assert.equal(s.attempts, 1);
    assert.equal(s.bestScore, 50);
});

check("wrong means wrong, and short answers are not gradeable", () => {
    // Index 1 is a short answer with no correct_answer stored. Including it
    // would hand back a question they may well have answered fine.
    const s = quizDeckStats(QUIZ, [{
        quiz_id: "q1", score: 50, created_date: "2026-08-02",
        user_answers: { 0: "1", 1: "anything", 2: "1" },
    }]);
    assert.deepEqual(s.wrongIdx, [2], "only the MCQ they actually got wrong");
});

check("an MCQ left blank counts as wrong", () => {
    const s = quizDeckStats(QUIZ, [{
        quiz_id: "q1", score: 30, created_date: "2026-08-02", user_answers: { 0: "1" },
    }]);
    assert.deepEqual(s.wrongIdx, [2]);
});

check("wrong comes from the MOST RECENT attempt, not the best one", () => {
    // Retrying "the ones you got wrong" means the ones you just got wrong.
    const s = quizDeckStats(QUIZ, [
        { quiz_id: "q1", score: 100, created_date: "2026-08-01", user_answers: { 0: "1", 2: "0" } },
        { quiz_id: "q1", score: 0, created_date: "2026-08-09", user_answers: { 0: "9", 2: "9" } },
    ]);
    assert.equal(s.bestScore, 100);
    assert.deepEqual(s.wrongIdx, [0, 2]);
});

check("string answers compare as numbers", () => {
    // user_answers comes back off JSON with the indices as strings.
    const s = quizDeckStats(QUIZ, [{
        quiz_id: "q1", score: 100, created_date: "2026-08-02", user_answers: { 0: "1", 2: "0" },
    }]);
    assert.deepEqual(s.wrongIdx, [], "'1' is the right answer to a question whose key is 1");
});

check("a shape we did not expect counts nothing rather than throwing", () => {
    for (const [quiz, attempts] of [
        [null, null], [{}, undefined], [QUIZ, "nope"], [{ id: "q1", questions: "nope" }, []],
    ]) {
        assert.doesNotThrow(() => quizDeckStats(quiz, attempts));
        const s = quizDeckStats(quiz, attempts);
        assert.equal(s.bestScore, null);
        assert.deepEqual(s.wrongIdx, []);
    }
});

check("an attempt with no usable score does not drag the average", () => {
    const s = quizDeckStats(QUIZ, [
        { quiz_id: "q1", score: 80 },
        { quiz_id: "q1", score: null },
        { quiz_id: "q1" },
    ]);
    assert.equal(s.attempts, 3, "they did sit it three times");
    assert.equal(s.bestScore, 80);
    assert.equal(s.avgScore, 80, "and only one of them can be scored");
});

// ─── a retry is not a sit ───────────────────────────────────────────────────

check("a retry does not decide what is left to fix", () => {
    // The retry's answers are keyed by ITS positions, so reading them against
    // the parent quiz compares each answer to the wrong question. Before this
    // was fixed, one press of "retry the wrong ones" made every number on the
    // deck face arbitrary from then on.
    const quiz = { id: "q", questions: [
        { type: "mcq", correct_answer: 0 },
        { type: "mcq", correct_answer: 1 },
        { type: "mcq", correct_answer: 2 },
    ] };
    const sit = { quiz_id: "q", score: 33, created_date: "2026-01-01",
        user_answers: { 0: 0, 1: 0, 2: 0 } };            // got 1 and 2 wrong
    const retry = { quiz_id: "q", score: 100, created_date: "2026-01-09",
        quiz_title: "Q — wrong only", extra: { is_retry: true },
        user_answers: { 0: 1, 1: 2 } };                  // both right, in retry order
    const s = quizDeckStats(quiz, [sit, retry]);
    assert.deepEqual(s.wrongIdx, [1, 2], "still read from the last full sit");
    assert.equal(s.bestScore, 33, "a subset score is not the quiz's best");
    assert.equal(s.attempts, 2, "but a retry is still work the student did");
});

console.log(`\n${passed} passed`);
