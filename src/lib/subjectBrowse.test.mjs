/**
 * subject browse assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/subjectBrowse.test.mjs
 *
 * The one that matters most is that every subject in the real catalogue lands
 * in a named area: the map is hand-written, so a subject added later would
 * silently fall into "Your own" and sit under a heading meant for the
 * student's own custom subjects.
 */
import assert from "node:assert/strict";
import {
    LEARNING_AREAS, areaOf, areaLabel, ENGLISH_SUBJECTS, scalingOf,
    sortSubjects, groupByArea, loadSummary, MIN_ATAR_STUDIES, prerequisiteOf,
} from "@/lib/subjectBrowse";
import { VCE_SUBJECTS } from "@/data/vceSubjects";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── the map against the real catalogue ─────────────────────────────────────

check("EVERY subject in the catalogue has a named learning area", () => {
    const stray = VCE_SUBJECTS.filter((s) => areaOf(s.name) === "other").map((s) => s.name);
    assert.deepEqual(stray, [],
        "a subject added to the catalogue without a map entry lands under the heading "
        + "meant for the student's own custom subjects");
});

check("a subject the student invented is theirs, not miscategorised", () => {
    assert.equal(areaOf("Underwater Basket Weaving"), "other");
    assert.equal(areaLabel("other"), "Your own");
    assert.equal(areaOf(null), "other");
});

check("the areas a student expects are the areas they get", () => {
    assert.equal(areaOf("Specialist Mathematics"), "maths");
    assert.equal(areaOf("Literature"), "english");
    assert.equal(areaOf("Psychology"), "science");
    assert.equal(areaOf("Data Analytics"), "tech",
        "a name-contains-'Mathematics' heuristic would have got this one wrong");
    assert.equal(areaOf("Economics"), "business", "VCAA groups it with business");
});

check("the English group is the four that satisfy the requirement", () => {
    assert.equal(ENGLISH_SUBJECTS.size, 4);
    ["English", "English Language", "Literature", "English (EAL)"]
        .forEach((n) => assert.ok(ENGLISH_SUBJECTS.has(n), n));
    assert.ok(!ENGLISH_SUBJECTS.has("History: Revolutions"));
});

// ─── scaling ────────────────────────────────────────────────────────────────

check("scaling is read as a signed number, and the placeholder is not one", () => {
    assert.equal(scalingOf({ scaling_info: { scaling_factor: "+13" } }), 13);
    assert.equal(scalingOf({ scaling_info: { scaling_factor: "-4" } }), -4);
    assert.equal(scalingOf({ scaling_info: { scaling_factor: "+N" } }), null);
    assert.equal(scalingOf({}), null);
});

// ─── sorting ────────────────────────────────────────────────────────────────

const S = (name, factor, difficulty) => ({
    name, difficulty_level: difficulty,
    scaling_info: factor == null ? undefined : { scaling_factor: factor },
});

check("scaling sorts high to low, and UNKNOWN sorts last", () => {
    const out = sortSubjects([
        S("Bravo", "-4"), S("Alpha", "+N"), S("Charlie", "+13"), S("Delta", "+2"),
    ], "scaling").map((s) => s.name);
    assert.deepEqual(out, ["Charlie", "Delta", "Bravo", "Alpha"]);
    // "+N" means the catalogue does not know. Sorted as a zero it would sit
    // among the neutral scalers and state something nobody measured.
});

check("name always breaks the tie, so blocks do not shuffle", () => {
    const out = sortSubjects([
        S("Zulu", "+2"), S("Alpha", "+2"), S("Mike", "+2"),
    ], "scaling").map((s) => s.name);
    assert.deepEqual(out, ["Alpha", "Mike", "Zulu"]);

    const byDiff = sortSubjects([
        S("Zulu", "+1", "advanced"), S("Alpha", "+1", "advanced"),
        S("Yankee", "+1", "intermediate"),
    ], "difficulty").map((s) => s.name);
    assert.deepEqual(byDiff, ["Yankee", "Alpha", "Zulu"]);
});

check("sorting does not mutate what it was given", () => {
    const input = [S("Zulu", "+1"), S("Alpha", "+9")];
    const before = input.map((s) => s.name);
    sortSubjects(input, "scaling");
    assert.deepEqual(input.map((s) => s.name), before);
});

check("area order follows the catalogue, not the alphabet", () => {
    const out = sortSubjects([
        S("French"), S("Chemistry"), S("English"), S("Specialist Mathematics"),
    ], "area").map((s) => s.name);
    assert.deepEqual(out, ["Specialist Mathematics", "English", "Chemistry", "French"]);
});

// ─── grouping ───────────────────────────────────────────────────────────────

check("an empty area is DROPPED, not printed as a bare heading", () => {
    const groups = groupByArea([S("Chemistry"), S("Physics")]);
    assert.deepEqual(groups.map((g) => g.key), ["science"]);
    assert.equal(groups[0].subjects.length, 2);
});

