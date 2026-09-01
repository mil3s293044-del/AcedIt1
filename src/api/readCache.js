// ============================================================================
// Read cache + in-flight dedupe for the entity shim.
//
// Why this exists: 159 entity reads live across the app, 36 of them fetching
// the SAME user_profiles row, and every page's mount effect fires its own.
// Nothing in the app caches — react-query is installed and configured but only
// the provider and the 404 page ever touched it. Migrating 159 call sites is a
// rewrite; caching at the one place they all funnel through is a file.
//
// Two separate jobs, and the dedupe is the bigger one:
//
//   - DEDUPE: two components mounting in the same tick that ask for the same
//     rows share ONE request. This is exact — they get the same promise — so
//     there is no staleness window to reason about.
//   - TTL: a repeat of the same read within `ttlMs` is served from memory.
//     Short by design. This absorbs remount storms (tab switches, a parent
//     re-rendering its children), not a whole study session.
//
// Invalidation is by table and it is eager: any write drops every cached read
// of that table, and a server function invoke drops everything, because the
// ported functions write rows we cannot see from here (awardXP alone touches
// xp_events, user_profiles and leaderboards).
//
// A read already in flight when a write lands is NOT cached when it settles —
// it was computed against the old row. Its original callers still get it,
// which is what they would have got with no cache at all; what we refuse to do
// is hand that stale answer to anyone who asked AFTER the write.
// ============================================================================

export function createReadCache({ ttlMs = 8000, maxEntries = 300, now = () => Date.now() } = {}) {
  /** key -> { table, gen, promise, settledAt } */
  const entries = new Map();
  /** table -> generation counter, bumped on every write */
  const gens = new Map();

  const genOf = (table) => gens.get(table) ?? 0;

  function evictIfNeeded() {
    // Plain insertion-order eviction. Map iterates in insertion order, so the
    // oldest key is first out. Not an LRU on purpose: entries live seconds,
    // and re-reading a hot key costs one request.
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  }

  function read(table, key, loader) {
    const full = `${table} ${key}`;
    const hit = entries.get(full);
    if (hit) {
      // Still in flight — join it, whatever its age.
      if (hit.settledAt == null) return hit.promise;
      if (now() - hit.settledAt < ttlMs) return hit.promise;
      entries.delete(full);
    }

    const gen = genOf(table);
    const entry = { table, gen, promise: null, settledAt: null };
    entry.promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (entries.get(full) !== entry) return value;          // dropped mid-flight
        if (genOf(table) !== gen) { entries.delete(full); return value; }
        entry.settledAt = now();
        return value;
      })
      .catch((err) => {
        // Errors are never cached. A failed read that sticks for 8s turns one
        // dropped connection into a page that stays broken.
        if (entries.get(full) === entry) entries.delete(full);
        throw err;
      });

    entries.set(full, entry);
    evictIfNeeded();
    return entry.promise;
  }

  function invalidate(table) {
    gens.set(table, genOf(table) + 1);
    const prefix = `${table} `;
    for (const k of [...entries.keys()]) {
      if (k.startsWith(prefix)) entries.delete(k);
    }
  }

  function clear() {
    for (const e of entries.values()) gens.set(e.table, genOf(e.table) + 1);
    entries.clear();
  }

  return { read, invalidate, clear, get size() { return entries.size; } };
}
