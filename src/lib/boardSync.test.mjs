/**
 * boardSync assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/boardSync.test.mjs
 *
 * ═══ NOTHING EVER INSERTED A LEADERBOARD ROW ════════════════════════════════
 * Eleven call sites mirrored XP, streak, study time and the ATAR to
 * `leaderboards`, and every one of them was shaped `select id → if (row)
 * update`, with no `else`. The only rows in the table were the 42 that phase 3c
 * migrated against 132 profiles, so ~90 accounts earned XP into `user_profiles`
 * and were simply absent from the board — Level 1 on the profile tab, no row in
 * the standings, while the hero above printed a real ATAR off the other table.
 *
 * Every way back into that state is SILENT, which is why these are assertions
 * and not a comment:
 *
 *   • PostgREST answers 200 for an update that matched no rows, so each of
 *     those sites looked like it worked and logged nothing, forever;
 *   • a new mirror added later naturally gets written in the old shape,
 *     because that is what the file around it used to look like;
 *   • a blanket upsert would fix the missing row and silently reset
 *     `is_anonymous`, putting a student who had opted out back on a public
 *     board under their own name. That one cannot be undone afterwards.
 *
 * Scanned as TEXT rather than imported: `server.mjs` boots Express and binds a
 * port on load, the same reason `mirrors.test.mjs` and `serverBoot.test.mjs`
 * parse their sides instead of loading them.
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
const RAW = fs.readFileSync(path.join(root, "server.mjs"), "utf8");

/**
 * A COMMENT NAMING THE BUG IS NOT THE BUG. `syncBoardRow`'s own header spells
 * out the `select id → if (row) update` shape it replaced, and a scan over raw
 * source reports that explanation as the defect — the false positive
 * `fnResult.test.mjs`, `hookDeps.test.mjs`, `aceLoading.test.mjs` and
 * `floorInk.test.mjs` have each had to learn. The cost of not learning it is
 * worse than a red suite: the obvious way to make it green again is to delete
 * the sentence that says why.
 */
const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const SRC = strip(RAW);

// ─── The one writer ────────────────────────────────────────────────────────

/**
 * The two functions allowed to touch `leaderboards` with a write, BY NAME.
 *
 * Named rather than matched by shape, and each one asserted to still exist —
 * `due.test.mjs` records why: an exemption pointing at something that has
 * moved silently covers nothing and the scan passes either way, which is the
 * one failure mode worse than no scan.
 */
const WRITERS = ["syncBoardRow", "sweepBoardRows"];

