/**
 * slate assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/slate.test.mjs
 *
 * What this file holds, in the order a student would meet it going wrong:
 *
 *   NOBODY CAN BET AGAINST THEMSELVES. On a question your own study decides,
 *   the only call open to you is for yourself; on a card of names that
 *   includes yours, only your own row. Checked on the model AND on the server
 *   that enforces it, because a client rule is a suggestion.
 *
 *   NOTHING TRADES ON A VISIBLE ANSWER. Weekly questions lock at Friday's last
 *   call, early calls count for more, and the server refuses a call after it.
 *
 *   THE LADDER RANKS SKILL. Read points are the payout's own skill with the
 *   stake taken out — committing more cannot buy a division, and agreeing with
 *   the room earns exactly nothing.
 *
 *   THE SLATE IS A FEW CARDS, NOT A FLOOD. Answers group onto their card, the
 *   slate never counts against the floor's size, and it arrives in two drops.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    toTime, weekKeyUTC, weekLastCall, lastCallOf, isLocked, earlyWeight, EARLY_FLOOR,
    readPoints, READ_SCALE, seasonOf, seasonOfWeek, pointsWeek, SEASON_WEEKS,
    DIVISIONS, divisionOf, seasonAward, CREST_FROM, ORACLE_BACK,
    WAVES, wavesDue, waveOpensAt, isSlate, slateOf, slateProgress, slateTable, aheadOf,
    contenderPriors, FIELD_PRIOR, pacePrior, bracketsFrom, inBracket, BRACKET_MIN_WEEKS,
    subjectMinutes, subjectKey, sacSeasonGroups, SAC_SEASON_MIN, PREP_LAST_CALL_MS,
    slateResultsDue, markSlateResultsSeen,
} from "@/lib/slate";
import {
    selfRole, sideBlockReason, YES, NO, pickBoard, BOARD_TARGET, skill, featuredOf,
    payoutFor, groupPrices, withGroupPrices, priceOf, readMarket,
} from "@/lib/market";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const SERVER = strip(read("server.mjs"));

/** The body of a server route or function, by brace depth from its first `{`. */
function bodyOf(src, anchor) {
    const i = src.indexOf(anchor);
    if (i < 0) return "";
    let j = src.indexOf("{", src.indexOf(")", i));
    let depth = 0;
    for (let k = j; k < src.length; k++) {
        if (src[k] === "{") depth += 1;
        else if (src[k] === "}") { depth -= 1; if (depth === 0) return src.slice(j, k + 1); }
    }
    return "";
}

const MON = "2026-10-19";            // a Monday
const at = (iso) => Date.parse(iso);

// ─── No betting against yourself ────────────────────────────────────────────

check("a solo question about you: you may back yourself and may not fade", () => {
    const m = { kind: "streak", subject_email: "maya@x.com" };
    assert.deepEqual(selfRole(m, "Maya@X.com"), { about_me: true, own_outcome: true });
    assert.equal(sideBlockReason(m, YES, "maya@x.com"), null);
    assert.match(sideBlockReason(m, NO, "maya@x.com"), /against yourself/);
    for (const kind of ["hours", "quiz", "prep"]) {
        assert.ok(sideBlockReason({ kind, subject_email: "maya@x.com" }, NO, "maya@x.com"), kind);
    }
});

check("somebody else's question is open both ways", () => {
    const m = { kind: "streak", subject_email: "maya@x.com" };
    assert.equal(sideBlockReason(m, NO, "sam@x.com"), null);
    assert.equal(sideBlockReason(m, YES, "sam@x.com"), null);
    // A board-wide question is decided by everybody, so by nobody.
    assert.equal(sideBlockReason({ kind: "cohort", subject_email: "@board", meta: {} }, NO, "sam@x.com"), null);
});

check("a card of names: only your own row, and only for yourself", () => {
    const meta = { self_only: true, emails: ["maya@x.com", "sam@x.com"] };
    const maya = { kind: "cohort", subject_email: "maya@x.com", meta };
    const sam = { kind: "cohort", subject_email: "sam@x.com", meta };
    const field = { kind: "cohort", subject_email: "@board", meta };
    assert.equal(sideBlockReason(maya, YES, "maya@x.com"), null);
    assert.ok(sideBlockReason(maya, NO, "maya@x.com"));
    assert.match(sideBlockReason(sam, YES, "maya@x.com"), /only call you can make is on yourself/);
    assert.ok(sideBlockReason(field, YES, "maya@x.com"), "the field row is a rival winning");
    // Not on the card: everything open.
    assert.equal(sideBlockReason(sam, NO, "ava@x.com"), null);
});

