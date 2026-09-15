/**
 * storageBudget — the free tier is a CLIFF, not a slope, so nothing may walk
 * off it.
 *
 * ═══ What exceeding actually does ═══════════════════════════════════════════
 * Supabase's free plan gives 1 GB of file storage and 5 GB of egress a month.
 * Going over does NOT degrade storage and leave the rest alone: the
 * organisation gets a grace period, and after it **every service returns 402**
 * — the database, auth, the lot. And a second grace period is not granted.
 *
 * So a bucket quietly filling up does not break uploads. It breaks THE WHOLE
 * APP, for every student, including the ones who never uploaded anything. That
 * is the failure this module exists to make impossible.
 *
 * ═══ The arithmetic that forced it ══════════════════════════════════════════
 * At 230 accounts (130 on the site plus a 100-student trial):
 *
 *   ai-uploads had NO sweep at all — every file ever uploaded kept forever.
 *   Three files each at 3 MB is 2.0 GB. Five at 4 MB is 4.5 GB. There is no
 *   plausible usage pattern where that bucket stays under 1 GB, and it was
 *   already on that path before any of this was added.
 *
 *   ai-mega at a 100 MB cap and two books each: TEN students using it is
 *   1.95 GB. Ten.
 *
 * ═══ THE ORDER OF YIELDING IS THE WHOLE DESIGN ══════════════════════════════
 * Pressure is absorbed in the order of what a student loses:
 *
 *   1. SWEEP. An ordinary upload is needed for the MINUTES between picking a
 *      file and pressing generate. Keeping it for a week was never buying
 *      anything, so a day's TTL costs nothing and reclaims almost all of it.
 *   2. MEGA REFUSES. Books are the largest objects and the rarest feature, so
 *      they stand down first and say when to come back. One student cannot
 *      store a textbook; nobody loses the app.
 *   3. ORDINARY UPLOADS STOP PERSISTING, and still work. This is the important
 *      one: `storeFile` already degrades to memory-only when there is no
 *      service key, and that path serves a generate perfectly — upload and
 *      generate are seconds apart and the file is in the cache. What is lost
 *      is surviving a restart, which is strictly better than a 402 across the
 *      whole project.
 *   4. There is no step four. Nothing here can reach the cliff.
 *
 * A GENERATE NEVER FAILS BECAUSE OF STORAGE. That is the rule; every threshold
 * below is chosen to keep it true.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** What the free plan gives. Both are the numbers the cliff sits at. */
export const FREE_STORAGE_BYTES = 1 * GB;
export const FREE_EGRESS_BYTES = 5 * GB;

/**
 * Where each stage of yielding begins, as a fraction of the plan's storage.
 *
 * Deliberately well short of the cliff. The usage figure the server holds is
 * eventually consistent — it is seeded from a listing and then tracked through
 * writes — so the thresholds have to absorb a count that is a little stale
 * without ever letting the real number reach 100%.
 */
export const MEGA_STOPS_AT = 0.55;      // books stand down here
export const PERSIST_STOPS_AT = 0.80;   // ordinary uploads go memory-only here
export const SWEEP_HARDER_AT = 0.70;    // the TTL tightens before either

/**
 * The share of the plan books may occupy at most.
 *
 * Separate from `MEGA_STOPS_AT` and both apply: this one stops books crowding
 * out ordinary uploads even when total usage is low, which is the state a
 * single enthusiastic student can create on their own.
 */
export const MEGA_BUCKET_BYTES = 250 * MB;

/**
 * How long an ORDINARY upload is kept.
 *
 * It is read once, in the generate that follows it by seconds. A day is
 * already enormously generous — it exists so a student who picks files, walks
 * away and comes back still has them, not so anything is archived.
 */
export const UPLOAD_TTL_HOURS = 24;
export const UPLOAD_TTL_HOURS_TIGHT = 4;

const frac = (used) => (FREE_STORAGE_BYTES > 0 ? used / FREE_STORAGE_BYTES : 1);

