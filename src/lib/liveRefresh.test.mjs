/**
 * liveRefresh assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/liveRefresh.test.mjs
 *
 * The one rule everything else serves: a refresh that lands on somebody who is
 * busy is DEFERRED, never dropped. Skipping it is the version that feels
 * broken — you finish a quiz, open the leaderboard, and it shows numbers from
 * before you started, because the update that would have fixed it was thrown
 * away while you were mid-question.
 */
import assert from "node:assert/strict";
import {
    decideRefresh, createBusyRegistry, diffStandings, anythingLive,
    focusedFieldHasContent, BUSY, TYPING_QUIET_MS, LIVE_POLL_MS, IDLE_POLL_MS,
    MIN_GAP_MS, CAUGHT_WITHIN,
} from "@/lib/liveRefresh";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const NOW = 1_700_000_000_000;

// ─── the rule ───────────────────────────────────────────────────────────────

check("A BUSY STUDENT DEFERS THE REFRESH — it is never skipped", () => {
    for (const reason of Object.values(BUSY)) {
        const d = decideRefresh({ now: NOW, busy: [reason], requested: true, live: true });
        assert.equal(d.action, "defer", `${reason} should defer`);
        assert.equal(d.reason, reason);
    }
});

check("a forced refresh still waits for a busy student", () => {
    // "Force" means skip the poll gap and the visibility check — it does NOT
    // mean re-render underneath somebody answering question 7.
    const d = decideRefresh({ now: NOW, busy: [BUSY.CALLOUT], force: true });
    assert.equal(d.action, "defer");
    assert.equal(d.reason, BUSY.CALLOUT);
});

check("the moment they are free, it goes", () => {
    const d = decideRefresh({ now: NOW, busy: [], requested: true, lastRefreshAt: 0 });
    assert.equal(d.action, "refresh");
});

// ─── typing ─────────────────────────────────────────────────────────────────

check("recent typing counts as busy without any component declaring it", () => {
    const d = decideRefresh({ now: NOW, lastInputAt: NOW - 1000, requested: true });
    assert.equal(d.action, "defer");
    assert.equal(d.reason, BUSY.TYPING);
});

check("and stops counting once they have stopped", () => {
    const d = decideRefresh({
        now: NOW, lastInputAt: NOW - TYPING_QUIET_MS - 1, requested: true, lastRefreshAt: 0,
    });
    assert.equal(d.action, "refresh");
});

check("a focused field WITH TEXT IN IT holds it, even long after the last key", () => {
    const d = decideRefresh({
        now: NOW, lastInputAt: NOW - 600000, focusedHasContent: true, requested: true,
    });
    assert.equal(d.action, "defer");
    assert.equal(d.reason, BUSY.TYPING);
});

check("AN EMPTY BOX IS NOT WORK IN PROGRESS", () => {
    // Sitting in a blank search field must not hold the whole app stale.
    assert.equal(focusedFieldHasContent({ tagName: "INPUT", type: "text", value: "" }), false);
    assert.equal(focusedFieldHasContent({ tagName: "INPUT", type: "text", value: "   " }), false);
    assert.equal(focusedFieldHasContent({ tagName: "INPUT", type: "text", value: "abc" }), true);
    assert.equal(focusedFieldHasContent({ tagName: "TEXTAREA", value: "half an answer" }), true);
    assert.equal(focusedFieldHasContent({ isContentEditable: true, textContent: "notes" }), true);
    assert.equal(focusedFieldHasContent({ isContentEditable: true, textContent: "" }), false);
});

check("a button or a checkbox is not typing", () => {
    assert.equal(focusedFieldHasContent({ tagName: "BUTTON" }), false);
    assert.equal(focusedFieldHasContent({ tagName: "INPUT", type: "checkbox", value: "on" }), false);
    assert.equal(focusedFieldHasContent({ tagName: "INPUT", type: "range", value: "50" }), false);
    assert.equal(focusedFieldHasContent(null), false);
});

// ─── polling ────────────────────────────────────────────────────────────────

check("a hidden tab is not polled", () => {
    const d = decideRefresh({ now: NOW, hidden: true, live: true, lastRefreshAt: 0 });
    assert.equal(d.action, "skip");
    assert.equal(d.reason, "hidden");
});

check("but coming BACK to the tab forces one through", () => {
    // This is the case that actually matters: you look at the screen, and it
    // is current. Even mid-poll-interval.
    const d = decideRefresh({ now: NOW, hidden: false, force: true, lastRefreshAt: NOW - 100 });
    assert.equal(d.action, "refresh");
});

check("a live contest polls faster than a quiet account", () => {
    assert.ok(LIVE_POLL_MS < IDLE_POLL_MS);
    const live = decideRefresh({ now: NOW, live: true, lastRefreshAt: NOW - LIVE_POLL_MS });
    assert.equal(live.action, "refresh");
    const idle = decideRefresh({ now: NOW, live: false, lastRefreshAt: NOW - LIVE_POLL_MS });
    assert.equal(idle.action, "skip", "nothing is racing, so there is nothing to keep up with");
});

check("focus, visibility and a route change do not fire three refetches", () => {
    // They all land together when somebody alt-tabs back in.
    const d = decideRefresh({ now: NOW, requested: true, lastRefreshAt: NOW - (MIN_GAP_MS - 1) });
    assert.equal(d.action, "skip");
    assert.equal(d.reason, "too soon");
});

