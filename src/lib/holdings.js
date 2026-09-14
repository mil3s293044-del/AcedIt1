/**
 * holdings — your own book, derived from your own positions.
 *
 * ═══ Why a portfolio tab at all ═════════════════════════════════════════════
 * The floor answers "what can I take a side on". It cannot answer "how am I
 * doing", and that is the question that brings somebody back on Wednesday. A
 * balance in the header is not an answer: it moves for two completely
 * different reasons — the Monday grant and your own calls — and a student
 * watching one number cannot tell which of those just happened.
 *
 * ═══ NOTHING HERE IS STORED ═════════════════════════════════════════════════
 * Every figure is computed from positions that already exist, the same rule
 * `redoQueue`, `subjectHub` and `priceHistory` follow. So the equity curve
 * cannot disagree with the tape, the record cannot disagree with the reveal,
 * and there is no column to backfill when a rule changes.
 *
 * ═══ CALIBRATION IS THE POINT, and it is the thing a betting app cannot do ══
 * Every other number on this tab exists on any trading screen. This one exists
 * because the model asks students to STATE A BELIEF rather than accept a
 * price: when you said 80%, were you right 80% of the time? That is a
 * measurable skill, it improves with practice, and it is the actual
 * transferable thing this whole feature teaches. It is also the aggregate of
 * the sentence SettlementReveal prints one result at a time.
 *
 * ═══ AND IT REFUSES TO SCORE SOMEBODY ON TWO DATA POINTS ════════════════════
 * A bucket under `CALIBRATION_MIN` reports as "not enough yet" rather than as
 * a point on a curve. Telling a student with three settled calls that they are
 * overconfident is the "never score a student on a signal they can't reach"
 * rule broken in its most damaging form — it is a personality judgement made
 * off a coin flip. The same reasoning as TREND_MIN, MARKET_MIN_OBS and
 * MIN_BASELINE_WEEKS, all of which were added after the same mistake.
 */
import { clampP, convictionOf, markToMarket, sideOf, YES } from "@/lib/market";

/** Settled calls needed in a bucket before it is drawn as a point. */
export const CALIBRATION_MIN = 3;
/** ...and across the whole book before a curve is drawn at all. */
export const CALIBRATION_MIN_TOTAL = 8;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const timeOf = (v) => {
    const t = new Date(v || 0).getTime();
    return Number.isFinite(t) && t > 0 ? t : null;
};

/** Settled and paid, as opposed to settled-as-void or still running. */
const isSettled = (h) => !!h.settled_at && h.market?.status !== "open";
const isVoid = (h) => h.market?.status === "void";

/**
 * FOUR OUTCOMES, matching `settlementOf` exactly.
 *
 * `level` and `void` are not losses and must never be counted as one — the
 * whole board rests on "restating the price pays nothing", and a record that
 * files that under defeats teaches the opposite of the one property the system
 * has. Two screens disagreeing about what happened to the same position is how
 * a student stops believing either.
 */
export function outcomeOf(h) {
    if (!isSettled(h)) return null;
    if (isVoid(h)) return "void";
    const payout = Math.round(num(h.payout));
    return payout > 0 ? "won" : payout < 0 ? "lost" : "level";
}

/** Everything at once, because the tab renders it all off one pass. */
export function bookOf(holdings = []) {
    const rows = (holdings || []).filter(Boolean);
    const open = rows.filter((h) => h.market?.status === "open" && !h.settled_at);
    const closed = rows.filter(isSettled);

    const atStake = open.reduce((s, h) => s + Math.max(0, num(h.stake)), 0);
    const realised = closed.reduce((s, h) => s + Math.round(num(h.payout)), 0);

    // What the open book is worth at TODAY's prices. Deliberately not called
    // unrealised P/L: there is no way to close a position early here, so this
    // is an expectation that will keep moving, not a figure you could take.
    const expected = open.reduce((s, h) => {
        const mtm = markToMarket(h, clampP(h.market?.price ?? h.price_at_entry));
        return s + (mtm ? num(mtm.ev) : 0);
    }, 0);

    const record = { won: 0, lost: 0, level: 0, void: 0 };
    closed.forEach((h) => { const o = outcomeOf(h); if (o) record[o] += 1; });
    const decided = record.won + record.lost;

    return {
        open, closed,
        atStake,
        realised,
        expected: Math.round(expected),
        record,
        decided,
        // Only over calls that actually resolved one way or the other. Voids
        // tested nothing and levels were a deliberate no-op, so including
        // either in the denominator makes a good week look like a mediocre one.
        hitRate: decided > 0 ? record.won / decided : null,
        streak: streakOf(closed),
        best: closed.reduce((b, h) =>
            (Math.round(num(h.payout)) > Math.round(num(b?.payout || -Infinity)) ? h : b), null),
    };
}

