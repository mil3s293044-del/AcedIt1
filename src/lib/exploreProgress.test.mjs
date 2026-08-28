/**
 * exploreProgress assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/exploreProgress.test.mjs
 *
 * The rule under test is the one that matters: positive evidence only. A tick
 * has to mean "there is a row proving this", because telling a student they
 * have never done something they did last night is how a guide loses them.
 */
import assert from "node:assert/strict";
import { featureUsage, suggestNext, MEASURABLE } from "@/lib/exploreProgress";
import { BY_ID, blockedBy, readiness } from "@/lib/aceKnowledge";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

check("nothing loaded proves nothing", () => {
    assert.equal(featureUsage(null).size, 0);
    assert.equal(featureUsage({}).size, 0);
});

check("a technique row ticks its technique and nothing else", () => {
    const used = featureUsage({ techniques: [{ technique_name: "blurting" }] });
    assert.ok(used.has("blurting"));
    assert.ok(!used.has("active_recall"));
    assert.ok(!used.has("pomodoro"));
});

check("reviewed cards count as spaced repetition; unreviewed ones don't", () => {
    assert.ok(featureUsage({ flashcards: [{ total_reviews: 2 }] }).has("spaced_repetition"));
    assert.ok(!featureUsage({ flashcards: [{ total_reviews: 0 }] }).has("spaced_repetition"));
});

check("a rebuilt map is a child carrying parent_map_id", () => {
    const maps = [{ id: "m1" }, { id: "m2", parent_map_id: "m1" }];
    const used = featureUsage({ maps });
    assert.ok(used.has("mind_map"));
    assert.ok(used.has("mindmap_recall"));
    // Building maps without ever rebuilding is the audit's finding — it must
    // read as "did the first, not the second", not as both.
    const only = featureUsage({ maps: [{ id: "m1" }] });
    assert.ok(only.has("mind_map"));
    assert.ok(!only.has("mindmap_recall"));
});

check("an AI tool matches despite the -ise/-ize spelling in the wild", () => {
    for (const spelling of ["note_summariser", "note_summarizer", "NOTE_SUMMARIZER"]) {
        assert.ok(featureUsage({ aiResults: [{ tool_type: spelling }] }).has("note_summariser"), spelling);
    }
});

check("features that leave no client-readable trace are never claimed", () => {
    // Reading Analytics or opening a Guide writes nothing we can see. They must
    // stay out of the denominator rather than sit at a permanent zero.
    for (const id of ["analytics", "guides", "atar", "strategise", "exam"]) {
        assert.ok(!MEASURABLE.includes(id), id);
    }
});

check("every measurable id is a real feature", () => {
    for (const id of MEASURABLE) assert.ok(BY_ID[id], id);
});

check("suggestions skip what's done and lead with retrieval practice", () => {
    const data = { subjects: [{ id: 1 }], assessments: [{ id: 1, due_date: "2030-01-01" }],
                   techniques: [{ technique_name: "pomodoro" }] };
    const next = suggestNext(data, { limit: 3 }).map((f) => f.id);
    assert.ok(!next.includes("pomodoro"), "already done");
    assert.ok(!next.includes("subjects"), "already done");
    assert.equal(next[0], "active_recall");
});

check("a blocked feature is never suggested", () => {
    const data = {};   // no subjects, so anything needing them is blocked
    const ready = readiness({});
    const next = suggestNext(data, { limit: 5, ready, isBlocked: blockedBy });
    for (const f of next) assert.equal(blockedBy(f, ready), null, f.id);
});

check("junk input never throws", () => {
    for (const d of [{ maps: null }, { techniques: "no" }, { aiResults: [null] }, { flashcards: [undefined] }]) {
        assert.doesNotThrow(() => featureUsage(d));
    }
});

console.log(`\n${passed} passed`);
