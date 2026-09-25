/**
 * first-win assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/firstWin.test.mjs
 *
 * Two classes of failure here, and both are silent.
 *
 * ELIGIBILITY IS THE DANGEROUS ONE. There are ~130 existing accounts. A run
 * that fires for anyone "who has not seen it" ambushes every one of them on
 * their next login with a tutorial for an app they already use. The rule is
 * derived from the profile's own age rather than a flag needing a backfill,
 * and the failure is asymmetric: too generous ambushes everybody, too strict
 * costs one student a first run.
 *
 * THE CLOSE MUST NOT INVENT. It is very tempting to end on "+0.4 ATAR". A
 * brand-new account has no ATAR — it is a trailing-28-day composite, unranked
 * under three study days — so that number would be fiction on a student's
 * first screen, which teaches them the numbers here are decoration.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    PROBLEMS, BEATS, WINDOW_HOURS, GENERATE_PRICE, GENERATE_FEATURE,
    problemById, firstWinState, withFirstWinPatch, firstWinStatus,
    tourShouldWait, subjectChoices, canStart, closingFacts, droppedFrom,
} from "@/lib/firstWin";
import { PRICE } from "@/lib/chips";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const fresh = (extra = {}) => ({ created_date: hoursAgo(1), extra });
const old = (extra = {}) => ({ created_date: hoursAgo(WINDOW_HOURS + 1), extra });

/* ── Eligibility ──────────────────────────────────────────────────────── */

check("a brand-new account starts, an established one never does", () => {
    assert.equal(firstWinStatus(fresh()), "start");
    assert.equal(firstWinStatus(old()), null, "an existing account must never be ambushed");
});

check("an unknown profile age counts as OLD", () => {
    // Asymmetric on purpose: guessing "new" ambushes all ~130 accounts at once.
    assert.equal(firstWinStatus({ extra: {} }), null);
    assert.equal(firstWinStatus({ created_date: "not-a-date" }), null);
    assert.equal(firstWinStatus(null), null);
});

check("a run in progress resumes however old the account is", () => {
    // Somebody who started it and came back tomorrow should be able to finish.
    assert.equal(firstWinStatus(old({ first_win: { status: "active", beat: "quiz" } })), "resume");
});

check("done and skipped are both final, and skipped is never asked again", () => {
    assert.equal(firstWinStatus(fresh({ first_win: { status: "done" } })), null);
    assert.equal(firstWinStatus(fresh({ first_win: { status: "skipped" } })), null);
});

check("the tour waits while a first run is live, and only while", () => {
    // Both are Ace in the corner. Two of him talking over each other on
    // somebody's first screen is worse than either alone.
    assert.equal(tourShouldWait(fresh()), true, "a fresh account owes a first run");
    assert.equal(tourShouldWait(fresh({ first_win: { status: "active" } })), true);
    assert.equal(tourShouldWait(fresh({ first_win: { status: "done" } })), false, "then the map may run");
    assert.equal(tourShouldWait(fresh({ first_win: { status: "skipped" } })), false);
    assert.equal(tourShouldWait(old()), false, "an existing account owes neither");
});

/* ── State ────────────────────────────────────────────────────────────── */

check("unreadable state normalises rather than throwing", () => {
    for (const bad of [null, undefined, "nope", 7, []]) {
        const s = firstWinState({ extra: { first_win: bad } });
        assert.equal(s.status, "unstarted");
        assert.equal(s.beat, "subject");
    }
    assert.equal(firstWinState({ extra: { first_win: { beat: "not-a-beat" } } }).beat, "subject");
    assert.ok(BEATS.includes(firstWinState({ extra: { first_win: { beat: "quiz" } } }).beat));
});

check("a patch never disturbs its neighbours in `extra`", () => {
    // daily_intent, intent_log, ace_tour, attribution and year_level all live
    // in the same object. Overwriting `extra` would silently drop the lot.
    const profile = { extra: {
        daily_intent: { mode: "cramming" },
        ace_tour: { status: "done" },
        year_level: 12,
    } };
    const next = withFirstWinPatch(profile, { status: "active", beat: "problem" });
    assert.deepEqual(next.daily_intent, { mode: "cramming" });
    assert.deepEqual(next.ace_tour, { status: "done" });
    assert.equal(next.year_level, 12);
    assert.equal(next.first_win.status, "active");
    assert.equal(next.first_win.beat, "problem");
});

check("a profile with no extra at all still patches", () => {
    assert.equal(withFirstWinPatch({}, { status: "active" }).first_win.status, "active");
    assert.equal(withFirstWinPatch(null, { status: "active" }).first_win.status, "active");
});

/* ── The subject, which cannot be invented ────────────────────────────── */

check("only subjects the student actually studies are offered", () => {
    const picks = subjectChoices([
        { subject_name: "Chemistry", color: "#1CB0F6" },
        { subject_name: "  " },
        { subject_name: null },
        {},
    ]);
    assert.deepEqual(picks.map((p) => p.name), ["Chemistry"]);
    assert.equal(picks[0].color, "#1CB0F6");
});

