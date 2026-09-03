/**
 * quiz deck face assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizDeck.test.mjs
 *
 * Two of these rules are the kind that go wrong silently and are then believed
 * by the student: a card showing a lower score than the results page just did,
 * and a "retry what you got wrong" that hands back questions they got right.
 */
import assert from "node:assert/strict";
import { quizDeckStats, effectiveScore, quizzingSummary } from "@/lib/quizDeck";

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

// ─── the hero panel agrees with the shelf beneath it ────────────────────────

check("the headline best is the score the student was shown", () => {
    // The results screen and the deck face both print `adjusted_score` where
    // the student marked their own written work. The panel above them read the
    // raw `score`, so it printed a lower number than the two things either
    // side of it — and it is the panel a student would assume was right.
    const attempts = [
        { quiz_id: "q1", score: 60, adjusted_score: 78, created_date: "2026-02-01T09:00:00Z" },
    ];
    const hero = quizzingSummary([{ id: "q1" }], attempts);
    const face = quizDeckStats({ id: "q1", questions: [] }, attempts);
    assert.equal(hero.bestScore, 78);
    assert.equal(hero.bestScore, face.bestScore, "panel and face must agree");
});

check("an attempt that was never scored is not a zero", () => {
    const hero = quizzingSummary([{}], [
        { score: 80, created_date: "2026-02-01T09:00:00Z" },
        { score: null, created_date: "2026-02-02T09:00:00Z" },
    ]);
    assert.equal(hero.avgScore, 80, "an unmarked sit drags nothing down");
    assert.equal(hero.avgOver, 1, "and the label says it averaged one");
});

check("last 5 means the last 5 even when they are all the same day", () => {
    // `date` is written as a DAY, so sorting on it tied every sit made in one
    // afternoon and the winner was whatever order the rows arrived in.
    const day = "2026-02-01";
    const attempts = [
        { score: 10, date: day, created_date: "2026-02-01T09:00:00Z" },
        { score: 20, date: day, created_date: "2026-02-01T10:00:00Z" },
        { score: 30, date: day, created_date: "2026-02-01T11:00:00Z" },
        { score: 40, date: day, created_date: "2026-02-01T12:00:00Z" },
        { score: 50, date: day, created_date: "2026-02-01T13:00:00Z" },
        { score: 99, date: day, created_date: "2026-02-01T14:00:00Z" },
    ];
    const hero = quizzingSummary([{}], attempts);
    assert.equal(hero.lastAttempt.score, 99, "the latest sit, not an arbitrary one");
    // The five most recent are 99, 50, 40, 30, 20 — the 10 falls out.
    assert.equal(hero.avgScore, Math.round((99 + 50 + 40 + 30 + 20) / 5));
});

check("a retry counts as an attempt and never as a score", () => {
    const hero = quizzingSummary([{}], [
        { score: 70, created_date: "2026-02-01T09:00:00Z" },
        { score: 0, created_date: "2026-02-02T09:00:00Z", extra: { is_retry: true } },
    ]);
    assert.equal(hero.totalAttempts, 2, "going back over your mistakes is work");
    assert.equal(hero.avgScore, 70, "but it is not a mark on the whole paper");
    assert.equal(hero.bestScore, 70);
    assert.equal(hero.lastAttempt.score, 70, "and it is not your last sit");
});

check("nothing sat reports nothing rather than zero", () => {
    const hero = quizzingSummary([{ id: "a" }, { id: "b" }], []);
    assert.equal(hero.totalQuizzes, 2);
    assert.equal(hero.totalAttempts, 0);
    assert.equal(hero.avgScore, null, "a quiz nobody sat is not a nought");
    assert.equal(hero.bestScore, null);
    assert.equal(hero.lastAttempt, null);
});

console.log(`\n${passed} passed`);
