/**
 * sacRunway assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/sacRunway.test.mjs
 *
 * The point of the band table is that the hero changes on more than one day of
 * the countdown, and that it never disagrees with what Ace is saying — both
 * read the same five distances.
 */
import assert from "node:assert/strict";
import { sacBand, runway, fanCards, RUNWAY_MAX } from "@/lib/sacRunway";
import { SAC_MOOD } from "@/lib/aceVoice";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

check("the bands line up with the ones Ace speaks from", () => {
    // If these drift, the picture says "crunch" while the sentence says
    // "loads of room" — the exact failure the shared distances prevent.
    const mine = [0, 1, 3, 7, 14, Infinity];
    const his = SAC_MOOD.map((b) => (b.within >= 999 ? Infinity : b.within));
    assert.deepEqual(mine, his);
});

check("every distance lands in a band, including nonsense", () => {
    for (const d of [0, 1, 2, 3, 4, 7, 8, 14, 15, 400, NaN, null, undefined, -5]) {
        const b = sacBand(d);
        assert.ok(b && b.id && b.grad, `band for ${d}`);
        assert.ok(b.urgency >= 0 && b.urgency <= 1);
    }
});

check("urgency rises as the date approaches, and only then", () => {
    const u = [30, 14, 7, 3, 1, 0].map((d) => sacBand(d).urgency);
    for (let i = 1; i < u.length; i++) {
        assert.ok(u[i] >= u[i - 1], `urgency non-decreasing at ${i}: ${u}`);
    }
    assert.equal(sacBand(0).urgency, 1);
});

check("the design changes on more than one day of the countdown", () => {
    // The bug this replaces: one branch at 3 days, so 4 days out and 3 weeks
    // out drew the same card.
    const seen = new Set([21, 14, 10, 7, 5, 3, 2, 1, 0].map((d) => sacBand(d).grad));
    assert.ok(seen.size >= 4, `expected several distinct looks, got ${seen.size}`);
});

check("the runway shortens by one marker a day", () => {
    assert.equal(runway(9).lit, 9);
    assert.equal(runway(8).lit, 8);
    assert.equal(runway(1).lit, 1);
});

check("past the cap it reads as 'plenty' rather than counting pips", () => {
    const r = runway(40);
    assert.equal(r.lit, RUNWAY_MAX);
    assert.equal(r.overflow, true);
});

check("the day itself is its own state, not zero pips by accident", () => {
    const r = runway(0);
    assert.equal(r.today, true);
    assert.equal(r.lit, 0);
    assert.equal(runway(null).today, false, "no date is not today");
});

check("the fan thins as the date closes", () => {
    const f = [30, 14, 7, 3, 1].map(fanCards);
    for (let i = 1; i < f.length; i++) assert.ok(f[i] <= f[i - 1], `fan non-increasing: ${f}`);
    assert.ok(fanCards(1) >= 1, "never an empty fan");
});

console.log(`\n${passed} passed`);
