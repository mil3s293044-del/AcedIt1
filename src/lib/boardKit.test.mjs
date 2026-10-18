/**
 * leaderboard kit assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/boardKit.test.mjs
 *
 * ═══ THREE BOARDS, ONE TABLE ════════════════════════════════════════════════
 * Ranked, the League and the study-group week each drew their own podium and
 * measured their own gaps, and disagreed about how far apart two people were.
 * They deal one podium now (`CardPodium`), on one ledger (`LedgerRow`), with
 * your row following you (`MyRowDock`), by the rules in `boardKit.js`.
 *
 * Nothing here throws when it breaks. A board that re-renders in place instead
 * of racing, a dock that loses its ref, a podium that deals under reduced
 * motion, an avatar clipped mid-flight — each renders, passes lint and builds.
 * So the rules are pure and the wiring is scanned.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    PODIUM_RANKS, podiumSeats, dealAt, turnAt, seatAt, SHEEN_AT, REVEAL_MS, DEAL,
    rowDelay, ROW_STAGGER_MAX, gapsOf, gapScale, gapPct, GAP_FLOOR,
    countFrame, figureChange, dockSide,
} from "@/lib/boardKit";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
/** A comment naming the broken form is not the broken form. */
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const PODIUM = strip(read("src/components/boards/CardPodium.jsx"));
const ROW = strip(read("src/components/boards/LedgerRow.jsx"));
const DOCK = strip(read("src/components/boards/MyRowDock.jsx"));
const FIGURE = strip(read("src/components/boards/LiveFigure.jsx"));
const RANKED = strip(read("src/components/ranked/RankedBoard.jsx"));
const LEAGUE_PODIUM = strip(read("src/components/league/Podium.jsx"));
const LEAGUE_BOARD = strip(read("src/components/league/WeeklyBoard.jsx"));
const GROUP = strip(read("src/components/groups/GroupWeek.jsx"));
const LEAGUE_PAGE = strip(read("src/pages/League.jsx"));
const CSS = read("src/index.css");
const BOARDS = { RankedBoard: RANKED, WeeklyBoard: LEAGUE_BOARD, GroupWeek: GROUP };

/* ── The podium ──────────────────────────────────────────────────────────── */

check("first holds the Ace, second the King, third the Queen", () => {
    assert.deepEqual(PODIUM_RANKS, { 1: "A", 2: "K", 3: "Q" });
    assert.match(PODIUM, /rank=\{PODIUM_RANKS\[place\]\}/, "the card no longer reads its rank off the place");
});

check("the seats run 2-1-3, and an empty seat is a seat", () => {
    const a = { key: "a" }, b = { key: "b" };
    assert.deepEqual(podiumSeats([a, b]).map((s) => [s.place, s.entry?.key ?? null]),
        [[2, "b"], [1, "a"], [3, null]], "a missing third place collapsed the staircase");
    assert.deepEqual(podiumSeats().map((s) => s.place), [2, 1, 3]);
});

check("THE ACE LANDS LAST: third is dealt and turned first", () => {
    assert.ok(dealAt(3) < dealAt(2) && dealAt(2) < dealAt(1), "the deal is not a countdown");
    assert.ok(turnAt(3) < turnAt(2) && turnAt(2) < turnAt(1), "first place turns over before the others");
    for (const p of [1, 2, 3]) {
        assert.ok(turnAt(p) > dealAt(p), `place ${p} turns over before it has landed`);
        assert.ok(seatAt(p) > turnAt(p), `place ${p}'s person arrives while their card is still face down`);
    }
    assert.ok(SHEEN_AT >= turnAt(1) + DEAL.turn - 1e-9, "the light crosses the Ace before it is face up");
    assert.ok(REVEAL_MS >= seatAt(1) * 1000, "the arrival window closes before first place has arrived");
});

check("rows arrive with the podium, not after it, and the stagger is capped", () => {
    assert.equal(rowDelay(0), 0);
    assert.ok(rowDelay(1) > 0);
    assert.equal(rowDelay(500), ROW_STAGGER_MAX, "the thirtieth row waits for nothing");
    assert.ok(ROW_STAGGER_MAX < 0.6);
    assert.equal(rowDelay(-3), 0);
    assert.equal(rowDelay(undefined), 0);
});

