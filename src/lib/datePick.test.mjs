/**
 * datePick assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/datePick.test.mjs
 *
 * ═══ A PICKER THAT IS WRONG LOOKS LIKE IT WORKS ═════════════════════════════
 * A year grid opening on 1920, a February with 31 days, a week starting on the
 * wrong day, a "today" that is yesterday before 11am — every one of them
 * renders cleanly. The first one shipped to a screenshot before this file
 * existed: `pageFor(null)` coerced to year 0 and the birthday's year grid
 * opened a century early. So the arithmetic is pure and held here, and the
 * scans at the bottom hold the one property the request was about: no date in
 * the app is picked with the browser's bare input any more.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    isoOf, dateOf, daysInMonth, composeIso, splitIso, partsProblem,
    defaultYearPage, yearPage, pageFor, YEARS_PER_PAGE, YOUNGEST_OFFERED, EARLIEST_YEAR,
    monthGrid, shiftMonth, inRange, quickDays, longLabel, WEEKDAYS,
} from "@/lib/datePick";

// MELBOURNE, because that is where the bug lives. In a UTC container a UTC
// "today" and a local one are the same string, so the check below passed with
// `toISOString` put back — the sweep said so. Node re-reads TZ on change, and
// every Date here is made inside a check, after this line.
process.env.TZ = "Australia/Melbourne";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const NOW = new Date(2026, 9, 15, 9, 30); // Thursday 15 October 2026, 9:30am local

/* ─── Days ────────────────────────────────────────────────────────────────── */

check("A DAY IS LOCAL, never toISOString's UTC", () => {
    // 00:30 local is the previous day in UTC anywhere east of Greenwich —
    // which is Melbourne, before 10 or 11 every morning.
    assert.equal(isoOf(new Date(2026, 9, 15, 0, 30)), "2026-10-15");
    assert.equal(isoOf(new Date(2026, 9, 15, 23, 50)), "2026-10-15");
});

check("a date that does not survive the round trip was never a date", () => {
    assert.equal(dateOf("2009-02-31"), null, "31 February rolled over to March and was accepted");
    assert.equal(dateOf("2009-13-01"), null);
    assert.equal(dateOf("[object Ob"), null);
    assert.equal(dateOf(null), null);
    assert.equal(dateOf("2008-02-29").getDate(), 29, "a real leap day was refused");
});

check("months have the days they have, and February without a year is 29", () => {
    assert.equal(daysInMonth(2, 2009), 28);
    assert.equal(daysInMonth(2, 2008), 29);
    assert.equal(daysInMonth(2, 1900), 28, "1900 is not a leap year");
    assert.equal(daysInMonth(2, 2000), 29);
    assert.equal(daysInMonth(2, null), 29, "an unknown year hid the 29th from somebody born on it");
    assert.equal(daysInMonth(2, ""), 29);
    assert.equal(daysInMonth(4, 2009), 30);
    assert.equal(daysInMonth(null, 2009), 31, "with no month every day has to be offered");
});

check("A MISSING PART IS NULL, NEVER ZERO", () => {
    // `Number(null) === 0`: the 0th of March is the last day of February.
    assert.equal(composeIso(null, 3, 2009), null);
    assert.equal(composeIso(15, null, 2009), null);
    assert.equal(composeIso(15, 3, null), null);
    assert.equal(composeIso(0, 3, 2009), null);
    assert.equal(composeIso(31, 2, 2009), null, "31 February composed into a date");
    assert.equal(composeIso(15, 3, 2009), "2009-03-15");
    assert.deepEqual(splitIso("2009-03-15"), { day: 15, month: 3, year: 2009 });
    assert.deepEqual(splitIso(""), { day: null, month: null, year: null });
});

check("31 February is SAID, with the month's real count", () => {
    assert.equal(partsProblem(31, 2, 2009), "February 2009 only has 28 days.");
    assert.equal(partsProblem(29, 2, null), null, "29 February with no year yet is still possible");
    assert.equal(partsProblem(30, 2, null), "February only has 29 days.");
    assert.equal(partsProblem(15, 3, 2009), null);
    assert.equal(partsProblem(null, 2, 2009), null, "an unpicked day is not a problem yet");
});

/* ─── Years ───────────────────────────────────────────────────────────────── */

check("the first page of years is the ones a student was plausibly born in", () => {
    const p = yearPage(defaultYearPage(NOW), NOW);
    assert.equal(p.years.length, YEARS_PER_PAGE);
    assert.equal(p.to, 2026 - YOUNGEST_OFFERED, "the youngest year offered moved");
    for (const age of [15, 16, 17, 18]) {
        assert.ok(p.years.includes(2026 - age) || p.years.includes(2026 - age - 1),
            `a ${age}-year-old has to page to find their year`);
    }
});

