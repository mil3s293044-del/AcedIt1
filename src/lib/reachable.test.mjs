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
 *               which is a phrase nobody uses about a page whose own heading
 *               said something else. Two names for one screen is how a student
 *               stops believing either. The page is PROGRESS now — the
 *               flashcard audit and the old /Analytics merged into one queue
 *               and one set of insights — so the name is checked against what
 *               the page calls ITSELF rather than against a string written
 *               down here, which is the thing that would quietly rot.
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

check("THE LEAGUE IS ITS OWN TAB, and nothing else has to carry it", () => {
    // `WeekStrip` is DELETED. It existed because the league had one entrance
    // and that entrance was in a sticky rail which, below xl, stacked under
    // thirty rows. A tab cannot stack under anything, so the strip became a
    // second entrance to a screen one tap away — and it sat at the top of a
    // tab about the ATAR, saying nothing about the ATAR.
    assert.ok(!/WeekStrip/.test(strip(RANKED)),
        "WeekStrip is back on Ranked. The tab beside it is the entrance; a strip above " +
        "the score repeating it is the same screen advertised twice");
    assert.ok(!fs.existsSync(path.join(root, "src/components/ranked/WeekStrip.jsx")),
        "the component is back with no importer — read why it went before rehoming it");
});

// ─── One name per screen ───────────────────────────────────────────────────

/** The four places that send somebody to the merged Progress page. */
const ENTRANCES = ["src/components/dashboard/DueRadar.jsx",
    "src/components/study/SpacedRepetition.jsx",
    "src/components/layout/SideRail.jsx",
    "src/components/layout/BottomNav.jsx"];

check("NOBODY SAYS \"check the pile\" ANY MORE", () => {
    // A nav item, a shelf button and a dashboard link each calling one screen
    // something different means four names for it, and "the pile" was the one
    // a student had never heard.
    for (const f of ENTRANCES) {
        assert.ok(!/check the pile/i.test(strip(read(f))),
            `${f} still calls it "the pile", which is not what the page calls itself`);
    }
});

check("and every entrance uses the page's OWN name", () => {
    // READ THE NAME OFF THE PAGE rather than restating it here. A string
    // written down in the test is a fifth copy, and the first rename would
    // make the suite red for being out of date rather than for a real split.
    const review = read("src/pages/Review.jsx");
    const m = /uppercase tracking-wider">([^<]+)<\/span>/.exec(review);
    assert.ok(m, "Review.jsx no longer declares a page name, so there is nothing to match against");
    const name = m[1].trim();
    assert.ok(name.length > 2, `the page name "${name}" is too short to be one`);
    for (const f of ENTRANCES) {
        assert.ok(strip(read(f)).includes(name),
            `${f} does not say "${name}", which is what the page calls itself — ` +
            `two names for one screen is how a student stops believing either`);
    }
});

