/**
 * client/server mirror assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/mirrors.test.mjs
 *
 * Some numbers exist TWICE on purpose: the server owns them, and the client
 * keeps a copy so a screen can draw a label or a bar without a round trip.
 * That is a reasonable trade and it has one failure mode — the two drift, both
 * stay internally consistent, and the app tells a student two different things
 * about one number with nothing on screen to say which is right.
 *
 * `uploadPrep`, `megaUpload`, `storageBudget` and `holdings` already pin their
 * copies this way. These two did not:
 *
 *   THE LEVEL CURVE. `xpSystem.jsx` opens with "Mirrors functions/awardXP.js —
 *   keep in sync" and nothing ever checked. The server writes `current_level`
 *   off ITS copy; every screen in the app draws the ring off the CLIENT's. A
 *   changed exponent would put the stored level and the drawn one on different
 *   curves, permanently.
 *
 *   THE ATAR BANDS. Eight thresholds, written out three times — atarBands.js,
 *   ranked.js and `atarBand()` in server.mjs. `ranked.js` now derives from
 *   atarBands.js, so this asserts the one remaining pair.
 *
 *   THE INTEGRITY CAPS. server.mjs says in its own words "Mirrors
 *   countableByDay() in src/lib/integrity.js — the client's copy DRAWS the
 *   number, this one RANKS on it ... Change one, change both", and
 *   `integrity.test.mjs` never reads server.mjs at all. Five constants and one
 *   algorithm, on the anti-cheat caps that decide the hours board, with the
 *   Progress Hours tab printing "the figure the league counts" under the
 *   result. Fuzzing the two found they already disagreed by up to two minutes.
 *
 *   THE ATAR CURVE ITSELF, which is a worse one than the bands and was found
 *   by sweeping for constants defined twice. `atarLift.js` carried the floor,
 *   the span, the exponent and the cap under a comment reading "the server's
 *   curve, exactly" — and left out the step. The server quantises to 0.05,
 *   because that is the increment the real scale moves in; the client returned
 *   the raw curve. So every "+0.0x ATAR" the app offers as a reason to do
 *   something — Today's Play's payoff rail, StandingRail's bestLever, Ranked's
 *   five component doors — was differenced off a continuous curve while the
 *   stored score it predicts is a stepped one. Nothing was checking it: this
 *   file pinned the bands and the level curve and not the thing they band.
 *
 * BOTH SIDES are parsed as text rather than imported. server.mjs boots an
 * Express app and reaches for Supabase and Anthropic keys on load, and
 * `xpSystem.jsx` is a .jsx file the test loader will not resolve. Extracting
 * both and running them compares BEHAVIOUR rather than source text, which is
 * the thing that matters: a reformat should not fail this, a changed exponent
 * must.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ATAR_BANDS, atarBandOf } from "@/lib/atarBands";
import { BANDS } from "@/lib/ranked";
import { atarFromComposite, ATAR_WEIGHTS, liftFor, ATAR_TARGETS } from "@/lib/atarLift";
import { countableMinutes } from "@/lib/integrity";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = process.cwd();
const SERVER = fs.readFileSync(path.join(ROOT, "server.mjs"), "utf8");
const XP_SYSTEM = fs.readFileSync(path.join(ROOT, "src/components/shared/xpSystem.jsx"), "utf8");

/* ── The ATAR bands ───────────────────────────────────────────────────── */

check("the server still has an atarBand() to mirror", () => {
    assert.match(SERVER, /function atarBand\s*\(/,
        "atarBand() has moved or been renamed — this test is now checking nothing");
});

check("every band threshold matches the server, name for name", () => {
    const body = SERVER.slice(SERVER.indexOf("function atarBand"));
    const fn = body.slice(0, body.indexOf("\n}") + 2);

    const serverBands = [...fn.matchAll(/atar\s*>=\s*([\d.]+)\)\s*return\s*"([^"]+)"/g)]
        .map((m) => ({ min: Number(m[1]), name: m[2] }));
    const fallback = fn.match(/return\s*"([^"]+)";\s*\n\}/);
    assert.ok(fallback, "atarBand() has no fallback band");
    serverBands.push({ min: 0, name: fallback[1] });

    assert.deepEqual(
        ATAR_BANDS.map((b) => `${b.min}:${b.name}`),
        serverBands.map((b) => `${b.min}:${b.name}`),
        "the client bands and atarBand() disagree",
    );
});

