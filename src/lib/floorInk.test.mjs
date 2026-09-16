/**
 * floorInk assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/floorInk.test.mjs
 *
 * ═══ THE FLOOR HAS A PALETTE NOW, AND EVERY WAY TO BREAK IT IS SILENT ═══════
 * Compete used to render in literal ink in both themes. It follows the app
 * theme now (see Room.jsx), which means 334 hard-coded hexes became ~30
 * `--floor-*` tokens scoped to `.floor`. Every mistake that refactor can make
 * renders perfectly and reports nothing:
 *
 *   · A MISSPELLED TOKEN resolves to nothing. `color: var(--floor-mutd)` is an
 *     invalid declaration, so the element inherits — usually to something
 *     plausible. No console warning, no build error, no failing test.
 *   · A TOKEN USED OUTSIDE `.floor` does the same. The vars are deliberately
 *     scoped, so a floor colour on a themed screen is simply blank.
 *   · THE `floor` CLASS GOING MISSING blanks every one of them at once. That
 *     happened during the refactor: an earlier pass had already rewritten the
 *     string the edit was looking for, so the replace matched nothing and the
 *     class was never added. The page still rendered — in inherited ink.
 *   · A FILL AND ITS INK DISAGREEING. `--floor-solid` is the one pair that
 *     swaps outright between the floors (light ink on dark, dark ink on
 *     light), so sharing `--floor-on-bright` with the brand fills made the
 *     primary button dark-on-dark the moment the floor went light.
 *
 * All four are assertions rather than comments, because all four shipped
 * inside one session and only a screenshot caught any of them.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (e) { console.log(`FAIL  ${name}\n      ${e.message}\n`); process.exitCode = 1; }
};

const SRC = path.resolve("src");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.jsx?$/.test(e.name) ? [full] : [];
});
const rel = (f) => path.relative(SRC, f);
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

const CSS = fs.readFileSync(path.join(SRC, "index.css"), "utf8");
const DEFINED = new Set([...CSS.matchAll(/(--floor-[\w-]+)\s*:/g)].map((m) => m[1]));

/** The room: every file that renders inside `<Room>`. */
const FLOOR = walk(SRC).filter((f) => {
    const r = rel(f);
    return r.startsWith("components/market/")
        || r === "pages/Competitions.jsx" || r === "pages/Market.jsx";
});

check("the palette is actually declared, light and dark", () => {
    assert.ok(DEFINED.size >= 25, `only ${DEFINED.size} --floor-* tokens found`);
    for (const t of ["--floor-ground", "--floor-card", "--floor-ink", "--floor-solid",
        "--floor-on-solid", "--floor-yes-ink", "--floor-no-ink", "--floor-scrim"]) {
        assert.ok(DEFINED.has(t), `${t} is never defined`);
    }
    // Both floors, or one of them silently inherits the other's values.
    assert.ok(/\.floor\s*\{/.test(CSS), "no `.floor` block");
    assert.ok(/\.dark\s+\.floor\s*\{/.test(CSS), "no `.dark .floor` block");
});

check("THE ROOM CARRIES THE `floor` CLASS", () => {
    // Without it every token above resolves to nothing, on every floor screen
    // at once, and the page still renders. This exact edit silently no-opped.
    const room = read("components/market/Room.jsx");
    assert.match(room, /className="floor /,
        "Room.jsx must put `floor` on its wrapper — the tokens are scoped to it");
    assert.match(room, /bg-\[var\(--floor-ground\)\]/);
});

check("every --floor-* token a component uses is one that exists", () => {
    const bad = [];
    for (const f of walk(SRC)) {
        for (const m of fs.readFileSync(f, "utf8").matchAll(/var\((--floor-[\w-]+)/g)) {
            if (!DEFINED.has(m[1])) bad.push(`${rel(f)}: ${m[1]}`);
        }
    }
    assert.deepEqual(bad, [], "a token that is not declared renders as nothing at all");
});

check("and nothing outside the room reaches for one", () => {
    // They are scoped to `.floor` on purpose, so a floor colour anywhere else
    // is blank. AceShuffle is the one exception and is deliberate: its `floor`
    // ink preset is only ever rendered inside the room.
    const ALLOWED = new Set(["components/ace/AceShuffle.jsx"]);
    const bad = walk(SRC).filter((f) => {
        const r = rel(f);
        if (FLOOR.includes(f) || ALLOWED.has(r) || r.endsWith(".test.mjs")) return false;
        return /var\(--floor-/.test(fs.readFileSync(f, "utf8"));
    });
    assert.deepEqual(bad.map(rel), []);
});

check("THE SOLID FILL AND ITS INK CANNOT DISAGREE", () => {
    // `--floor-on-bright` is ink on a BRAND fill — near-black on both floors,
    // because green/amber/blue are bright on both. `--floor-solid` is the one
    // fill that swaps, so it takes `--floor-on-solid` and nothing else.
    const bad = [];
    for (const f of FLOOR) {
        const src = fs.readFileSync(f, "utf8");
        for (const m of src.matchAll(/bg-\[var\(--floor-solid\)\][^"'`]*?text-\[var\(--floor-(on-bright|ink)\)\]/gs)) {
            bad.push(`${rel(f)}: solid fill with --floor-${m[1]}`);
        }
    }
    assert.deepEqual(bad, [], "a solid fill takes --floor-on-solid, or it is dark on dark in light mode");
});

check("no raw hex survives in the room", () => {
    // One literal is one colour that cannot follow the theme, and it is
    // invisible until somebody opens the floor in the other one.
    const bad = [];
    for (const f of FLOOR) {
        const hits = [...fs.readFileSync(f, "utf8").matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0]);
        if (hits.length) bad.push(`${rel(f)}: ${[...new Set(hits)].join(", ")}`);
    }
    assert.deepEqual(bad, []);
});

check("the scanner recognises the shapes it is looking for", () => {
    assert.equal(DEFINED.has("--floor-nope"), false);
    assert.ok(/bg-\[var\(--floor-solid\)\][^"'`]*?text-\[var\(--floor-on-bright\)\]/s.test(
        'className="bg-[var(--floor-solid)] py-2 text-[var(--floor-on-bright)]"'));
    assert.ok(/#[0-9A-Fa-f]{6}\b/.test('bg-[#121C2E]'));
});

console.log(`\n${passed} passed`);
