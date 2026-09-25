/**
 * the poses Ace is asked to hold —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/acePose.test.mjs
 *
 * ─── The bug this exists to catch ───────────────────────────────────────────
 * AceBody fires its idles ONLY from a resting pose. So this renders perfectly,
 * passes lint and the build, and is a still frame:
 *
 *     <AceWalker pose="point" />        // point is not a resting pose
 *
 * He walks in, raises an arm, and holds it for however long the student takes
 * to read what he just said — which on a tutorial beat is the longest he is
 * ever on screen. Nothing throws and nothing looks broken; he is simply a
 * drawing, which is the exact failure AceDeal's header records ("the switches
 * that turn his own motion off").
 *
 * AceWalker's answer is a SEQUENCE whose last entry is held, so the rule is
 * about that last entry. Both onboarding surfaces are checked here rather than
 * in their own suites, because the rule belongs to the walker and the next
 * surface to use one needs the same guard.
 *
 * Poses are read out of AceBody.jsx as TEXT — it is a .jsx and the test loader
 * will not resolve it, the same reason mirrors.test.mjs parses its two sides.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { STOPS } from "@/lib/aceTour";
import { BEATS } from "@/lib/firstWin";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const body = fs.readFileSync("src/components/ace/AceBody.jsx", "utf8");

/** Every pose name in the table, and the ones he is allowed to fidget out of. */
const POSES = new Set(
    [...body.matchAll(/^\s{4}(\w+)\s*:\s*\{/gm)].map((m) => m[1]),
);
const RESTING = new Set(
    (body.match(/const RESTING = new Set\(\[([^\]]*)\]\)/)?.[1] || "")
        .match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, "")) || [],
);

/** The per-beat table in FirstWin.jsx, which is a component and not a module. */
const firstWin = fs.readFileSync("src/components/ace/FirstWin.jsx", "utf8");
const POSE_TABLE = {};
{
    const block = firstWin.match(/const POSE = \{([\s\S]*?)\n\};/)?.[1] || "";
    for (const m of block.matchAll(/^\s*(\w+):\s*(\[[^\]]*\]|"[^"]*")/gm)) {
        POSE_TABLE[m[1]] = JSON.parse(m[2].replace(/'/g, '"'));
    }
}
const POSE_BUSY = firstWin.match(/const POSE_BUSY = "(\w+)"/)?.[1];

/** A string is a sequence of one, exactly as AceWalker reads it. */
const seq = (p) => (Array.isArray(p) ? p : [p]);

check("the pose table and the resting set parsed", () => {
    assert.ok(POSES.size > 20, `only found ${POSES.size} poses — the parse drifted`);
    assert.ok(RESTING.size >= 3, "RESTING came back empty — the parse drifted");
    for (const r of RESTING) assert.ok(POSES.has(r), `RESTING names "${r}", which is not a pose`);
    assert.ok(!RESTING.has("point"), "point is resting now — this whole file is about it not being");
});

check("every tour stop names real poses and SETTLES on a resting one", () => {
    for (const s of STOPS) {
        assert.ok(s.pose, `${s.id}: no pose — he would stand still through the whole stop`);
        const list = seq(s.pose);
        for (const p of list) assert.ok(POSES.has(p), `${s.id}: "${p}" is not a pose`);
        assert.ok(RESTING.has(list[list.length - 1]),
            `${s.id}: ends on "${list[list.length - 1]}", which AceBody never fidgets out of`);
    }
});

check("every first-win beat has a gesture, and settles", () => {
    for (const beat of BEATS) {
        assert.ok(POSE_TABLE[beat], `beat "${beat}" has no pose — add one deliberately`);
        const list = seq(POSE_TABLE[beat]);
        for (const p of list) assert.ok(POSES.has(p), `${beat}: "${p}" is not a pose`);
        assert.ok(RESTING.has(list[list.length - 1]),
            `${beat}: ends on "${list[list.length - 1]}", so he freezes while they read it`);
    }
});

check("the busy pose is real, and is deliberately NOT a rest", () => {
    assert.ok(POSES.has(POSE_BUSY), `POSE_BUSY "${POSE_BUSY}" is not a pose`);
    assert.ok(!RESTING.has(POSE_BUSY),
        "while the questions are being written he is working, not resting — a fidget there reads as idle");
});

check("a held pose is the LAST entry, not the first", () => {
    // The whole mechanism in one assertion: if AceWalker ever went back to
    // holding `pose` itself, every sequence above would play its gesture and
    // then stop on it, and these tables would be quietly wrong.
    const walker = fs.readFileSync("src/components/ace/AceWalker.jsx", "utf8");
    assert.ok(/const held = seq\[Math\.min\(phase, last\)\]/.test(walker),
        "AceWalker no longer holds the sequence's last entry");
    assert.ok(/pose=\{walking && !reduce \? "walk" : held\}/.test(walker),
        "AceBody is being handed the raw pose prop again, not the sequence's current entry");
});

console.log(`\n${passed} passed`);
