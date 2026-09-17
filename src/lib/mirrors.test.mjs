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

console.log(`\nmirrors: ${passed} checks passed`);
