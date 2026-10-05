/**
 * xpRates assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/xpRates.test.mjs
 *
 * ═══ A PUBLISHED RATE NOBODY CHECKS DRIFTS, AND THIS ONE DID ════════════════
 * "Where XP comes from" was hand-typed, and by the time anybody looked it was
 * wrong in four places and advertised two features the UI can no longer reach
 * — including, in the same component, a comment congratulating itself for
 * having removed a row for exactly that reason.
 *
 * Nothing could have caught it. The figures were strings in a .jsx; the
 * calculators are in `server.mjs`, which boots Express on load and therefore
 * cannot be imported into a test run. So this PARSES them out and RUNS them,
 * the `mirrors.test.mjs` idiom: it compares BEHAVIOUR rather than source, so a
 * reformat passes and a changed constant fails naming the row.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { XP_RATES, RETIRED_SOURCES, XP_FOOTNOTE, STREAK_MULT_MAX } from "@/lib/xpRates";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const SERVER = read("server.mjs");
const CARD = read("src/components/ranked/XPLevelCard.jsx");

/**
 * Lift the named top-level functions and the constants they close over out of
 * server.mjs and build them in one scope.
 *
 * A brace-depth walk from the `function` keyword, because these bodies contain
 * nested braces and object literals — a regex to the first `}` returns the
 * first line of each.
 */
function serverFns(names) {
    const consts = ["DIFF_MULT", "PRIORITY_MULT", "GOAL_DIFF_MULT", "TAB_AWAY_MINUTES",
        "STUDY_SESSION_XP_PER_MIN", "STUDY_SESSION_MAX_MINUTES"];
    const parts = [];

    for (const c of consts) {
        // `.*;` and not `.*;$` — several of these carry a trailing comment
        // ("// one sitting; longer is a data error"), which an anchored match
        // misses entirely and reports as the constant having been deleted.
        const m = new RegExp(`^const ${c} = [^\\n]*?;`, "m").exec(SERVER);
        assert.ok(m, `server.mjs no longer declares ${c}`);
        parts.push(m[0]);
    }
    for (const n of [...names, "countedFocusMinutes"]) {
        const at = SERVER.indexOf(`function ${n}(`);
        assert.ok(at > -1, `server.mjs no longer declares ${n}`);
        // COUNT FROM AFTER THE SIGNATURE. Several of these destructure their
        // argument — `function calcMiniTestXP({ score = 0, ... })` — so a walk
        // that starts at the `function` keyword opens on the PARAMETER brace
        // and closes the "body" at the end of the parameter list, lifting half
        // a function that will not parse.
        let i = SERVER.indexOf("(", at), parens = 0;
        for (; i < SERVER.length; i++) {
            if (SERVER[i] === "(") parens += 1;
            else if (SERVER[i] === ")") { parens -= 1; if (parens === 0) break; }
        }
        let depth = 0, end = at, started = false;
        for (; i < SERVER.length; i++) {
            const ch = SERVER[i];
            if (ch === "{") { depth += 1; started = true; }
            else if (ch === "}") { depth -= 1; if (started && depth === 0) { end = i + 1; break; } }
        }
        parts.push(SERVER.slice(at, end));
    }
    const all = [...new Set([...names, "countedFocusMinutes"])];
    return new Function(`${parts.join("\n")}\nreturn { ${all.join(", ")} };`)();
}

const NAMED = [...new Set(XP_RATES.flatMap((r) =>
    [r.check?.fn, r.also?.fn].filter(Boolean)))];
const fns = serverFns(NAMED);

// ─── 1. Every published figure comes back off the server's own function ────

check("EVERY RATE WITH ARITHMETIC MATCHES THE SERVER'S CALCULATOR", () => {
    for (const row of XP_RATES) {
        for (const c of [row.check, row.also]) {
            if (!c?.fn) continue;
            const got = fns[c.fn](...c.args);
            assert.equal(got, c.expect,
                `"${row.label}" publishes ${row.rate}, but ${c.fn}(${JSON.stringify(c.args)}) ` +
                `pays ${got}, not ${c.expect} — the table and the payout disagree, which is ` +
                `exactly how this got four figures wrong last time`);
        }
    }
});

