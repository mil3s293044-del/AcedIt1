/**
 * zoom assertions — node --import ./src/lib/_aliasLoader.mjs src/lib/zoom.test.mjs
 *
 * The bug these pin down was not a wrong number, it was a discarded one: the
 * old handler read the sign of deltaY and threw the magnitude away, so a
 * trackpad's twenty small events counted the same as twenty mouse notches.
 */
import assert from "node:assert/strict";
import {
    wheelPixels, wheelZoomFactor,
    ZOOM_PER_PIXEL, MAX_STEP, PIXELS_PER_LINE, PIXELS_PER_PAGE,
} from "@/lib/zoom";

let passed = 0;
const check = (name, fn) => {
    try {
        fn();
        passed += 1;
        console.log(`  ok  ${name}`);
    } catch (err) {
        console.error(`FAIL  ${name}\n      ${err.message}`);
        process.exitCode = 1;
    }
};

/** What the old handler did, for comparison. */
const OLD_STEP = 1.12;
const oldFactor = (e) => (e.deltaY < 0 ? OLD_STEP : 1 / OLD_STEP);

const wheel = (deltaY, extra = {}) => ({ deltaY, deltaMode: 0, ctrlKey: false, ...extra });

console.log("\nzoom\n");

check("scrolling up zooms in, down zooms out", () => {
    assert.ok(wheelZoomFactor(wheel(-100)) > 1, "up should zoom in");
    assert.ok(wheelZoomFactor(wheel(100)) < 1, "down should zoom out");
});

check("magnitude is respected, not just the sign [REGRESSION]", () => {
    // The entire bug: these three were identical before.
    const small = wheelZoomFactor(wheel(-4));
    const medium = wheelZoomFactor(wheel(-40));
    const large = wheelZoomFactor(wheel(-120));
    assert.ok(small < medium && medium < large, `expected increasing: ${small}, ${medium}, ${large}`);
    assert.equal(oldFactor(wheel(-4)), oldFactor(wheel(-120)), "the old handler really did treat these as equal");
});

check("a trackpad flick no longer zooms seventeen times [REGRESSION]", () => {
    // 25 events of 4px, which is an ordinary two-finger swipe.
    const events = Array.from({ length: 25 }, () => wheel(-4));
    const now = events.reduce((acc, e) => acc * wheelZoomFactor(e), 1);
    const before = events.reduce((acc, e) => acc * oldFactor(e), 1);
    assert.ok(before > 15, `old behaviour should be wild, got ${before.toFixed(1)}x`);
    assert.ok(now < 1.25, `one flick should be a nudge, got ${now.toFixed(2)}x`);
    console.log(`      (same gesture: ${before.toFixed(1)}x before, ${now.toFixed(2)}x now)`);
});

check("a mouse notch still feels like the old one", () => {
    // The device that was never the problem must not get worse.
    const f = wheelZoomFactor(wheel(-100));
    assert.ok(f > 1.10 && f < 1.25, `expected roughly the old 1.12 step, got ${f.toFixed(3)}`);
});

check("trackpad and mouse agree over the same distance", () => {
    const oneBigEvent = wheelZoomFactor(wheel(-100));
    const manySmall = Array.from({ length: 25 }, () => wheel(-4))
        .reduce((acc, e) => acc * wheelZoomFactor(e), 1);
    // Same 100px of travel, so the same zoom whichever device reported it.
    assert.ok(Math.abs(oneBigEvent - manySmall) < 0.001,
        `${oneBigEvent.toFixed(4)} vs ${manySmall.toFixed(4)}`);
});

check("zooming in then back out lands exactly where it started", () => {
    // exp(-d) * exp(d) is 1 — the reason for an exponential rather than a
    // linear factor. A student who overshoots can scroll back and be home.
    for (const d of [4, 37, 100]) {
        const round = wheelZoomFactor(wheel(-d)) * wheelZoomFactor(wheel(d));
        assert.ok(Math.abs(round - 1) < 1e-12, `delta ${d} round-tripped to ${round}`);
    }
});

check("deltaMode line and page units are converted", () => {
    assert.equal(wheelPixels(wheel(3, { deltaMode: 1 })), 3 * PIXELS_PER_LINE);
    assert.equal(wheelPixels(wheel(2, { deltaMode: 2 })), 2 * PIXELS_PER_PAGE);
    // Firefox reports lines; without conversion its wheel barely moved at all.
    const firefox = wheelZoomFactor(wheel(-3, { deltaMode: 1 }));
    const chrome = wheelZoomFactor(wheel(-48));
    assert.ok(Math.abs(firefox - chrome) < 1e-12, "same physical scroll, same zoom");
});

check("pinch gets its own gain so it isn't inert", () => {
    // Trackpad pinch arrives as ctrl+wheel with much smaller deltas.
    const pinch = wheelZoomFactor(wheel(-5, { ctrlKey: true }));
    const scroll = wheelZoomFactor(wheel(-5));
    assert.ok(pinch > scroll, "a pinch must move more than the same delta scrolling");
    assert.ok(pinch < MAX_STEP);
});

check("one absurd event cannot teleport the map", () => {
    assert.ok(wheelZoomFactor(wheel(-100000)) <= MAX_STEP);
    assert.ok(wheelZoomFactor(wheel(100000)) >= 1 / MAX_STEP);
});

check("empty and malformed wheel events are a no-op", () => {
    assert.equal(wheelZoomFactor(wheel(0)), 1);
    assert.equal(wheelZoomFactor({}), 1);
    assert.equal(wheelZoomFactor({ deltaY: NaN }), 1);
    assert.equal(wheelZoomFactor(null), 1);
    assert.ok(ZOOM_PER_PIXEL > 0);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
