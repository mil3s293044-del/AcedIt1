// Tests for the entity read cache. Run via `npm test`.
import assert from 'node:assert/strict';
import { createReadCache } from './readCache.js';

let clock = 0;
const now = () => clock;
const mk = (opts = {}) => createReadCache({ now, ttlMs: 100, ...opts });

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ── dedupe ──────────────────────────────────────────────────────────────────

test('two reads in the same tick share one loader call', async () => {
  const c = mk();
  let calls = 0;
  const load = () => { calls++; return Promise.resolve(['a']); };
  const [x, y] = await Promise.all([c.read('goals', 'k', load), c.read('goals', 'k', load)]);
  assert.equal(calls, 1);
  assert.deepEqual(x, ['a']);
  assert.equal(x, y, 'both callers get the same resolved value');
});

test('different keys on the same table do not collide', async () => {
  const c = mk();
  let calls = 0;
  const load = (v) => () => { calls++; return Promise.resolve(v); };
  const [a, b] = await Promise.all([c.read('goals', 'k1', load(1)), c.read('goals', 'k2', load(2))]);
  assert.equal(calls, 2);
  assert.deepEqual([a, b], [1, 2]);
});

test('same key on different tables does not collide', async () => {
  const c = mk();
  const a = await c.read('goals', 'k', () => Promise.resolve('goal'));
  const b = await c.read('quizzes', 'k', () => Promise.resolve('quiz'));
  assert.deepEqual([a, b], ['goal', 'quiz']);
});

// ── ttl ─────────────────────────────────────────────────────────────────────

test('a repeat inside the ttl is served from memory', async () => {
  clock = 0;
  const c = mk();
  let calls = 0;
  const load = () => { calls++; return Promise.resolve(calls); };
  assert.equal(await c.read('goals', 'k', load), 1);
  clock = 99;
  assert.equal(await c.read('goals', 'k', load), 1);
  assert.equal(calls, 1);
});

test('a repeat past the ttl refetches', async () => {
  clock = 0;
  const c = mk();
  let calls = 0;
  const load = () => { calls++; return Promise.resolve(calls); };
  assert.equal(await c.read('goals', 'k', load), 1);
  clock = 101;
  assert.equal(await c.read('goals', 'k', load), 2);
});

// ── invalidation ────────────────────────────────────────────────────────────

test('a write drops every cached read of that table only', async () => {
  const c = mk();
  let goals = 0, quizzes = 0;
  await c.read('goals', 'k', () => Promise.resolve(++goals));
  await c.read('quizzes', 'k', () => Promise.resolve(++quizzes));
  c.invalidate('goals');
  assert.equal(await c.read('goals', 'k', () => Promise.resolve(++goals)), 2);
  assert.equal(await c.read('quizzes', 'k', () => Promise.resolve(++quizzes)), 1, 'untouched table kept');
});

test('a read in flight when a write lands is not cached', async () => {
  const c = mk();
  let release;
  const slow = new Promise((r) => { release = r; });
  const first = c.read('goals', 'k', () => slow);

  c.invalidate('goals');            // write lands mid-flight
  release(['stale']);
  assert.deepEqual(await first, ['stale'], 'the original caller still gets its answer');

  let refetched = false;
  const second = await c.read('goals', 'k', () => { refetched = true; return Promise.resolve(['fresh']); });
  assert.ok(refetched, 'the next caller must not be handed the pre-write answer');
  assert.deepEqual(second, ['fresh']);
});

test('a caller who asks after a write does not join the pre-write flight', async () => {
  const c = mk();
  let release;
  const slow = new Promise((r) => { release = r; });
  const first = c.read('goals', 'k', () => slow);
  c.invalidate('goals');
  const second = c.read('goals', 'k', () => Promise.resolve('fresh'));
  release('stale');
  assert.equal(await first, 'stale');
  assert.equal(await second, 'fresh');
});

test('clear drops everything and stops in-flight reads caching', async () => {
  const c = mk();
  let release;
  const slow = new Promise((r) => { release = r; });
  const first = c.read('goals', 'k', () => slow);
  c.clear();
  release('stale');
  await first;
  assert.equal(await c.read('goals', 'k', () => Promise.resolve('fresh')), 'fresh');
});

// ── failures ────────────────────────────────────────────────────────────────

test('a rejected read is never cached', async () => {
  const c = mk();
  let calls = 0;
  await assert.rejects(c.read('goals', 'k', () => { calls++; return Promise.reject(new Error('boom')); }));
  assert.equal(await c.read('goals', 'k', () => { calls++; return Promise.resolve('ok'); }), 'ok');
  assert.equal(calls, 2, 'the retry actually ran');
  assert.equal(c.size, 1);
});

test('a loader that throws synchronously rejects rather than escaping', async () => {
  const c = mk();
  await assert.rejects(c.read('goals', 'k', () => { throw new Error('sync boom'); }), /sync boom/);
});

// ── eviction ────────────────────────────────────────────────────────────────

test('the map stays bounded', async () => {
  const c = mk({ maxEntries: 3 });
  for (let i = 0; i < 10; i++) await c.read('goals', `k${i}`, () => Promise.resolve(i));
  assert.ok(c.size <= 3, `size was ${c.size}`);
});

// ── run ─────────────────────────────────────────────────────────────────────

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); } catch (e) { failed++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
if (failed) { console.error(`\nreadCache: ${failed}/${tests.length} failed`); process.exit(1); }
console.log(`readCache: ${tests.length} passed`);
