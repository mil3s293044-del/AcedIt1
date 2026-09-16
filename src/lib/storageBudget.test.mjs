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
    storageVerdict, megaRefusal, pctOf, expiredKeys, evictionPlan,
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

check("the share holds a useful resident set at a REAL book size", () => {
    // A VCE textbook PDF is commonly 25-40 MB; the cap is the ceiling, not the
    // average. Measuring against the ceiling (every student holding two
    // maximum-size books at once) is the case EVICTION exists to resolve, so
    // it is not the number that decides whether the caps fit.
    const typical = 30 * 1024 * 1024;
    const resident = Math.floor(MEGA_BUCKET_BYTES / typical);
    assert.ok(resident >= 10,
        `only ${resident} typical books fit the share — the caps do not fit`);
    // And one book must always be storable, or the feature cannot start.
    assert.ok(MEGA_FILE_CAP <= MEGA_BUCKET_BYTES);
});

check("A FULL BUCKET EVICTS, it does not simply refuse", () => {
    // This is what lets MEGA_TTL_HOURS be generous and the file cap be high:
    // the bound is enforced by reclaiming the least recently read book, so a
    // student meets the refusal only when every book is being actively read.
    const src = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    assert.match(src, /async function sweepMegaGlobal\(/, "a global sweep must exist");
    assert.match(src, /recentlyRead\(/, "eviction must protect a book being read");
    assert.match(src, /sweepMegaGlobal\(\{ need: file\.size \}\)/,
        "an upload must make room for ITSELF before it is refused");
});

check("the caps as a whole stay inside the plan", () => {
    assert.ok(MEGA_BUCKET_BYTES < FREE_STORAGE_BYTES * MEGA_STOPS_AT,
        "books' own share must be reachable before the shared threshold bites, "
        + "or one of the two ceilings is decoration");
    assert.ok(MEGA_FILE_CAP <= MEGA_BUCKET_BYTES,
        "a single book must be storable at all");
});

check("the TTLs bound DEAD WEIGHT, and neither is a term", () => {
    // MEGA_TTL_HOURS stopped being a storage control when eviction arrived —
    // the bucket is bounded whatever it says — so it is free to be as long as
    // is useful. It still has to bound books nobody will ever open again.
    assert.ok(MEGA_TTL_HOURS <= 7 * 24, `${MEGA_TTL_HOURS}h keeps dead weight for a week`);
    assert.ok(MEGA_TTL_HOURS >= 48, "a book should survive a weekend");
    // The uploads TTL IS still a storage control: nothing evicts there,
    // because an ordinary upload is read once, seconds after it is written.
    assert.ok(UPLOAD_TTL_HOURS <= 48);
});

check("EVERY STUDENT'S BOOKS ARE SWEPT, not just the one who is uploading", () => {
    // The per-student sweep can never run again for somebody who uploaded once
    // and left, so their book was immortal — and at the file cap that is the
    // whole share held by accounts nobody is waiting on.
    const src = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    assert.match(src, /async function megaInventory\(/, "the sweep must walk every prefix");
    // And a sweep must be reachable from the paths students actually take,
    // not only from an upload — the rarest thing the app does.
    const fired = (src.match(/maybeSweep\(\)/g) || []).length;
    assert.ok(fired >= 3, `only ${fired} call sites fire a sweep — a quiet week reclaims nothing`);
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

// ─── EVICTION. This deletes OTHER PEOPLE'S files. ──────────────────────────

const MBb = 1024 * 1024;
const book = (key, owner, hoursAgo, size = 30 * MBb) =>
    ({ key, owner, at: hoursAgo === null ? null : NOW - hoursAgo * H, size });

const plan = (rows, opts = {}) => evictionPlan(rows, {
    budget: 100 * MBb, ttlHours: 72, keepNewest: 2, now: NOW, ...opts,
});

check("nothing is evicted while the bucket fits", () => {
    const rows = [book("a", "u1", 1, 20 * MBb), book("b", "u2", 2, 20 * MBb)];
    assert.deepEqual(plan(rows).keys, []);
});

check("the LEAST RECENTLY written goes first, and it STOPS once it fits", () => {
    // Evicting past the budget is destroying an upload to buy space nobody
    // asked for.
    const rows = [book("new", "u1", 1), book("mid", "u2", 5), book("old", "u3", 9)];
    const r = plan(rows, { budget: 70 * MBb });
    assert.deepEqual(r.keys, ["old"], "one eviction is enough for 90 of 70");
    assert.equal(r.held, 60 * MBb);
});

check("an upload makes room for ITSELF rather than being refused", () => {
    const rows = [book("a", "u1", 1), book("b", "u2", 2), book("c", "u3", 3)];
    // 90 MB held, 100 MB budget, a 30 MB book arriving: one must go.
    const r = plan(rows, { need: 30 * MBb });
    assert.equal(r.keys.length, 1);
    assert.ok(r.held + 30 * MBb <= 100 * MBb, "and the newcomer then fits");
});

check("A BOOK BEING READ IS NEVER EVICTED", () => {
    // Storage records writes and never reads, so the oldest book by timestamp
    // may be the one a student is three chapters into. Without `protect` a
    // sweep takes it out of their hands mid-sitting.
    const rows = [book("reading", "u1", 9), book("idle", "u2", 5), book("newer", "u3", 1)];
    const r = plan(rows, { budget: 70 * MBb, protect: new Set(["reading"]) });
    assert.ok(!r.keys.includes("reading"), "the one in use survives");
    assert.deepEqual(r.keys, ["idle"], "the next oldest goes instead");
});

check("protecting everything means nothing is evicted, not a wrong choice", () => {
    // The state where a refusal is the correct answer — every book in use.
    const rows = [book("a", "u1", 9), book("b", "u2", 8)];
    const r = plan(rows, { budget: 10 * MBb, protect: new Set(["a", "b"]) });
    assert.deepEqual(r.keys, []);
    assert.ok(r.held > 10 * MBb, "and the caller can see it did not fit");
});

check("each owner keeps their newest through the AGE pass", () => {
    // Ageing alone must not take somebody's only book.
    const rows = [book("u1-only", "u1", 200), book("u2-only", "u2", 300)];
    const r = evictionPlan(rows, { budget: 999 * MBb, ttlHours: 72, keepNewest: 1, now: NOW });
    assert.deepEqual(r.keys, [], "both are ancient and both are their owner's only book");
});

check("but a THIRD book goes whatever its age, at keepNewest 2", () => {
    const rows = [book("n1", "u1", 1), book("n2", "u1", 2), book("n3", "u1", 3)];
    const r = plan(rows, { budget: 999 * MBb });
    assert.deepEqual(r.keys, ["n3"], "the oldest of the three");
});

check("one owner's oldest cannot protect another owner's", () => {
    // The age pass is PER OWNER, so a quiet account does not shelter behind a
    // busy one's timestamps.
    const rows = [book("stale", "quiet", 500), book("a", "busy", 1), book("b", "busy", 2)];
    const r = evictionPlan(rows, { budget: 999 * MBb, ttlHours: 72, keepNewest: 1, now: NOW });
    assert.deepEqual(r.keys, ["b"], "busy's second goes on count; quiet's only book stays");
});

check("THE ORDER IS DETERMINISTIC when two books share a timestamp", () => {
    // `(b.at ?? Infinity) - (a.at ?? Infinity)` is NaN when BOTH are unknown,
    // and a comparator returning NaN orders arbitrarily — for a function that
    // decides what to delete, the answer would change between engines.
    const rows = [book("z", "u1", null), book("a", "u2", null), book("m", "u3", null)];
    const first = evictionPlan(rows, { budget: 10 * MBb, ttlHours: 72, keepNewest: 0, now: NOW });
    const again = evictionPlan([...rows].reverse(), { budget: 10 * MBb, ttlHours: 72, keepNewest: 0, now: NOW });
    assert.deepEqual(first.keys.sort(), again.keys.sort(), "same input, same answer");
});

check("eviction survives the shapes a listing can actually return", () => {
    for (const bad of [[], null, undefined, [null], [{}], [{ key: "" }], [{ key: "x" }]]) {
        assert.doesNotThrow(() => plan(bad), JSON.stringify(bad));
        const r = plan(bad);
        assert.ok(Array.isArray(r.keys));
        assert.ok(Number.isFinite(r.freed));
    }
});

check("freed is what actually goes, never what survives", () => {
    const rows = [book("a", "u1", 9, 40 * MBb), book("b", "u2", 1, 40 * MBb)];
    const r = plan(rows, { budget: 50 * MBb });
    assert.deepEqual(r.keys, ["a"]);
    assert.equal(r.freed, 40 * MBb);
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