check("the client reads the server's verdict, never re-derives it without the names", () => {
    // The payload has no `meta.emails`; it carries the flags the server computed.
    const shaped = { kind: "cohort", subject_email: null, meta: { self_only: true }, about_me: true, own_outcome: false };
    assert.deepEqual(selfRole(shaped, "maya@x.com"), { about_me: true, own_outcome: false });
    assert.ok(sideBlockReason(shaped, YES, "maya@x.com"));
});

check("the server enforces the side rule in takePosition, after the who-may-hold rule", () => {
    const tp = bodyOf(SERVER, 'app.post("/local-ai/fn/takePosition"');
    assert.ok(tp, "takePosition found");
    const who = tp.indexOf("marketBlockReason(");
    const side = tp.indexOf("marketSideBlock(");
    assert.ok(who > 0 && side > who, "the side check runs after the who check");
    assert.match(tp.slice(side, side + 200), /side === MKT_NO \? MKT_NO : MKT_YES|side/);
    assert.match(SERVER, /sideBlockReason as marketSideBlock/);
});

check("the payload carries about_me and own_outcome, computed from the raw row", () => {
    const gm = bodyOf(SERVER, 'app.post("/local-ai/fn/getMarkets"');
    assert.match(gm, /\.\.\.marketSelfRole\(m, user\.email\),\s*meta: publicMeta\(meta\)/,
        "the role is computed BEFORE meta is stripped of the names it reads");
});

// ─── Last call ──────────────────────────────────────────────────────────────

check("the week key is Monday UTC, the server's own", () => {
    assert.equal(weekKeyUTC(new Date("2026-10-19T00:00:00Z")), MON);
    assert.equal(weekKeyUTC(new Date("2026-10-25T23:59:59Z")), MON);
    assert.equal(weekKeyUTC(new Date("2026-10-26T00:00:00Z")), "2026-10-26");
    assert.match(SERVER, /const marketWeekKey = weekKeyUTC|marketWeekKey = \(d = new Date\(\)\) => weekKeyUTC\(d\)/);
});

check("last call is Friday evening in Melbourne, before the week resolves", () => {
    const lc = weekLastCall(MON);
    assert.equal(new Date(lc).toISOString(), "2026-10-23T08:00:00.000Z");
    const m = { kind: "hours", status: "open", meta: { period: MON }, closes_at: "2026-10-25T23:59:59Z" };
    assert.equal(lastCallOf(m), lc);
    assert.equal(isLocked(m, at("2026-10-23T07:59:00Z")), false);
    assert.equal(isLocked(m, at("2026-10-23T08:00:00Z")), true);
    assert.equal(isLocked({ ...m, status: "resolved" }, at("2026-10-24T00:00:00Z")), false);
});

check("an explicit last call wins, and never runs past the close", () => {
    const m = { kind: "cohort", status: "open", meta: { period: MON, last_call: "2026-10-22T08:00:00Z" },
        closes_at: "2026-10-25T23:59:59Z" };
    assert.equal(lastCallOf(m), at("2026-10-22T08:00:00Z"));
    const late = { ...m, meta: { last_call: "2026-11-30T00:00:00Z" } };
    assert.equal(lastCallOf(late), at("2026-10-25T23:59:59Z"));
});

check("prep locks two days short; a SAC locks at its own close", () => {
    const prep = { kind: "prep", status: "open", meta: {}, closes_at: "2026-10-30T00:00:00Z" };
    assert.equal(lastCallOf(prep), at("2026-10-30T00:00:00Z") - PREP_LAST_CALL_MS);
    const sac = { kind: "sac", status: "open", meta: {}, closes_at: "2026-10-30T00:00:00Z" };
    assert.equal(lastCallOf(sac), at("2026-10-30T00:00:00Z"));
});

check("a missing time is NULL, never 1970", () => {
    assert.equal(toTime(null), null);
    assert.equal(toTime(undefined), null);
    assert.equal(toTime(""), null);
    assert.equal(lastCallOf({ kind: "callout", meta: {}, closes_at: null }), null);
    assert.equal(isLocked({ kind: "callout", status: "open", meta: {} }), false);
});

check("the server refuses a call after last call, with the same function", () => {
    const tp = bodyOf(SERVER, 'app.post("/local-ai/fn/takePosition"');
    assert.match(tp, /marketLastCall\(market\)/);
    assert.match(SERVER, /lastCallOf as marketLastCall/);
});

