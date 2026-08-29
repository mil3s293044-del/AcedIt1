/**
 * signup tour assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/aceTour.test.mjs
 *
 * The bug worth a test here is not a broken tour, it is a tour that fires for
 * the wrong people. There are ~130 existing accounts; one that opened for all
 * of them on their next login would be a worse day than no tour at all. So
 * eligibility gets most of the coverage, and the copy gets the rest — a tour
 * is almost entirely writing, and writing is what silently drifts.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    STOPS, CONTENT_STOPS, TOTAL_STOPS, TOUR_WINDOW_HOURS,
    stopAt, tourState, tourStatus, withTourPatch, profileAgeHours,
} from "@/lib/aceTour";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const NOW = Date.UTC(2026, 7, 29, 12, 0, 0);
const agedHours = (h, extra = {}) => ({
    id: "p1",
    created_date: new Date(NOW - h * 3_600_000).toISOString(),
    extra,
});

// ── Who sees it ─────────────────────────────────────────────────────────────

check("a brand-new account gets the tour", () => {
    assert.equal(tourStatus(agedHours(0.05), { now: NOW }), "start");
    assert.equal(tourStatus(agedHours(TOUR_WINDOW_HOURS - 1), { now: NOW }), "start");
});

check("an existing account is never ambushed by it", () => {
    // The 132 profiles the migration created carry that date. None of them
    // should ever see this, and nothing should be written to their row either.
    assert.equal(tourStatus(agedHours(TOUR_WINDOW_HOURS + 1), { now: NOW }), null);
    assert.equal(tourStatus(agedHours(24 * 120), { now: NOW }), null);
});

check("an unknown profile age counts as old", () => {
    // Wrong in the generous direction means ambushing every account at once;
    // wrong the other way means one student misses a tour.
    assert.equal(tourStatus({ id: "p1", extra: {} }, { now: NOW }), null);
    assert.equal(tourStatus({ id: "p1", created_date: "not a date" }, { now: NOW }), null);
    assert.equal(profileAgeHours({}), null);
    assert.equal(profileAgeHours(null), null);
});

check("no profile, no tour", () => {
    assert.equal(tourStatus(null), null);
    assert.equal(tourStatus(undefined), null);
});

check("a tour in progress resumes however old the account is", () => {
    const old = agedHours(24 * 400, { ace_tour: { status: "active", stop: 3 } });
    assert.equal(tourStatus(old, { now: NOW }), "resume");
    assert.equal(tourState(old).stop, 3);
});

check("finished and skipped both mean never again", () => {
    for (const status of ["done", "skipped"]) {
        assert.equal(tourStatus(agedHours(0.1, { ace_tour: { status } }), { now: NOW }), null,
            `${status} should not re-open`);
    }
});

check("a stored stop index cannot point off the end of the tour", () => {
    assert.equal(tourState({ extra: { ace_tour: { stop: 99 } } }).stop, STOPS.length - 1);
    assert.equal(tourState({ extra: { ace_tour: { stop: -4 } } }).stop, 0);
    assert.equal(tourState({ extra: { ace_tour: { stop: "two" } } }).stop, 0);
});

check("an unreadable profile normalises rather than throwing", () => {
    for (const p of [null, {}, { extra: null }, { extra: { ace_tour: "yes" } }]) {
        assert.equal(tourState(p).status, "unstarted");
        assert.equal(tourState(p).stop, 0);
    }
});

check("a patch keeps everything else living in extra", () => {
    const profile = {
        extra: {
            daily_intent: { mode: "cramming", date: "2026-08-28" },
            intent_log: [1, 2],
            year_level: 12,
            ace_tour: { status: "active", stop: 2, started_at: "t0" },
        },
    };
    const next = withTourPatch(profile, { stop: 3 });
    assert.deepEqual(next.daily_intent, profile.extra.daily_intent);
    assert.deepEqual(next.intent_log, [1, 2]);
    assert.equal(next.year_level, 12);
    assert.equal(next.ace_tour.stop, 3);
    assert.equal(next.ace_tour.started_at, "t0", "the rest of the tour record survived");
    assert.equal(profile.extra.ace_tour.stop, 2, "the input was not mutated");
});

// ── The stops ───────────────────────────────────────────────────────────────

check("every stop resolves to a page that is actually routed", () => {
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const config = strip(fs.readFileSync("src/pages.config.js", "utf8"));
    const m = config.match(/export const PAGES = \{([\s\S]*?)\n\}/);
    assert.ok(m, "PAGES object not found outside comments");
    const routes = [...m[1].matchAll(/"([A-Za-z0-9_]+)"\s*:/g)].map((x) => x[1]);
    for (let i = 0; i < TOTAL_STOPS; i += 1) {
        const s = stopAt(i);
        assert.ok(routes.includes(s.page), `${s.id}: /${s.page} is not a registered route`);
        assert.ok(s.route.startsWith("/"), `${s.id}: no route`);
        assert.ok(s.title, `${s.id}: no title — aceKnowledge has no PAGES entry for ${s.page}`);
    }
});

check("it opens and closes where a student already is", () => {
    assert.equal(stopAt(0).page, "Dashboard", "the first stop is the page they land on");
    const last = stopAt(TOTAL_STOPS - 1);
    assert.equal(last.final, true);
    assert.equal(last.page, "Dashboard", "and it hands them back somewhere they can act");
});

check("six stops teach something, and ids are unique", () => {
    assert.equal(CONTENT_STOPS, 6);
    const ids = STOPS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate stop id");
});

check("every stop has copy, and it stays in the app's voice", () => {
    for (const s of STOPS) {
        assert.ok(s.lead?.length > 20, `${s.id}: lead is missing or too thin to be worth a stop`);
        for (const banned of ["Don't", "don't", "Fix it", "No excuses", "Embarrassing"]) {
            assert.ok(!s.lead.includes(banned), `${s.id}: lead uses banned word "${banned}"`);
        }
    }
});

check("the tour points at a heading every one of its pages has", () => {
    // The tour deliberately anchors on `main h1` so no page needs an attribute
    // added for its benefit — but that only works while every page has one.
    for (const s of STOPS) {
        const file = `src/pages/${s.page}.jsx`;
        assert.ok(fs.existsSync(file), `${s.id}: ${file} does not exist`);
        assert.ok(fs.readFileSync(file, "utf8").includes("<h1"),
            `${s.id}: ${file} has no <h1> — Ace would have nothing to walk to`);
    }
});

console.log(`\n${passed} passed`);
