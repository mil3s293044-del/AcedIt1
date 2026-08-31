/**
 * ink assertions —  node --import ./src/lib/_aliasLoader.mjs src/lib/ink.test.mjs
 */
import assert from "node:assert/strict";
import {
    newStroke, addPoint, inkLength, isBlank, inkBounds, strokePath, compact,
} from "@/lib/ink";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

/** A horizontal stroke `len` px long, starting at (x, y). */
const line = (x, y, len, step = 4) =>
    Array.from({ length: Math.floor(len / step) + 1 }, (_, i) => [x + i * step, y]);

check("points closer than the gap are dropped", () => {
    // A pointer firing 240Hz otherwise stores thousands of points per digit,
    // and every one of them gets written to the database.
    let s = newStroke(0, 0);
    for (let i = 0; i < 50; i += 1) s = addPoint(s, 0.4 * i, 0);
    assert.ok(s.length < 20, `kept ${s.length} points for a 20px stroke`);
    assert.ok(s.length > 2);
});

check("a first point on an empty stroke starts one", () => {
    assert.deepEqual(addPoint(null, 3, 4), [[3, 4]]);
    assert.deepEqual(addPoint([], 3, 4), [[3, 4]]);
});

check("a tap is a blank pad, not an answer", () => {
    assert.equal(isBlank([]), true);
    assert.equal(isBlank(null), true);
    assert.equal(isBlank([[[10, 10]]]), true, "one point is a tap");
    assert.equal(isBlank([line(0, 0, 8)]), true, "8px of ink is a smudge");
});

check("real writing is not blank", () => {
    assert.equal(isBlank([line(0, 0, 60)]), false);
    assert.equal(isBlank([line(0, 0, 12), line(0, 20, 20)]), false, "several short strokes add up");
});

check("length ignores strokes that are not strokes", () => {
    assert.equal(inkLength([null, "nope", [], [[0, 0]]]), 0);
    assert.equal(Math.round(inkLength([line(0, 0, 40)])), 40);
});

check("bounds crop to the writing, padded", () => {
    // A 900x200 pad holding one small "x = 4" hands the model a mostly-empty
    // frame, and recognition gets worse the smaller the writing is in it.
    const b = inkBounds([line(100, 50, 40)], 10);
    assert.deepEqual(b, { x: 90, y: 40, width: 60, height: 20 });
});

check("bounds of nothing is nothing, not a zero-size crop", () => {
    assert.equal(inkBounds([]), null);
    assert.equal(inkBounds(null), null);
    assert.equal(inkBounds([[["a", "b"]], [[NaN, 3]]]), null, "junk coordinates are not bounds");
});

check("a path is drawn even for one point, so a full stop is writable", () => {
    assert.ok(strokePath([[5, 5]]).startsWith("M 5 5"));
    assert.equal(strokePath([]), "");
    assert.equal(strokePath(null), "");
    const d = strokePath(line(0, 0, 20));
    assert.ok(d.includes("Q"), "smoothed rather than faceted");
    assert.ok(d.trimEnd().endsWith("L 20 0"), "and it reaches the last point");
});

check("saving drops the sub-pixel precision and the taps", () => {
    const saved = compact([line(0.44, 0.51, 20), [[9, 9]]]);
    assert.equal(saved.length, 1, "the one-point stroke is not saved");
    assert.deepEqual(saved[0][0], [0, 1]);
});

console.log(`\n${passed} passed`);
