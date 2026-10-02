/**
 * rankedMove assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/rankedMove.test.mjs
 *
 * ═══ A BAR WITH NO DOOR IS A DIAGNOSIS ══════════════════════════════════════
 * Ranked drew the five ATAR components and left every one of them to the
 * student to work out which screen moves it. `COMPONENT_MOVE` is the door, and
 * each of the ways it can be wrong is invisible:
 *
 *   a component with no entry      — one bar silently has no action under it;
 *   a page that is not a route     — a 404 the student finds by tapping;
 *   a query nobody reads           — the link lands on the right page and the
 *                                    thing it promised to open does not, which
 *                                    is the half-wired shape this codebase has
 *                                    met over and over: the button is there,
 *                                    the far end is not.
 *
 * All three render perfectly and pass lint and the build.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { COMPONENT_MOVE, COMPONENT_ACTION, moveHref } from "@/lib/ranked";
import { COMPONENT_KEYS } from "@/lib/atarLift";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (f) => fs.readFileSync(path.resolve(f), "utf8");
const pageUrl = (name) => `/${name}`;

check("EVERY COMPONENT HAS A DOOR", () => {
    // The five are the ATAR's own, so this cannot drift from the score: a
    // component added to `ATAR_WEIGHTS` with no move is a bar the student can
    // see and cannot act on.
    for (const k of COMPONENT_KEYS) {
        assert.ok(COMPONENT_MOVE[k], `${k} has no move`);
        assert.ok(COMPONENT_MOVE[k].label?.trim(), `${k}'s move has no label`);
        assert.ok(COMPONENT_MOVE[k].page?.trim(), `${k}'s move has no page`);
    }
    // And the two maps agree about which components exist — `COMPONENT_ACTION`
    // writes the sentence, `COMPONENT_MOVE` the button under it, and one
    // carrying a key the other does not is a panel half-wired.
    assert.deepEqual(Object.keys(COMPONENT_MOVE).sort(), Object.keys(COMPONENT_ACTION).sort());
});

check("every page it points at is a real route", () => {
    const cfg = read("src/pages.config.js");
    for (const k of COMPONENT_KEYS) {
        const { page } = COMPONENT_MOVE[k];
        assert.ok(new RegExp(`\\b${page}\\b`).test(cfg),
            `${k} points at "${page}", which is not a page — that is a 404 found by tapping`);
    }
});

check("A QUERY NOBODY READS IS A BUTTON THAT LIES", () => {
    // `?plan=week` was added WITH its reader, and the reader is the half that
    // gets dropped: the link lands on the planner and the dialog it promised
    // to open never does. Every query this map emits is checked against the
    // page that has to honour it.
    const WHERE = { Study: "src/pages/Study.jsx", Goals: "src/pages/Goals.jsx" };
    for (const k of COMPONENT_KEYS) {
        const { page, query } = COMPONENT_MOVE[k];
        if (!query) continue;
        const [, pair] = /^\?(.+)$/.exec(query) || [];
        const [name, value] = pair.split("=");
        const file = WHERE[page];
        assert.ok(file, `${k} deep-links into ${page}, which this test cannot check — add it`);
        const src = read(file);
        assert.ok(src.includes(`get("${name}")`) || src.includes(`get('${name}')`),
            `${page} never reads ?${name} — ${k}'s link opens nothing`);
        assert.ok(src.includes(`"${value}"`) || src.includes(`'${value}'`),
            `${page} reads ?${name} but never matches "${value}"`);
    }
});

check("the href is built, not hand-assembled at each call site", () => {
    assert.equal(moveHref("effort", pageUrl), "/Study?tab=pomodoro");
    assert.equal(moveHref("mastery", pageUrl), "/MistakeBank");
    assert.equal(moveHref("nope", pageUrl), null, "an unknown key must refuse rather than build /undefined");
    assert.equal(moveHref("effort", null), null);
});

check("THE PAGE MAP IS NOT RESTATED ANYWHERE", () => {
    // It lived inside StandingRail as its own object, and Ranked needed the
    // same mapping — two copies that drift the first time one of them changes.
    // The mirror this codebase keeps deleting.
    const offenders = [];
    for (const f of ["src/components/ranked/StandingRail.jsx", "src/pages/Ranked.jsx"]) {
        const code = read(f)
            .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        if (/const COMPONENT_(PAGE|MOVE)\s*=/.test(code)) offenders.push(f);
    }
    assert.deepEqual(offenders, [], "a second copy of the component→page map is back");
});

console.log(`\nrankedMove: ${passed} checks passed`);
