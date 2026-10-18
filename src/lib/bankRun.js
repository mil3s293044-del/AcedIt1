/**
 * bankRun — the Mistake Bank as one pile, and what a drill run did to it.
 *
 * The page answered "am I fixing these?" three ways at once: a by-subject
 * accordion, six state filter chips over two rows, and the full list — under a
 * five-colour bar with a legend, beside four different buttons that each
 * started a review. Seven mistakes, organised three times, and a state drawn
 * four ways on every row (a dot, a border, a bar segment, a chip).
 *
 * And a drill ended on a sentence — "3 of 4 recalled" — when the thing a run
 * actually changes is where each mistake sits on its ladder. A card rated Good
 * climbs a rung; Again drops it back to the start; Hard holds it where it is.
 * That is the progress, and the run never said it.
 *
 * Everything here is derived from rows the page already loads, and it reads
 * the ONE ladder (`ladderFor`) and the ONE scheduler (`calculateNextReview`),
 * so what the run reports is what the next visit will show. Pure, so a test
 * can hold it.
 */
import { calculateNextReview, reviewPatch } from "@/lib/sm2";
import { ladderFor, drillFor, LADDER, LADDER_COMPLETE_AT } from "@/lib/drill";
import {
    FIX_STATES, fixState, mistakeMeta, ladderDone, clearedBy, repeatOffenders, isBankCard, isRetired,
} from "@/lib/mistakeBank";

/** The work before the wins: still going wrong, untouched, coming back, rehearsed, fixed. */
const RANK = Object.fromEntries(FIX_STATES.map((s, i) => [s, i]));

/* ── The pile ─────────────────────────────────────────────────────────────── */

/**
 * The headline's pile: one slot per mistake in the working set, fixed ones at
 * the end. It draws ONE fact — fixed or not — because a bar in five colours
 * needed a five-entry legend to be read, and the rows below already say which
 * state each one is in. A bank of forty draws forty slots; past PILE_SLOTS_MAX
 * it is a continuous bar, because a slot a pixel wide is not a slot.
 */
export const PILE_SLOTS_MAX = 40;

export function pileOf(cards = [], attempts) {
    const states = cards.map((c) => fixState(c, attempts));
    const fixed = states.filter((s) => s === "fixed").length;
    return {
        total: states.length,
        fixed,
        slots: states.length <= PILE_SLOTS_MAX
            ? [...states].sort((a, b) => RANK[a] - RANK[b]).map((s) => s === "fixed")
            : null,
        pct: states.length ? Math.round((fixed / states.length) * 100) : 0,
    };
}

/* ── The bands ────────────────────────────────────────────────────────────── */

/**
 * The bank by subject, each band's rows in the order the work should be done.
 *
 * ONE ORGANISATION. Subject is the unit a student sits down with before a SAC;
 * the topic rides on each row, where it labels the mistake without becoming a
 * second level of navigation. Within a band: still getting it wrong first,
 * then untouched, coming back, rehearsed, and fixed last.
 *
 * `repeat` is how many mistakes in the working set share this one's criterion.
 * "You keep making these" was a panel of its own above the list; as a count on
 * the row it sits beside the mistake it is about, and a criterion missed once
 * carries nothing (1 is not a repeat).
 */
export function bankBands(cards = [], { attempts, isReady = () => false } = {}) {
    const live = cards.filter((c) => isBankCard(c) && !isRetired(c));
    const repeats = new Map(repeatOffenders(live, { min: 2, attempts })
        .map((r) => [r.criterion.toLowerCase(), r.count]));
    const bands = new Map();
    for (const card of live) {
        const subject = card.subject_name || "No subject";
        if (!bands.has(subject)) bands.set(subject, { subject, rows: [], fixed: 0, ready: [], outstanding: 0 });
        const band = bands.get(subject);
        const state = fixState(card, attempts);
        const meta = mistakeMeta(card);
        band.rows.push({
            card,
            state,
            topic: meta.topic || null,
            repeat: repeats.get(String(meta.criterion || "").toLowerCase()) || 0,
        });
        if (state === "fixed") band.fixed += 1; else band.outstanding += 1;
        if (isReady(card)) band.ready.push(card);
    }
    return [...bands.values()]
        .map((b) => ({
            ...b,
            total: b.rows.length,
            rows: b.rows.sort((x, y) => (RANK[x.state] - RANK[y.state])
                || String(x.topic || "").localeCompare(String(y.topic || ""))),
        }))
        // Most still to do first: a band with nothing left in it does not get
        // to sit at the top of a work queue.
        .sort((a, b) => (b.outstanding - a.outstanding) || a.subject.localeCompare(b.subject));
}

/* ── The ladder, before and after a rating ────────────────────────────────── */

const STAGE_INDEX = Object.fromEntries(LADDER.map((s, i) => [s.id, i]));
const STAGE_LABEL = Object.fromEntries(LADDER.map((s) => [s.id, s.label]));

/**
 * The card's ladder AS IT WILL BE DRILLED.
 *
 * `ladderFor` reads the rung off the repetition counter, and when that rung
 * cannot be built for this mistake (no quote to spot in, nothing worth
 * blanking) it marks the rung skipped — and then NO step is current. The drill
 * itself (`drillFor`) falls BACK to the rung below in that case. So for a card
 * whose counter sat on an unbuildable rung, the row's tracker said "step 2 of
 * 4" with nothing lit, the drill served See it again, and a run reported the
 * card as finished: three answers to "where is this one", found by driving a
 * real run. The current step is the one `drillFor` will serve, everything live
 * before it is done and everything after it is still to come.
 */
