/**
 * rankedBoards assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/rankedBoards.test.mjs
 *
 * ═══ TWO WAYS A LEADERBOARD LIES, AND NEITHER THROWS ════════════════════════
 *
 * 1. A MOVEMENT ARROW NOBODY EARNED. The column is computed from a stored
 *    snapshot, and there are four separate ways a previous position can be
 *    missing — no snapshot, a student absent from it, a junk value in it, and
 *    a genuine zero which means something else entirely. Every one of them has
 *    an obvious coercion that renders perfectly and is wrong: `was || 0` and
 *    `Number(null)` both make a new student a FALLEN one, drawing a red arrow
 *    on exactly the row that should be celebrating, and the sign is one
 *    character away from drawing every climb as a fall. That trap has now
 *    reached `criterionIndexFor`, `expiredKeys`, `markPercent`, `standingOf`,
 *    `closingFacts`, `weakTopicsFrom` and `movementFor`.
 *
 * 2. A BOARD ON THE WRONG TAB. The page is split by ERA — the ATAR is a
 *    trailing 28-day score, XP and hours are lifetime totals — and `era` on
 *    the descriptor is what decides where each one is drawn. Two hard-coded
 *    arrays instead would be the mirror this codebase keeps deleting, and the
 *    failure is silent: the ATAR quietly appearing under a heading reading
 *    "everything you have ever earned".
 *
 * And the snapshot ids are written down TWICE on purpose — `server.mjs` cannot
 * import `ranked.js`, which resolves `@/lib/atarBands` (the alias node cannot
 * read; see `serverBoot.test.mjs`) — so the two lists are compared here, the
 * same thing `holdings.test.mjs` does for `RANK_MIN_CALLS`.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { movementFor, movementMap, movementLabel, rankMap } from "@/lib/boardMovement";
import { BOARDS, boardsFor, boardById } from "@/lib/ranked";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
/** A comment naming the broken form is not the broken form. */
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const SERVER = read("server.mjs");
const PAGE = read("src/pages/Ranked.jsx");
const BOARD = read("src/components/ranked/RankedBoard.jsx");

const rows = (...emails) => emails.map((e) => ({ user_email: e }));

// ─── 1. The direction, which is one character ──────────────────────────────

check("A LOWER RANK NUMBER IS BETTER — 4th to 2nd is UP two places", () => {
    const m = movementFor(2, 4);
    assert.equal(m.dir, "up", "a climb is being drawn as a fall — the delta is `was - now`");
    assert.equal(m.places, 2);
    const d = movementFor(7, 5);
    assert.equal(d.dir, "down");
    assert.equal(d.places, 2, "places is a magnitude; a negative would render as \"-2\"");
});

check("holding position is LEVEL, and level is not the same as unknown", () => {
    const m = movementFor(4, 4);
    assert.equal(m.dir, "level");
    assert.equal(m.places, 0);
    // Both draw something different: level is a dash, unknown is nothing.
    assert.equal(movementFor(null, 4), null, "a row with no current rank has no movement");
});

// ─── 2. `Number(null) === 0`, the trap this file exists for ────────────────

check("A MISSING PREVIOUS RANK IS \"NEW\", NEVER A FALL FROM ZEROTH", () => {
    const m = movementFor(12, undefined);
    assert.equal(m.dir, "new",
        "a student absent from the snapshot is being given a position they never held — " +
        "coerced, 0 is better than every real rank, so every new student reads as having fallen");
    assert.notEqual(m.dir, "down");
    assert.equal(movementFor(12, null).dir, "new");
});

check("and a JUNK stored value is absent, not sorted to the front of the board", () => {
    // 0, a negative, a string and NaN all have to read as "we do not know",
    // or a corrupt row becomes the leader of last week's board and shifts
    // everybody else's movement by one.
    for (const bad of [0, -3, "x", NaN, {}, true]) {
        assert.equal(movementFor(5, bad).dir, "new", `${String(bad)} was read as a placing`);
    }
});

check("movementLabel never says \"0 places\"", () => {
    assert.equal(movementLabel(null), null);
    assert.match(movementLabel({ dir: "new", places: 0 }), /new/i);
    assert.match(movementLabel({ dir: "level", places: 0 }), /holding/i);
    assert.match(movementLabel({ dir: "up", places: 1 }), /1 place$/);
    assert.match(movementLabel({ dir: "up", places: 3 }), /3 places$/);
});

// ─── 3. No snapshot draws NOTHING ──────────────────────────────────────────