/** The source span of a top-level `async function`, bounded by the next one. */
function spanOf(src, name) {
    const start = src.indexOf(`async function ${name}`);
    if (start === -1) return null;
    const after = src.slice(start + 1);
    const next = after.search(/\n(async function |function |app\.(get|post|use)\()/);
    return [start, start + 1 + (next === -1 ? after.length : next)];
}

/**
 * Every `.from("leaderboards")` whose next breath is a write.
 *
 * The window is a LOOKAHEAD rather than part of the match, and that is the
 * whole correctness of this scan: a consuming `([\s\S]{0,160})` swallows the
 * next occurrence, so two leaderboard calls within 160 characters of each other
 * — which is exactly what the old `select id → if (row) update` shape looks
 * like — came back as ONE match whose window stopped just short of the
 * `.update(`, and the scan reported a clean file. Caught by the self-check
 * below, which is the only reason this is right.
 */
const boardWrites = (src) =>
    [...src.matchAll(/\.from\(["']leaderboards["']\)(?=([\s\S]{0,160}))/g)]
        .filter((m) => /\.(update|insert|upsert|delete)\s*\(/.test(m[1]));

check("EVERY WRITE TO THE BOARD GOES THROUGH ONE OF THE TWO WRITERS", () => {
    const spans = WRITERS.map((n) => {
        const span = spanOf(SRC, n);
        assert.ok(span, `${n} is gone — this exemption now covers nothing and the scan passes anyway`);
        return span;
    });
    const inside = (i) => spans.some(([a, b]) => i >= a && i <= b);
    const outside = boardWrites(SRC).filter((m) => !inside(m.index));
    assert.equal(
        outside.length, 0,
        `${outside.length} leaderboard write(s) bypass ${WRITERS.join(" / ")} — a row that does ` +
        `not exist is not created, and the student never appears on the board`,
    );
});

check("the scan still catches a write put back the old way", () => {
    // Self-check: the guard above is only worth having if it fails on the real
    // bug. A window that matches nothing passes forever.
    // PREPENDED, not appended: the last function in the file has a span that
    // runs to EOF, so a snippet added at the end lands inside an exemption and
    // the self-check passes for the wrong reason.
    const broken = `
      const { data: lbRows } = await supabaseAdmin
        .from("leaderboards").select("id").eq("user_email", userEmail).limit(1);
      if (lbRows?.[0]) {
        await supabaseAdmin.from("leaderboards").update({ total_xp: 1 }).eq("id", lbRows[0].id);
      }` + SRC;
    const spans = WRITERS.map((n) => spanOf(broken, n)).filter(Boolean);
    const inside = (i) => spans.some(([a, b]) => i >= a && i <= b);
    const outside = boardWrites(broken).filter((m) => !inside(m.index));
    assert.ok(outside.length > 0, "the scan cannot see the bug it exists to catch");
});

check("the helper CREATES the row, which is the whole bug", () => {
    const start = SRC.indexOf("async function syncBoardRow");
    const body = SRC.slice(start, start + 3000);
    assert.match(body, /\.from\(["']leaderboards["']\)\.insert\(/,
        "syncBoardRow does not insert — it is the old select-then-update with a new name");
});

// ─── Privacy, which is the one thing a backfill cannot take back ───────────

check("a created row carries the student's own anonymity setting", () => {
    for (const fn of ["syncBoardRow", "sweepBoardRows"]) {
        const start = SRC.indexOf(`async function ${fn}`);
        assert.ok(start > -1, `${fn} is missing`);
        const body = SRC.slice(start, start + 3000);
        assert.match(body, /is_anonymous:\s*!!\w+(\?\.)?\.?\w*is_anonymous_on_leaderboard/,
            `${fn} creates board rows without reading is_anonymous_on_leaderboard — ` +
            `a student who turned anonymity ON is put on a public board under their name`);
    }
});

check("NO BLANKET UPSERT, because it would reset that setting on every award", () => {
    assert.ok(
        !/\.from\(["']leaderboards["']\)\s*\.?\s*\n?\s*\.upsert\(/.test(SRC),
        "an upsert sets every column it carries on conflict, so mirroring XP would " +
        "quietly clear is_anonymous and user_name for anybody who had set them",
    );
});

// ─── The figures a new row arrives with ────────────────────────────────────

check("a new row takes the PROFILE's XP, not the mirror's patch alone", () => {
    const start = SRC.indexOf("async function syncBoardRow");
    const body = SRC.slice(start, start + 3000);
    // The Math.max lines must come AFTER the `...fields` spread, or the spread
    // overwrites them and a first mirror carrying only a streak creates a row
    // reporting zero XP for an account that has eighteen thousand.
    const spread = body.indexOf("...fields,");
    const maxed = body.indexOf("total_xp: Math.max(");
    assert.ok(spread > -1 && maxed > -1, "the seed no longer reads the profile at all");
    assert.ok(maxed > spread,
        "the profile floor is spread over by the patch — a streak-only mirror creates a zero-XP row");
});

check("the backfill seeds real figures rather than zeroes", () => {
    const start = SRC.indexOf("async function sweepBoardRows");
    const body = SRC.slice(start, start + 3000);
    for (const f of ["total_xp", "season_xp", "streak_days", "acedit_atar"]) {
        assert.ok(body.includes(`${f}:`),
            `the backfill creates rows without ${f} — students arrive on the board at zero`);
    }
    assert.match(body, /level:\s*levelFromXP\(/,
        "the backfill writes a level off some other curve, or none at all");
});

// ─── ONE LEVEL CURVE ───────────────────────────────────────────────────────

check("NOTHING COMPUTES A LEVEL BY HAND", () => {
    // `awardGoalXP` carried `Math.floor(currentXP / 100) + 1` — a third curve,
    // writing to the same two columns as the real one, so finishing a goal
    // overwrote `current_level` and the board's `level` with a number off a
    // different curve until the next ordinary award put it back.
    const hand = [...SRC.matchAll(/Math\.floor\(\s*\w+\s*\/\s*100\s*\)\s*\+\s*1/g)];
    assert.equal(hand.length, 0,
        "a hand-rolled '100 XP per level' curve is back — levelFromXP is the one curve, " +
        "and mirrors.test.mjs exists because two copies of it drift");
});

// ─── The viewer is on the board before the board is read ───────────────────

check("getRankedBoards puts the viewer on the board BEFORE it reads it", () => {
    const start = SRC.indexOf('app.post("/local-ai/fn/getRankedBoards"');
    assert.ok(start > -1, "getRankedBoards is gone");
    const body = SRC.slice(start, start + 4000);
    const sync = body.indexOf("syncBoardRow(me,");
    const read = body.indexOf('.from("leaderboards")');
    assert.ok(sync > -1, "the viewer's own row is not ensured — the one row this page cannot be missing");
    assert.ok(read > -1 && sync < read,
        "the viewer's row is created after the board is read, so their first visit still shows them nowhere");
});

check("the board read is ORDERED, not an arbitrary 300", () => {
    const start = SRC.indexOf('app.post("/local-ai/fn/getRankedBoards"');
    const body = SRC.slice(start, start + 4000);
    const read = body.indexOf('.from("leaderboards")');
    const window = body.slice(read, read + 600);
    assert.match(window, /\.order\(/,
        "an unbounded .limit(300) hands back whichever 300 PostgREST feels like — " +
        "the same arbitrary-prefix bug the ATAR window queries had");
});

check("the backfill is budgeted, so one page load is not a hundred inserts", () => {
    assert.match(SRC, /BOARD_BACKFILL_BUDGET\s*=\s*\d+/,
        "the backfill has no budget — the student who opens Ranked pays for every missing row");
    const start = SRC.indexOf("async function sweepBoardRows");
    assert.match(SRC.slice(start, start + 3000), /slice\(0,\s*BOARD_BACKFILL_BUDGET\)/,
        "the budget is declared and not applied");
});

check("the backfill reads BOTH tables before it writes", () => {
    const start = SRC.indexOf("async function sweepBoardRows");
    const body = SRC.slice(start, start + 3000);
    // A failed board read, destructured as an empty board, would try to insert
    // a row for every student on the site and collide with all of them.
    assert.match(body, /if\s*\(pErr\s*\|\|\s*bErr\)/,
        "a failed read is indistinguishable from an empty table — the one shape that " +
        "turns a backfill into an insert storm");
});

// ─── The client half ───────────────────────────────────────────────────────

check("the hours board creates its own row too", () => {
    // QuizPlayer is the ONLY writer of total_study_time, and it stopped at
    // `if (entries.length > 0)` — so the hours board stayed at zero forever for
    // anybody with no row, and nothing in the app ever made one.
    const qp = strip(fs.readFileSync(
        path.join(root, "src/components/quizzes/QuizPlayer.jsx"), "utf8"));
    const i = qp.indexOf("Leaderboard.filter({ user_email: user.email })");
    assert.ok(i > -1, "QuizPlayer no longer writes the hours board — check this is deliberate");
    assert.match(qp.slice(i, i + 900), /Leaderboard\.create\(/,
        "QuizPlayer drops the student's study time when they have no board row");
});

console.log(`\nboardSync: ${passed} checks passed`);
