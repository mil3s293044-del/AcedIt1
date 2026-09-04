/**
 * study log assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/studyLog.test.mjs
 *
 * The one that matters most is the first: study is written to two tables and
 * the dashboard read one of them, so a week spent on the Study page came back
 * as whatever quizzes happened to be in it.
 */
import assert from "node:assert/strict";
import {
    studyEvents, weekPace, weekStart, weekIndex, dayKey, MIN_BASELINE_WEEKS,
} from "@/lib/studyLog";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// A Wednesday, so "by this point in the week" covers Mon–Wed.
const WED = new Date(2026, 8, 2, 19, 0, 0);
const day = (d) => dayKey(d);
const back = (n) => day(new Date(WED.getFullYear(), WED.getMonth(), WED.getDate() - n));

// ─── both tables ────────────────────────────────────────────────────────────

check("study written to either table counts, with its own minute column", () => {
    const ev = studyEvents(
        [{ id: "s1", subject: "Legal Studies", duration_minutes: 21, date: back(0) }],
        [{ id: "t1", subject: "Chemistry", session_duration: 45, date: back(1) }],
    );
    assert.equal(ev.length, 2);
    assert.equal(ev.find((e) => e.id === "s1").minutes, 21);
    assert.equal(ev.find((e) => e.id === "t1").minutes, 45, "session_duration is the technique's column");
});

check("a row that cannot say when it happened is dropped, not dated today", () => {
    const ev = studyEvents([{ id: "s", subject: "X", duration_minutes: 90 }], []);
    assert.equal(ev.length, 0, "otherwise it lands in whatever window is measured");
});

check("the Study page's whole week is not read as its quizzes", () => {
    // 27 minutes of quizzes, 3 hours of actual study. The panel this replaces
    // printed the 27.
    const sessions = [{ subject: "Legal Studies", duration_minutes: 27, date: back(0) }];
    const techniques = [
        { subject: "Chemistry", session_duration: 60, date: back(0) },
        { subject: "Chemistry", session_duration: 60, date: back(1) },
        { subject: "English", session_duration: 60, date: back(2) },
    ];
    const pace = weekPace(studyEvents(sessions, techniques), WED);
    assert.equal(pace.minutes, 207);
    assert.equal(pace.sessions, 4);
});

// ─── the week ───────────────────────────────────────────────────────────────

check("the week starts on Monday", () => {
    const sunday = new Date(2026, 8, 6);       // Sunday
    const monday = new Date(2026, 7, 31);      // the Monday before it
    assert.equal(weekIndex(monday), 0);
    assert.equal(weekIndex(sunday), 6, "Sunday closes the week it is in, not opens the next");
    assert.equal(dayKey(weekStart(sunday)), dayKey(monday));
});

check("this week is measured against the same weekday in past weeks", () => {
    // Two prior weeks, each with 100 minutes by Wednesday and another 500 on
    // the Friday. Comparing against whole weeks would say this student is
    // hundreds of minutes behind every Wednesday of their life.
    const evs = [];
    for (const w of [1, 2]) {
        evs.push({ id: `a${w}`, day: back(w * 7), minutes: 100, subject: "X" });
        evs.push({ id: `b${w}`, day: back(w * 7 - 2), minutes: 500, subject: "X" });
    }
    evs.push({ id: "now", day: back(0), minutes: 100, subject: "X" });
    const pace = weekPace(evs, WED);
    assert.equal(pace.baseline, 100, "Wednesdays are compared to Wednesdays");
    assert.equal(pace.delta, 0, "level with their usual, not 800 behind");
});

check("the baseline is a median, so one cram week does not set the bar", () => {
    const evs = [
        { id: "w1", day: back(7), minutes: 60, subject: "X" },
        { id: "w2", day: back(14), minutes: 60, subject: "X" },
        { id: "w3", day: back(21), minutes: 600, subject: "X" },   // the SAC week
        { id: "now", day: back(0), minutes: 60, subject: "X" },
    ];
    const pace = weekPace(evs, WED);
    assert.equal(pace.baseline, 60, "a mean would put their usual at 240");
    assert.equal(pace.delta, 0);
});

check("a week with nothing in it is no history, not a zero-minute week", () => {
    // One prior week of study and nothing before it. Reading the empty weeks
    // as zeroes would set "usual" near nothing and congratulate any effort.
    const evs = [
        { id: "w1", day: back(7), minutes: 90, subject: "X" },
        { id: "now", day: back(0), minutes: 5, subject: "X" },
    ];
    const pace = weekPace(evs, WED);
    assert.equal(pace.weeksOfHistory, 1);
    assert.ok(pace.weeksOfHistory < MIN_BASELINE_WEEKS);
    assert.equal(pace.baseline, null, "nothing to compare to yet, and it says so");
    assert.equal(pace.delta, null);
});

check("ahead and behind are both reported, signed", () => {
    const priors = [
        { id: "w1", day: back(7), minutes: 100, subject: "X" },
        { id: "w2", day: back(14), minutes: 100, subject: "X" },
    ];
    assert.equal(weekPace([...priors, { id: "n", day: back(0), minutes: 160 }], WED).delta, 60);
    assert.equal(weekPace([...priors, { id: "n", day: back(0), minutes: 40 }], WED).delta, -60);
});

check("last week's work is not counted as this week's", () => {
    const lastMonday = day(new Date(WED.getFullYear(), WED.getMonth(), WED.getDate() - weekIndex(WED) - 1));
    const pace = weekPace([{ id: "x", day: lastMonday, minutes: 300, subject: "X" }], WED);
    assert.equal(pace.minutes, 0, "the day before this Monday is a different week");
});

console.log(`\n${passed} passed`);
