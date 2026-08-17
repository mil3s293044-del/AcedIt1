/**
 * aiCost — what an AI call actually cost, in micro-dollars.
 *
 * This is the arithmetic the weekly spend ceiling rests on, so it lives in its
 * own module with its own assertions rather than inline in the 7,000-line
 * server. A screenshot cannot check a rounding rule.
 *
 * ─── Why micro-dollars ──────────────────────────────────────────────────────
 * Spend used to be stored as an integer number of cents, and every estimate
 * ended in `Math.round(dollars * 100)`. A typical Ace chat turn costs about
 * $0.0007. Rounded to the nearest cent that is ZERO, so Ace turns added nothing
 * to the weekly ceiling however many were sent, and the only thing bounding the
 * feature was its daily message counter. A micro-dollar is one millionth of a
 * dollar; the cheapest call we can make still registers in the hundreds.
 *
 * ─── Why input_tokens is NOT reduced by the cache fields ────────────────────
 * The Anthropic usage object reports `input_tokens` as the uncached remainder
 * ALREADY. The full prompt is:
 *
 *     input_tokens + cache_read_input_tokens + cache_creation_input_tokens
 *
 * The previous estimator computed `(input_tokens - cache_read - cache_write)`,
 * subtracting the cache fields a second time. On any call with a warm cache
 * that term goes deeply negative — a 5,000-token cached prompt with a 200-token
 * question gives (200 - 5000) — and the `Math.max(0, ...)` guard at the end
 * then billed the entire call as free. The two bugs compounded: small calls
 * rounded to nothing, and cached calls subtracted their way to nothing.
 *
 * ─── Why cache rates are derived, not typed ─────────────────────────────────
 * Cache reads bill at 0.1x the input rate and cache writes at 1.25x (the
 * 5-minute TTL). Deriving them from the base rate means a price table entry
 * cannot drift out of step with itself when a rate changes.
 */

/** One dollar. Every figure in this module is an integer count of these. */
export const MICROS_PER_DOLLAR = 1_000_000;

/** Published list rates, USD per million tokens. */
export const PRICES = {
    "claude-haiku-4-5":  { in: 1.00, out: 5.00 },
    "claude-sonnet-4-6": { in: 3.00, out: 15.00 },
    "claude-sonnet-5":   { in: 3.00, out: 15.00 },
    "claude-opus-4-8":   { in: 5.00, out: 25.00 },
    "claude-opus-5":     { in: 5.00, out: 25.00 },
};

const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

/**
 * An unknown model bills at the most expensive rate we know of.
 *
 * The alternative — billing zero, or picking a mid-range default — means a
 * typo in ANTHROPIC_MODEL silently uncaps spend. Over-billing an unknown model
 * trips the ceiling early, which is a support ticket. Under-billing it is a
 * bill. Erring toward the support ticket.
 */
const DEAREST = Object.values(PRICES).reduce(
    (worst, p) => (p.out > worst.out ? p : worst),
    { in: 0, out: 0 },
);

/**
 * Price table for a model id.
 *
 * Matches on longest prefix so dated snapshots resolve to their family:
 * `claude-haiku-4-5-20251001` finds the `claude-haiku-4-5` entry. Returns the
 * dearest known rate for anything unrecognised.
 */
export function priceFor(model) {
    const id = String(model || "");
    if (PRICES[id]) return PRICES[id];
    let best = null;
    for (const key of Object.keys(PRICES)) {
        if (id.startsWith(key) && (!best || key.length > best.length)) best = key;
    }
    return best ? PRICES[best] : DEAREST;
}

/** True when `model` is absent from the price table (caller may want to warn). */
export function isUnpricedModel(model) {
    const id = String(model || "");
    if (PRICES[id]) return false;
    return !Object.keys(PRICES).some((key) => id.startsWith(key));
}

/**
 * Cost of one call, in whole micro-dollars.
 *
 * `usage` is the Anthropic usage object. Missing fields count as zero, so a
 * provider that omits the cache counters simply bills its input and output.
 */
export function estimateCostMicros(usage, model) {
    if (!usage) return 0;
    const price = priceFor(model);

    const input      = Math.max(0, Number(usage.input_tokens) || 0);
    const cacheRead  = Math.max(0, Number(usage.cache_read_input_tokens) || 0);
    const cacheWrite = Math.max(0, Number(usage.cache_creation_input_tokens) || 0);
    const output     = Math.max(0, Number(usage.output_tokens) || 0);

    const perToken = (rate) => rate / 1_000_000;
    const dollars =
        input      * perToken(price.in) +
        cacheRead  * perToken(price.in * CACHE_READ_MULTIPLIER) +
        cacheWrite * perToken(price.in * CACHE_WRITE_MULTIPLIER) +
        output     * perToken(price.out);

    return Math.round(dollars * MICROS_PER_DOLLAR);
}

/** Micro-dollars as a display string, e.g. 1950000 → "$1.95". */
export function formatMicros(micros) {
    return `$${(Number(micros || 0) / MICROS_PER_DOLLAR).toFixed(2)}`;
}