export function stepsFor(card, attempts) {
    const laddered = ladderDone(card);
    const steps = ladderFor(card, { laddered, cleared: !!clearedBy(card, attempts || []) });
    if (laddered) return steps;
    const at = STAGE_INDEX[drillFor(card).stage];
    return steps.map((s, i) => {
        if (s.state === "skipped" || s.id === "redo") return s;
        return { ...s, state: i < at ? "done" : i === at ? "current" : "todo" };
    });
}

/**
 * Where a card is: the step it is ON (the exercise it will get next), or the
 * last gate — `redo` once the rehearsal is done and only the question is left,
 * `done` when nothing is. `next` is the rung it is heading for and `needs` how
 * many more good ratings open it, so a Good that advanced the counter without
 * changing the exercise can say how close it got rather than "still on".
 */
export function rungOf(card, attempts) {
    const steps = stepsFor(card, attempts);
    if (ladderDone(card)) {
        const gate = steps.find((s) => s.id === "redo" && s.state === "current");
        return gate
            ? { index: STAGE_INDEX.redo, id: "redo", label: STAGE_LABEL.redo, steps, next: null, needs: 0 }
            : { index: LADDER.length, id: "done", label: "Done", steps, next: null, needs: 0 };
    }
    const stage = drillFor(card).stage;
    const index = STAGE_INDEX[stage];
    const reps = Number(card?.repetitions) || 0;
    // The first count at which the drill would serve a harder exercise.
    // Past the last rehearsal rung the next stop is the question — or, for a
    // mistake with no source question to sit, simply fixed.
    const end = mistakeMeta(card).source ? STAGE_LABEL.redo : "fixed";
    let next = null; let needs = 0;
    for (let r = reps + 1; r <= LADDER_COMPLETE_AT; r += 1) {
        if (r >= LADDER_COMPLETE_AT) { next = end; needs = r - reps; break; }
        const ahead = drillFor({ ...card, repetitions: r }).stage;
        if (STAGE_INDEX[ahead] > index) { next = STAGE_LABEL[ahead]; needs = r - reps; break; }
    }
    return { index, id: stage, label: STAGE_LABEL[stage], steps, next, needs };
}

/**
 * The card as it will be after this rating — the same patch the page writes,
 * from the same scheduler, applied without a round trip.
 */
export function afterRating(card, quality) {
    const updates = calculateNextReview(quality, card);
    return {
        ...card,
        ...reviewPatch(updates, quality),
        total_reviews: (card.total_reviews || 0) + 1,
    };
}

/**
 * What one rating did to one card.
 *
 *   climbed   a harder exercise next time
 *   closer    the count went up but the exercise did not change yet — Good
 *             inside a rung's range, or a rung this mistake cannot build. It
 *             is progress, and "still on" would hide it.
 *   held      Hard: the count did not move
 *   slipped   Again: the count went back to the start
 *   proven    the rehearsal is done and the question is the only step left
 *   fixed     ladder done AND earned back on a later sit
 *
 * Read off the card before and after, never off the button alone.
 */
export function moveOf(before, after, attempts) {
    const a = rungOf(before, attempts);
    const b = rungOf(after, attempts);
    const repsBefore = Number(before?.repetitions) || 0;
    const repsAfter = Number(after?.repetitions) || 0;
    let kind;
    if (fixState(after, attempts) === "fixed") kind = "fixed";
    else if (b.id === "redo" && a.id !== "redo") kind = "proven";
    else if (repsAfter < repsBefore) kind = "slipped";
    else if (repsAfter > repsBefore) kind = b.index > a.index ? "climbed" : "closer";
    else kind = "held";
    return {
        id: before.id, kind, from: a.label, to: b.label,
        fromIndex: a.index, toIndex: b.index, next: b.next, needs: b.needs,
    };
}

/** The sentence under a card as it leaves the table. */
export function moveLine(move) {
    if (!move) return null;
    if (move.kind === "fixed") return "Fixed.";
    if (move.kind === "proven") return "Rehearsed — sit the question to prove it.";
    if (move.kind === "climbed") return `Up to ${move.to}.`;
    if (move.kind === "closer") {
        const more = move.needs === 1 ? "One more" : `${move.needs} more`;
        if (move.next === "fixed") return `${more} good and it's fixed.`;
        return move.next ? `${more} good to reach ${move.next}.` : `Still on ${move.to}, and closer.`;
    }
    if (move.kind === "slipped") {
        return move.from === move.to
            ? `Back to the start of ${move.to}. It comes round again tomorrow.`
            : `Back to ${move.to}. It comes round again tomorrow.`;
    }
    return `Still on ${move.to}.`;
}

/**
 * The run, counted. Each card is reported ONCE, on its last move — a card
 * drilled twice in one run (it can be, if it was due twice) is one card.
 */
export function runSummary(moves = []) {
    const last = new Map();
    for (const m of moves) if (m?.id != null) last.set(m.id, m);
    const out = { climbed: [], closer: [], held: [], slipped: [], proven: [], fixed: [] };
    for (const m of last.values()) (out[m.kind] || out.held).push(m);
    return {
        ...out,
        total: last.size,
        // Up is anything that moved forward: a harder exercise, a step closer
        // to one, onto the last gate, or fixed.
        up: out.climbed.length + out.closer.length + out.proven.length + out.fixed.length,
    };
}

/* ── The run's reveal ─────────────────────────────────────────────────────── */

/** How long a card holds on the rail after rating, before the next is dealt. */
export const MOVE_MS = 900;

export default {
    PILE_SLOTS_MAX, pileOf, bankBands, stepsFor, rungOf, afterRating, moveOf, moveLine, runSummary, MOVE_MS,
};
