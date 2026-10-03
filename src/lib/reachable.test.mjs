/**
 * reachable assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/reachable.test.mjs
 *
 * ═══ A PAGE WITH NO ENTRANCE IS A PAGE NOBODY HAS ═══════════════════════════
 * This codebase has shipped that failure three times and written it down twice.
 * `League`'s own header: "the league endpoint existed, worked, and nothing ever
 * called it, so it may as well not have been written." `WeekStrip`'s: "A page
 * with no entrance is the shape this whole feature already had." And
 * `fnResult.js` records the strip then reading the wrong field, so the one
 * entrance rendered nothing and the feature shipped completely invisible.
 *
 * Two surfaces were still hidden, and neither throws, renders wrong, or fails
 * any other check:
 *
 *   /Review   — in NEITHER nav. Its main entrance was an 11px muted link in
 *               the corner of one dashboard panel, labelled "Check the pile",
 *               which is a phrase nobody uses about a page whose own h1 says
 *               "Your review queue". Two names for one screen is how a student
 *               stops believing either.
 *   /League   — one entrance, in Ranked's sticky rail. That rail is the second
 *               column of an `xl:` grid, so below xl it stacks UNDER the whole
 *               thirty-row board: on a phone the way into a weekly competition
 *               sat below everything on the page.
 *
 * Both are invisible to every other guard here, because a route that exists and
 * renders perfectly is indistinguishable from one anybody can find.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
/** A comment explaining an old label is not the old label. */
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const RAIL = read("src/components/layout/SideRail.jsx");
const BOTTOM = read("src/components/layout/BottomNav.jsx");
const RANKED = read("src/pages/Ranked.jsx");
const CONFIG = read("src/pages.config.js");

