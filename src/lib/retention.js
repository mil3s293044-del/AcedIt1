/**
 * retention — what the student is about to forget, from their own SM-2 state.
 *
 * The flashcard table already carries everything needed for this and nothing
 * has ever read it for anything but scheduling: interval_days, repetitions,
 * last_reviewed_date, and the per-quality review counters.
 *
 * THE MODEL, stated plainly because it is a model and not a measurement:
 * memory strength decays exponentially, R(t) = e^(−t/S), where S is the
 * card's stability in days. SM-2 schedules the next review for the point where
 * recall has fallen to roughly 90%, so a card sitting on a 30-day interval is
 * one the scheduler believes will still be ~90% retrievable 30 days out. That
 * pins S: e^(−I/S) = 0.9, so S = I / ln(10/9).
 *
 * WHAT THIS DELIBERATELY DOES NOT DO is fold easiness_factor or the lapse
 * counters into S on top of that. SM-2 already multiplies the interval by EF
 * and resets it on a lapse, so a hard card is a card with a short interval —
 * applying the penalty again would count it twice and make every difficult
 * card look like it had already evaporated. Lapse rate is reported separately
 * instead, where it says something the interval doesn't.
 *
 * A card that has never been reviewed is not decaying, it was never learned.
 * Those are excluded rather than counted as forgotten.
 */

const DAY = 86400000;

/** The recall SM-2 aims for at the moment it schedules the next review. */
const SCHEDULER_TARGET = 0.9;
const K = -Math.log(SCHEDULER_TARGET);          // ≈ 0.10536

/** Below this, treat a card as no longer reliably retrievable. */
export const RISK_FLOOR = 0.85;

/** Roughly what one card costs to review, for the "this much time" figure. */
export const SECONDS_PER_CARD = 12;

/**
 * A card just learned but never given a real interval still holds for about a
 * day. Without a floor its stability is zero and recall is instantly 0.
 */
const MIN_STABILITY_DAYS = 1;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Stability in days: how long until recall falls to 1/e (~37%). */
export function stabilityDays(card) {
    const iv = Math.max(0, num(card?.interval_days));
    return Math.max(MIN_STABILITY_DAYS, iv / K);
}

/**
 * Has this card ever actually been learned? A card with no reviews behind it
 * is unseen material, not decayed material, and lumping the two together would
 * make a fresh deck look like a catastrophe.
 */
export function isLearned(card) {
    return num(card?.repetitions) > 0 || num(card?.total_reviews) > 0;
}

const lastReviewOf = (card) => {
    const raw = card?.last_reviewed_date || card?.updated_date || card?.created_date;
    const t = Date.parse(raw || "");
    return Number.isFinite(t) ? t : null;
};

/**
 * Predicted recall of one card at a moment in time, or null when the card has
 * never been reviewed or carries no usable date. Null means "no opinion" —
 * callers must not read it as zero.
 */
export function recallAt(card, at = Date.now()) {
    if (!isLearned(card)) return null;
    const last = lastReviewOf(card);
    if (last == null) return null;
    const elapsed = Math.max(0, (at - last) / DAY);
    return Math.exp(-elapsed / stabilityDays(card));
}

/** Minutes to review n cards, rounded up to something a student can act on. */
export function reviewMinutes(n) {
    if (!n) return 0;
    return Math.max(1, Math.round((n * SECONDS_PER_CARD) / 60));
}

/**
 * The whole picture for a collection.
 *
 * `slipping` — already below the floor today. These are the ones the student
 *   has effectively lost hold of and can still get back cheaply.
 * `falling`  — above the floor now, below it within the window. This is the
 *   part nothing else in the app can tell them: work that is fine today and
 *   won't be on Friday.
 */
export function retentionOutlook(cards = [], { days = 7, floor = RISK_FLOOR, now = Date.now() } = {}) {
    const learned = [];
    for (const c of cards) {
        if (c?.is_active === false) continue;
        const rNow = recallAt(c, now);
        if (rNow == null) continue;
        learned.push({ card: c, rNow, rThen: recallAt(c, now + days * DAY) });
    }

    const slipping = learned.filter(x => x.rNow < floor);
    const falling = learned.filter(x => x.rNow >= floor && x.rThen < floor);

    // Per subject, so the student is pointed at a deck rather than a number.
    const bySubject = new Map();
    for (const x of [...slipping, ...falling]) {
        const key = x.card.subject_name || "Unsorted";
        const prev = bySubject.get(key) || { subject: key, slipping: 0, falling: 0, topics: new Set(), worst: 1 };
        if (x.rNow < floor) prev.slipping++; else prev.falling++;
        if (x.card.topic) prev.topics.add(x.card.topic);
        prev.worst = Math.min(prev.worst, x.rNow);
        bySubject.set(key, prev);
    }
    const subjects = [...bySubject.values()]
        .map(s => ({
            subject: s.subject,
            slipping: s.slipping,
            falling: s.falling,
            total: s.slipping + s.falling,
            topics: [...s.topics],
            worst: s.worst,
            minutes: reviewMinutes(s.slipping + s.falling),
        }))
        // Already-slipping outranks about-to-fall: it's the more urgent half of
        // the same number, and sorting on the bare total buries it.
        .sort((a, b) => (b.slipping - a.slipping) || (b.total - a.total));

    // What happens over the window if they do nothing — the honest projection,
    // and the reason the card can claim anything at all about "this week".
    const curve = [];
    for (let d = 0; d <= days; d++) {
        const at = now + d * DAY;
        let held = 0;
        for (const x of learned) if (recallAt(x.card, at) >= floor) held++;
        curve.push({ day: d, held, share: learned.length ? held / learned.length : 0 });
    }

    // Lapse rate is the one thing the interval genuinely does not express: it
    // says whether the material keeps collapsing rather than how long it holds
    // right now.
    let again = 0, reviews = 0;
    for (const x of learned) {
        again += num(x.card.review_count_again);
        reviews += num(x.card.total_reviews);
    }

    const atRisk = slipping.length + falling.length;
    return {
        learnedCount: learned.length,
        slipping: slipping.length,
        falling: falling.length,
        atRisk,
        subjects,
        curve,
        minutes: reviewMinutes(atRisk),
        lapseRate: reviews > 0 ? again / reviews : null,
        holdingNow: learned.length - slipping.length,
        hasData: learned.length > 0,
        days,
        floor,
    };
}

/**
 * One line about the shape of it. Not congratulatory when there's nothing to
 * say, and never phrased as a measurement of their memory.
 */
export function retentionSummary(o) {
    if (!o?.hasData) return "No cards have been reviewed yet — this fills in once you start a deck.";
    if (o.atRisk === 0) {
        return `All ${o.learnedCount} of your cards are still holding. Nothing falls out of reach this week.`;
    }
    if (o.slipping && o.falling) {
        return `${o.slipping} card${o.slipping === 1 ? " has" : "s have"} already slipped, and ${o.falling} more drop out of reach within ${o.days} days.`;
    }
    if (o.slipping) {
        return `${o.slipping} card${o.slipping === 1 ? " has" : "s have"} already slipped below reliable recall.`;
    }
    return `${o.falling} card${o.falling === 1 ? "" : "s"} drop out of reach within ${o.days} days if nothing is reviewed.`;
}