// ─── Early calls ────────────────────────────────────────────────────────────

check("early weight runs 1 → EARLY_FLOOR across the window, and an unknown is 1", () => {
    const o = at("2026-10-19T00:00:00Z");
    const l = at("2026-10-23T08:00:00Z");
    assert.equal(earlyWeight(o, o, l), 1);
    assert.equal(earlyWeight(l, o, l), EARLY_FLOOR);
    const mid = earlyWeight((o + l) / 2, o, l);
    assert.ok(Math.abs(mid - (1 + EARLY_FLOOR) / 2) < 1e-9);
    assert.equal(earlyWeight(null, o, l), 1);
    assert.equal(earlyWeight(o, null, l), 1);
    assert.equal(earlyWeight(o + 1000, o, null), 1);
    // Past last call (a call cannot be, but a clock can be off) clamps.
    assert.equal(earlyWeight(l + 1e7, o, l), EARLY_FLOOR);
});

// ─── Read points ────────────────────────────────────────────────────────────

const settled = (outcome, extra = {}) => ({
    kind: "cohort", status: "resolved", outcome,
    created_date: "2026-10-19T00:00:00Z", meta: { period: MON }, closes_at: "2026-10-25T23:59:59Z", ...extra,
});

check("read points are the payout's skill without the stake", () => {
    const m = settled(true);
    const pos = { p: 0.85, price_at_entry: 0.6, created_date: "2026-10-19T00:00:00Z", stake: 500 };
    assert.equal(readPoints(pos, m), Math.round(READ_SCALE * skill(0.85, 0.6, true)));
    // The same call at ten times the stake earns the same points.
    assert.equal(readPoints({ ...pos, stake: 10 }, m), readPoints(pos, m));
    // Agreeing with the room is worth nothing.
    assert.equal(readPoints({ ...pos, p: 0.6 }, m), 0);
    // A wrong call costs.
    assert.ok(readPoints(pos, settled(false)) < 0);
});

check("a later call earns fewer points for the same read", () => {
    const m = settled(true);
    const early = readPoints({ p: 0.85, price_at_entry: 0.6, created_date: "2026-10-19T01:00:00Z" }, m);
    const late = readPoints({ p: 0.85, price_at_entry: 0.6, created_date: "2026-10-23T07:00:00Z" }, m);
    assert.ok(early > late && late > 0);
});

check("a void is worth zero; an open market is NULL, never zero", () => {
    assert.equal(readPoints({ p: 0.9, price_at_entry: 0.5 }, { status: "void" }), 0);
    assert.equal(readPoints({ p: 0.9, price_at_entry: 0.5 }, { status: "open", outcome: null }), null);
    assert.equal(readPoints({ p: null, price_at_entry: 0.5 }, settled(true)), null);
    assert.equal(readPoints({ p: 0.9, price_at_entry: null }, settled(true)), null);
});

check("points and payout always agree in sign", () => {
    for (let p = 0.03; p <= 0.97; p += 0.06) {
        for (let price = 0.05; price <= 0.95; price += 0.1) {
            for (const outcome of [true, false]) {
                const pts = readPoints({ p, price_at_entry: price }, settled(outcome));
                const pay = payoutFor(500, p, price, outcome);
                if (pts !== 0 && pay !== 0) assert.equal(Math.sign(pts), Math.sign(pay), `${p} ${price} ${outcome}`);
            }
        }
    }
});

// ─── Seasons and divisions ──────────────────────────────────────────────────

check("seasons are four weeks counted from a Monday", () => {
    const s = seasonOf(new Date("2026-10-19T03:00:00Z"));
    assert.equal(s.weeks.length, SEASON_WEEKS);
    assert.equal(s.week, 2);
    assert.equal(s.start, "2026-10-12");
    assert.equal(seasonOf(new Date("2026-10-12T00:00:00Z")).index, s.index);
    assert.equal(seasonOf(new Date("2026-11-08T23:00:00Z")).index, s.index);
    assert.equal(seasonOf(new Date("2026-11-09T00:00:00Z")).index, s.index + 1);
    assert.equal(seasonOfWeek(MON).index, s.index);
    assert.equal(seasonOfWeek("not a week"), null);
});

check("a call counts toward its question's week, not the week it settled", () => {
    assert.equal(pointsWeek({ meta: { period: "2026-11-02" }, resolved_at: "2026-11-09T09:00:00Z" }), "2026-11-02");
    assert.equal(pointsWeek({ meta: {}, resolved_at: "2026-11-11T09:00:00Z" }), "2026-11-09");
    assert.equal(pointsWeek({ meta: {}, resolved_at: null }), null);
});

