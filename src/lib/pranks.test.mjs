/**
 * prank assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/pranks.test.mjs
 *
 * This is the only feature in the app where one student does something TO
 * another, on a product whose users are mostly fifteen to eighteen and which is
 * being sold to schools. Migration 0034 ruled out free text on Compete in its
 * own words; this ships only because every bound below holds, so every bound
 * below is asserted rather than described.
 *
 * The two that matter most are the RECEIVE cap — a send cap bounds each sender
 * and does nothing about a class arriving at once — and the fact that the two
 * recipient-side refusals are INDISTINGUISHABLE, because a refusal that named
 * which one would turn this into a way of finding out who has opted out.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    KINDS, PRANK_LIST, prankKind, optedOut,
    WEEKLY_SEND_MAX, WEEKLY_RECEIVE_MAX, maySend, mayReceive, canSend,
} from "@/lib/pranks";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const friend = { extra: {} };

check("A RECEIVE CAP IS THE ONE THAT STOPS A PILE-ON", () => {
    // Five each from thirty students is a hundred and fifty, which is not a
    // joke. Past the ceiling every further prank is refused whoever sends it.
    assert.equal(canSend({ kind: "shake", target: friend, isFriend: true, receivedThisWeek: WEEKLY_RECEIVE_MAX }).ok, false);
    assert.equal(canSend({ kind: "shake", target: friend, isFriend: true, receivedThisWeek: WEEKLY_RECEIVE_MAX - 1 }).ok, true);
    // And it is TIGHTER than the send cap: better to hold a prank you cannot
    // deliver than to receive one you did not want.
    assert.ok(WEEKLY_RECEIVE_MAX < WEEKLY_SEND_MAX,
        "the receive ceiling must be the tighter of the two");
});

check("THE TWO RECIPIENT REFUSALS CANNOT BE TOLD APART", () => {
    // Otherwise the shelf becomes a way of discovering who has opted out, and
    // that person is exactly who a determined sender would then work around.
    const off = canSend({ kind: "shake", target: { extra: { pranks_opt_out: true } }, isFriend: true });
    const full = canSend({ kind: "shake", target: friend, isFriend: true, receivedThisWeek: WEEKLY_RECEIVE_MAX });
    assert.equal(off.ok, false);
    assert.equal(full.ok, false);
    assert.equal(off.reason, full.reason, "a sender can tell an opt-out from a full week");
    assert.doesNotMatch(off.reason, /opt|off|turned|block/i, "the refusal names the opt-out");
});

check("YOUR OWN LIMIT NAMES ITSELF, because you can act on it", () => {
    const v = canSend({ kind: "shake", target: friend, isFriend: true, sentThisWeek: WEEKLY_SEND_MAX });
    assert.equal(v.ok, false);
    assert.match(v.reason, new RegExp(String(WEEKLY_SEND_MAX)));
    // And it is checked BEFORE theirs: a sender told "they can't receive one"
    // when they had also run out themselves would fix the wrong thing.
    const both = canSend({
        kind: "shake", target: friend, isFriend: true,
        sentThisWeek: WEEKLY_SEND_MAX, receivedThisWeek: WEEKLY_RECEIVE_MAX,
    });
    assert.match(both.reason, /you have sent/i);
});

check("FRIENDS ONLY, and a stranger is refused before anything else", () => {
    assert.equal(canSend({ kind: "shake", target: friend, isFriend: false }).ok, false);
    assert.match(canSend({ kind: "shake", target: friend, isFriend: false }).reason, /friend/i);
});

check("THE VOCABULARY IS FIXED — there is no free text anywhere", () => {
    // The most hostile thing that can arrive is a screen that wobbles.
    for (const k of PRANK_LIST) {
        assert.equal(typeof k.label, "string");
        assert.ok(k.ms > 0 && k.ms <= 5000, `${k.id} lasts ${k.ms}ms`);
        assert.ok(k.price > 0, `${k.id} is free`);
    }
    assert.equal(prankKind("nope"), null, "an unknown kind resolved to something");
    assert.equal(prankKind(""), null);
    assert.equal(prankKind(undefined), null);
    assert.equal(canSend({ kind: "<script>", target: friend, isFriend: true }).ok, false);
});

check("A PRANK CANNOT REACH ANYTHING A STUDENT IS MEASURED ON", () => {
    // Asserted as an ABSENCE over the module, the same shape the refund rule
    // takes: the day somebody adds an effect that touches a mark is the day
    // this stops being a prank and becomes a penalty that was bought.
    const src = readFileSync("src/lib/pranks.js", "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    // WORD-BOUNDED, because `/xp/i` matches `export` — the false-positive class
    // `fnResult.test.mjs` and `hookDeps.test.mjs` each had to learn, arriving
    // here for the third time.
    for (const forbidden of [/\bxp\b/i, /\bstreak/i, /\batar\b/i, /\bmarks?\b/i,
        /\bscore/i, /\bflashcard/i, /cred_balance/]) {
        assert.doesNotMatch(src, forbidden, `pranks.js reaches for ${forbidden}`);
    }
});

check("optedOut is explicit — an unset field is not an opt-out", () => {
    assert.equal(optedOut({ extra: { pranks_opt_out: true } }), true);
    assert.equal(optedOut({ extra: {} }), false);
    assert.equal(optedOut({}), false);
    assert.equal(optedOut(null), false);
    // Only the boolean counts, so a stray truthy value cannot silently opt
    // somebody out of a thing they never answered.
    assert.equal(optedOut({ extra: { pranks_opt_out: "no" } }), false);
});

check("a missing target is refused rather than broadcast", () => {
    assert.equal(mayReceive({ target: null }).ok, false);
    assert.equal(mayReceive({}).ok, false);
    assert.equal(maySend({ kind: "shake", isFriend: true }).ok, true);
});

console.log(`\npranks: ${passed} checks passed\n`);
