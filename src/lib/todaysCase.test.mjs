/**
 * dashboard hero assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/todaysCase.test.mjs
 *
 * The failure this exists to catch is a case made of ZEROES. The hero is the
 * first thing a student sees, and printing "+0.00 ATAR" or "0 regions quiet"
 * at a first-week account teaches them that the numbers on this page are
 * decoration — after which the real ones do not land either.
 */
import assert from "node:assert/strict";
import { buildCase, caseRegions, quietGaps, payoffFor } from "@/lib/todaysCase";
import { TECHNIQUE_NEURO } from "@/lib/neuro";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// A student who has only ever run Pomodoro: the front of the brain is lit and
// the memory systems are dark. This is the case the whole panel is built for.
const POMODORO_ONLY = {
    hasData: true,
    regions: TECHNIQUE_NEURO.pomodoro.regions.map((r) => ({ id: r.id, tone: r.tone, activation: 0.8 })),
    quiet: ["hippocampus", "mtl", "temporal", "parietal", "occipital", "motor", "cerebellum"]
        .map((id) => ({ id })),
};
const NO_HISTORY = { hasData: false, regions: [], quiet: [] };
const COMPONENTS = { mastery: 40, consistency: 55, effort: 60, breadth: 30, planning: 20 };

const MOVE = {
    technique: "spaced_repetition",
    component: "mastery",
    why: { value: 11, label: "cards at or past their review date" },
};

// ─── the picture ────────────────────────────────────────────────────────────

check("the move's regions are full, and the student's own history keeps its level", () => {
    const regions = caseRegions("spaced_repetition", POMODORO_ONLY);
    const byId = Object.fromEntries(regions.map((r) => [r.id, r]));
    // Lit by the move.
    assert.equal(byId.hippocampus.activation, 1);
    // Lit by their real work, at their real level — not flattened to full.
    assert.equal(byId.dlpfc.activation, 0.8);
});

check("a region the move works AND they already do stays full, not double-counted", () => {
    const regions = caseRegions("spaced_repetition", {
        hasData: true, quiet: [],
        regions: [{ id: "hippocampus", tone: "primary", activation: 0.3 }],
    });
    assert.equal(regions.filter((r) => r.id === "hippocampus").length, 1);
    assert.equal(regions[0].activation, 1);
});

check("an unknown region id never reaches the canvas", () => {
    // BrainModel looks up REGIONS[id] and would silently draw at the origin.
    const regions = caseRegions("spaced_repetition", {
        hasData: true, quiet: [], regions: [{ id: "not_a_region", activation: 1 }],
    });
    assert.ok(!regions.some((r) => r.id === "not_a_region"));
});

check("a move with no technique still draws their own history", () => {
    const regions = caseRegions(undefined, POMODORO_ONLY);
    assert.equal(regions.length, POMODORO_ONLY.regions.length);
});

// ─── the gap ────────────────────────────────────────────────────────────────

check("only gaps THIS move closes are named", () => {
    const gaps = quietGaps("spaced_repetition", POMODORO_ONLY).map((g) => g.id);
    assert.ok(gaps.includes("hippocampus"), "spaced repetition works it, and they have not");
    // Quiet, but this move does nothing about it — naming it would be a
    // complaint rather than an argument.
    assert.ok(!gaps.includes("motor"));
    // Already lit by their Pomodoro work, so not a gap.
    assert.ok(!gaps.includes("dlpfc"));
});

check("no history means no gap claim", () => {
    // "Your hippocampus has been quiet" is only true if we watched. A student
    // with nothing logged has not been observed, and saying it anyway is a
    // guess dressed as a measurement.
    assert.deepEqual(quietGaps("spaced_repetition", NO_HISTORY), []);
    assert.deepEqual(quietGaps("spaced_repetition", null), []);
});

// ─── the payoff ─────────────────────────────────────────────────────────────

check("the payoff is a real ATAR difference", () => {
    const p = payoffFor(COMPONENTS, "mastery");
    assert.ok(p.gain > 0, "mastery at 40 has room");
    assert.equal(p.label, "mastery");
    assert.ok(p.headroom > 0);
});

check("no components, no payoff — never +0.00", () => {
    assert.equal(payoffFor(null, "mastery"), null);
    assert.equal(payoffFor({}, "mastery"), null);
    assert.equal(payoffFor(COMPONENTS, undefined), null);
    assert.equal(payoffFor(COMPONENTS, "not_a_component"), null);
});

check("a component with no headroom claims nothing", () => {
    assert.equal(payoffFor({ ...COMPONENTS, mastery: 100 }, "mastery"), null);
});

// ─── the assembled case ─────────────────────────────────────────────────────

check("a full case is trigger, gap, payoff — in that order", () => {
    const c = buildCase({ move: MOVE, activity: POMODORO_ONLY, components: COMPONENTS });
    assert.deepEqual(c.rows.map((r) => r.kind), ["trigger", "brain", "payoff"]);
    assert.equal(c.rows[0].value, "11");
    assert.ok(c.rows[2].value.startsWith("+"));
    assert.ok(c.hasBrain);
});

check("a first-week account gets NO rail rather than a rail of zeroes", () => {
    const c = buildCase({
        move: { technique: "pomodoro", component: "consistency" },
        activity: NO_HISTORY,
        components: null,
    });
    assert.deepEqual(c.rows, [], "nothing here is real yet, so nothing is claimed");
});

check("each row survives on its own", () => {
    // Trigger but no components and no history.
    const onlyWhy = buildCase({ move: { why: { value: 3, label: "days left" } }, activity: NO_HISTORY, components: null });
    assert.deepEqual(onlyWhy.rows.map((r) => r.kind), ["trigger"]);
    // Components but no trigger and no technique.
    const onlyPayoff = buildCase({ move: { component: "breadth" }, activity: NO_HISTORY, components: COMPONENTS });
    assert.deepEqual(onlyPayoff.rows.map((r) => r.kind), ["payoff"]);
});

check("a why row with no number is dropped rather than printed empty", () => {
    const c = buildCase({ move: { why: { label: "cards waiting" } }, activity: NO_HISTORY, components: null });
    assert.deepEqual(c.rows, []);
});

check("several gaps read as a count, one reads by name", () => {
    const one = buildCase({
        move: { technique: "spaced_repetition" },
        activity: { hasData: true, regions: [], quiet: [{ id: "hippocampus" }] },
        components: null,
    });
    assert.equal(one.rows[0].value, "Hippocampus");
    const many = buildCase({ move: { technique: "spaced_repetition" }, activity: POMODORO_ONLY, components: null });
    assert.match(many.rows[0].value, /^\d+ regions$/);
});

check("nothing at all does not throw", () => {
    const c = buildCase({});
    assert.deepEqual(c.rows, []);
    assert.deepEqual(c.regions, []);
    assert.equal(c.hasBrain, false);
});

console.log(`\n${passed} passed`);
