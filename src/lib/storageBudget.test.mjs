/**
 * storage budget assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/storageBudget.test.mjs
 *
 * ONE RULE, and everything here exists to hold it: A GENERATE NEVER FAILS
 * BECAUSE OF STORAGE. Supabase's free plan 402s EVERY service once the
 * organisation is over quota past its grace period, so a bucket filling up
 * does not break uploads — it breaks the whole app, for students who never
 * uploaded anything.
 *
 * So the order of yielding is the design, and it is asserted rather than
 * described: sweep, then books refuse, then ordinary uploads stop being
 * PERSISTED while still working, and nothing ever reaches the cliff.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    FREE_STORAGE_BYTES, MEGA_BUCKET_BYTES, MEGA_STOPS_AT, PERSIST_STOPS_AT,
    SWEEP_HARDER_AT, UPLOAD_TTL_HOURS, UPLOAD_TTL_HOURS_TIGHT,
    storageVerdict, megaRefusal, pctOf, expiredKeys,
} from "@/lib/storageBudget";
import { MEGA_FILE_CAP, MEGA_ACTIVE_MAX, MEGA_TTL_HOURS } from "@/lib/megaUpload";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const at = (pct, megaPct = 0) =>
    storageVerdict(FREE_STORAGE_BYTES * pct, MEGA_BUCKET_BYTES * megaPct);

// ─── The order of yielding ──────────────────────────────────────────────────

check("BOOKS STAND DOWN BEFORE ORDINARY UPLOADS, always", () => {
    assert.ok(MEGA_STOPS_AT < PERSIST_STOPS_AT,
        "the rare, huge feature must yield before the one every student uses");
    const squeezed = at((MEGA_STOPS_AT + PERSIST_STOPS_AT) / 2);
    assert.equal(squeezed.megaAllowed, false, "books refused");
    assert.equal(squeezed.persistAllowed, true, "notes and photos still persist");
});

check("THE SWEEP TIGHTENS BEFORE ANYTHING IS REFUSED", () => {
    assert.ok(SWEEP_HARDER_AT < PERSIST_STOPS_AT,
        "reclaiming space nobody needs always beats telling somebody no");
    assert.equal(at(0.2).ttlHours, UPLOAD_TTL_HOURS);
    assert.equal(at(SWEEP_HARDER_AT + 0.01).ttlHours, UPLOAD_TTL_HOURS_TIGHT);
    assert.ok(UPLOAD_TTL_HOURS_TIGHT < UPLOAD_TTL_HOURS);
});

check("an ordinary upload is NEVER refused, at any level of fullness", () => {
    // `persistAllowed` false means "keep it in memory", not "fail". Nothing in
    // this model may ever return a verdict that stops a student uploading.
    for (const pct of [0, 0.5, 0.9, 1, 2]) {
        const v = at(pct);
        assert.ok(Object.prototype.hasOwnProperty.call(v, "persistAllowed"), String(pct));
        assert.notEqual(v.persistAllowed, undefined);
    }
    assert.equal(at(0.99).persistAllowed, false, "it stops PERSISTING");
});

check("an empty plan allows everything", () => {
    const v = at(0);
    assert.equal(v.megaAllowed, true);
    assert.equal(v.persistAllowed, true);
    assert.equal(megaRefusal(v, 1), null);
});

// ─── Books have their own ceiling as well as the shared one ─────────────────

check("books cannot crowd out ordinary uploads even when the plan is empty", () => {
    // One enthusiastic student is the state this exists for: total usage low,
    // the books bucket full of their textbooks.
    const v = storageVerdict(MEGA_BUCKET_BYTES, MEGA_BUCKET_BYTES);
    assert.equal(v.megaAllowed, false, "their own share is spent");
    assert.equal(v.persistAllowed, true, "everybody else is unaffected");
});

check("EITHER ceiling refuses a book, never only one", () => {
    assert.equal(at(MEGA_STOPS_AT + 0.05, 0).megaAllowed, false, "the shared one");
    assert.equal(at(0.05, 1).megaAllowed, false, "their own one");
});

check("the room reported is the SMALLER of the two headrooms", () => {
    const v = at(MEGA_STOPS_AT - 0.01, 0);
    assert.ok(v.megaRoom <= MEGA_BUCKET_BYTES);
    assert.ok(v.megaRoom <= FREE_STORAGE_BYTES * MEGA_STOPS_AT,
        "reporting the larger would invite a write that busts the other");
    assert.ok(v.megaRoom >= 0, "never negative");
});

check("room is never negative once past a ceiling", () => {
    assert.equal(at(0.99, 2).megaRoom, 0);
});

// ─── The refusal is useful ──────────────────────────────────────────────────

check("a refusal says when to come back and what still works", () => {
    const r = megaRefusal(at(0.9, 1));
    assert.ok(r, "there is a refusal");
    assert.match(r, /day/i, "when it frees up");
    assert.match(r, /notes|photos|normal/i, "and that ordinary uploads are fine");
    // It is a limit, not an accusation — the rule integrity.js already keeps.
    assert.doesNotMatch(r, /you (have|are)|too many|abuse/i);
});

check("a book that fits is not refused", () => {
    assert.equal(megaRefusal(at(0.1, 0), 10 * 1024 * 1024), null);
});

// ─── The arithmetic that set the caps ───────────────────────────────────────

check("a full books bucket holds a useful number of students", () => {
    const concurrent = Math.floor(MEGA_BUCKET_BYTES / (MEGA_FILE_CAP * MEGA_ACTIVE_MAX));
    assert.ok(concurrent >= 5,
        `only ${concurrent} students could hold a book at once — the caps do not fit the share`);
});

check("the caps as a whole stay inside the plan", () => {
    assert.ok(MEGA_BUCKET_BYTES < FREE_STORAGE_BYTES * MEGA_STOPS_AT,
        "books' own share must be reachable before the shared threshold bites, "
        + "or one of the two ceilings is decoration");
    assert.ok(MEGA_FILE_CAP <= MEGA_BUCKET_BYTES,
        "a single book must be storable at all");
});

check("A BOOK IS KEPT FOR A SITTING, NOT A TERM", () => {
    // The free tier only fits "students with a book open today". A week-long
    // TTL turns that into "students who have ever uploaded one", which is the
    // number that does not fit.
    assert.ok(MEGA_TTL_HOURS <= 48, `${MEGA_TTL_HOURS}h is too long for a 1 GB plan`);
    assert.ok(UPLOAD_TTL_HOURS <= 48);
});

check("pctOf reads as a percentage of the plan", () => {
    assert.equal(pctOf(FREE_STORAGE_BYTES / 2), "50%");
    assert.equal(pctOf(0), "0%");
});

check("garbage in does not produce a permissive verdict", () => {
    for (const bad of [null, undefined, NaN, -5, "lots"]) {
        const v = storageVerdict(bad, bad);
        assert.equal(Number.isFinite(v.used), true, String(bad));
        assert.equal(Number.isFinite(v.megaRoom), true, String(bad));
    }
});

// ─── WHAT A SWEEP MAY DELETE. This removes a student's files. ───────────────

const H = 3600_000;
const NOW = 1_700_000_000_000;
const row = (key, hoursAgo, size = 1024) =>
    ({ key, at: hoursAgo === null ? null : NOW - hoursAgo * H, size });

check("only files past the TTL go", () => {
    const { keys } = expiredKeys(
        [row("fresh", 1), row("day", 30), row("week", 200)],
        { ttlHours: 24, now: NOW });
    assert.deepEqual(keys.sort(), ["day", "week"]);
});

check("A FILE WITH NO TIMESTAMP IS NEVER SWEPT", () => {
    // `Number(null)` is 0, NOT NaN, so a coercion here reads "no timestamp" as
    // 1970 and deletes the one file the rule protects. The identical trap
    // `criterionIndexFor` records, and invisible without a fixture like this.
    for (const missing of [null, undefined, "", "not a date"]) {
        const { keys } = expiredKeys(
            [{ key: "unknown", at: missing, size: 9 }, row("old", 999)],
            { ttlHours: 24, now: NOW });
        assert.deepEqual(keys, ["old"], `at: ${JSON.stringify(missing)}`);
    }
});

check("keepNewest protects the book a sitting is using", () => {
    // Every one of these is past the TTL; the newest survives anyway, so a
    // sweep fired mid-session cannot delete the book being read.
    const { keys } = expiredKeys(
        [row("newest", 25), row("middle", 50), row("oldest", 99)],
        { ttlHours: 24, keepNewest: 1, now: NOW });
    assert.deepEqual(keys.sort(), ["middle", "oldest"]);
});

check("an undated file counts toward keepNewest rather than jumping the queue", () => {
    const { keys } = expiredKeys(
        [row("unknown", null), row("old", 99)],
        { ttlHours: 24, keepNewest: 1, now: NOW });
    assert.deepEqual(keys, ["old"]);
});

check("the freed total is the sum of what actually goes", () => {
    const { keys, freed } = expiredKeys(
        [row("a", 99, 100), row("b", 99, 250), row("c", 1, 9999)],
        { ttlHours: 24, now: NOW });
    assert.deepEqual(keys.sort(), ["a", "b"]);
    assert.equal(freed, 350, "and never counts the survivor");
});

check("nothing to sweep is not an error", () => {
    for (const bad of [[], null, undefined, [null], [{}], [{ key: "" }]]) {
        const r = expiredKeys(bad, { ttlHours: 24, now: NOW });
        assert.deepEqual(r.keys, [], JSON.stringify(bad));
        assert.equal(r.freed, 0);
    }
});

check("a zero or missing TTL does not become a delete-everything", () => {
    // Guarding the direction that loses data: a 0 sweeps everything DATABLE,
    // which is a deliberate call, but a missing one must not silently do it to
    // files that are minutes old.
    const fresh = [row("a", 0.1), row("b", 0.2)];
    assert.deepEqual(expiredKeys(fresh, { ttlHours: 24, now: NOW }).keys, []);
    assert.deepEqual(expiredKeys(fresh, { ttlHours: undefined, now: NOW }).keys.sort(),
        ["a", "b"], "an explicit 0/absent TTL is a full sweep — callers pass one");
});

// ─── The scan: the sweep exists, and both buckets are counted ──────────────

check("ORDINARY UPLOADS ARE SWEPT — the bucket had no TTL at all", () => {
    // This is the one that was going to take the project down on its own: at
    // 230 accounts, three files each at 3 MB is 2.0 GB against a 1 GB plan,
    // with nothing ever deleting any of it.
    const src = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    assert.match(src, /async function sweepUploads\(/, "the sweep must exist");
    assert.match(src, /sweepUploads\([^)]*\)\s*\.catch/, "and something must fire it");
});

check("every write and delete moves the counter, or the budget drifts blind", () => {
    const src = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    const moves = (src.match(/noteUsage\(/g) || []).length;
    assert.ok(moves >= 4,
        `only ${moves} calls to noteUsage — a write or a sweep is not being counted`);
});

check("the server takes the thresholds from this module rather than restating them", () => {
    const src = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    assert.match(src, /from "\.\/src\/lib\/storageBudget\.js"/);
    assert.doesNotMatch(src, /storageVerdict\s*=\s*function|function storageVerdict/,
        "one model, imported");
});

console.log(`\n${passed} checks passed`);
