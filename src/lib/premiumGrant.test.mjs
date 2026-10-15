/**
 * premiumGrant assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/premiumGrant.test.mjs
 *
 * ═══ A CODE THAT GAVE PREMIUM WAS TOLD ITS PAYMENT FAILED ═══════════════════
 * Reported as "if a user uses a code, once they get approved for premium make
 * sure the animation plays". The success page accepted one payment status,
 * "paid", and a promotion code covering the price completes as
 * "no_payment_required" — so the student was shown an error, the reveal never
 * played, and the webhook upgraded them silently a moment later.
 *
 * Two halves are held here. The VERDICT: what a completed checkout must look
 * like to grant premium, including that it belongs to the caller. And the
 * REVEAL: that it follows the grant to whichever screen comes next, plays once,
 * never replays, and never ambushes an account that was premium before.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    checkoutVerdict, withRevealPending, withRevealSeen, revealDue, REVEAL_KEY, codeGrantId,
} from "@/lib/premiumGrant";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const ME = "student@example.com";
const session = (over = {}) => ({
    status: "complete", payment_status: "paid", metadata: { user_email: ME }, ...over,
});
const active = { id: "sub_1", status: "active" };

/* ─── The verdict ─────────────────────────────────────────────────────────── */

check("a paid checkout grants premium", () => {
    assert.deepEqual(checkoutVerdict(session(), active, ME), { ok: true, via: "paid" });
});

check("A CODE THAT COVERS THE PRICE GRANTS PREMIUM — the reported bug", () => {
    const v = checkoutVerdict(session({ payment_status: "no_payment_required" }), active, ME);
    assert.deepEqual(v, { ok: true, via: "code" }, "a $0 checkout with a live subscription was refused");
});

check("A TRIAL IS NOT DECIDED HERE", () => {
    // Also "no_payment_required", with a TRIALING subscription. Whether a
    // trial is offered is the open decision pricing.js records.
    const v = checkoutVerdict(session({ payment_status: "no_payment_required" }), { status: "trialing" }, ME);
    assert.equal(v.ok, false, "this file quietly decided the trial question");
});

check("unpaid and unfinished checkouts grant nothing", () => {
    assert.equal(checkoutVerdict(session({ payment_status: "unpaid" }), active, ME).ok, false);
    assert.equal(checkoutVerdict(session({ status: "open" }), active, ME).ok, false);
    assert.equal(checkoutVerdict(session({ status: "expired" }), active, ME).ok, false);
    assert.equal(checkoutVerdict(null, active, ME).ok, false);
});

check("A CHECKOUT IS ONLY EVER ITS CREATOR'S", () => {
    // A session id rides in the success URL; another student's must not
    // upgrade the caller.
    assert.deepEqual(checkoutVerdict(session(), active, "someone@else.com"), { ok: false, reason: "not_yours" });
    assert.equal(checkoutVerdict(session({ metadata: {} }), active, ME).ok, false, "a session with no owner granted premium");
    assert.equal(checkoutVerdict(session(), active, "").ok, false);
    assert.equal(checkoutVerdict(session(), active, " Student@Example.com ").ok, true,
        "the same address in different case was refused");
});

/* ─── The reveal ──────────────────────────────────────────────────────────── */

const premium = (extra) => ({ subscription_tier: "premium", extra });

check("a grant leaves the reveal owed, and keeps everything else in extra", () => {
    const extra = withRevealPending({ daily_intent: { mode: "cram" } }, "sub_1", "2026-10-15T00:00:00Z");
    assert.deepEqual(extra.daily_intent, { mode: "cram" }, "the grant wiped the rest of extra");
    assert.equal(revealDue(premium(extra)), "sub_1");
});

check("NOBODY PREMIUM BEFORE THIS IS AMBUSHED", () => {
    assert.equal(revealDue(premium({})), null);
    assert.equal(revealDue(premium(null)), null);
    assert.equal(revealDue(null), null);
});

check("shown once — and a re-run of the grant never replays it", () => {
    let extra = withRevealPending({}, "sub_1");
    extra = withRevealSeen(extra, "sub_1");
    assert.equal(revealDue(premium(extra)), null, "a seen reveal is still owed");
    // A reload of the success page, or a webhook retry, grants again.
    extra = withRevealPending(extra, "sub_1");
    assert.equal(revealDue(premium(extra)), null, "re-running the grant replayed the reveal");
    assert.equal(extra[REVEAL_KEY].seen, "sub_1", "the grant overwrote what had been seen");
});

check("a NEW grant is owed again — a student who comes back after cancelling", () => {
    let extra = withRevealSeen(withRevealPending({}, "sub_1"), "sub_1");
    extra = withRevealPending(extra, "sub_2");
    assert.equal(revealDue(premium(extra)), "sub_2");
});

check("a grant since revoked is not celebrated", () => {
    const extra = withRevealPending({}, "sub_1");
    assert.equal(revealDue({ subscription_tier: "free", extra }), null);
});

/* ─── A Year 10 code ──────────────────────────────────────────────────────── */

// A code switches Premium on through `code_premium_until` and leaves
// `subscription_tier` exactly as it was — so a reveal keyed on the tier alone
// is owed and never due.
const coded = (extra, until = new Date(Date.now() + 21 * 864e5).toISOString()) =>
    ({ subscription_tier: "free", code_premium_until: until, extra });

