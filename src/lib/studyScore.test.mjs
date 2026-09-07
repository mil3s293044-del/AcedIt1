/**
 * study score assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/studyScore.test.mjs
 *
 * The ones that matter most are the scaling tests: the catalogue gives exactly
 * one point on the scaling curve, and applying it flat would have a raw 48 in
 * a +5 subject scaling to 53 — above the ceiling, printed at a student.
 */
import assert from "node:assert/strict";
import {
    STATE_MEAN, STATE_SD, SCORE_MAX, clampScore, density, cdf,
    percentileFor, topPercentFor, topPercentLabel, curvePoints,
    scalingOffset, scaledScore, hueOf,
} from "@/lib/studyScore";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const near = (a, b, tol, msg) =>
    assert.ok(Math.abs(a - b) <= tol, `${msg || ""} — got ${a}, wanted ${b} ±${tol}`);

// ─── the distribution ───────────────────────────────────────────────────────

check("the mean is the median, and it is 30", () => {
    near(cdf(STATE_MEAN), 0.5, 1e-9, "a symmetric curve puts half the state below its mean");
    near(percentileFor(30), 50, 1e-6);
});

check("one standard deviation lands where a normal says it does", () => {
    // 30 + 7 = 37 is the ~84th percentile; 30 - 7 = 23 the ~16th.
    near(percentileFor(STATE_MEAN + STATE_SD), 84.13, 0.05);
    near(percentileFor(STATE_MEAN - STATE_SD), 15.87, 0.05);
});

check("a 40 is roughly the top 8% and a 45 roughly the top 2%", () => {
    // The two figures a VCE student actually quotes at each other.
    near(topPercentFor(40), 7.66, 0.1);
    near(topPercentFor(45), 1.60, 0.1);
});

check("the scale is capped at both ends", () => {
    assert.equal(clampScore(64), SCORE_MAX);
    assert.equal(clampScore(-3), 0);
    assert.equal(clampScore("38"), 38);
    assert.equal(clampScore(null), 0);
    assert.equal(clampScore(37.6), 38, "scores are whole numbers");
});

check("precision is not claimed past where the model holds", () => {
    // The normal is an approximation out at the ends — the real distribution is
    // truncated at 50 — so four significant figures there would be a lie.
    assert.equal(topPercentLabel(30), "top 50%");
    assert.match(topPercentLabel(40), /^top \d\.\d%$/, "one decimal below ten");
    // The top of the scale is 2.86 SD out, not off the end of the world: it is
    // a fifth of a percent, and nothing on a 0-50 scale rounds to zero.
    assert.equal(topPercentLabel(50), "top 0.2%");
});

check("the curve peaks at the mean and falls away on both sides", () => {
    const pts = curvePoints(51);
    const top = pts.reduce((a, b) => (b.height > a.height ? b : a));
    near(top.score, STATE_MEAN, 0.6);
    near(density(23), density(37), 1e-12, "symmetric about the mean");
    assert.ok(density(50) < density(40) && density(40) < density(30));
    assert.equal(pts[0].score, 0);
    assert.equal(pts[pts.length - 1].score, SCORE_MAX);
});

// ─── scaling ────────────────────────────────────────────────────────────────

const METHODS = { scaling_info: { scaling_factor: "+5" } };
const FURTHER = { scaling_info: { scaling_factor: "-2" } };

check("the offset is read off the catalogue's own string", () => {
    assert.equal(scalingOffset(METHODS), 5);
    assert.equal(scalingOffset(FURTHER), -2);
    assert.equal(scalingOffset({ scaling_info: { scaling_factor: "+N" } }), null,
        "the catalogue's placeholder is not a number");
    assert.equal(scalingOffset({}), null);
    assert.equal(scalingOffset(null), null);
});

check("it is exact at 30, which is the one point the catalogue gives", () => {
    // "A raw 30 scales to 35" — the taper must not disturb the anchor.
    assert.equal(scaledScore(30, METHODS), 35);
    assert.equal(scaledScore(30, FURTHER), 28);
});

check("scaling CANNOT push a score past the ceiling", () => {
    // Applied flat, a raw 48 in Methods would print as 53.
    assert.equal(scaledScore(50, METHODS), 50);
    assert.ok(scaledScore(48, METHODS) <= 50);
    assert.ok(scaledScore(48, METHODS) > 48, "it should still be worth something");
});

check("a subject with no scaling in the catalogue claims none", () => {
    assert.equal(scaledScore(40, {}), null);
    assert.equal(scaledScore(40, { scaling_info: { scaling_factor: "+N" } }), null);
});

check("downward scaling stays on the scale too", () => {
    assert.ok(scaledScore(50, FURTHER) <= 50);
    assert.ok(scaledScore(10, FURTHER) >= 0);
});

// ─── hue order ──────────────────────────────────────────────────────────────

check("the spectrum runs red, yellow, green, blue, purple", () => {
    const order = ["#EF4444", "#F59E0B", "#58CC02", "#3B82F6", "#A855F7"]
        .map(hueOf);
    assert.deepEqual([...order].sort((a, b) => a - b), order,
        "these are already in wheel order and must sort as-is");
});

check("grey sorts LAST and does not scatter", () => {
    // The default colour is #6B7280, whose hue is an artefact of a near-neutral
    // mix — sorted into the blues it would drop every uncoloured subject at a
    // position nobody chose.
    assert.equal(hueOf("#6B7280"), 400);
    assert.equal(hueOf("#FFFFFF"), 400);
    assert.equal(hueOf(""), 400);
    assert.equal(hueOf(null), 400);
    assert.ok(hueOf("#6B7280") > hueOf("#A855F7"), "after every real colour");
});

check("a dark colour is not mistaken for grey", () => {
    assert.ok(hueOf("#0A5C1E") < 400, "dark green is still green");
});

console.log(`\n${passed} passed`);