// ─── the busy registry ──────────────────────────────────────────────────────

check("TWO BUSY SURFACES AT ONCE, and the first to finish does not free the app", () => {
    // A call-out quiz has a timer running inside it. A boolean would let the
    // timer unmounting declare the quiz over.
    const reg = createBusyRegistry();
    const quiz = reg.acquire(BUSY.CALLOUT);
    const timer = reg.acquire(BUSY.TIMER);
    assert.deepEqual(reg.reasons().sort(), [BUSY.CALLOUT, BUSY.TIMER].sort());
    reg.release(timer);
    assert.deepEqual(reg.reasons(), [BUSY.CALLOUT]);
    reg.release(quiz);
    assert.deepEqual(reg.reasons(), []);
});

check("releasing a token twice is harmless", () => {
    const reg = createBusyRegistry();
    const t = reg.acquire(BUSY.AI);
    reg.release(t); reg.release(t);
    assert.equal(reg._size(), 0);
});

check("a change fires a listener, and a bad listener cannot wedge the app", () => {
    const reg = createBusyRegistry();
    let seen = 0;
    reg.onChange(() => { throw new Error("boom"); });
    reg.onChange(() => { seen += 1; });
    const t = reg.acquire(BUSY.QUIZ);
    reg.release(t);
    assert.equal(seen, 2);
});

check("unsubscribing stops the notifications", () => {
    const reg = createBusyRegistry();
    let seen = 0;
    const off = reg.onChange(() => { seen += 1; });
    reg.release(reg.acquire(BUSY.QUIZ));
    off();
    reg.release(reg.acquire(BUSY.QUIZ));
    assert.equal(seen, 2);
});

// ─── what moved ─────────────────────────────────────────────────────────────

const stand = (rows) => ({ rows });

check("THE FIRST SNAPSHOT ANIMATES NOTHING", () => {
    // Opening the app must not flash "+400 XP" for XP earned last week. A page
    // that animates everything on first paint teaches a student to ignore the
    // animation that matters.
    assert.equal(diffStandings(null, stand([{ email: "a", score: 400 }])), null);
    assert.equal(diffStandings(stand([]), null), null);
});

check("a score that moved is reported with its delta", () => {
    const d = diffStandings(
        stand([{ email: "a", name: "A", score: 400 }]),
        stand([{ email: "a", name: "A", score: 445 }]));
    assert.equal(d.changed.length, 1);
    assert.equal(d.changed[0].delta, 45);
});

check("a score that did not move reports nothing", () => {
    const rows = [{ email: "a", score: 400 }];
    assert.deepEqual(diffStandings(stand(rows), stand([...rows])).changed, []);
});

check("an overtake is reported, with where they came from", () => {
    const d = diffStandings(
        stand([{ email: "a", name: "A", score: 400 }, { email: "b", name: "B", score: 380 }]),
        stand([{ email: "b", name: "B", score: 420 }, { email: "a", name: "A", score: 400 }]));
    assert.equal(d.overtaken.length, 1);
    assert.equal(d.overtaken[0].email, "b");
    assert.equal(d.overtaken[0].from, 2);
    assert.equal(d.overtaken[0].to, 1);
});

check("SOMEBODY CLOSING ON YOU only fires when the gap actually NARROWED", () => {
    const before = stand([
        { email: "me", isMe: true, score: 400 },
        { email: "b", name: "Priya", score: 340 },
    ]);
    const after = stand([
        { email: "me", isMe: true, score: 400 },
        { email: "b", name: "Priya", score: 390 },
    ]);
    const d = diffStandings(before, after);
    assert.equal(d.caught.length, 1);
    assert.equal(d.caught[0].gap, 10);

    // A rival who was already close and did nothing is not news, or the alert
    // fires on every poll for the whole contest.
    assert.deepEqual(diffStandings(after, after).caught, []);
});

check("and only once they are actually close", () => {
    const before = stand([{ email: "me", isMe: true, score: 900 }, { email: "b", score: 100 }]);
    const after = stand([{ email: "me", isMe: true, score: 900 }, { email: "b", score: 300 }]);
    // Closed 800 → 600, which is a big move and still not a threat.
    assert.deepEqual(diffStandings(before, after).caught, []);
    assert.ok(CAUGHT_WITHIN > 0);
});

check("somebody joining is not a delta from zero", () => {
    const d = diffStandings(
        stand([{ email: "a", score: 400 }]),
        stand([{ email: "a", score: 400 }, { email: "new", score: 250 }]));
    assert.deepEqual(d.changed, [], "a row we have never seen has not moved");
});

// ─── is anything racing ─────────────────────────────────────────────────────

check("live means a running battle OR a call-out with a clock on it", () => {
    assert.equal(anythingLive({}).live, false);
    assert.equal(anythingLive({ battles: [{ status: "completed" }] }).live, false);
    assert.equal(anythingLive({ battles: [{ status: "active" }] }).live, true);
    assert.equal(anythingLive({ callouts: [{ status: "pending" }] }).live, true);
    assert.equal(anythingLive({ callouts: [{ status: "passed" }] }).live, false);
    const both = anythingLive({ battles: [{ status: "active" }], callouts: [{ status: "active" }] });
    assert.equal(both.battles, 1);
    assert.equal(both.callouts, 1);
});

console.log(`\n${passed} passed`);