/** Every `path: "X"` a nav lists. */
const navPaths = (src) =>
    [...strip(src).matchAll(/path:\s*["']([A-Za-z]+)["']/g)].map((m) => m[1]);

// ─── The two that were hidden ──────────────────────────────────────────────

check("THE REVIEW QUEUE IS IN THE NAV, on both of them", () => {
    // It was in neither, so the page existed and the only way to it was an
    // 11px link on one panel of one page — which does not render at all when
    // that panel has nothing to plot.
    for (const [name, src] of [["SideRail", RAIL], ["BottomNav", BOTTOM]]) {
        assert.ok(navPaths(src).includes("Review"),
            `${name} has no Review entry — the queue is reachable only from links ` +
            `inside other features again`);
    }
});

check("THE LEAGUE IS A TAB ON RANKED, not only a strip in the rail", () => {
    const r = strip(RANKED);
    assert.match(r, /value="league"/,
        "Ranked has no League tab — the only way in is the strip, which below xl " +
        "stacks under the whole board");
    assert.match(r, /<League\s+embedded/,
        "the League tab does not render the League page");
});

check("the tab renders the REAL page rather than a second copy of the board", () => {
    assert.match(RANKED, /import League from "@\/pages\/League"/,
        "Ranked builds its own league view — two renderings of one board is the " +
        "mirror this codebase keeps deleting");
    const league = read("src/pages/League.jsx");
    assert.match(league, /function League\(\{\s*embedded/,
        "League takes no embedded prop, so the tab cannot be the page");
    // And the route survives: /League is still real, and WeekStrip still links
    // there when no parent hands it a tab to open.
    assert.match(CONFIG, /\bLeague\b/, "League is no longer a route");
});

check("the tab bar grew a column to fit it", () => {
    // Three triggers in a two-column grid overlap. It renders, and it renders
    // wrong, which no other check here would see.
    //
    // Counted off the `TABS` declaration rather than off the markup near
    // `<TabsList>`: the triggers are a `.map` over a module constant now, so a
    // window around the list matches nothing and this passed for the wrong
    // reason — "0 tabs in a grid that is not grid-cols-0". `rankedBoards`
    // owns which ids they are and what order they go in.
    const decl = RANKED.slice(RANKED.indexOf("const TABS = ["));
    const triggers = (decl.slice(0, decl.indexOf("];")).match(/\["[a-z]+",/g) || []).length;
    assert.ok(triggers >= 3, `only ${triggers} tabs found — the TABS list has moved`);
    const bar = RANKED.slice(RANKED.indexOf("<TabsList"), RANKED.indexOf("<TabsList") + 400);
    assert.match(bar, new RegExp(`grid-cols-${triggers}\\b`),
        `${triggers} tabs in a grid that is not grid-cols-${triggers}`);
});

check("THE WEEK LEADS THE BOARD rather than sitting below thirty rows", () => {
    const r = strip(RANKED);
    const strip_ = r.indexOf("<WeekStrip");
    const grid = r.indexOf("xl:grid-cols-[minmax(0,1fr)_320px]");
    assert.ok(strip_ > -1, "WeekStrip is gone from Ranked");
    assert.ok(grid > -1, "the board grid has moved — check this still means what it says");
    assert.ok(strip_ < grid,
        "WeekStrip is inside the rail column again, which below xl stacks under the " +
        "entire board — the exact way this was hidden");
});

// ─── One name per screen ───────────────────────────────────────────────────

check("NOBODY SAYS \"check the pile\" ANY MORE", () => {
    // The page's own h1 is "Your review queue". A nav item, a shelf button and
    // a dashboard link calling it something else means four names for one
    // screen, and "the pile" is the one a student has never heard.
    const files = ["src/components/dashboard/DueRadar.jsx",
        "src/components/study/SpacedRepetition.jsx",
        "src/components/layout/SideRail.jsx",
        "src/components/layout/BottomNav.jsx"];
    for (const f of files) {
        assert.ok(!/check the pile/i.test(strip(read(f))),
            `${f} still calls it "the pile" — the page calls itself "Your review queue"`);
    }
});

check("and every entrance uses the page's OWN name", () => {
    const review = read("src/pages/Review.jsx");
    assert.match(review, /Your review queue/,
        "the page's h1 has changed — the entrances below are now named after nothing");
    for (const f of ["src/components/dashboard/DueRadar.jsx",
        "src/components/study/SpacedRepetition.jsx",
        "src/components/layout/SideRail.jsx",
        "src/components/layout/BottomNav.jsx"]) {
        assert.match(strip(read(f)), /Review queue/,
            `${f} does not name the queue, so its entrance says nothing about where it goes`);
    }
});

// ─── The entrance states the stake ─────────────────────────────────────────

check("THE QUEUE'S ENTRANCES CARRY A NUMBER, not just a word", () => {
    // "Review queue" alone is a label. A shelf with four cards ready and one
    // with two hundred read identically, so there is nothing to weigh and no
    // reason to tap.
    const shelf = read("src/components/study/SpacedRepetition.jsx");
    assert.match(shelf, /queueReady/,
        "the shelf button names the queue without saying how much is in it");
    assert.match(shelf, /\bdecks\.reduce\(/,
        "the count is no longer taken off the UNFILTERED decks — counted off the " +
        "search results, a button reporting 3 because somebody typed \"chem\" would " +
        "be lying about the queue it opens");
    const radar = read("src/components/dashboard/DueRadar.jsx");
    assert.match(strip(radar), /overdue/,
        "the dashboard entrance says nothing about what is being asked");
});

check("THE LEAGUE'S ENTRANCE SAYS WHAT A FINISH PAYS", () => {
    const w = read("src/components/ranked/WeekStrip.jsx");
    assert.match(w, /grantForLeague\(/,
        "the strip prints a position and a clock and nothing about whether the week " +
        "is worth anything — so there is no reason to open it");
    assert.ok(!/\b1[0-9]{3}\s*credits/i.test(strip(w)),
        "a payout figure is written out here rather than taken from grantForLeague, " +
        "which is the function the server actually grants with");
});

check("it refuses to print a podium on a board too small to have one", () => {
    const w = read("src/components/ranked/WeekStrip.jsx");
    assert.match(w, /total\s*>\s*PODIUM/,
        "\"top 3 take\" on a board of two is everybody — the refusal podiumGap " +
        "already makes, and the one leagueLead makes about \"1st of 1\"");
});

// ─── Nothing points at a page that is not there ────────────────────────────

check("every nav entry is a real route", () => {
    for (const [name, src] of [["SideRail", RAIL], ["BottomNav", BOTTOM]]) {
        for (const p of navPaths(src)) {
            assert.ok(new RegExp(`\\b${p}\\b`).test(CONFIG),
                `${name} lists "${p}", which is not a page — a 404 found by tapping`);
        }
    }
});

console.log(`\nreachable: ${passed} checks passed`);