check("AN UNPICKED YEAR OPENS ON THAT PAGE — not on 1920", () => {
    // The bug a screenshot caught: Number(null) is 0, an integer, so the page
    // for "no year" was computed for year 0 and clamped to the earliest.
    assert.equal(pageFor(null, NOW), defaultYearPage(NOW));
    assert.equal(pageFor(undefined, NOW), defaultYearPage(NOW));
    assert.equal(pageFor("", NOW), defaultYearPage(NOW));
    const p = yearPage(pageFor(1991, NOW), NOW);
    assert.ok(p.years.includes(1991), "a stored older year opened on a page without it");
});

check("paging stops at this year and at the earliest", () => {
    const fwd = yearPage(2030, NOW);
    assert.equal(fwd.to, 2026, "a birth year in the future was offered");
    assert.equal(fwd.canForward, false);
    const back = yearPage(1800, NOW);
    assert.equal(back.from, EARLIEST_YEAR);
    assert.equal(back.canBack, false);
});

/* ─── Months ──────────────────────────────────────────────────────────────── */

check("MONDAY FIRST, like every week this app draws", () => {
    assert.equal(WEEKDAYS[0], "Mon");
    const weeks = monthGrid(2026, 10);           // 1 October 2026 is a Thursday
    assert.deepEqual(weeks[0].slice(0, 4).map((c) => c.inMonth), [false, false, false, true]);
    assert.equal(weeks[0][3].iso, "2026-10-01");
    assert.equal(new Date(2026, 8, 28).getDay(), 1, "the fixture's first cell is not a Monday");
    assert.equal(weeks[0][0].iso, "2026-09-28");
});

check("every row is a full week and every day of the month appears once", () => {
    for (const [y, m] of [[2026, 2], [2026, 3], [2027, 2], [2024, 2], [2026, 11]]) {
        const cells = monthGrid(y, m).flat();
        assert.equal(cells.length % 7, 0);
        const days = cells.filter((c) => c.inMonth).map((c) => c.day);
        assert.deepEqual(days, Array.from({ length: daysInMonth(m, y) }, (_, i) => i + 1), `${y}-${m}`);
    }
});

check("months wrap the year both ways", () => {
    assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
    assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
});

check("the chips offer only days that can be picked", () => {
    const chips = quickDays("2026-10-15", 7, { min: "2026-10-15", max: "2026-10-18" });
    assert.deepEqual(chips.map((c) => c.iso), ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    assert.ok(inRange("2026-10-15", "2026-10-15"));
    assert.ok(!inRange("2026-10-14", "2026-10-15"), "a past day passed the minimum");
    assert.ok(!inRange("junk"));
});

check("the answer is spelled out in full", () => {
    assert.equal(longLabel("2009-03-15"), "Sunday 15 March 2009");
    assert.equal(longLabel("2026-10-15", { year: false }), "Thursday 15 October");
    assert.equal(longLabel(""), "");
});

/* ─── The app ─────────────────────────────────────────────────────────────── */

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

check("NO DATE IS PICKED WITH THE BROWSER'S BARE INPUT any more", () => {
    // "Apply this to all other date pickers." A third `type="date"` added
    // later is exactly the unstyled box this replaced.
    const hits = walk("src").filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.endsWith(".test.mjs"))
        .filter((f) => /type\s*=\s*["']date(time-local)?["']/.test(strip(read(f))));
    assert.deepEqual(hits, [], `a bare date input survives in ${hits.join(", ")}`);
});

check("the birthday — wizard AND gate — goes through BirthdayPicker", () => {
    const src = strip(read("src/components/legal/AgeAnswer.jsx"));
    assert.match(src, /<BirthdayPicker\b/, "the shared age control no longer draws the picker");
    assert.doesNotMatch(src, /toISOString\(\)\.slice\(0,\s*10\)/, "a UTC 'today' is back");
});

check("the picker reports a date only once day, month and year make one", () => {
    // The age rules downstream must only ever see a complete answer or none:
    // a half-picked birthday reported as a date would be judged on a guess.
    const src = strip(read("src/components/shared/BirthdayPicker.jsx"));
    const calls = [...src.matchAll(/onChange\?\.\(([^)]*)\)/g)].map((m) => m[1].trim());
    assert.ok(calls.length > 0, "the picker never reports at all");
    for (const c of calls) assert.equal(c, "out", `onChange is handed "${c}" rather than the composed date`);
    assert.match(src, /const out = composeIso\(next\.day, next\.month, next\.year\) \|\| ""/);
});

check("the planner's SAC date and session day are the app's picker, with the days marked", () => {
    const src = strip(read("src/pages/Goals.jsx"));
    // To the self-closing tag, not the first ">": an arrow function in a prop
    // has one, and the first draft cut the element off there.
    const pickers = [...src.matchAll(/<DatePicker\b[\s\S]*?\/>/g)].map((m) => m[0]);
    assert.equal(pickers.length, 2, `expected the SAC and the session pickers, found ${pickers.length}`);
    for (const p of pickers) assert.match(p, /marks=\{\w+\}/, `${p} draws a calendar that cannot show a clash`);
});

console.log(`\ndatePick: ${passed} checks passed`);
