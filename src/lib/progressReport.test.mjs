/**
 * progressReport assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/progressReport.test.mjs
 *
 * ═══ A REPORT MAY NOT INVENT, AND MAY NOT COMPARE OFF TWO DATA POINTS ═══════
 * Two properties carry this whole file. The first is that every figure is
 * derived from rows the page already holds — there is no stored score and no
 * composite out of 100, because the app already has one number everything is
 * standardised around and a second invented scale beside it would be a figure
 * nobody can argue with competing with the one they can.
 *
 * The second is the comparison. A delta is null under its floor and null on a
 * window with no predecessor, and the WEEK's previous window is cut to the same
 * number of days — against a whole previous week every student is behind until
 * Sunday, which is the trap `weekPace` was written to close and which this
 * module had every opportunity to reopen.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    PERIODS, MONTH_DAYS, SIT_FLOOR, DAY_FLOOR,
    periodRange, within, deltaOf, cardsReport, quizzesReport, mistakesReport,
    hoursReport, verdictFor, hhmm, measurable,
} from "@/lib/progressReport";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// A Thursday, so the week has days either side of "now" inside it.
const THU = new Date(2026, 9, 8, 14, 0, 0);
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const back = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() - n); return day(d); };

// ═══ THE WINDOW ═════════════════════════════════════════════════════════════

check("the week is Monday-anchored, which is studyLog's and not date-fns' default", () => {
    const r = periodRange("week", THU);
    assert.equal(r.from, "2026-10-05", "the week does not start on Monday");
    assert.equal(r.to, "2026-10-08");
    assert.equal(r.days, 4, "Mon-Thu is four days");
});

check("THE PREVIOUS WEEK IS CUT TO THE SAME LENGTH", () => {
    // Against a whole previous week every student is behind until Sunday —
    // `weekPace`'s own lesson, and the single likeliest way to get this wrong.
    const r = periodRange("week", THU);
    assert.equal(r.prevFrom, "2026-09-28", "the previous week starts on the wrong Monday");
    assert.equal(r.prevTo, "2026-10-01",
        "the previous window is a FULL week against a part week, so every Thursday " +
        "reads as a collapse");
    const span = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1;
    assert.equal(span(r.prevFrom, r.prevTo), span(r.from, r.to), "the two windows are different lengths");
});

check("the month is trailing 28 against the 28 before it", () => {
    const r = periodRange("month", THU);
    assert.equal(r.days, MONTH_DAYS);
    assert.equal(r.to, "2026-10-08");
    assert.equal(r.from, back("2026-10-08", MONTH_DAYS - 1));
    assert.equal(r.prevTo, back(r.from, 1), "the two windows overlap or leave a gap");
});

check("ALL HAS NO PREVIOUS WINDOW, so nothing on it is compared", () => {
    const r = periodRange("all", THU);
    assert.equal(r.comparable, false);
    assert.equal(r.from, null, "a bound on `all` silently hides the student's own history");
    assert.equal(r.prevFrom, null);
});

check("A ROW WITH NO DATE IS NEVER INSIDE ANY WINDOW", () => {
    // `Number(null)` is 0 and "" slices LOW, so a coerced comparison files every
    // undated row OUTSIDE and the obvious "fix" files every one of them inside.
    for (const v of [null, undefined, "", 0, {}, "nope"]) {
        assert.equal(within(v, "2026-10-01", "2026-10-31"), false, `an undated row (${JSON.stringify(v)}) was counted`);
        // AND ON AN UNBOUNDED WINDOW TOO, which is the half the first version of
        // this check missed: `all` passes null bounds, so an undated row that
        // merely sorts low is still excluded by a bounded window and would sail
        // straight into "All" — where every report would silently gain rows that
        // cannot say when they happened.
        assert.equal(within(v, null, null), false, `an undated row (${JSON.stringify(v)}) counted on an unbounded window`);
    }
    assert.equal(within("2026-10-05T09:00:00Z", "2026-10-01", "2026-10-31"), true, "a timestamp is not matched against a day");
    assert.equal(within("2026-10-05", null, null), true, "an unbounded window excluded a real day");
});

check("a delta is null rather than 0 when there is nothing to compare", () => {
    assert.equal(deltaOf(5, null), null);
    assert.equal(deltaOf(null, 5), null);
    const d = deltaOf(10, 4);
    assert.equal(d.value, 6);
    assert.equal(d.better, true);
    assert.equal(deltaOf(4, 4).flat, true, "equal periods must read as level, not as a gain");
});

// ═══ THE FOUR REPORTS ═══════════════════════════════════════════════════════

const MON = "2026-10-05";
const LAST = "2026-09-29";

check("quizzes: retries and unscored sits are never MEASURED", () => {
    const rows = [
        { id: "a", created_date: MON, score: 80, quiz_id: "q1" },
        { id: "b", created_date: MON, score: 60, quiz_id: "q1" },
        // A "wrong only" retry is on a different scale by construction.
        { id: "c", created_date: MON, score: 0, quiz_id: "q1", quiz_title: "Redox — wrong only", extra: { is_retry: true } },
        // Marking never came back — not a zero.
        { id: "d", created_date: MON, score: null, quiz_id: "q1" },
    ];
    // ASSERTED ON THE PREDICATE ITSELF, not only through the report. `sitScores`
    // already drops retries, so the headline average is right either way — and
    // the per-subject table and the command terms walk `measurable` DIRECTLY, so
    // dropping the filter here feeds a retry into both of those silently. The
    // first version of this check could not see that at all.
    assert.equal(measurable(rows).length, 2, "a retry or an unscored sit is measurable");

    const r = quizzesReport(rows, [{ id: "q1", subject: "Chemistry" }], periodRange("week", THU));
    assert.equal(r.sits, 2, "a retry or an unscored sit was averaged in");
    assert.equal(r.avg, 70);
    assert.equal(r.subjects[0].sits, 2, "a retry reached the per-subject table");
    assert.equal(r.subjects[0].avg, 70);
});

check("QUIZZES REFUSES A COMPARISON UNDER THE FLOOR, ON BOTH SIDES", () => {
    const range = periodRange("week", THU);
    const thin = quizzesReport([
        { id: "a", created_date: MON, score: 90 },
        { id: "p", created_date: LAST, score: 40 },
    ], [], range);
    assert.equal(thin.delta, null,
        "one sit either way is the difference between two papers, printed as a direction");
    assert.ok(thin.need > 0, "the page cannot say how many more are needed");

    const fat = quizzesReport([
        { id: "a", created_date: MON, score: 90 }, { id: "b", created_date: MON, score: 70 },
        { id: "p", created_date: LAST, score: 40 }, { id: "q", created_date: LAST, score: 60 },
    ], [], range);
    assert.ok(fat.delta, `${SIT_FLOOR} sits a side should compare`);
    assert.equal(fat.delta.value, 30);
    assert.equal(fat.delta.better, true);
});

check("quizzes: ALL has no delta however many sits there are", () => {
    const r = quizzesReport(
        [1, 2, 3, 4, 5].map((i) => ({ id: `a${i}`, created_date: MON, score: 70 })),
        [], periodRange("all", THU));
    assert.equal(r.delta, null, "`all` compared itself against a window that does not exist");
    assert.equal(r.sits, 5);
});

check("cards: accuracy is lifetime and the bands place every card", () => {
    const r = cardsReport([
        { id: "a", last_reviewed_date: MON, review_count_good: 3, review_count_again: 1, interval_days: 20, easiness_factor: 2.6 },
        { id: "b", last_reviewed_date: LAST, review_count_easy: 2 },
        { id: "c" },
    ], periodRange("week", THU));
    assert.equal(r.total, 3);
    assert.equal(r.reviewed, 1, "a card last reviewed last week counted as this week");
    assert.equal(r.accuracy, 83, "good+easy over every rating given");
    assert.equal(r.bands.reduce((s, b) => s + b.n, 0), 3, "a card fell through every band");
});

check("A RETIRED CARD IS NOT IN THE REPORT AT ALL", () => {
    // `retired_at` takes a card out of every queue in the app — a report that
    // counted them would tell a student they own cards they have put away.
    const r = cardsReport([
        { id: "a", last_reviewed_date: MON },
        { id: "z", last_reviewed_date: MON, retired_at: MON },
    ], periodRange("week", THU));
    assert.equal(r.total, 1);
    assert.equal(r.reviewed, 1);
});

check("hours: minutes are the COUNTABLE ones, and days are counted once", () => {
    const r = hoursReport([
        { day: MON, minutes: 30 }, { day: MON, minutes: 30 },
        { day: "2026-10-06", minutes: 45 },
        { day: LAST, minutes: 600 },
        { day: null, minutes: 999 },
    ], [], periodRange("week", THU));
    assert.equal(r.activeDays, 2, "two rows on one day counted as two days");
    assert.equal(r.minutes, 105, "last week's minutes or an undated row leaked in");
});

check("HOURS REFUSES A COMPARISON UNDER THE DAY FLOOR", () => {
    const r = hoursReport([{ day: MON, minutes: 40 }, { day: LAST, minutes: 400 }], [],
        periodRange("week", THU));
    assert.equal(r.delta, null,
        `one active day a side is not a comparison; the floor is ${DAY_FLOOR}`);
    assert.ok(r.needDays > 0);
});

check("mistakes: banked and drilled are counted off their own dates", () => {
    const r = mistakesReport([
        { id: "m1", topic: "Mistake bank", created_date: MON, last_reviewed_date: MON, repetitions: 0 },
        { id: "m2", topic: "Mistake bank", created_date: LAST, last_reviewed_date: MON, repetitions: 1 },
        { id: "m3", topic: "Mistake bank", created_date: LAST, repetitions: 0 },
    ], [], () => true, periodRange("week", THU));
    assert.equal(r.banked, 1, "a card banked last week counted as banked this week");
    assert.equal(r.drilled, 2);
    assert.equal(r.states.reduce((s, x) => s + x.n, 0), 3, "a card fell through every ladder state");
});

// ═══ THE SENTENCE ═══════════════════════════════════════════════════════════

check("A VERDICT IS ABSENT RATHER THAN PADDED", () => {
    const range = periodRange("week", THU);
    assert.equal(verdictFor(quizzesReport([], [], range), range), null,
        "a tab with no sits still produced a sentence about them");
    assert.equal(verdictFor(cardsReport([], range), range), null);
    assert.equal(verdictFor(hoursReport([], [], range), range), null);
    assert.equal(verdictFor(null, range), null);
});

check("a verdict names the direction and never contradicts its own delta", () => {
    const range = periodRange("week", THU);
    const up = quizzesReport([
        { id: "a", created_date: MON, score: 90 }, { id: "b", created_date: MON, score: 90 },
        { id: "p", created_date: LAST, score: 50 }, { id: "q", created_date: LAST, score: 50 },
    ], [], range);
    const v = verdictFor(up, range);
    assert.equal(v.tone, "good");
    assert.match(v.line, /Up 40 points/);

    const down = quizzesReport([
        { id: "a", created_date: MON, score: 50 }, { id: "b", created_date: MON, score: 50 },
        { id: "p", created_date: LAST, score: 90 }, { id: "q", created_date: LAST, score: 90 },
    ], [], range);
    const w = verdictFor(down, range);
    assert.equal(w.tone, "watch", "a fall was praised");
    assert.ok(!/Up /.test(w.line), "the sentence says up while the delta says down");
});

check("hhmm is null under a minute rather than \"0m\"", () => {
    assert.equal(hhmm(0), null);
    assert.equal(hhmm(null), null);
    assert.equal(hhmm(45), "45m");
    assert.equal(hhmm(60), "1h");
    assert.equal(hhmm(260), "4h 20m");
});

// ═══ THE PAGE ═══════════════════════════════════════════════════════════════

check("THE QUEUE IS TAB ONE, and the order is read off the first entry", () => {
    // `/^\s*\["today"/m` would pass with "today" ANYWHERE in the list, because
    // `m` makes `^` match at every line start — which is how the first draft of
    // this let the queue be moved to the end and said nothing.
    const page = strip(read("src/pages/Review.jsx"));
    const table = page.slice(page.indexOf("const TABS = ["), page.indexOf("];", page.indexOf("const TABS = [")));
    const ids = [...table.matchAll(/\[\s*"([a-z]+)"/g)].map((m) => m[1]);
    assert.equal(ids[0], "today",
        "the page opens on a report rather than on the one tab that has something " +
        `to do on it — it opens on "${ids[0]}"`);
});

check("FIVE TABS, ONE PER FEATURE, AND EVERY ONE IS RENDERED", () => {
    const page = strip(read("src/pages/Review.jsx"));
    const table = page.slice(page.indexOf("const TABS = ["), page.indexOf("];", page.indexOf("const TABS = [")));
    for (const id of ["today", "cards", "quizzes", "mistakes", "hours"]) {
        assert.ok(table.includes(`"${id}"`), `no "${id}" tab — a feature with no tab is a feature this page cannot report on`);
    }
    for (const t of ["CardsTab", "QuizzesTab", "MistakesTab", "HoursTab"]) {
        assert.ok(new RegExp(`<${t}\\b`).test(page), `${t} is declared and never drawn`);
    }
});

check("AND EVERY TAB IS REACHABLE BY A LINK", () => {
    // The thing the old "no tabs" guard was really protecting. A tab nobody can
    // deep-link to is one no other screen can hand a student off to.
    const page = strip(read("src/pages/Review.jsx"));
    assert.match(page, /resolveTab\(/, "the ?tab= param is no longer resolved");
    assert.match(page, /TAB_ALIAS/, "nothing maps the old names onto real tabs");
    const alias = page.slice(page.indexOf("const TAB_ALIAS"), page.indexOf("};", page.indexOf("const TAB_ALIAS")));
    assert.match(alias, /insights:/,
        "/Analytics redirects to ?tab=insights and has since the merge — without an " +
        "alias every one of those bookmarks lands on the wrong screen");
});

check("THE WINDOW IS ALWAYS STATED", () => {
    const page = strip(read("src/pages/Review.jsx"));
    assert.match(page, /<PeriodSwitch/, "the period control is not mounted");
    const sw = strip(read("src/components/progress/PeriodSwitch.jsx"));
    assert.match(sw, /\{live\.blurb\}/,
        "the switch prints a word without saying what span it means — the `date-fns` " +
        "Sunday default put five surfaces of this app a full week out of step");
    for (const p of PERIODS) {
        assert.ok(p.blurb && p.blurb.length > 3, `the "${p.label}" period does not say what it covers`);
    }
});

check("NOTHING HERE INVENTS A SCORE, AND NOTHING CALLS A MODEL", () => {
    const src = read("src/lib/progressReport.js") + read("src/components/progress/FeatureTabs.jsx");
    const code = strip(src);
    assert.ok(!/InvokeLLM|invokeAI|streamAI|callInvokeAI/.test(code),
        "the report generates advice — a paragraph nobody can check, which is what " +
        "was deleted from Insights for exactly this reason");
    assert.ok(!/\/\s*100\s*\)|progressScore|overallScore/.test(code),
        "a composite score out of 100 — a second invented scale sitting beside the " +
        "one number the whole app is standardised around");
});

check("every figure on a tab comes from the report, never from a literal", () => {
    const tabs = strip(read("src/components/progress/FeatureTabs.jsx"));
    // A hard-coded percentage or minute figure in the prose is the failure
    // `closingFacts` refuses on the first-run screen.
    const bad = tabs.match(/>\s*\d+%\s*</g);
    assert.equal(bad, null, `a literal percentage is printed on a tab: ${bad && bad.join(", ")}`);
});

console.log(`\nprogressReport: ${passed} checks passed`);
