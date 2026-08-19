/**
 * theme assertions — node --import ./src/lib/_aliasLoader.mjs src/lib/theme.test.mjs
 *
 * The one that matters most is the last: the inline script in index.html is a
 * hand copy of resolveTheme, because it has to run before any bundle parses.
 * A copy that drifts from its original is a page that flashes the wrong colour
 * on every load, so the copy is checked against the real thing here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    resolveTheme, normalisePreference, isDarkHour, isLive, msUntilNextFlip,
    currentDescription, PREFERENCES, DEFAULT_PREFERENCE, STORAGE_KEY,
    DARK_FROM_HOUR, LIGHT_FROM_HOUR, THEME_COLOR, GROUND,
} from "@/lib/theme";

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

console.log("\ntheme\n");

check("an explicit choice ignores the device and the clock", () => {
    assert.equal(resolveTheme("light", { prefersDark: true, hour: 23 }), "light");
    assert.equal(resolveTheme("dark", { prefersDark: false, hour: 11 }), "dark");
});

check("system follows the device", () => {
    assert.equal(resolveTheme("system", { prefersDark: true, hour: 11 }), "dark");
    assert.equal(resolveTheme("system", { prefersDark: false, hour: 23 }), "light",
        "the clock must not override the device on the system setting");
});

check("auto follows the clock and ignores the device", () => {
    assert.equal(resolveTheme("auto", { prefersDark: false, hour: 22 }), "dark");
    assert.equal(resolveTheme("auto", { prefersDark: true, hour: 11 }), "light");
});

check("the day boundaries are where they say they are", () => {
    assert.equal(isDarkHour(LIGHT_FROM_HOUR - 1), true, "5am is still night");
    assert.equal(isDarkHour(LIGHT_FROM_HOUR), false, "6am is morning");
    assert.equal(isDarkHour(DARK_FROM_HOUR - 1), false, "6pm is still light");
    assert.equal(isDarkHour(DARK_FROM_HOUR), true, "7pm is dark");
    assert.equal(isDarkHour(0), true);
    assert.equal(isDarkHour(23), true);
});

check("system is the default, and rubbish falls back to it", () => {
    assert.equal(DEFAULT_PREFERENCE, "system");
    assert.equal(normalisePreference(null), "system");
    assert.equal(normalisePreference("DARK"), "system", "case matters, so this is not a valid value");
    assert.equal(normalisePreference("aubergine"), "system");
    assert.equal(normalisePreference(undefined), "system");
    for (const p of PREFERENCES) assert.equal(normalisePreference(p), p);
});

check("only system and auto change on their own", () => {
    assert.equal(isLive("system"), true);
    assert.equal(isLive("auto"), true);
    assert.equal(isLive("light"), false);
    assert.equal(isLive("dark"), false);
});

check("the next flip is the next boundary, not a poll", () => {
    const at = (h, m = 0) => new Date(2026, 7, 19, h, m, 0, 0);
    const hours = (ms) => ms / 3_600_000;
    // 2pm -> 7pm is five hours away.
    assert.equal(hours(msUntilNextFlip(at(14))), 5);
    // 3am -> 6am is three.
    assert.equal(hours(msUntilNextFlip(at(3))), 3);
    // 10pm -> 6am tomorrow is eight.
    assert.equal(hours(msUntilNextFlip(at(22))), 8);
    // Never zero or negative, even standing exactly on a boundary.
    assert.ok(msUntilNextFlip(at(19, 0)) > 0);
    assert.ok(msUntilNextFlip(at(6, 0)) > 0);
});

check("the control explains itself only when there is something to explain", () => {
    assert.equal(currentDescription("light", "light"), null, "nothing to say about an explicit choice");
    assert.equal(currentDescription("dark", "dark"), null);
    assert.match(currentDescription("system", "dark"), /device is set to dark/);
    assert.match(currentDescription("auto", "light"), /Currently light/);
});

check("both themes get a browser chrome colour", () => {
    assert.match(THEME_COLOR.light, /^#[0-9a-fA-F]{6}$/);
    assert.match(THEME_COLOR.dark, /^#[0-9a-fA-F]{6}$/);
    assert.notEqual(THEME_COLOR.light, THEME_COLOR.dark);
});

check("the inline boot script agrees with this module [REGRESSION]", () => {
    // The script in index.html must reach the same answer as resolveTheme for
    // every case, or the page paints one theme and then swaps to the other.
    // It cannot import anything, so it is a copy — and this is what stops the
    // copy rotting.
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

    assert.ok(html.includes(STORAGE_KEY),
        `index.html must read the same storage key ("${STORAGE_KEY}")`);
    assert.ok(/classList\.add\(\s*["']dark["']\s*\)/.test(html),
        "index.html must be able to set the dark class before first paint");
    assert.ok(html.includes(String(DARK_FROM_HOUR)) && html.includes(String(LIGHT_FROM_HOUR)),
        "index.html must use the same day boundaries");
    // The class alone leaves one white frame before the stylesheet lands, so
    // the boot script paints the ground itself. Measured, not assumed.
    assert.ok(html.includes(GROUND.dark) && html.includes(GROUND.light),
        `index.html must paint the ground inline (${GROUND.light} / ${GROUND.dark})`);

    // Pull the script out and run it against a fake document for every
    // combination, comparing to this module's answer.
    const m = html.match(/<script id="theme-boot">([\s\S]*?)<\/script>/);
    assert.ok(m, "index.html must carry a <script id=\"theme-boot\">");

    for (const pref of [...PREFERENCES, null, "nonsense"]) {
        for (const prefersDark of [true, false]) {
            for (const hour of [0, 5, 6, 11, 18, 19, 23]) {
                const root = { classList: { _s: new Set(),
                    add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
                    contains(c) { return this._s.has(c); } }, style: {} };
                const win = {
                    matchMedia: () => ({ matches: prefersDark }),
                    localStorage: { getItem: () => pref },
                };
                const doc = { documentElement: root, querySelector: () => null };
                // eslint-disable-next-line no-new-func
                new Function("document", "window", "localStorage", "Date", m[1])(
                    doc, win, win.localStorage,
                    class extends Date { getHours() { return hour; } },
                );
                const expected = resolveTheme(pref, { prefersDark, hour });
                assert.equal(root.classList.contains("dark"), expected === "dark",
                    `boot script disagrees for pref=${pref} prefersDark=${prefersDark} hour=${hour}: `
                    + `expected ${expected}`);
            }
        }
    }
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