check("divisions climb with points, and the Ace is earned", () => {
    const ids = DIVISIONS.map((d) => d.id);
    assert.deepEqual(ids, ["rookie", "scout", "analyst", "strategist", "oracle"]);
    for (let i = 1; i < DIVISIONS.length; i++) assert.ok(DIVISIONS[i].min > DIVISIONS[i - 1].min);
    assert.equal(DIVISIONS[DIVISIONS.length - 1].rank, "A");
    assert.equal(DIVISIONS[0].min, 0);
    assert.equal(divisionOf(-40).id, "rookie");
    assert.equal(divisionOf(-40).progress, 0);
    assert.equal(divisionOf(null).points, 0, "a missing total is no points, not NaN");
    assert.equal(divisionOf(DIVISIONS[2].min).id, "analyst");
    assert.equal(divisionOf(DIVISIONS[2].min - 1).id, "scout");
    assert.equal(divisionOf(10_000).next, null);
    assert.equal(divisionOf(10_000).progress, 1);
});

check("the division names are a forecaster's, not a gambler's", () => {
    const text = DIVISIONS.map((d) => d.label).join(" ");
    assert.doesNotMatch(text, /shark|whale|roller|jackpot|bet|punter|gambl/i);
});

check("a season earns a crest from Analyst, and the Oracle back only at the top", () => {
    assert.equal(seasonAward(DIVISIONS[1].min), null);
    assert.equal(seasonAward(DIVISIONS[2].min).division, CREST_FROM);
    assert.equal(seasonAward(DIVISIONS[2].min).back, null);
    assert.equal(seasonAward(DIVISIONS[4].min).back, ORACLE_BACK);
});

check("the Oracle back is earned only: not in the store's catalogue", () => {
    const store = read("src/lib/credStore.js");
    assert.doesNotMatch(strip(store), new RegExp(`id:\\s*["']${ORACLE_BACK}["']`));
});

// ─── Drops ──────────────────────────────────────────────────────────────────

check("two drops: Monday, then Wednesday, and nothing after last call", () => {
    assert.deepEqual(WAVES.map((w) => w.id), [1, 2]);
    assert.deepEqual(wavesDue(at("2026-10-19T05:00:00Z"), MON), [1]);
    assert.deepEqual(wavesDue(at("2026-10-21T00:00:00Z"), MON), [1, 2]);
    assert.deepEqual(wavesDue(at("2026-10-23T09:00:00Z"), MON), []);
    assert.equal(new Date(waveOpensAt(MON, 2)).toISOString(), "2026-10-21T00:00:00.000Z");
    assert.equal(waveOpensAt(MON, 9), null);
});

// ─── The slate as cards ─────────────────────────────────────────────────────

const row = (id, meta, extra = {}) => ({ id, title: id, meta: { slate: true, ...meta }, ...extra });

check("answers group onto one card, in their own order; singles stand alone", () => {
    const rows = [
        row("b", { group: "g1", group_title: "Who tops?", wave: 1, order: 1, outcome_order: 2 }),
        row("a", { group: "g1", group_title: "Who tops?", wave: 1, order: 1, outcome_order: 1 }),
        row("pace", { wave: 2, order: 0 }),
        row("half", { wave: 1, order: 5 }),
        { id: "floor", title: "floor", meta: {} },
    ];
    const slate = slateOf(rows);
    assert.deepEqual(slate.map((e) => e.id), ["g1", "half", "pace"]);
    assert.deepEqual(slate[0].rows.map((r) => r.id), ["a", "b"]);
    assert.equal(slate[0].title, "Who tops?");
    assert.equal(slate[0].kind, "group");
    assert.ok(!slate.some((e) => e.id === "floor"));
    assert.equal(isSlate(rows[4]), false);
});

check("a card counts once toward what you've called, whichever answer", () => {
    const slate = slateOf([
        row("a", { group: "g", outcome_order: 1 }, { mine: { p: 0.7 } }),
        row("b", { group: "g", outcome_order: 2 }),
        row("c", {}),
    ]);
    assert.deepEqual(slateProgress(slate), { called: 1, total: 2, done: false });
    // Two answers called on one card is still ONE card called.
    const both = slateOf([
        row("a", { group: "g", outcome_order: 1 }, { mine: { p: 0.7 } }),
        row("b", { group: "g", outcome_order: 2 }, { mine: { p: 0.2 } }),
        row("c", {}),
    ]);
    assert.deepEqual(slateProgress(both), { called: 1, total: 2, done: false });
});