check("ranked.js derives its bands rather than restating them", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/ranked.js"), "utf8");
    assert.match(src, /ATAR_BANDS/, "ranked.js must import the thresholds, not copy them");
    // Same set, same floors, just ordered the other way and carrying a tone.
    assert.deepEqual(
        [...BANDS].map((b) => `${b.min}:${b.name}`).sort(),
        [...ATAR_BANDS].map((b) => `${b.min}:${b.name}`).sort(),
    );
    for (const b of BANDS) assert.ok(b.tone, `${b.name} has no tone`);
});

check("a score lands in the same band on both lists", () => {
    for (const atar of [0, 49.9, 50, 59.99, 60, 70, 79.5, 80, 90, 94.9, 95, 99, 99.95]) {
        const fromBands = ATAR_BANDS.find((b) => atar >= b.min).name;
        let fromRanked = BANDS[0];
        for (const b of BANDS) if (atar >= b.min) fromRanked = b;
        assert.equal(atarBandOf(atar), fromBands, `atarBandOf disagrees at ${atar}`);
        assert.equal(fromRanked.name, fromBands, `ranked.js disagrees at ${atar}`);
    }
    assert.equal(atarBandOf(null), null, "no score is no band, never 'Foundation'");
    assert.equal(atarBandOf("nonsense"), null);
});

/* ── The level curve ──────────────────────────────────────────────────── */

/**
 * Pull a function's body out of server.mjs and run it in isolation.
 *
 * `xpForLevel` and friends are self-contained arithmetic with no imports, so
 * this is safe — and it compares BEHAVIOUR rather than source text, which is
 * what actually matters. A reformat should not fail this; a changed exponent
 * must.
 */
function cut(src, name, where) {
    const at = src.search(new RegExp(`(export\\s+)?function ${name}\\(`));
    assert.notEqual(at, -1, `${where} has no ${name}() to mirror`);
    const body = src.slice(at).replace(/^export\s+/, "");
    return body.slice(0, body.indexOf("\n}") + 2);
}

/** All three level functions out of one file, as a live object. */
function levelCurve(src, where) {
    const parts = ["xpForLevel", "xpToNextLevel", "levelFromXP"].map((n) => cut(src, n, where));
    return new Function(`${parts.join("\n")}\nreturn { xpForLevel, xpToNextLevel, levelFromXP };`)();
}

const client = levelCurve(XP_SYSTEM, "xpSystem.jsx");
const server = levelCurve(SERVER, "server.mjs");

check("the level curve is the same function on both sides", () => {
    for (let n = 1; n <= 60; n++) {
        assert.equal(client.xpForLevel(n), server.xpForLevel(n), `xpForLevel(${n}) differs`);
        assert.equal(client.xpToNextLevel(n), server.xpToNextLevel(n), `xpToNextLevel(${n}) differs`);
    }
    // And the inverse, including the exact boundaries where a level flips —
    // which is where an off-by-one between the two would actually bite.
    for (const xp of [0, 1, 119, 120, 121, 500, 5_000, 50_000, 250_000, 1_000_000]) {
        assert.equal(client.levelFromXP(xp), server.levelFromXP(xp), `levelFromXP(${xp}) differs`);
    }
    for (let n = 2; n <= 40; n++) {
        const edge = client.xpForLevel(n);
        assert.equal(client.levelFromXP(edge), server.levelFromXP(edge), `boundary into level ${n} differs`);
        assert.equal(client.levelFromXP(edge - 1), server.levelFromXP(edge - 1), `boundary below level ${n} differs`);
    }
});

check("the curve is monotonic and starts at level 1", () => {
    // Not a mirror check — a sanity one. A curve that ever went backwards
    // would demote a student for earning XP.
    assert.equal(client.levelFromXP(0), 1);
    assert.equal(client.xpForLevel(1), 0);
    let prev = -1;
    for (let n = 1; n <= 100; n++) {
        const v = client.xpForLevel(n);
        assert.ok(v > prev, `xpForLevel(${n}) did not increase`);
        prev = v;
    }
});

