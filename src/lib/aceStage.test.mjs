/**
 * one Ace on screen —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/aceStage.test.mjs
 *
 * ─── The bug this exists to catch ───────────────────────────────────────────
 * Six surfaces draw him and the registry only governed the ones that opted in.
 * `FirstWin` and `AceTour` walk a full body onto the page and never claimed,
 * so the AceCompanion launcher stood underneath them the whole time — the
 * first quiz of somebody's first session had one Ace talking and a second
 * standing under him. Nothing threw; there were simply two of him.
 *
 * And the registry was UNORDERED ("is anyone other than me holding him"), so
 * two surfaces that both claim both stand down, or neither does, depending on
 * which effect ran first. A coin toss deciding which Ace a student sees.
 *
 * Both halves are checked here: the ordering is arithmetic over a list, and
 * the claims are a scan, because a surface that forgets to claim renders
 * perfectly and is simply a second Ace.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const yieldSrc = fs.readFileSync("src/components/ace/useAceYield.js", "utf8");
const ORDER = JSON.parse(
    (yieldSrc.match(/export const ACE_ORDER = (\[[^\]]*\])/) || [])[1].replace(/'/g, '"'));

/** The ranking the registry actually applies, re-derived from the source. */
const rank = (id) => (ORDER.indexOf(id) === -1 ? ORDER.length : ORDER.indexOf(id));
const holder = (ids) => ids.slice().sort((a, b) => rank(a) - rank(b))[0] ?? null;

check("the order parsed, and every surface that draws him is in it", () => {
    assert.ok(ORDER.length >= 6, `only found ${ORDER.length} entries`);
    for (const id of ["reacts", "first-win", "tour", "buddy", "launcher"]) {
        assert.ok(ORDER.includes(id), `"${id}" draws an Ace and is not ranked`);
    }
});

check("EXACTLY ONE holds the stage, whoever asks and in whatever order", () => {
    // The unordered version's failure: the answer changed with the order the
    // effects happened to run in.
    const every = ["launcher", "buddy", "tour", "first-win", "reacts", "intro"];
    const forwards = holder(every);
    const backwards = holder([...every].reverse());
    assert.equal(forwards, backwards, "the winner depends on registration order");
    assert.equal(forwards, "reacts", "something outranks a celebration");
});

check("a celebration is never talked over", () => {
    for (const other of ORDER.filter((o) => o !== "reacts")) {
        assert.equal(holder(["reacts", other]), "reacts",
            `${other} draws over the moment the student just earned`);
    }
});

check("THE LAUNCHER ALWAYS LOSES — it is what is there when nothing is happening", () => {
    for (const other of ORDER.filter((o) => o !== "launcher")) {
        assert.equal(holder(["launcher", other]), other, `the launcher beat ${other}`);
    }
    assert.equal(holder(["launcher"]), "launcher", "it should show when alone");
});

check("the run leads the tour, and both lead the buddy", () => {
    assert.equal(holder(["tour", "first-win"]), "first-win");
    assert.equal(holder(["buddy", "tour"]), "tour");
    assert.equal(holder(["buddy", "first-win"]), "first-win");
});

check("an unranked id loses rather than winning by accident", () => {
    assert.equal(holder(["launcher", "something-new"]), "launcher");
});

check("EVERY SURFACE THAT DRAWS A BODY CLAIMS ONE", () => {
    // The scan, because this is the half that cannot be derived: a component
    // that renders an Ace and never calls `claimAce` is a second Ace, and it
    // renders perfectly.
    const drawers = {
        "src/components/ace/FirstWin.jsx": "first-win",
        "src/components/ace/AceTour.jsx": "tour",
        "src/components/ace/AceBuddy.jsx": "buddy",
        "src/components/ace/AceReacts.jsx": "reacts",
        "src/components/ace/AceRoam.jsx": "roam",
    };
    for (const [file, id] of Object.entries(drawers)) {
        const src = fs.readFileSync(file, "utf8");
        assert.ok(/AceBody|AceWalker/.test(src), `${file} no longer draws him — drop it from this list`);
        assert.ok(new RegExp(`claimAce\\(\\s*["']${id}["']`).test(src),
            `${file} draws an Ace and never claims the stage — that is a second one on screen`);
        assert.ok(ORDER.includes(id), `${file} claims "${id}", which ACE_ORDER does not rank`);
    }
});

check("the launcher asks by NAME, or it is ranked by falling off the end", () => {
    const src = fs.readFileSync("src/components/ace/AceCompanion.jsx", "utf8");
    assert.ok(/useAceClaimed\(\s*["']launcher["']\s*\)/.test(src),
        "AceCompanion asks anonymously, so ACE_ORDER cannot place it");
});

console.log(`\n${passed} passed`);