check("ANALYTICS MERGED IN, and its old link still lands somewhere", () => {
    // The route is gone from pages.config, so without the redirect every
    // bookmark, every old in-app link and the AI coach's own suggestions hit
    // the 404 page.
    assert.ok(!/pages\/Analytics/.test(read("src/pages.config.js")),
        "Analytics is still a registered page as well as a tab — two surfaces for one set " +
        "of charts is the mirror this codebase keeps deleting");
    assert.match(read("src/App.jsx"), /path="\/Analytics" element=\{<Navigate to="\/Review\?tab=insights"/,
        "nothing redirects /Analytics, so every existing link to it 404s");
    // AND THE PAGE RESOLVES WHATEVER IT IS SENT TO A REAL TAB. This used to
    // assert the literal `get("tab") === "insights"`, which pinned a MECHANISM:
    // the moment the page grew a tab per feature and "insights" stopped being
    // one of their names, a correct alias made the suite red. What matters is
    // that the target of the redirect resolves to a tab that exists.
    const page = read("src/pages/Review.jsx");
    const target = /to="\/Review\?tab=([a-z]+)"/.exec(read("src/App.jsx"))?.[1];
    assert.ok(target, "the redirect no longer names a tab at all");
    const ids = [...page.slice(page.indexOf("const TABS = ["), page.indexOf("];", page.indexOf("const TABS = [")))
        .matchAll(/\[\s*"([a-z]+)"/g)].map((m) => m[1]);
    const alias = page.slice(page.indexOf("const TAB_ALIAS"), page.indexOf("};", page.indexOf("const TAB_ALIAS")));
    assert.ok(ids.includes(target) || new RegExp(`\\b${target}:`).test(alias),
        `/Analytics redirects to ?tab=${target}, which is neither a tab nor aliased to one — ` +
        "so every bookmark to it lands on the default screen instead of the charts");
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

check("AND THE LEAGUE PAGE STILL SAYS WHAT A FINISH PAYS", () => {
    // The property survives the strip: `Podium` prints the reward ON the step,
    // from `grantForLeague` — the function the server actually grants with,
    // never a figure typed into a component. That was always the better place
    // for it; the strip was a preview of it one screen earlier.
    const podium = read("src/components/league/Podium.jsx");
    assert.match(podium, /grantForLeague\(/,
        "nothing on the league page says what a finish is worth, so there is no reason " +
        "to play a week you are already safe in");
    assert.ok(!/\b1[0-9]{3}\s*credits/i.test(strip(podium)),
        "a payout figure is written out here rather than taken from grantForLeague");
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

// ─── A DEEP LINK MUST NAME SOMETHING THE PAGE HONOURS ──────────────────────
//
// THE BUTTON WORKED AND THE DESTINATION DID NOT, which is strictly worse than
// no entrance at all: a student presses the one thing on the screen that says
// "review your cards", arrives somewhere plausible, and concludes the feature
// is hard to find. Both instances were live and both were silent.
//
//   ?tab=spaced        Study's deep link is `TECHNIQUES.some(x => x.id === t)`
//                      and the id is `spaced_repetition`, so this matched
//                      nothing and `activeTab` stayed at its "pomodoro"
//                      default. FIVE call sites sent it: the queue's two card
//                      rows, `startReview` (the pile's own button AND "N cards
//                      for today → Start"), and both doors on the Cards tab.
//                      Every way into the flashcard review from Progress
//                      landed on a Pomodoro timer.
//   ?tab=resit         MistakeBank's tabs are `fix` and `redo`, and it did not
//                      read the query AT ALL — a bare `useState("fix")`. So
//                      the "questions to sit again" row, which exists to open
//                      the Sit again tab, opened Fix.
//
// Nothing throws, nothing renders wrong, and the destination page looks
// exactly as it does when somebody navigates there by hand. This is the
// property `rankedMove.test.mjs` already keeps about the ATAR component moves,
// generalised to the two pages the queue and the report link into with a tab.

const STUDY = read("src/pages/Study.jsx");
const BANK = read("src/pages/MistakeBank.jsx");

const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel, out);
        else if (/\.(js|jsx)$/.test(e.name) && !e.name.endsWith(".test.mjs")) out.push(rel);
    }
    return out;
};
const SOURCES = [...walk("src"), ...walk("scripts")];

/**
 * The values a page will act on. Read off the page rather than written down
 * here — a list restated in a test is one more copy, and the first rename
 * would make the suite red for being out of date rather than for a real
 * split. `reachable`'s own rule about the Review queue's name.
 */
const STUDY_TABS = [...strip(STUDY).matchAll(/\{\s*id:\s*"([a-z_]+)"/g)].map((m) => m[1]);
const BANK_RETURN = strip(BANK).match(/get\("tab"\);\s*return ([^;]+);/);
const BANK_TABS = BANK_RETURN
    ? [...BANK_RETURN[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]) : [];

/**
 * The object literal containing `at`, by brace depth in both directions.
 * Null if the braces do not balance, which is safer than guessing a window.
 */
const objectAround = (src, at) => {
    let depth = 0, open = -1;
    for (let i = at; i >= 0; i -= 1) {
        const c = src[i];
        if (c === "}") depth += 1;
        else if (c === "{") { if (depth === 0) { open = i; break; } depth -= 1; }
    }
    if (open === -1) return null;
    depth = 0;
    for (let i = open; i < src.length; i += 1) {
        const c = src[i];
        if (c === "{") depth += 1;
        else if (c === "}") { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
    }
    return null;
};

check("the destination pages declare the tab values this scan checks against", () => {
    assert.ok(STUDY_TABS.includes("spaced_repetition") && STUDY_TABS.length >= 6,
        "Study's technique ids were not found — the scan below would pass forever");
    assert.ok(BANK_TABS.includes("fix") && BANK_TABS.includes("redo"),
        "MistakeBank no longer reads ?tab= — the deep link into Sit again is dead again");
});

check("AND EACH ONE ACTUALLY READS THE QUERY IT IS SENT", () => {
    // The other half, and the scan below cannot see it: with the deep-link
    // effect DELETED rather than wrong, every link in the tree still names a
    // valid id and every one of them silently stops working. This is
    // `rankedMove.test.mjs`'s own property — every query a link emits is read
    // by the page that has to honour it — on the two pages the queue and the
    // report link into with a tab.
    const study = strip(STUDY);
    assert.ok(/get\(['"]tab['"]\)/.test(study) && /setActiveTab\(t\)/.test(study),
        "Study no longer reads ?tab= and applies it — every technique deep link " +
        "in the app lands on the \"pomodoro\" default and nothing says so");
    const bank = strip(BANK);
    assert.ok(/get\(['"]tab['"]\)/.test(bank),
        "MistakeBank no longer reads ?tab= — the Sit again deep link opens Fix");
});

check("every ?tab= link into Study or MistakeBank names a value that page honours", () => {
    const HONOURS = { Study: STUDY_TABS, MistakeBank: BANK_TABS };
    let found = 0;
    for (const f of SOURCES) {
        const src = strip(read(f));
        // Shapes 1-4: "/Study?tab=x", createPageUrl("Study?tab=x"),
        // createPageUrl("Study") + "?tab=x", `${createPageUrl("Study")}?tab=x`.
        for (const [page, ids] of Object.entries(HONOURS)) {
            for (const m of src.matchAll(new RegExp(`${page}[^\\n]{0,30}?\\?tab=([A-Za-z_]+)`, "g"))) {
                found += 1;
                assert.ok(ids.includes(m[1]),
                    `${f} links to ${page}?tab=${m[1]}, which that page does not honour — ` +
                    `it lands on the default and the thing the link promised does not open`);
            }
        }
        // Shape 5: a builder object carrying `page:` and its own `query:`.
        // THE WINDOW IS THE OBJECT LITERAL, found by brace depth — the
        // `dbColumns` idiom. A fixed character window is not a scan, and this
        // one proved it on the first run: `COMPONENT_MOVE` lists MistakeBank
        // with no query and Study with `?tab=pomodoro` on the NEXT line, so a
        // 400-character slice reported MistakeBank as linking to a technique.
        // That is a false positive, which is the direction that gets a good
        // guard deleted rather than merely ignored.
        for (const m of src.matchAll(/page:\s*"([A-Za-z]+)"/g)) {
            const ids = HONOURS[m[1]];
            if (!ids) continue;
            const lit = objectAround(src, m.index);
            const t = lit && lit.match(/\?tab=([A-Za-z_]+)/);
            if (!t) continue;
            found += 1;
            assert.ok(ids.includes(t[1]),
                `${f} builds ${m[1]}?tab=${t[1]}, which that page does not honour`);
        }
    }
    assert.ok(found >= 8, `the deep-link scan matched only ${found} links — it is not reading the tree`);
});

console.log(`\nreachable: ${passed} checks passed`);