check("the data export derives the level rather than reading the stored column", () => {
    // `current_level` is written by the server and can sit stale behind an XP
    // award that has not reconciled. Every other screen computes it from
    // total_xp, so the export was the one place able to print a different one.
    const src = fs.readFileSync(path.join(ROOT, "src/components/shared/DataExportModal.jsx"), "utf8");
    assert.match(src, /levelFromXP\(/, "the export must derive the level");
    // CODE ONLY. The first version of this matched the comment that explains
    // the fix, which is the same false positive fnResult.test.mjs had to solve
    // — a file documenting a broken pattern must not fail the scan for it.
    const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.ok(!/\bcurrent_level\b/.test(code),
        "the export still reads the stored current_level");
});

/* ── The ATAR curve ───────────────────────────────────────────────────── */

/**
 * The composite→score curve, lifted out of computeAcedItATAR() and RUN.
 *
 * It is not a function on the server — it is three statements inside a long
 * handler — so this slices the arithmetic rather than cutting a signature. The
 * point is the same as `levelCurve` above: compare BEHAVIOUR, so a reformat
 * passes and a changed exponent, cap or STEP fails.
 */
function serverAtarCurve() {
    const at = SERVER.indexOf("const composite =");
    assert.notEqual(at, -1, "server.mjs no longer builds an ATAR composite — this checks nothing");
    const tail = SERVER.slice(at);

    const raw = tail.match(/const raw\s*=\s*([^;]+);/);
    const atar = tail.match(/const atar\s*=\s*([^;]+);/);
    assert.ok(raw && atar, "the curve is no longer a `raw` then `atar` pair");

    return new Function(
        "composite",
        `const raw = ${raw[1]};\nconst atar = ${atar[1]};\nreturn Number(atar.toFixed(2));`,
    );
}

check("the five component weights match the server's composite", () => {
    const expr = SERVER.slice(SERVER.indexOf("const composite ="))
        .match(/const composite\s*=\s*([^;]+);/)[1];
    const server = Object.fromEntries(
        [...expr.matchAll(/([\d.]+)\s*\*\s*(\w+)/g)].map((m) => [m[2], Number(m[1])]),
    );
    assert.deepEqual(
        Object.fromEntries(Object.entries(ATAR_WEIGHTS).map(([k, v]) => [k, Number(v)])),
        server,
        "the client weights and the server's composite disagree",
    );
});

check("the server still rounds the score it returns to two places", () => {
    // The toFixed is applied where the score is RETURNED rather than where the
    // curve is computed, so it is easy to drop while the curve looks untouched.
    assert.match(SERVER, /atar:\s*Number\(atar\.toFixed\(2\)\)/,
        "computeAcedItATAR no longer fixes the score to two places");
});

check("the client ATAR curve is the server's, step for step", () => {
    const curve = serverAtarCurve();
    for (let i = 0; i <= 1000; i++) {
        const c = i / 1000;
        assert.equal(atarFromComposite(c), curve(c), `composite ${c} differs`);
    }
    // Out of range either way: both clamp, so both must agree there too.
    for (const c of [-2, -0.0001, 1.0001, 3]) {
        assert.equal(atarFromComposite(c), curve(c), `composite ${c} differs outside [0,1]`);
    }
});

check("every score the curve returns is a step the stored score can reach", () => {
    // This is what the drift actually cost. A figure off the raw curve lands
    // between two reachable scores, so a student could never confirm it.
    for (let i = 0; i <= 1000; i++) {
        const v = atarFromComposite(i / 1000);
        assert.ok(Math.abs(v * 20 - Math.round(v * 20)) < 1e-9,
            `atarFromComposite(${i / 1000}) = ${v} is not a multiple of 0.05`);
    }
});

check("a published lift is a gain the stored score could actually show", () => {
    const comps = { mastery: 42, consistency: 55, effort: 61, breadth: 40, planning: 18 };
    for (const key of Object.keys(ATAR_WEIGHTS)) {
        for (const delta of [1, 5, 10, 25]) {
            const lift = liftFor(comps, key, delta);
            assert.ok(lift, `no lift for ${key}`);
            assert.ok(Math.abs(lift.gain * 20 - Math.round(lift.gain * 20)) < 1e-9,
                `${key} +${delta} gains ${lift.gain}, which the score cannot move by`);
            assert.ok(lift.gain >= 0, `${key} +${delta} gains a negative`);
        }
    }
});

check("the client's component targets match the server's constants", () => {
    // Breadth already shipped its target in the payload and both panels read
    // it; consistency and effort had theirs typed into the copy as "of 20
    // days" and "of ~20h", in AtarPanel.jsx AND Ranked.jsx. They are published
    // now, and these are the fallbacks for a components blob written before
    // that — so the pair has to stay honest or the fallback starts printing a
    // denominator the score is no longer graded against.
    const pairs = [
        ["consistency_days", "CONSISTENCY_TARGET_DAYS"],
        ["effort_minutes", "EFFORT_TARGET_MINUTES"],
        ["technique_families", "BREADTH_TARGET_FAMILIES"],
    ];
    for (const [clientKey, serverName] of pairs) {
        const m = SERVER.match(new RegExp(`const ${serverName}\\s*=\\s*([\\d.]+)`));
        assert.ok(m, `server.mjs has no ${serverName} to mirror`);
        assert.equal(ATAR_TARGETS[clientKey], Number(m[1]),
            `ATAR_TARGETS.${clientKey} and ${serverName} disagree`);
    }
});

check("the server publishes every target a panel prints a denominator from", () => {
    // The panels prefer the payload over the fallback, so a target that stops
    // being SENT silently freezes the printed denominator at the client's copy.
    for (const key of ["technique_target", "consistency_target", "effort_target"]) {
        assert.match(SERVER, new RegExp(`${key}:`), `atar_components no longer carries ${key}`);
    }
});

check("the ATAR panels print no hard-typed denominator of their own", () => {
    for (const f of ["src/components/analytics/AtarPanel.jsx", "src/pages/Ranked.jsx"]) {
        const full = fs.readFileSync(path.join(ROOT, f), "utf8");
        assert.ok(full.length, `${f} has moved — this check covers nothing`);
        // Comments explain the figures that were removed, so strip them first.
        // That false positive is the one fnResult.test.mjs and hookDeps.test.mjs
        // each had to learn, and the cheap way to green it is deleting the note
        // that says why.
        const code = full
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
        assert.ok(!/of 20 days/.test(code), `${f} still hard-types the consistency target`);
        assert.ok(!/of ~20h/.test(code), `${f} still hard-types the effort target`);
        assert.ok(!/\?\?\s*5\)/.test(code), `${f} still hard-types the breadth target`);
    }
});

