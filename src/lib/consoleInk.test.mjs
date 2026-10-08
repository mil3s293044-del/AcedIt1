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

/**
 * The room: every file that renders inside `<Console>`.
 *
 * THE CHAT IS IN HERE NOW. The lobby that used to hold the room (a dashboard
 * and its brief) is deleted — the chat is the page — so `UnifiedChat` and its
 * empty state draw in `--console-*` and are subject to every rule below. That
 * conversion was sixty tokens in one file and the ones that matter most are
 * silently survivable: an app ink left behind is legible, just cream.
 */
const ROOM = ["components/ai_tools/Console.jsx",
    "components/ai_tools/UnifiedChat.jsx",
    "components/ai_tools/ChatWelcome.jsx"];

check("the palette is actually declared, light and dark", () => {
    // A FLOOR, not a census. It was 14 and went red when `--console-rail`
    // retired with the rail — a count that has to be edited every time the
    // palette changes is a second copy of the palette. The named list below is
    // what actually guards it; this only catches the block vanishing.
    assert.ok(DEFINED.size >= 12, `only ${DEFINED.size} --console-* tokens found`);
    for (const t of ["--console-ground", "--console-panel", "--console-panel-2", "--console-line",
        "--console-line-soft", "--console-ink", "--console-ink-dim",
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
    // the app's cream BEHIND the room and shows wherever the console is shorter
    // than the viewport. `Console` owns its own ground; the page adds none.
    //
    // THE CHAT IS NOW INSIDE THE ROOM rather than beside it. The page used to
    // be two screens — a graphite dashboard and a cream chat — so a themed app
    // ground here was legitimate for half of it. It is one screen now, and an
    // app ground anywhere on it is a cream hole.
    const page = code(read("pages/AITools.jsx"));
    assert.match(page, /<Console>/, "the page no longer mounts the room");
    assert.match(page, /<UnifiedChat/, "the page no longer renders the chat");
    assert.ok(!/<ToolsDashboard|ToolBrief/.test(page),
        "the lobby is back in front of the chat");
    for (const token of ["bg-background", "bg-surface", "text-foreground", "text-muted-foreground"]) {
        assert.ok(!new RegExp(`(^|[\\s"'\`:])${token}(?![\\w-])`).test(page),
            `the page paints an app ${token} around the room`);
    }
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

/* ══ THE RAIL IS GONE, AND SO ARE THE THREE GUARDS THAT PINNED IT ═══════════
   They asserted that the connector used `--console-rail`, that the last band
   drew none, and that the ordinals were `padStart`ed off the list. Every one
   was true and every one described a MECHANISM — a 1px rail with 01–04 at its
   nodes — which turned out to be the most generated-looking thing on the page.
   A guard that pins a mechanism goes red the day the mechanism improves, which
   is the lesson `xpRates.test.mjs` learned about the mind-map wall clock and
   `toolBrief.test.mjs` learned one release ago about a component's name.

   What replaces them are the PROPERTIES the rail was in the way of. */

check("ONE LEFT EDGE, which is what the rail cost", () => {
    // The bands carried `pl-7 sm:pl-9` to clear the rail, and nothing else on
    // the page moved with them: measured at 1280, the headline, the direction
    // rows and the section headings began at x=208 and the twelve tool cards
    // began at 244. Thirty-six pixels, on the screen whose whole argument is
    // that it was laid out on a grid.
    // `pr-` CANNOT MOVE A LEFT EDGE, so it is not read as an indent — the
    // first version of this matched `p[lxr]` and reported a row's own right
    // padding as the fault, which is a false positive whose obvious fix is
    // deleting the padding.
    const src = code(read("components/ai_tools/ChatWelcome.jsx"));
    const bad = [...src.matchAll(/className=(?:"|{`)[^"`]*?\b((?:sm:|md:|lg:)?p[lx]-\d[^\s"`]*)/g)]
        .map((m) => m[1])
        // The row's own inner padding is not an indent: it is inside the box,
        // which still starts at the container's edge.
        .filter((c) => !/^p[lx]-3\.5$|^p[lx]-3$|^p[lx]-4$/.test(c));
    assert.deepEqual(bad, [],
        "something in the welcome is indented from the container again");
});

check("THE LATTICE LANDS ON THE CONTENT COLUMN, and the arithmetic says so", () => {
    // Originating it is half the job; the GAUGE has to divide the column or the
    // line sits on the left edge and misses the right one. Both numbers live in
    // two different files, so this does the division rather than trusting a
    // comment — change the container, the padding or the gauge and it fails.
    const TW = { "max-w-4xl": 896, "max-w-3xl": 768, "max-w-5xl": 1024,
        "max-w-6xl": 1152, "max-w-7xl": 1280, "px-4": 16, "px-6": 24 };
    // THE COLUMN IS THE ONE THE CONTENT IS SET IN. It was the dashboard's
    // `max-w-4xl`; it is the welcome's `max-w-3xl` now, and for one commit it
    // was pointed at the chat's outer `max-w-7xl` shell — which is a box
    // nothing on the page is aligned to. Only this division said so.
    const dash = code(read("components/ai_tools/ChatWelcome.jsx"));
    const row = dash.split("\n").find((l) => l.includes("mx-auto") && l.includes("max-w-"));
    assert.ok(row, "the content container is gone");
    const maxW = TW[(row.match(/\bmax-w-[\w]+/) || [])[0]];
    const pad = TW[(row.match(/\bpx-\d+/) || [])[0]];
    assert.ok(maxW && pad, `unrecognised container classes in: ${row.trim()}`);

    const block = (CSS.match(/\.console-lattice\s*\{[\s\S]*?\}/) || [])[0] || "";
    const gauge = Number((block.match(/--lattice-gauge:\s*(\d+)px/) || [])[1]);
    const off = Number((block.match(/calc\(50% - (\d+)px\)/) || [])[1]);
    const floor = Number((block.match(/max\((\d+)px/) || [])[1]);
    assert.ok(gauge && off && floor, "the lattice no longer declares a gauge and an origin");

    assert.equal(off, maxW / 2 - pad,
        `the origin is ${off}px back from centre; the content edge is ${maxW / 2 - pad}px`);
    assert.equal(floor, pad,
        "the clamp floor is not the container's padding, so a narrow viewport misses");
    assert.equal((maxW - 2 * pad) % gauge, 0,
        `the column is ${maxW - 2 * pad}px and the gauge ${gauge}px — a line cannot land on both edges`);
    assert.match(block, /background-position:\s*var\(--lattice-x\)/,
        "the origin is declared and never applied");
});

check("COLOUR MEANS PHASE, and only phase", () => {
    // The direction rows took the TOOL's own accent as a spine while the
    // toolkit grouped the same tools by four phases, so one tool was two
    // colours on one screen and neither said which mattered. `toneForTool` is
    // the one lookup; `accentSolid`/`accentBg` belong to the chat.
    // SCOPED TO THE WELCOME. The chat THREAD still uses the tool's own accent
    // and should: there it says who is speaking, which is one meaning and not
    // two. The rule is about the screen that lists all twelve at once.
    const welcome = code(read("components/ai_tools/ChatWelcome.jsx"));
    assert.ok(!/accentSolid|accentBg|accentText/.test(welcome),
        "the welcome inks something with the tool's own accent rather than its phase");
    assert.match(welcome, /toneForTool\(/);
    assert.match(welcome, /band\.ink|tone\.spine/,
        "the phase's own colour is no longer drawn");
    // And the phases carry their own colour, so a fifth added later gets one.
    const labels = read("lib/toolLabels.js");
    const phases = (labels.match(/export const PHASES = \[[\s\S]*?\n\];/) || [""])[0];
    const ids = (phases.match(/id: "/g) || []).length;
    assert.ok(ids >= 4, "the phase list is gone");
    assert.equal((phases.match(/spine: "/g) || []).length, ids, "a phase has no spine colour");
    assert.equal((phases.match(/ink: "/g) || []).length, ids, "a phase has no ink colour");
});

check("A TOOL NEVER OPENED PRINTS NOTHING, never zero", () => {
    // `studyQueue`'s rule: a list that reaches a respectable length by printing
    // "0 chats" teaches a student the numbers here are decoration.
    const welcome = code(read("components/ai_tools/ChatWelcome.jsx"));
    assert.match(welcome, /if \(!stat \|\| !stat\.count\) return "";/,
        "the usage cell prints something for a tool with no conversations");
    assert.ok(!/0 chat/.test(welcome), "a literal zero is printed somewhere");
});

check("nothing on the console invents a number", () => {
    // A console is a tempting place to print a status readout, and a figure
    // with nothing behind it teaches a student that none of the numbers here
    // are real — the refusal `closingFacts` makes on the first-run screen. The
    // one figure printed is `cards.length`, which is the length of the list
    // directly beneath it.
    const welcome = code(read("components/ai_tools/ChatWelcome.jsx"));
    assert.ok(!/\b(\d{1,3})%/.test(welcome), "the welcome prints a hard-coded percentage");
    // IT READS WHAT IT IS GIVEN. The suggestions are counted by the page, so a
    // model call HERE would be a second answer to a question already answered
    // with arithmetic — the generated advice deleted from Insights, returning
    // one screen along.
    assert.ok(!/invokeLLM|streamAI|base44\./.test(welcome),
        "the welcome reaches for data of its own — the cards are arithmetic and must stay so");
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
