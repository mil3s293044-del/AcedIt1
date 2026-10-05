/**
 * mindmapXp assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/mindmapXp.test.mjs
 *
 * ═══ A TAB LEFT OPEN IS NOT STUDY, AND IT USED TO PAY LIKE IT WAS ═══════════
 * Mind maps began paying XP timed from when the map OPENED, so four idle hours
 * read as 240 minutes and the only thing bounding it was a `DAILY_CAPS` entry
 * that did not exist. Nothing here throws; the old version simply paid a
 * number nobody had earned, which is the class this file exists for.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    minuteBucket, contentWeight, sessionPayout, newSession, noteEdit, closeSession,
    MIN_NODES, MIN_GROWTH,
} from "@/lib/mindmapXp";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
/* Comments stripped before every scan — a comment naming the thing it refuses
   is not the thing, the false positive three other test files had to learn. */
const stripped = (rel) => read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const mapOf = (nodes, extra = {}) => ({
    id: "m1", subject: "Chemistry", title: "Bonding",
    nodes: Array.from({ length: nodes }, (_, i) => ({ id: `n${i}` })),
    ...extra,
});

/* ── A minute is a minute, however many edits land in it ─────────────────── */

ok("a burst of edits inside one minute is ONE minute", () => {
    const s = newSession(mapOf(5));
    const t = 1_700_000_000_000;
    for (let i = 0; i < 50; i++) noteEdit(s, t + i * 100);
    assert.equal(s.minutes.size, 1, "fifty keystrokes paid fifty minutes");
    noteEdit(s, t + 60_001);
    assert.equal(s.minutes.size, 2);
    // The bucket is the minute, so two edits either side of a boundary are two.
    assert.equal(minuteBucket(0), 0);
    assert.equal(minuteBucket(59_999), 0);
    assert.equal(minuteBucket(60_000), 1);
});

ok("A TAB LEFT OPEN EARNS NOTHING", () => {
    // The whole point. Four hours pass, no edit lands, the sitting closes.
    const map = mapOf(12);
    const s = newSession(map);
    const got = closeSession(s, map);
    assert.equal(got.minutes, 0);
    assert.equal(got.ok, false);
    assert.equal(got.reason, "idle");
});

/* ── The growth floor ────────────────────────────────────────────────────── */

ok("a sitting that added NOTHING pays nothing, however long it was active", () => {
    const map = mapOf(12);
    const s = newSession(map);
    for (let i = 0; i < 40; i++) noteEdit(s, 1_700_000_000_000 + i * 60_001);
    assert.equal(s.minutes.size, 40);
    // Same map, same weight — forty minutes of nudging a node about.
    const got = closeSession(s, map);
    assert.equal(got.ok, false);
    assert.equal(got.reason, "no_growth");
    assert.equal(got.minutes, 0);
});

ok("REFINING COUNTS AS GROWING, which is why weight is not the node count", () => {
    // A sitting spent adding notes and labelling connections is real mapping
    // work and would score a flat zero on nodes alone.
    const before = mapOf(8);
    const s = newSession(before);
    noteEdit(s, 1_700_000_000_000);
    const after = {
        ...before,
        nodes: before.nodes.map((x, i) => (i < 3 ? { ...x, note: "why it matters" } : x)),
    };
    const got = closeSession(s, after);
    assert.ok(got.ok, "a session of pure note-writing was refused");
    assert.equal(got.growth, 3);

    // A labelled connection and a cross-link count too.
    assert.equal(contentWeight(mapOf(2)), 2);
    assert.equal(contentWeight(mapOf(2, { crossLinks: [{ a: 1 }, { b: 2 }] })), 4);
    assert.equal(contentWeight({ nodes: [{ id: "a", link: "causes" }] }), 2);
    assert.equal(contentWeight(null), 0);
    // Whitespace is not a note.
    assert.equal(contentWeight({ nodes: [{ id: "a", note: "   " }] }), 1);
});

ok("a map that is not yet a MAP does not pay", () => {
    const small = mapOf(MIN_NODES - 1);
    const s = newSession({ ...small, nodes: [] });
    noteEdit(s, 1_700_000_000_000);
    const got = closeSession(s, small);
    assert.equal(got.ok, false);
    assert.equal(got.reason, "too_small");
});

/* ── The refusals are ordered, and none of them is a truthiness test ─────── */

ok("`Number(null) === 0` cannot pay a sitting that had nothing in it", () => {
    // Ninth module. Every floor here is written as a comparison rather than a
    // truthiness test, because a missing figure coerces to 0 and 0 is exactly
    // the value that must refuse.
    assert.equal(sessionPayout({}).ok, false);
    assert.equal(sessionPayout({ activeMinutes: null, growth: null, nodes: null }).ok, false);
    assert.equal(sessionPayout({ activeMinutes: undefined }).reason, "idle");
    assert.equal(sessionPayout({ activeMinutes: 5, growth: 5, nodes: null }).reason, "too_small");
    assert.equal(sessionPayout({ activeMinutes: 5, growth: null, nodes: 9 }).reason, "no_growth");
    const src = stripped("src/lib/mindmapXp.js");
    assert.ok(!/if \(!activeMinutes\)|if \(!growth\)|if \(!nodes\)/.test(src),
        "a floor was written as a truthiness test");
});

