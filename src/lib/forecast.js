/**
 * forecast — calling your own study, and being scored on how well you call it.
 *
 * ─── What this replaces, and why it had to go ───────────────────────────────
 * The wagering layer could not lose. `resolveScoreWager` settled on "user
 * enters their actual assessment score" — a number typed by the person who
 * placed the bet — and the form that typed it was PRE-FILLED with their own
 * prediction (`useState(me?.actual_result ?? me?.self_line ?? 75)`). So the
 * default path was: set a line, open the form, press submit, collect 3×. With
 * `bet_win` capped at 2000 XP a day it was the largest faucet in the app and
 * the only one that required no study at all.
 *
 * Two more things were wrong with it as a GAME, separately from the exploit:
 *
 *   NO ODDS.  A flat 1.8× on the client and a flat 3×/1.5× on the server, so
 *             backing a certainty paid exactly what backing a longshot paid.
 *             A market's price IS its information; a constant carries none.
 *   NO COUNTERPARTY. You set your own line and settled your own outcome, so
 *             nothing anybody did was a claim against anyone.
 *
 * ─── What it is now ─────────────────────────────────────────────────────────
 * A forecast is a PROBABILITY on a question the app can settle from its own
 * rows. You are scored against the house's base rate with a proper scoring
 * rule, so the only way to gain is to know something the base rate does not.
 * Agreeing with the house pays exactly nothing — which is the property that
 * makes this unfarmable, and the reason it is worth playing.
 */

import { studyEvents, dayKey, weekStart } from "@/lib/studyLog";
import { effectiveScore } from "@/lib/quizDeck";
import { isRetryAttempt } from "@/lib/quizInsight";

// ─── Scoring ────────────────────────────────────────────────────────────────

/**
 * The Brier score: the squared error of a probability against what happened.
 * Zero is perfect, 1 is maximally wrong, 0.25 is the shrug of saying 50%.
 */
export const brier = (p, outcome) => (clampP(p) - (outcome ? 1 : 0)) ** 2;

export const clampP = (p) => Math.min(1, Math.max(0, Number(p) || 0));

/**
 * How much better your call was than the house's, in Brier terms.
 *
 * Positive when you were closer to what happened than the base rate was;
 * negative when you were further. EXACTLY ZERO when you simply repeated the
 * base rate, which is the whole design: restating what the app already told
 * you is not a forecast and must not pay.
 */
export const skill = (p, base, outcome) => brier(base, outcome) - brier(p, outcome);

/**
 * XP is `stake × K × skill`, and it is symmetric.
 *
 * ─── Why a proper scoring rule rather than a multiplier ─────────────────────
 * Under a fixed multiplier the optimal play is to find the safest question and
 * repeat it, which is what the old system paid for. Under this one your best
 * strategy is to state what you actually believe: overstating your confidence
 * costs you exactly as much when you are wrong as it wins when you are right,
 * so there is no number to game — only a belief to get right.
 *
 * ─── K IS 1, AND A CLAMP HERE WOULD BREAK THE RULE ──────────────────────────
 * `skill` lands in [-1, 1], so at K = 1 the payout is already bounded by the
 * stake in both directions and no clamp is needed. That matters more than it
 * looks: this was K = 2 with `Math.max(-stake, …)` holding the downside, and
 * the clamp destroyed properness in the tails. Against a house at 50% with a
 * true probability of 10%, saying 0% beat saying 10% — once a call is past the
 * point where the clamp bites, extra confidence is FREE, so the rule paid for
 * overstatement exactly where it should have punished it.
 *
 * The bound now comes from the escrow instead: the stake is taken when the
 * call is placed and settlement returns `stake + payout`, which lands in
 * [0, 2 × stake]. A student can lose what they staked and never more, and the
 * scoring rule stays proper all the way to the ends of the scale.
 */
export const PAYOUT_K = 1;