/**
 * What may still be written, given what is already stored.
 *
 * ONE function, so the two upload endpoints cannot disagree about how full is
 * full. `megaUsed` is that bucket alone; `used` is everything.
 */
export function storageVerdict(used = 0, megaUsed = 0) {
    const u = Math.max(0, Number(used) || 0);
    const m = Math.max(0, Number(megaUsed) || 0);
    const pct = frac(u);
    return {
        used: u,
        pct,
        // Books: blocked by EITHER ceiling. Their own share exists so one
        // student's textbooks cannot crowd out everybody's ordinary uploads.
        megaAllowed: pct < MEGA_STOPS_AT && m < MEGA_BUCKET_BYTES,
        megaRoom: Math.max(0, Math.min(
            MEGA_BUCKET_BYTES - m,
            MEGA_STOPS_AT * FREE_STORAGE_BYTES - u,
        )),
        // Ordinary uploads are never REFUSED. Past this they simply stop being
        // persisted and live in memory for the generate that follows.
        persistAllowed: pct < PERSIST_STOPS_AT,
        // The sweep tightens before anything is refused, because reclaiming
        // space nobody needs is always better than telling somebody no.
        ttlHours: pct >= SWEEP_HARDER_AT ? UPLOAD_TTL_HOURS_TIGHT : UPLOAD_TTL_HOURS,
    };
}

/** What a student is told when books are full. It says when to come back. */
export function megaRefusal(verdict, fileSize = 0) {
    if (verdict.megaAllowed && fileSize <= verdict.megaRoom) return null;
    if (fileSize > 0 && fileSize <= verdict.megaRoom) return null;
    return "Book storage is full right now — books are cleared out daily, so this "
        + "should free up within a day. Your notes and photos still upload as normal.";
}

/** A percentage for a log line. Storage is invisible until it is fatal. */
export const pctOf = (used) => `${Math.round(frac(used) * 100)}%`;

/**
 * WHICH FILES A SWEEP MAY DELETE.
 *
 * Extracted from the endpoints for the reason `pageIndices` was: this is a
 * DELETION decision, it runs against a student's own material, and inside a
 * loop in a handler nothing can check it until it has already removed the
 * wrong thing.
 *
 * `entries` are `{ key, at, size }` — `at` being epoch milliseconds. Two rules
 * and both are deliberate:
 *
 *   - **An unreadable timestamp is NEVER swept.** Storage answering oddly must
 *     not cost a student their file; the cost of keeping one file too long is
 *     a few megabytes, and the cost of the other error is their work.
 *   - **`keepNewest` protects the most recent N regardless of age**, so an
 *     active book is not deleted out from under the sitting that is using it.
 *     Age is applied first, then the count, both on the same ordering.
 */
export function expiredKeys(entries = [], { ttlHours, keepNewest = 0, now = Date.now() } = {}) {
    const cutoff = now - Math.max(0, Number(ttlHours) || 0) * 3600_000;
    const rows = (Array.isArray(entries) ? entries : [])
        .filter((e) => e && typeof e.key === "string" && e.key)
        // Newest first, and an unknown age sorts as newest so it is inside any
        // `keepNewest` window rather than at the front of the queue to go.
        // `Number(null)` is 0, NOT NaN — so coercing first turns "no timestamp"
        // into 1970 and sweeps the one file the rule above says never to touch.
        // The identical trap `criterionIndexFor` records; caught here by a
        // fixture row with a null date, which is the only way it is visible.
        .map((e) => {
            const raw = e.at;
            const n = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
            return { ...e, at: Number.isFinite(n) ? n : null };
        })
        .sort((a, b) => (b.at ?? Infinity) - (a.at ?? Infinity));

    const doomed = [];
    rows.forEach((row, i) => {
        if (i < keepNewest) return;                 // protected by position
        if (row.at === null) return;                // protected by not knowing
        if (row.at >= cutoff) return;               // still inside the TTL
        doomed.push(row);
    });
    return {
        keys: doomed.map((d) => d.key),
        freed: doomed.reduce((sum, d) => sum + (Number(d.size) || 0), 0),
    };
}