check("the slate never counts against the floor's size, and always makes it", () => {
    const slate = Array.from({ length: 30 }, (_, i) => ({ kind: "cohort", prior: 0.5, meta: { slate: true }, id: `s${i}` }));
    const people = Array.from({ length: 30 }, (_, i) => ({ kind: "hours", prior: 0.5, subject_email: `p${i}@x`, meta: {} }));
    const picked = pickBoard([...slate, ...people], { weekKey: MON, existing: 0 });
    assert.equal(picked.filter((m) => m.meta?.slate).length, 30);
    assert.equal(picked.filter((m) => !m.meta?.slate).length, BOARD_TARGET);
});

check("a slate question is never also a featured floor card", () => {
    const m = { id: "x", kind: "cohort", status: "open", meta: { slate: true }, subject_email: "@board" };
    const n = { id: "y", kind: "cohort", status: "open", meta: {}, subject_email: "@board" };
    const o = { id: "z", kind: "longshot", status: "open", meta: {}, subject_email: "@board" };
    const f = featuredOf([m, n, o], "me@x");
    assert.ok(!f.some((c) => c.id === "x"));
});

// ─── The week's table ───────────────────────────────────────────────────────

check("the slate table sums points per person and breaks ties on calls", () => {
    const t = slateTable([
        { email: "a@x", name: "Ava", points: 10 }, { email: "A@x", points: 5 },
        { email: "b@x", name: "Ben", points: 15 },
        { email: "c@x", name: "Cy", points: 8 }, { email: "c@x", points: 7 },
        { email: "d@x", name: "Di", points: null },
    ]);
    assert.deepEqual(t.map((r) => r.name), ["Ava", "Cy", "Ben"]);
    assert.equal(t[0].calls, 2);
    assert.ok(!t.some((r) => r.name === "Di"), "an unsettled call is not a zero");
});

check("standing is a band with ties at half, and NULL with nobody to beat", () => {
    assert.equal(aheadOf(10, [5, 10, 20, 1]), Math.round((2.5 / 4) * 100));
    assert.equal(aheadOf(10, []), null);
    assert.equal(aheadOf(null, [1, 2]), null);
    assert.equal(aheadOf(3, [null, undefined, 1]), 100);
});

// ─── Priors ─────────────────────────────────────────────────────────────────

check("contenders open in proportion to last week, the field keeps a real share", () => {
    const { contenders, field } = contenderPriors([
        { email: "a", score: 600 }, { email: "b", score: 300 }, { email: "c", score: 100 },
    ]);
    assert.equal(field, FIELD_PRIOR);
    assert.ok(contenders[0].prior > contenders[1].prior && contenders[1].prior > contenders[2].prior);
    for (const c of contenders) assert.ok(c.prior >= 0.05 && c.prior <= 0.6);
    const flat = contenderPriors([{ email: "a", score: 0 }, { email: "b", score: 0 }]);
    assert.ok(Math.abs(flat.contenders[0].prior - (1 - FIELD_PRIOR) / 2) < 1e-9);
});

check("pace leans with the data and never to a verdict", () => {
    assert.equal(pacePrior(100, 100), 0.5);
    assert.ok(pacePrior(150, 100) > 0.5);
    assert.ok(pacePrior(50, 100) < 0.5);
    assert.ok(pacePrior(10_000, 1) <= 0.85 && pacePrior(0, 1000) >= 0.15);
    assert.equal(pacePrior(100, 0), 0.5);
    assert.equal(pacePrior(null, 100), 0.5, "unknown is not zero minutes");
});

check("brackets cut the room's own history into four, or refuse", () => {
    assert.equal(bracketsFrom([600, 1200, 1800]), null, `needs ${BRACKET_MIN_WEEKS} weeks`);
    const b = bracketsFrom([1800, 2400, 3000, 3600, 4200, 4800, 5400, 6000]);
    assert.equal(b.length, 4);
    assert.equal(b[0].lo, 0);
    assert.equal(b[3].hi, null);
    for (let i = 1; i < 4; i++) assert.equal(b[i].lo, b[i - 1].hi);
    const sum = b.reduce((s, x) => s + x.prior, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, "the brackets cover every outcome once");
    assert.ok(inBracket(0, b[0]) && inBracket(b[1].lo, b[1]) && !inBracket(b[1].lo, b[0]));
    assert.ok(inBracket(1e9, b[3]));
    // Cuts that round onto the same hour collapse, and a collapse is a refusal.
    assert.equal(bracketsFrom([600, 610, 620, 630, 640]), null);
});

