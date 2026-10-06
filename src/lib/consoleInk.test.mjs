/**
 * consoleInk assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/consoleInk.test.mjs
 *
 * ═══ /AITools IS A ROOM NOW, AND EVERY WAY TO BREAK ONE IS SILENT ═══════════
 * The AI Tools dashboard has its own palette — ~16 `--console-*` tokens scoped
 * to `.console` (index.css, Console.jsx) — for the same reason the Compete floor
 * has one: it is somewhere else, and nineteen identical warm rounded cards is
 * not what a machine room feels like.
 *
 * `floorInk.test.mjs` is the sibling of this file and it exists because every
 * mistake a scoped palette can make renders perfectly and reports nothing:
 *
 *   · A MISSPELLED TOKEN resolves to nothing. `color: var(--console-mutd)` is
 *     an invalid declaration, so the element inherits — usually to something
 *     plausible. No console warning, no build error, no failing test.
 *   · A TOKEN USED OUTSIDE `.console` does the same. The vars are deliberately
 *     scoped, so a console colour on a themed screen is simply blank.
 *   · THE `console` CLASS GOING MISSING blanks every one of them at once, and
 *     the page still renders — in the app's inherited cream, which is the
 *     exact thing the room was built to stop being. That edit silently no-opped
 *     during the floor's own refactor.
 *   · AN APP GROUND OR INK TOKEN SURVIVING INSIDE THE ROOM. This is the one
 *     that is specific here: `bg-surface`, `bg-background` and
 *     `text-muted-foreground` are the WARM CREAM tokens, so one left behind in
 *     a graphite room is a cream patch that only shows once somebody opens the
 *     page — and the rebuild had to repoint dozens of them.
 *
 * The HUE tokens are deliberately NOT refused: each tool's `accentText` /
 * `accentBg` comes off the catalogue in chatTools.js and is what tells twelve
 * items in a repeated set apart, which is the one case this app's icon rule
 * keeps glyphs for. Re-inking all twelve to one console accent would delete the
 * differentiation that justifies them existing.
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

/** Comments stripped, because a sentence NAMING a defect is not the defect.
 *  `floorInk` had to learn this the hard way: the moment a component explained
 *  why it does not write a literal, the scan reported the explanation — and the
 *  obvious way to go green again is to delete the sentence that says why. */
const code = (text) => text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const CSS = fs.readFileSync(path.join(SRC, "index.css"), "utf8");
const DEFINED = new Set([...CSS.matchAll(/(--console-[\w-]+)\s*:/g)].map((m) => m[1]));

/** The room: every file that renders inside `<Console>`. */
const ROOM = ["components/ai_tools/Console.jsx",
    "components/ai_tools/ToolsDashboard.jsx",
    "components/ai_tools/ToolBrief.jsx"];

