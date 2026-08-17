/**
 * aiModels — which model a student's work runs on, and what that buys them.
 *
 * The weekly ceiling is a number of dollars, so the model decides how much work
 * that ceiling contains. Sonnet is $3/$15 per million tokens and Haiku is $1/$5
 * — exactly a third — so the same allowance goes three times as far in Saver.
 *
 * ─── The nudge has to arrive early ──────────────────────────────────────────
 * The obvious design offers the cheaper model when someone hits the ceiling.
 * That offer cannot pay out: the ceiling counts dollars already spent, and
 * changing model does not refund them, it only makes the NEXT call cheaper. At
 * 100% the only honest thing to say is "resets Monday". The recommendation
 * therefore fires while there is still budget left to stretch — at 70%, where
 * the remaining third of the allowance is worth a whole week in Saver.
 *
 * ─── Why nothing here switches automatically ────────────────────────────────
 * Silently downgrading someone's output to protect a budget they cannot see is
 * how an app gets a reputation for having "got worse", with no way for the
 * student to discover why. Every function here recommends; the student decides.
 */
// Relative, not the @/ alias: server.mjs imports this module directly and Node
// has no alias resolution. Vite handles relative paths identically.
import { PRICES } from "./aiCost.js";

export const TIERS = {
    standard: {
        id: "standard",
        model: "claude-sonnet-4-6",
        label: "Standard",
        blurb: "Full-strength answers. The default.",
    },
    saver: {
        id: "saver",
        model: "claude-haiku-4-5",
        label: "Saver",
        blurb: "Shorter answers, and this week's allowance goes much further.",
    },
};

export const DEFAULT_TIER = "standard";

/**
 * Features that stay on the full model even in Saver.
 *
 * THE LEVER, and deliberately empty. Quiz marking is the obvious candidate —
 * it is the one place a student directly feels model quality, and a mark that
 * is wrong is worse than a paragraph that is short. But whether Haiku actually
 * marks a VCE response materially worse than Sonnet is a measurable claim and
 * nobody has measured it, so baking the exclusion in now would be asserting it.
 *
 * Add "quiz_ai_mark" here the moment marking data says so. Nothing else needs
 * to change; the server reads this on every call.
 */
export const SAVER_EXCLUDES = [];

/** Fraction of the ceiling at which switching is still worth recommending. */
export const NUDGE_AT = 0.70;

/** Normalise whatever is on the profile into a tier we actually have. */
export function tierOf(preference) {
    const id = String(preference || "").trim();
    return TIERS[id] ? id : DEFAULT_TIER;
}

/**
 * The model id a given feature should run on.
 *
 * `fastModel` is the pre-existing per-call `fast: true` route (used by latency
 * sensitive tools). It only applies in Standard — in Saver the tier is already
 * the cheaper of the two, and letting a "fast" flag override it would move a
 * student's work back UP the price list while they are trying to economise.
 */
export function modelFor(preference, feature, { fast = false, standardModel, fastModel } = {}) {
    const tier = tierOf(preference);
    const standard = standardModel || TIERS.standard.model;
    if (tier === "saver" && !SAVER_EXCLUDES.includes(feature)) return TIERS.saver.model;
    return fast ? (fastModel || standard) : standard;
}

/**
 * How much further Saver stretches a dollar, from the real price table.
 *
 * Computed rather than written as "3x" so the claim in the UI cannot drift away
 * from what the models actually cost. Weighted toward output, which dominates
 * spend on the generation-heavy features this applies to.
 */
export function saverMultiplier() {
    const s = PRICES[TIERS.standard.model];
    const h = PRICES[TIERS.saver.model];
    if (!s || !h) return 1;
    const ratio = (s.in + s.out * 3) / (h.in + h.out * 3);
    return Math.round(ratio * 10) / 10;
}

/**
 * Should we suggest switching, and what do we honestly say?
 *
 * Returns null when there is nothing useful to offer — already in Saver, or so
 * close to the ceiling that switching cannot help.
 */
export function saverNudge({ preference, spentMicros, capMicros }) {
    if (tierOf(preference) === "saver") return null;
    if (!capMicros || capMicros <= 0) return null;
    const used = spentMicros / capMicros;
    if (used < NUDGE_AT) return null;
    if (used >= 1) return null;   // nothing left to stretch — see the note above
    return {
        usedPct: Math.round(used * 100),
        multiplier: saverMultiplier(),
        headline: `You've used ${Math.round(used * 100)}% of this week's AI.`,
        body: `Saver mode gets about ${saverMultiplier()}x more out of what's left. `
            + `Answers get shorter, everything still works, and you can switch back any time.`,
    };
}