/* ── The gaps ────────────────────────────────────────────────────────────── */

check("a gap is to the row above, never negative, and the first row has none", () => {
    assert.deepEqual(gapsOf([10, 7, 7, 2]), [null, 3, 0, 5]);
    assert.deepEqual(gapsOf([5, 9]), [null, 0], "an unsorted list drew a row as ahead of the one above it");
    assert.deepEqual(gapsOf([5, null, 3]), [null, null, null]);
});

check("THE SCALE IS TWICE THE MEDIAN OF THE REAL GAPS — ties are not spacing", () => {
    // The ATAR steps in 0.05s and ties are common. Counting them dragged the
    // median toward zero and drew every real gap as full.
    const gaps = [null, 0, 0, 0, 0, 0.2, 0.4, 0.6];
    assert.equal(gapScale(gaps), 0.8, "ties were counted into the median");
    assert.equal(gapScale([null, 1, 3]), 4, "an even count takes the middle two");
    assert.equal(gapScale([null, 0, 0]), 0, "a level board invented a scale");
    assert.equal(gapScale([]), 0);
});

check("a bar: null is nothing, a tie is the floor, and nothing passes 100", () => {
    assert.equal(gapPct(null, 4), null, "Number(null) is 0 — a missing gap drew as a tie");
    assert.equal(gapPct(undefined, 4), null);
    assert.equal(gapPct(0, 4), GAP_FLOOR);
    assert.equal(gapPct(2, 4), 50);
    assert.equal(gapPct(40, 4), 100);
    assert.equal(gapPct(0.01, 4), GAP_FLOOR);
    assert.equal(gapPct(3, 0), GAP_FLOOR, "a level board divided by zero");
});

check("every board measures with the same scale, and none rolls its own median", () => {
    for (const [name, src] of Object.entries({ RankedBoard: RANKED, WeeklyBoard: LEAGUE_BOARD })) {
        assert.match(src, /gapScale\(/, `${name} no longer draws its gaps to the shared scale`);
        assert.ok(!/const median\b|function median\b|Math\.floor\([^)]*length \/ 2\)/.test(src),
            `${name} computes a median of its own — the disagreement this kit removed`);
    }
});

/* ── Live numbers ────────────────────────────────────────────────────────── */

check("a figure counts in integers when its target is one, and lands exactly", () => {
    assert.equal(countFrame(18438.62, 18439), 18439);
    assert.equal(countFrame(91.237, 94.2), 91.237);
    assert.equal(countFrame(NaN, 12), 12);
    assert.equal(countFrame(3, null), null);
});

check("only an INCREASE flashes, and a missing value is not a change", () => {
    assert.equal(figureChange(10, 12), "up");
    assert.equal(figureChange(12, 10), "down");
    assert.equal(figureChange(10, 10), null);
    assert.equal(figureChange(null, 10), null, "the first value read as an increase from nothing");
    assert.match(FIGURE, /figureChange\(from, target\) === "up"/, "a drop flashes too");
});

check("a new quantity is printed, never counted from the old one", () => {
    // XP to study time is not a change in anybody's figure.
    assert.match(FIGURE, /kind\.current !== quantity/);
    for (const [name, src] of Object.entries({ CardPodium: PODIUM, LedgerRow: ROW })) {
        assert.match(src, /quantity=\{[^}]*\.quantity\}/, `${name} does not pass the quantity through`);
    }
});

check("only the podium counts in on arrival", () => {
    assert.match(PODIUM, /countIn=\{deal\}/);
    assert.ok(!/countIn/.test(ROW), "every row counts up from zero on arrival — a slot machine");
});

/* ── Your row follows you ────────────────────────────────────────────────── */