check("the ranked-at floor is read from the payload, not typed in", () => {
    const full = fs.readFileSync(path.join(ROOT, "src/components/analytics/AtarPanel.jsx"), "utf8");
    const code = full
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.match(SERVER, /const ATAR_MIN_STUDY_DAYS\s*=/, "the server's floor has been renamed");
    assert.match(code, /comps\.study_days/, "the panel must read study_days, not reconstruct it");
    assert.ok(!/3 - daysNeeded/.test(code), "the panel still reconstructs the days done from a literal 3");
    assert.ok(!/\/3 days/.test(code), "the panel still prints a literal ranking floor");
});

/* ── The integrity caps ───────────────────────────────────────────────────
 *
 * These decide the hours leaderboard, and the client copy is what the Progress
 * Hours tab DRAWS — under a note reading "Capped the way every ranked board
 * caps them, so this figure is the one the league counts." That sentence is a
 * claim about this pair, and nothing was checking it.
 */

const CAP_PAIRS = [
    "TAB_AWAY_MINUTES", "SESSION_MAX_MINUTES", "DAILY_MINUTE_CAP",
    "BOARD_MIN_QUESTIONS", "BOARD_MIN_MARKS",
];

check("every integrity cap is the same number on both sides", async () => {
    const client = await import("@/lib/integrity");
    for (const name of CAP_PAIRS) {
        const m = SERVER.match(new RegExp(`^const ${name}\\s*=\\s*([\\d.]+)`, "m"));
        assert.ok(m, `server.mjs has no ${name} to mirror`);
        assert.ok(client[name] !== undefined, `integrity.js no longer exports ${name}`);
        assert.equal(client[name], Number(m[1]), `${name} differs: client ${client[name]}, server ${m[1]}`);
    }
});