export function payoutFor(stake, p, base, outcome) {
    const s = Math.max(0, Math.round(Number(stake) || 0));
    if (!s) return 0;
    return Math.round(s * PAYOUT_K * skill(p, base, outcome));
}

/**
 * Calibration over a run of resolved forecasts.
 *
 * The headline is the Brier SKILL score — your mean Brier against the house's
 * — because a raw Brier of 0.2 means nothing on its own: it is excellent on
 * coin-flips and poor on near-certainties. Skill is the version that survives
 * a mixed bag of questions, which is what a student will actually have.
 *
 * `buckets` is the reliability curve: of the calls you made at around 70%, how
 * many actually happened. That is the only view that tells somebody HOW they
 * are wrong — overconfident, underconfident, or fine — and it is the thing
 * worth coming back for.
 */
export const CALIBRATION_MIN = 5;
const BUCKETS = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.0001]];

export function calibration(resolved = []) {
    const rows = (Array.isArray(resolved) ? resolved : [])
        .filter((r) => r && typeof r.p === "number" && typeof r.outcome === "boolean"
            && typeof r.base === "number");

    if (!rows.length) {
        return { n: 0, enough: false, brier: null, skillScore: null, hitRate: null, buckets: [] };
    }

    const meanBrier = rows.reduce((sum, r) => sum + brier(r.p, r.outcome), 0) / rows.length;
    const meanHouse = rows.reduce((sum, r) => sum + brier(r.base, r.outcome), 0) / rows.length;

    const buckets = BUCKETS.map(([lo, hi]) => {
        const inBand = rows.filter((r) => clampP(r.p) >= lo && clampP(r.p) < hi);
        return {
            lo,
            hi: Math.min(1, hi),
            n: inBand.length,
            // Null rather than zero: no calls in a band is not a 0% hit rate,
            // and drawing it as one would print a reliability curve that dives
            // to the floor wherever a student simply has not been yet.
            said: inBand.length
                ? inBand.reduce((s, r) => s + clampP(r.p), 0) / inBand.length : null,
            happened: inBand.length
                ? inBand.filter((r) => r.outcome).length / inBand.length : null,
        };
    });

    return {
        n: rows.length,
        enough: rows.length >= CALIBRATION_MIN,
        brier: Math.round(meanBrier * 1000) / 1000,
        // Positive means you are beating the house across your record.
        skillScore: Math.round((meanHouse - meanBrier) * 1000) / 1000,
        hitRate: rows.filter((r) => r.outcome).length / rows.length,
        buckets,
    };
}

// ─── Questions the app can settle ───────────────────────────────────────────

/**
 * Fewer than this many past observations and the base rate is a stated PRIOR
 * rather than a measurement, and every surface says which it is. A rate of
 * "1 for 1" dressed up as 100% would be the app inventing a number, which is
 * the failure this codebase keeps writing up.
 */
export const MIN_OBS = 4;

const rate = (hits, n, prior) => (n >= MIN_OBS
    ? { p: hits / n, n, source: "you" }
    : { p: prior, n, source: "prior" });

/** Days from `from` to `to`, inclusive of neither end's time of day. */
const daysBetween = (from, to) =>
    Math.round((new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0)) / 86400000);

const dayKeysBetween = (from, to) => {
    const out = [];
    const d = new Date(new Date(from).setHours(0, 0, 0, 0));
    const end = new Date(new Date(to).setHours(0, 0, 0, 0));
    while (d <= end) { out.push(dayKey(d)); d.setDate(d.getDate() + 1); }
    return out;
};

/**
 * The three question kinds, and the one that does not pay.
 *
 * Every paying kind settles from rows the app already writes, through
 * `studyEvents` so BOTH study tables are read — the trap the ATAR's planning
 * component and the dashboard's week panel each fell into separately.
 */