check("the dock holds on at the edge your row left by", () => {
    assert.equal(dockSide({ visible: true, rowTop: -400 }), null, "a copy of a row already on screen");
    assert.equal(dockSide({ visible: false, rowTop: -400, viewTop: 48 }), "top");
    assert.equal(dockSide({ visible: false, rowTop: 900, viewTop: 48 }), "bottom");
    assert.equal(dockSide({ visible: false, rowTop: 20, viewTop: 48 }), "top", "under the top bar is above");
    assert.equal(dockSide({ visible: false, rowTop: NaN }), null);
});

check("a jump past the row still moves the dock to the other edge", () => {
    // The observer only reports CROSSING its threshold; a fling that never
    // shows the row in any frame left the dock pointing the wrong way.
    assert.match(DOCK, /addEventListener\("scroll", onScroll, \{ passive: true \}\)/);
    assert.match(DOCK, /removeEventListener\("scroll", onScroll\)/);
    assert.match(DOCK, /if \(!visible && !frame\)/, "the scroll fallback runs while the row is on screen too");
});

check("THE DOCK NEVER LOSES ITS ROW TO popLayout", () => {
    // popLayout clones each child with a ref of its own, replacing one passed
    // as `ref` — the dock would observe nothing and nothing would follow you.
    for (const [name, src] of Object.entries(BOARDS)) {
        assert.ok(!/<LedgerRow\b[^>]*\sref=\{/.test(src), `${name} hands its row ref to LedgerRow as \`ref\``);
    }
    assert.match(ROW, /for \(const r of \[ref, rowRef\]\)/, "LedgerRow does not merge the board's ref with framer's");
    assert.match(ROW, /<motion\.div ref=\{setRef\}/);
    assert.match(RANKED, /rowRef=\{isMe \? myRowRef : undefined\}/);
    assert.match(LEAGUE_BOARD, /rowRef=\{r\.is_me \? myRowRef : undefined\}/);
});

check("THE DOCK STOPS SHORT OF ACE'S CORNER", () => {
    // His launcher is fixed bottom-right; a full-width dock drew over him.
    const ace = read("src/components/ace/AceCompanion.jsx");
    assert.match(ace, /className="fixed right-4 md:right-6 bottom-24 md:bottom-6 z-40/,
        "the launcher moved, so the clearance below is measured against nothing");
    assert.match(ace, /<AceBody className="w-16 sm:w-20/);
    const px = (rem) => rem * 16;
    const launcher = { phone: px(1) + px(4), sm: px(1) + px(5), md: px(1.5) + px(5) };
    const bottom = DOCK.match(/bottom:\s*"([^"]+)"/)?.[1] || "";
    const phone = bottom.match(/(?:^|\s)right-\[(\d+(?:\.\d+)?)rem\]/);
    const sm = bottom.match(/sm:right-(\d+)\b/);
    assert.ok(phone && sm, `could not read the bottom dock's right offsets: "${bottom}"`);
    assert.ok(px(+phone[1]) > launcher.phone, "the phone dock runs under Ace");
    assert.ok(+sm[1] * 4 > launcher.sm && +sm[1] * 4 > launcher.md, "the desktop dock runs under Ace");
    assert.match(bottom, /bottom-\[5\.25rem\]\s+md:bottom-5/, "the dock drops under the bottom nav");
});

/* ── Rows race ───────────────────────────────────────────────────────────── */

check("a row is keyed by the PERSON and carries layout, so it races", () => {
    assert.match(ROW, /layout=\{reduce \? false : "position"\}/);
    assert.match(RANKED, /<LedgerRow key=\{r\.user_email\}/);
    assert.match(LEAGUE_BOARD, /<LedgerRow key=\{r\.display_name\}/);
    assert.match(GROUP, /<LedgerRow key=\{m\.id\}/);
    for (const [name, src] of Object.entries(BOARDS)) {
        assert.ok(!/<LedgerRow key=\{(i|idx|index|place|r\.position|m\.place)\b/.test(src),
            `${name} keys rows by place — a new name appears in the slot instead of a row moving`);
        assert.match(src, /<AnimatePresence mode="popLayout">/, `${name}'s leaving rows hold their place`);
    }
});

check("the avatar flies between the table and the ledger, and nothing clips it", () => {
    assert.match(PODIUM, /layoutId=\{reduce \? undefined : `\$\{layoutScope\}-av-\$\{entry\.key\}`\}/);
    assert.match(ROW, /layoutId=\{reduce \? undefined : `\$\{layoutScope\}-av-\$\{person\}`\}/);
    const felt = PODIUM.match(/className=\{`onb-felt[^`]*`\}/)?.[0] || "";
    assert.ok(felt, "the podium is not on the felt");
    assert.ok(!/overflow-hidden/.test(felt), "the felt clips an avatar flying onto it");
    assert.match(RANKED, /<div className="card-soft relative \[&>\*:first-child\]:border-t-0">/,
        "the ledger is clipped again — a person leaving the podium is cut off at its edge");
    // The podium and the ledger share one group, or their ids never meet.
    assert.match(RANKED, /<LayoutGroup id="ranked-board">/);
    assert.match(LEAGUE_PAGE, /<LayoutGroup id="league">[\s\S]*<Podium[\s\S]*<WeeklyBoard[\s\S]*<\/LayoutGroup>/);
});

/* ── Calm ────────────────────────────────────────────────────────────────── */

check("the table is held still, and only the Ace keeps moving", () => {
    assert.match(PODIUM, /onb-felt felt-still/);
    assert.match(CSS, /\.felt-still::after \{ content: none; \}/, "the felt's drifting light came back");
    assert.match(PODIUM, /\{first && entry && !reduce && \(\s*<span className="board-sheen"/,
        "the sheen is on a card that is not the Ace, or plays under reduced motion");
    const sheen = CSS.match(/\.board-sheen::before \{[\s\S]*?\}/)?.[0] || "";
    assert.match(sheen, /animation: board-sheen 9s/);
});

check("under reduced motion nothing is dealt, raced, counted or swept", () => {
    assert.match(PODIUM, /const deal = arriving && !reduce;/);
    assert.match(FIGURE, /if \(reduce \|\| kind\.current !== quantity\)/);
    const rm = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
    assert.match(rm, /\.board-sheen::before \{ animation: none/);
});

check("card stock is white in both themes, and easings are ones framer accepts", () => {
    assert.match(PODIUM, /className="absolute inset-0 theme-locked-light"/);
    const named = new Set(["linear", "easeIn", "easeOut", "easeInOut", "circIn", "circOut", "circInOut",
        "backIn", "backOut", "backInOut", "anticipate"]);
    for (const [f, src] of Object.entries({ PODIUM, ROW, DOCK, FIGURE, CHIP: strip(read("src/components/boards/MoveChip.jsx")) })) {
        for (const m of src.matchAll(/ease:\s*"([^"]+)"/g)) {
            assert.ok(named.has(m[1]), `${f} uses ease "${m[1]}", which framer throws on`);
        }
    }
});

/* ── Every board deals the same table ────────────────────────────────────── */

check("all three boards draw through the kit", () => {
    assert.match(RANKED, /<CardPodium\b/);
    assert.match(RANKED, /<MyRowDock\b/);
    assert.match(LEAGUE_PODIUM, /<CardPodium\b/);
    assert.match(LEAGUE_BOARD, /<LedgerRow\b/);
    assert.match(LEAGUE_BOARD, /<MyRowDock\b/);
    assert.match(GROUP, /<CardPodium\b/);
    assert.match(GROUP, /<LedgerRow\b/);
    for (const [name, src] of Object.entries({ ...BOARDS, Podium: LEAGUE_PODIUM })) {
        assert.ok(!/function (Avatar|MoveChip|Row)\b/.test(src), `${name} carries its own copy of a kit piece`);
    }
});

check("the league ledger starts under the table, and the payline sits between", () => {
    assert.match(LEAGUE_PAGE, /<WeeklyBoard rows=\{rows\} from=\{rows\.length > PODIUM \? PODIUM : 0\} \/>/,
        "the top three are drawn twice — on the table and again in the ledger");
    assert.match(LEAGUE_BOARD, /const payline = from >= PODIUM;/);
    // A board too small for a podium has no podium.
    assert.match(LEAGUE_PODIUM, /if \(rows\.length <= PODIUM\) return null;/);
});

console.log(`\n${passed} leaderboard checks passed`);
