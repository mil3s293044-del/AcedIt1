/**
 * sm2 — the scheduler. When a card comes back, and what a rating does to it.
 *
 * This lived as a module-local const inside SpacedRepetition.jsx, which is
 * exactly where `cardMastery` used to live and for exactly as long as it took
 * a second screen to need it. The mistake bank reviews the same rows through
 * the same four buttons; a second copy of this arithmetic is how two parts of
 * an app start scheduling the same card for two different days.
 *
 * THE MATH IS UNCHANGED, deliberately. This is a move, not a rewrite — every
 * interval, ease adjustment and weak-spot rule below is the one the review
 * deck has been using, so a card graded in the bank comes back on the day the
 * deck would have chosen. Anything arguable about the weights is out of scope
 * here and should be argued about once, in this file, where both screens will
 * follow.
 *
 * Ratings are 1–4 (Again / Hard / Good / Easy), not SM-2's 0–5. That is the
 * app's own scale and the buttons are built from `RATINGS` below, so the two
 * cannot drift apart.
 */
import { cardMastery } from "./mastery.js";

// Static class strings (Tailwind JIT-safe) — overdue/hard → streak,
// hard/energy → xp, good (default recall) → chart-3 (blue), easy → primary.
export const RATINGS = [
    { quality: 1, label: "Again", sublabel: "Didn't recall", color: "bg-streak/10 hover:bg-streak/20 text-streak border-streak/30 hover:border-streak/50" },
    { quality: 2, label: "Hard",  sublabel: "Almost",        color: "bg-xp/10 hover:bg-xp/20 text-xp border-xp/30 hover:border-xp/50" },
    { quality: 3, label: "Good",  sublabel: "Recalled",      color: "bg-chart-3/10 hover:bg-chart-3/20 text-chart-3 border-chart-3/30 hover:border-chart-3/50" },
    { quality: 4, label: "Easy",  sublabel: "Perfect",       color: "bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 hover:border-primary/50" },
];

/** Human-readable interval for the rating-button previews ("1d", "2w", "3mo"). */
export const formatIntervalShort = (days) => {
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}mo`;
};

/**
 * A card's next state after one rating.
 *
 * Returns the fields to persist plus `_mastery_score`, which is derived rather
 * than stored — the flashcards table has no mastery column, so callers strip
 * the underscore-prefixed keys before writing.
 */
export function calculateNextReview(quality, card) {
    let sessionSkipCount = 0;
    const updatedCounts = {
        review_count_again: card.review_count_again || 0,
        review_count_hard: card.review_count_hard || 0,
        review_count_good: card.review_count_good || 0,
        review_count_easy: card.review_count_easy || 0,
        consecutive_good: card.consecutive_good || 0,
        consecutive_easy: card.consecutive_easy || 0
    };

    // SM-2 ease factor and interval
    let ef = card.easiness_factor || 2.5;
    let interval = card.interval_days || 1;
    let repetitions = card.repetitions || 0;

    if (quality === 1) {
        updatedCounts.review_count_again++;
        updatedCounts.consecutive_good = 0;
        updatedCounts.consecutive_easy = 0;
        sessionSkipCount = 0;
        ef = Math.max(1.3, ef - 0.2);
        interval = 1;
        repetitions = 0;
    } else if (quality === 2) {
        updatedCounts.review_count_hard++;
        updatedCounts.consecutive_good = 0;
        updatedCounts.consecutive_easy = 0;
        sessionSkipCount = 0;
        ef = Math.max(1.3, ef - 0.15);
        interval = Math.max(1, Math.floor(interval * 1.2));
        // don't increment repetitions — needs another good rating
    } else if (quality === 3) {
        updatedCounts.review_count_good++;
        updatedCounts.consecutive_good++;
        updatedCounts.consecutive_easy = 0;
        sessionSkipCount = 1;
        ef = Math.max(1.3, ef - 0.05); // slight decay for "just good"
        repetitions++;
        if (repetitions === 1) interval = 1;
        else if (repetitions === 2) interval = 3;
        else interval = Math.round(interval * ef);
    } else if (quality === 4) {
        updatedCounts.review_count_easy++;
        updatedCounts.consecutive_easy++;
        updatedCounts.consecutive_good = 0;
        sessionSkipCount = 1;
        ef = Math.min(3.0, ef + 0.1);
        repetitions++;
        if (repetitions === 1) interval = 2;
        else if (repetitions === 2) interval = 5;
        else interval = Math.round(interval * ef);
    }

    // Cap interval at 180 days
    interval = Math.min(interval, 180);

    // Next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    const nextReviewDate = nextReview.toISOString().split('T')[0];

    // Weak spot logic
    const totalDifficult = updatedCounts.review_count_again + updatedCounts.review_count_hard;
    const totalReviews = totalDifficult + updatedCounts.review_count_good + updatedCounts.review_count_easy;
    let isWeakSpot = totalReviews >= 3 && (totalDifficult / totalReviews) >= 0.5;
    if (card.is_weak_spot) {
        if (updatedCounts.consecutive_good >= 3 || updatedCounts.consecutive_easy >= 2) isWeakSpot = false;
        else isWeakSpot = true;
    }

    const updatedCardForMastery = {
        ...card, ...updatedCounts, easiness_factor: ef, interval_days: interval,
        last_reviewed_date: new Date().toISOString().split('T')[0],
    };

    return {
        ...updatedCounts,
        session_skip_count:  sessionSkipCount,
        is_weak_spot:        isWeakSpot,
        easiness_factor:     ef,
        interval_days:       interval,
        repetitions,
        next_review_date:    nextReviewDate,
        _mastery_score:      cardMastery(updatedCardForMastery),
    };
}

/**
 * The columns a graded card writes back.
 *
 * One list, because both review screens send the same update and a field
 * added here has to reach both. Derived fields (`_mastery_score`) are excluded
 * by construction rather than by remembering to strip them — the flashcards
 * table has no column for them and PostgREST rejects the whole row if one
 * slips through.
 */
export function reviewPatch(updates, quality) {
    return {
        review_count_again: updates.review_count_again,
        review_count_hard:  updates.review_count_hard,
        review_count_good:  updates.review_count_good,
        review_count_easy:  updates.review_count_easy,
        consecutive_good:   updates.consecutive_good,
        consecutive_easy:   updates.consecutive_easy,
        session_skip_count: updates.session_skip_count,
        is_weak_spot:       updates.is_weak_spot,
        easiness_factor:    updates.easiness_factor,
        interval_days:      updates.interval_days,
        repetitions:        updates.repetitions,
        next_review_date:   updates.next_review_date,
        last_reviewed_date: new Date().toISOString().split("T")[0],
        last_quality:       quality,
    };
}