check("A CODE IS PREMIUM TOO — its reveal is due with the tier still free", () => {
    const extra = withRevealPending({}, codeGrantId("year10ace"));
    assert.equal(revealDue(coded(extra)), "code:YEAR10ACE", "a redeemed code's reveal never comes due");
});

check("an expired code is not celebrated, any more than a cancelled subscription", () => {
    const extra = withRevealPending({}, codeGrantId("YEAR10ACE"));
    assert.equal(revealDue(coded(extra, "2020-01-01T00:00:00Z")), null);
});

check("one code is one reveal, whatever case it was typed in", () => {
    let extra = withRevealSeen(withRevealPending({}, codeGrantId("year10ace")), codeGrantId("YEAR10ACE"));
    assert.equal(revealDue(coded(extra)), null, "the same code read as two grants");
    extra = withRevealPending(extra, codeGrantId("SECOND1"));
    assert.equal(revealDue(coded(extra)), "code:SECOND1", "a second code was not celebrated");
});

/* ─── The wiring ──────────────────────────────────────────────────────────── */

const server = strip(read("server.mjs"));
const block = (name) => {
    const i = server.indexOf(`app.post("/local-ai/fn/${name}"`);
    assert.ok(i > -1, `${name} is gone — re-point this check`);
    const j = server.indexOf("app.post(", i + 10);
    return server.slice(i, j > -1 ? j : undefined);
};

check("verification asks the verdict, and the old single-status gate is gone", () => {
    const v = block("verifySubscription");
    assert.match(v, /checkoutVerdict\(session, subscription, user\.email\)/);
    assert.doesNotMatch(v, /payment_status\s*!==\s*["']paid["']/, "the one-status gate that refused every code is back");
    assert.match(server, /from "\.\/src\/lib\/premiumGrant\.js"/, "server imports the rules through an alias node cannot resolve");
});

check("BOTH grants owe the reveal — the success page AND the webhook", () => {
    assert.match(block("verifySubscription"), /withRevealPending\(/, "verification grants without owing the reveal");
    assert.match(block("stripe-webhook"), /withRevealPending\(/, "the webhook — often the first grant — owes nothing");
    assert.match(block("verifySubscription"), /reveal_id:\s*subscription\.id/, "the page is not told which grant it is revealing");
});

check("the success page marks its own reveal seen, or Layout plays it twice", () => {
    const src = strip(read("src/pages/PaymentSuccess.jsx"));
    assert.match(src, /withRevealSeen\([^)]*result\.reveal_id\)/);
});

check("Layout plays an owed reveal — once, after the age gate, never on the success page", () => {
    const src = strip(read("src/Layout.jsx"));
    assert.match(src, /revealDue\(userProfile\)/, "nothing outside the success page plays the reveal");
    assert.match(src, /withRevealSeen\(userProfile\.extra, owedReveal\)/, "it is never marked seen, so it replays every load");
    assert.match(src, /pageKey === "PaymentSuccess"/, "it would play twice on the success page");
    assert.match(src, /BAND\.UNKNOWN/, "it would play over the age gate");
    assert.match(src, /<PremiumReveal\b/);
});

check("redeeming a code owes the reveal and says which grant it is", () => {
    const r = block("redeemPremiumCode");
    assert.match(r, /withRevealPending\([^)]*revealId\)/, "a redeemed code owes no reveal");
    assert.match(r, /const revealId = codeGrantId\(code\)/);
    assert.match(r, /reveal_id:\s*revealId/, "the code screen is not told which grant to reveal");
});

check("THE CODE SCREEN PLAYS THE REVEAL, and marks it shown with the grant it was handed", () => {
    // It ended on a static tick card while a paid checkout got Ace dealing
    // the ace — the student handed Premium by their school got less.
    const src = strip(read("src/components/subscription/RedeemCode.jsx"));
    assert.match(src, /<PremiumReveal\b/, "a redeemed code is told in a sentence and nothing plays");
    assert.match(src, /markSeen\(result\?\.reveal_id\)/, "never marked shown, so Layout plays it again next screen");
    assert.match(src, /withRevealSeen\(rows\[0\]\.extra, revealId\)/);
    assert.match(src, /createPortal\(/, "a fixed overlay inside a transformed ancestor is not the viewport");
    // Drawn on the answer, not merely imported: the redemption has to switch
    // it on and the overlay has to be gated on that and nothing else.
    assert.match(src, /markSeen\(result\?\.reveal_id\);\s*setRevealing\(true\)/, "a redemption never switches the reveal on");
    assert.match(src, /\{revealing && typeof document !== "undefined" && createPortal\(/, "the overlay is gated on something other than the redemption");
    // Leaving waits for the mark, or the full load beats the write.
    assert.match(src, /await marking\.current[\s\S]{0,120}onContinue\(\)/);
});

check("the reveal's fallback survives a re-render", () => {
    // Keyed on an inline onContinue, the twenty-second timer restarted on
    // every render of Layout and never fired.
    const src = strip(read("src/components/subscription/PremiumReveal.jsx"));
    const deps = /setTimeout\([^;]*fallbackMs\);[\s\S]*?\}, \[([^\]]*)\]\);/.exec(src);
    assert.ok(deps, "the fallback timer is gone");
    assert.doesNotMatch(deps[1], /onContinue/, "the fallback restarts every time the caller re-renders");
});

check("the reveal claims the Ace stage, ranked as a celebration", () => {
    assert.match(strip(read("src/components/subscription/PremiumReveal.jsx")), /claimAce\(\s*["']premium["']\s*\)/);
});

console.log(`\npremiumGrant: ${passed} checks passed`);