check("the whole catalogue groups into areas in catalogue order", () => {
    const groups = groupByArea(VCE_SUBJECTS);
    assert.deepEqual(groups.map((g) => g.key),
        LEARNING_AREAS.map((a) => a.key).filter((k) => k !== "other"));
    assert.equal(groups.reduce((n, g) => n + g.subjects.length, 0), VCE_SUBJECTS.length,
        "every subject appears exactly once");
});

// ─── the load ───────────────────────────────────────────────────────────────

const CAT = [
    S("Mathematical Methods", "+5"), S("Chemistry", "+4"), S("English", "-2"),
    S("Legal Studies", "-1"), S("Music Repertoire Performance", "+N"),
];
const mine = (...names) => names.map((n) => ({ subject_name: n }));

check("the English requirement is checked against the whole English group", () => {
    assert.equal(loadSummary(mine("Literature", "Chemistry"), CAT).hasEnglish, true);
    assert.equal(loadSummary(mine("English (EAL)"), CAT).hasEnglish, true);
    assert.equal(loadSummary(mine("Chemistry", "Legal Studies"), CAT).hasEnglish, false);
});

check("four studies is the ATAR floor", () => {
    assert.equal(loadSummary(mine("A", "B", "C"), CAT).enough, false);
    const four = loadSummary(mine("A", "B", "C", "D"), CAT);
    assert.equal(four.enough, true);
    assert.equal(four.count, MIN_ATAR_STUDIES);
});

check("an unknown scaling is EXCLUDED from the average, never counted as zero", () => {
    const s = loadSummary(mine("Mathematical Methods", "Music Repertoire Performance"), CAT);
    assert.equal(s.count, 2);
    assert.equal(s.scaledCount, 1, "only one of the two has a scaling in the catalogue");
    assert.equal(s.avgScaling, 5, "a zero would have halved it to 2.5 and claimed a measurement");
});

check("the average is over the picks the catalogue knows", () => {
    const s = loadSummary(mine("Mathematical Methods", "English"), CAT);   // +5, -2
    assert.equal(s.avgScaling, 1.5);
    assert.equal(s.scalesUp, 1);
});

check("an empty load claims nothing", () => {
    const s = loadSummary([], CAT);
    assert.equal(s.count, 0);
    assert.equal(s.hasEnglish, false);
    assert.equal(s.avgScaling, null, "not zero — there is nothing to average");
    assert.equal(s.scaledCount, 0);
});

// ─── prerequisites ──────────────────────────────────────────────────────────

check("no prerequisite prints NOTHING, never \"Needs None\"", () => {
    assert.equal(prerequisiteOf("None"), null);
    assert.equal(prerequisiteOf("none"), null);
    assert.equal(prerequisiteOf(""), null);
    assert.equal(prerequisiteOf(null), null);
});

check("a recommendation is never dressed up as a requirement", () => {
    // The worst of the three: raw, this read "Needs Yr 10 maths recommended",
    // which presents a subject the student CAN take as one they cannot.
    assert.deepEqual(prerequisiteOf("Year 10 maths recommended"),
        { kind: "recommended", text: "Yr 10 maths" });
    assert.deepEqual(prerequisiteOf("Recommended: Year 10 Drama"),
        { kind: "recommended", text: "Yr 10 Drama" });
    assert.deepEqual(prerequisiteOf("Year 10 Physics; concurrent Methods strongly recommended"),
        { kind: "required", text: "Yr 10 Physics" },
        "a requirement WITH advice attached is still a requirement");
});

check("advice after the requirement is cut, and the requirement is kept whole", () => {
    assert.deepEqual(prerequisiteOf("Year 10 Chemistry; concurrent Methods recommended"),
        { kind: "required", text: "Yr 10 Chemistry" });
    assert.deepEqual(prerequisiteOf("Year 10 English (recommended over standard English if linguistics interests you)"),
        { kind: "required", text: "Yr 10 English" });
    assert.deepEqual(prerequisiteOf("Mathematical Methods (concurrent or completed)"),
        { kind: "required", text: "Mathematical Methods" });
});

check("a plain requirement survives intact", () => {
    assert.deepEqual(prerequisiteOf("EAL eligibility from VCAA"),
        { kind: "required", text: "EAL eligibility from VCAA" });
    assert.deepEqual(prerequisiteOf("Year 10 advanced maths or equivalent"),
        { kind: "required", text: "Yr 10 advanced maths or equivalent" });
});

check("EVERY prerequisite in the real catalogue parses to something printable", () => {
    // The guard that matters: a new catalogue entry phrased a fourth way would
    // otherwise reach a student as a sentence starting "Needs Recommended".
    const bad = [];
    VCE_SUBJECTS.forEach((s) => {
        (s.prerequisites || []).forEach((raw) => {
            const p = prerequisiteOf(raw);
            if (p === null) return;                       // "None" is fine
            if (!p.text || /recommended/i.test(p.text)) bad.push(`${s.name}: ${raw}`);
        });
    });
    assert.deepEqual(bad, [], "these still carry advice into the requirement line");
});

console.log(`\n${passed} passed`);