check("NO SNAPSHOT IS NULL FOR THE WHOLE BOARD, not thirty \"new\" badges", () => {
    assert.equal(movementMap(rows("a", "b"), null), null);
    assert.equal(movementMap(rows("a", "b"), undefined), null);
    assert.equal(movementMap(rows("a", "b"), {}), null,
        "a snapshot that recorded nobody is the same as not having one — otherwise the " +
        "first load of a week tells every student on the board they have just arrived");
});

// ─── 4. The snapshot is re-ranked within the rows on screen ────────────────

check("THE SNAPSHOT IS RE-RANKED WITHIN THIS SCOPE", () => {
    // A friends board of three. Stored ranks are GLOBAL positions: 9, 3, 5.
    // Last week within this scope that is b(1), c(2), a(3); this week the rows
    // arrive sorted a, b, c. So a climbed two and the other two slipped one.
    // Read against the raw stored numbers instead, `a` would be "up 8".
    const m = movementMap(rows("a", "b", "c"), { a: 9, b: 3, c: 5 });
    assert.deepEqual(m.a, { dir: "up", places: 2 });
    assert.deepEqual(m.b, { dir: "down", places: 1 });
    assert.deepEqual(m.c, { dir: "down", places: 1 });
});

check("on the global board the re-rank gives the stored number back", () => {
    const m = movementMap(rows("a", "b", "c"), { a: 1, b: 2, c: 3 });
    assert.equal(m.a.dir, "level");
    assert.equal(m.b.dir, "level");
    assert.equal(m.c.dir, "level");
});

check("AN ARRIVAL DOES PUSH EVERYBODY DOWN, and that is the honest reading", () => {
    // Written expecting the opposite and corrected by this assertion, which is
    // worth recording: the tempting rule is that being overtaken by somebody
    // who was not on the board last week should not count as slipping, since
    // nobody who was behind you passed you.
    //
    // It is wrong, and visibly so. `a` was first and is now second — the place
    // numeral beside the arrow SAYS 2 — so a chip reading "holding" sits
    // directly next to the evidence that they are not. A board that contradicts
    // its own rank column has spent the credibility the column had.
    //
    // Movement here means places, and places are places however they were
    // taken.
    const m = movementMap(rows("new", "a", "b"), { a: 1, b: 2 });
    assert.equal(m.new.dir, "new", "the newcomer has no previous place to have moved from");
    assert.equal(m.a.dir, "down");
    assert.equal(m.a.places, 1);
    assert.equal(m.b.dir, "down");
});

check("rankMap takes positions from the ORDER, not from a value", () => {
    assert.deepEqual(rankMap(rows("a", "b", "c")), { a: 1, b: 2, c: 3 });
    assert.deepEqual(rankMap([]), {});
    // A duplicate row cannot overwrite the better placing it already has.
    assert.deepEqual(rankMap(rows("a", "b", "a")), { a: 1, b: 2 });
});

// ─── 5. The era split ──────────────────────────────────────────────────────

check("EVERY BOARD DECLARES AN ERA, and both eras are drawn", () => {
    for (const b of BOARDS) {
        assert.ok(["month", "alltime"].includes(b.era),
            `${b.id} has era "${b.era}", which no tab renders — the board would exist and ` +
            `appear nowhere`);
        assert.ok(typeof b.window === "string" && b.window.length > 4,
            `${b.id} does not say what window it measures`);
    }
    assert.deepEqual(boardsFor("month").map(b => b.id), ["atar"]);
    assert.deepEqual(boardsFor("alltime").map(b => b.id), ["xp", "time"]);
});

