/**
 * league assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/league.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    msUntilReset, untilLabel, isClosing, leagueLead, historySummary, ordinal,
    SCORE_MAX, SLICE_MAX, computeCompeteScore, nextPoint, MASTERY_SITS_FULL,
    EFFORT_MINUTES_FULL, leagueXPFor, podiumCrest, podiumIsCurrent, PODIUM,
    LEAGUE_XP, podiumGap,
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


// ─── the score ──────────────────────────────────────────────────────────────

check("the ceilings are the slices, and a perfect week is exactly SCORE_MAX", () => {
    const cs = computeCompeteScore({
        minutes: 10_000, avgAccuracy: 100, activeDays: 7, sits: 50,
    });
    assert.equal(cs.effort, SLICE_MAX.effort, "effort clamps at its ceiling");
    assert.equal(cs.mastery, SLICE_MAX.mastery);
    assert.equal(cs.consistency, SLICE_MAX.consistency);
    assert.equal(cs.total, SCORE_MAX);
});

check("AN AVERAGE ALONE PUNISHED DOING MORE WORK, and the ramp is why", () => {
    // ONE easy quiz at 95% used to score 380 and TWELVE at 78% scored 312, so
    // the student who did twelve times the work came second by construction and
    // the fastest way up the board was to sit one quiz and stop.
    const one = computeCompeteScore({ avgAccuracy: 95, sits: 1 }).mastery;
    const twelve = computeCompeteScore({ avgAccuracy: 78, sits: 12 }).mastery;
    assert.ok(twelve > one, `twelve sits at 78% (${twelve}) must beat one at 95% (${one})`);
    assert.equal(one, Math.round(0.95 * SLICE_MAX.mastery * (1 / MASTERY_SITS_FULL)));
});

check("the ramp is full at MASTERY_SITS_FULL and never exceeds it", () => {
    const at = computeCompeteScore({ avgAccuracy: 78, sits: MASTERY_SITS_FULL }).mastery;
    const past = computeCompeteScore({ avgAccuracy: 78, sits: MASTERY_SITS_FULL * 3 }).mastery;
    assert.equal(at, past, "past the ramp, volume stops paying — accuracy decides");
    assert.equal(at, Math.round(0.78 * SLICE_MAX.mastery));
});

check("NO SITS IS NO MASTERY, whatever the average says", () => {
    // An accuracy with no sits behind it is a figure about nothing. It must not
    // ride in on a default.
    assert.equal(computeCompeteScore({ avgAccuracy: 100, sits: 0 }).mastery, 0);
    assert.equal(computeCompeteScore({}).total, 0);
});

check("EVERY SLICE MEASURES THIS WEEK — consistency is days and nothing else", () => {
    // It used to be `days/7 × 150 + streak/14 × 50`, and a streak is a LIFETIME
    // number inside a weekly competition: a 60-day run banked 50 points every
    // Monday for nothing done that week, and a first-week student could not
    // close it however hard they worked.
    const a = computeCompeteScore({ activeDays: 3, sits: 2, minutes: 90, streak: 60 });
    const b = computeCompeteScore({ activeDays: 3, sits: 2, minutes: 90, streak: 0 });
    assert.deepEqual(a, b, "a streak may not reach the weekly score at all");
    assert.equal(a.consistency, Math.round((3 / 7) * SLICE_MAX.consistency));
});

check("a day is a day, and eight of them is still seven", () => {
    assert.equal(computeCompeteScore({ activeDays: 99 }).consistency, SLICE_MAX.consistency);
    assert.equal(computeCompeteScore({ activeDays: -4 }).consistency, 0);
});

check("effort is a minute a point, and junk arrives as zero rather than NaN", () => {
    assert.equal(computeCompeteScore({ minutes: 137 }).effort, 137);
    assert.equal(computeCompeteScore({ minutes: EFFORT_MINUTES_FULL + 1 }).effort, EFFORT_MINUTES_FULL);
    const junk = computeCompeteScore({ minutes: "abc", avgAccuracy: null, activeDays: undefined, sits: NaN });
    assert.equal(junk.total, 0);
    assert.ok(Number.isFinite(junk.total));
});

// ─── what a point costs ─────────────────────────────────────────────────────

check("A FULL SLICE IS NEVER OFFERED AS ADVICE", () => {
    // "Study more" to somebody who has maxed effort is the app not reading its
    // own screen.
    const full = computeCompeteScore({ minutes: 10_000, avgAccuracy: 100, activeDays: 7, sits: 9 });
    assert.deepEqual(nextPoint(full, { sits: 9, activeDays: 7, avgAccuracy: 100 }), []);
});

check("one more quiz is priced off the average they actually hold", () => {
    const cs = computeCompeteScore({ avgAccuracy: 80, sits: 1, activeDays: 2, minutes: 50 });
    const rows = nextPoint(cs, { sits: 1, activeDays: 2, avgAccuracy: 80 });
    const mastery = rows.find((r) => r.key === "mastery");
    assert.ok(mastery, "a student one sit into the ramp has a quiz worth taking");
    assert.equal(mastery.per, Math.round((0.8 * SLICE_MAX.mastery) / MASTERY_SITS_FULL));
    assert.ok(rows.every((r) => r.per > 0), "a row worth zero points is not advice");
});

check("with no average there is nothing honest to say about the next quiz", () => {
    // It cannot know what they will score, so it does not guess one.
    const rows = nextPoint(computeCompeteScore({ activeDays: 1 }), { sits: 0, activeDays: 1, avgAccuracy: 0 });
    assert.equal(rows.find((r) => r.key === "mastery"), undefined);
});

// ─── the podium ─────────────────────────────────────────────────────────────

check("the podium pays the top three and nobody else", () => {
    assert.equal(LEAGUE_XP.length, PODIUM, "one payout per podium place");
    for (let p = 1; p <= PODIUM; p += 1) {
        assert.ok(leagueXPFor(p) > 0, `${p} should pay`);
        assert.ok(podiumCrest(p), `${p} should earn a crest`);
    }
    assert.equal(leagueXPFor(PODIUM + 1), 0);
    assert.equal(podiumCrest(PODIUM + 1), null);
});

check("finishing better never pays less", () => {
    for (let p = 2; p <= PODIUM; p += 1) {
        assert.ok(leagueXPFor(p - 1) > leagueXPFor(p), `${p - 1} must beat ${p}`);
    }
});

check("A POSITION THE WEEK NEVER SETTLED PAYS NOTHING", () => {
    // `final_position` is NULL until settlement and `Number(null)` is a finite
    // 0 — the coercion that has now reached five modules. A zeroth place must
    // not read as first.
    assert.equal(leagueXPFor(null), 0);
    assert.equal(leagueXPFor(0), 0);
    assert.equal(leagueXPFor(undefined), 0);
    assert.equal(leagueXPFor("not a place"), 0);
    assert.equal(podiumCrest(null), null);
    assert.equal(podiumCrest(0), null);
});

check("A CREST IS WORN FOR ONE WEEK, then it is gone", () => {
    // A permanent badge for one good week in March is a claim about today that
    // stopped being true in March.
    const award = { week: "2026-09-07", position: 1, crest: "gold" };
    assert.equal(podiumIsCurrent(award, "2026-09-14"), true, "the week after is when it is worn");
    assert.equal(podiumIsCurrent(award, "2026-09-07"), false, "not during the week it was won");
    assert.equal(podiumIsCurrent(award, "2026-09-21"), false, "and not a fortnight later");
    assert.equal(podiumIsCurrent(null, "2026-09-14"), false);
    assert.equal(podiumIsCurrent({ position: 1 }, "2026-09-14"), false, "no week, no claim");
    assert.equal(podiumIsCurrent(award, null), false);
});


// ─── the podium line ────────────────────────────────────────────────────────

const withMe = (scores, mine) => scores.map((sc, i) => ({
    position: i + 1, compete_score: sc, display_name: `P${i + 1}`, is_me: i + 1 === mine,
}));

check("A BOARD WITH NO PODIUM DOES NOT PRINT ONE", () => {
    // Three paid places out of three students is everybody, and the whole
    // value of a payline is that there is something on the other side of it.
    assert.equal(podiumGap(withMe([500, 400, 300], 2)), null, "exactly PODIUM rows");
    assert.equal(podiumGap(withMe([500], 1)), null);
    assert.equal(podiumGap([]), null);
    assert.equal(podiumGap(withMe([500, 400, 300, 200], 0)), null, "not on the board at all");
});

check("OUT OF THE PODIUM, the gap is to third and nothing else", () => {
    const g = podiumGap(withMe([900, 700, 500, 460, 100], 4));
    assert.equal(g.in, false);
    assert.equal(g.gap, 40, "500 − 460");
    assert.equal(g.holder, "P3");
    // Last place is measured against third too, not against the row above it.
    assert.equal(podiumGap(withMe([900, 700, 500, 460, 100], 5)).gap, 400);
});

check("IN THE PODIUM, the margin is over FOURTH, not over the row below", () => {
    // Fourth is the only person who can take the crest, so for anybody in
    // first or second "8 ahead of 3rd" is a number about nothing at stake.
    const first = podiumGap(withMe([900, 700, 500, 460, 100], 1));
    assert.equal(first.in, true);
    assert.equal(first.margin, 440, "900 − 460, the first student outside the podium");
    assert.equal(first.crest, "gold");
    assert.equal(first.chaser, "P4");

    const third = podiumGap(withMe([900, 700, 500, 460, 100], 3));
    assert.equal(third.margin, 40);
    assert.equal(third.crest, "bronze");
});

check("a gap is never negative, whichever way the board came back", () => {
    for (const mine of [1, 2, 3, 4, 5]) {
        const g = podiumGap(withMe([500, 500, 500, 500, 500], mine));
        const n = g.in ? g.margin : g.gap;
        assert.ok(n >= 0, `position ${mine} produced ${n}`);
    }
});

// ─── the mirror ─────────────────────────────────────────────────────────────

check("THE SERVER IMPORTS THE SCORE RATHER THAN RESTATING IT", () => {
    // `computeCompeteScore` lived in server.mjs with these ceilings restated
    // here as a comment promising they matched — the mirror this codebase keeps
    // deleting. The ONE number a student is ranked on is a worse thing to keep
    // two copies of than a page price.
    const server = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    const code = server.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(
        /import\s*\{[^}]*computeCompeteScore[^}]*\}\s*from\s*["']\.\/src\/lib\/league\.js["']/.test(code),
        "server.mjs must import computeCompeteScore from ./src/lib/league.js, with the extension node needs",
    );
    assert.ok(
        !/function\s+computeCompeteScore/.test(code),
        "server.mjs must not define a second compete score",
    );
});


check("THE CREST RENDERER IS ACTUALLY RENDERED", () => {
    // `CRESTS` and `crestOf` shipped with the cred store and nothing in the
    // tree ever drew one, so a student could spend 2,400 credits on a crest
    // whose only evidence was the word "Owned" on the shelf. That is the bug
    // the store release existed to end, one file short of the finish — so the
    // renderer existing is not enough, it has to be reached.
    const read = (f) => fs.readFileSync(path.resolve(f), "utf8");
    assert.ok(fs.existsSync(path.resolve("src/components/shared/Crest.jsx")),
        "Crest.jsx is gone — every importer below is now drawing nothing");
    for (const f of [
        "src/components/league/WeeklyBoard.jsx",
        "src/components/league/Podium.jsx",
        "src/pages/League.jsx",
    ]) {
        assert.match(read(f), /<Crest\b/, `${f} imports a crest and never draws one`);
    }
    // And the board has to send the bought one, or only its owner can see it.
    assert.match(read("server.mjs"), /crest_skin:\s*crestOf\(p\)/,
        "the board must carry the equipped crest — a cosmetic only you can see is not worn");
});

console.log(`\n${passed} passed`);
