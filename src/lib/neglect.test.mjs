/**
 * neglect assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/neglect.test.mjs
 */
import assert from "node:assert/strict";
import { neglectOrder, neglectLabel, neglectLine, STALE_DAYS } from "@/lib/neglect";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const days = (r) => r.daysSince;

check("the hand deals most neglected first", () => {
    const rows = [
        { subject: "English", daysSince: 0, mastery: 80 },
        { subject: "Chemistry", daysSince: 12, mastery: 40 },
        { subject: "Legal", daysSince: 3, mastery: 55 },
    ];
    assert.deepEqual(neglectOrder(rows, days).map((r) => r.subject),
        ["Chemistry", "Legal", "English"]);
});

check("never touched sorts ahead of the longest gap", () => {
    // null is not a small number, and it must not be sorted as one — a subject
    // with cards nobody has ever opened is the most neglected thing there is.
    const rows = [
        { subject: "Chemistry", daysSince: 40, mastery: 40 },
        { subject: "Hebrew VET", daysSince: null, mastery: 10 },
    ];
    assert.equal(neglectOrder(rows, days)[0].subject, "Hebrew VET");
});

check("the weaker subject breaks a tie", () => {
    const rows = [
        { subject: "A", daysSince: 5, mastery: 70 },
        { subject: "B", daysSince: 5, mastery: 20 },
    ];
    assert.equal(neglectOrder(rows, days)[0].subject, "B",
        "same gap, so open the one you know least");
});

check("the corner label is short, and says new rather than a number", () => {
    assert.equal(neglectLabel(null), "new");
    assert.equal(neglectLabel(0), "today");
    assert.equal(neglectLabel(1), "1d");
    assert.equal(neglectLabel(12), "12d");
});

check("neglect is only claimed when something has actually been left", () => {
    const fresh = [{ subject: "A", daysSince: 1, mastery: 50 }];
    assert.equal(neglectLine(fresh, days).kind, "fresh");

    const stale = [{ subject: "A", daysSince: STALE_DAYS, mastery: 50 }];
    assert.equal(neglectLine(stale, days).kind, "stale");

    const unopened = [{ subject: "A", daysSince: null, mastery: 0 }];
    assert.equal(neglectLine(unopened, days).kind, "new");

    assert.equal(neglectLine([], days), null, "an empty hand claims nothing");
});

console.log(`\n${passed} passed`);
