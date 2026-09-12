/**
 * league assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/league.test.mjs
 */
import assert from "node:assert/strict";
import {
    msUntilReset, untilLabel, isClosing, leagueLead, historySummary, ordinal,
    SCORE_MAX, SLICE_MAX,
} from "@/lib/league";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── the clock ──────────────────────────────────────────────────────────────

check("A MISSING RESET IS NULL, NEVER THE EPOCH", () => {
    // `new Date(x || 0)` is 1970 and renders as "20705d ago" — already shipped
    // once on the Compete feed. A countdown is where it would be least
    // noticeable and most wrong.
    assert.equal(msUntilReset(null), null);
    assert.equal(msUntilReset(undefined), null);
    assert.equal(msUntilReset(""), null);
    assert.equal(msUntilReset("not a date"), null);
    assert.equal(untilLabel(null), null);
});

check("the countdown counts down and floors at zero", () => {
    const now = new Date("2026-09-09T00:00:00Z");
    assert.equal(msUntilReset("2026-09-09T06:00:00Z", now), 6 * 3600e3);
    assert.equal(msUntilReset("2026-09-08T00:00:00Z", now), 0, "a past reset is 0, not negative");
});

check("labels read the way somebody would say them", () => {
    assert.equal(untilLabel(3 * 86400e3 + 4 * 3600e3), "3d 4h");
    assert.equal(untilLabel(3 * 86400e3), "3d");
    assert.equal(untilLabel(6 * 3600e3 + 12 * 60e3), "6h 12m");
    assert.equal(untilLabel(48 * 60e3), "48m");
    assert.equal(untilLabel(20e3), "under a minute");
});

check("closing means closing, not closed and not missing", () => {
    assert.equal(isClosing(null), false);
    assert.equal(isClosing(0), false, "already reset is not 'closing'");
    assert.equal(isClosing(2 * 3600e3), true);
    assert.equal(isClosing(48 * 3600e3), false);
});

// ─── the lead ───────────────────────────────────────────────────────────────

const board = (...scores) => scores.map((s, i) => ({
    position: i + 1, compete_score: s, display_name: `P${i + 1}`, is_me: false,
}));

check("A ONE-PERSON BOARD HAS NO LEAD", () => {
    // "1st of 1" is the app congratulating somebody for being the only one
    // here. Every branch returns null rather than a placeholder.
    const rows = board(400); rows[0].is_me = true;
    assert.equal(leagueLead({ rows }), null);
    assert.equal(leagueLead({ rows: [] }), null);
    assert.equal(leagueLead({ rows: board(400, 300) }), null, "not on the board at all");
});

check("a reachable place above is the lead", () => {
    const rows = board(500, 430, 200); rows[1].is_me = true;
    const lead = leagueLead({ rows });
    assert.equal(lead.tone, "chase");
    assert.match(lead.headline, /^70 points off P1$/);
});

check("defending only applies near the top, and only when it is close", () => {
    const rows = board(500, 470, 200); rows[0].is_me = true;
    assert.equal(leagueLead({ rows }).tone, "defend");

    // Far ahead at the top: nothing to defend, so it says you are leading.
    const clear = board(900, 100); clear[0].is_me = true;
    assert.equal(leagueLead({ rows: clear }).tone, "lead");
});

check("an unreachable gap still gives a position rather than nothing", () => {
    const rows = board(1000, 10); rows[1].is_me = true;
    const lead = leagueLead({ rows });
    assert.equal(lead.tone, "climb");
    assert.match(lead.headline, /2 of 2/);
});

check("the closing line changes when the week is nearly over", () => {
    const rows = board(500, 430, 200); rows[1].is_me = true;
    assert.notEqual(leagueLead({ rows, closing: true }).detail,
        leagueLead({ rows, closing: false }).detail);
});

// ─── history ────────────────────────────────────────────────────────────────

check("no finished weeks is not a zero", () => {
    const s = historySummary([]);
    assert.equal(s.count, 0);
    assert.equal(s.best, null, "no weeks means no best, not 'best: 0'");
    assert.equal(s.trend, null);
    assert.deepEqual(historySummary(undefined).weeks, []);
});

check("ONE WEEK IS NOT A TREND", () => {
    // 0 means "held your place" and must not double as "not enough data" —
    // the rule the Quizzes trend tile already keeps.
    const s = historySummary([{ week_start: "2026-09-01", position: 4 }]);
    assert.equal(s.count, 1);
    assert.equal(s.best, 4);
    assert.equal(s.trend, null);
});

check("a trend is positive when the position IMPROVED", () => {
    // Smaller position is better, so 12th then 8th is +4. Drawing the raw
    // difference would put a green arrow on a week somebody went backwards.
    const s = historySummary([
        { week_start: "2026-09-08", position: 8 },
        { week_start: "2026-09-01", position: 12 },
    ]);
    assert.equal(s.trend, 4);
    assert.equal(historySummary([
        { week_start: "2026-09-08", position: 12 },
        { week_start: "2026-09-01", position: 8 },
    ]).trend, -4);
});

check("an unsettled week is not counted as a result", () => {
    // final_position is null until the week is settled. Counting it would
    // report a position nobody has been given.
    const s = historySummary([
        { week_start: "2026-09-08", position: null },
        { week_start: "2026-09-01", position: 3 },
    ]);
    assert.equal(s.count, 1);
    assert.equal(s.best, 3);
    assert.equal(s.podiums, 1);
});

// ─── odds and ends ──────────────────────────────────────────────────────────

check("ordinals, including the teens", () => {
    assert.equal(ordinal(1), "1st");
    assert.equal(ordinal(2), "2nd");
    assert.equal(ordinal(3), "3rd");
    assert.equal(ordinal(4), "4th");
    assert.equal(ordinal(11), "11th");
    assert.equal(ordinal(12), "12th");
    assert.equal(ordinal(13), "13th");
    assert.equal(ordinal(21), "21st");
    assert.equal(ordinal(0), null);
    assert.equal(ordinal(null), null);
});

check("the slice ceilings match the server's compete score", () => {
    assert.equal(SCORE_MAX, 1000);
    assert.equal(SLICE_MAX.effort + SLICE_MAX.mastery + SLICE_MAX.consistency, SCORE_MAX);
});

console.log(`\n${passed} passed`);
