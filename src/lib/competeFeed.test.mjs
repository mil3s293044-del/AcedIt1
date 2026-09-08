/**
 * competeFeed assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/competeFeed.test.mjs
 *
 * The feed is the front page of Compete, so two things matter more than the
 * rest: a live call-out can never be buried (burying one is a forfeit the
 * student did not choose), and no line the app writes can break the project's
 * own voice rules while being funny at somebody's expense.
 */
import assert from "node:assert/strict";
import { competeFeed, rivalries, pick, leftLabel, BANNED } from "@/lib/competeFeed";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ME = "me@x.com";
const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const ahead = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

const callout = (over = {}) => ({
    id: "c1", competition_id: "b1",
    caller_email: "priya@x.com", caller_name: "Priya Nair",
    target_email: "tom@x.com", target_name: "Tom Reed",
    status: "pending", created_date: ago(2), respond_by: ahead(20),
    question_count: 8, ...over,
});

const battle = (over = {}) => ({
    kind: "competition", id: "b1", title: "Chemistry Sprint", status: "active",
    sides: [
        { email: ME, name: "You", isMe: true, score: 400 },
        { email: "priya@x.com", name: "Priya Nair", isMe: false, score: 380 },
    ],
    oddsSeries: [
        { t: ago(20), p: 44 }, { t: ago(10), p: 52 }, { t: ago(1), p: 61 },
    ],
    ...over,
});

// ─── the ordering rule that matters ─────────────────────────────────────────

check("A LIVE CALL-OUT SORTS FIRST, whatever else is fresher", () => {
    // Its clock is running on somebody's behalf. Burying it under an odds tick
    // from five minutes ago is how a student forfeits one they would have sat.
    const feed = competeFeed({
        callouts: [callout({ created_date: ago(20) })],
        battles: [battle()],
        myEmail: ME,
    });
    assert.equal(feed[0].kind, "callout_live");
    assert.equal(feed[0].urgent, true);
    assert.ok(feed.length > 1, "the odds move is still in the feed, just under it");
});

check("everything else is newest first", () => {
    const feed = competeFeed({
        callouts: [
            callout({ id: "old", status: "passed", score: 0.9, submitted_at: ago(30) }),
            callout({ id: "new", status: "failed", score: 0.4, submitted_at: ago(1) }),
        ],
        myEmail: ME,
    });
    assert.equal(feed[0].id, "callout:new:failed");
});

// ─── call-outs are events everyone in the battle can read ───────────────────

check("a call-out between two other people is IN the feed", () => {
    // This is the whole point: a challenge nobody witnesses is a DM with extra
    // steps, and the reason to answer one is that the group is watching.
    const feed = competeFeed({ callouts: [callout()], myEmail: ME });
    assert.equal(feed.length, 1);
    assert.equal(feed[0].involvesMe, false);
    assert.match(feed[0].headline, /Priya/);
    assert.match(feed[0].headline, /Tom/);
});

check("the line is written FOR the person reading it", () => {
    const asTarget = competeFeed({ callouts: [callout({ target_email: ME })], myEmail: ME })[0];
    assert.match(asTarget.headline, /you/i, "the target is addressed, not described");
    const asCaller = competeFeed({ callouts: [callout({ caller_email: ME })], myEmail: ME })[0];
    assert.match(asCaller.headline, /You called|your challenge/i);
});

check("a pass names the winner and says what it cost", () => {
    const e = competeFeed({
        callouts: [callout({ status: "passed", score: 0.9, xp_moved: 340, submitted_at: ago(1) })],
        myEmail: ME,
    })[0];
    assert.equal(e.kind, "callout_passed");
    assert.equal(e.tone, "win");
    assert.equal(e.stat, "90%");
    assert.match(e.detail, /340 XP/);
});

check("a VOIDED call-out is not an event — nothing was tested", () => {
    const feed = competeFeed({ callouts: [callout({ status: "voided" })], myEmail: ME });
    assert.equal(feed.length, 0);
});

check("expired and failed are different events, because they are", () => {
    const exp = competeFeed({ callouts: [callout({ status: "expired", submitted_at: ago(1) })], myEmail: ME })[0];
    const fail = competeFeed({ callouts: [callout({ status: "failed", score: 0.3, submitted_at: ago(1) })], myEmail: ME })[0];
    assert.equal(exp.kind, "callout_expired");
    assert.equal(fail.kind, "callout_failed");
    assert.notEqual(exp.headline, fail.headline);
});

// ─── what it must not claim ─────────────────────────────────────────────────

check("an odds move and a rival's session are SEPARATE events", () => {
    // The trail says a price moved; the ticker says somebody studied in the
    // same window. Joining them with "because" is a claim the data cannot
    // support, and a market that fakes causation is one nobody trusts twice.
    const feed = competeFeed({
        battles: [battle()],
        ticker: [{ email: "priya@x.com", name: "Priya Nair", source: "quiz", at: ago(2) }],
        myEmail: ME,
    });
    const kinds = feed.map((e) => e.kind);
    assert.ok(kinds.includes("odds_move"));
    assert.ok(kinds.includes("rival_activity"));
    feed.forEach((e) => assert.doesNotMatch(e.headline, /because/i));
});

check("a move under three points is noise and is not reported", () => {
    const flat = battle({ oddsSeries: [{ t: ago(10), p: 50 }, { t: ago(1), p: 51 }] });
    const feed = competeFeed({ battles: [flat], myEmail: ME });
    assert.equal(feed.filter((e) => e.kind === "odds_move").length, 0);
});