check("the flashcard drip is 2 right / 1 wrong, read off awardXPIncremental", () => {
    // Not a function — a two-line branch inside the handler. Read as text, so
    // a change to either number fails here rather than on a student's screen.
    const at = SERVER.indexOf('type === "flashcard_card"');
    assert.ok(at > -1, "awardXPIncremental no longer handles flashcard_card");
    const branch = SERVER.slice(at, at + 160);
    assert.match(branch, /xp = metadata\.correct \? 2 : 1/,
        "the per-card payout changed and the published rate did not");
    const row = XP_RATES.find((r) => r.id === "flashcard");
    assert.match(row.rate, /2 XP a card/);
    assert.match(row.note, /\b1\b/, "the row no longer says what a missed card pays");
});

check("the streak multiplier ceiling is the server's own clamp", () => {
    assert.match(SERVER, /Math\.min\(2\.0, streak_multiplier/,
        "awardXP's clamp moved — the footnote's ceiling is now a number from nowhere");
    assert.equal(STREAK_MULT_MAX, 2.0);
    assert.ok(XP_FOOTNOTE.includes(`${STREAK_MULT_MAX}×`),
        "the footnote states a ceiling it did not get from the constant");
});

// ─── 2. Nothing unreachable is advertised ──────────────────────────────────

check("NO ROW ADVERTISES A FEATURE THE UI CANNOT REACH", () => {
    // Wagers and competitions both still settle in server.mjs — anything
    // mid-flight must — and neither has had a button since Compete became a
    // market board. A table that lists them is telling a student to go and
    // earn XP somewhere that does not exist, which is the whole reason this
    // file was written.
    for (const dead of RETIRED_SOURCES) {
        assert.ok(!XP_RATES.some((r) => r.id === dead),
            `"${dead}" is back on the table and there is no way to do it`);
    }
    const text = XP_RATES.map((r) => `${r.label} ${r.rate} ${r.note || ""}`).join(" ").toLowerCase();
    for (const word of ["wager", "bet", "competition", "challenge", "duel"]) {
        assert.ok(!text.includes(word),
            `the table mentions "${word}" — every one of those is unreachable from the UI`);
    }
});

check("every row that CAN state its arithmetic does", () => {
    // A range is unfalsifiable. Where the server's rule is a flat
    // multiplication the row has to print it, or a student has no way to check
    // the number that just landed — which is the only reason to publish a rate
    // table at all.
    for (const id of ["study", "flashcard", "quiz"]) {
        const row = XP_RATES.find((r) => r.id === id);
        assert.match(row.rate, /^\d+ XP a (minute|card|mark)$/,
            `"${row.label}" publishes "${row.rate}" — a range where the server has a flat rule`);
    }
});

check("THE LEAGUE BONUS IS DELIBERATELY NOT A FIGURE", () => {
    const row = XP_RATES.find((r) => r.id === "league");
    assert.ok(row, "the league row is gone — it is the one podium payout that is real");
    assert.ok(!/\d/.test(row.rate),
        "a figure was put on the league bonus. It is small ON PURPOSE because it feeds " +
        "level, rank AND the ATAR, and printing it invites the grinding it is sized to avoid");
});

// ─── 3. The card reads the module rather than restating it ─────────────────

check("XPLevelCard DERIVES the table, never retypes it", () => {
    assert.match(CARD, /from "@\/lib\/xpRates"/,
        "the profile card has its own copy of the rates again — a second copy is how the " +
        "first one drifted into being wrong for months with nothing to catch it");
    assert.ok(!/XP\/hr|XP\/card|up to 3\.5/.test(CARD),
        "a hand-typed rate string is back in the component");
});

// ─── 4. Every technique that logs a session is PAID for it ────────────────
//
// `awardXP` answers 400 for a source it does not recognise, and Study.jsx's
// handler console.errors the rejection — so a technique wired to a source the
// server has never heard of earns the student exactly nothing, silently, with
// lint and the build green. The same invisible class as the missing columns.
//
// MIND MAPS WERE WORSE THAN THAT: the component was never handed
// `onSessionComplete` at all, so there was no row, no minutes and no breadth
// family, and the server's own breadth comment recorded the fact for months.

const STUDY = read("src/pages/Study.jsx");

/** The `source` values the server's awardXP switch accepts. */
function serverSources() {
    const at = SERVER.indexOf("switch (source)");
    assert.ok(at > 0, "awardXP's source switch has moved — this check is now vacuous");
    const body = SERVER.slice(at, SERVER.indexOf("Unknown source", at));
    return new Set([...body.matchAll(/case "([a-z_]+)":/g)].map((m) => m[1]));
}

/** The technique → source map Study.jsx sends. */
function clientSources() {
    const at = STUDY.indexOf("const sourceMap = {");
    assert.ok(at > 0, "Study.jsx's sourceMap has moved — this check is now vacuous");
    const body = STUDY.slice(at, STUDY.indexOf("}", at));
    return Object.fromEntries(
        [...body.matchAll(/(\w+):\s*'([a-z_]+)'/g)].map((m) => [m[1], m[2]])
    );
}

check("every source Study.jsx sends is one the server ACCEPTS", () => {
    const accepted = serverSources();
    const sent = clientSources();
    assert.ok(Object.keys(sent).length >= 4, "the source map shrank — a technique stopped paying");
    for (const [technique, source] of Object.entries(sent)) {
        assert.ok(accepted.has(source),
            `${technique} sends source "${source}", which awardXP rejects with a 400 — ` +
            `the catch in handleSessionComplete swallows it and the student earns nothing`);
    }
});

check("MIND MAPS LOG A SESSION, which is what makes the time count at all", () => {
    // Not only XP. `studyEvents` reads `study_techniques`, so with no row the
    // minutes were missing from the dashboard's week panel, the ATAR's effort
    // and consistency, and the league's hours.
    assert.match(STUDY, /<MindMaps[\s\S]{0,200}onSessionComplete=\{handleSessionComplete\}/,
        "MindMaps is not handed onSessionComplete again — an hour on the canvas pays nothing");
    const sent = clientSources();
    assert.equal(sent.mind_map, "mind_map",
        "mind maps fold into study_session again, so `techniqueFamily` cannot see them " +
        "and the ATAR's breadth component stays one family short");

    const MAPS = read("src/components/study/MindMaps.jsx");
    assert.match(MAPS, /technique_name: "mind_map"/, "the session row names no technique");
    // THE CLOCK RESTARTS ON EACH CHECK, or a second gap check on one map pays
    // the whole sitting twice.
    assert.match(MAPS, /sessionStart\.current = Date\.now\(\);[\s\S]{0,200}onSessionComplete/,
        "the session clock is not restarted at the check — two checks pay one sitting twice");
    // And it is CLAMPED, because a canvas can sit open overnight and the
    // dashboard's week panel reads the raw figure.
    // ASSERTED ON THE CLAMP, NOT ON THE SYMBOL. The first draft matched
    // /SESSION_MAX_MINUTES/ anywhere in the file, which the IMPORT line
    // satisfies — so swapping the clamp for a literal passed. Verified by
    // putting exactly that back.
    assert.match(MAPS, /Math\.min\(\s*SESSION_MAX_MINUTES/,
        "the mind-map duration is unclamped — an overnight tab logs a day of study");
});

check("THE BREADTH TARGET DID NOT MOVE when a family became reachable", () => {
    // Raising it because mind maps now count would LOWER the breadth score of
    // every student on the site — a retroactive cut to the number the whole app
    // is standardised around, in exchange for nothing.
    const m = SERVER.match(/const BREADTH_TARGET_FAMILIES = (\d+);/);
    assert.ok(m, "BREADTH_TARGET_FAMILIES is gone");
    assert.equal(m[1], "5");
    assert.ok(!/mind maps emit no XP event/.test(SERVER),
        "the breadth comment still says mind maps are unreachable, which is now false — " +
        "a comment describing a fixed defect sends the next session to fix it again");
});

check("the published RATE names every technique it pays", () => {
    // The study row is what a student checks their own figure against. Leaving
    // a technique out of it is the same failure as a wrong figure: the table
    // is read as the whole answer.
    const row = XP_RATES.find((r) => r.id === "study");
    assert.ok(row, "the study row is gone");
    const sent = clientSources();
    const byMinute = Object.keys(sent).filter((t) => sent[t] !== "quiz");
    for (const technique of byMinute) {
        const word = technique.replace(/_/g, " ");
        assert.ok(row.note.toLowerCase().includes(word),
            `"${word}" pays by the minute and the published note does not mention it`);
    }
});

console.log(`\nxpRates: ${passed} checks passed`);