ok("the minutes are CLAMPED, because the week panel reads the raw figure", () => {
    const got = sessionPayout({ activeMinutes: 9999, growth: 5, nodes: 20, maxMinutes: 240 });
    assert.equal(got.minutes, 240);
    assert.ok(sessionPayout({ activeMinutes: 7, growth: 1, nodes: 20 }).minutes === 7);
});

/* ── Two boundaries cannot pay one sitting twice ─────────────────────────── */

ok("CLOSING RESETS, so the check and leaving cannot both bank the same minutes", () => {
    // The old code restarted a wall clock for this and still paid a minute for
    // a second check in the same breath, because its floor was Math.max(1, …).
    const start = mapOf(6);
    const s = newSession(start);
    noteEdit(s, 1_700_000_000_000);
    noteEdit(s, 1_700_000_060_001);
    const grown = mapOf(9);
    const first = closeSession(s, grown);
    assert.equal(first.minutes, 2);
    assert.equal(first.growth, 3);

    // Immediately again, nothing having happened in between.
    const second = closeSession(s, grown);
    assert.equal(second.minutes, 0, "the same sitting was banked twice");
    assert.equal(second.ok, false);

    // And the NEXT stretch of work starts from the new weight, so growth is not
    // re-counted either.
    noteEdit(s, 1_700_000_120_001);
    const third = closeSession(s, mapOf(10));
    assert.equal(third.growth, 1, "growth was counted from the original weight again");
    assert.equal(third.minutes, 1);
});

ok("closing a sitting that never began is not a crash and not a payout", () => {
    const got = closeSession(null, mapOf(9));
    assert.equal(got.ok, false);
    assert.equal(got.minutes, 0);
});

/* ── Wired, or none of it runs ───────────────────────────────────────────── */

const MAPS = stripped("src/components/study/MindMaps.jsx");

ok("THE MINUTE IS STAMPED ON THE ONE MUTATION PATH", () => {
    // `edit()` is the single call every node, rename, link and note goes
    // through — which is the whole reason this is cheap and cannot be routed
    // around. Stamped anywhere else and some edits would not count.
    assert.match(MAPS, /const edit = useCallback\([\s\S]{0,400}?noteEdit\(session\.current\)/,
        "the minute is no longer stamped inside edit(), so edits do not mark a minute worked");
});

ok("THE WALL CLOCK IS GONE", () => {
    assert.ok(!/Date\.now\(\) - started/.test(MAPS),
        "the sitting is timed from when the map opened again — four idle hours read as 240 minutes");
    assert.ok(!/Math\.max\(1, Math\.floor\(\(Date\.now\(\)/.test(MAPS),
        "the one-minute floor is back, so a second check in the same breath pays again");
});

ok("BOTH BOUNDARIES GO THROUGH ONE BANKER", () => {
    // Two closers would come to disagree about what a sitting was worth.
    assert.equal((MAPS.match(/technique_name: "mind_map"/g) || []).length, 1,
        "a second place writes the session row");
    assert.match(MAPS, /const bank = useCallback/);
    // The check banks...
    assert.match(MAPS, /bank\(mapRef\.current \|\| map/, "the gap check no longer banks");
    // ...and so does leaving, which is what makes the XP independent of chips.
    assert.match(MAPS, /bankRef\.current\?\.\(leaving\)/,
        "leaving a map banks nothing, so a student out of chips earns nothing for building one");
    assert.match(MAPS, /const bankRef = useRef\(bank\)/,
        "the leave handler depends on `bank` directly, so a changed identity resets the sitting");
});

ok("A REFUSED SITTING WRITES NO ROW", () => {
    assert.match(MAPS, /if \(!got\.ok\) return;/,
        "a refused sitting writes a zero row, which teaches a student the numbers here are decoration");
});

ok("THE DAILY CAP IS ITS PEERS', not the 500 default it inherited", () => {
    const server = read("server.mjs");
    const caps = server.slice(server.indexOf("const DAILY_CAPS"), server.indexOf("};", server.indexOf("const DAILY_CAPS")));
    const get = (k) => Number((caps.match(new RegExp(`${k}:\\s*(\\d+)`)) || [])[1]);
    assert.equal(get("mind_map"), 120,
        "mind_map has no cap entry again, so it silently inherits the 500 default");
    assert.equal(get("mind_map"), get("active_recall"), "it should sit with its peers");
    assert.ok(get("mind_map") < get("study_session"),
        "mapping pays more per day than a full day of pomodoro");
});

console.log(`\nmindmapXp: ${n} checks passed`);
