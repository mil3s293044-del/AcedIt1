/**
 * shouldPromptRebuild assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/mindmapRebuild.test.mjs
 *
 * The regression these pin down: the closed-book prompt was gated on
 * `nodes <= 1`, so it only ever showed when there was nothing to rebuild, and
 * disappeared the moment rebuilding became the next move. The featureReach
 * audit found the consequence — 60% of students build a mind map, 0% have
 * rebuilt one, and the rebuild is what makes mapping retrieval practice.
 */
import assert from "node:assert/strict";
import { shouldPromptRebuild, REBUILD_MIN_NODES } from "@/lib/mindmap";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const nodes = (n) => Array.from({ length: n }, (_, i) => ({ id: `n${i}` }));
const built = { id: "m1", nodes: nodes(REBUILD_MIN_NODES) };

check("a built map that has never been rebuilt gets the prompt", () => {
    assert.equal(shouldPromptRebuild({ map: built, allMaps: [{ id: "m1" }] }), true);
});

check("the case that was broken: a real map, not an empty one", () => {
    // The old condition was `nodes <= 1`. Every one of these would have been
    // silent, and these are the only maps where the advice can be acted on.
    for (const n of [3, 6, 20]) {
        assert.equal(shouldPromptRebuild({ map: { id: "m1", nodes: nodes(n) }, allMaps: [] }), true, `${n} nodes`);
    }
});

check("a map too thin to rebuild stays quiet", () => {
    // startRecall refuses under REBUILD_MIN_NODES; offering it would be a
    // button that answers with a toast saying no.
    for (const n of [0, 1, REBUILD_MIN_NODES - 1]) {
        assert.equal(shouldPromptRebuild({ map: { id: "m1", nodes: nodes(n) }, allMaps: [] }), false, `${n} nodes`);
    }
});

check("it retires itself once the student has rebuilt this map", () => {
    const allMaps = [{ id: "m1" }, { id: "m2", parent_map_id: "m1" }];
    assert.equal(shouldPromptRebuild({ map: built, allMaps }), false);
});

check("someone else's rebuild doesn't retire this map's prompt", () => {
    const allMaps = [{ id: "m9", parent_map_id: "m-other" }];
    assert.equal(shouldPromptRebuild({ map: built, allMaps }), true);
});

check("it stays quiet during a rebuild that's already running", () => {
    assert.equal(shouldPromptRebuild({ map: built, allMaps: [], recallOf: { id: "m1" } }), false);
});

check("'Not now' is honoured, and only for the map it was pressed on", () => {
    assert.equal(shouldPromptRebuild({ map: built, allMaps: [], dismissed: { m1: 1 } }), false);
    assert.equal(shouldPromptRebuild({ map: built, allMaps: [], dismissed: { m2: 1 } }), true);
});

check("an unsaved map has nothing to rebuild against", () => {
    assert.equal(shouldPromptRebuild({ map: { nodes: nodes(9) }, allMaps: [] }), false);
});

check("missing or junk input never throws", () => {
    for (const args of [undefined, {}, { map: null }, { map: built, allMaps: [null, undefined] }]) {
        assert.doesNotThrow(() => shouldPromptRebuild(args));
    }
});

console.log(`\n${passed} passed`);
