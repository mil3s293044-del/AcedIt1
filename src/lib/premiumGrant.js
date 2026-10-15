/**
 * premiumGrant — when a checkout makes somebody premium, and the one reveal
 * that earns them.
 *
 * ─── A PROMOTION CODE NEVER SAW THE ANIMATION ──────────────────────────────
 * `stripeCheckout` sets `allow_promotion_codes`, so a student can enter a code
 * at Stripe. A code that takes the first payment to $0 completes the checkout
 * with `payment_status: "no_payment_required"` — and `verifySubscription`
 * accepted exactly one status, `"paid"`. So the success page told a student
 * who had just been given premium that their payment "did not go through",
 * the reveal never played, and a few seconds later the webhook (which never
 * looked at the payment status at all) upgraded them in the background. They
 * ended up premium with nothing on screen ever saying so, after an error.
 *
 * `checkoutVerdict` is the one rule, and both halves of it are about the
 * SUBSCRIPTION rather than the money: a paid checkout, or a checkout that
 * needed no payment AND left an `active` subscription — which is what a code
 * that covers the price produces. A `trialing` subscription also needs no
 * payment and is deliberately NOT accepted here: whether a trial is offered is
 * an open decision recorded in `pricing.js`, and this file does not make it.
 *
 * ─── A CHECKOUT IS ONLY EVER ITS CREATOR'S ─────────────────────────────────
 * `verifySubscription` took a session id from the request and upgraded the
 * CALLER — without checking the session was theirs. A session id rides in the
 * success URL, so anybody handed somebody else's could have upgraded their own
 * account off another student's payment. The session carries the email it was
 * created for (`metadata.user_email`); a mismatch grants nothing.
 *
 * ─── THE REVEAL FOLLOWS THE GRANT, NOT THE PAGE ────────────────────────────
 * The reveal lived on /PaymentSuccess and nowhere else, so every upgrade that
 * landed any other way — the webhook first, a tab closed at Stripe, a page
 * that errored and was left — was celebrated nowhere. Whatever grants premium
 * now also writes `extra.premium_reveal.pending` with the subscription it
 * granted, and whichever screen shows the reveal first marks it `seen`. Layout
 * plays it once for a pending one, so it arrives on the student's next screen
 * however the grant got there.
 *
 * Three properties fall out, each held by the test:
 *   - the ~130 accounts that were premium before this have no marker, so
 *     nothing ambushes them;
 *   - re-running a grant (a reload of the success page, a webhook retry)
 *     writes the same `pending` again and never touches `seen`, so it does not
 *     replay;
 *   - a grant since revoked is not celebrated.
 *
 * Plain JS with no alias imports: `server.mjs` imports this file directly.
 */

export const REVEAL_KEY = "premium_reveal";

const lower = (s) => String(s || "").trim().toLowerCase();

/**
 * Does this completed checkout make the caller premium?
 * Returns `{ ok: true, via }` or `{ ok: false, reason }`.
 */
export function checkoutVerdict(session, subscription, callerEmail) {
    if (!session) return { ok: false, reason: "missing" };
    const owner = lower(session.metadata?.user_email);
    if (!owner || owner !== lower(callerEmail)) return { ok: false, reason: "not_yours" };
    if (session.status !== "complete") return { ok: false, reason: "incomplete" };
    if (session.payment_status === "paid") return { ok: true, via: "paid" };
    if (session.payment_status === "no_payment_required" && subscription?.status === "active") {
        return { ok: true, via: "code" };
    }
    return { ok: false, reason: session.payment_status === "no_payment_required" ? "not_active" : "unpaid" };
}

const extraOf = (extra) => (extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {});

/** `extra` with a reveal owed for this grant. `seen` is left exactly as it was. */
export function withRevealPending(extra, grantId, at = new Date().toISOString()) {
    const prev = extraOf(extra);
    if (!grantId) return prev;
    const cur = extraOf(prev[REVEAL_KEY]);
    return { ...prev, [REVEAL_KEY]: { ...cur, pending: String(grantId), at } };
}

/** `extra` with this grant's reveal marked as shown. */
export function withRevealSeen(extra, grantId) {
    const prev = extraOf(extra);
    if (!grantId) return prev;
    const cur = extraOf(prev[REVEAL_KEY]);
    return { ...prev, [REVEAL_KEY]: { ...cur, seen: String(grantId) } };
}

/** The grant whose reveal is still owed on this profile, or null. */
export function revealDue(profile) {
    const r = extraOf(profile?.extra?.[REVEAL_KEY]);
    if (!r.pending) return null;
    if (r.seen === r.pending) return null;
    if (profile?.subscription_tier !== "premium") return null;
    return String(r.pending);
}
