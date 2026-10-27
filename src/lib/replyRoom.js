/**
 * replyRoom — how many tokens a streamed reply may use, and what to say when
 * one comes back with nothing in it.
 *
 * ─── A CAP THAT INCLUDES THINKING IS NOT A REPLY CAP ─────────────────────────
 * The chat capped its replies at 2048 tokens to keep them conversational and
 * cheap. That was written for Sonnet 4.6, which does not think unless asked.
 * The current generation THINKS BY DEFAULT — omitting `thinking` runs adaptive
 * thinking — and thinking tokens count against `max_tokens`. On a short
 * question it thinks a little and the cap still fits. On a long essay to mark
 * it thinks a lot, the whole 2048 goes on thinking, the stream ends with
 * `stop_reason: "max_tokens"` and not one text token, and the chat printed
 * "…". The student was billed for 2048 tokens and given nothing.
 *
 * So the cap is the REPLY plus room to think. It does not raise the cost of a
 * reply that already fitted: the model stops when it is done, and a cap is a
 * ceiling rather than a spend. What it changes is the case that used to pay
 * for a whole cap and deliver nothing.
 *
 * ─── AN UNKNOWN MODEL GETS THE ROOM ──────────────────────────────────────────
 * An id this does not recognise is treated as one that thinks. Room a model
 * does not use costs nothing; room a thinking model needs and does not get is
 * an empty reply. The generous direction is the safe one here.
 *
 * Imported by server.mjs, so it stays plain and relative.
 */

/** Tokens of thinking a reply may spend before it starts writing. */
export const THINKING_ROOM = 8192;

/**
 * Whether a model thinks when the request does not mention thinking.
 * Every Claude 5 model does (Sonnet, Opus, Haiku, Fable, Mythos); the 4.x
 * models this app has run on — Sonnet 4.6, Opus 4.8, Haiku 4.5 — do not.
 */
export function thinksByDefault(model) {
    const m = /^claude-(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-|$)/.exec(String(model || ""));
    if (!m) return true;
    return Number(m[1]) >= 5;
}

/** `max_tokens` for a reply of `replyTokens` visible tokens on `model`. */
export function replyCap(model, replyTokens) {
    const reply = Math.max(1, Math.floor(Number(replyTokens) || 0));
    return reply + (thinksByDefault(model) ? THINKING_ROOM : 0);
}

/**
 * What the student reads when a reply has no text in it. Said in the reply's
 * own place, because "…" said nothing and the toast beside it disappeared.
 */
export function emptyReplyMessage(stopReason) {
    if (stopReason === "max_tokens") {
        return "That one ran out of room before it could write anything. Send it again, or send a shorter piece — a paragraph or two at a time works well.";
    }
    if (stopReason === "refusal") {
        return "That one could not be answered as it was sent. Try rewording it, or send a smaller part of it.";
    }
    if (stopReason === "stopped") {
        return "Stopped before it wrote anything.";
    }
    return "That reply came back empty. Send it again.";
}