/**
 * The current run of winning calls.
 *
 * A `level` neither breaks the run nor extends it — it is the rule working as
 * designed rather than a result — and a `void` is a question that was never
 * asked. Counting either as a defeat would end somebody's streak for having
 * agreed with the crowd once.
 */
export function streakOf(closed = []) {
    const ordered = [...closed].sort(
        (a, b) => (timeOf(b.settled_at) ?? 0) - (timeOf(a.settled_at) ?? 0));
    let n = 0;
    for (const h of ordered) {
        const o = outcomeOf(h);
        if (o === "won") n += 1;
        else if (o === "lost") break;
        // level and void: skipped, neither counted nor fatal.
    }
    return n;
}

/**
 * Cred over time, from settled payouts in the order they landed.
 *
 * It is a curve of RESULTS, not of balance: the weekly grant and the top-up
 * would dominate a balance chart and neither is anything the student did. What
 * this draws is the cumulative consequence of their own calls, which is the
 * only part of the number they control.
 */
export function equityCurve(holdings = []) {
    const closed = (holdings || []).filter(isSettled)
        .filter((h) => timeOf(h.settled_at) != null)
        .sort((a, b) => timeOf(a.settled_at) - timeOf(b.settled_at));
    if (!closed.length) return { points: [], last: 0, high: 0, low: 0, best: 0, worst: 0 };

    let run = 0;
    let high = 0;
    let low = 0;
    const points = [{ t: timeOf(closed[0].settled_at) - 36e5, value: 0, payout: 0, title: null }];
    for (const h of closed) {
        const payout = Math.round(num(h.payout));
        run += payout;
        high = Math.max(high, run);
        low = Math.min(low, run);
        points.push({
            t: timeOf(h.settled_at), value: run, payout,
            title: h.market?.title || null,
            outcome: outcomeOf(h),
        });
    }
    const payouts = closed.map((h) => Math.round(num(h.payout)));
    return {
        points, last: run, high, low,
        best: Math.max(...payouts), worst: Math.min(...payouts),
    };
}

/** The buckets a stated confidence falls into. 50% is a coin flip, so it starts there. */
const BANDS = [
    [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.0001],
];

/**
 * Stated confidence against what actually happened.
 *
 * Bucketed on CONVICTION rather than on the raw probability, because the
 * question is "when you are 80% sure, are you right 80% of the time" — which
 * is symmetric between backing yes at 80 and backing no at 80. Bucketing on
 * P(yes) would split one skill across two ends of the axis and report neither.
 *
 * `right` is whether the side they backed is what happened, which is exactly
 * the thing they were being confident ABOUT.
 */
export function calibration(holdings = []) {
    const graded = (holdings || [])
        .filter(isSettled)
        .filter((h) => !isVoid(h))                    // nothing was tested
        .map((h) => ({
            conviction: convictionOf(clampP(h.p)),
            right: (sideOf(clampP(h.p)) === YES) === !!h.market?.outcome,
        }));

    const bands = BANDS.map(([lo, hi]) => {
        const inBand = graded.filter((g) => g.conviction >= lo && g.conviction < hi);
        const n = inBand.length;
        const enough = n >= CALIBRATION_MIN;
        return {
            lo, hi,
            label: `${Math.round(lo * 100)}–${Math.round(Math.min(1, hi) * 100)}%`,
            n,
            enough,
            // Their own average claim in this band, so the dot sits where they
            // actually said rather than at the midpoint of a bucket nobody chose.
            stated: n ? inBand.reduce((s, g) => s + g.conviction, 0) / n : null,
            actual: enough ? inBand.filter((g) => g.right).length / n : null,
        };
    });

    const usable = bands.filter((b) => b.enough);
    // One number for the headline, weighted by how many calls each band holds:
    // positive means overconfident (you claimed more than you delivered).
    let bias = null;
    if (graded.length >= CALIBRATION_MIN_TOTAL && usable.length) {
        const n = usable.reduce((s, b) => s + b.n, 0);
        bias = usable.reduce((s, b) => s + (b.stated - b.actual) * b.n, 0) / n;
    }

    return {
        bands,
        graded: graded.length,
        ready: graded.length >= CALIBRATION_MIN_TOTAL && usable.length > 0,
        // How many more settled calls before this says anything at all.
        needs: Math.max(0, CALIBRATION_MIN_TOTAL - graded.length),
        bias,
    };
}
