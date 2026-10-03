/**
 * appVersion assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/appVersion.test.mjs
 *
 * ═══ A PROMPT THAT RELOADS THE PAGE HAS TWO WAYS TO BE WRONG ════════════════
 * It can fail to appear, which puts a student back on the stale bundle and the
 * white screen `lazyPage.js` exists to retry. And it can appear OVER REAL WORK,
 * which destroys typed answers in a quiz — a much worse outcome than the thing
 * it was preventing, and the reason the blocking version is only safe at all.
 *
 * Both are asserted here rather than described, because neither shows up in a
 * render: a prompt that never fires looks like a feature nobody enabled, and
 * one that fires mid-quiz only ever happens to a student, on their machine,
 * once, at the moment it costs the most.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stale, mayPrompt, VERSION_URL, VERSION_POLL_MS } from "@/lib/appVersion";
import { BUSY, holdReasons, TYPING_QUIET_MS } from "@/lib/liveRefresh";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── stale: no opinion is never a change ───────────────────────────────────

check("A MISSING VERSION IS NOT A NEW VERSION", () => {
    // `null !== "abc"` is true, and a bare !== would announce an update on the
    // first successful poll of every dev session — which is both wrong and the
    // kind of wrong that gets the whole feature switched off.
    assert.equal(stale(null, "abc"), false, "no baseline yet read as an update");
    assert.equal(stale("abc", null), false, "a failed check read as an update");
    assert.equal(stale(null, null), false);
    assert.equal(stale("", "abc"), false);
});

check("the same build is not an update, and a different one is", () => {
    assert.equal(stale("abc123", "abc123"), false,
        "a server restart with no deploy would nag every poll");
    assert.equal(stale("abc123", "def456"), true);
});

// ─── mayPrompt: never over real work ───────────────────────────────────────

check("EVERY SURFACE THAT HOLDS A REFRESH HOLDS THE RELOAD", () => {
    // A reload is strictly larger than the refetch liveRefresh schedules, so
    // anything that defers one must defer the other. Asserted over the whole
    // vocabulary rather than a sample: a BUSY reason added later is covered
    // the moment it exists, which is the point of sharing the list.
    for (const reason of Object.values(BUSY)) {
        const gate = mayPrompt({ busy: [reason] });
        assert.equal(gate.ok, false, `a prompt may appear during ${reason}`);
        assert.equal(gate.reason, reason, `the hold does not name ${reason}`);
    }
});

check("typing holds it, and keeps holding until they stop", () => {
    const now = 1_000_000;
    assert.equal(mayPrompt({ now, lastInputAt: now - 100 }).ok, false,
        "a keystroke a tenth of a second ago did not hold the reload");
    assert.equal(mayPrompt({ now, lastInputAt: now - (TYPING_QUIET_MS - 1) }).ok, false);
    assert.equal(mayPrompt({ now, lastInputAt: now - (TYPING_QUIET_MS + 1) }).ok, true,
        "it never stops holding — the prompt would never arrive");
});

check("text sitting in a focused field holds it after the typing has stopped", () => {
    const now = 1_000_000;
    // Someone who typed an answer and paused to think is not finished with it.
    assert.equal(
        mayPrompt({ now, lastInputAt: now - 60000, focusedHasContent: true }).ok, false,
        "a half-written answer is reloaded away once they stop typing for four seconds",
    );
});

check("a hidden tab is never prompted", () => {
    const gate = mayPrompt({ hidden: true });
    assert.equal(gate.ok, false);
    assert.equal(gate.reason, "hidden",
        "a prompt nobody can see is a page that changed under them while they were away");
});

check("an idle student IS prompted — the hold cannot be unconditional", () => {
    const now = 1_000_000;
    assert.equal(mayPrompt({ now, lastInputAt: 0, busy: [], hidden: false }).ok, true,
        "nothing can ever get through, so the update never ships to anybody");
});

// ─── One definition of busy ────────────────────────────────────────────────

check("THE HOLD LIST IS IMPORTED, NEVER RESTATED", () => {
    const src = fs.readFileSync(
        path.join(process.cwd(), "src/lib/appVersion.js"), "utf8");
    assert.match(src, /import\s*\{[^}]*holdReasons[^}]*\}\s*from\s*["']@\/lib\/liveRefresh["']/,
        "appVersion computes its own busy list — written twice, the two drift within a " +
        "release, and the half that drifted is the one that reloads a quiz away");
    // And the shared function is really what decides, rather than being
    // imported and then second-guessed.
    assert.deepEqual(
        holdReasons({ busy: [BUSY.QUIZ] }),
        mayPrompt({ busy: [BUSY.QUIZ] }).reasons,
        "mayPrompt reports holds that holdReasons does not",
    );
});

// ─── The endpoint, and the two sides agreeing on it ────────────────────────

check("the version path the client asks for is the one the server answers", () => {
    const server = fs.readFileSync(path.join(process.cwd(), "server.mjs"), "utf8");
    assert.ok(
        server.includes(`app.get("${VERSION_URL}"`),
        `server.mjs serves no ${VERSION_URL} — the client polls a 404 forever and ` +
        `nobody is ever told about an update`,
    );
});

check("THE VERSION REPLY IS NEVER CACHED", () => {
    const server = fs.readFileSync(path.join(process.cwd(), "server.mjs"), "utf8");
    const i = server.indexOf(`app.get("${VERSION_URL}"`);
    const body = server.slice(i, i + 700);
    assert.match(body, /no-store/,
        "the one request whose job is to notice a change would be answered from a " +
        "cache written before it");
    const client = fs.readFileSync(path.join(process.cwd(), "src/lib/appVersion.js"), "utf8");
    assert.match(client, /cache:\s*["']no-store["']/,
        "a service worker or the back/forward cache answers it without a request");
});

check("it is registered BEFORE the SPA fallback that swallows everything", () => {
    const server = fs.readFileSync(path.join(process.cwd(), "server.mjs"), "utf8");
    const version = server.indexOf(`app.get("${VERSION_URL}"`);
    const fallback = server.indexOf("app.get(/.*/");
    assert.ok(version > -1 && fallback > -1);
    assert.ok(version < fallback,
        "the catch-all route is registered first, so /local-ai/version returns index.html");
});

