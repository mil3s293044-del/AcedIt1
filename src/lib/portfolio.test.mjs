/**
 * portfolio assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/portfolio.test.mjs
 *
 * The rules worth pinning: weight by exposure, never invent a price, and never
 * claim a rival's session moved your number — only that it moved in the window.
 */
import assert from "node:assert/strict";
import { bookOdds, bookSeries, bookExposure, movers, rivalFeed }
    from "@/components/competition/portfolio";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const H = 3600 * 1000;
const ago = (h) => new Date(Date.now() - h * H).toISOString();
const battle = ({ id = "b", odds = 50, pot = 100, trail = [[48, 50], [0, 50]], status = "live", sides = [] }) => ({
    id, status, odds, potXP: pot,
    market: trail.map(([h, p]) => ({ t: ago(h), p })),
    sides,
});

check("no live battles with a trail means no price — not 50%", () => {
    assert.equal(bookOdds([]), null);
    assert.equal(bookOdds([{ status: "live", market: [] }]), null);
    assert.equal(bookOdds([battle({ status: "settled" })]), null);
});

check("the book is weighted by what's at stake, not by battle count", () => {
    // 90% on a 900 XP pot next to 10% on a 100 XP pot is not 50%.
    const b = bookOdds([
        battle({ id: "big", odds: 90, pot: 900 }),
        battle({ id: "small", odds: 10, pot: 100 }),
    ]);
    assert.equal(b, 82);
});

check("a battle with no trail is left out rather than guessed at", () => {
    const withTrail = battle({ id: "a", odds: 80, pot: 100 });
    const noTrail = { id: "b", status: "live", odds: 20, potXP: 100, market: [] };
    assert.equal(bookOdds([withTrail, noTrail]), 80);
});

check("the book series is stepped onto one clock and stays in range", () => {
    const s = bookSeries([
        battle({ id: "a", trail: [[48, 40], [24, 55], [0, 70]] }),
        battle({ id: "b", trail: [[12, 20], [0, 30]] }),   // started later
    ], { points: 12 });
    assert.ok(s.length > 2);
    for (const d of s) {
        assert.ok(d.p >= 0 && d.p <= 100, `p in range: ${d.p}`);
        assert.ok(!Number.isNaN(new Date(d.t).getTime()));
    }
    // Sorted forward in time.
    for (let i = 1; i < s.length; i++) {
        assert.ok(new Date(s[i].t) >= new Date(s[i - 1].t));
    }
});

check("a battle that hadn't started isn't held at its opening price", () => {
    // 'b' opens 12h ago at 20. The earliest samples must be 'a' alone (40),
    // not an average that pretends you were exposed to 'b' two days ago.
    const s = bookSeries([
        battle({ id: "a", trail: [[48, 40], [0, 40]] }),
        battle({ id: "b", trail: [[12, 20], [0, 20]] }),
    ], { points: 24 });
    assert.equal(s[0].p, 40);
    assert.equal(s[s.length - 1].p, 30);   // both live, equal pots
});

check("exposure adds the pots and values them at current odds", () => {
    const e = bookExposure([
        battle({ id: "a", odds: 50, pot: 300 }),
        battle({ id: "b", odds: 100, pot: 200 }),
        battle({ id: "c", odds: 90, pot: 999, status: "settled" }),  // not exposed
    ]);
    assert.equal(e.atStake, 500);
    assert.equal(e.expected, 350);
});

check("movers rank by size of move, either direction", () => {
    const m = movers([
        battle({ id: "up", trail: [[36, 40], [0, 52]] }),
        battle({ id: "down", trail: [[36, 60], [0, 30]] }),
        battle({ id: "flat", trail: [[36, 50], [0, 50]] }),
    ], { hours: 24 });
    assert.deepEqual(m.map((x) => x.battle.id), ["down", "up"]);
    assert.equal(m[0].delta, -30);
    assert.ok(!m.some((x) => x.battle.id === "flat"), "a flat price is not a mover");
});

check("the rival feed only reports people you are actually racing", () => {
    const b = battle({ id: "a", sides: [
        { email: "me@x.com", isMe: true }, { email: "rival@x.com", isMe: false },
    ] });
    const ticker = [
        { email: "rival@x.com", xp: 40, at: ago(1) },
        { email: "stranger@x.com", xp: 90, at: ago(1) },
        { email: "me@x.com", xp: 10, at: ago(1) },
    ];
    const feed = rivalFeed({ battles: [b], ticker, myEmail: "me@x.com" });
    assert.equal(feed.length, 1);
    assert.equal(feed[0].email, "rival@x.com");
    assert.equal(feed[0].battle.id, "a");
});

check("junk input never throws", () => {
    for (const arg of [null, undefined, [], [null], [{}], [{ status: "live" }]]) {
        assert.doesNotThrow(() => { bookOdds(arg); bookSeries(arg); bookExposure(arg); movers(arg); });
    }
    assert.doesNotThrow(() => rivalFeed({}));
});

console.log(`\n${passed} passed`);
