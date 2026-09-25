/**
 * the replay channel, and where its entry lives —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/aceReplay.test.mjs
 *
 * Two rules, and both are about ORDER rather than about behaviour anybody can
 * see on screen — which is why they get a test rather than a comment.
 *
 * A request is STICKY. The first run hands over to the tour at its close, and
 * Layout keeps AceTour unmounted for as long as the run is live, so the
 * handover fires at a component that does not exist yet. A plain event is lost
 * there, silently, and the one button on the close does nothing.
 *
 * And a request is claimed ONCE. Both surfaces claim on mount AND listen while
 * mounted, because either order is possible; without `take` clearing it, a
 * component that does both would start itself twice.
 */
import assert from "node:assert/strict";
import { RUN, TOUR, requestAce, takeAceRequest, onAceRequest, _resetAceRequests } from "@/lib/aceReplay";
import { showRunCard, ENTRY_WINDOW_HOURS, WINDOW_HOURS, replayPatch } from "@/lib/firstWin";

let passed = 0;
const check = (name, fn) => {
    try { _resetAceRequests(); fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const NOW = Date.UTC(2026, 7, 29, 12, 0, 0);
const aged = (hours, first_win = null) => ({
    id: "p1",
    created_date: new Date(NOW - hours * 3_600_000).toISOString(),
    extra: first_win ? { first_win } : {},
});

check("a request waits for a listener that has not mounted yet", () => {
    requestAce(TOUR);
    assert.equal(takeAceRequest(TOUR), true, "the handover was lost — this is the close button doing nothing");
    assert.equal(takeAceRequest(TOUR), false, "claimed twice, so the tour would start over itself");
});

check("the two channels are independent", () => {
    requestAce(RUN);
    assert.equal(takeAceRequest(TOUR), false, "asking for the run started the tour");
    assert.equal(takeAceRequest(RUN), true);
});

check("nothing outstanding claims nothing", () => {
    assert.equal(takeAceRequest(RUN), false);
    assert.equal(takeAceRequest(TOUR), false);
});

check("onAceRequest is safe with no window, and unsubscribes", () => {
    // Node has no window; the module must not throw on import or on use, or
    // every test that imports a component through it dies.
    const off = onAceRequest(RUN, () => { throw new Error("fired with no window"); });
    assert.equal(typeof off, "function");
    off();
});

check("a replay starts from scratch, never from last time's quiz", () => {
    const p = replayPatch();
    assert.equal(p.status, "active");
    assert.equal(p.beat, "subject");
    for (const k of ["subject", "problem", "quiz_id", "finished_at"]) {
        assert.equal(p[k], null, `${k} carried over — they would resume somebody else's run`);
    }
    assert.ok(p.started_at, "a run with no start time cannot be told from one that never began");
});

check("THE CARD NEVER ASKS TWICE", () => {
    // Inside the window with nothing stored, the run opens itself. A card
    // beside it is the app asking the same question from two places.
    assert.equal(showRunCard(aged(2), { now: NOW }), false);
    assert.equal(showRunCard(aged(2, { status: "active", beat: "problem" }), { now: NOW }), false,
        "offered a restart over the top of a run in progress");
});

check("it offers the run back to somebody who closed it", () => {
    assert.equal(showRunCard(aged(2, { status: "skipped" }), { now: NOW }), true,
        "dismissing Ace on minute one is the case this whole card exists for");
    assert.equal(showRunCard(aged(30, { status: "done" }), { now: NOW }), true);
});

check("and to somebody the window shut on before they got to it", () => {
    assert.ok(ENTRY_WINDOW_HOURS > WINDOW_HOURS,
        "the card has to outlive the automatic offer or it can never be the way back");
    assert.equal(showRunCard(aged(WINDOW_HOURS + 1), { now: NOW }), true);
});

check("past the window it is gone from the dashboard — it is on Help", () => {
    assert.equal(showRunCard(aged(ENTRY_WINDOW_HOURS + 1, { status: "skipped" }), { now: NOW }), false);
    assert.equal(showRunCard(aged(24 * 90, { status: "done" }), { now: NOW }), false);
});

check("an unknown age counts as OLD, the way every other age check here errs", () => {
    assert.equal(showRunCard({ id: "p1", extra: { first_win: { status: "skipped" } } }, { now: NOW }), false);
    assert.equal(showRunCard(null, { now: NOW }), false);
});

console.log(`\n${passed} passed`);
