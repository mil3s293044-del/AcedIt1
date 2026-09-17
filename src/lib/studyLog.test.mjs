/**
 * study log assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/studyLog.test.mjs
 *
 * The one that matters most is the first: study is written to two tables and
 * the dashboard read one of them, so a week spent on the Study page came back
 * as whatever quizzes happened to be in it.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

/* ── ONE WEEK, AND IT STARTS ON MONDAY ────────────────────────────────────
 *
 * `date-fns` defaults `startOfWeek` to SUNDAY. Five call sites took the
 * default while nine others passed `{ weekStartsOn: 1 }` or used `weekStart`
 * below — so "this week" meant two different weeks depending on the screen,
 * and ON A SUNDAY THEY WERE A FULL WEEK APART. Study said one total, the
 * dashboard beside it said another, and neither was wrong about its own
 * arithmetic. Nothing on screen could say which.
 *
 * It renders perfectly and only diverges one day in seven, which is why this
 * is a scan rather than a comment.
 */
const ROOT = process.cwd();

const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.jsx?$/.test(e.name) && !p.includes(".test.")) out.push(p);
    }
    return out;
};

check("this module's own week is Monday-anchored", () => {
    // Sunday 13 Sep 2026 belongs to the week that is ENDING.
    const sunday = new Date(2026, 8, 13, 12);
    assert.equal(weekIndex(sunday), 6, "Sunday is the last day of the week, not the first");
    assert.equal(weekStart(sunday).getDate(), 7, "…so its week started Monday the 7th");
});

check("nothing takes date-fns' SUNDAY default for startOfWeek/endOfWeek", () => {
    const bad = [];
    for (const abs of walk(path.join(ROOT, "src"))) {
        const src = fs.readFileSync(abs, "utf8");
        for (const m of src.matchAll(/\b(startOfWeek|endOfWeek)\s*\(/g)) {
            // Read to the matching close paren so a multi-argument call is
            // judged on its own arguments rather than on the rest of the line.
            let depth = 0, j = m.index + m[0].length - 1;
            for (; j < src.length; j++) {
                if (src[j] === "(") depth += 1;
                else if (src[j] === ")") { depth -= 1; if (depth === 0) break; }
            }
            const call = src.slice(m.index, j + 1);
            if (/weekStartsOn/.test(call)) continue;
            bad.push(`${path.relative(ROOT, abs)}:${src.slice(0, m.index).split("\n").length} — ${call.replace(/\s+/g, " ")}`);
        }
    }
    assert.deepEqual(bad, [], `date-fns defaults to SUNDAY; this app's week starts MONDAY:\n  ${bad.join("\n  ")}`);
});

console.log(`\n${passed} passed`);