check("a stranger's study is not news — only people racing you", () => {
    const feed = competeFeed({
        battles: [battle()],
        ticker: [{ email: "nobody@x.com", name: "Stranger", source: "quiz", at: ago(1) }],
        myEmail: ME,
    });
    assert.equal(feed.filter((e) => e.kind === "rival_activity").length, 0);
});

check("an empty account gets an empty feed, not placeholders", () => {
    assert.deepEqual(competeFeed({ myEmail: ME }), []);
    assert.deepEqual(competeFeed({}), []);
});

check("the same event twice is one row", () => {
    const c = callout();
    const feed = competeFeed({ callouts: [c, { ...c }], myEmail: ME });
    assert.equal(feed.length, 1);
});

// ─── voice ──────────────────────────────────────────────────────────────────

check("NO LINE THE APP WRITES BREAKS THE PROJECT'S VOICE RULES", () => {
    // Every branch, in both directions, with every status.
    const lines = [];
    const statuses = ["pending", "active", "passed", "failed", "expired"];
    for (const status of statuses) {
        for (const mine of [{}, { target_email: ME }, { caller_email: ME }]) {
            for (let i = 0; i < 12; i += 1) {
                const feed = competeFeed({
                    callouts: [callout({ id: `c${i}`, status, score: 0.7, xp_moved: 100,
                        submitted_at: ago(1), ...mine })],
                    battles: [battle({ id: `b${i}` }),
                        battle({ id: `d${i}`, oddsSeries: [{ t: ago(10), p: 70 }, { t: ago(1), p: 40 }] }),
                        battle({ id: `s${i}`, status: "completed" })],
                    ticker: [{ email: "priya@x.com", name: "Priya Nair", source: "blurting", at: ago(1) }],
                    myEmail: ME,
                });
                feed.forEach((e) => { lines.push(e.headline); if (e.detail) lines.push(e.detail); });
            }
        }
    }
    assert.ok(lines.length > 40, `expected plenty of lines, got ${lines.length}`);
    for (const line of lines) {
        for (const word of BANNED) {
            assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(line),
                `banned word "${word}" appeared in: ${line}`);
        }
        // Banter is aimed at the SCOREBOARD. A line that says somebody is bad
        // at their subject is the app kicking a sixteen-year-old, and there is
        // no amount of engagement worth that.
        assert.doesNotMatch(line, /\b(hopeless|useless|pathetic|loser|dumb|stupid|rubbish|clueless)\b/i,
            `a line went at the person: ${line}`);
    }
});

check("a line is STABLE — the same event says the same thing twice", () => {
    // A feed that reworded itself on every render makes a student doubt they
    // read it right the first time.
    const args = { callouts: [callout()], myEmail: ME };
    assert.equal(competeFeed(args)[0].headline, competeFeed(args)[0].headline);
    assert.equal(pick(["a", "b", "c"], "seed"), pick(["a", "b", "c"], "seed"));
});

check("pick on an empty set is empty, not undefined", () => {
    assert.equal(pick([], "x"), "");
});

check("a clock that has run out has no time left to report", () => {
    assert.equal(leftLabel(ago(1)), null);
    assert.match(leftLabel(ahead(3)), /left/);
});

// ─── rivalries ──────────────────────────────────────────────────────────────

check("a rivalry keeps the CLOSEST live gap, not the last one seen", () => {
    // The race still worth watching is the close one; a blowout elsewhere must
    // not stand in for it.
    const r = rivalries({
        battles: [
            battle({ id: "b1", sides: [
                { email: ME, isMe: true, score: 400 },
                { email: "p@x.com", name: "Priya", score: 100 }] }),
            battle({ id: "b2", sides: [
                { email: ME, isMe: true, score: 400 },
                { email: "p@x.com", name: "Priya", score: 395 }] }),
        ],
        myEmail: ME,
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].gap, 5);
    assert.equal(r[0].live, 2);
});

check("a finished battle becomes a record, and call-outs are counted", () => {
    const r = rivalries({
        battles: [battle({ status: "completed", sides: [
            { email: ME, isMe: true, score: 300 },
            { email: "p@x.com", name: "Priya", score: 400 }] })],
        callouts: [
            callout({ caller_email: "p@x.com", target_email: ME }),
            callout({ id: "c2", caller_email: ME, target_email: "p@x.com" }),
        ],
        myEmail: ME,
    });
    assert.equal(r[0].losses, 1);
    assert.equal(r[0].calledMe, 1);
    assert.equal(r[0].iCalled, 1);
});

check("you are never your own rival", () => {
    const r = rivalries({ battles: [battle()], myEmail: ME });
    assert.ok(r.every((x) => x.email !== ME));
});

check("a live race outranks a finished one", () => {
    const r = rivalries({
        battles: [
            battle({ id: "old", status: "completed", sides: [
                { email: ME, isMe: true, score: 400 },
                { email: "a@x.com", name: "A", score: 100 }] }),
            battle({ id: "now", sides: [
                { email: ME, isMe: true, score: 400 },
                { email: "b@x.com", name: "B", score: 399 }] }),
        ],
        myEmail: ME,
    });
    assert.equal(r[0].email, "b@x.com");
});

console.log(`\n${passed} passed`);