check("the page derives its boards rather than restating them", () => {
    const p = strip(PAGE);
    assert.match(p, /boardsFor\(/, "the all-time tab is not derived from `era`");
    assert.ok(!/\bconst BOARDS\s*=/.test(p),
        "Ranked.jsx has its own BOARDS array again — two lists that can disagree about " +
        "which tab the ATAR lives on");
    assert.ok(!/SCOPES\.map/.test(p),
        "the scope chips are back inline — they are one segmented control in BoardControls " +
        "now, and six bordered buttons on one line at 360px is what made this a toolbar");
});

check("boardById never answers undefined", () => {
    assert.equal(boardById("atar").id, "atar");
    assert.equal(boardById("nope").id, BOARDS[0].id,
        "an unknown id must fall back to a real descriptor — `meta.value` on undefined is " +
        "a crash on a board switch");
});

// ─── 6. One page holds all the ATAR ────────────────────────────────────────

check("THE ATAR PANEL IS INSIDE THE SCORE TAB, not above all four", () => {
    const p = strip(PAGE);
    const score = p.indexOf('value="score"');
    const board = p.indexOf('value="board"');
    const dial = p.indexOf("<AtarDial");
    assert.ok(score > -1 && board > score, "the tabs are not in order");
    assert.ok(dial > score && dial < board,
        "the ATAR dial is drawn outside the Score tab — a 230px gauge of a 28-day score " +
        "at the top of every other tab is what this split removed");
});

check("FOUR TABS, FLAT: score, board, league, all time", () => {
    // Flat rather than three with a second bar inside the first. "My rank"
    // held the dial, the five components, the whole leaderboard AND the
    // ten-tier ladder on one scroll, and the obvious fix — sub-tabs — is the
    // nested control this page already refused once.
    const ids = [...PAGE.matchAll(/\["(score|board|league|alltime)",/g)].map(m => m[1]);
    assert.deepEqual(ids, ["score", "board", "league", "alltime"],
        "you (28 days), everyone else (28 days), this week, everything");
    const i = PAGE.indexOf("<TabsList");
    assert.match(PAGE.slice(i, i + 400), /grid-cols-4\b/,
        "four tabs in a grid that is not grid-cols-4 overlap — it renders, and it renders wrong");
    assert.ok(!/TabsList[\s\S]{0,4000}<Tabs\b/.test(PAGE),
        "a second Tabs opened inside the first — two tab bars drawn alike, one nested in " +
        "the other, is how a student loses track of which one they are using");
});

check("the climb is on SCORE and the leaderboard is on BOARD", () => {
    const p = strip(PAGE);
    const score = p.indexOf('value="score"');
    const board = p.indexOf('value="board"');
    const league = p.indexOf('value="league"');
    const profile = p.indexOf("<MyProfile");
    assert.ok(profile > score && profile < board,
        "the ladder and the badges are not on the tab about you");
    const section = p.indexOf("<BoardSection");
    assert.ok(section > board && section < league,
        "the ATAR board is not on the Board tab");
});

check("AND THE RANK STAT OPENS THE BOARD", () => {
    // The board moved a tab away, so the tile that states your standing is
    // what has to carry you there — a bar with no way through is a diagnosis,
    // which is the rule the five components below it already keep.
    assert.match(strip(PAGE), /onClick=\{mine\.rank \? \(\) => setTab\("board"\) : null\}/,
        "the rank tile is a dead readout again, on a tab that no longer shows the board");
});

// ─── 7. The pinned row has to be reachable ─────────────────────────────────

check("THE PINNED ROW SITS ABOVE THE BOTTOM NAV", () => {
    assert.match(BOARD, /bottom-\[5\.25rem\]\s+md:bottom-5/,
        "the pinned bar's offset has changed — under the bottom nav it is a control nobody " +
        "can tap on a phone, and only a screenshot would say so");
    const nav = read("src/components/layout/BottomNav.jsx");
    assert.match(nav, /md:hidden fixed bottom-0/,
        "the bottom nav has moved, so the clearance above is now reserved against nothing");
    assert.match(nav, /z-40/);
    assert.match(BOARD, /z-30/, "the pinned bar must sit under the nav, not over it");
});

check("it only appears when the real row is off screen", () => {
    assert.match(BOARD, /IntersectionObserver/,
        "the pinned bar is drawn unconditionally — a permanent copy of a row already on " +
        "screen is a second, smaller answer to the same question");
    assert.match(BOARD, /typeof IntersectionObserver !== "function"/,
        "no guard for an environment without IntersectionObserver");
});

// ─── 8. Shape carries the direction ────────────────────────────────────────

check("MOVEMENT IS SHAPE AS WELL AS COLOUR", () => {
    // The brand green and the streak red sit at ΔE 7.0 under deuteranopia —
    // the floor's own step-dot lesson. An arrow pointing the other way is the
    // second channel; the number is the third.
    const i = BOARD.indexOf("function MoveChip");
    const chip = BOARD.slice(i, i + 1400);
    assert.match(chip, /ChevronUp/, "no up glyph");
    assert.match(chip, /ChevronDown/, "no down glyph — direction would be carried by hue alone");
    assert.match(chip, /aria-label=/, "the chip says nothing to a screen reader");
});

check("the movement lane is reserved even with no snapshot", () => {
    // Otherwise every other column shifts sideways the moment the arrows
    // appear, which is the jump `SLOT_H` exists to stop on the floor.
    assert.match(BOARD, /w-6 sm:w-7 flex items-center justify-center/,
        "the arrow column is not a fixed lane");
});

// ─── 9. The server's copy of the board ids ─────────────────────────────────

check("THE SERVER'S SNAPSHOT BOARDS ARE THE CLIENT'S BOARDS", () => {
    const i = SERVER.indexOf("const SNAPSHOT_BOARDS = [");
    assert.ok(i > -1, "server.mjs no longer declares SNAPSHOT_BOARDS");
    const block = SERVER.slice(i, SERVER.indexOf("];", i));
    const ids = [...block.matchAll(/id:\s*"([a-z]+)"/g)].map(m => m[1]);
    assert.deepEqual(ids, BOARDS.map(b => b.id),
        "the server snapshots different boards from the ones the client draws — a board " +
        "with no snapshot silently loses its movement column forever");
});

check("a snapshot written by this request is NOT reported back", () => {
    const i = SERVER.indexOf("async function weekBoardSnapshots");
    const fn = SERVER.slice(i, SERVER.indexOf("\n}", i));
    assert.ok(i > -1, "weekBoardSnapshots is gone");
    // The returned map is built from what was READ, never from what was just
    // inserted — a fresh snapshot describes now, so every movement against it
    // is zero and the board would tell the whole field it is holding.
    assert.match(fn, /if \(have\.has\(b\.id\)\) out\[b\.id\] = have\.get\(b\.id\)/,
        "the response is being built from something other than the rows that were read");
    assert.match(fn, /23505/,
        "a concurrent write is not tolerated — two students opening the board in the same " +
        "second would log an error apiece");
});

check("getRankedBoards ships the snapshots", () => {
    const i = SERVER.indexOf('app.post("/local-ai/fn/getRankedBoards"');
    const fn = SERVER.slice(i, i + 7000);
    assert.match(fn, /await weekBoardSnapshots\(board\)/,
        "the snapshot is not read, so the board has no movement to draw");
    assert.match(fn, /\n      snapshots,/, "the payload does not carry them");
});

check("migration 0039 exists, with the index that makes the lazy write safe", () => {
    const sql = read("supabase/migrations/0039_board_snapshots.sql");
    assert.match(sql, /create table if not exists public\.board_snapshots/);
    assert.match(sql, /create unique index[\s\S]*\(week_start, board\)/,
        "without the unique index two students opening the board in one second write two " +
        "snapshots for one week with half the field in each");
    assert.match(sql, /enable row level security/);
    // No policy at all: the table holds the whole field's standing, including
    // students outside the viewer's scope.
    assert.ok(!/create policy/.test(sql),
        "a client policy was added — the ranks map is everybody's position, which is more " +
        "than any one student is allowed to see");
});

// ─── 10. Collapsing must never hide a student from themselves ──────────────

check("THE BOARD OPENS AT TEN PEOPLE, PODIUM INCLUDED", () => {
    // Ten is the count a league table is read at, and it has to mean ten
    // PEOPLE — the podium's three plus seven. Slicing ten rows AFTER the
    // podium is thirteen, which renders perfectly and is a different promise
    // from the one the button makes.
    assert.match(BOARD, /COLLAPSED_TO = 10/, "the collapsed size is no longer ten");
    assert.match(BOARD, /all\.slice\(0, Math\.max\(0, COLLAPSED_TO - top\.length\)\)/,
        "the list is sliced without subtracting the podium, so \"top 10\" draws thirteen people");
});

check("YOUR OWN ROW SURVIVES THE COLLAPSE", () => {
    // The one row a student came to find is the one a cut-off can take, and
    // nothing would say so — the board would simply stop above them. Appended
    // with its REAL place number, which is why the row is read out of `rows`
    // rather than out of the sliced list.
    assert.match(BOARD, /const meCutOff = meIndex >= 3 \+ rest\.length/,
        "nothing works out whether collapsing has cut you off");
    assert.match(BOARD, /!expanded && meCutOff && meVisible/,
        "the appended row is not gated on actually being cut off — drawn otherwise it is a " +
        "duplicate of a row already on screen");
    assert.match(BOARD, /place=\{meIndex \+ 1\}/,
        "the appended row would print its position in the slice rather than on the board");
    // And a rule between them, or 8th and 24th sit flush and read as adjacent.
    assert.match(BOARD, /more<\/div>|more\s*<\/div>|\bmore\b/,
        "nothing marks the rows that were skipped");
});

check("the toggle says HOW MANY, and both directions exist", () => {
    assert.match(BOARD, /Show all \{rows\.length\}/,
        "\"Show all\" is a label; the number is what a student can decide about");
    assert.match(BOARD, /Show the top \{COLLAPSED_TO\}/,
        "the board expands and cannot be put back");
    assert.match(BOARD, /data-expand-board/, "the control is not addressable for a probe");
});

console.log(`\nrankedBoards: ${passed} checks passed`);