check("the poll is slow enough not to be a request every few seconds", () => {
    // Being late costs a few minutes on an old bundle, which lazyPage covers.
    // Being fast costs a request from every open tab, forever, to answer a
    // question whose answer changes a handful of times a week.
    assert.ok(VERSION_POLL_MS >= 60000,
        `polling every ${VERSION_POLL_MS}ms is a request per tab per minute or worse`);
});

// ─── The component's own two rules ─────────────────────────────────────────

check("DEFER, NEVER DROP — an update seen mid-quiz is still waiting after", () => {
    const src = fs.readFileSync(
        path.join(process.cwd(), "src/components/shared/UpdatePrompt.jsx"), "utf8");
    assert.match(src, /pending\s*=\s*useRef\(false\)/,
        "a new version noticed while the student was busy is dropped, and the next " +
        "poll is minutes away at best");
    assert.match(src, /registry\?\.onChange\?\.\(/,
        "nothing re-checks when the student stops being busy — finishing a quiz leaves " +
        "the waiting prompt sitting there until the next poll");
});

check("it clears lazyPage's one-reload guard on the way out", () => {
    const src = fs.readFileSync(
        path.join(process.cwd(), "src/components/shared/UpdatePrompt.jsx"), "utf8");
    const lazy = fs.readFileSync(path.join(process.cwd(), "src/lib/lazyPage.js"), "utf8");
    const key = lazy.match(/RELOAD_KEY\s*=\s*["']([^"']+)["']/)?.[1];
    assert.ok(key, "lazyPage's reload key has moved — this check now guards nothing");
    assert.ok(src.includes(key),
        `UpdatePrompt does not clear ${key}, so a tab that already spent its one ` +
        `chunk-reload carries that mark into the new build where the chunk exists`);
});

console.log(`\nappVersion: ${passed} checks passed`);