check("no subjects means no first win — never a demo one", () => {
    // A quiz built on a subject they do not take is a fake artifact, and the
    // whole point of this run is that what it makes is real and stays.
    assert.equal(canStart([]), false);
    assert.equal(canStart(null), false);
    assert.equal(canStart([{ subject_name: "Methods" }]), true);
});

/* ── The problems, which teach the technique mapping ──────────────────── */

check("every problem names a technique the Study page really has", () => {
    // If the app recommends a technique and then opens somewhere else it is
    // arguing with itself one screen later — studyIntent.js's own rule.
    //
    // Read out of Study.jsx rather than restated here: its TECHNIQUES list is
    // a local const, and a copy of six ids in a test is a copy that rots.
    const study = fs.readFileSync(path.join(process.cwd(), "src/pages/Study.jsx"), "utf8");
    const block = study.slice(study.indexOf("const TECHNIQUES = ["));
    const list = block.slice(0, block.indexOf("\n];"));
    const known = new Set([...list.matchAll(/id:\s*"([a-z_]+)"/g)].map((m) => m[1]));
    assert.ok(known.size >= 4, `only found ${known.size} techniques in Study.jsx — has the list moved?`);
    for (const p of PROBLEMS) {
        assert.ok(known.has(p.technique),
            `"${p.id}" points at ${p.technique}, which the Study page does not have`);
    }
});

check("the problems are phrased as the student's words, not ours", () => {
    // "I read it, then it's gone" — not "spaced repetition". The technique is
    // the ANSWER; putting it in the question teaches nothing.
    for (const p of PROBLEMS) {
        assert.ok(p.label.length > 0 && p.answer.length > 0, `${p.id} is missing copy`);
        assert.ok(!p.label.toLowerCase().includes(p.technique.replace("_", " ")),
            `"${p.label}" names the technique in the question`);
    }
    assert.equal(problemById("slips")?.technique, "spaced_repetition");
    assert.equal(problemById("nope"), null);
});

/* ── The price, read rather than restated ─────────────────────────────── */

check("the generate price comes from the one price list", () => {
    // The price is on screen BEFORE the button — megaUpload's rule. A second
    // copy of the number is how the panel and the bill start disagreeing.
    assert.equal(GENERATE_PRICE, PRICE[GENERATE_FEATURE]);
    assert.ok(GENERATE_PRICE > 0);
});

/* ── The close, which may not invent ──────────────────────────────────── */

check("a clean sweep is never offered a mistake to bank", () => {
    const f = closingFacts({ score: 100, xp: 40, dropped: 0 });
    assert.equal(f.showMistakeBank, false, "there is no mistake, so there is nothing to save");
    assert.equal(f.dropped, 0);
});

check("a dropped mark is what unlocks the mistake bank", () => {
    assert.equal(closingFacts({ score: 55, xp: 12, dropped: 2 }).showMistakeBank, true);
});

check("nothing real means nothing claimed", () => {
    // An attempt whose marking never came back has no score and paid no XP.
    // Printing 0% and "+0 XP" at somebody would be a claim about their work.
    const f = closingFacts({});
    assert.equal(f.score, null);
    assert.equal(f.xp, null);
    assert.equal(f.dropped, 0);
    assert.equal(closingFacts({ score: null, xp: 0 }).xp, null, "0 XP is not a gain to report");
});

check("a dropped mark is counted off the marking, not inferred", () => {
    const attempt = { score: 60, extra: { question_results: [
        { criteria: [{ met: true }, { met: false }] },
        { criteria: [{ met: true }] },
        { criteria: [{ met: false }] },
    ] } };
    assert.equal(droppedFrom(attempt), 2, "two questions lost a criterion");
});

check("with no per-criterion verdicts it falls back to arithmetic, not a guess", () => {
    // A score under 100 means a mark is definitely gone — that is arithmetic.
    assert.equal(droppedFrom({ score: 70 }), 1);
    assert.equal(droppedFrom({ score: 100 }), 0, "a clean sweep dropped nothing");
    // And an attempt whose marking never came back tells us nothing at all.
    assert.equal(droppedFrom({ score: null }), 0, "no score is not 0%");
    assert.equal(droppedFrom({}), 0);
    assert.equal(droppedFrom(null), 0);
});

check("THE CLOSE NEVER QUOTES AN ATAR", () => {
    // A brand-new account has no ATAR: it is a trailing-28-day composite and
    // is unranked under three study days. "+0.4 ATAR" would be fiction on the
    // student's first screen.
    const line = closingFacts({ score: 80, xp: 30, dropped: 1 }).atarLine;
    assert.ok(!/[+-]?\d+(\.\d+)?\s*ATAR/i.test(line), `the close quotes an ATAR figure: "${line}"`);
    assert.match(line, /28 days/, "it should explain the window instead");
    assert.match(line, /unranked|3 separate days/i, "and say it has not started ranking yet");
});

/* ── The scan: no invented content anywhere in the run ────────────────── */

const ROOT = process.cwd();

check("the model states no ATAR figure of its own", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/firstWin.js"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.ok(!/[+-]\s?\d+(\.\d+)?\s*ATAR/i.test(code),
        "a hard-coded ATAR gain has appeared in firstWin.js");
});

console.log(`\nfirstWin: ${passed} checks passed`);
