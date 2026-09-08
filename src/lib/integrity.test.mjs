/**
 * integrity assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/integrity.test.mjs
 *
 * These guard the three holes the compete audit found: minutes the client
 * invented, idle telemetry that was collected and ignored, and a five-question
 * quiz scored 100% sitting on a leaderboard next to somebody's real paper.
 *
 * The most important property across all of them is that an HONEST claim is
 * untouched. A rule that quietly shaves time off a student who actually did
 * the work is worse than the cheating it prevents.
 */
import assert from "node:assert/strict";
import {
    focusQuality, countableByDay, countableMinutes, TAB_AWAY_MINUTES,
    SESSION_MAX_MINUTES, DAILY_MINUTE_CAP,
    quizCountsForBoard, boardSits, BOARD_MIN_QUESTIONS,
    verifiedSplit, VERIFY_COVERS_HOURS,
} from "@/lib/integrity";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// Midday, so "minutes elapsed today" is a real constraint with room in it.
const NOON = new Date(2026, 8, 20, 12, 0, 0);
const day = (n) => {
    const d = new Date(2026, 8, 20 - n);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const sess = (dayStr, minutes, extra = {}) =>
    ({ date: dayStr, duration_minutes: minutes, ...extra });

// ─── the honest case, first and always ──────────────────────────────────────

check("AN HONEST SESSION IS UNTOUCHED", () => {
    // No telemetry at all — the overwhelmingly common row. It must not be
    // discounted for lacking signals it was never asked for.
    const q = focusQuality({ duration_minutes: 45 });
    assert.equal(q.counted, 45);
    assert.equal(q.discounted, 0);
    assert.equal(q.reason, null, "a clean session gives no reason, not an empty one");
});

check("a normal day of real study passes through whole", () => {
    const rows = [sess(day(1), 50), sess(day(1), 45), sess(day(1), 60)];
    assert.equal(countableMinutes(rows, NOON), 155);
});

// ─── idle telemetry, which used to be thrown away ───────────────────────────

check("idle time is discounted, and the reason is sayable", () => {
    const q = focusQuality({ duration_minutes: 60, idle_ratio: 0.25 });
    assert.equal(q.counted, 45);
    assert.equal(q.discounted, 15);
    assert.match(q.reason, /25% idle/);
});

check("each tab-away costs a flat minute, not a proportion", () => {
    // A glance at a message is a fixed interruption whatever the session's
    // length. Charged proportionally, a long honest session would pay more for
    // the same behaviour than a short one.
    const short = focusQuality({ duration_minutes: 20, tab_away_count: 3 });
    const long = focusQuality({ duration_minutes: 120, tab_away_count: 3 });
    assert.equal(short.claimed - short.counted, 3 * TAB_AWAY_MINUTES);
    assert.equal(long.claimed - long.counted, 3 * TAB_AWAY_MINUTES);
});

check("a session cannot be discounted below zero", () => {
    const q = focusQuality({ duration_minutes: 2, idle_ratio: 0.9, tab_away_count: 50 });
    assert.equal(q.counted, 0);
    assert.ok(q.discounted >= 0);
});

// ─── fabricated time ────────────────────────────────────────────────────────

check("ONE ROW CANNOT BE MORE THAN ONE SITTING", () => {
    const rows = [sess(day(1), 5000)];
    assert.equal(countableMinutes(rows, NOON), SESSION_MAX_MINUTES);
});

check("YOU CANNOT HAVE STUDIED MORE MINUTES TODAY THAN HAVE PASSED TODAY", () => {
    // The actual attack: ten POSTs of 240 minutes inside one second. At noon,
    // 720 minutes have passed, so the day is capped there and not at 2400.
    const rows = Array.from({ length: 10 }, () => sess(day(0), 240));
    const got = countableMinutes(rows, NOON);
    assert.equal(got, 720, "capped by the clock, not by the claim");
    assert.ok(got < 2400);

    // And earlier in the day the ceiling is lower still.
    const nineAm = new Date(2026, 8, 20, 9, 0, 0);
    assert.equal(countableMinutes(rows, nineAm), 540);
});

check("a past day gets the flat cap, because the clock no longer bounds it", () => {
    const rows = Array.from({ length: 10 }, () => sess(day(3), 240));
    assert.equal(countableMinutes(rows, NOON), DAILY_MINUTE_CAP);
});

check("the day reports that it was capped, so a surface can say so", () => {
    const byDay = countableByDay([sess(day(0), 240), sess(day(0), 240),
        sess(day(0), 240), sess(day(0), 240)], NOON);
    const today = byDay.get(day(0));
    assert.equal(today.capped, true);
    assert.equal(today.claimed, 960);
    assert.equal(today.counted, 720);

    const honest = countableByDay([sess(day(1), 90)], NOON).get(day(1));
    assert.equal(honest.capped, false, "an honest day must not be flagged");
});

check("both study tables are read, whichever column they use", () => {
    // study_sessions uses duration_minutes; study_techniques session_duration.
    const rows = [
        { date: day(1), duration_minutes: 30 },
        { date: day(1), session_duration: 45 },
    ];
    assert.equal(countableMinutes(rows, NOON), 75);
});

check("a row with no date is dropped rather than dated today", () => {
    assert.equal(countableMinutes([{ duration_minutes: 300 }], NOON), 0);
});

// ─── quiz boards ────────────────────────────────────────────────────────────

const quiz = (n, marks = 1) => ({
    questions: Array.from({ length: n }, () => ({ marks })),
});

check("a five-question warm-up does not belong on a leaderboard", () => {
    assert.equal(quizCountsForBoard(quiz(5)).ok, false);
    assert.equal(quizCountsForBoard(quiz(BOARD_MIN_QUESTIONS, 2)).ok, true);
});

check("length alone is not substance — the marks have to be there too", () => {
    // Ten one-mark questions is 10 marks, under the floor.
    assert.equal(quizCountsForBoard(quiz(10, 1)).ok, false);
    assert.equal(quizCountsForBoard(quiz(10, 2)).ok, true);
});

check("an MCQ with no stated allocation is worth one mark", () => {
    const q = { questions: Array.from({ length: 12 }, () => ({ type: "mcq" })) };
    assert.equal(quizCountsForBoard(q).ok, true, "12 questions at 1 mark clears 12");
});

check("a quiz counts ONCE, at its first sit, never its best", () => {
    // Sitting one easy quiz twenty times must not out-rank one real paper, and
    // taking the best sit rewards grinding until a good roll comes up.
    const quizzes = new Map([["q1", quiz(10, 2)], ["tiny", quiz(4)]]);
    const attempts = [
        { quiz_id: "q1", score: 55, created_date: "2026-09-01T09:00:00Z" },
        { quiz_id: "q1", score: 99, created_date: "2026-09-05T09:00:00Z" },
        { quiz_id: "tiny", score: 100, created_date: "2026-09-06T09:00:00Z" },
    ];
    const sits = boardSits(attempts, quizzes);
    assert.equal(sits.length, 1, "the tiny quiz does not qualify at all");
    assert.equal(sits[0].score, 55, "the first sit, not the best one");
});

check("a retry is not a sit", () => {
    const quizzes = new Map([["q1", quiz(10, 2)]]);
    const attempts = [
        { quiz_id: "q1", score: 0, created_date: "2026-09-01T09:00:00Z", extra: { is_retry: true } },
        { quiz_id: "q1", score: 70, created_date: "2026-09-02T09:00:00Z" },
    ];
    const sits = boardSits(attempts, quizzes, (a) => !!a?.extra?.is_retry);
    assert.equal(sits.length, 1);
    assert.equal(sits[0].score, 70);
});

// ─── verification ───────────────────────────────────────────────────────────

check("a passed call-out covers the study around it, not one row", () => {
    // A student proves they know a topic, not that a particular row is real.
    const rows = [sess(day(1), 60), sess(day(1), 30), sess(day(9), 60)];
    const v = verifiedSplit(rows, [{ created_date: day(1), passed: true }], NOON);
    assert.equal(v.verifiedMinutes, 90);
    assert.equal(v.unverifiedMinutes, 60, "the session nine days out is not covered");
    assert.ok(VERIFY_COVERS_HOURS > 0);
});

check("a FAILED call-out verifies nothing", () => {
    const rows = [sess(day(1), 60)];
    const v = verifiedSplit(rows, [{ created_date: day(1), passed: false }], NOON);
    assert.equal(v.verifiedMinutes, 0);
    assert.equal(v.unverifiedMinutes, 60);
});

check("A REAL CALL-OUT ROW IS READ BY ITS STATUS, NOT A MISSING BOOLEAN", () => {
    // `callouts` rows carry status: passed | failed | expired | voided | ...
    // and no `passed` field at all. A check for `passed !== false` waves every
    // one of them through, including the failures — which would make the
    // verification badge mean nothing at exactly the moment it matters.
    const rows = [sess(day(1), 60)];
    const at = day(1);
    assert.equal(verifiedSplit(rows, [{ created_date: at, status: "passed" }], NOON).verifiedMinutes, 60);
    for (const status of ["failed", "expired", "voided", "pending", "active"]) {
        assert.equal(
            verifiedSplit(rows, [{ created_date: at, status }], NOON).verifiedMinutes, 0,
            `status "${status}" must not verify anything`);
    }
    // An unrecognised status verifies nothing rather than defaulting to trust.
    assert.equal(verifiedSplit(rows, [{ created_date: at, status: "banana" }], NOON).verifiedMinutes, 0);
});

check("never being asked is NOT the same as failing", () => {
    // The board says "unverified", it does not print a 0% badge at somebody
    // nobody has ever challenged.
    const v = verifiedSplit([sess(day(1), 60)], [], NOON);
    assert.equal(v.anyVerified, false);
    assert.equal(v.unverifiedMinutes, 60);
    assert.equal(v.total, 1);
});

check("a subject-specific proof does not vouch for a different subject", () => {
    const rows = [
        { date: day(1), duration_minutes: 60, subject: "Chemistry" },
        { date: day(1), duration_minutes: 60, subject: "Legal Studies" },
    ];
    const v = verifiedSplit(rows, [{ created_date: day(1), passed: true, subject: "Chemistry" }], NOON);
    assert.equal(v.verifiedMinutes, 60);
    assert.equal(v.unverifiedMinutes, 60);
});

check("A REAL CALL-OUT PROVES ITS OWN WINDOW, not a window we invented", () => {
    // The row carries window_start and submitted_at — the span its questions
    // were built from. Using that beats the ±48h fallback, because it is the
    // actual claim the quiz tested rather than a guess around a timestamp.
    const rows = [sess(day(2), 60), sess(day(6), 60)];
    const v = verifiedSplit(rows, [{
        status: "passed",
        window_start: `${day(3)}T00:00:00`,
        submitted_at: `${day(1)}T23:59:00`,
        created_date: `${day(1)}T23:59:00`,
    }], NOON);
    assert.equal(v.verifiedMinutes, 60, "the session inside the window is proven");
    assert.equal(v.unverifiedMinutes, 60, "the one four days before it is not");
});

check("a verification with no window falls back to the ±48h span", () => {
    // Older rows, and any verification that is not a call-out, still work.
    const rows = [sess(day(1), 60), sess(day(9), 60)];
    const v = verifiedSplit(rows, [{ created_date: day(1), passed: true }], NOON);
    assert.equal(v.verifiedMinutes, 60);
    assert.ok(VERIFY_COVERS_HOURS > 0);
});

check("verified minutes are CAPPED too — proof is not a bypass", () => {
    // Passing a quiz must not license an impossible day. The cap applies to
    // both halves, or verification becomes the exploit.
    const rows = Array.from({ length: 10 }, () => sess(day(0), 240));
    const v = verifiedSplit(rows, [{ created_date: day(0), passed: true }], NOON);
    assert.equal(v.verifiedMinutes, 720);
});

console.log(`\n${passed} passed`);
