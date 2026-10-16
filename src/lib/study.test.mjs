/**
 * study page assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/study.test.mjs
 *
 * The Study page was reverted to its look before the two reworks (see
 * CLAUDE.md, "The Study page went back to how it was"). Three fixes from those
 * reworks changed nothing on screen and were kept; this file holds them, and
 * each was broken by putting the bug back.
 */
// Melbourne, because two of these are about a LOCAL day: in a UTC container a
// UTC string and a local one are the same string, and the bug passes silently.
process.env.TZ = "Australia/Melbourne";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { todaysIntent } from "@/lib/studyIntent";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
/** Comments stripped, so a sentence explaining a bug is not read as the bug. */
const code = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

check("an intent set at 8am in Melbourne is today's intent", () => {
    // 8am Melbourne is 9pm the previous day in UTC — the window in which the
    // UTC read called a breakfast answer stale and the Study page ignored it.
    const FIXED = new Date(2026, 9, 16, 8, 0, 0).getTime();
    const Real = Date;
    class Fixed extends Real {
        constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
        static now() { return FIXED; }
    }
    globalThis.Date = Fixed;
    try {
        const got = todaysIntent({ extra: { daily_intent: { date: "2026-10-16", mode: "cramming" } } });
        assert.ok(got, "the intent was read as stale");
        assert.equal(got.plan.technique, "active_recall");
        assert.equal(todaysIntent({ extra: { daily_intent: { date: "2026-10-15", mode: "cramming" } } }), null);
    } finally {
        globalThis.Date = Real;
    }
});

check("days to a SAC are counted in CALENDAR days", () => {
    // differenceInDays counts 24-hour spans, so at 3pm a SAC due tomorrow was
    // nine hours away, floored to 0, and the panel said "Exam today".
    const s = code("src/pages/Study.jsx");
    assert.ok(!/\bdifferenceInDays\s*\(/.test(s), "the deadline is counted in 24-hour spans");
    assert.ok(/differenceInCalendarDays\(\s*parseISO\(a\.due_date\)/.test(s), "the deadline is not counted at all");
});

check("the deck shelf's count says READY, the word on the deck face beside it", () => {
    const s = code("src/components/study/SpacedRepetition.jsx");
    assert.ok(!/\}\s*due\s*<\/span>/.test(s), "a shelf pill reads 'N due' beside a face reading 'N READY'");
    assert.ok(/\{totalReady\} ready<\/span>/.test(s), "the shelf pill is gone");
});

console.log(`\n${passed} study checks passed`);