check("subject minutes share a capped day, so a subject cannot be padded past it", () => {
    const rows = [
        { email: "a", day: "2026-10-19", subject: "Chemistry", minutes: 600 },
        { email: "a", day: "2026-10-19", subject: "chemistry ", minutes: 200 },
        { email: "a", day: "2026-10-19", subject: "Methods", minutes: 200 },
        { email: "b", day: "2026-10-19", subject: "Methods", minutes: 60 },
        { email: "b", day: "2026-10-19", subject: "", minutes: 60 },
    ];
    const capAt = 300;
    const countable = (list) => Math.min(capAt, list.reduce((s, r) => s + r.minutes, 0));
    const by = subjectMinutes(rows, countable);
    assert.equal(by.get("chemistry").minutes, 240);
    assert.equal(by.get("chemistry").label, "Chemistry");
    assert.equal(by.get("methods").minutes, 60 + 60);
    const total = [...by.values()].reduce((s, x) => s + x.minutes, 0);
    assert.ok(total <= capAt + 60);
    assert.equal(subjectKey("  Maths   Methods "), "maths methods");
});

check("SAC season asks only about a class, never a handful of people", () => {
    const a = (email, subject) => ({ created_by: email, subject_name: subject });
    const groups = sacSeasonGroups([
        a("1@x", "Methods"), a("2@x", "methods"), a("3@x", "Methods"), a("4@x", "Methods"), a("4@x", "Methods"),
        a("1@x", "Legal"), a("2@x", "Legal"), a("3@x", "Legal"),
    ]);
    assert.deepEqual(groups.map((g) => g.label), ["Methods"]);
    assert.equal(groups[0].emails.length, SAC_SEASON_MIN);
});

// ─── The server's slate ─────────────────────────────────────────────────────

