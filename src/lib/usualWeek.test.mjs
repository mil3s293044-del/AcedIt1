/**
 * usual-week assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/usualWeek.test.mjs
 */
import assert from "node:assert/strict";
import { usualOrder, usualLabel, usualLine, THIN_WEEK_MINUTES } from "@/lib/usualWeek";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const usual = (r) => r.usualMinutes;

check("the hand deals the starved subject first", () => {
    const rows = [
        { subject: "English", usualMinutes: 180, mastery: 80 },
        { subject: "Chemistry", usualMinutes: 15, mastery: 40 },
        { subject: "Legal", usualMinutes: 60, mastery: 55 },
    ];
    assert.deepEqual(usualOrder(rows, usual).map((r) => r.subject),
        ["Chemistry", "Legal", "English"]);
});

check("a subject with no history sorts LAST, not first", () => {
    // Unknown is not zero. A subject added this week has not been starved, it
    // has not been measured, and heading the list with it claims something the
    // page cannot see.
    const rows = [
        { subject: "Chemistry", usualMinutes: 20, mastery: 40 },
        { subject: "Hebrew VET", usualMinutes: null, mastery: 10 },
    ];
    assert.deepEqual(usualOrder(rows, usual).map((r) => r.subject),
        ["Chemistry", "Hebrew VET"]);
});

check("the weaker subject breaks a tie", () => {
    const rows = [
        { subject: "A", usualMinutes: 30, mastery: 70 },
        { subject: "B", usualMinutes: 30, mastery: 20 },
    ];
    assert.equal(usualOrder(rows, usual)[0].subject, "B",
        "same half hour, so lead with the one you know least");
});

check("the corner label is short, and rounded to the half hour", () => {
    assert.equal(usualLabel(null), "—");
    assert.equal(usualLabel(0), "0m/wk");
    assert.equal(usualLabel(45), "45m/wk");
    assert.equal(usualLabel(60), "1h/wk");
    assert.equal(usualLabel(90), "1.5h/wk");
    assert.equal(usualLabel(120), "2h/wk", "not 2.0h");
    // A median across weeks does not know its own tenths, and a decimal that
    // moves whenever a session lands reads as a counter rather than a habit.
    assert.equal(usualLabel(195), "3.5h/wk", "not 3.3h");
    assert.equal(usualLabel(605), "10h/wk");
});

check("a starved subject is only named when one is starved", () => {
    const thin = [{ subject: "A", usualMinutes: THIN_WEEK_MINUTES, mastery: 50 }];
    assert.equal(usualLine(thin, usual).kind, "thin");

    const even = [{ subject: "A", usualMinutes: 120, mastery: 50 }];
    assert.equal(usualLine(even, usual).kind, "even");
});

check("with no history at all it says so rather than naming a subject", () => {
    const rows = [
        { subject: "A", usualMinutes: null, mastery: 50 },
        { subject: "B", usualMinutes: null, mastery: 20 },
    ];
    assert.equal(usualLine(rows, usual).kind, "unknown");
    assert.equal(usualLine([], usual).kind, "unknown", "an empty hand claims nothing");
});

check("a subject with no usual is never named as the starved one", () => {
    // usualOrder puts unknowns last, and the line only ever looks at rows that
    // HAVE a number — both halves matter, because a hand of one measured
    // subject and three unknowns must not report an unknown.
    const rows = usualOrder([
        { subject: "Known", usualMinutes: 200, mastery: 50 },
        { subject: "Unknown", usualMinutes: null, mastery: 10 },
    ], usual);
    assert.equal(usualLine(rows, usual).subject, "Known");
});

console.log(`\n${passed} passed`);
