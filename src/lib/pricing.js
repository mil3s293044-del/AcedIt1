/**
 * pricing — the figures the app charges and compares itself against, once.
 *
 * `$5` was typed into seventeen places across eleven files and `TUTOR_HOURLY`
 * / `ACEDIT_WEEKLY` were each declared twice at the same value with nothing
 * importing either. That is the shape this codebase already fixed for the AI
 * tool count, which "was hand-written as three different numbers across five
 * screens" — except this is the number a student is CHARGED, so the drift is
 * not a wrong count on a feature list, it is a price the app advertises and
 * does not take.
 *
 * `priceLabel()` is the printer. Everything that shows the price goes through
 * it rather than through a template of its own, because the two formats in use
 * — "$5" and "$5.00 AUD" — are a decision about a receipt versus a headline
 * and not something each page should re-make.
 *
 * WHAT IS NOT HERE: the Stripe price id. That lives in
 * `VITE_STRIPE_PRICE_PREMIUM` and Stripe is the one that actually charges, so
 * this module states what the COPY must say and cannot promise the two agree.
 * Changing the price means changing both, and Stripe is the source of truth
 * for the charge.
 */

/** AUD per week for Premium. */
export const PREMIUM_WEEKLY_AUD = 5;

/** What a Melbourne VCE tutor costs an hour — the comparison, not a price. */
export const TUTOR_HOURLY_AUD = 90;

/**
 * The free trial, in days.
 *
 * READ THE NOTE BEFORE TRUSTING THIS. It is what every marketing surface
 * promises ("7 days free", "7-day free trial") and what /Paywall passes to
 * Stripe as `trial_period_days`. It is NOT what a student currently gets:
 * /Paywall has no inbound links, every reachable route to paying goes through
 * /Checkout, and /Checkout sends no trial at all — so Stripe charges on the
 * spot. `trial_active` and `trial_ends_at` are real columns, read in four
 * places, and written by nothing in the client or the server.
 *
 * Closing that is a pricing decision rather than a bug fix, so it is recorded
 * here and in CLAUDE.md rather than quietly applied.
 */
export const TRIAL_DAYS = 7;

/** How many weeks of AcedIt one hour of tutoring buys. */
export function weeksPerTutorHour() {
    return Math.round(TUTOR_HOURLY_AUD / PREMIUM_WEEKLY_AUD);
}

/**
 * The price as copy. `cents` is the receipt form — a total due has to show the
 * cents or it does not read as a charge.
 */
export function priceLabel({ cents = false, currency = false } = {}) {
    const n = cents ? PREMIUM_WEEKLY_AUD.toFixed(2) : String(PREMIUM_WEEKLY_AUD);
    return `$${n}${currency ? " AUD" : ""}`;
}