/** countableStudyMinutes and its two helpers, lifted out of server.mjs. */
function serverCountable() {
    const parts = ["countedFocusMinutes", "dayKeyOf", "countableStudyMinutes"]
        .map((n) => {
            const at = SERVER.search(new RegExp(`(const|function) ${n}\\b`));
            assert.notEqual(at, -1, `server.mjs has no ${n}`);
            const body = SERVER.slice(at);
            return body.slice(0, body.indexOf("\n}") + 2);
        });
    const caps = CAP_PAIRS.map((n) => {
        const m = SERVER.match(new RegExp(`^const ${n}\\s*=\\s*([\\d.]+)`, "m"));
        return `const ${n} = ${m[1]};`;
    }).join("\n");
    return new Function(`${caps}\n${parts.join("\n")}\nreturn countableStudyMinutes;`)();
}

// TWO CLOCKS, AND THE EARLY ONE IS THE POINT. Today's ceiling is
// `min(DAILY_MINUTE_CAP, minutes since midnight)`, so after midday the elapsed
// half can never bite — 20:00 is 1200 minutes and the flat cap is 720, so the
// whole check collapses to the cap and deleting it changes nothing. A morning
// clock is the only one that reaches the branch, which an injection proved by
// passing silently against an evening-only fixture.
const EVENING = new Date("2026-03-12T20:00:00");
const MORNING = new Date("2026-03-12T09:30:00");   // 570 min elapsed, under the cap

check("the client counts the same minutes the board ranks on", () => {
    const server = serverCountable();
    // A deterministic walk rather than a handful of cases: the drift this
    // found was a ROUNDING one, invisible on whole minutes and on every
    // hand-written fixture, and only a spread of fractional idle ratios and
    // tab-aways across capped and uncapped days reaches it.
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const NOW of [EVENING, MORNING]) {
        for (let t = 0; t < 600; t++) {
            const rows = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => ({
                day: ["2026-03-09", "2026-03-10", "2026-03-12"][Math.floor(rnd() * 3)],
                minutes: Math.round(rnd() * 300 * 10) / 10,
                idle_ratio: Math.round(rnd() * 0.6 * 100) / 100,
                tab_away_count: Math.floor(rnd() * 5),
            }));
            const a = server(rows.map((r) => ({ ...r, at: r.day })), NOW);
            const b = countableMinutes(rows.map((r) => ({
                day: r.day, duration_minutes: r.minutes,
                idle_ratio: r.idle_ratio, tab_away_count: r.tab_away_count,
            })), NOW);
            assert.equal(b, a, `countable minutes differ at ${NOW.toISOString()} on ${JSON.stringify(rows)}`);
        }
    }
});

check("the three caps that bite still bite, on both sides", () => {
    const server = serverCountable();
    const one = (rows, NOW) => [
        server(rows.map((r) => ({ ...r, at: r.day })), NOW),
        countableMinutes(rows.map((r) => ({ day: r.day, duration_minutes: r.minutes })), NOW),
    ];
    const allDay = (day) => Array.from({ length: 9 }, () => ({ day, minutes: 240 }));

    // One row is at most one sitting.
    assert.deepEqual(one([{ day: "2026-03-10", minutes: 9000 }], EVENING), [240, 240]);
    // One past day is at most the flat cap.
    assert.deepEqual(one(allDay("2026-03-10"), EVENING), [720, 720]);
    // AND TODAY IS CAPPED BY THE MINUTES THAT HAVE ACTUALLY PASSED. Asserted at
    // 09:30 — 570 elapsed, under the flat cap — because that is the only time
    // of day where this differs from the line above. At 20:00 both answer 720
    // whether the elapsed check exists or not.
    assert.deepEqual(one(allDay("2026-03-12"), MORNING), [570, 570]);
    assert.deepEqual(one(allDay("2026-03-12"), EVENING), [720, 720]);
});

check("the Hours tab sums the unrounded figure, not the per-day rounded one", () => {
    // The claim printed under that number is that it is the league's figure.
    const src = fs.readFileSync(path.join(ROOT, "src/lib/progressReport.js"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.match(code, /rec\?\.exact/, "minutesIn no longer reads the unrounded per-day figure");
    assert.match(code, /total \+= exact/, "minutesIn is summing something other than the exact figure");
});

console.log(`\nmirrors: ${passed} checks passed`);
