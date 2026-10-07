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

/* COMMENTS ARE STRIPPED BEFORE EVERY SCAN. A file that EXPLAINS why it has
   no exit would otherwise be reported as having one, and the obvious way to
   make that green again is to delete the sentence saying why. */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

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

/* ─── HE TALKS AT A PACE, AND THE BUBBLE NEVER EMPTIES ──────────────────────
   Reported as "he talks way too quickly and the bubble disappears". Two
   separate faults with one visible symptom, and neither throws.

   The disappearance was `AnimatePresence mode="wait"`, which fades the OLD
   child fully out BEFORE the new one starts — so between two beats the bubble
   genuinely held nothing, on the screen that is asking somebody a question.
   `AceSay` replaces it and carries NO exit, so a beat change swaps the
   content in place.

   Both are invisible to a render test and to a screenshot, which catches one
   frame of an animation that is wrong in the gaps. */
check("AceSay carries NO exit — a bubble that empties between beats is the bug", () => {
    const src = strip(fs.readFileSync("src/components/ace/AceWalker.jsx", "utf8"));
    const i = src.indexOf("export function AceSay");
    assert.ok(i > -1, "AceSay is gone — the beats are back on whatever replaced it");
    // COUNT FROM AFTER THE SIGNATURE'S CLOSING PAREN. `AceSay` DESTRUCTURES
    // its argument, so a brace walk from the first `{` after the `function`
    // keyword opens and closes on the PARAMETER LIST and never reads the body
    // at all — the guard then passes with an exit sitting in it. That is the
    // trap xpRates.test.mjs records, met again; found by injection.
    const open = src.indexOf("{", src.indexOf(")", i));
    let d = 0, end = i;
    for (let j = open; j < src.length; j += 1) {
        if (src[j] === "{") d += 1;
        else if (src[j] === "}") { d -= 1; if (d === 0) { end = j; break; } }
    }
    const body = src.slice(i, end);
    assert.ok(!/\bexit\b/.test(body),
        "AceSay has an exit, so the bubble empties between beats again");
    assert.ok(/staggerChildren/.test(src),
        "the lines no longer stagger, so he says everything at once");
});

check("NOTHING AUTO-DISMISSES A BEAT", () => {
    // "The bubble disappears" also has a timer-shaped cause, and a timer added
    // later would look like a kindness. It is not: the student is being asked
    // a question and a question that times out has no answer.
    for (const f of ["src/components/ace/FirstWin.jsx", "src/components/ace/AceTour.jsx"]) {
        const src = strip(fs.readFileSync(f, "utf8"));
        assert.ok(!/set(Timeout|Interval)\s*\(/.test(src),
            `${f} runs a timer — a beat that advances on its own is the bubble vanishing`);
    }
});

check("EVERY BEAT THAT OFFERS A CHOICE SAYS WHAT CHOOSING DOES", () => {
    // The `problem` beat went from a heading straight to three buttons, so the
    // one beat whose options are deliberately the STUDENT's vague words was
    // also the only one with nothing saying how to pick between them. That is
    // the "no direction" half of the same report, and copy cannot be wrong at
    // runtime — a scan is the only thing that catches it.
    const src = strip(fs.readFileSync("src/components/ace/FirstWin.jsx", "utf8"));
    // ANCHOR ON THE BUTTONS, NOT ON THE BEAT NAME. `beat === "problem"` also
    // appears where the HEADING is chosen, several hundred characters above —
    // so the first draft of this check read the wrong span and failed against
    // the fixed file. The span that matters is the one between the lead and
    // the choices, which is the one `PROBLEMS.map` ends.
    const btn = src.indexOf("PROBLEMS.map");
    assert.ok(btn > -1, "the problem beat no longer renders its options");
    const open = src.lastIndexOf('beat === "problem"', btn);
    assert.ok(open > -1, "the options are no longer inside the problem beat");
    const lead = src.slice(open, btn);
    assert.ok(/<p className="text-sm text-foreground/.test(lead),
        "the problem beat offers buttons with no lead line telling anybody what to do");
});

console.log(`\n${passed} passed`);