check("the server mints the slate in drops and marks it", () => {
    const mint = bodyOf(SERVER, "async function mintSlate(");
    assert.ok(mint, "mintSlate exists");
    assert.match(mint, /slateWavesDue\(/);
    assert.match(mint, /slate: true/);
    assert.match(mint, /last_call/);
    assert.match(SERVER, /await mintSlate\(/);
});

check("a card of names marks its rows self_only, with the names kept private", () => {
    const mint = bodyOf(SERVER, "async function mintSlate(");
    // EVERY League row is self_only — a card of names, the holder and the
    // Wednesday leader — so the count of the one equals the count of the other.
    const leagueRows = (mint.match(/metric: "league_(top|hold|lead)"/g) || []).length;
    const selfOnly = (mint.match(/self_only: true/g) || []).length;
    assert.ok(leagueRows >= 4, `found ${leagueRows} League rows`);
    assert.equal(selfOnly, leagueRows, "a League row without self_only lets a contender fade themselves");
    // `emails` is stripped by publicMeta; the rule depends on it never reaching a card.
    assert.match(SERVER, /PRIVATE_META = new Set\(\[[^\]]*"emails"/);
});

check("the slate never names somebody who may not be a market subject", () => {
    const mint = bodyOf(SERVER, "async function mintSlate(");
    // Both halves, by shape: who may be named at all, and the contenders
    // drawn only from them. `members` arrives through mayBeMarketSubject.
    assert.match(mint, /return m && !m\.anonymous \? m : null;/);
    assert.match(mint, /table\.filter\(\(t\) => !t\.anonymous && eligible\(t\.email\)\)/);
    assert.match(mint, /lead && lead\.score > 0 && !lead\.anonymous/);
    assert.match(SERVER, /\.filter\(\(m\) => m\.email && mayBeMarketSubject\(m\)\)/);
});

check("the season and last week's slate ride on the board payload", () => {
    const gm = bodyOf(SERVER, 'app.post("/local-ai/fn/getMarkets"');
    assert.match(gm, /season = \{/);
    assert.match(gm, /seasonStanding\(user\.email, current\)/);
    assert.match(gm, /slate_results: slateResults/);
});


// ─── A card of answers is one market ────────────────────────────────────────

const card = (positions = {}) => ["a", "b", "c", "f"].map((id, i) => ({
    id, prior: [0.33, 0.2, 0.12, 0.35][i], positions: positions[id] || [],
}));
const total = (m) => [...m.values()].reduce((x, y) => x + y, 0);

check("a card's answers always add to 100%, called or not", () => {
    assert.ok(Math.abs(total(groupPrices(card())) - 1) < 1e-9);
    const busy = groupPrices(card({
        a: [{ p: 0.8, stake: 250 }, { p: 0.7, stake: 100 }],
        b: [{ p: 0.3, stake: 50 }],
        f: [{ p: 0.6, stake: 500 }],
    }));
    assert.ok(Math.abs(total(busy) - 1) < 1e-9, `sums to ${total(busy)}`);
    // Priors that do not add to one are read as shares, not as prices.
    const loose = groupPrices([{ id: "x", prior: 0.9, positions: [] }, { id: "y", prior: 0.9, positions: [] }]);
    assert.ok(Math.abs(loose.get("x") - 0.5) < 1e-9);
});

check("calling one answer up pulls every other answer down", () => {
    const before = groupPrices(card());
    const after = groupPrices(card({ a: [{ p: 0.85, stake: 300 }] }));
    assert.ok(after.get("a") > before.get("a"));
    for (const id of ["b", "c", "f"]) assert.ok(after.get(id) < before.get(id), id);
    // The rest move IN PROPORTION: a call on Priyanka says nothing about
    // Miles against Sam, so their ratio is the one it opened at.
    const ratio = (m) => m.get("b") / m.get("c");
    assert.ok(Math.abs(ratio(after) - ratio(before)) < 1e-9, "the others keep their shape");
    // A call AGAINST an answer moves it down and the rest up.
    const against = groupPrices(card({ a: [{ p: 0.05, stake: 300 }] }));
    assert.ok(against.get("a") < before.get("a"));
    assert.ok(against.get("b") > before.get("b"));
});

check("the board prices a card as a card; a lone question is untouched", () => {
    const rows = [
        readMarket({ id: "a", prior: 0.5, meta: { group: "g" } }, [{ p: 0.9, stake: 400, user_email: "x@x" }]),
        readMarket({ id: "b", prior: 0.5, meta: { group: "g" } }, []),
        readMarket({ id: "solo", prior: 0.4, meta: {} }, [{ p: 0.9, stake: 100, user_email: "x@x" }]),
    ];
    const priced = withGroupPrices(rows);
    assert.ok(Math.abs(priced[0].price + priced[1].price - 1) < 1e-9);
    assert.equal(priced[2].price, priceOf(rows[2], rows[2].positions));
    assert.equal(priced[2], rows[2], "an ungrouped row passes through as itself");
    assert.equal(priced[0].priceLabel, `${Math.round(priced[0].price * 100)}%`);
});

check("a grouped row arriving with the card's price keeps it", () => {
    const m = readMarket({ id: "a", prior: 0.5, group_price: 0.27, meta: { group: "g" } }, [{ p: 0.9, stake: 400 }]);
    assert.equal(m.price, 0.27);
    const lone = readMarket({ id: "a", prior: 0.5, group_price: null, meta: {} }, []);
    assert.equal(lone.price, 0.5, "a null is no figure, never 0%");
});

check("the floor, the server and the single page all price a card together", () => {
    const comp = strip(read("src/pages/Competitions.jsx"));
    assert.match(comp, /sortBoard\(withGroupPrices\(rows\)/);
    const tp = bodyOf(SERVER, 'app.post("/local-ai/fn/takePosition"');
    assert.match(tp, /groupPrices\(card\)\.get\(market\.id\)/, "the call is scored against the card's price");
    const gm = bodyOf(SERVER, 'app.post("/local-ai/fn/getMarket"');
    assert.match(gm, /group_price: groupPrice/);
    const ev = strip(read("src/components/market/EventCard.jsx"));
    assert.match(ev, /priceAfter=\{\(call\) => groupPrices\(/, "the preview moves the whole card");
});

// ─── No odds, no stakes on show ─────────────────────────────────────────────

const FLOOR_UI = [
    "src/components/market/MarketCard.jsx", "src/components/market/PriceBar.jsx",
    "src/components/market/TakeSide.jsx", "src/components/market/PriceChart.jsx",
    "src/components/market/EventCard.jsx", "src/components/market/SlateSection.jsx",
    "src/components/market/SlateResults.jsx", "src/components/market/Ticker.jsx",
    "src/components/market/SeasonStrip.jsx", "src/pages/Competitions.jsx", "src/pages/Market.jsx",
];

check("no return multiple is printed anywhere on the floor", () => {
    for (const f of FLOOR_UI) {
        const src = strip(read(f));
        assert.doesNotMatch(src, /multiplierLabel\(|bestReturn\(|returnMultiple\(|\breturns\(/, f);
        assert.doesNotMatch(src.replace(/className="[^"]*"/g, ""), /×/, `${f} prints a ×`);
    }
});

check("no pool figure and no amounts on the tape, the ticker or the chart", () => {
    const comp = strip(read("src/pages/Competitions.jsx"));
    const tape = comp.slice(comp.indexOf("function buildTape"), comp.indexOf("function Tape("));
    assert.doesNotMatch(tape, /stake:/, "the tape row carries no amount");
    const card = strip(read("src/components/market/MarketCard.jsx"));
    assert.doesNotMatch(card, /volume\.toLocaleString\(\)\}\s*in\b/, "no '300 in'");
    const chart = strip(read("src/components/market/PriceChart.jsx"));
    assert.doesNotMatch(chart, /shown\.stake/, "the chart readout names the call, not its cost");
    const ticker = strip(read("src/components/market/Ticker.jsx"));
    assert.doesNotMatch(ticker, /\.stake/);
});

check("the betting words are gone from what the floor prints", () => {
    for (const f of FLOOR_UI) {
        const text = [...strip(read(f)).matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join(" ")
            + [...strip(read(f)).matchAll(/"([^"]{6,})"/g)].filter((m) => !/[-:\[\]/]|^\w+$/.test(m[1]) || / /.test(m[1]))
                .map((m) => m[1]).join(" ");
        assert.doesNotMatch(text, /\bTake a side\b|\bAt stake\b|\bbacked (YES|NO)\b|\bodds\b|\bbet\b|\bwager|\bpot\b/i, f);
        assert.doesNotMatch(text, />?\s*Cred\s*</, f);
    }
});

// ─── The Sunday results, and the per-market reveal staying out of them ──────

check("results are owed once per week, and never while the slate is settling", () => {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
    };
    const r = { week: "2026-10-12", pending: false, cards: [{ id: "a" }] };
    assert.equal(slateResultsDue(r), true);
    assert.equal(slateResultsDue({ ...r, pending: true }), false);
    assert.equal(slateResultsDue({ ...r, cards: [] }), false);
    assert.equal(slateResultsDue(null), false);
    markSlateResultsSeen(r.week);
    assert.equal(slateResultsDue(r), false);
    assert.equal(slateResultsDue({ ...r, week: "2026-10-19" }), true);
    // Blocked storage counts as seen: replaying a results screen on every load
    // is worse than never showing it.
    globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    assert.equal(slateResultsDue({ ...r, week: "2026-11-02" }), false);
    delete globalThis.localStorage;
    assert.equal(slateResultsDue({ ...r, week: "2026-11-09" }), false, "no storage at all is not a replay loop");
});

check("the slate settles as ONE result, not eleven settlement cards", () => {
    const comp = strip(read("src/pages/Competitions.jsx"));
    assert.match(comp, /unseenSettlements\(settledBoard\.filter\(\(m\) => !isSlate\(m\)\)/);
    assert.match(comp, /slateResultsDue\(data\?\.slate_results\)/);
    const res = strip(read("src/components/market/SlateResults.jsx"));
    assert.match(res, /onSeen\?\.\(results\?\.week\)/, "marked seen on arrival");
});

check("a stamp and a pulse never announce a reload as news", () => {
    const card = strip(read("src/components/market/MarketCard.jsx"));
    const hook = card.slice(card.indexOf("export function useJustCalled"), card.indexOf("export function CallStamp"));
    assert.match(hook, /useRef\(call \?/, "the first paint seeds what was already there");
    assert.match(hook, /if \(id && !had\.current\)/);
    const bar = strip(read("src/components/market/PriceBar.jsx"));
    assert.match(bar, /if \(prev\.current !== value/);
    const css = read("src/index.css");
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.floor-ticker-run \{ animation: none; \}/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.floor-price-pulse/);
});

// ─── The card back in the dark ──────────────────────────────────────────────

check("the dark card back lifts the derived back only, never a skin", () => {
    const pc = strip(read("src/components/cards/PlayingCard.jsx"));
    assert.match(pc, /const derived = !skin && !inkProp && !softProp;/);
    assert.match(pc, /derived \? `card-back/);
    const css = read("src/index.css");
    const dark = css.slice(css.indexOf(".dark .card-back {"), css.indexOf("}", css.indexOf(".dark .card-back {")));
    assert.match(dark, /--back-fill: var\(--back-soft-d\)/);
    assert.match(dark, /--back-weave: 0\.9/);
    assert.match(css, /\.dark \.theme-locked-light \.card-back,/, "white stock stays white");
});

console.log(`\n${passed} slate checks passed`);