check("the palette is actually declared, light and dark", () => {
    assert.ok(DEFINED.size >= 14, `only ${DEFINED.size} --console-* tokens found`);
    for (const t of ["--console-ground", "--console-panel", "--console-panel-2", "--console-line",
        "--console-line-soft", "--console-rail", "--console-ink", "--console-ink-dim",
        "--console-ink-faint", "--console-accent", "--console-accent-ink",
        "--console-accent-rgb", "--console-on-accent"]) {
        assert.ok(DEFINED.has(t), `${t} is never defined`);
    }
    // Both consoles, or one of them silently inherits the other's values.
    assert.ok(/\.console\s*\{/.test(CSS), "no `.console` block");
    assert.ok(/\.dark\s+\.console\s*\{/.test(CSS), "no `.dark .console` block");
});

check("THE ROOM CARRIES THE `console` CLASS", () => {
    // Without it every token below resolves to nothing, on the whole page at
    // once, and it still renders — in the app's cream.
    const room = read("components/ai_tools/Console.jsx");
    assert.match(code(room), /className=\{`console /,
        "Console.jsx must put `console` on its wrapper — the tokens are scoped to it");
    assert.match(code(room), /bg-\[var\(--console-ground\)\]/);
    assert.match(code(room), /console-lattice/, "the lattice layer is what makes it a console");
});

check("the lattice is declared and its gauge is fixed", () => {
    // A lattice drawn in percentages scales with the box, so the same room is
    // drawn at two different gauges depending on how much the student has —
    // the failure `CardBack` records about its own weave, which claimed in its
    // comment to be immune and was drawn inside a stretched viewBox.
    const block = CSS.match(/\.console-lattice\s*\{[\s\S]*?\}/);
    assert.ok(block, "no `.console-lattice` rule");
    assert.match(block[0], /repeating-linear-gradient/);
    assert.match(block[0], /var\(--console-grid\)/);
    assert.ok(/\d+px\s*\)/.test(block[0]) || /\d+px/.test(block[0]),
        "the gauge must be in px, not a percentage");
    assert.ok(!/%\s*\)/.test(block[0].replace(/to (right|bottom)/g, "")),
        "a percentage gauge scales with the page height");
});

check("every --console-* token a component uses is one that exists", () => {
    const bad = [];
    for (const f of walk(SRC)) {
        for (const m of fs.readFileSync(f, "utf8").matchAll(/var\((--console-[\w-]+)/g)) {
            if (!DEFINED.has(m[1])) bad.push(`${rel(f)}: ${m[1]}`);
        }
    }
    assert.deepEqual(bad, [], "a token that is not declared renders as nothing at all");
});

check("and nothing outside the room reaches for one", () => {
    // They are scoped to `.console` on purpose, so a console colour anywhere
    // else is blank.
    const bad = walk(SRC).filter((f) => {
        const r = rel(f);
        if (ROOM.includes(r) || r.endsWith(".test.mjs")) return false;
        return /var\(--console-/.test(fs.readFileSync(f, "utf8"));
    });
    assert.deepEqual(bad.map(rel), []);
});

check("NO APP GROUND OR INK TOKEN SURVIVES IN THE ROOM", () => {
    // These are the warm-cream tokens. One left behind is a cream patch in a
    // graphite room, and it renders perfectly until somebody opens the page.
    // `bg-background` is the worst of them, because it is what the page used to
    // be wrapped in and it shows wherever the console is shorter than the view.
    const BANNED = [
        "bg-surface", "bg-background", "bg-card", "bg-secondary", "bg-muted",
        "text-foreground", "text-muted-foreground", "text-card-foreground",
        "border-border", "divide-border",
    ];
    const bad = [];
    for (const r of ROOM) {
        const src = code(read(r));
        for (const token of BANNED) {
            if (new RegExp(`(^|[\\s"'\`:])${token}(?![\\w-])`).test(src)) bad.push(`${r}: ${token}`);
        }
    }
    assert.deepEqual(bad, [], "an app ground/ink token inside the console is a cream hole in it");
});

check("…and neither does the page that mounts it", () => {
    // AITools.jsx used to wrap the dashboard in `bg-background`, which paints
    // the app's cream BEHIND the room. The chat half of that page is a themed
    // app screen and legitimately keeps its own ground, so this checks the one
    // thing that matters: the dashboard is returned without a wrapper.
    const page = code(read("pages/AITools.jsx"));
    const m = page.match(/<ToolsDashboard[\s\S]*?\/>/);
    assert.ok(m, "AITools.jsx no longer renders ToolsDashboard");
    const before = page.slice(0, page.indexOf(m[0])).slice(-400);
    assert.ok(!/bg-background[\s\S]*$/.test(before.split("return")[1] || ""),
        "the dashboard is wrapped in an app ground again — Console owns its own");
});

check("no raw hex survives in the room", () => {
    // One literal is one colour that cannot follow the theme, and it is
    // invisible until somebody opens the console in the other one.
    const bad = [];
    for (const r of ROOM) {
        const hits = [...code(read(r)).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0]);
        if (hits.length) bad.push(`${r}: ${[...new Set(hits)].join(", ")}`);
    }
    assert.deepEqual(bad, []);
});

check("THE RAIL IS NOT THE BORDER TOKEN", () => {
    // A hairline between a white panel and the ground is read as an EDGE — the
    // fill either side does most of the work, so it can sit at almost no
    // contrast. The phase rail is a 1px line ALONE on the ground, so at the
    // same value it disappears and the four nodes read as bullet points rather
    // than as stops on a sequence. Only the screenshot said so, which is why it
    // is an assertion.
    const dash = code(read("components/ai_tools/ToolsDashboard.jsx"));
    assert.match(dash, /bottom-0 w-px bg-\[var\(--console-rail\)\]/,
        "the rail connector must use --console-rail, not --console-line");
    assert.notEqual(
        (CSS.match(/--console-rail:\s*(#[0-9A-Fa-f]{6})/) || [])[1],
        (CSS.match(/--console-line:\s*(#[0-9A-Fa-f]{6})/) || [])[1],
        "--console-rail and --console-line are the same value, so the rail is invisible again");
});

check("THE RAIL STOPS AT THE LAST NODE", () => {
    // A rail running past the final stop claims a step that is not there — the
    // league payline's rule about a rule drawn under the last row. The
    // connector belongs to the GAP between two nodes, so the last band has
    // none, and the flag has to reach the component rather than being computed
    // and thrown away.
    const dash = code(read("components/ai_tools/ToolsDashboard.jsx"));
    assert.match(dash, /\{!last && \(/, "every band draws a connector, including the last");
    assert.match(dash, /last=\{i === groups\.length - 1\}/, "nothing tells a band it is the last");
});

check("the four phases are numbered from the list, not written down", () => {
    // A second copy of "01 02 03 04" beside a four-item list is the mirror this
    // codebase keeps deleting: add a fifth phase to toolLabels.js and the rail
    // would print four numbers against five stops.
    const dash = code(read("components/ai_tools/ToolsDashboard.jsx"));
    assert.match(dash, /padStart\(2, "0"\)/);
    assert.ok(!/"01"|'01'/.test(dash), "a hand-written ordinal is a second copy of the phase list");
});

check("nothing on the console invents a number", () => {
    // A console is a tempting place to print a status readout, and a figure
    // with nothing behind it teaches a student that none of the numbers here
    // are real — the refusal `closingFacts` makes on the first-run screen. The
    // one figure printed is `cards.length`, which is the length of the list
    // directly beneath it.
    const brief = code(read("components/ai_tools/ToolBrief.jsx"));
    const dash = code(read("components/ai_tools/ToolsDashboard.jsx"));
    for (const [name, src] of [["ToolBrief", brief], ["ToolsDashboard", dash]]) {
        assert.ok(!/\b(\d{1,3})%/.test(src), `${name} prints a hard-coded percentage`);
        assert.ok(!/invokeLLM|streamAI|base44\.functions/.test(src),
            `${name} calls a model — the cards are arithmetic and must stay so`);
    }
    assert.match(brief, /\{cards\.length\}/, "the only count printed must be the list's own length");
});

check("the scanner recognises the shapes it is looking for", () => {
    assert.equal(DEFINED.has("--console-nope"), false);
    assert.ok(/#[0-9A-Fa-f]{6}\b/.test("bg-[#12161F]"));
    // A banned token is matched on a word boundary, so `bg-surface` bites and
    // `bg-surface-nope` does not — and `--console-ground` is not read as one.
    const hit = (tok, src) => new RegExp(`(^|[\\s"'\`:])${tok}(?![\\w-])`).test(src);
    assert.ok(hit("bg-surface", 'className="rounded bg-surface p-4"'));
    assert.ok(!hit("bg-surface", 'className="bg-surface-2"'));
    assert.ok(!hit("text-foreground", 'text-[var(--console-ink)]'));
    // …and a hex in a COMMENT is still not a hex after the strip.
    assert.ok(/#[0-9A-Fa-f]{6}\b/.test(code('// names #AABBCC\nconst x = "#121C2E";')));
    assert.ok(!/#[0-9A-Fa-f]{6}\b/.test(code('// names #AABBCC only\nconst x = 1;')));
});

console.log(`\n${passed} passed`);