export const KINDS = {
    /** "I'll study every day up to <date>." */
    streak: {
        key: "streak",
        label: "Keep studying daily",
        question: (f) => `You study every day through ${shortDate(f.deadline)}`,
        pays: true,
        /**
         * How often this student has actually carried a run of days.
         * Measured as: of their past days, how many were followed by another
         * studied day. Prior is 0.6 — a coin-flip is wrong here, because
         * somebody with the app open at all studies most days.
         */
        baseRate: ({ events }) => {
            const days = [...new Set(events.map((e) => e.day))].sort();
            if (days.length < 2) return rate(0, 0, 0.6);
            let followed = 0;
            let opportunities = 0;
            for (let i = 0; i < days.length - 1; i += 1) {
                opportunities += 1;
                if (daysBetween(days[i], days[i + 1]) === 1) followed += 1;
            }
            return rate(followed, opportunities, 0.6);
        },
        settle: ({ events, forecast, now }) => {
            if (new Date(now) < new Date(forecast.deadline)) return null;
            const studied = new Set(events.map((e) => e.day));
            return dayKeysBetween(forecast.created_at, forecast.deadline)
                .every((d) => studied.has(d));
        },
    },

    /** "I'll log ≥ N minutes this week." */
    minutes: {
        key: "minutes",
        label: "Hit your hours",
        question: (f) => `You log ${f.threshold}+ minutes by ${shortDate(f.deadline)}`,
        pays: true,
        /** Of this student's past weeks, how many cleared the same bar. */
        baseRate: ({ events, forecast }) => {
            const byWeek = new Map();
            events.forEach((e) => {
                const d = new Date(`${String(e.day).slice(0, 10)}T00:00:00`);
                if (Number.isNaN(d.getTime())) return;
                const k = dayKey(weekStart(d));
                byWeek.set(k, (byWeek.get(k) || 0) + (Number(e.minutes) || 0));
            });
            const weeks = [...byWeek.values()];
            return rate(weeks.filter((m) => m >= forecast.threshold).length, weeks.length, 0.5);
        },
        settle: ({ events, forecast, now }) => {
            if (new Date(now) < new Date(forecast.deadline)) return null;
            const from = dayKey(new Date(forecast.created_at));
            const to = dayKey(new Date(forecast.deadline));
            const total = events
                .filter((e) => e.day >= from && e.day <= to)
                .reduce((sum, e) => sum + (Number(e.minutes) || 0), 0);
            return total >= forecast.threshold;
        },
    },

    /** "I'll beat X% next time I sit <quiz>." */
    quiz: {
        key: "quiz",
        label: "Beat your score",
        question: (f) => `You score over ${f.threshold}% on ${f.subject || "that quiz"}`,
        pays: true,
        /** Of this student's past sits of that quiz, how many cleared the bar. */
        baseRate: ({ attempts, forecast }) => {
            const sits = attempts
                .filter((a) => a?.quiz_id === forecast.quiz_id && !isRetryAttempt(a))
                .map(effectiveScore)
                .filter((s) => typeof s === "number" && Number.isFinite(s));
            return rate(sits.filter((s) => s > forecast.threshold).length, sits.length, 0.5);
        },
        /**
         * Settles on the FIRST sit after the forecast was made, not the best
         * one. Waiting for a good sit and calling that the result is the same
         * exploit in a different costume.
         */
        settle: ({ attempts, forecast, now }) => {
            const after = attempts
                .filter((a) => a?.quiz_id === forecast.quiz_id && !isRetryAttempt(a)
                    && new Date(a?.created_date || 0) > new Date(forecast.created_at))
                .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            if (!after.length) {
                // No sit yet. Past the deadline with no attempt, the claim did
                // not happen — otherwise a forecast could be left open forever
                // and never be wrong.
                return new Date(now) >= new Date(forecast.deadline) ? false : null;
            }
            const score = effectiveScore(after[0]);
            return typeof score === "number" ? score > forecast.threshold : null;
        },
    },

    /**
     * "I'll get X on my SAC." — HONOUR SYSTEM, AND IT PAYS NOTHING.
     *
     * Real assessment marks are the thing students care most about and the one
     * thing the app genuinely cannot see. Keeping them is right; paying XP for
     * a number the student types in is exactly the hole this rework exists to
     * close, so this kind is settled by the student and settles for bragging
     * rights only. `pays: false` is checked wherever XP is awarded.
     */
    sac: {
        key: "sac",
        label: "Call your SAC",
        question: (f) => `You get over ${f.threshold}% on ${f.subject || "your SAC"}`,
        pays: false,
        baseRate: () => ({ p: 0.5, n: 0, source: "prior" }),
        settle: ({ forecast }) => (typeof forecast.reported === "number"
            ? forecast.reported > forecast.threshold
            : null),
    },
};

export const PAYING_KINDS = Object.values(KINDS).filter((k) => k.pays);

function shortDate(d) {
    const t = new Date(d);
    return Number.isNaN(t.getTime())
        ? "then"
        : t.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ─── The engine over a student's forecasts ──────────────────────────────────

/**
 * Base rate for a forecast, with the evidence behind it.
 *
 * Returns `{ p, n, source }` — never a bare number, because a rate off three
 * observations and a rate off forty are different claims and the panel has to
 * be able to say which one it is showing.
 */
export function baseRateFor(forecast, ctx = {}) {
    const kind = KINDS[forecast?.kind];
    if (!kind) return { p: 0.5, n: 0, source: "prior" };
    const events = ctx.events || studyEvents(ctx.sessions, ctx.techniques);
    const out = kind.baseRate({ ...ctx, events, forecast });
    return { ...out, p: clampP(out.p) };
}

/**
 * Settle one forecast: `true`, `false`, or `null` for not yet decidable.
 *
 * Pure over rows the app already loads, which is what makes it checkable: the
 * outcome is a fact about `study_sessions`, `study_techniques` and
 * `quiz_attempts`, not about anything the student typed into a form.
 */
export function settleForecast(forecast, ctx = {}) {
    const kind = KINDS[forecast?.kind];
    if (!kind) return null;
    const events = ctx.events || studyEvents(ctx.sessions, ctx.techniques);
    return kind.settle({
        ...ctx, events, forecast, now: ctx.now || new Date(),
        attempts: ctx.attempts || [],
    });
}

/**
 * Everything a panel needs about one forecast: the question, the price, what
 * it settled to, and what it paid.
 */
export function resolveOne(forecast, ctx = {}) {
    const kind = KINDS[forecast?.kind];
    if (!kind) return null;
    const base = baseRateFor(forecast, ctx);
    const outcome = settleForecast(forecast, ctx);
    const p = clampP(forecast.p);
    return {
        forecast,
        kind,
        question: kind.question(forecast),
        base,
        p,
        outcome,
        open: outcome === null,
        // Nothing is paid on an unsettled forecast, and nothing is EVER paid
        // on a kind the app cannot verify.
        xp: outcome === null || !kind.pays
            ? 0
            : payoutFor(forecast.stake, p, base.p, outcome),
    };
}

/** Every forecast, resolved, newest first, with the calibration over the settled ones. */
export function forecastBoard(forecasts = [], ctx = {}) {
    const rows = (Array.isArray(forecasts) ? forecasts : [])
        .map((f) => resolveOne(f, ctx))
        .filter(Boolean)
        .sort((a, b) => new Date(b.forecast.created_at || 0) - new Date(a.forecast.created_at || 0));

    const settled = rows.filter((r) => !r.open);
    return {
        open: rows.filter((r) => r.open),
        settled,
        calibration: calibration(settled.map((r) => ({
            p: r.p, base: r.base.p, outcome: r.outcome,
        }))),
        // Lifetime XP from forecasts that actually resolved, so a panel can
        // say what the habit has been worth without re-deriving it.
        netXp: settled.reduce((sum, r) => sum + r.xp, 0),
    };
}
